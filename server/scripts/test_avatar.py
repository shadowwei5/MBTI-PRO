"""测试头像生成的尺寸参数"""
import json, urllib.request, urllib.error, sys
from pathlib import Path
from config import IMAGE_API_URL, VOLCENGINE_IMAGE_MODEL, volcengine_headers

prompt = """minimalist flat vector logo design, clean geometric shapes, a stylized letter S that morphs into a glowing lightbulb filament, the lightbulb outline simultaneously forms a half-open treasure chest. Color palette: deep purple (#4A0E5C) transitioning to warm gold (#F5C842). Pure dark background (#1A1A2E). Flat design, crisp edges. NO text NO letters NO numbers."""

negative = """photorealistic, 3D render, text, letters, numbers, watermark, people, faces"""

OUTPUT = Path("H:/ccwork/MBTI-PRO/server/generated_images/brand_assets")

for size in ["1024x1024", "2k"]:
    payload = {
        "model": VOLCENGINE_IMAGE_MODEL,
        "prompt": prompt,
        "negative_prompt": negative,
        "size": size,
        "response_format": "url",
        "watermark": False,
    }
    data = json.dumps(payload).encode("utf-8")
    headers = volcengine_headers()
    req = urllib.request.Request(IMAGE_API_URL, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if "data" in result and len(result["data"]) > 0:
                url = result["data"][0]["url"]
                img_req = urllib.request.Request(url)
                with urllib.request.urlopen(img_req, timeout=30) as img_resp:
                    out = OUTPUT / f"avatar.jpg"
                    out.write_bytes(img_resp.read())
                    print(f"OK size={size} -> {out} ({out.stat().st_size/1024:.0f}KB)")
                    sys.exit(0)
            else:
                print(f"FAIL size={size}: {result}")
    except urllib.error.HTTPError as e:
        print(f"FAIL size={size}: HTTP {e.code} - {e.read().decode()[:300]}")
    except Exception as e:
        print(f"FAIL size={size}: {e}")
