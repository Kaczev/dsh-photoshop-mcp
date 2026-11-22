# Photoshop recovery notes

Use the error code to decide what to inspect. An error's suggested next tool does not authorize a different edit.

| Result | What to check next |
| --- | --- |
| `font_not_found` | Load `layers` and list fonts. Use the installed face's exact `postScriptName`, not its display name. If the user authorizes installing a font file they already have, the install tool refreshes Photoshop's font list; there is no need to quit the app. |
| `not_text_layer` | Check the target layer and select the intended text layer. Create a new text layer only if the requested edit calls for one. |
| `artboard_not_found` | List artboards in the target document and resolve the name. An absent artboard is not permission to create one. |
| `scratch_disk_full` | Stop submitting scripts. A scratch-disk alert may also present as a timeout. Tell the user which volume Photoshop reports and ask them to free space or choose another scratch disk. Do not delete files or restart an editor with unsaved work. After an authorized restart, ping, then re-identify the open document. |

For a timeout without a confirmed cause, follow the [queue and modal checks](SKILL.md#decide-whether-it-finished). A timeout by itself does not diagnose a full disk.
