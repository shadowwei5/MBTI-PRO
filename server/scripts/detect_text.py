"""检测图片中的文字 — 使用 easyocr 精确检测"""
import sys
from pathlib import Path
import json

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

IMAGES_DIR = Path(__file__).resolve().parent.parent / "generated_images"


def main():
    import easyocr
    reader = easyocr.Reader(["ch_sim", "en"], gpu=False, verbose=False)

    jpg_files = sorted(IMAGES_DIR.glob("*.jpg"))
    print(f"Scanning {len(jpg_files)} images with easyocr...\n")

    text_images = {}
    clean_count = 0

    for i, f in enumerate(jpg_files):
        try:
            results = reader.readtext(str(f), detail=0)
        except Exception as e:
            print(f"[{i+1:3d}/{len(jpg_files)}] {f.stem:6s}  ERROR: {e}")
            continue

        if results:
            text_images[f.stem] = results
            texts = " | ".join(results)
            print(f"[{i+1:3d}/{len(jpg_files)}] {f.stem:6s}  TEXT: {texts[:100]}")
        else:
            clean_count += 1
            print(f"[{i+1:3d}/{len(jpg_files)}] {f.stem:6s}  clean")

    print(f"\n{'='*50}")
    print(f"With text: {len(text_images)}/{len(jpg_files)}")
    print(f"Clean:     {clean_count}/{len(jpg_files)}")

    if text_images:
        print(f"\nTypes to regenerate: {', '.join(sorted(text_images.keys()))}")

    report_path = IMAGES_DIR / "_text_detection_report.json"
    report_path.write_text(json.dumps({
        "text_detected": dict(sorted(text_images.items())),
        "clean_count": clean_count,
        "total": len(jpg_files),
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nReport: {report_path}")


if __name__ == "__main__":
    main()
