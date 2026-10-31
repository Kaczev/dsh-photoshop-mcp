import {jsx,response} from './files.mjs';
import {ExtendScriptSnippets} from '@alisaitteke/photoshop-mcp/dist/api/extendscript.js';
const pin=args=>`if(${Number(args.document_id)||0}){var found=false;for(var j=0;j<app.documents.length;j++)if(app.documents[j].id===${Number(args.document_id)||0}){app.activeDocument=app.documents[j];found=true;break;}if(!found)throw Error('document_not_found');}`;
export function adaptEditing(definition,connection){
 if(definition.tool.name==='photoshop_adjust_brightness_contrast')return {...definition,handler:async args=>response(await jsx(connection,`${pin(args)}var layer=app.activeDocument.activeLayer,unlocked=false;if(layer.isBackgroundLayer){layer.isBackgroundLayer=false;unlocked=true;}layer.adjustBrightnessContrast(${Number(args.brightness)||0},${Number(args.contrast)||0});return {ok:true,unlockedBackground:unlocked};`))};
 if(definition.tool.name==='photoshop_apply_layer_style')return {...definition,tool:{...definition.tool,inputSchema:{...definition.tool.inputSchema,properties:{...definition.tool.inputSchema.properties,position:{type:'string',enum:['inside','center','outside'],default:'inside',description:'Stroke placement; inside avoids clipping at canvas edges.'}}}},handler:async args=>{
  if(args.style!=='stroke')return definition.handler(args);
  const positions={inside:'insetFrame',center:'centeredFrame',outside:'outsetFrame'};const position=args.position??'inside';if(!positions[position])throw Error('Invalid stroke position');
  const options={style:'stroke',red:0,green:0,blue:0,opacity:60,size:10,distance:8,angle:120,...args};
  for(const key of ['red','green','blue','opacity','size','distance','angle'])if(!Number.isFinite(options[key]))throw Error(`Invalid numeric stroke parameter: ${key}`);
  if(options.size<0||options.size>250||options.opacity<0||options.opacity>100||['red','green','blue'].some(key=>options[key]<0||options[key]>255))throw Error('Stroke parameter outside allowed range');
  // Reuse the pinned, tested upstream descriptor; change only its stroke placement.
  const script=ExtendScriptSnippets.applyLayerStyle(options).replace("sTID('outsetFrame')",`sTID('${positions[position]}')`);
  const bounds=await jsx(connection,`${pin(args)}var d=app.activeDocument,b=d.activeLayer.bounds;return {margin:Math.min(b[0].as('px'),b[1].as('px'),d.width.as('px')-b[2].as('px'),d.height.as('px')-b[3].as('px'))};`);
  const applied=await jsx(connection,script);
  if(applied?.ok===false)return response(applied);
  return response({ok:true,position,...(position!=='inside'&&bounds.margin<Number(options.size)*(position==='center'?0.5:1)?{warning:'stroke_clipped'}:{})});
 }};
 return definition;
}
export function sampleDefinition(connection){return {tool:{name:'photoshop_sample_color',description:'Read an unsaved composite pixel without colorSamplers. Uses a temporary duplicate; preserves the original selection and document.',inputSchema:{type:'object',properties:{x:{type:'integer',minimum:0},y:{type:'integer',minimum:0},document_id:{type:'number'}},required:['x','y'],additionalProperties:false}},handler:async args=>{
 if(!Number.isInteger(args.x)||!Number.isInteger(args.y)||args.x<0||args.y<0)throw Error('Coordinates must be nonnegative integers');
 return response(await jsx(connection,`${pin(args)}var original=app.activeDocument,x=${args.x},y=${args.y};if(x>=original.width.as('px')||y>=original.height.as('px'))throw Error('Coordinates outside canvas');var copy=null;try{copy=original.duplicate('__DSH_sample__',true);if(copy.mode!==DocumentMode.RGB)copy.changeMode(ChangeMode.RGB);copy.bitsPerChannel=BitsPerChannelType.EIGHT;copy.crop([UnitValue(x,'px'),UnitValue(y,'px'),UnitValue(x+1,'px'),UnitValue(y+1,'px')]);var rgb=[];for(var c=0;c<3;c++){var h=copy.channels[c].histogram,value=0,total=0;for(var k=0;k<h.length;k++){value+=k*h[k];total+=h[k];}rgb.push(total?Math.round(value/total):null);}return {ok:true,rgb:rgb,x:x,y:y,method:'duplicate-crop-channel-histogram',colorSpace:'document RGB'};}finally{if(copy)copy.close(SaveOptions.DONOTSAVECHANGES);app.activeDocument=original;}`));
 }};}
