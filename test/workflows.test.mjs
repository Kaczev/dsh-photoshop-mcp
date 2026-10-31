import test from 'node:test';import assert from 'node:assert/strict';
import {batchDefinition,closeAllDefinition} from '../server/workflows.mjs';import {adaptEditing,sampleDefinition} from '../server/editing.mjs';
test('batch stops at first failure and forbids scripts before dispatch',async()=>{
 let calls=0;const registry={list:()=>[{name:'photoshop_open_image',inputSchema:{type:'object'}}],execute:async()=>{calls++;return {content:[{type:'text',text:'{"ok":false,"code":"photoshop_timeout"}'}]};}};
 const tool=batchDefinition(registry);const result=await tool.handler({operations:[{tool:'photoshop_open_image',params:{}},{tool:'photoshop_open_image',params:{}}]});assert.equal(calls,1);assert.equal(JSON.parse(result.content[0].text).stoppedAt,0);
 await assert.rejects(tool.handler({operations:[{tool:'photoshop_execute_script',params:{}}]}));assert.equal(calls,1);
});
test('background adjustment pins document and reports unlock; stroke placement wraps return',async()=>{
 let script;const connection={executeScript:async text=>{script=text;return '({ok:true,unlockedBackground:true})';}};
 const adjusted=adaptEditing({tool:{name:'photoshop_adjust_brightness_contrast'}},connection);await adjusted.handler({brightness:1,contrast:1,document_id:4});assert.match(script,/isBackgroundLayer=false/);assert.match(script,/id===4/);
 const stroke=adaptEditing({tool:{name:'photoshop_apply_layer_style',inputSchema:{properties:{}}}},connection);await stroke.handler({style:'stroke',position:'inside',size:1});assert.match(script,/insetFrame/);assert.match(script,/function/);
});
test('sampling validates coordinates and cleans temporary copy; close all preflights dirty documents',async()=>{
 let script;const connection={executeScript:async text=>{script=text;return '({ok:true})';}};
 const sample=sampleDefinition(connection);await assert.rejects(sample.handler({x:-1,y:0}));await sample.handler({x:1,y:2});assert.match(script,/finally/);assert.match(script,/copy.close/);assert.doesNotMatch(script,/colorSamplers/);
 await closeAllDefinition(connection).handler({discard:false,document_ids:[4]});assert.ok(script.indexOf('unsaved_documents')<script.indexOf('targets[j].close'));assert.match(script,/selected\(d.id\)/);
});
