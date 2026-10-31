import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
const script = fileURLToPath(new URL('./windows-dialogs.ps1', import.meta.url));
export function classifyDialog(dialog) {
  const controls = dialog.controls ?? [];
  const buttons = controls.filter(c => c.class === 'Button'||c.class==='UIA.ControlType.Button');
  const text = [...new Set(controls.filter(c => c.class === 'Static'||c.class==='UIA.ControlType.Text').map(c => c.text).filter(Boolean))].join('\n').trim();
  const safe = dialog.class === '#32770' && dialog.title === 'Adobe Photoshop'
    && /^(找不到要移去的背景[。.]?|Could not find (a |the )?background to remove[.!]?)$/.test(text)
    && buttons.length === 1 && [1,2].includes(buttons[0].id) && buttons[0].enabled === true
    && /^(确定|OK)\s*(&[A-Za-z]|\((&?[A-Za-z])\))?$/.test(buttons[0].text)
    && controls.every(c => ['Static', 'Button'].includes(c.class));
  return {handle:dialog.handle,pid:dialog.pid,title:dialog.title,kind:dialog.class,blocking:dialog.blocking!==false,text,buttons:buttons.map(b=>b.text),recoverable:safe};
}
let cached, cachedAt=0, inFlight;
export async function windowsDialogs(action='inspect', handle='', expectedText='') {
  if (process.platform !== 'win32') return {supported:false,dialogs:[]};
  if(action==='inspect'&&cached&&Date.now()-cachedAt<350)return cached;
  if(action==='inspect'&&inFlight)return inFlight;
  const request=run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Action',action,'-Handle',handle,'-ExpectedText',expectedText],{windowsHide:true,timeout:5000,maxBuffer:128*1024}).then(({stdout})=>JSON.parse(stdout.replace(/^\uFEFF/, '').trim()));
  if(action==='inspect')inFlight=request;
  try{const value=await request;if(action==='inspect'){cached=value;cachedAt=Date.now();}else{cached=undefined;cachedAt=0;}return value;}finally{if(inFlight===request)inFlight=undefined;}
}
export function dialogDefinition(invoke=windowsDialogs) {
  return {tool:{name:'photoshop_dialogs',description:'Inspect Photoshop modal dialogs without using its blocked script queue. Dismiss only a recognized error acknowledgment; never confirms save, overwrite, discard, sign-in or unknown prompts. After recovery, ping then inspect document state; do not repeat the failed edit blindly.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['inspect','dismiss_known_error']},handle:{type:'string',description:'Exact dialog handle from inspect; required for dismiss_known_error.'}},required:['action'],additionalProperties:false}},handler:async({action,handle})=>{
    if (!['inspect','dismiss_known_error'].includes(action)) throw Error('Unknown dialog action');
    const found=await invoke();
    const dialogs=(found.dialogs??[]).map(classifyDialog);
    if(action==='inspect')return response({supported:found.supported!==false,dialogs});
    const target=dialogs.find(d=>d.handle===handle);
    if(!target?.recoverable)return response({ok:false,code:'dialog_not_allowlisted',dialogs});
    await invoke('dismiss',handle,target.text);
    const remaining=(await invoke()).dialogs??[];
    return response({ok:!remaining.some(d=>d.handle===handle),code:remaining.some(d=>d.handle===handle)?'dismiss_pending':'error_dialog_dismissed',dialogs:remaining.map(classifyDialog),next:'photoshop_ping then photoshop_get_state; original operation may have failed or partially changed the document.'});
  }};
}
function response(value){return {content:[{type:'text',text:JSON.stringify(value)}]};}
export function guardDefinition(definition, inspect=windowsDialogs, coordinator) {
  return {...definition,handler:async(args)=>{
    const scan=async()=>{try{return (await inspect()).dialogs?.map(classifyDialog)??[];}catch(error){return [{blocking:false,diagnosticError:String(error.message||error)}];}};
    const probe=definition.tool?.name==='photoshop_ping'||(definition.tool?.name==='photoshop_app'&&args.action==='status');
    // Probes bypass the modal veto, but never enter behind an unfinished operation.
    if(coordinator?.status().pending.length)return response({ok:false,code:'photoshop_queue_busy',message:'An earlier operation is still running; no additional script was queued.',...coordinator.status(),dialogs:await scan()});
    if(!probe){const dialogs=await scan();if(dialogs.some(d=>d.blocking))return response({ok:false,code:'photoshop_modal_blocked',operationStarted:false,dialogs});}
    const outcome=coordinator?await coordinator.run(definition.tool.name,()=>definition.handler(args),{probe,timeout:Number.isFinite(args.timeout_ms)?Math.max(100,Math.min(600000,args.timeout_ms)):undefined}):await Promise.resolve().then(()=>definition.handler(args)).then(value=>({value}),error=>({error}));
    if(outcome.blocked||outcome.timedOut)return response({ok:false,code:outcome.timedOut?'photoshop_timeout':'photoshop_queue_busy',message:'Photoshop operation has not been confirmed complete. Do not retry edits; inspect dialogs and probe after pending work finishes.',...outcome,dialogs:await scan()});
    if(outcome.error)return response({ok:false,code:outcome.error.code||'photoshop_error',message:String(outcome.error.message||'Photoshop returned no message; its script queue may be blocked.'),dialogs:await scan()});
    const result=outcome.value;
    if(result?.isError){
      const content=(result.content??[]).map(block=>{if(block.type!=='text')return block;try{const value=JSON.parse(block.text);if(value.message!==undefined&&!String(value.message).trim())value.message='Photoshop returned no message; inspect dialogs and queue status.';return {...block,text:JSON.stringify(value)};}catch{return {...block,text:!block.text?.trim()||/^Error[^\n]*:\s*$/i.test(block.text)?'Photoshop returned no error detail; inspect dialogs and queue status.':block.text};}});
      return {...result,content,diagnostics:{...coordinator?.status(),dialogs:await scan()}};
    }
    return result;
  }};
}
