import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('initialize omits instructions while backend discovery remains available without Photoshop', {timeout:30000}, async () => {
  const client = new Client({name:'photoshop-initialize-test',version:'1'});
  const transport = new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../server/index.mjs',import.meta.url))],env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PHOTOSHOP_MCP_NO_LAUNCH:'1'}});
  try {
    await client.connect(transport);
    assert.equal(client.getInstructions(), undefined);
    const {tools} = await client.listTools();
    const names = new Set(tools.map(t=>t.name));
    for (const name of ['ping','get_state','list_documents','get_preview','recipe_remove_background']) assert.ok(names.has('photoshop_'+name), name);
  } finally { await client.close(); }
});
