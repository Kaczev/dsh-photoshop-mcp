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
export function installLazyTools(ctx, lazy = true) {
  const states = new Map();
  const raw = () => ctx.tools.schemas().filter(t=>t.name.startsWith(PREFIX)).map(t=>ctx.tools.get(t.name)).filter(Boolean);
  function attach(agent) {
    if (states.has(agent)) return;
    const state = {groups:new Set(lazy ? [] : ['all']),tools:[],raw:[],disposed:false};
    states.set(agent,state);
    const refresh = () => {
      if (state.disposed || state.refreshing) return;
      state.refreshing = true;
      try {
        const defs = raw(), signature = [...state.groups].join(',');
        if (signature === state.signature && defs.length === state.raw.length && defs.every((d,i)=>d===state.raw[i])) return;
        for (const dispose of state.tools.splice(0).reverse()) dispose();
        state.mask?.();
        state.mask = defs.length ? agent.ctx.tools.restrict({deny:defs.map(d=>d.name)}) : undefined;
        try {
          for (const def of compactTools(defs)) if (state.groups.has('all') || state.groups.has(category(def.name))) state.tools.push(agent.ctx.tools.register({...def}));
        } catch (error) { for (const dispose of state.tools.splice(0).reverse()) dispose(); throw error; }
        state.raw = defs; state.signature = signature;
      } finally { state.refreshing = false; }
    };
    state.refresh = refresh;
    const disposeLoader = lazy ? agent.ctx.tools.register({
      name:'photoshop_load_tools',
      description:'Load Photoshop tools for this agent without launching Photoshop. Default core includes application start/status/quit, documents, state and preview. Other groups load on request. Inspect state before editing, pin document_id and preview major changes. Generative tools may spend Adobe credits. Timeouts do not cancel Photoshop scripts. Finish owned temporary documents with save_document(close_after_save:true); never close unrelated user documents. Export success does not mean the working document is clean.',
      parameters:{type:'object',properties:{mode:{type:'string',enum:['add','replace'],description:'add (default) appends groups; replace unloads previous groups. replace with groups:[] restores loader-only.'},groups:{type:'array',items:{type:'string',enum:groups},description:'Add groups: core (default), layers, selection, effects, recipes, advanced (scripts, export, generative/neural), or all.'}},additionalProperties:false},
      output,
      execute:async (args = {}) => {
        const requested = args.groups ?? ['core'];
        if (!Array.isArray(requested) || requested.some(g=>!groups.includes(g))) throw Error('Unknown Photoshop tool group');
        if(args.mode && !['add','replace'].includes(args.mode))throw Error('Unknown load mode');
        if(args.mode==='replace')state.groups.clear();
        for (const group of requested) state.groups.add(group);
        refresh();
        return {connected:raw().length>0,groups:[...state.groups],availableGroups:groups,tools:compactTools(raw()).filter(d=>state.groups.has('all')||state.groups.has(category(d.name))).map(d=>d.name)};
      }
    }) : ()=>{};
    state.dispose = agent.ctx.effect(()=>()=>{
      state.disposed = true; states.delete(agent);
      for (const dispose of state.tools.splice(0).reverse()) dispose();
      state.mask?.(); disposeLoader();
    },'photoshop.lazy-agent');
    refresh();
  }
  let syncing = false;
  ctx.on('tools/change',()=>{if(syncing)return;syncing=true;try{for(const state of states.values())state.refresh();}finally{syncing=false;}});
  ctx.on('agent/created',({agent})=>attach(agent));
  ctx.on('agent/pre-step',({agent},next)=>{attach(agent);states.get(agent).refresh();return next();});
  for(const agent of ctx.agents.list())attach(agent);
  ctx.effect(()=>()=>{for(const state of [...states.values()])state.dispose();},'photoshop.lazy-owner');
}
