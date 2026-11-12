import json, urllib.request, urllib.error, time

APPID = "2619766851"
TOKEN = "OCcbH0T2BRSDIJP-u5FFdJwn3-xa6AMd"
SPEAKER_ID = "S_bDk3p0g72"

def status():
    req = urllib.request.Request(
        "https://openspeech.bytedance.com/api/v1/mega_tts/status",
        data=json.dumps({"appid": APPID, "speaker_id": SPEAKER_ID}).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer;{TOKEN}",
            "Resource-Id": "volc.megatts.voiceclone",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"err": e.code, "body": e.read()[:500].decode(errors="replace")}

for i in range(30):
    r = status()
    print(f"[{i}] {r}")
    st = r.get("status")
    # 0 = 未激活, 1 = 训练中, 2 = 训练成功, 3 = 训练失败, 4 = 激活成功
    if st in (2, 4):
        print("✅ Ready")
        break
    if st == 3:
        print("❌ Failed"); break
    time.sleep(5)
