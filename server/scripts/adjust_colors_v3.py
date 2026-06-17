"""暖金vs琥珀颜色区分v3 — 偏移金色调但保护肤色区域"""
import sys
import colorsys
import shutil
from pathlib import Path
from PIL import Image

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

IMAGES_DIR = Path(__file__).resolve().parent.parent / "generated_images"

AMBER_TYPES = ["ISTD", "ISCD", "ISFD", "ASTD", "ASCD", "ASFD", "ESTD", "ESCD", "ESFD"]

HUE_SHIFT = -20
SAT_BOOST = 1.15
LIGHTNESS_ADJUST = -5

GOLD_HUE_MIN = 25
GOLD_HUE_MAX = 60
SATURATION_MIN = 10


def is_skin_tone(r: int, g: int, b: int) -> bool:
    """检测肤色 — 保护人物脸部/身体不被偏移"""
    if not (r > g > b):
        return False
    if not (r > 60 and g > 40 and b > 20):
        return False
    # 肤色饱和度适中（不高饱和）
    hsv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    sat = hsv[1] * 100
    val = hsv[2] * 100
    hue = hsv[0] * 360
    # 肤色: 低饱和，中高亮度，暖色调
    if 5 <= hue <= 35 and sat < 45 and 40 <= val <= 95:
        return True
    return False


def shift_amber_colors_protected(img_path: Path):
    img = Image.open(img_path).convert("RGB")
    pixels = img.load()
    w, h = img.size
    changed = 0
    skipped_skin = 0
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
                if is_skin_tone(r, g, b):
                    skipped_skin += 1
                    continue

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
    return changed, skipped_skin, total_color, pct


def main():
    print("暖金 vs 琥珀 V3 — 保护肤色")
    print(f"色调偏移: {HUE_SHIFT}°, 饱和度: x{SAT_BOOST}, 亮度: {LIGHTNESS_ADJUST:+d}%")
    print(f"金色范围: H={GOLD_HUE_MIN}-{GOLD_HUE_MAX}° S>{SATURATION_MIN}%")
    print(f"{'='*50}\n")

    for code in AMBER_TYPES:
        filepath = IMAGES_DIR / f"{code}.jpg"
        backup = IMAGES_DIR / f"{code}_backup.jpg"

        if not backup.exists():
            print(f"  {code}: 无备份，跳过")
            continue

        # 从备份恢复
        shutil.copy2(str(backup), str(filepath))

        try:
            changed, skin, total, pct = shift_amber_colors_protected(filepath)
            print(f"  {code}: {changed}/{total} 偏移 ({pct:.1f}%) | {skin} 肤色保护")
        except Exception as e:
            print(f"  {code}: FAIL ({e})")
            # 恢复备份
            shutil.copy2(str(backup), str(filepath))

    print(f"\n完成！")


if __name__ == "__main__":
    main()
