"""Generate TTS audition MP3s for MBTI-PRO liu-yu-xi voice replacement."""
import os, sys, json, uuid, base64, pathlib, urllib.request

APPID = "2619766851"
TOKEN = "OCcbH0T2BRSDIJP-u5FFdJwn3-xa6AMd"
CLUSTER = "volcano_tts"

VOICES = [
    ("zh_female_gaolengyujie_moon_bigtts", "高冷御姐（成熟知性 ★★★★★）"),
    ("zh_female_kailangjiejie_moon_bigtts", "开朗姐姐（姐姐系 ★★★★）"),
    ("zh_female_wanwanxiaohe_moon_bigtts", "湾湾小何（温柔叙述 ★★★★）"),
    ("zh_female_shuangkuaisisi_moon_bigtts", "爽快思思（对照）"),
    ("BV700_V2_streaming", "通用女声V2（BV700 V2）"),
    ("BV407_streaming", "明快解说女声（BV407）"),
]

TEXT = (
    "ENTP最上头的，不是赢一场争论，而是有人真的接住了他的脑洞。"
    "你可能见过这种人：聚会刚开始，他还像个普通人；"
    "只要有人丢出一个观点，他眼睛马上亮了。不是为了抬杠，"
    "也不是非要证明你错，他只是太想知道，这个想法还能不能再往前推一步。"
)

OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

def synth(voice, out_path):
    payload = {
        "app": {"appid": APPID, "token": "access_token", "cluster": CLUSTER},
        "user": {"uid": "mbti-pro"},
        "audio": {
            "voice_type": voice, "encoding": "mp3",
            "speed_ratio": 1.0, "volume_ratio": 1.0, "pitch_ratio": 1.0,
        },
        "request": {"reqid": str(uuid.uuid4()), "text": TEXT, "operation": "query"},
    }
    req = urllib.request.Request(
        "https://openspeech.bytedance.com/api/v1/tts",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer;{TOKEN}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read())
    if body.get("code") != 3000:
        print(f"  ! {voice}: {body}")
        return False
    out_path.write_bytes(base64.b64decode(body["data"]))
    print(f"  ✓ {voice}: {out_path.stat().st_size} bytes")
    return True

for v, label in VOICES:
    print(f"[{label}]")
    synth(v, OUT / f"{v}.mp3")

items = "".join(
    f'<div class="v"><h3>{i+1}. {label}</h3>'
    f'<code>{v}</code>'
    f'<audio controls preload="none" src="{v}.mp3"></audio></div>'
    for i, (v, label) in enumerate(VOICES)
)
html = f"""<!doctype html><html lang=zh><meta charset=utf-8>
<title>火山Doubao TTS 音色试听 · 刘语熙候选</title>
<style>
body{{font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;line-height:1.7;color:#222}}
h1{{border-bottom:2px solid #333;padding-bottom:.4rem}}
.v{{background:#f7f7fb;padding:1rem 1.2rem;margin:1rem 0;border-radius:12px;border:1px solid #dcdde8}}
.v h3{{margin:0 0 .3rem;color:#333}}
code{{background:#e7e7f2;padding:2px 8px;border-radius:4px;font-size:.85em;color:#5b3ba8}}
audio{{width:100%;margin-top:.6rem}}
.note{{background:#fff8e1;border-left:4px solid #f5a623;padding:.8rem 1rem;border-radius:6px;margin:1rem 0}}
</style>
<h1>🎙️ 火山 Doubao TTS · 刘语熙替代音色</h1>
<div class=note>
<b>说明：</b> 试用版仅开通部分音色，"知性女声/温柔淑女/京腔女声"等未开通，
以下 6 个为已可用候选，请挑选一个最像刘语熙（成熟知性女声）的告诉我。<br>
文案：<em>{TEXT}</em>
</div>
{items}
"""
(OUT / "index.html").write_text(html, encoding="utf-8")
print(f"\n✅ HTML: {OUT / 'index.html'}")
