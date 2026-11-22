# 0.1.0

新会话只在技能目录看到 `photoshop`。当前代理成功读取该技能，或用户执行 `/photoshop` 之后，下一步才出现 `core` 和 `photoshop_load_tools`。其他会话和子代理需要各自加载。旧配置 `lazyTools: false` 不再提前公开工具。

要求 DSH `>=0.2.2-rc.5 <0.3.0`。`photoshop-safe-workflow` 并入主技能。白底 PNG 的离线说明仍随包提供，但不再注册为独立技能。

## 验证

- `npm test`：26 通过，含不带 Photoshop 调用的协议发现。
- 未在真实 Photoshop 里重跑文档操作。
