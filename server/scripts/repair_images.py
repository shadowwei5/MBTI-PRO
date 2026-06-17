"""修复被误删的图片区域 — 检测异常纯色块并用OpenCV inpainting修复"""
import sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

IMAGES_DIR = Path(__file__).resolve().parent.parent / "generated_images"

# 被误删的图片列表
DAMAGED_CODES = ["EBCJ", "ENFJ", "INFJ"]

# 纯色块检测参数
UNIFORMITY_THRESHOLD = 3  # 颜色标准差低于此值视为纯色块
MIN_BLOB_SIZE = 500        # 最小需要修复的区域(px²)


def detect_filled_regions(img_path: Path) -> list[tuple]:
    """检测图片中异常的纯色填充块"""
    img = cv2.imread(str(img_path))
    if img is None:
        return []

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 计算局部标准差 — 纯色区域标准差极低
    ksize = 15
    mean = cv2.blur(gray, (ksize, ksize))
    sq_mean = cv2.blur(gray.astype(np.float32) ** 2, (ksize, ksize))
    variance = sq_mean - mean.astype(np.float32) ** 2
    std = np.sqrt(np.maximum(variance, 0))

    # 纯色区域mask
    uniform_mask = (std < UNIFORMITY_THRESHOLD).astype(np.uint8) * 255

    # 排除白色背景（背景本身是纯色）
    bg_mask = (gray > 245).astype(np.uint8) * 255
    uniform_mask = cv2.bitwise_and(uniform_mask, cv2.bitwise_not(bg_mask))

    # 排除深色区域
    dark_mask = (gray < 20).astype(np.uint8) * 255
    uniform_mask = cv2.bitwise_and(uniform_mask, cv2.bitwise_not(dark_mask))

    # 形态学处理：连接小块
    kernel = np.ones((5, 5), np.uint8)
    uniform_mask = cv2.morphologyEx(uniform_mask, cv2.MORPH_CLOSE, kernel)

    # 找连通区域
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(uniform_mask, connectivity=8)

    regions = []
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area > MIN_BLOB_SIZE:
            x, y = stats[i, cv2.CC_STAT_LEFT], stats[i, cv2.CC_STAT_TOP]
            bw = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
            # 检查是否为低多边形正常色块（排除几何边缘附近的误检）
            # 真实异常是: 大块纯色 + 边缘不贴合画面几何
            if area > 2000:  # 较大区域才可能是异常
                regions.append((x, y, x + bw[0], y + bw[1], area))

    # 按面积降序
    regions.sort(key=lambda r: r[4], reverse=True)
    return regions


def repair_image(img_path: Path) -> bool:
    """检测并修复被误删区域"""
    img = cv2.imread(str(img_path))
    if img is None:
        return False

    h, w = img.shape[:2]

    # 检测异常纯色块
    regions = detect_filled_regions(img_path)
    if not regions:
        print("  未检测到异常纯色块")
        return False

    # 创建修复mask（只修复面积最大的前3个区域，避免过度修复）
    mask = np.zeros((h, w), dtype=np.uint8)
    repaired = 0
    for x1, y1, x2, y2, area in regions[:3]:
        # 外扩padding
        px1 = max(0, x1 - 4)
        py1 = max(0, y1 - 4)
        px2 = min(w, x2 + 4)
        py2 = min(h, y2 + 4)
        mask[py1:py2, px1:px2] = 255
        repaired += 1
        print(f"  修复区域: ({x1},{y1})-({x2},{y2}) area={area}px")

    if np.count_nonzero(mask) == 0:
        return False

    # OpenCV inpainting
    result = cv2.inpaint(img, mask, 12, cv2.INPAINT_TELEA)
    cv2.imwrite(str(img_path), result, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return True


def main():
    print("修复被误删的图片区域")
    print(f"{'='*50}\n")

    for code in DAMAGED_CODES:
        fp = IMAGES_DIR / f"{code}.jpg"
        if not fp.exists():
            print(f"  {code}: 文件不存在")
            continue

        print(f"  {code}:")
        try:
            repaired = repair_image(fp)
            if repaired:
                print(f"    -> 已修复")
            else:
                print(f"    -> 无需修复或无法自动修复")
        except Exception as e:
            print(f"    -> 错误: {e}")

    print(f"\n如果需要完全重新生成，请充值火山引擎账户后运行:")
    print(f"  python scripts/regenerate_text_images.py")


if __name__ == "__main__":
    main()
