---
name: photoshop
description: Use Photoshop to inspect or edit a document, remove a background, save a layered source, export an image, or recover an operation whose result is unknown.
---

# Work on a Photoshop document

**Find the document before editing it.** Start a session with `photoshop_ping`. If the question is only whether Photoshop is running, `photoshop_app` status checks without launching it; start the app only when requested. Read `photoshop_get_state` for the document ID, active layer, selection, dimensions and color mode. With several tabs open, use `photoshop_list_documents` to identify the target. Pass its `document_id` on edits, previews, saves and closes wherever the tool accepts it. Reopening the file from disk can lose the changes you meant to inspect.

This skill gives the current agent `core` tools and `photoshop_load_tools` on its next step. The names below omit the `mcp__photoshop__` prefix. Load only the group the task needs: `recipes` for a complete operation; `layers`, `selection` or `effects` for individual edits; `advanced` for exports, capabilities or scripts. Loading a group does not launch Photoshop. Child agents load the skill themselves.

## Make the edit

Use a matching recipe when available. For a single edit, use the tool's schema; grouped tools such as `photoshop_text_edit` take an `action` and that action's `parameters`. Coordinates and bounds are pixels, type sizes are points, and RGB values run from 0 to 255. Preview the target after a meaningful change, not after each atomic step. Before proposing a generative operation, check `photoshop_get_capabilities` once. An available feature is not permission to spend Adobe credits or install anything.

**For background removal, the sequence is fixed regardless of background color:** load `recipes`, identify the document, read its state once (reuse the targeting read), call `photoshop_recipe_remove_background` once, then get one preview on success and stop. The recipe unlocks a locked Background itself. On failure, report its error. Do not rasterize, duplicate, hide or delete layers, select the subject, build a mask, run a script or try a generative tool to finish the cutout. Do not switch to offline processing. The [near-white PNG method](../white-background-to-alpha/SKILL.md) applies only to a separately requested offline task with a connected near-white exterior.

## Decide whether it finished

A failed batch can leave earlier edits in place. Read the partial result and the error's `code` and `context` before acting on a suggested fix. A missing document or layer calls for a fresh list, not a new document; a missing selection calls for identifying the intended region. For font names, artboards or scratch-space errors, see the [recovery notes](recovery.md).

A `photoshop_timeout` or `extendscript_timeout` leaves the write's outcome **unknown**. Stop sending edits. On Windows, `photoshop_dialogs` can inspect modals independently of the script queue. Acknowledge only a known, authorized error after checking its handle and text; leave overwrite, login and unfamiliar dialogs alone. Once the outstanding call settles and any blocking dialog is resolved, get a successful `photoshop_ping` **before** reading state. Check the target and any output; neither the process being alive nor a dialog disappearing proves the edit succeeded.

## Deliver the source or the copy

Use an absolute output path. For an editable source, prefer PSD and use `photoshop_save_document`. Verify the returned document ID, actual path and `dirty:false`. To close a task-owned temporary document as part of saving, request `close_after_save:true` and check `closed`. Do not close another document, discard edits or force quit without explicit authorization.

`photoshop_export_as` writes a **copy**. `ok:true, dirty:true` means the export succeeded but the open source still has unsaved edits. Decode the delivered file and check its dimensions and appearance. For transparent PNG, inspect alpha and composite on a contrasting color: a white preview cannot distinguish white pixels from transparency. Report source-save and export outcomes separately.
