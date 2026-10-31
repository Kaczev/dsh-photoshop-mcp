import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const client=new Client({name:'dsh-live-test',version:'1'},{capabilities:{}});
const transport=new StdioClientTransport({command:process.execPath,args:['server/index.mjs'],stderr:'pipe',env:{...process.env,ELECTRON_RUN_AS_NODE:'1',ANALYTICS_DISABLED:'1',PSMCP_FEEDBACK:'0',PSMCP_UPDATE_CHECK:'0'}});
await mkdir('.tmp',{recursive:true});
let stderr='',id,created=false;
await client.connect(transport);transport.stderr?.on('data',c=>stderr+=c);
async function call(name,args){const result=await client.callTool({name,arguments:args},undefined,{timeout:180000});console.log(name,JSON.stringify(result).slice(0,1800));assert.ok(!result.isError,JSON.stringify(result));return result;}
try{
 const initial=await call('photoshop_app',{action:'status'});
 let wasRunning=JSON.parse(initial.content[0].text).running;
 if(process.argv.includes('--cold') && wasRunning){
  assert.equal(JSON.parse(initial.content[0].text).result.documents.length,0,'Cold test requires no open documents');
  const stopped=await call('photoshop_app',{action:'quit'});
  assert.equal(JSON.parse(stopped.content[0].text).running,false);
  wasRunning=false;
 }
 await call('photoshop_app',{action:'start'});
 for(let round=0;round<2;round++){
  const made=await call('photoshop_create_document',{width:128,height:128,resolution:72,colorMode:'RGB'});created=true;
  const state=await call('photoshop_get_state',{document_id:null});
  await writeFile('.tmp/state.json',JSON.stringify(state,null,2));
  // IDs are read from the script API rather than inferred from localized text.
  const identity=await call('photoshop_execute_script',{code:'return app.activeDocument.id;',document_id:null});
  const text=identity.content.find(x=>x.type==='text').text;
  id=Number(text.match(/Result:\s*(\d+)/)?.[1]);assert.ok(id>0,text);
  await call('photoshop_create_layer',{name:'DSH smoke test',document_id:id});
  await call('photoshop_fill_layer',{red:24,green:145,blue:220,document_id:id});
  if(!wasRunning){const refused=await call('photoshop_app',{action:'quit'});assert.match(JSON.stringify(refused),/unsaved_documents/);}
  const preview=await call('photoshop_get_preview',{max_dimension_px:128,document_id:id});
  const image=preview.content.find(x=>x.type==='image');assert.ok(image);await writeFile('.tmp/preview.jpg',Buffer.from(image.data,'base64'));
  for(const format of ['PSD','PNG']){const path=resolve('.tmp',`smoke-${round}.${format.toLowerCase()}`);await call('photoshop_save_document',{path,format,document_id:id});assert.ok((await stat(path)).size>0);}
  await call('photoshop_close_document',{save:false,document_id:id});created=false;
 }
 if(!wasRunning)await call('photoshop_app',{action:'quit'});
}catch(error){console.error(error);process.exitCode=1;if(created&&id)try{await call('photoshop_close_document',{save:false,document_id:id});}catch{} }
finally{await client.close();await writeFile('.tmp/live-stderr.log',stderr);const issues=stderr.split('\n').filter(s=>/\[(WARN|ERROR)\]/.test(s));console.log('WARN/ERROR:',issues.join('\n'));if(issues.length)process.exitCode=1;}
