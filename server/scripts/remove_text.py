"""去除低多边形图片中的文字 — easyocr检测 + 区域纯色填充"""
import sys
from pathlib import Path
from PIL import Image
import json
from collections import Counter

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

IMAGES_DIR = Path(__file__).resolve().parent.parent / "generated_images"
PADDING = 8  # 文字框外扩像素


def get_dominant_color(img: Image, box: tuple, sample_width: int = 4) -> tuple:
    """采样文字框外围区域的背景主色"""
    x1, y1, x2, y2 = [int(v) for v in box]
    w, h = img.size
    colors = []

    # 上下左右四条边框采样
    # top
    for sx in range(max(0, x1), min(w, x2)):
        for dy in range(max(0, y1 - sample_width), min(h, y1)):
            colors.append(img.getpixel((sx, dy)))
    # bottom
    for sx in range(max(0, x1), min(w, x2)):
        for dy in range(max(0, y2), min(h, y2 + sample_width)):
            colors.append(img.getpixel((sx, dy)))
    # left
    for sy in range(max(0, y1), min(h, y2)):
        for dx in range(max(0, x1 - sample_width), min(w, x1)):
            colors.append(img.getpixel((dx, sy)))
    # right
    for sy in range(max(0, y1), min(h, y2)):
        for dx in range(max(0, x2), min(w, x2 + sample_width)):
            colors.append(img.getpixel((dx, sy)))

    if not colors:
        # fallback: use image background (assume top-left is bg)
        return img.getpixel((5, 5))

    # 取出现最多的颜色（纯色背景最可靠）
    counter = Counter(colors)
    return counter.most_common(1)[0][0]


def remove_text_from_image(img_path: Path, reader) -> bool:
    """检测并移除文字，返回是否有文字被移除"""
    img = Image.open(img_path).convert("RGB")

    try:
        results = reader.readtext(str(img_path))
    except Exception:
        return False

    if not results:
        return False  # 无文字

    pixels = img.load()
    removed = 0

    for bbox, text, confidence in results:
        # bbox 是四个角点 [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
        xs = [p[0] for p in bbox]
        ys = [p[1] for p in bbox]
        x1, y1 = max(0, int(min(xs)) - PADDING), max(0, int(min(ys)) - PADDING)
        x2, y2 = int(max(xs)) + PADDING, int(max(ys)) + PADDING

        # 采样背景色
        bg_color = get_dominant_color(img, (x1, y1, x2, y2))

        # 用纯色填充文字区域
        for y in range(y1, min(y2, img.height)):
            for x in range(x1, min(x2, img.width)):
                pixels[x, y] = bg_color

        removed += 1

    if removed > 0:
        img.save(img_path, quality=95)
    return removed > 0


def main():
    import easyocr
    print("Initializing easyocr (this may take a moment)...")
    reader = easyocr.Reader(["ch_sim", "en"], gpu=False, verbose=False)

    jpg_files = sorted(IMAGES_DIR.glob("*.jpg"))
    print(f"Processing {len(jpg_files)} images...\n")

    fixed = 0
    already_clean = 0
    errors = 0

    for i, f in enumerate(jpg_files):
        try:
            had_text = remove_text_from_image(f, reader)
            if had_text:
                fixed += 1
                print(f"[{i+1:3d}/{len(jpg_files)}] {f.stem:6s}  FIXED (text removed)")
            else:
                already_clean += 1
                print(f"[{i+1:3d}/{len(jpg_files)}] {f.stem:6s}  clean")
        except Exception as e:
            errors += 1
            print(f"[{i+1:3d}/{len(jpg_files)}] {f.stem:6s}  ERROR: {e}")

    print(f"\n{'='*50}")
    print(f"Text removed:  {fixed}")
    print(f"Already clean: {already_clean}")
    print(f"Errors:        {errors}")


if __name__ == "__main__":
    main()
