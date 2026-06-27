"""生成 Shadow的奇思妙想 品牌素材：头像、主页背景、视频封面"""
import sys, json, time, urllib.request, os
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from config import IMAGE_API_URL, VOLCENGINE_IMAGE_MODEL, volcengine_headers

API_URL = IMAGE_API_URL
MODEL = VOLCENGINE_IMAGE_MODEL
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "generated_images" / "brand_assets"

# ======================== 三组 Prompt ========================

AVATAR_PROMPT = """minimalist flat vector logo design, clean geometric shapes, a stylized letter "S" that morphs into a glowing lightbulb filament, the lightbulb outline simultaneously forms a half-open treasure chest, symbolizing ideas turning into treasures. Color palette: deep purple (#4A0E5C) transitioning to warm gold (#F5C842) in a smooth gradient. Pure dark background (#1A1A2E). Flat design, no gradients except the S-to-gold, crisp edges, suitable for small-scale avatar recognition. Absolutely NO text, NO letters, NO numbers, NO words, NO labels. Simple, iconic, modern."""

AVATAR_NEGATIVE = """photorealistic, 3D render, complex shadows, blurry, distorted shapes, text, letters, numbers, symbols, watermark, busy background, gradients across whole image, noise, grain, people, faces, realistic details, typography"""

BACKGROUND_PROMPT = """A deep indigo-purple dimensional space background, 56 glowing lightbulbs suspended in mid-air, arranged in an elegant spiral curve winding from bottom-left to upper-right. The 1 lightbulb at the very bottom-left is fully illuminated with warm golden glow (#F5C842) and bright halo. The remaining 55 lightbulbs are semi-transparent dim purple-blue (#4A4A8A) with subtle glow. Inside each lightbulb, faintly visible tiny symbols: question marks, gears, hearts, books, rockets, stars - each slightly different. Mysterious, warm, full of potential atmosphere. 3D rendered style, cinematic lighting, volumetric glow rays from the golden bulb. Dark cosmic void background with subtle indigo nebula mist. No text, no letters, no numbers, no watermarks. Rich depth of field, the golden bulb in sharp focus."""

BACKGROUND_NEGATIVE = """flat, cartoon, anime, text, letters, numbers, watermark, people, faces, harsh lighting, overexposed, cluttered, busy, messy, low quality, blurry"""

COVER_PROMPT = """Vertical 9:16 composition. Dark background gradient from deep blue (#0B0E28) at bottom to deep purple (#1A0A2E) at top. The bottom 1/3 of the frame: a black silhouette of a human head and shoulders in profile view, rising from the bottom edge, facing right. From the brain/crown area of the silhouette, 56 extremely thin golden light beams radiate outward and upward, spreading across the upper 2/3 of the frame like a luminous crown. Each beam terminates in a tiny glowing point of light. Only 1 point at the lower-left position is fully illuminated with warm golden glow (#F5C842) and soft halo. The other 55 points are semi-transparent and dim purple-blue. The upper 40% of the frame is clean dark space reserved for text overlay. Style: mysterious, sophisticated, cinematic. 3D render with minimal aesthetic. The light beams have subtle particle dust effects. No text, no letters, no numbers, no watermarks, no product hints. Pure conceptual - ideas radiating from the mind into reality."""

COVER_NEGATIVE = """flat, cartoon, anime, text, letters, numbers, watermark, people faces visible, skin details, realistic face, harsh lighting, cluttered, busy, messy, low quality, blurry, portrait, photograph"""

# ======================== 生成任务列表 ========================

TASKS = [
    {
        "name": "avatar",
        "file": "avatar.jpg",
        "size": "1k",  # 1:1 正方形
        "prompt": AVATAR_PROMPT,
        "negative": AVATAR_NEGATIVE,
    },
    {
        "name": "background",
        "file": "background.jpg",
        "size": "2k",  # 16:9 横版
        "prompt": BACKGROUND_PROMPT,
        "negative": BACKGROUND_NEGATIVE,
    },
    {
        "name": "cover",
        "file": "cover.jpg",
        "size": "2k",  # 9:16 竖版
        "prompt": COVER_PROMPT,
        "negative": COVER_NEGATIVE,
    },
]


def call_seedream(prompt: str, negative: str, size: str, max_retries: int = 3) -> str | None:
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "negative_prompt": negative,
        "size": size,
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
                print(f"  API 错误: {result['error']}")
                if attempt < max_retries - 1:
                    time.sleep((attempt + 1) * 5)
        except Exception as e:
            print(f"  请求异常 ({attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(5)
    return None


def download_image(url: str, filepath: Path) -> bool:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=60) as resp:
            filepath.write_bytes(resp.read())
        return True
    except Exception as e:
        print(f"  下载失败: {e}")
        return False


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"模型: {MODEL}")
    print(f"输出: {OUTPUT_DIR}")
    print(f"{'=' * 60}\n")

    for i, task in enumerate(TASKS):
        print(f"[{i + 1}/3] 生成 {task['name']} ({task['size']})...")
        print(f"  Prompt 长度: {len(task['prompt'])} 字符")

        url = call_seedream(task["prompt"], task["negative"], task["size"])
        if url:
            filepath = OUTPUT_DIR / task["file"]
            if download_image(url, filepath):
                size_kb = filepath.stat().st_size / 1024
                print(f"  ✅ 成功: {filepath} ({size_kb:.0f} KB)")
            else:
                print(f"  ❌ 下载失败")
        else:
            print(f"  ❌ API 调用失败")

        if i < len(TASKS) - 1:
            print("  等待 12 秒...")
            time.sleep(12)

    print(f"\n{'=' * 60}")
    print(f"输出目录: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
