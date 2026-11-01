---
name: white-background-to-alpha
description: Make the outer white background of icons, stickers or rounded-square images transparent while preserving interior whites; use for white-background removal, transparent corners, white-fringe checks and diagnosis after Photoshop background removal fails.
---

# Remove an icon's outer white background

Use for bitmaps with a clear subject outline and an almost pure-white outer background. Distinguish the outer background from white stars, lettering and highlights inside the subject. Do not delete white across the entire image.

For the general document lifecycle, read [Safe document operations](../photoshop-safe-workflow/SKILL.md). This skill covers background removal and transparency acceptance only.

## Choose the operation path first

- **The user requests cutout or background removal in Photoshop**: use the Photoshop path below.
- **The user explicitly requests offline PNG pixel processing, or has agreed to file-level processing**: the bundled connected-region script may be used. It neither operates Photoshop nor recognizes subjects.
- White subjects connected to white backgrounds, hair, glass, soft shadows, gradient backgrounds and JPEG compression noise require manual masks or a separately authorized segmentation method. Color and connectivity alone cannot recover true colors hidden by a white background.

Keep an input copy and write to a new PNG path. Read the original to check dimensions, alpha and boundary pixels. A white preview cannot prove transparency.

## Photoshop path

Follow the current Photoshop MCP rules: read `photoshop_get_state` once, pin the target `document_id`, call `photoshop_recipe_remove_background` once, call `photoshop_get_preview` once, then stop. Clarify the target if multiple documents are open or identity is uncertain; do not guess from the active tab.

On error, report the original error envelope. Do not bypass the failure through rasterization, layer duplication, magic wand, scripts, subject selection, generative removal or another route. A timeout does not mean cancellation. Check dialogs, recovery probes and state under the tool's recovery contract; do not retry immediately. The error “找不到要移去的背景” (cannot find a background to remove) establishes only that automatic detection failed, not that the background was removed.

Do not automatically switch to the offline script after a failure in the same attempt. Obtain separate user agreement to file-level processing. Saving and exporting after success must also respect the current tool's stop boundary and user authorization. A successful export does not authorize closing an unsaved source document.

## Offline pure-white-background path

Read the bundled [script](scripts/white_to_alpha.py) first and confirm that Pillow is already available. Prefer the Python returned by DSH `load_workspace_dependencies`. Report missing dependencies; do not install automatically. Substitute paths for the current task rather than putting local absolute paths into a shared skill.

```sh
python scripts/white_to_alpha.py input.png output.png
```

By default, the script expands inward from the four corners only, removing opaque pixels that satisfy `min(R,G,B) >= 245` and `max(R,G,B)-min(R,G,B) <= 12`. It uses four-neighbor connectivity and preserves disconnected interior whites. Existing pixels with alpha 0 can provide a path; existing semitransparent pixels are left untouched.

Use `--seeds boundary` only after confirming that the entire boundary is background. Boundary seeds may remove a subject touching an edge. The script reports removed-pixel counts and corner alpha in JSON. It errors if no removable region is found or the output already exists, and never overwrites the input.

For grayish backgrounds, inspect pixels before explicitly adjusting `--white-min` and `--neutral-tolerance`. Defaults are conservative starting points. Do not generalize the threshold 180 from a previous dark icon. Increasing tolerance or lowering the whiteness threshold increases the risk of deleting subject pixels.

The script removes only a hard white background. It does not estimate antialiasing alpha, remove white fringes or resize. Output dimensions and existing non-background pixels remain unchanged. Remove the background before resizing separately, so resampling does not blend the white background into subject edges.

## Verify transparency and edges

1. Use a file decoder to inspect RGBA and minimum alpha. Corners that should be removed must have alpha 0. RGB values in fully transparent areas do not affect transparency.
2. Compare with the original and inspect interior white stars, text and highlights, as well as fine lines and shadows. Connectivity does not recognize the subject; pixel statistics cannot replace visual inspection.
3. Composite on dark gray, white and highly saturated colored backgrounds. Inspect at the target size and with enlarged edges. A white ring invisible on white may be obvious on dark gray.
4. If a white fringe remains, preserve the original and mask and explain the limits of hard thresholds. Do not keep expanding the deletion region or turn white transparent across the whole image. Further work needs a controllable mask and explicit authorization for edge treatment.

Edge compositing follows `C = alpha * F + (1-alpha) * B`. Even with the white background `B` known, foreground color `F` and alpha remain two unknowns. Setting alpha directly to `1-min(R,G,B)/255` also makes white subjects transparent. Defringing requires a reliable mask or additional foreground assumptions; do not promise lossless recovery.

For automated regression checks, see the [test script](scripts/test_white_to_alpha.py) and run:

```sh
python -m unittest discover -s scripts -p 'test_white_to_alpha.py'
```
