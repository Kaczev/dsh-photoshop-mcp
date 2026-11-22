import z from '@deepseek-ai/schemastery';
import * as mcp from '@deepseek-ai/dsh-mcp-client';
import { fileURLToPath } from 'node:url';
import { installLazyTools } from './lib/lazy-tools.mjs';
import { installPackagedSkills } from './lib/packaged-skills.mjs';
export const name = 'dsh-photoshop-mcp';
export const inject = ['tools', 'agents', 'attachments', 'skills'];
export const Config = z.object({
  toolCallTimeoutMs: z.number().min(10000).max(600000).step(1).default(180000).description('工具超时（毫秒）；超时不代表 Photoshop 脚本已停止 / Timeout does not cancel Photoshop scripts')
});
export async function apply(ctx, config) {
  const [skill] = installPackagedSkills(ctx, new URL('./skills/', import.meta.url));
  const bridge = installLazyTools(ctx, skill);
  await mcp.apply(bridge, mcp.Config({
    serverName: 'photoshop', transport: 'stdio', command: process.execPath,
    args: [fileURLToPath(new URL('./server/index.mjs', import.meta.url))],
    env: { ELECTRON_RUN_AS_NODE: '1', ANALYTICS_DISABLED: '1', PSMCP_FEEDBACK: '0', PSMCP_UPDATE_CHECK: '0' },
    toolCallTimeoutMs: config.toolCallTimeoutMs, failOnStartupError: false
  }));
}
