// Pinned upstream internal seam: covered by protocol smoke tests before upgrades.
process.env.ANALYTICS_DISABLED = '1';
process.env.PSMCP_FEEDBACK = '0';
process.env.PSMCP_UPDATE_CHECK = '0';
const { PhotoshopMCPServer } = await import('@alisaitteke/photoshop-mcp/dist/core/server.js');
const { lifecycleDefinition } = await import('./lifecycle.mjs');
const server = new PhotoshopMCPServer({serverVersion:'1.7.37+dsh.0.0.1'});
const connection = server.session.getConnection();
const definition = lifecycleDefinition(connection);
server.toolRegistry.register(definition.tool.name, definition);
let stopping = false;
async function stop() { if (stopping) return; stopping = true; await server.stop(); process.exit(0); }
process.on('SIGTERM', () => { void stop(); });
process.on('SIGINT', () => { void stop(); });
process.stdin.on('end', () => { void stop(); });
await server.start();
