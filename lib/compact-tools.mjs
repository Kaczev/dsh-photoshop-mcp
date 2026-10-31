// Group only related operations; preserve each upstream parameter schema and renderer.
const families = {
  layer_order:['move_layer_to_position','move_layer_to_top','move_layer_to_bottom','move_layer_up','move_layer_down'],
  layer_transform:['scale_layer','move_layer','rotate_layer','fit_layer_to_document'],
  layer_properties:['set_layer_opacity','set_layer_blend_mode','set_layer_visibility','set_layer_locked','rename_layer'],
  text_edit:['set_text_font','set_text_color','set_text_alignment','update_text_content','set_text_style','set_text_ranges'],
  history:['undo','redo','get_history'],
  selection_edit:['select_rectangle','select_ellipse','select_all','deselect','invert_selection','expand_selection','contract_selection','feather_selection','get_selection_bounds','save_selection'],
  filter:['apply_gaussian_blur','apply_sharpen','apply_noise','apply_motion_blur','apply_high_pass','apply_smart_blur'],
  color_adjust:['adjust_brightness_contrast','adjust_hue_saturation','auto_levels','auto_contrast','adjust_curves','desaturate','invert','adjust_vibrance','adjust_exposure','apply_photo_filter','apply_gradient_map','apply_lut'],
};
const prefix='mcp__photoshop__photoshop_';
export function compactTools(defs) {
  const byName=new Map(defs.map(d=>[d.name,d])), consumed=new Set(), merged=[];
  for(const [family,actions] of Object.entries(families)) {
    const members=actions.map(a=>[a,byName.get(prefix+a)]).filter(([,d])=>d);
    if(members.length<2)continue;
    const map=new Map(members);
    for(const [,d] of members)consumed.add(d.name);
    merged.push({name:prefix+family,description:`Photoshop ${family.replaceAll('_',' ')} operations. Choose action and supply its exact parameters. `+members.map(([a,d])=>`${a}: ${d.description}`).join('\n'),
      parameters:{type:'object',properties:{action:{type:'string',enum:members.map(([a])=>a)},parameters:{type:'object'}},required:['action','parameters'],additionalProperties:false,oneOf:members.map(([action,d])=>({type:'object',properties:{action:{const:action,type:'string'},parameters:d.parameters},required:['action','parameters'],additionalProperties:false}))},
      output:{schema:{},render:(args,value)=>map.get(args.action).output.render(args.parameters,value)},
      execute:async(args,exec)=>{const d=map.get(args?.action);if(!d)throw Error('Unknown Photoshop operation');return d.execute(args.parameters,exec);},
      timeoutMs:Math.max(...members.map(([,d])=>d.timeoutMs??180000)),
    });
  }
  return [...defs.filter(d=>!consumed.has(d.name)),...merged];
}
