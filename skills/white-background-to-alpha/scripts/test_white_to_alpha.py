import tempfile
from pathlib import Path
import unittest

from PIL import Image
from white_to_alpha import convert_file, remove_white


class WhiteToAlphaTests(unittest.TestCase):
    def test_preserves_enclosed_white_and_source(self):
        image = Image.new("RGBA", (7, 7), "white")
        for y in range(1, 6):
            for x in range(1, 6):
                image.putpixel((x, y), (20, 30, 60, 255))
        image.putpixel((3, 3), (255, 255, 255, 255))
        before = image.tobytes()
        result, removed = remove_white(image)
        self.assertEqual(removed, 24)
        self.assertEqual(result.getpixel((3, 3)), (255, 255, 255, 255))
        self.assertEqual(result.getpixel((0, 0))[3], 0)
        self.assertEqual(image.tobytes(), before)
        self.assertEqual(result.size, image.size)

    def test_semitransparent_and_colored_pixels_untouched(self):
        image = Image.new("RGBA", (3, 3), (20, 30, 60, 255))
        image.putpixel((0, 0), (255, 255, 255, 255))
        image.putpixel((1, 0), (255, 255, 255, 128))
        image.putpixel((0, 1), (255, 245, 200, 255))
        result, count = remove_white(image)
        self.assertEqual(count, 1)
        self.assertEqual(result.getpixel((1, 0)), image.getpixel((1, 0)))
        self.assertEqual(result.getpixel((0, 1)), image.getpixel((0, 1)))

    def test_four_neighbors_do_not_cross_diagonal(self):
        image = Image.new("RGBA", (3, 3), "black")
        image.putpixel((0, 0), (255, 255, 255, 255))
        image.putpixel((1, 1), (255, 255, 255, 255))
        result, count = remove_white(image)
        self.assertEqual(count, 1)
        self.assertEqual(result.getpixel((1, 1))[3], 255)

    def test_transparent_path_and_existing_alpha(self):
        image = Image.new("RGBA", (4, 4), "black")
        image.putpixel((0, 0), (13, 24, 35, 0))
        image.putpixel((1, 0), (255, 255, 255, 255))
        result, count = remove_white(image)
        self.assertEqual(count, 1)
        self.assertEqual(result.getpixel((0, 0)), (13, 24, 35, 0))

    def test_explicit_boundary_seeds_and_threshold(self):
        image = Image.new("RGB", (5, 5), "black")
        image.putpixel((2, 0), (240, 240, 240))
        self.assertEqual(remove_white(image)[1], 0)
        self.assertEqual(remove_white(image, seeds="boundary")[1], 0)
        self.assertEqual(remove_white(image, seeds="boundary", white_min=235)[1], 1)
        with self.assertRaises(ValueError):
            remove_white(image, white_min=-1)

    def test_file_safety_and_png(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, target = root / "原图.png", root / "透明.png"
            Image.new("RGB", (2, 2), "white").save(source)
            original = source.read_bytes()
            report = convert_file(source, target)
            self.assertEqual(report["corner_alpha"], [0, 0, 0, 0])
            with Image.open(target) as result:
                self.assertEqual(result.mode, "RGBA")
            with self.assertRaises(FileExistsError):
                convert_file(source, target)
            with self.assertRaises(ValueError):
                convert_file(source, source)
            self.assertEqual(source.read_bytes(), original)
            Image.new("RGB", (2, 2), "black").save(source)
            with self.assertRaises(ValueError):
                convert_file(source, root / "empty.png")
            self.assertFalse((root / "empty.png").exists())
            Image.new("RGB", (2, 2), "white").save(root / "test.jpg")
            with self.assertRaises(ValueError):
                convert_file(root / "test.jpg", root / "jpeg.png")


if __name__ == "__main__":
    unittest.main()
