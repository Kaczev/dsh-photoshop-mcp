import test from 'node:test';
import assert from 'node:assert/strict';
import { Context, Service } from '@deepseek-ai/cordis';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope';
import { installLazyTools, category } from '../lib/lazy-tools.mjs';
function runtime(){const ctx=new Context();class Prompt extends Service{constructor(c){super(c,'systemPrompt');}tools(){return()=>{};}}new Prompt(ctx);new ToolRuntime(ctx);const scopes=[createScope(ctx,{}),createScope(ctx,{})],agents=scopes.map(s=>({ctx:s.ctx}));class Agents extends Service{constructor(c){super(c,'agents');}list(){return agents;}}new Agents(ctx);return{ctx,scopes,agents,names:i=>ctx.tools.schemas(scopeOf(agents[i].ctx)).map(t=>t.name),get:(i,n)=>ctx.tools.get(n,scopeOf(agents[i].ctx))};}
const def=(name,value)=>({name:'mcp__photoshop__'+name,description:name,parameters:{type:'object',properties:{},additionalProperties:false},output:{schema:{},render:()=>[]},execute:async()=>value});
test('categories normalize both namespace prefixes',()=>{assert.equal(category('mcp__photoshop__photoshop_create_layer'),'layers');assert.equal(category('mcp__photoshop__photoshop_app'),'core');assert.equal(category('mcp__photoshop__photoshop_recipe_remove_background'),'recipes');assert.equal(category('mcp__photoshop__photoshop_execute_script'),'advanced');});
test('isolated loading, late discovery, reconnect, new agents and disposal',async()=>{
 const r=runtime(),ds=[];const owner=r.ctx.plugin(c=>installLazyTools(c));await owner;
 try{
  assert.deepEqual(r.names(0),['photoshop_load_tools']);
  await r.get(0,'photoshop_load_tools').execute();
  ds.push(r.ctx.tools.register(def('photoshop_app','first')));
  ds.push(r.ctx.tools.register(def('photoshop_create_layer','layer')));
  assert.deepEqual(r.names(1),['photoshop_load_tools']);
  assert.ok(!r.names(0).includes('mcp__photoshop__photoshop_create_layer'));
  assert.equal(await r.get(0,'mcp__photoshop__photoshop_app').execute(),'first');
  ds.shift()();ds.push(r.ctx.tools.register(def('photoshop_app','second')));
  assert.equal(await r.get(0,'mcp__photoshop__photoshop_app').execute(),'second');
  await r.get(0,'photoshop_load_tools').execute({groups:['layers']});
  assert.ok(r.names(0).includes('mcp__photoshop__photoshop_create_layer'));
  const scope=createScope(r.ctx,{});r.scopes.push(scope);await r.ctx.serial('agent/created',{agent:{ctx:scope.ctx}});
  assert.deepEqual(r.ctx.tools.schemas(scopeOf(scope.ctx)).map(t=>t.name),['photoshop_load_tools']);
  await owner.dispose();assert.ok(r.names(1).includes('mcp__photoshop__photoshop_app'));assert.ok(!r.names(0).includes('photoshop_load_tools'));
 }finally{await owner.dispose();ds.forEach(d=>d());for(const s of r.scopes)await s.dispose();}
});
test('eager mode has no loader and does not duplicate tools',async()=>{const r=runtime();const d=r.ctx.tools.register(def('photoshop_app',1));const owner=r.ctx.plugin(c=>installLazyTools(c,false));await owner;try{assert.deepEqual(r.names(0),['mcp__photoshop__photoshop_app']);}finally{await owner.dispose();d();for(const s of r.scopes)await s.dispose();}});
