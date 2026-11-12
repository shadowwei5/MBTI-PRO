
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
import sherpa_onnx

ROOT = Path(r'H:\ccwork\MBTI-PRO')
OUT_DIR = ROOT / 'content-marketing' / 'review-html' / 'voice-audition-sherpa-2026-07-02'
MODEL_ROOT = ROOT / 'content-marketing' / 'assets' / 'tts-models' / 'sherpa-onnx'
BGM_PATH = ROOT / 'video' / 'BGM.mp3'
FFMPEG = ROOT / 'scripts' / 'video-pipeline' / 'node_modules' / '@ffmpeg-installer' / 'win32-x64' / 'ffmpeg.exe'
if not FFMPEG.exists():
    FFMPEG = Path('ffmpeg')
SAMPLE_TEXT = '\u6709\u4e00\u79cd ENFP\uff0c\u770b\u8d77\u6765\u6bcf\u5929\u90fd\u5f88\u5feb\u4e50\u3002\u5176\u5b9e\u4ed6\u4e0d\u662f\u6ca1\u6709\u5d29\u6e83\u8fc7\uff0c\u4ed6\u53ea\u662f\u592a\u4e60\u60ef\u628a\u6c14\u6c1b\u6491\u8d77\u6765\u3002\u6240\u4ee5\u4f60\u4f1a\u53d1\u73b0\uff0c\u4ed6\u7a81\u7136\u5b89\u9759\u7684\u65f6\u5019\uff0c\u5f80\u5f80\u6bd4\u4ed6\u5435\u5435\u95f9\u95f9\u66f4\u8ba9\u4eba\u5fc3\u75bc\u3002'
OUT_DIR.mkdir(parents=True, exist_ok=True)

voices = [
    {'id': 'sherpa_xiaoya_095', 'label': '小雅｜温柔女声 0.95x', 'dir': 'vits-piper-zh_CN-xiao_ya-medium-int8', 'speed': 0.95, 'sid': 0},
    {'id': 'sherpa_xiaoya_100', 'label': '小雅｜温柔女声 1.00x', 'dir': 'vits-piper-zh_CN-xiao_ya-medium-int8', 'speed': 1.00, 'sid': 0},
    {'id': 'sherpa_xiaoya_108', 'label': '小雅｜温柔女声 1.08x', 'dir': 'vits-piper-zh_CN-xiao_ya-medium-int8', 'speed': 1.08, 'sid': 0},
    {'id': 'sherpa_chaowen_095', 'label': '超文｜沉稳男声 0.95x', 'dir': 'vits-piper-zh_CN-chaowen-medium-int8', 'speed': 0.95, 'sid': 0},
    {'id': 'sherpa_chaowen_100', 'label': '超文｜沉稳男声 1.00x', 'dir': 'vits-piper-zh_CN-chaowen-medium-int8', 'speed': 1.00, 'sid': 0},
    {'id': 'sherpa_chaowen_108', 'label': '超文｜沉稳男声 1.08x', 'dir': 'vits-piper-zh_CN-chaowen-medium-int8', 'speed': 1.08, 'sid': 0},
]

def make_tts(model_dir: Path):
    onnx_files = list(model_dir.glob('*.onnx'))
    if not onnx_files:
        raise FileNotFoundError(f'No onnx in {model_dir}')
    model = onnx_files[0]
    tokens = model_dir / 'tokens.txt'
    lexicon = model_dir / 'lexicon.txt'
    data_dir = model_dir
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=str(model),
                lexicon=str(lexicon),
                tokens=str(tokens),
                data_dir=str(data_dir),
            ),
            num_threads=2,
            debug=False,
            provider='cpu',
        ),
        max_num_sentences=1,
    )
    if not cfg.validate():
        raise RuntimeError(f'Invalid sherpa config: {model_dir}')
    return sherpa_onnx.OfflineTts(cfg)

cards = []
failures = []
tts_cache = {}
for voice in voices:
    sample_id = voice['id']
    raw_wav = OUT_DIR / f'{sample_id}_raw.wav'
    raw_mp3 = OUT_DIR / f'{sample_id}_raw.mp3'
    bgm_mp3 = OUT_DIR / f'{sample_id}_bgm.mp3'
    print('[sherpa]', sample_id)
    try:
        model_dir = MODEL_ROOT / voice['dir']
        if voice['dir'] not in tts_cache:
            tts_cache[voice['dir']] = make_tts(model_dir)
        if not raw_wav.exists():
            audio = tts_cache[voice['dir']].generate(SAMPLE_TEXT, sid=voice['sid'], speed=voice['speed'])
            samples = np.asarray(audio.samples, dtype=np.float32)
            peak = float(np.max(np.abs(samples))) if samples.size else 1.0
            if peak > 0:
                samples = samples / max(1.0, peak)
            wavfile.write(str(raw_wav), audio.sample_rate, (samples * 32767).astype(np.int16))
        if not raw_mp3.exists():
            subprocess.run([str(FFMPEG), '-y', '-hide_banner', '-loglevel', 'error', '-i', str(raw_wav), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libmp3lame', '-b:a', '192k', str(raw_mp3)], check=True)
        if not bgm_mp3.exists():
            flt = '[0:a]volume=1.35,aresample=44100[voice];[1:a]volume=0.13,atrim=0:24,asetpts=N/SR/TB,afade=t=out:st=22:d=2[bgm];[voice][bgm]amix=inputs=2:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]'
            subprocess.run([str(FFMPEG), '-y', '-hide_banner', '-loglevel', 'error', '-i', str(raw_wav), '-stream_loop', '-1', '-i', str(BGM_PATH), '-filter_complex', flt, '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '192k', str(bgm_mp3)], check=True)
        cards.append(f"""<article class='card'><h2>{voice['label']}<small> sherpa-onnx / Piper</small></h2><p>离线中文 TTS 模型，不属于 Edge / Google / Windows SAPI。优点是稳定、可批量生成；缺点是可能仍有合成感。</p><div class='audio-row'><span>纯配音</span><audio controls src='{sample_id}_raw.mp3'></audio></div><div class='audio-row'><span>配音+BGM</span><audio controls src='{sample_id}_bgm.mp3'></audio></div><p class='id'>{sample_id}</p></article>""")
    except Exception as exc:
        failures.append({'id': sample_id, 'error': repr(exc), 'voice': voice})
        print('[sherpa][fail]', sample_id, repr(exc))

html = f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><title>Sherpa-ONNX 中文音色试听</title><style>body{{margin:0;background:#f7efe2;color:#2e281f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}}.wrap{{max-width:1180px;margin:0 auto;padding:34px}}.lead{{font-size:18px;line-height:1.7;color:#635649}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(500px,1fr));gap:16px}}.card{{background:#fffaf0;border:1px solid rgba(89,70,45,.16);border-radius:24px;padding:18px;box-shadow:0 14px 40px rgba(102,76,38,.10)}}h1{{font-size:34px;margin:0 0 10px}}h2{{font-size:22px;margin:0 0 8px}}small{{font-size:13px;color:#937f68;margin-left:8px}}.audio-row{{display:grid;grid-template-columns:86px 1fr;align-items:center;gap:12px;margin:10px 0}}.audio-row span{{font-weight:800;color:#7a5d35}}audio{{width:100%}}.id{{font-size:12px;color:#9a8a77}}.sample{{padding:14px 16px;border-radius:18px;background:#fff5df;border:1px solid rgba(89,70,45,.14);line-height:1.7}}.fail{{white-space:pre-wrap;color:#9a4638}}</style></head><body><main class='wrap'><h1>Sherpa-ONNX 中文音色试听</h1><p class='lead'>这是另一批新来源：本地离线 Piper 中文男女声。不是你已经否定的 Edge/Google/SAPI。</p><p class='sample'>试听文案：{SAMPLE_TEXT}</p><section class='grid'>{''.join(cards)}</section>{'<pre class="fail">'+json.dumps(failures, ensure_ascii=False, indent=2)+'</pre>' if failures else ''}</main></body></html>"""
(OUT_DIR / 'index.html').write_text(html, encoding='utf-8')
(OUT_DIR / 'samples.json').write_text(json.dumps({'voices': voices, 'failures': failures}, ensure_ascii=False, indent=2), encoding='utf-8')
print('[sherpa] page', OUT_DIR / 'index.html')
