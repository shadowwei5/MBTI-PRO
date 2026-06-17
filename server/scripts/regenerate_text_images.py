"""重新生成含文字的图片 — 使用强化后的反文字 prompt"""
import sys
import json
import time
import urllib.request
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from config import IMAGE_API_URL, VOLCENGINE_IMAGE_MODEL, volcengine_headers

API_URL = IMAGE_API_URL
MODEL = VOLCENGINE_IMAGE_MODEL
SIZE = "2k"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "generated_images"
DELAY = 12

# 48 types with text detected by easyocr
TEXT_TYPES = [
    "ABCD", "ABCJ", "ABCP", "ABFD", "ABFJ", "ABFP", "ABTP",
    "ANCD", "ANCJ", "ANCP", "ANFD", "ANFJ", "ANFP", "ANTD", "ANTJ", "ANTP",
    "EBCD", "EBCJ", "EBCP", "EBFD", "EBFJ", "EBFP", "EBTJ", "EBTP",
    "ENCD", "ENCJ", "ENCP", "ENFD", "ENFJ", "ENFP", "ENTD", "ENTP",
    "ESCD", "ESCJ", "ESFP",
    "IBFD", "IBFJ", "IBFP",
    "INCD", "INCJ", "INCP", "INFD", "INFJ", "INFP", "INTD", "INTJ", "INTP",
    "ISTP",
]

# Import role archetypes from generate_images
from generate_images import ROLE_ARCHETYPES, COLOR_GROUPS, GROUP_COLORS, build_prompt

STRONG_NEGATIVE = (
    "写实照片，3D渲染，厚涂手绘，渐变色彩，复杂阴影，模糊失焦，"
    "人物畸形，文字错乱，模糊不清，水印，多余装饰，杂乱背景，"
    "真人肖像，笔触纹理，画面噪点，多余肢体，"
    "任何文字、字母、数字、标题、标签、签名、水印、字体、排版、"
    "汉字、英文、符号、字符、字母数字组合、标识语、口号、"
    "typography, letters, words, characters, text, alphabet, calligraphy,"
    "type code, personality label, role name, Chinese text, labels"
)

STRONG_POSITIVE = """low poly 低多边形矢量插画，扁平化卡通风格，纯色几何色块拼接，无渐变无阴影，整体干净简约，高清矢量质感。

画面中心是{character_desc}。人物服装、配饰、发色使用{color_name}（{color_hex}）及其邻近色系。

背景为干净的米白色纯色，无任何装饰、无边框、无文字。

CRITICAL RULE - ABSOLUTELY NO TEXT: 整张图片不得出现任何文字、字母、数字、汉字、符号、标签、标题、签名或水印。背景必须是纯净的米白色。这是最高优先级的要求。"""


def call_api(positive: str, negative: str, max_retries: int = 3) -> str | None:
    payload = {
        "model": MODEL,
        "prompt": positive,
        "negative_prompt": negative,
        "size": SIZE,
        "response_format": "url",
        "watermark": False,
    }
    data = json.dumps(payload).encode("utf-8")
    headers = volcengine_headers()
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(API_URL, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode("utf-8"))
            if "data" in result and len(result["data"]) > 0:
                return result["data"][0]["url"]
            elif "error" in result:
                print(f"  API error: {result['error']}")
                if attempt < max_retries - 1:
                    time.sleep((attempt + 1) * 5)
        except Exception as e:
            print(f"  Request error ({attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(5)
    return None


def download(url: str, filepath: Path) -> bool:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=60) as resp:
            filepath.write_bytes(resp.read())
        return True
    except Exception as e:
        print(f"  Download failed: {e}")
        return False


def main():
    total = len(TEXT_TYPES)
    print(f"Regenerating {total} images with text (stronger anti-text prompts)")
    print(f"{'='*60}\n")

    ok = 0
    fail = 0

    for i, code in enumerate(TEXT_TYPES):
        group = COLOR_GROUPS.get(code, "unknown")
        color_hex, color_en = GROUP_COLORS.get(group, ("#808080", "gray"))
        role = ROLE_ARCHETYPES.get(code)
        if not role:
            print(f"[{i+1:2d}/{total}] {code:6s}  SKIP (no archetype)")
            fail += 1
            continue
        title, char_desc = role

        positive = STRONG_POSITIVE.format(
            character_desc=char_desc,
            color_name=group,
            color_hex=color_hex,
        )

        print(f"[{i+1:2d}/{total}] {code:6s} ({title})", end=" ", flush=True)

        try:
            url = call_api(positive, STRONG_NEGATIVE)
            if url:
                img_path = OUTPUT_DIR / f"{code}.jpg"
                if download(url, img_path):
                    ok += 1
                    print(f"OK {img_path.stat().st_size/1024:.0f}KB")
                else:
                    fail += 1
                    print("FAIL(download)")
            else:
                fail += 1
                print("FAIL(api)")
        except Exception as e:
            fail += 1
            print(f"FAIL({e})")

        if i < total - 1:
            time.sleep(DELAY)

    print(f"\n{'='*60}")
    print(f"OK: {ok}/{total}  FAIL: {fail}/{total}")


if __name__ == "__main__":
    main()
