import test from 'node:test';
import assert from 'node:assert/strict';
import {compactTools} from '../lib/compact-tools.mjs';
const p='mcp__photoshop__photoshop_';
test('family dispatch preserves original parameters, execution context and image renderer',async()=>{
 const defs=['undo','redo','get_history'].map(action=>({name:p+action,description:action,parameters:{type:'object',properties:{steps:{type:'number'}},additionalProperties:false},execute:async(args,ctx)=>({action,args,ctx}),output:{render:(args,value)=>[{type:'image',data:action+args.steps+value,mimeType:'image/png'}]}}));
 const [merged]=compactTools(defs);assert.equal(merged.name,p+'history');assert.equal(merged.parameters.oneOf.length,3);
 const args={action:'redo',parameters:{steps:2}},ctx={signal:'context'};const result=await merged.execute(args,ctx);assert.equal(result.action,'redo');assert.equal(result.args,args.parameters);assert.equal(result.ctx,ctx);
 assert.equal(merged.output.render(args,'result')[0].type,'image');
 await assert.rejects(()=>merged.execute({action:'delete'}),/Unknown/);
});
