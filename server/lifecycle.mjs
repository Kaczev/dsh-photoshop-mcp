import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
const run = promisify(execFile);
export async function quitApplication(platform = process.platform) {
  if (platform === 'win32') {
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-Process Photoshop -ErrorAction SilentlyContinue | ForEach-Object { if (!$_.CloseMainWindow()) { throw 'Photoshop refused the close-window request' } }"], { windowsHide:true });
  } else if (platform === 'darwin') {
    await run('osascript', ['-e', 'tell application "Adobe Photoshop" to quit']);
  } else throw Error('Photoshop requires Windows or macOS.');
}

export async function isRunning(platform = process.platform) {
  if (platform === 'win32') {
    const { stdout } = await run('tasklist.exe', ['/FI', 'IMAGENAME eq Photoshop.exe', '/FO', 'CSV', '/NH'], { windowsHide: true });
    return /^"Photoshop\.exe"/im.test(stdout);
  }
  if (platform === 'darwin') {
    try { const { stdout } = await run('pgrep', ['-f', '/Adobe Photoshop[^/]*.app/Contents/MacOS/']); return !!stdout.trim(); }
    catch (error) { if (error.code === 1) return false; throw error; }
  }
  throw Error('Photoshop requires Windows or macOS.');
}
export const snapshotScript = `var docs=[]; for(var i=0;i<app.documents.length;i++){var d=app.documents[i]; docs.push({id:d.id,name:d.name,saved:d.saved});} return {version:app.version,documents:docs};`;
export function quitScript(discard = false) {
  return `var dirty=[]; for(var i=0;i<app.documents.length;i++){if(!app.documents[i].saved) dirty.push({id:app.documents[i].id,name:app.documents[i].name});} if(dirty.length && ${!discard}) return {closed:false,reason:'unsaved_documents',documents:dirty}; while(app.documents.length) app.activeDocument.close(SaveOptions.DONOTSAVECHANGES); return {readyToQuit:true};`;
}
export function lifecycleDefinition(connection, running = isRunning, quit = quitApplication) {
  return {
    tool: { name: 'photoshop_app', description: 'Check Photoshop status without launching; start it, or quit safely. Quit refuses unsaved documents unless discard is explicitly authorized. Save documents before quitting. A timeout does not stop an in-flight Photoshop script.', inputSchema: { type:'object', properties:{ action:{type:'string',enum:['status','start','quit']}, discard:{type:'boolean',description:'Quit only: discard ALL unsaved documents. Set true only with explicit user authorization.'} }, required:['action'], additionalProperties:false } },
    handler: async ({ action, discard = false }) => {
      if (!['status','start','quit'].includes(action)) throw Error('Unknown application action');
      if (discard && action !== 'quit') throw Error('discard is only valid for quit');
      if (action === 'start') await connection.ensurePhotoshopRunning();
      if (!await running()) return { content:[{type:'text',text:JSON.stringify({running:false})}] };
      const body = action === 'quit' ? quitScript(discard) : snapshotScript;
      const result = await connection.executeScript('((function(){'+body+'})()).toSource()', 120000, {launch:false});
      if (action === 'quit' && result?.readyToQuit) {
        await quit();
        for (let i=0;i<40 && await running();i++) await delay(250);
        const active = await running();
        return {content:[{type:'text',text:JSON.stringify({running:active,result:{closed:!active,...(active?{reason:'application_still_running'}:{})}})}]};
      }
      return {content:[{type:'text',text:JSON.stringify({running:await running(),result})}]};
    }
  };
}
