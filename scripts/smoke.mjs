import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdir, writeFile } from 'node:fs/promises';
const client=new Client({name:'dsh-photoshop-smoke',version:'1'},{capabilities:{}});
const transport=new StdioClientTransport({command:process.execPath,args:['server/index.mjs'],stderr:'pipe',env:{...process.env,ELECTRON_RUN_AS_NODE:'1',ANALYTICS_DISABLED:'1',PSMCP_FEEDBACK:'0',PSMCP_UPDATE_CHECK:'0'}});
let stderr='';
await client.connect(transport);
transport.stderr?.on('data',chunk=>stderr+=chunk);
try {
 const {tools}=await client.listTools();
 await mkdir('.tmp',{recursive:true});
 await writeFile('.tmp/tools.json',JSON.stringify(tools,null,2));
 console.log(JSON.stringify({tools:tools.length,schemaBytes:Buffer.byteLength(JSON.stringify(tools))}));
 for(let i=0;i<3;i++)console.log(JSON.stringify(await client.callTool({name:'photoshop_app',arguments:{action:'status'}})));
} finally {await client.close(); await writeFile('.tmp/smoke-stderr.log',stderr); console.log(stderr);}
