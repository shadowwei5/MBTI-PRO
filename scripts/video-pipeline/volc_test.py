import json, uuid, urllib.request, urllib.error, sys
APPID = "2619766851"
ACCESS_TOKEN = "OCcbH0T2BRSDIJP-u5FFdJwn3-xa6AMd"
CLUSTER = "volcano_tts"
payload = {
    "app": {"appid": APPID, "token": "access_token", "cluster": CLUSTER},
    "user": {"uid": "test"},
    "audio": {"voice_type": "zh_female_zhixingnvsheng_moon_bigtts", "encoding": "mp3"},
    "request": {"reqid": str(uuid.uuid4()), "text": "你好，这是测试。", "operation": "query"},
}
for auth in [f"Bearer;{ACCESS_TOKEN}", f"Bearer {ACCESS_TOKEN}", ACCESS_TOKEN]:
    print(f"--- Auth: {auth[:30]}...")
    req = urllib.request.Request(
        "https://openspeech.bytedance.com/api/v1/tts",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": auth},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            print("OK", resp.status, resp.read()[:200])
    except urllib.error.HTTPError as e:
        print("ERR", e.code, e.read()[:400])
    except Exception as e:
        print("EXC", type(e).__name__, e)
