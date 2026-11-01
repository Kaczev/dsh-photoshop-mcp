---
name: photoshop-safe-workflow
description: Use when editing, exporting or closing documents through Photoshop MCP; pin document identity, distinguish source saves from exports, and handle timeouts and dialogs safely.
---

# Photoshop document operations and delivery

Read the current tool contract and document state, then pin document_id. An active tab or same-named file does not establish target identity. Check in-memory changes before opening the same path; reloading from disk is not a lossless refresh.

## Editing and export

Preserve editable sources and necessary copies. Confirm layers, selections, background layers, color mode, canvas and stroke bounds. Before a batch, validate all parameters and targets and set a bounded budget. On failure, inspect partial results rather than assuming transactional rollback.

Saving the source document and exporting PNG/JPEG are separate operations. A successful export does not prove that the source was saved. Check the actual path, dirty state, decodability, dimensions, alpha and appearance in the target context. Disk color sampling excludes unsaved content; state the measurement source.

For white-background removal, read [White background to alpha](../white-background-to-alpha/SKILL.md) and preserve interior whites. Do not repeatedly relax thresholds to hide failure or switch to a destructive route without authorization after automatic removal fails.

## Timeouts and dialogs

A timeout does not prove that the application script was cancelled. Inspect application state and independent modal diagnostics first. Wait for the original operation or recover under the tool contract; run a minimal script probe before reading the document. A live process does not prove queue availability.

Acknowledge only known error dialogs whose content, owning process and action are clear and authorized. Do not automatically click save, overwrite, login or unknown windows. Closing an error dialog does not prove that the original operation succeeded; do not immediately replay writes.

## Finish safely

Confirm that the source is saved before closing it. Retain the source if it remains dirty after export. Limit batch closing to an explicit document set, and clean up only your own documents after temporary self-tests. Do not discard changes, force-kill the application or trigger paid generation without authorization.

For example, check a transparent icon's PNG alpha and edges on a dark background, and save a separate PSD to preserve structure. If the PNG was written but the source is still dirty, do not claim that quitting is safe.
