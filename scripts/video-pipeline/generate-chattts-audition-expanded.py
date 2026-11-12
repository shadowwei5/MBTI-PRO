
import json
import subprocess
from pathlib import Path

OUT_DIR = Path(r'H:\ccwork\MBTI-PRO\content-marketing\review-html\voice-audition-chattts-expanded-2026-07-02')
BGM_PATH = Path(r'H:\ccwork\MBTI-PRO\video\BGM.mp3')
FFMPEG = Path(r'H:\ccwork\MBTI-PRO\scripts\video-pipeline\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe')
if not FFMPEG.exists():
    FFMPEG = 'ffmpeg'
SAMPLE_TEXT = '\u6709\u4e00\u79cd ENFP\uff0c\u770b\u8d77\u6765\u6bcf\u5929\u90fd\u5f88\u5feb\u4e50\u3002\u5176\u5b9e\u4ed6\u4e0d\u662f\u6ca1\u6709\u5d29\u6e83\u8fc7\uff0c\u4ed6\u53ea\u662f\u592a\u4e60\u60ef\u628a\u6c14\u6c1b\u6491\u8d77\u6765\u3002\u6240\u4ee5\u4f60\u4f1a\u53d1\u73b0\uff0c\u4ed6\u7a81\u7136\u5b89\u9759\u7684\u65f6\u5019\uff0c\u5f80\u5f80\u6bd4\u4ed6\u5435\u5435\u95f9\u95f9\u66f4\u8ba9\u4eba\u5fc3\u75bc\u3002'
OUT_DIR.mkdir(parents=True, exist_ok=True)

import numpy as np
import ChatTTS
import torch
from scipy.io import wavfile

print('[chattts-expanded] loading model...')
chat = ChatTTS.Chat()
chat.load(source='huggingface', compile=False)

configs = []
for index in range(20):
    configs.append({
        'index': index,
        'seed': 2026070200 + index,
        'temperature': [0.20, 0.25, 0.30, 0.35][index % 4],
        'top_P': [0.65, 0.70, 0.75, 0.80][index % 4],
        'top_K': [15, 20, 25, 30][index % 4],
        'prompt': ['[oral_2][laugh_0][break_4]', '[oral_2][laugh_0][break_5]', '[oral_1][laugh_0][break_4]', '[oral_2][laugh_1][break_4]'][index % 4],
    })

cards = []
failures = []
for cfg in configs:
    index = cfg['index']
    sample_id = f'chattts_plus_{index:02d}'
    wav_path = OUT_DIR / f'{sample_id}_raw.wav'
    raw_mp3_path = OUT_DIR / f'{sample_id}_raw.mp3'
    bgm_mp3_path = OUT_DIR / f'{sample_id}_bgm.mp3'
    print(f'[chattts-expanded] {sample_id}')
    try:
        if not wav_path.exists():
            torch.manual_seed(cfg['seed'])
            rand_spk = chat.sample_random_speaker()
            params_infer_code = ChatTTS.Chat.InferCodeParams(
                spk_emb=rand_spk,
                temperature=cfg['temperature'],
                top_P=cfg['top_P'],
                top_K=cfg['top_K'],
                show_tqdm=False,
            )
            params_refine_text = ChatTTS.Chat.RefineTextParams(
                prompt=cfg['prompt'],
                show_tqdm=False,
            )
            wavs = chat.infer(
                [SAMPLE_TEXT],
                params_refine_text=params_refine_text,
                params_infer_code=params_infer_code,
                use_decoder=True,
            )
            wav = wavs[0]
            if not isinstance(wav, np.ndarray):
                wav = np.array(wav, dtype=np.float32)
            wav = np.asarray(wav, dtype=np.float32).reshape(-1)
            peak = float(np.max(np.abs(wav))) if wav.size else 1.0
            if peak > 0:
                wav = wav / max(1.0, peak)
            wavfile.write(str(wav_path), 24000, (wav * 32767).astype(np.int16))
        if not raw_mp3_path.exists():
            subprocess.run([str(FFMPEG), '-y', '-hide_banner', '-loglevel', 'error', '-i', str(wav_path), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libmp3lame', '-b:a', '192k', str(raw_mp3_path)], check=True)
        if not bgm_mp3_path.exists():
            flt = '[0:a]volume=1.35,aresample=44100[voice];[1:a]volume=0.13,atrim=0:24,asetpts=N/SR/TB,afade=t=out:st=22:d=2[bgm];[voice][bgm]amix=inputs=2:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]'
            subprocess.run([str(FFMPEG), '-y', '-hide_banner', '-loglevel', 'error', '-i', str(wav_path), '-stream_loop', '-1', '-i', str(BGM_PATH), '-filter_complex', flt, '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '192k', str(bgm_mp3_path)], check=True)
        cards.append(f"""<article class='card'><h2>ChatTTS+ {index:02d}<small> local random speaker</small></h2><p>本地 ChatTTS 随机说话人；非 Edge / Google / Windows SAPI。参数：seed={cfg['seed']}，temp={cfg['temperature']}，prompt={cfg['prompt']}</p><div class='audio-row'><span>纯配音</span><audio controls src='{sample_id}_raw.mp3'></audio></div><div class='audio-row'><span>配音+BGM</span><audio controls src='{sample_id}_bgm.mp3'></audio></div><p class='id'>{sample_id}</p></article>""")
    except Exception as exc:
        failures.append({'id': sample_id, 'error': repr(exc), 'config': cfg})
        print('[chattts-expanded][fail]', sample_id, repr(exc))

html = f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><title>ChatTTS 扩展音色试听</title><style>body{{margin:0;background:#f7efe2;color:#2e281f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}}.wrap{{max-width:1180px;margin:0 auto;padding:34px}}.lead{{font-size:18px;line-height:1.7;color:#635649}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(500px,1fr));gap:16px}}.card{{background:#fffaf0;border:1px solid rgba(89,70,45,.16);border-radius:24px;padding:18px;box-shadow:0 14px 40px rgba(102,76,38,.10)}}h1{{font-size:34px;margin:0 0 10px}}h2{{font-size:22px;margin:0 0 8px}}small{{font-size:13px;color:#937f68;margin-left:8px}}.audio-row{{display:grid;grid-template-columns:86px 1fr;align-items:center;gap:12px;margin:10px 0}}.audio-row span{{font-weight:800;color:#7a5d35}}audio{{width:100%}}.id{{font-size:12px;color:#9a8a77}}.sample{{padding:14px 16px;border-radius:18px;background:#fff5df;border:1px solid rgba(89,70,45,.14);line-height:1.7}}.fail{{white-space:pre-wrap;color:#9a4638}}</style></head><body><main class='wrap'><h1>ChatTTS 扩展音色试听</h1><p class='lead'>这一页全部是新一批本地随机音色，避开了你已经否定的 Edge / Google / Windows SAPI。建议重点听“纯配音”，再听“配音+BGM”。</p><p class='sample'>试听文案：{SAMPLE_TEXT}</p><section class='grid'>{''.join(cards)}</section>{'<pre class="fail">'+json.dumps(failures, ensure_ascii=False, indent=2)+'</pre>' if failures else ''}</main></body></html>"""
(OUT_DIR / 'index.html').write_text(html, encoding='utf-8')
(OUT_DIR / 'samples.json').write_text(json.dumps({'configs': configs, 'failures': failures}, ensure_ascii=False, indent=2), encoding='utf-8')
print('[chattts-expanded] page', OUT_DIR / 'index.html')
