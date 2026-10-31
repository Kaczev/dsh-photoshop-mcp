import z from '@deepseek-ai/schemastery';
import * as mcp from '@deepseek-ai/dsh-mcp-client';
import { fileURLToPath } from 'node:url';
import { installLazyTools } from './lib/lazy-tools.mjs';
export const name = 'dsh-photoshop-mcp';
export const inject = ['tools', 'agents', 'attachments'];
export const Config = z.object({
  lazyTools: z.boolean().default(true).description('按 Agent、类别懒加载 / Per-agent category loading'),
  toolCallTimeoutMs: z.number().min(10000).max(600000).step(1).default(180000).description('工具超时（毫秒）；超时不代表 Photoshop 脚本已停止 / Timeout does not cancel Photoshop scripts')
});
export async function apply(ctx, config) {
  installLazyTools(ctx, config.lazyTools);
  await mcp.apply(ctx, mcp.Config({
    serverName: 'photoshop', transport: 'stdio', command: process.execPath,
    args: [fileURLToPath(new URL('./server/index.mjs', import.meta.url))],
    env: { ELECTRON_RUN_AS_NODE: '1', ANALYTICS_DISABLED: '1', PSMCP_FEEDBACK: '0', PSMCP_UPDATE_CHECK: '0' },
    toolCallTimeoutMs: config.toolCallTimeoutMs, failOnStartupError: false
  }));
}
