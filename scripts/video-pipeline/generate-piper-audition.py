
import json
import subprocess
from pathlib import Path

ROOT = Path(r'H:\ccwork\MBTI-PRO')
PY = ROOT / '.venv-chattts' / 'Scripts' / 'python.exe'
OUT_DIR = ROOT / 'content-marketing' / 'review-html' / 'voice-audition-piper-2026-07-02'
MODEL_ROOT = ROOT / 'content-marketing' / 'assets' / 'tts-models' / 'sherpa-onnx'
BGM_PATH = ROOT / 'video' / 'BGM.mp3'
FFMPEG = ROOT / 'scripts' / 'video-pipeline' / 'node_modules' / '@ffmpeg-installer' / 'win32-x64' / 'ffmpeg.exe'
if not FFMPEG.exists():
    FFMPEG = Path('ffmpeg')
SAMPLE_TEXT = '\u6709\u4e00\u79cd ENFP\uff0c\u770b\u8d77\u6765\u6bcf\u5929\u90fd\u5f88\u5feb\u4e50\u3002\u5176\u5b9e\u4ed6\u4e0d\u662f\u6ca1\u6709\u5d29\u6e83\u8fc7\uff0c\u4ed6\u53ea\u662f\u592a\u4e60\u60ef\u628a\u6c14\u6c1b\u6491\u8d77\u6765\u3002\u6240\u4ee5\u4f60\u4f1a\u53d1\u73b0\uff0c\u4ed6\u7a81\u7136\u5b89\u9759\u7684\u65f6\u5019\uff0c\u5f80\u5f80\u6bd4\u4ed6\u5435\u5435\u95f9\u95f9\u66f4\u8ba9\u4eba\u5fc3\u75bc\u3002'
OUT_DIR.mkdir(parents=True, exist_ok=True)

voices = [
    {'id':'piper_xiaoya_len095_noise050','label':'Piper 小雅｜自然偏快','dir':'vits-piper-zh_CN-xiao_ya-medium-int8','length':0.95,'noise':0.50,'noise_w':0.55},
    {'id':'piper_xiaoya_len090_noise045','label':'Piper 小雅｜短句利落','dir':'vits-piper-zh_CN-xiao_ya-medium-int8','length':0.90,'noise':0.45,'noise_w':0.50},
    {'id':'piper_xiaoya_len100_noise060','label':'Piper 小雅｜稳定柔和','dir':'vits-piper-zh_CN-xiao_ya-medium-int8','length':1.00,'noise':0.60,'noise_w':0.65},
    {'id':'piper_xiaoya_len085_noise055','label':'Piper 小雅｜口播提速','dir':'vits-piper-zh_CN-xiao_ya-medium-int8','length':0.85,'noise':0.55,'noise_w':0.60},
    {'id':'piper_chaowen_len095_noise050','label':'Piper 超文｜沉稳偏快','dir':'vits-piper-zh_CN-chaowen-medium-int8','length':0.95,'noise':0.50,'noise_w':0.55},
    {'id':'piper_chaowen_len090_noise045','label':'Piper 超文｜短句利落','dir':'vits-piper-zh_CN-chaowen-medium-int8','length':0.90,'noise':0.45,'noise_w':0.50},
    {'id':'piper_chaowen_len100_noise060','label':'Piper 超文｜稳定沉稳','dir':'vits-piper-zh_CN-chaowen-medium-int8','length':1.00,'noise':0.60,'noise_w':0.65},
    {'id':'piper_chaowen_len085_noise055','label':'Piper 超文｜口播提速','dir':'vits-piper-zh_CN-chaowen-medium-int8','length':0.85,'noise':0.55,'noise_w':0.60},
]

cards=[]
failures=[]
input_txt = OUT_DIR / 'sample.txt'
input_txt.write_text(SAMPLE_TEXT, encoding='utf-8')
for voice in voices:
    sample_id = voice['id']
    model_dir = MODEL_ROOT / voice['dir']
    onnx = next(model_dir.glob('*.onnx'))
    cfg = next(model_dir.glob('*.onnx.json'))
    raw_wav = OUT_DIR / f'{sample_id}_raw.wav'
    raw_mp3 = OUT_DIR / f'{sample_id}_raw.mp3'
    bgm_mp3 = OUT_DIR / f'{sample_id}_bgm.mp3'
    print('[piper]', sample_id)
    try:
        if not raw_wav.exists():
            subprocess.run([
                str(PY), '-m', 'piper', '-m', str(onnx), '-c', str(cfg),
                '--data-dir', str(model_dir), '-i', str(input_txt), '-f', str(raw_wav),
                '--length-scale', str(voice['length']), '--noise-scale', str(voice['noise']), '--noise-w-scale', str(voice['noise_w']),
            ], check=True)
        if not raw_mp3.exists():
            subprocess.run([str(FFMPEG), '-y', '-hide_banner', '-loglevel', 'error', '-i', str(raw_wav), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libmp3lame', '-b:a', '192k', str(raw_mp3)], check=True)
        if not bgm_mp3.exists():
            flt='[0:a]volume=1.35,aresample=44100[voice];[1:a]volume=0.13,atrim=0:24,asetpts=N/SR/TB,afade=t=out:st=22:d=2[bgm];[voice][bgm]amix=inputs=2:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]'
            subprocess.run([str(FFMPEG), '-y', '-hide_banner', '-loglevel', 'error', '-i', str(raw_wav), '-stream_loop', '-1', '-i', str(BGM_PATH), '-filter_complex', flt, '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '192k', str(bgm_mp3)], check=True)
        cards.append(f"""<article class='card'><h2>{voice['label']}<small> Piper local</small></h2><p>本地 Piper 中文模型，和 Edge/Google/Windows SAPI 完全不同。length={voice['length']} noise={voice['noise']} noise_w={voice['noise_w']}</p><div class='audio-row'><span>纯配音</span><audio controls src='{sample_id}_raw.mp3'></audio></div><div class='audio-row'><span>配音+BGM</span><audio controls src='{sample_id}_bgm.mp3'></audio></div><p class='id'>{sample_id}</p></article>""")
    except Exception as exc:
        failures.append({'id':sample_id,'error':repr(exc),'voice':voice})
        print('[piper][fail]', sample_id, repr(exc))

html=f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><title>Piper 中文音色试听</title><style>body{{margin:0;background:#f7efe2;color:#2e281f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}}.wrap{{max-width:1180px;margin:0 auto;padding:34px}}.lead{{font-size:18px;line-height:1.7;color:#635649}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(500px,1fr));gap:16px}}.card{{background:#fffaf0;border:1px solid rgba(89,70,45,.16);border-radius:24px;padding:18px;box-shadow:0 14px 40px rgba(102,76,38,.10)}}h1{{font-size:34px;margin:0 0 10px}}h2{{font-size:22px;margin:0 0 8px}}small{{font-size:13px;color:#937f68;margin-left:8px}}.audio-row{{display:grid;grid-template-columns:86px 1fr;align-items:center;gap:12px;margin:10px 0}}.audio-row span{{font-weight:800;color:#7a5d35}}audio{{width:100%}}.id{{font-size:12px;color:#9a8a77}}.sample{{padding:14px 16px;border-radius:18px;background:#fff5df;border:1px solid rgba(89,70,45,.14);line-height:1.7}}.fail{{white-space:pre-wrap;color:#9a4638}}</style></head><body><main class='wrap'><h1>Piper 中文音色试听</h1><p class='lead'>这是新一批本地 Piper 中文音色，用不同语速和噪声参数模拟更自然的口播节奏。</p><p class='sample'>试听文案：{SAMPLE_TEXT}</p><section class='grid'>{''.join(cards)}</section>{'<pre class="fail">'+json.dumps(failures,ensure_ascii=False,indent=2)+'</pre>' if failures else ''}</main></body></html>"""
(OUT_DIR/'index.html').write_text(html,encoding='utf-8')
(OUT_DIR/'samples.json').write_text(json.dumps({'voices':voices,'failures':failures},ensure_ascii=False,indent=2),encoding='utf-8')
print('[piper] page', OUT_DIR/'index.html')
