"""Conservative, hard-mask removal of corner-connected neutral white PNG pixels."""
import argparse
from collections import deque
import json
from pathlib import Path

from PIL import Image


def remove_white(image, white_min=245, neutral_tolerance=12, seeds="corners"):
    if not 0 <= white_min <= 255 or not 0 <= neutral_tolerance <= 255:
        raise ValueError("Thresholds must be between 0 and 255")
    if seeds not in ("corners", "boundary"):
        raise ValueError("Seeds must be corners or boundary")
    result = image.convert("RGBA")
    width, height = result.size
    pixels = bytearray(result.tobytes())
    visited = bytearray(width * height)
    queue = deque()

    def add(index):
        if visited[index]:
            return
        visited[index] = 1
        offset = index * 4
        r, g, b, a = pixels[offset:offset + 4]
        if a == 0 or (a == 255 and min(r, g, b) >= white_min
                      and max(r, g, b) - min(r, g, b) <= neutral_tolerance):
            queue.append(index)

    if seeds == "corners":
        for index in (0, width - 1, (height - 1) * width, width * height - 1):
            add(index)
    else:
        for x in range(width):
            add(x)
            add((height - 1) * width + x)
        for y in range(height):
            add(y * width)
            add(y * width + width - 1)

    removed = 0
    while queue:
        index = queue.popleft()
        offset = index * 4
        if pixels[offset + 3] != 0:
            pixels[offset:offset + 4] = bytes(4)
            removed += 1
        x, y = index % width, index // width
        if x:
            add(index - 1)
        if x + 1 < width:
            add(index + 1)
        if y:
            add(index - width)
        if y + 1 < height:
            add(index + width)
    result.frombytes(bytes(pixels))
    return result, removed


def convert_file(source, target, **options):
    source, target = Path(source), Path(target)
    if source.resolve() == target.resolve():
        raise ValueError("Input and output must be different paths")
    if target.suffix.lower() != ".png":
        raise ValueError("Output must have a .png extension")
    with Image.open(source) as image:
        if image.format != "PNG" or getattr(image, "n_frames", 1) != 1:
            raise ValueError("Only single-frame PNG input is supported")
        # Thresholds are expressed in 8-bit RGB, not arbitrary high-bit-depth data.
        if image.mode not in ("RGB", "RGBA", "P", "L", "LA", "1"):
            raise ValueError("Convert high-bit-depth input to 8-bit RGB explicitly first")
        result, removed = remove_white(image, **options)
        profile = image.info.get("icc_profile")
        if not removed:
            raise ValueError("No connected opaque white pixels found; output was not written")
        # Exclusive creation prevents overwriting user files, including symlinks.
        with target.open("xb") as handle:
            try:
                result.save(handle, format="PNG", icc_profile=profile)
            except Exception:
                handle.close()
                target.unlink()
                raise
    width, height = result.size
    return {"output": str(target), "width": width, "height": height,
            "removed_pixels": removed,
            "corner_alpha": [result.getpixel(point)[3] for point in
                             ((0, 0), (width - 1, 0), (0, height - 1),
                              (width - 1, height - 1))]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("--white-min", type=int, default=245)
    parser.add_argument("--neutral-tolerance", type=int, default=12)
    parser.add_argument("--seeds", choices=("corners", "boundary"), default="corners")
    args = parser.parse_args()
    try:
        report = convert_file(args.source, args.target, white_min=args.white_min,
                              neutral_tolerance=args.neutral_tolerance, seeds=args.seeds)
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        parser.exit(1, f"white_to_alpha: {error}\n")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
