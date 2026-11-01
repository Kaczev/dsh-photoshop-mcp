# 0.0.4

Translate photoshop-safe-workflow and white-background-to-alpha into English. The image-processing scripts are unchanged.

Skill names, registration, tool interfaces, safety rules and measured values are preserved. This patch does not change runtime code or dependencies.

## Verification

- `npm run check`, `npm test` (24 passed), `npm run pack:check` and tarball inspection.
- Six offline Python image-processing tests.
- Replacement-resource comparison against the handoff kit; unchanged executable resources retain their baseline hashes.

No live DSH profile reload, editor operation, Photoshop operation or image generation was performed for this documentation patch.
