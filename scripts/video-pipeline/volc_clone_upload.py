"""
Volc Doubao Voice Clone 2.0 - upload sample and train.
Docs: https://www.volcengine.com/docs/6561/1257544
"""
import base64, json, sys, urllib.request, urllib.error, pathlib

APPID = "2619766851"
TOKEN = "OCcbH0T2BRSDIJP-u5FFdJwn3-xa6AMd"
SPEAKER_ID = "S_bDk3p0g72"
SAMPLE = pathlib.Path(r"H:\ccwork\MBTI-PRO\video\刘语熙配音音色.mp3")

def call(url, payload):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer;{TOKEN}",
            "Resource-Id": "volc.megatts.voiceclone",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:500].decode(errors="replace")

audio_b64 = base64.b64encode(SAMPLE.read_bytes()).decode()
print(f"sample: {SAMPLE.name} ({SAMPLE.stat().st_size} bytes)")

# Upload
payload = {
    "appid": APPID,
    "speaker_id": SPEAKER_ID,
    "audios": [{"audio_bytes": audio_b64, "audio_format": "mp3"}],
    "source": 2,
    "language": 0,     # 0=中文
    "model_type": 1,   # 1 = ICL 2.0
}
code, resp = call("https://openspeech.bytedance.com/api/v1/mega_tts/audio/upload", payload)
print("upload:", code, resp)
