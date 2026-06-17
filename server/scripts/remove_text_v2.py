"""去除低多边形图片中的文字 — easyocr检测 + OpenCV inpainting填充"""
import sys
from pathlib import Path
import numpy as np
import cv2

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

IMAGES_DIR = Path(__file__).resolve().parent.parent / "generated_images"
PADDING = 6
INPAINT_RADIUS = 8


def remove_text_from_image(img_path: Path, reader) -> bool:
    img = cv2.imread(str(img_path))
    if img is None:
        return False

    try:
        results = reader.readtext(str(img_path))
    except Exception:
        return False

    if not results:
        return False

    h, w = img.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    for bbox, text, confidence in results:
        if confidence < 0.05 and len(text.strip()) <= 1:
            continue  # 跳过极低置信度单字符

        xs = [p[0] for p in bbox]
        ys = [p[1] for p in bbox]
        x1 = max(0, int(min(xs)) - PADDING)
        y1 = max(0, int(min(ys)) - PADDING)
        x2 = min(w, int(max(xs)) + PADDING)
        y2 = min(h, int(max(ys)) + PADDING)

        mask[y1:y2, x1:x2] = 255

    if np.count_nonzero(mask) == 0:
        return False

    # OpenCV inpainting (Telea算法 — 对平坦色块效果好)
    result = cv2.inpaint(img, mask, INPAINT_RADIUS, cv2.INPAINT_TELEA)
    cv2.imwrite(str(img_path), result, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return True


def main():
    import easyocr
    print("Initializing easyocr...")
    reader = easyocr.Reader(["ch_sim", "en"], gpu=False, verbose=False)

    jpg_files = sorted(IMAGES_DIR.glob("*.jpg"))
    jpg_files = [f for f in jpg_files if "_backup" not in f.stem]
    print(f"Processing {len(jpg_files)} images with OpenCV inpainting...\n")

    fixed = 0
    clean = 0

    for i, f in enumerate(jpg_files):
        try:
            if remove_text_from_image(f, reader):
                fixed += 1
                print(f"[{i+1:3d}/{len(jpg_files)}] {f.stem:6s}  FIXED")
            else:
                clean += 1
        except Exception as e:
            print(f"[{i+1:3d}/{len(jpg_files)}] {f.stem:6s}  ERROR: {e}")

    print(f"\n{'='*50}")
    print(f"Fixed:  {fixed}")
    print(f"Clean:  {clean}")


if __name__ == "__main__":
    main()
