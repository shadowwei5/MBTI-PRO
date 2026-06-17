"""暖金 vs 琥珀颜色区分 — 琥珀组色调向橙色偏移，保持暖金组不变"""
import sys
from pathlib import Path
from PIL import Image
import colorsys
import json

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

IMAGES_DIR = Path(__file__).resolve().parent.parent / "generated_images"

# 琥珀组成员 (来自 generate_images.py COLOR_GROUPS)
AMBER_TYPES = ["ISTD", "ISCD", "ISFD", "ASTD", "ASCD", "ASFD", "ESTD", "ESCD", "ESFD"]
WARM_GOLD_TYPES = ["ISTP", "ISCP", "ISFP", "ASTP", "ASCP", "ASFP", "ESTP", "ESCP", "ESFP"]

# 琥珀目标色: 更偏橙/铜色，与暖金区分
# 暖金 #D4A017 (H≈43°) → 保持
# 琥珀 #E8A840 (H≈40°) → 向橙色偏移 H≈25-30°
HUE_SHIFT = -15   # 琥珀色调向橙色偏移
GOLD_HUE_MIN = 30  # 金黄色相范围下限
GOLD_HUE_MAX = 55  # 金黄色相范围上限
SATURATION_MIN = 20 # 最低饱和度


def shift_amber_colors(img_path: Path, output_path: Path):
    """将琥珀组图片中的金色调向橙色偏移"""
    img = Image.open(img_path).convert("RGB")
    pixels = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            # 跳过白色/极浅色背景
            if r > 240 and g > 240 and b > 240:
                continue
            # 跳过深色/黑色
            if r < 30 and g < 30 and b < 30:
                continue

            hsv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hue_deg = hsv[0] * 360
            sat = hsv[1] * 100

            # 只处理金色/黄色范围
            if GOLD_HUE_MIN <= hue_deg <= GOLD_HUE_MAX and sat > SATURATION_MIN:
                # 向橙色偏移
                new_hue = (hue_deg + HUE_SHIFT) / 360
                new_hue = new_hue % 1.0
                nr, ng, nb = colorsys.hsv_to_rgb(new_hue, hsv[1], hsv[2])
                pixels[x, y] = (
                    min(255, max(0, int(nr * 255))),
                    min(255, max(0, int(ng * 255))),
                    min(255, max(0, int(nb * 255))),
                )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, quality=95)
    return True


def main():
    print("暖金 vs 琥珀颜色区分处理")
    print(f"暖金组 (保持不变): {', '.join(WARM_GOLD_TYPES)}")
    print(f"琥珀组 (向橙色偏移): {', '.join(AMBER_TYPES)}")
    print(f"\n琥珀色调偏移量: {HUE_SHIFT}° (金色 → 橙色)")
    print(f"{'='*50}\n")

    for code in AMBER_TYPES:
        src = IMAGES_DIR / f"{code}.jpg"
        if not src.exists():
            print(f"  {code}: 文件不存在，跳过")
            continue

        # 备份原图
        backup = IMAGES_DIR / f"{code}_backup.jpg"
        if not backup.exists():
            src.rename(backup)
            src = backup

        try:
            shift_amber_colors(src, IMAGES_DIR / f"{code}.jpg")
            size_kb = (IMAGES_DIR / f"{code}.jpg").stat().st_size / 1024
            print(f"  {code}: OK ({size_kb:.0f} KB)")
        except Exception as e:
            print(f"  {code}: FAIL ({e})")
            # 恢复备份
            if backup.exists() and not (IMAGES_DIR / f"{code}.jpg").exists():
                backup.rename(IMAGES_DIR / f"{code}.jpg")

    print("\n完成！暖金组保持金黄，琥珀组偏向橙色调。")


if __name__ == "__main__":
    main()
