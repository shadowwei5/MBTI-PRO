"""暖金vs琥珀颜色区分v2 — 更大的色调偏移 + 饱和度/亮度增强"""
import sys
import colorsys
from pathlib import Path
from PIL import Image

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

IMAGES_DIR = Path(__file__).resolve().parent.parent / "generated_images"

AMBER_TYPES = ["ISTD", "ISCD", "ISFD", "ASTD", "ASCD", "ASFD", "ESTD", "ESCD", "ESFD"]

# 琥珀 → 铜色/橙色: 大幅降色温
HUE_SHIFT = -20        # 色调向橙色偏移(原-15 → -20)
SAT_BOOST = 1.15       # 饱和度提升15%让色彩更鲜明
LIGHTNESS_ADJUST = -5  # 稍微加深让铜色感更强

GOLD_HUE_MIN = 25      # 金黄色相下限
GOLD_HUE_MAX = 60      # 金黄色相上限
SATURATION_MIN = 10    # 最低饱和度门槛


def shift_amber_colors(img_path: Path):
    img = Image.open(img_path).convert("RGB")
    pixels = img.load()
    w, h = img.size
    changed = 0
    total_color = 0

    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            if r > 245 and g > 245 and b > 245:
                continue
            if r < 25 and g < 25 and b < 25:
                continue

            total_color += 1
            hsv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hue_deg = hsv[0] * 360
            sat = hsv[1]

            if GOLD_HUE_MIN <= hue_deg <= GOLD_HUE_MAX and sat * 100 > SATURATION_MIN:
                new_hue = (hue_deg + HUE_SHIFT) / 360 % 1.0
                new_sat = min(1.0, sat * SAT_BOOST)
                new_val = max(0.0, min(1.0, hsv[2] + LIGHTNESS_ADJUST / 100))
                nr, ng, nb = colorsys.hsv_to_rgb(new_hue, new_sat, new_val)
                pixels[x, y] = (
                    min(255, max(0, int(nr * 255))),
                    min(255, max(0, int(ng * 255))),
                    min(255, max(0, int(nb * 255))),
                )
                changed += 1

    img.save(img_path, quality=95)
    pct = changed / total_color * 100 if total_color > 0 else 0
    return changed, total_color, pct


def main():
    print("暖金 vs 琥珀颜色区分 V2 (更强偏移)")
    print(f"琥珀组: {', '.join(AMBER_TYPES)}")
    print(f"色调偏移: {HUE_SHIFT}° | 饱和度: x{SAT_BOOST} | 亮度: {LIGHTNESS_ADJUST:+d}%")
    print(f"颜色范围: H={GOLD_HUE_MIN}-{GOLD_HUE_MAX}° S>{SATURATION_MIN}%")
    print(f"{'='*50}\n")

    for code in AMBER_TYPES:
        filepath = IMAGES_DIR / f"{code}.jpg"
        if not filepath.exists():
            print(f"  {code}: 文件不存在，跳过")
            continue

        # 如果之前有备份，从备份重新处理
        backup = IMAGES_DIR / f"{code}_backup.jpg"
        if backup.exists():
            import shutil
            shutil.copy2(str(backup), str(filepath))
            print(f"  {code}: 从备份恢复原始颜色...")

        try:
            changed, total, pct = shift_amber_colors(filepath)
            print(f"  {code}: {changed}/{total} 像素偏移 ({pct:.1f}%)")
        except Exception as e:
            print(f"  {code}: FAIL ({e})")

    print(f"\n完成！琥珀组金色调向橙色/铜色大幅偏移。")


if __name__ == "__main__":
    main()
