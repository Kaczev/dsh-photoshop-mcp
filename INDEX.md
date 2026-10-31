# Source navigation

- [README.md](README.md): installation, tool use and safety limits.
- [index.mjs](index.mjs): Cordis configuration and MCP process wiring.
- [lib/lazy-tools.mjs](lib/lazy-tools.mjs): per-agent tool groups, masks, reconnect and disposal.
- [server/index.mjs](server/index.mjs): pinned upstream server adapter and shutdown.
- [server/lifecycle.mjs](server/lifecycle.mjs): non-launching status, startup and guarded application exit.
- [test/runtime.test.mjs](test/runtime.test.mjs): real Cordis scope isolation and reconnection tests.
- [test/lifecycle.test.mjs](test/lifecycle.test.mjs): application safety regression tests.
- [scripts/smoke.mjs](scripts/smoke.mjs): MCP protocol discovery and repeated status checks.
- [scripts/live-test.mjs](scripts/live-test.mjs): real Photoshop editing, preview, saving and exit tests.
- [docs/design/icon-preview.html](docs/design/icon-preview.html): editable icon appearance reference.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): dependency and generated artwork attribution.
