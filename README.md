# dsh-photoshop-mcp

让 DSH 按需加载 Photoshop 工具，并管理 Photoshop 的启动、文档操作和退出。包内复用固定版本的 `@alisaitteke/photoshop-mcp@1.7.37`，额外提供安全退出工具。当前版本为 `0.0.3`。

## 致谢与上游贡献

本项目建立在 **Ali Sait Teke 及贡献者开发的 [Photoshop MCP](https://github.com/alisaitteke/photoshop-mcp)** 之上。Photoshop 自动化连接、ExtendScript 操作、大部分原子工具和配方都来自上游；没有这些工作，本包无法提供目前的 Photoshop 操作能力。感谢上游作者和贡献者持续开发、维护并以 MIT 许可开放源码。

`dsh-photoshop-mcp` 负责 DSH 插件接入、按 Agent 懒加载、工具入口合并，以及文档生命周期、保存状态和阻塞恢复等适配。它不是从零实现的独立 Photoshop 自动化引擎。当前固定依赖 `@alisaitteke/photoshop-mcp@1.7.37`，未直接修改安装后的上游文件；许可与版权声明见 [第三方声明](THIRD_PARTY_NOTICES.md)。欢迎访问上游仓库、支持作者，并将适用于上游的问题或改进反馈给原项目。

## 安装到 DSH

需要 Node.js 22 或更新版本、DSH `>=0.2.1-rc.3 <0.3.0`，以及已经安装、激活的 Photoshop。Windows 通过 COM / ExtendScript 执行操作；macOS 使用 AppleScript。Linux 不支持 Photoshop。

在 DSH 中用 `plugin_manager` 的 `install_bundle` 安装 `dsh-photoshop-mcp@0.0.3`；开发时也可以安装本仓库的绝对路径。无需另配 MCP 命令。插件会启动本地 MCP 子进程，连接本身不会启动 Photoshop。不要直接修改 DSH profile 配置。

开发环境安装依赖可用：

```sh
npm ci --ignore-scripts
npm run check
npm test
```

上游包含与桌面 MCP 无关的可选原生依赖；上述核心链路不需要运行它们的安装脚本。

## 使用

模型初始只看到 `photoshop_load_tools`。调用后，工具只向当前 agent 开放，其他 agent 不受影响。默认 `core` 包含应用生命周期、文档、状态、预览和历史；再次调用可追加 `layers`、`selection`、`effects`、`recipes`、`advanced`，或直接加载 `all`。加载入口会返回当前可用的完整工具名。相关原子操作合并为 `history`、`layer_order`、`layer_transform`、`layer_properties`、`text_edit`、`selection_edit`、`filter`、`color_adjust` 八个操作族，使用 `action` 与精确的 `parameters` 分支，保留原有执行及图片结果渲染。当前完整目录为 91 个合并后入口（包含本轮新增的 4 个），但默认不加载它们；核心组有 15 个业务入口。

长对话可用 `mode: 'replace'` 替换已加载组；配合 `groups: []` 卸载全部 Photoshop 业务工具，只保留加载入口。默认 `mode: 'add'` 仍为追加。新 agent、异步发现和重连均重新应用隔离遮罩。

1. 加载 `core`，调用 `mcp__photoshop__photoshop_app`，以 `status` 查询或 `start` 启动 Photoshop。
2. 新建或打开文档，读取状态；后续操作明确传入 `document_id`，避免切换活动窗口后误改其他作品。
3. 按任务加载工具组，完成修改后获取预览，检查图像。
4. 用保存工具指定绝对路径和格式，再关闭该文档。
5. 应用工具的 `quit` 会在发现未保存修改时拒绝退出，并返回相关文档。只有用户明确同意丢弃全部修改，才允许传 `discard: true`。

关闭文档与退出应用不同：上游 `close_document` 的 `save: false` 会丢弃目标文档修改，调用前必须确认保存意图。应用退出保护不会拦截任意脚本或其他破坏性工具。

生成式工具可能消耗 Adobe 点数，需要另外安装并连接上游 UXP 插件；本包不会自动安装插件或授权消费。工具超时不会取消 Photoshop 中已经开始的脚本。超时后先确认 Photoshop 状态，不要立即重复操作。

## Windows 错误弹窗恢复

核心工具 `photoshop_dialogs` 从 Windows 独立读取 Photoshop 模态窗口，不依赖脚本队列。检测同时包含传统对话框和禁用 Photoshop owner 的自定义窗口；自定义窗口通过 UI Automation 补取文本。`blocking` 表示阻塞，`recoverable` 表示允许确认，两者分开返回。未知窗口可能仍缺少控件文字，不能保证所有插件窗口都可读。

普通操作执行前检查弹窗，正常成功后不再启动第二次扫描；检查结果缓存 350 毫秒。默认等待上限为 20 秒，`PSMCP_CALL_TIMEOUT` 可配置适配器上限，脚本的显式 `timeout_ms` 可指定长操作等待。超时返回 `photoshop_timeout` 和弹窗诊断。后续调用不会继续排队；原调用仍被追踪，不能把等待结束当成 Photoshop 已取消。原调用返回后，必须以成功的 `photoshop_ping` 清除不确定状态。进程状态检查不能代替脚本探针。

`dismiss_known_error` 需要传入检查结果的 `handle`。当前只允许确认“找不到要移去的背景”及对应英文提示，并要求 Photoshop 进程所属的原生对话框、单个可用的“确定 / OK”按钮且没有其他交互控件。点击前再次核对窗口与文字。保存、覆盖、登录、未知内容和自定义插件窗口不会自动确认；macOS 尚无此恢复实现。

恢复后先 `photoshop_ping`，再读取文档状态。关闭错误提示不等于原操作成功，也不会自动重试修改。此能力包含在 0.0.2 中。

## 可靠文件操作与批处理

`open_image` 默认复用同一路径的已打开文档，返回 `reused` 与文档 id，磁盘文件被外部改写也不会隐式重载。`reload: true` 必须同时传 `discard: true`，因为重载会丢弃内存中的修改。打开过程临时关闭 Photoshop 交互提示，并在 finally 中恢复。

`save_document` 与 `export_as` 在 Node 侧创建父目录，并用独占临时文件检查目录可写；失败返回 `output_dir_unusable`，不进入 Photoshop。预检不能替代 Photoshop 对目标文件格式、文件锁或权限的最终检查。中文路径沿用上游已有实现。

`save_document` 使用 `asCopy: false` 真正保存当前文档，返回实际的 `dirty`、`document_id`、`path` 和 `closed`；不会手动设置 `doc.saved`。如果 Photoshop 保存后仍报告 dirty，返回 `ok:false` / `document_still_dirty` 并保持打开。可显式传 `close_after_save: true`，仅在保存后确认 `dirty:false` 时关闭目标文档，释放内存；默认不自动关闭。编辑源文件优先用 PSD，PNG／JPEG 不能保留全部可编辑结构。

`export_as` 只导出副本，返回源文档的实际 `dirty`；`ok:true, dirty:true` 表示导出成功但工作文档仍有未保存修改，不能据此丢弃源文档。完成临时文档任务后应显式保存并关闭，不能以清理内存为由关闭其他用户文档。

亮度／对比度会解锁当前背景层并返回 `unlockedBackground`，其他破坏性操作没有全局自动解锁。描边新增 `position: inside | center | outside`，默认 inside；可能越出画布时返回 `stroke_clipped`。`sample_color` 读取临时合成副本的单像素 RGB 直方图，支持未保存内容；结果属于文档 RGB 色域，不承诺 sRGB，原文档与选区不变。

`advanced` 中的 `batch` 接受最多 24 个白名单操作，使用精确参数分支；失败即停，无回滚，不允许脚本、付费生成或退出应用。`doctor` 创建临时文档，运行背景层调整、模糊、PNG 导出与字节校验，返回步骤耗时，仅关闭自己的文档。核心组的 `close_all` 可用 `document_ids` 限定目标，先检查所有目标，存在未保存修改时整体拒绝；只有明确授权 `discard: true` 才丢弃修改。自检不会调用 `close_all` 清理用户作品。

## 附带技能：白底转透明

仓库提供 [white-background-to-alpha](skills/white-background-to-alpha/SKILL.md) 技能，用于图标、贴纸或圆角方图的外侧白底处理。技能区分 Photoshop 原生移除背景与经过授权的离线 PNG 处理，说明如何保留内部白色图案、检查四角 alpha 和深色背景上的白边。附带脚本只清除与种子相连的近白区域，不做主体识别，也不自动修复抗锯齿边缘。

从 0.0.3 起，技能随插件注册和撤销，无需复制或链接到用户技能根。技能仍按需读取，不增加 Photoshop 初始工具数量，也不改变工具懒加载。

脚本依赖已有的 Pillow，不会自动安装依赖。回归测试可用已安装 Pillow 的 Python 执行：

```sh
python -m unittest discover -s skills/white-background-to-alpha/scripts -p 'test_white_to_alpha.py'
```

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

## 按需技能目录

- [photoshop-safe-workflow](skills/photoshop-safe-workflow/SKILL.md)：文档、导出、弹窗与恢复。
- [white-background-to-alpha](skills/white-background-to-alpha/SKILL.md)：去白底与边缘验收。

这些技能随 npm 包分发，由插件启用时注册，禁用或卸载时撤销；正文仍按需加载，资源路径指向包内目录。无需另建用户级副本或目录联接。旧版已有的同名本地入口应核对来源后移到技能扫描范围之外备份，不删除技能正文。独立用户技能不会被插件改写或删除；同名条目遵循宿主优先级，禁用插件后用户条目仍可使用。跨插件技能引用需要启用对应插件。
