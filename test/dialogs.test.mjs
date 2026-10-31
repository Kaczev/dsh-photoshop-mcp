import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyDialog,dialogDefinition,guardDefinition} from '../server/dialogs.mjs';
const known={handle:'123',pid:1,class:'#32770',title:'Adobe Photoshop',controls:[{class:'Static',text:'找不到要移去的背景。'},{class:'Button',text:'确定',id:1,enabled:true}]};
test('only exact error with single enabled OK is recoverable',()=>{
 assert.equal(classifyDialog(known).recoverable,true);
 assert.equal(classifyDialog({...known,controls:[known.controls[0],{class:'Button',text:'确定(&O)',id:2,enabled:true}]}).recoverable,true);
 for(const text of ['是否保存更改？','Overwrite file?','Sign in','Unknown error'])assert.equal(classifyDialog({...known,controls:[{class:'Static',text},known.controls[1]]}).recoverable,false);
 assert.equal(classifyDialog({...known,controls:[...known.controls,{class:'Button',text:'Cancel',id:2}]}).recoverable,false);
 assert.equal(classifyDialog({...known,title:'Other app'}).recoverable,false);
 assert.equal(classifyDialog({...known,controls:[...known.controls,{class:'Edit',text:''}]}).recoverable,false);
});
test('guard prevents dispatch while modal and reports original error when blocked afterwards',async()=>{
 let calls=0;const def={handler:async()=>{calls++;return {content:[]};}};
 const result=await guardDefinition(def,async()=>({dialogs:[known]})).handler({});
 assert.equal(calls,0);assert.equal(JSON.parse(result.content[0].text).operationStarted,false);
 let scans=0;const failed=await guardDefinition({handler:async()=>{throw Error('timeout');}},async()=>({dialogs:++scans===1?[]:[known]})).handler({});
 assert.equal(JSON.parse(failed.content[0].text).message,'timeout');
 assert.equal(JSON.parse(failed.content[0].text).dialogs.length,1);
});
test('custom modal is blocking but never recoverable',()=>{
 const result=classifyDialog({handle:'7',class:'OWL.Custom',blocking:true,title:'Image Update',controls:[{class:'UIA.ControlType.Text',text:'Image changed'},{class:'UIA.ControlType.Button',text:'Update'},{class:'UIA.ControlType.Button',text:'Cancel'}]});
 assert.equal(result.blocking,true);assert.equal(result.recoverable,false);assert.equal(result.text,'Image changed');assert.deepEqual(result.buttons,['Update','Cancel']);
});
test('unknown dialog cannot be dismissed and known target is revalidated',async()=>{
 let invoked=[];const tool=dialogDefinition(async(action)=>{invoked.push(action);return {dialogs:[known]};});
 await tool.handler({action:'dismiss_known_error',handle:'wrong'});assert.deepEqual(invoked,[undefined]);
 await tool.handler({action:'dismiss_known_error',handle:'123'});assert.ok(invoked.includes('dismiss'));
});
