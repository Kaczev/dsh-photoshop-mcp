import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {setTimeout as delay} from 'node:timers/promises';
import {windowsDialogs,classifyDialog} from '../server/dialogs.mjs';
const client=new Client({name:'dialog-live-test',version:'1'},{capabilities:{}});
const transport=new StdioClientTransport({command:process.execPath,args:['server/index.mjs'],stderr:'pipe',env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PSMCP_CALL_TIMEOUT:'1500'}});
await client.connect(transport);
try{
 const before=await windowsDialogs();assert.equal(before.dialogs.length,0,'Existing user dialog; test aborted');
 // Create a controlled error-style acknowledgment, not an edit to a user document.
 const pending=client.callTool({name:'photoshop_execute_script',arguments:{code:"alert('Could not find a background to remove.', 'Adobe Photoshop', true); return 'resumed';",document_id:null}},undefined,{timeout:90000});
 pending.catch(()=>{});
 let dialog;
 for(let i=0;i<30;i++){const found=await windowsDialogs();dialog=found.dialogs.map(classifyDialog).find(d=>d.recoverable);if(dialog)break;await delay(300);}
 assert.ok(dialog,'Controlled dialog was not recognized');console.log('recognized',dialog);
 const blocked=await client.callTool({name:'photoshop_get_state',arguments:{document_id:null}});assert.match(JSON.stringify(blocked),/photoshop_(modal_blocked|queue_busy)/);console.log('blocked call safely reported');
 const timeout=await pending;assert.match(JSON.stringify(timeout),/photoshop_timeout/);assert.match(JSON.stringify(timeout),/Could not find/);console.log('timeout includes dialog diagnostics');
 const dismissed=await client.callTool({name:'photoshop_dialogs',arguments:{action:'dismiss_known_error',handle:dialog.handle}});console.log('dismiss',dismissed);
 let ping;
 for(let i=0;i<10;i++){ping=await client.callTool({name:'photoshop_ping',arguments:{}});if(!/photoshop_queue_busy/.test(JSON.stringify(ping)))break;await delay(250);}
 assert.ok(!ping.isError);assert.doesNotMatch(JSON.stringify(ping),/photoshop_queue_busy|photoshop_timeout/);
 const state=await client.callTool({name:'photoshop_get_state',arguments:{document_id:null}});assert.ok(!state.isError);console.log('queue resumed',JSON.stringify(state));
}finally{await client.close();}
