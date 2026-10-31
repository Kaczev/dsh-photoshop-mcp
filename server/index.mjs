// Pinned upstream internal seam: covered by protocol smoke tests before upgrades.
process.env.ANALYTICS_DISABLED = '1';
process.env.PSMCP_FEEDBACK = '0';
process.env.PSMCP_UPDATE_CHECK = '0';
const { PhotoshopMCPServer } = await import('@alisaitteke/photoshop-mcp/dist/core/server.js');
const { lifecycleDefinition } = await import('./lifecycle.mjs');
const server = new PhotoshopMCPServer({serverVersion:'1.7.37+dsh.0.0.2'});
const connection = server.session.getConnection();
const definition = lifecycleDefinition(connection);
server.toolRegistry.register(definition.tool.name, definition);
const {dialogDefinition, guardDefinition} = await import('./dialogs.mjs');
const {createCoordinator} = await import('./coordinator.mjs');
const {adaptFiles} = await import('./files.mjs');
const {adaptEditing,sampleDefinition} = await import('./editing.mjs');
const {closeAllDefinition,doctorDefinition,batchDefinition} = await import('./workflows.mjs');
for(const extra of [sampleDefinition(connection),closeAllDefinition(connection),doctorDefinition(connection)])server.toolRegistry.register(extra.tool.name,extra);
const configuredTimeout=Number(process.env.PSMCP_CALL_TIMEOUT ?? 20000);
const coordinator=createCoordinator({timeoutMs:Number.isFinite(configuredTimeout)&&configuredTimeout>=100?configuredTimeout:20000});
for (const tool of server.toolRegistry.list()) {
  const current=server.toolRegistry.get(tool.name);
  // Replace in place without duplicate-registration warnings.
  server.toolRegistry.unregister(tool.name);
  server.toolRegistry.register(tool.name, guardDefinition(adaptEditing(adaptFiles(current,connection),connection), undefined, coordinator));
}
const batch=batchDefinition(server.toolRegistry);
server.toolRegistry.register(batch.tool.name,batch);
const dialogs=dialogDefinition();
server.toolRegistry.register(dialogs.tool.name,dialogs);
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await server.stop(); process.exit(0); }
process.on('SIGTERM', () => { void stop(); });
process.on('SIGINT', () => { void stop(); });
process.stdin.on('end', () => { void stop(); });
await server.start();
