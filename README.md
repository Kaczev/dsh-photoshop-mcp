# dsh-photoshop-mcp

让 DSH 按需加载 Photoshop 工具，并管理 Photoshop 的启动、文档操作和退出。包内复用固定版本的 `@alisaitteke/photoshop-mcp@1.7.37`，额外提供安全退出工具。首个版本为 `0.0.1`。

## 安装到 DSH

需要 Node.js 22 或更新版本、DSH `>=0.2.1-rc.3 <0.3.0`，以及已经安装、激活的 Photoshop。Windows 通过 COM / ExtendScript 执行操作；macOS 使用 AppleScript。Linux 不支持 Photoshop。

在 DSH 中用 `plugin_manager` 的 `install_bundle` 安装 `dsh-photoshop-mcp@0.0.1`；开发时也可以安装本仓库的绝对路径。无需另配 MCP 命令。插件会启动本地 MCP 子进程，连接本身不会启动 Photoshop。不要直接修改 DSH profile 配置。

开发环境安装依赖可用：

```sh
npm ci --ignore-scripts
npm run check
npm test
```

上游包含与桌面 MCP 无关的可选原生依赖；上述核心链路不需要运行它们的安装脚本。

## 使用

模型初始只看到 `photoshop_load_tools`。调用后，工具只向当前 agent 开放，其他 agent 不受影响。默认 `core` 包含应用生命周期、文档、状态、预览和历史；再次调用可追加 `layers`、`selection`、`effects`、`recipes`、`advanced`，或直接加载 `all`。加载入口会返回当前可用的完整工具名。

1. 加载 `core`，调用 `mcp__photoshop__photoshop_app`，以 `status` 查询或 `start` 启动 Photoshop。
2. 新建或打开文档，读取状态；后续操作明确传入 `document_id`，避免切换活动窗口后误改其他作品。
3. 按任务加载工具组，完成修改后获取预览，检查图像。
4. 用保存工具指定绝对路径和格式，再关闭该文档。
5. 应用工具的 `quit` 会在发现未保存修改时拒绝退出，并返回相关文档。只有用户明确同意丢弃全部修改，才允许传 `discard: true`。

关闭文档与退出应用不同：上游 `close_document` 的 `save: false` 会丢弃目标文档修改，调用前必须确认保存意图。应用退出保护不会拦截任意脚本或其他破坏性工具。

生成式工具可能消耗 Adobe 点数，需要另外安装并连接上游 UXP 插件；本包不会自动安装插件或授权消费。工具超时不会取消 Photoshop 中已经开始的脚本。超时后先确认 Photoshop 状态，不要立即重复操作。

## 配置

- `lazyTools`：默认 `true`，按 agent 懒加载；设为 `false` 时直接开放全部 Photoshop 工具。
- `toolCallTimeoutMs`：默认 180000，允许 10000–600000 毫秒。

包内默认关闭上游分析、反馈和更新检查。MCP 子进程随插件销毁而退出，但不会因此强制关闭 Photoshop。

## 验证

```sh
npm run check
npm test
node scripts/smoke.mjs
node scripts/live-test.mjs
npm run pack:check
```

`smoke` 检查 MCP 握手、工具发现和重复状态查询。`live-test` 会新建两份临时文档，测试图层、填充、预览、PSD / PNG 保存和关闭；输出写入忽略目录 `.tmp/`。它只清理自己创建的文档，不关闭启动前已运行的 Photoshop。

`node scripts/live-test.mjs --cold` 还会测试应用退出、冷启动和未保存修改保护，要求 Photoshop 当前没有打开任何文档。测试发现文档时会停止，不会替用户关闭。

Windows Photoshop 2026 是当前实测平台；macOS 分支需要在 Mac 上验证。上游不是全部工具都经过本包逐项实测，尤其生成式和神经滤镜不在无消费自测范围内。

开发入口见仓库中的 [INDEX.md](https://github.com/Kaczev/dsh-photoshop-mcp/blob/main/INDEX.md)。图标由 Krea 2 Turbo 生成，资源说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
