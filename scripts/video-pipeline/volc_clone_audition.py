"""Synthesize audition text using cloned voice S_bDk3p0g72 (ICL 2.0)."""
import base64, json, sys, uuid, urllib.request, urllib.error, pathlib

APPID = "2619766851"
TOKEN = "OCcbH0T2BRSDIJP-u5FFdJwn3-xa6AMd"
CLUSTER = "volcano_icl"   # ICL 复刻音色专用 cluster
SPEAKER_ID = "S_bDk3p0g72"

OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

TEXTS = {
    "01_short": "ENTP最上头的，不是赢一场争论，而是有人真的接住了他的脑洞。",
    "02_middle": (
        "ENTP最上头的，不是赢一场争论，而是有人真的接住了他的脑洞。"
        "你可能见过这种人：聚会刚开始，他还像个普通人；"
        "只要有人丢出一个观点，他眼睛马上亮了。"
    ),
    "03_full": (
        "ENTP最上头的，不是赢一场争论，而是有人真的接住了他的脑洞。"
        "你可能见过这种人：聚会刚开始，他还像个普通人；"
        "只要有人丢出一个观点，他眼睛马上亮了。"
        "不是为了抬杠，也不是非要证明你错，"
        "他只是太想知道，这个想法还能不能再往前推一步。"
        "别人觉得他跳脱，他自己却觉得，终于有点意思了。"
    ),
}

def synth(text, out_path, cluster=CLUSTER):
    payload = {
        "app": {"appid": APPID, "token": "access_token", "cluster": cluster},
        "user": {"uid": "mbti-pro"},
        "audio": {
            "voice_type": SPEAKER_ID,
            "encoding": "mp3",
            "speed_ratio": 1.0,
        },
        "request": {
            "reqid": str(uuid.uuid4()),
            "text": text,
            "operation": "query",
        },
    }
    req = urllib.request.Request(
        "https://openspeech.bytedance.com/api/v1/tts",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer;{TOKEN}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ! HTTP {e.code}: {e.read()[:400].decode(errors='replace')}")
        return False
    if body.get("code") != 3000:
        print(f"  ! code={body.get('code')} msg={body.get('message')}")
        return False
    out_path.write_bytes(base64.b64decode(body["data"]))
    print(f"  ✓ {out_path.name}: {out_path.stat().st_size} bytes")
    return True

for name, text in TEXTS.items():
    print(f"[{name}]")
    synth(text, OUT / f"{name}.mp3")

# HTML
items = "".join(
    f'<div class="v"><h3>{name}</h3><p>{text}</p>'
    f'<audio controls preload="none" src="{name}.mp3"></audio></div>'
    for name, text in TEXTS.items()
)
html = f"""<!doctype html><html lang=zh><meta charset=utf-8>
<title>刘语熙声音复刻试听（火山 ICL 2.0）</title>
<style>
body{{font-family:system-ui,'PingFang SC','Microsoft YaHei';max-width:820px;margin:2rem auto;padding:0 1rem;line-height:1.7;color:#222}}
h1{{border-bottom:2px solid #333;padding-bottom:.4rem}}
.v{{background:#f7f7fb;padding:1rem 1.2rem;margin:1rem 0;border-radius:12px;border:1px solid #dcdde8}}
audio{{width:100%;margin-top:.6rem}}
.official{{background:#fff8e1;border-left:4px solid #f5a623;padding:1rem;border-radius:6px;margin:1rem 0}}
</style>
<h1>🎙️ 刘语熙 · 声音复刻 2.0 试听</h1>
<p>speaker_id: <code>{SPEAKER_ID}</code> · icl_speaker_id: <code>ICL_6a47b9a595b03fb2</code></p>
<div class=official>
<b>官方训练完成 demo（火山生成的，用于快速验证音质）：</b>
<audio controls preload="none" src="_official_demo.mp3"></audio>
</div>
<h2>本项目实际文案合成</h2>
{items}
"""
(OUT / "index.html").write_text(html, encoding="utf-8")
print(f"\n✅ HTML: {OUT / 'index.html'}")
