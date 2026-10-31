import {mkdir,open,unlink,realpath,access} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseExtendScriptPayload} from '@alisaitteke/photoshop-mcp/dist/utils/extendscript-result.js';
export const response=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
export async function jsx(connection,body){return parseExtendScriptPayload(await connection.executeScript(`((function(){var previousDialogs=app.displayDialogs;app.displayDialogs=DialogModes.NO;try{${body}}finally{app.displayDialogs=previousDialogs;}})()).toSource()`,120000));}
export async function prepareOutput(target){
 if(typeof target!=='string'||!path.isAbsolute(target))throw Object.assign(Error('An absolute output path is required'),{code:'output_dir_unusable'});
 const directory=path.dirname(target);await mkdir(directory,{recursive:true});
 const probe=path.join(directory,`.dsh-probe-${randomUUID()}`);let handle;
 try{handle=await open(probe,'wx');}finally{await handle?.close();if(handle)await unlink(probe);}
}
export function documentTarget(id){
 if(id===undefined||id===null||id===0)return "if(!app.documents.length)throw Error('No active document');";
 if(!Number.isInteger(id)||id<1)throw Error('Invalid document_id');
 return `var found=false;for(var i=0;i<app.documents.length;i++)if(app.documents[i].id===${id}){app.activeDocument=app.documents[i];found=true;break;}if(!found)throw Error('document_not_found');`;
}
export function adaptFiles(definition,connection){
 const name=definition.tool.name;
 if(name==='photoshop_open_image')return {...definition,tool:{...definition.tool,description:'Open an image, or activate the existing document for the same file. Reload explicitly discards unsaved changes and requires discard:true.',inputSchema:{...definition.tool.inputSchema,properties:{...definition.tool.inputSchema.properties,reload:{type:'boolean',default:false},discard:{type:'boolean',description:'Required true for reload; discards unsaved document edits.'}}}},handler:async args=>{
  if(args.reload&&!args.discard)return response({ok:false,code:'reload_requires_discard',message:'Explicit discard:true is required to reload.'});
  const file=await realpath(args.filePath);await access(file);
  const literal=JSON.stringify(file),fold=process.platform==='win32'?'.toLowerCase()':'';
  return response(await jsx(connection,`var file=new File(${literal}),d=null,reused=false;for(var i=0;i<app.documents.length;i++){var candidate=app.documents[i];try{if(candidate.fullName.fsName${fold}===file.fsName${fold}){d=candidate;break;}}catch(e){}}if(d){reused=true;app.activeDocument=d;if(${!!args.reload}){executeAction(charIDToTypeID('Rvrt'),undefined,DialogModes.NO);}}else{d=app.open(file);}return {ok:true,id:d.id,name:d.name,reused:reused,reloaded:${!!args.reload},width:d.width.as('px'),height:d.height.as('px')};`));
 }};
 if(name==='photoshop_save_document')return {...definition,tool:{...definition.tool,description:'Save the working document (not a copy) and return actual dirty state. Use PSD for editable layers. Optionally close only after a verified clean save.',inputSchema:{...definition.tool.inputSchema,properties:{...definition.tool.inputSchema.properties,close_after_save:{type:'boolean',default:false,description:'Close this document only if Photoshop reports dirty:false after saving.'}}}},handler:async args=>{
  try{await prepareOutput(args.path);}catch(error){return response({ok:false,code:'output_dir_unusable',message:error.message});}
  const format=(args.format??'PSD').toUpperCase();if(!['PSD','PNG','JPEG'].includes(format))throw Error('Unsupported save format');
  const quality=args.quality??8;if(!Number.isInteger(quality)||quality<1||quality>12)throw Error('JPEG quality must be 1..12');
  return response(await jsx(connection,`${documentTarget(args.document_id)}var doc=app.activeDocument,id=doc.id,file=new File(${JSON.stringify(args.path)}),options;${format==='PSD'?'options=new PhotoshopSaveOptions();options.embedColorProfile=true;':format==='PNG'?'options=new PNGSaveOptions();options.compression=9;':`options=new JPEGSaveOptions();options.quality=${quality};options.embedColorProfile=true;`}doc.saveAs(file,options,false);var actualPath=doc.fullName.fsName,dirty=!doc.saved,closed=false;if(${args.close_after_save===true}&&!dirty){doc.close(SaveOptions.DONOTSAVECHANGES);closed=true;}return {ok:!dirty,code:dirty?'document_still_dirty':'document_saved',document_id:id,path:actualPath,requested_path:file.fsName,format:${JSON.stringify(format)},dirty:dirty,closed:closed};`));
 }};
 if(name==='photoshop_export_as')return {...definition,tool:{...definition.tool,description:definition.tool.description+' Returns source document dirty state; exporting a copy does not save the working document.'},handler:async args=>{
  try{await prepareOutput(args.path);}catch(error){return response({ok:false,code:'output_dir_unusable',message:error.message});}
  const before=await jsx(connection,`${documentTarget(args.document_id)}return {id:app.activeDocument.id};`);
  const result=await definition.handler(args);
  const state=await jsx(connection,`${documentTarget(before.id)}return {document_id:app.activeDocument.id,dirty:!app.activeDocument.saved};`);
  return {...result,content:(result.content??[]).map(block=>{if(block.type!=='text')return block;try{return {...block,text:JSON.stringify({...JSON.parse(block.text),...state})};}catch{return {...block,text:JSON.stringify({message:block.text,...state})};}})};
 }};
 return definition;
}
