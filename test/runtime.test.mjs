import test from 'node:test';
import assert from 'node:assert/strict';
import { installLazyTools, category } from '../lib/lazy-tools.mjs';

const prefix = 'mcp__photoshop__photoshop_';
const loader = 'photoshop_load_tools';
const skill = { name: 'photoshop', content: 'Packaged body', resourceBase: { kind: 'directory', path: '/skills/photoshop/' } };
const value = { ...skill, provider: 'runtime' };
const render = (_, s) => [{type:'text', text:`${s.resourceBase.path}\n${s.content}`}];
const backend = (name, result) => ({name:prefix+name, description:name, parameters:{type:'object'}, output:{render}, execute:async()=>result});

// A scoped definition can be inherited, but the host evaluates `when` with the actual caller.
function fixture() {
  const listeners = new Map(), sessions = new Map(), effects = [], isolated = [];
  const ctx = {
    on: (event, fn) => listeners.set(event, fn), effect: fn => effects.push(fn()),
    agents: {get: id => sessions.get(id)},
    tools: {resolve() {}, get: name => name === 'skill' ? {output:{render}} : undefined},
    isolate(service) { isolated.push(service); return this; }, extend: overrides => overrides,
  };
  const bridge = installLazyTools(ctx, skill);
  function agent(id, parent) {
    const entries = new Map();
    const a = {session:{id}, parent, entries, ctx:{tools:{register(def, options) {
      assert.ok(!entries.has(def.name), 'duplicate scoped tool');
      entries.set(def.name, {def, ...options});
      return () => entries.delete(def.name);
    }}}};
    sessions.set(id, a);
    return a;
  }
  function step(a) {
    listeners.get('agent/pre-step')({agent:a}, () => {});
    const resolved = new Map();
    for (let scope=a; scope; scope=scope.parent) {
      for (const [name, e] of scope.entries) if (!resolved.has(name) && e.when({agent:a})) resolved.set(name, e.def);
    }
    return resolved;
  }
  function load(a, result = {isError:false,value}, args = {name:skill.name}) {
    listeners.get('tools/result')({agent:a,name:'skill',arguments:args}, result);
  }
  function slash(session, source, content) {
    listeners.get('session/event')(session, {type:'user/message',data:{source,content}});
  }
  return {agent, load, step, slash, bridge, isolated, listeners, dispose:()=>effects.reverse().forEach(fn=>fn())};
}

test('categories normalize prefixes; hosts without step predicates fail closed', () => {
  for (const [name, group] of [['create_layer','layers'], ['app','core'], ['recipe_remove_background','recipes'], ['execute_script','advanced']]) {
    assert.equal(category(prefix+name), group);
  }
  assert.throws(() => installLazyTools({tools:{}}, skill), /step-time/);
});

test('cold schemas, exact skill result, owner isolation, group replacement and disposal', async () => {
  const f = fixture(), parent = f.agent('parent'), sibling = f.agent('sibling');
  f.bridge.tools.register(backend('app','first'));
  f.bridge.tools.register(backend('recipe_remove_background','recipe'));
  assert.ok(f.isolated.includes('mcpResources') && f.isolated.includes('systemPrompt'));
  assert.equal(f.step(parent).size, 0);
  for (const invalid of [{isError:true, value}, {isError:false}, {isError:false,value:{...value,provider:'filesystem'}},
    {isError:false,value:{...value,content:'other'}}, {isError:false,value:{...value,resourceBase:{kind:'directory',path:'/other'}}}]) f.load(parent, invalid);
  f.load(parent, {isError:false,value}, {name:'other'});
  assert.equal(f.step(parent).size, 0);
  f.load(parent);
  assert.deepEqual([...f.step(parent).keys()].sort(), [prefix+'app',loader].sort());
  const child = f.agent('fork',parent);
  assert.equal(f.step(child).size, 0);
  assert.equal(f.step(sibling).size, 0);
  const control = f.step(parent).get(loader);
  assert.throws(() => control.execute({groups:['all']},{agent:child}), /this agent/);
  assert.deepEqual((await control.execute({groups:['recipes']},{agent:parent})).groups, ['core','recipes']);
  assert.ok(f.step(parent).has(prefix+'recipe_remove_background'));
  assert.equal(f.step(child).size, 0);
  f.load(child);
  assert.ok(!f.step(child).has(prefix+'recipe_remove_background'));
  await control.execute({groups:[],mode:'replace'},{agent:parent});
  f.load(parent);
  assert.deepEqual([...f.step(parent).keys()], [loader]);
  assert.ok(f.step(child).has(prefix+'app'));
  f.listeners.get('agent/disposed')({agent:parent});
  assert.throws(() => control.execute({},{agent:parent}), /this agent/);
  assert.equal(f.step(parent).size, 0);
  f.dispose();
  assert.equal(f.step(child).size, 0);
});

test('only the committed, fully rendered slash invocation for the live session opens tools', () => {
  const f=fixture(), a=f.agent('current');
  const source={kind:'skill-invocation',name:'photoshop',form:'instructions'};
  const content=render({},value);
  f.slash(a.session,{kind:'user'},[{type:'text',text:'/photoshop'}]);
  f.slash(a.session,{...source,form:'summary'},content);
  f.slash(a.session,source,render({},{...value,resourceBase:{path:'/other'}}));
  f.slash({...a.session},source,content);
  assert.equal(f.step(a).size,0);
  f.slash(a.session,source,content);
  assert.deepEqual([...f.step(a).keys()],[loader]);
  f.dispose();
});

test('late discovery and reconnect never expose raw tools or call a stale generation', async () => {
  const f=fixture(), active=f.agent('active'), cold=f.agent('cold');
  f.load(active);
  assert.deepEqual([...f.step(active).keys()],[loader]);
  const undo=f.bridge.tools.register(backend('app','first'));
  const first=f.step(active).get(prefix+'app');
  assert.equal(await first.execute({}, {agent:active}),'first');
  undo();
  f.bridge.tools.register(backend('app','second'));
  undo();
  assert.throws(()=>first.execute({}, {agent:active}), /this agent/);
  assert.equal(await f.step(active).get(prefix+'app').execute({}, {agent:active}),'second');
  assert.equal(f.step(cold).size,0);
  assert.throws(()=>f.bridge.tools.register(backend('app','duplicate')), /Invalid/);
  f.dispose();
});
