import json, uuid, urllib.request, urllib.error
APPID = "2619766851"
TOKEN = "OCcbH0T2BRSDIJP-u5FFdJwn3-xa6AMd"

def try_voice(voice, cluster="volcano_tts"):
    payload = {
        "app": {"appid": APPID, "token": "access_token", "cluster": cluster},
        "user": {"uid": "test"},
        "audio": {"voice_type": voice, "encoding": "mp3"},
        "request": {"reqid": str(uuid.uuid4()), "text": "测试", "operation": "query"},
    }
    req = urllib.request.Request(
        "https://openspeech.bytedance.com/api/v1/tts",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer;{TOKEN}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            if data.get('code') == 3000:
                return "OK"
    except urllib.error.HTTPError:
        return "NO"
    return "?"

# 尝试所有可能的女声 voice_type
candidates = [
    # 通用大模型音色（不带_bigtts可能可用）
    "BV700_streaming",  # 通用女声
    "BV705_streaming",
    "BV001_streaming",  # 通用女声2
    "BV002_streaming",
    "BV051_streaming",
    "BV104_streaming",  # 灿灿
    "BV406_streaming",  # 明快解说
    "BV407_streaming",
    "BV408_streaming",
    "BV411_streaming",
    "BV020_streaming",  # 甜美女声
    "BV021_streaming",
    "BV501_streaming",
    "BV502_streaming",
    "BV503_streaming",
    "BV504_streaming",
    "BV505_streaming",  # 说唱小哥/小姐
    "BV700_V2_streaming",
    "BV701_streaming",
    "BV702_streaming",
    # moon_bigtts 系列（试用版部分）
    "zh_female_shuangkuaisisi_moon_bigtts",
    "zh_female_wanwanxiaohe_moon_bigtts",
    "zh_female_qingxinnvsheng_moon_bigtts",  # 清新女声
    "zh_female_gaolengyujie_moon_bigtts",  # 高冷御姐
    "zh_female_tianxinxiaomei_moon_bigtts",  # 甜心小美
    "zh_female_kailangjiejie_moon_bigtts",  # 开朗姐姐
    "zh_female_qiaopinvsheng_moon_bigtts",  # 俏皮女声
    "zh_female_mengyatou_moon_bigtts",  # 萌丫头
    "zh_female_shuangkuaisisi_emo_v2_mars_bigtts",
    "zh_female_qingxinjiuku_mars_bigtts",  # 清新久酷
    # bigtts 无 moon 后缀
    "zh_female_zhixing_bigtts",
    "zh_female_zhixingnvsheng_bigtts",
    "zh_female_wenroushunv_bigtts",
]
ok = []
no = []
for v in candidates:
    r = try_voice(v)
    print(f"{r}  {v}")
    (ok if r == "OK" else no).append(v)
print("\n=== OK voices ===")
for v in ok: print(v)
