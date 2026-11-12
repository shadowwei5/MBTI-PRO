import json, uuid, urllib.request, urllib.error
APPID = "2619766851"
TOKEN = "OCcbH0T2BRSDIJP-u5FFdJwn3-xa6AMd"

def try_voice(voice, cluster="volcano_tts"):
    payload = {
        "app": {"appid": APPID, "token": "access_token", "cluster": cluster},
        "user": {"uid": "test"},
        "audio": {"voice_type": voice, "encoding": "mp3"},
        "request": {"reqid": str(uuid.uuid4()), "text": "你好，这是测试。", "operation": "query"},
    }
    req = urllib.request.Request(
        "https://openspeech.bytedance.com/api/v1/tts",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer;{TOKEN}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            print(f"[{voice}] OK code={data.get('code')} size={len(data.get('data',''))}")
    except urllib.error.HTTPError as e:
        body = e.read()[:200].decode(errors="replace")
        print(f"[{voice}] {e.code} {body}")

# 试听常见免费试用音色
for v in [
    "zh_female_shuangkuaisisi_moon_bigtts",
    "zh_female_wanwanxiaohe_moon_bigtts",
    "zh_male_wennuanahu_moon_bigtts",
    "BV700_streaming",
    "BV001_streaming",
    "zh_female_zhixingnvsheng_moon_bigtts",
    "zh_female_wenroushunv_moon_bigtts",
    "zh_female_jingqiangnvsheng_bigtts",
]:
    try_voice(v)
