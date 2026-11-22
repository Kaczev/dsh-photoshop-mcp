---
name: photoshop
description: Inspect and edit Photoshop documents, remove backgrounds, verify saves and exports, or recover a stalled Photoshop operation.
---

# Operate Photoshop through DSH

Loading this skill makes the document and recovery tools in `core` and `photoshop_load_tools` available to this agent on its next step. MCP tool names start with `mcp__photoshop__`. Use the loader for `layers`, `selection`, `effects`, `recipes`, or `advanced` (capabilities, exports and scripts). Loading a group does not launch Photoshop. A child agent needs to load the skill itself.

## Establish the target

Ping once at the start of a Photoshop session, not on every turn. If Photoshop is not running, distinguish a non-launching `photoshop_app` status check from a requested start. Before a document operation, get state: document ID, active layer, selection, dimensions and color mode. If several documents are open, list them and resolve the intended one before acting. Pin `document_id` on edits, previews, saves and closes wherever accepted. A tab name is not an identity; reopening a path is not a lossless refresh of unsaved work.

Prefer a matching `photoshop_recipe_*` to a chain of edits. Preview the result after a meaningful change. Coordinates and bounds are pixels, type sizes are points, and RGB channels run from 0 to 255. Before proposing AI features, check `photoshop_get_capabilities` once. Availability is not consent to spend Adobe credits. Do not install dependencies or use a paid operation without authorization.

## Remove a background, regardless of color

Load `recipes` and resolve any ambiguity about the target. On the chosen document: **get state once, run `photoshop_recipe_remove_background` once, get a preview once on success, then stop.** The recipe unlocks a locked Background layer itself.

On failure, report the error envelope. Do not rasterize, duplicate, hide or delete layers, select the subject, create a mask, run a script or invoke generative removal to get around the failure. A timeout has an unknown result, not a retry allowance. Do not switch to offline processing. For a separately requested offline PNG with a connected near-white exterior, see the [pixel method and its limits](../white-background-to-alpha/SKILL.md). It does not recognize subjects or handle backgrounds in general.

## Recover without replaying a write

Use the returned `code`, `context` and suggested recovery only when they fit the task. For a missing document, list documents and resolve the ID again; for a missing layer, inspect layers; for a missing selection, confirm which region is intended. Do not create a document, unlock a layer or alter a selection just to silence an error.

`photoshop_timeout` or `extendscript_timeout` does not cancel the Photoshop script. Do not queue more edits. On Windows, `photoshop_dialogs` inspects modal windows independently of the script queue. Acknowledge only a recognized, authorized error after checking its handle and text. Never dismiss an overwrite, login or unknown dialog. Once the original call settles and blocking dialogs are resolved, obtain a successful `photoshop_ping` **before** reading document state. A running process or a dismissed dialog proves neither queue recovery nor success. Inspect the target and any output before deciding whether another write is needed.

## Verify delivery

A batch stops on failure without rolling back earlier steps. Read the partial result. For a source save, verify the document ID, actual path and `dirty:false`; prefer PSD when layers must remain editable. `export_as` writes a copy: `ok:true, dirty:true` means the export succeeded and the source still has unsaved edits. Decode the output and check dimensions and appearance. For transparent PNG, check alpha and composite on a contrasting background; a white preview cannot establish transparency.

To close a task-owned temporary document after saving, use `save_document(close_after_save:true)` and check `closed`. Do not close unrelated documents, discard edits, force quit or replace an open file from disk without explicit authorization. Report source-save and export outcomes separately when they differ.
