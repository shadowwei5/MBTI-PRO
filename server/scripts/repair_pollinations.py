"""使用 Pollinations.AI 免费API重新生成被损坏的图片"""
import sys
import urllib.request
import time
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_images import ROLE_ARCHETYPES, COLOR_GROUPS, GROUP_COLORS

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "generated_images"
API_BASE = "https://image.pollinations.ai/prompt/"

DAMAGED = ["EBCJ", "ENFJ", "INFJ"]

STYLE_PROMPT = (
    "low poly vector illustration, flat 2D cartoon style, "
    "pure solid geometric color blocks, no gradients no shadows, "
    "clean minimalist, high quality vector art, "
    "beige cream white solid background, no border no decoration, "
    "ABSOLUTELY NO text letters numbers characters words labels signatures watermarks typography"
)


def build_prompt(code: str) -> str:
    role = ROLE_ARCHETYPES.get(code)
    group = COLOR_GROUPS.get(code, "unknown")
    color_hex, color_en = GROUP_COLORS.get(group, ("#808080", "gray"))
    title, char_desc = role

    full = (
        f"{STYLE_PROMPT}. "
        f"The character is {char_desc}. "
        f"Clothing and accessories use {group} tones ({color_hex}, {color_en}). "
    )
    return full


def generate(prompt: str, code: str) -> bool:
    url = f"{API_BASE}{urllib.request.quote(prompt)}?width=2048&height=2048&nologo=true"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()
            if len(data) < 1000:
                print(f"    attempt {attempt+1}: too small ({len(data)}B), retry...")
                time.sleep(5)
                continue
            out = OUTPUT_DIR / f"{code}.jpg"
            out.write_bytes(data)
            print(f"    OK {len(data)/1024:.0f}KB")
            return True
        except Exception as e:
            print(f"    attempt {attempt+1}: {e}")
            time.sleep(5)
    return False


def main():
    print(f"Regenerating {len(DAMAGED)} damaged images via Pollinations.AI (free)")
    print(f"{'='*50}\n")

    ok = 0
    for code in DAMAGED:
        print(f"{code}:", end=" ", flush=True)
        prompt = build_prompt(code)
        if generate(prompt, code):
            ok += 1
        else:
            print("   FAIL")
        if code != DAMAGED[-1]:
            time.sleep(3)

    print(f"\nOK: {ok}/{len(DAMAGED)}")
    if ok < len(DAMAGED):
        print("Failed images may need manual regeneration.")
    print("\nNote: Style may differ from original Seedream-generated images.")
    print("For consistent style, recharge Volcengine & run regenerate_text_images.py")


if __name__ == "__main__":
    main()
