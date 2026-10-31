import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoordinator} from '../server/coordinator.mjs';
import {adaptFiles,prepareOutput} from '../server/files.mjs';
import {mkdtemp,stat,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
test('timeout tracks late work and rejects edits until a successful probe',async()=>{
 const coordinator=createCoordinator({timeoutMs:10});let finish;
 const first=await coordinator.run('edit',()=>new Promise(resolve=>{finish=resolve;}));assert.equal(first.timedOut,true);
 let dispatched=false;assert.equal((await coordinator.run('edit',()=>{dispatched=true;})).blocked,true);assert.equal(dispatched,false);
 finish({content:[]});await new Promise(resolve=>setImmediate(resolve));assert.equal(coordinator.status().pending.length,0);
 assert.equal((await coordinator.run('edit',async()=>({}))).blocked,true);
 await coordinator.run('photoshop_ping',async()=>({content:[]}),{probe:true});assert.equal(coordinator.status().queueBusy,false);
});
test('output directory preflight creates nested path and rejects relative targets',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'dsh-output-'));try{await prepareOutput(path.join(temp,'nested','x.png'));assert.ok((await stat(path.join(temp,'nested'))).isDirectory());await assert.rejects(prepareOutput('relative.png'));}finally{await rm(temp,{recursive:true,force:true});}
});
test('save uses asCopy false and only closes clean documents; export reports source dirty',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'dsh-save-'));let script='';
 try{
 const connection={executeScript:async value=>{script=value;return '({ok:true,id:7,document_id:7,dirty:true})';}};
 const definition={tool:{name:'photoshop_save_document',inputSchema:{properties:{}}}};
 const save=adaptFiles(definition,connection);await save.handler({path:path.join(temp,'x.psd'),format:'PSD',document_id:7,close_after_save:true});assert.match(script,/saveAs\(file,options,false\)/);assert.match(script,/dirty=!doc.saved/);assert.match(script,/if\(true&&!dirty\)/);assert.doesNotMatch(script,/\.saved\s*=/);
 const exported=adaptFiles({tool:{name:'photoshop_export_as',description:'export'},handler:async()=>({content:[{type:'text',text:'{"ok":true}'}]})},connection);const result=await exported.handler({path:path.join(temp,'copy.png'),document_id:7});assert.equal(JSON.parse(result.content[0].text).dirty,true);
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('open adapter reuses canonical file path and requires explicit discard for reload',async()=>{
 let script='';const tool=adaptFiles({tool:{name:'photoshop_open_image',inputSchema:{properties:{}}}}, {executeScript:async value=>{script=value;return '({ok:true,reused:true,id:1})';}});
 const refused=await tool.handler({filePath:import.meta.filename,reload:true});assert.match(refused.content[0].text,/reload_requires_discard/);assert.equal(script,'');
 const result=await tool.handler({filePath:import.meta.filename});assert.match(result.content[0].text,/reused/);assert.match(script,/finally/);assert.match(script,/fullName.fsName/);
});
