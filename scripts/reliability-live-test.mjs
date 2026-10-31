import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {mkdir,copyFile,stat,writeFile} from 'node:fs/promises';import path from 'node:path';
const directory=path.resolve('.tmp/reliability');await mkdir(directory,{recursive:true});
const image=path.join(directory,'reuse.png');await copyFile('assets/icon.png',image);
const client=new Client({name:'reliability-live',version:'1'},{capabilities:{}});
const transport=new StdioClientTransport({command:process.execPath,args:['server/index.mjs'],stderr:'pipe',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});let logs='';transport.stderr?.on('data',data=>logs+=data.toString());
await client.connect(transport);let id;
async function call(name,args={}){const start=Date.now();const result=await client.callTool({name,arguments:args},undefined,{timeout:150000});assert.ok(!result.isError,JSON.stringify(result));let value;try{value=JSON.parse(result.content.find(c=>c.type==='text').text);}catch{value=result;}assert.notEqual(value.ok,false,JSON.stringify(value));console.log(name,Date.now()-start,JSON.stringify(value).slice(0,700));return value;}
try{
 const opened=await call('photoshop_open_image',{filePath:image});id=opened.id;assert.ok(id);
 let start=Date.now();const reused=await call('photoshop_open_image',{filePath:image});assert.equal(reused.reused,true);assert.equal(reused.id,id);assert.ok(Date.now()-start<2000,'Reuse exceeded 2 seconds');
 await copyFile('assets/icon.png',image);assert.equal((await call('photoshop_open_image',{filePath:image})).reused,true);
 await call('photoshop_export_as',{path:path.join(directory,'nested','export.png'),format:'PNG',document_id:id});assert.ok((await stat(path.join(directory,'nested','export.png'))).size>0);
 await call('photoshop_sample_color',{x:128,y:128,document_id:id});
 await call('photoshop_apply_layer_style',{style:'stroke',size:1,position:'inside',red:255,green:0,blue:0,opacity:100,document_id:id});
 await call('photoshop_open_image',{filePath:image,reload:true,discard:true});
 const adjusted=await call('photoshop_adjust_brightness_contrast',{brightness:1,contrast:1,document_id:id});assert.equal(typeof adjusted.unlockedBackground,'boolean');
 const refused=await client.callTool({name:'photoshop_close_all',arguments:{document_ids:[id],discard:false}});assert.match(JSON.stringify(refused),/unsaved_documents/);
 await call('photoshop_close_all',{document_ids:[id],discard:true});id=null;
 await call('photoshop_doctor');
 const batch=await call('photoshop_batch',{operations:[{tool:'photoshop_open_image',params:{filePath:image}},{tool:'photoshop_export_as',params:{path:path.join(directory,'batch','x.png'),format:'PNG'}},{tool:'photoshop_close_document',params:{save:false}}]});assert.equal(batch.results.length,3);
}finally{if(id)await client.callTool({name:'photoshop_close_document',arguments:{save:false,document_id:id}});await client.close();await writeFile(path.join(directory,'stderr.log'),logs);console.log('WARN/ERROR',logs.split('\n').filter(line=>/WARN|ERROR/.test(line)).join('\n'));}
