import {compactTools} from './compact-tools.mjs';

const PREFIX = 'mcp__photoshop__';
const groups = ['core','layers','selection','effects','recipes','advanced','all'];
export function category(name) {
  name = name.replace(PREFIX, '').replace(/^photoshop_/, '');
  if (/^recipe_/.test(name)) return 'recipes';
  if (/^(app|dialogs|ping|get_version|create_document|get_document_info|list_documents|set_active_document|save_document|close_document|close_all|open_image|get_state|get_preview|history|undo|redo|get_history)$/.test(name)) return 'core';
  if (/selection|select_(rectangle|ellipse|all|subject)|^deselect$|mask/.test(name)) return 'selection';
  if (/filter|adjust|color|style|blur|sharpen|noise|high_pass|auto_levels|auto_contrast|desaturate|invert$|apply_lut|apply_gradient_map/.test(name) && !/^set_text/.test(name)) return 'effects';
  if (/layer|text|smart_object|font|flatten/.test(name)) return 'layers';
  return 'advanced';
}
const output = {schema:{type:'object',additionalProperties:true},render:(_,value)=>[{type:'text',text:JSON.stringify(value)}]};

export function installLazyTools(ctx, skill) {
  if (typeof ctx.tools.resolve !== 'function') throw Error('Photoshop skill discovery requires DSH with step-time tool admission (0.2.2-rc.5 or later)');
  const raw = new Map(), active = new Map();
  let revision = 0, compactRevision = -1, compact = [];
  function current() {
    if (revision !== compactRevision) {
      compact = compactTools([...raw.values()]); compactRevision = revision;
    }
    return compact;
  }
  function visible(state, name) { return state.groups.has('all') || state.groups.has(category(name)); }
  function expose(agent, state, def) {
    const generation = revision;
    const allowed = caller => caller === agent && active.get(caller) === state &&
      (def.name === 'photoshop_load_tools' || (generation === revision && visible(state, def.name)));
    return agent.ctx.tools.register({...def, execute(args, exec) {
      if (!allowed(exec?.agent)) throw Error('Load the photoshop skill in this agent first');
      return def.execute(args, exec);
    }}, {when:({agent:caller}) => allowed(caller)});
  }
  function refresh(agent, state) {
    if (state.revision === revision) return;
    const selected = current().filter(d => visible(state, d.name));
    for (const dispose of state.tools.splice(0).reverse()) dispose();
    try { for (const def of selected) state.tools.push(expose(agent, state, def)); }
    catch (error) { for (const dispose of state.tools.splice(0).reverse()) dispose(); throw error; }
    state.revision = revision;
  }
  function unload(agent) {
    const state = active.get(agent); if (!state) return;
    active.delete(agent);
    for (const dispose of state.tools.splice(0).reverse()) dispose();
    state.loader?.();
  }
  function activate(agent) {
    if (!agent || active.has(agent)) return;
    const state = {groups:new Set(['core']),tools:[],revision:-1};
    active.set(agent, state);
    try {
      state.loader = expose(agent, state, {
        name:'photoshop_load_tools',description:'Add or replace Photoshop tool groups for this agent without launching Photoshop.',
        parameters:{type:'object',properties:{mode:{type:'string',enum:['add','replace']},groups:{type:'array',items:{type:'string',enum:groups},description:'Defaults to core. Replace with [] to retain only this loader.'}},additionalProperties:false},output,
        async execute(args = {}) {
          const requested = args.groups ?? ['core'];
          if (!Array.isArray(requested) || requested.some(g=>!groups.includes(g))) throw Error('Unknown Photoshop tool group');
          if (args.mode !== undefined && !['add','replace'].includes(args.mode)) throw Error('Unknown load mode');
          if (args.mode === 'replace') state.groups.clear();
          for (const group of requested) state.groups.add(group);
          state.revision = -1; refresh(agent, state);
          return {connected:raw.size>0, groups:[...state.groups], availableGroups:groups, tools:current().filter(d=>visible(state,d.name)).map(d=>d.name)};
        }
      });
      refresh(agent, state);
    } catch (error) { unload(agent); throw error; }
  }
  ctx.on('tools/result', (exec, result) => {
    const value = result.value;
    if (exec.name === 'skill' && result.isError === false && exec.arguments?.name === skill.name &&
        value?.name === skill.name && value.provider === 'runtime' && value.content === skill.content &&
        value.resourceBase?.kind === 'directory' && value.resourceBase.path === skill.resourceBase.path) activate(exec.agent);
  });
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'user/message') return;
    const {source, content} = event.data;
    if (source?.kind !== 'skill-invocation' || source.form !== 'instructions' || source.name !== skill.name) return;
    const agent = ctx.agents.get(session.id);
    if (agent?.session !== session || content?.length !== 1 || content[0]?.type !== 'text') return;
    // The host uses the same renderer for its skill tool and committed /skill-name messages.
    const expected = ctx.tools.get('skill')?.output.render({name:skill.name}, {...skill, provider:'runtime'});
    if (expected?.length === 1 && expected[0].type === 'text' && expected[0].text === content[0].text) activate(agent);
  });
  ctx.on('agent/pre-step', ({agent}, next) => { const s=active.get(agent); if (s) refresh(agent,s); return next(); });
  ctx.on('agent/disposed', ({agent}) => { unload(agent); });
  ctx.effect(()=>()=>{for (const agent of [...active.keys()]) unload(agent);}, 'photoshop.skill-gate');

  // Keep backend schemas private, including during discovery and reconnection.
  // No server registration reaches the host's resources index or prompt sections.
  return ctx.isolate('mcpResources').isolate('systemPrompt').extend({tools:{
    register(def) {
      if (!def.name.startsWith(PREFIX) || raw.has(def.name)) throw Error('Invalid Photoshop backend tool: '+def.name);
      raw.set(def.name,def); revision++;
      return () => { if (raw.get(def.name) === def) { raw.delete(def.name); revision++; } };
    }
  }});
}
