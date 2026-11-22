Offline reference for `photoshop`. This page is not registered as a DSH skill.

# Remove a connected near-white exterior from a PNG

Use this pixel method only when offline file processing was requested or separately agreed. For work in Photoshop, follow [the Photoshop workflow](../photoshop/SKILL.md). A failed Photoshop cutout does not authorize switching methods.

The script removes a contiguous exterior, not a recognized subject. Disconnected white text and highlights can survive; white parts touching the background can be lost. Hair, glass, soft shadows, gradients and compression noise are poor fits. Inspect the source dimensions, alpha and boundary pixels before using it, preserve the input and write to a new PNG.

## Run the script

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
