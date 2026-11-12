import json
import subprocess
from pathlib import Path

OUT_DIR = Path(r'H:\ccwork\MBTI-PRO\content-marketing\review-html\voice-audition-chattts-2026-07-02')
BGM_PATH = Path(r'H:\ccwork\MBTI-PRO\video\BGM.mp3')
FFMPEG = Path(r'H:\ccwork\MBTI-PRO\scripts\video-pipeline\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe')
if not FFMPEG.exists():
    FFMPEG = 'ffmpeg'
SAMPLE_TEXT = 'ENFP突然安静的时候，往往比他吵吵闹闹更让人心疼。快乐的人也会累，他只是太怕自己的低落，会把别人的兴致也拖下去。'
OUT_DIR.mkdir(parents=True, exist_ok=True)

import numpy as np
import ChatTTS
import torch
from scipy.io import wavfile

print('[chattts] loading model...')
chat = ChatTTS.Chat()
chat.load(source='huggingface', compile=False)

cards = []
failures = []
for index in range(8):
    sample_id = f'chattts_seed_{index:02d}'
    wav_path = OUT_DIR / f'{sample_id}_raw.wav'
    mp3_path = OUT_DIR / f'{sample_id}_bgm.mp3'
    print(f'[chattts] {sample_id}')
    try:
        if not wav_path.exists():
            torch.manual_seed(20260702 + index)
            rand_spk = chat.sample_random_speaker()
            params_infer_code = ChatTTS.Chat.InferCodeParams(
                spk_emb=rand_spk,
                temperature=0.25,
                top_P=0.7,
                top_K=20,
                show_tqdm=False,
            )
            params_refine_text = ChatTTS.Chat.RefineTextParams(
                prompt='[oral_2][laugh_0][break_4]',
                show_tqdm=False,
            )
            wavs = chat.infer(
                [SAMPLE_TEXT],
                params_refine_text=params_refine_text,
                params_infer_code=params_infer_code,
            )
            wav = wavs[0]
            if not isinstance(wav, np.ndarray):
                wav = np.array(wav, dtype=np.float32)
            wav = np.asarray(wav, dtype=np.float32).reshape(-1)
            peak = float(np.max(np.abs(wav))) if wav.size else 1.0
            if peak > 0:
                wav = wav / max(1.0, peak)
            wavfile.write(str(wav_path), 24000, (wav * 32767).astype(np.int16))
        if not mp3_path.exists():
            flt = '[0:a]volume=1.35,aresample=44100[voice];[1:a]volume=0.13,atrim=0:18,asetpts=N/SR/TB,afade=t=out:st=16:d=2[bgm];[voice][bgm]amix=inputs=2:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]'
            subprocess.run([str(FFMPEG), '-y', '-hide_banner', '-loglevel', 'error', '-i', str(wav_path), '-stream_loop', '-1', '-i', str(BGM_PATH), '-filter_complex', flt, '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '192k', str(mp3_path)], check=True)
        cards.append(f"""<article class='card'><h2>ChatTTS random speaker {index:02d}<small> ChatTTS</small></h2><p>Chinese multi-speaker local model. Random speaker seed {index:02d}. Not Edge/Google/Kokoro.</p><div class='audio-row'><span>raw</span><audio controls src='{sample_id}_raw.wav'></audio></div><div class='audio-row'><span>with BGM</span><audio controls src='{sample_id}_bgm.mp3'></audio></div><p class='id'>{sample_id}</p></article>""")
    except Exception as exc:
        failures.append({'id': sample_id, 'error': repr(exc)})
        print('[chattts][fail]', sample_id, repr(exc))

html = f"""<!doctype html><html lang='zh-CN'><head><meta charset='utf-8'><title>ChatTTS Voice Audition</title><style>body{{margin:0;background:#f7efe2;color:#2e281f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}}.wrap{{max-width:1120px;margin:0 auto;padding:34px}}.lead{{font-size:18px;line-height:1.7;color:#635649}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:16px}}.card{{background:#fffaf0;border:1px solid rgba(89,70,45,.16);border-radius:24px;padding:18px;box-shadow:0 14px 40px rgba(102,76,38,.10)}}h1{{font-size:34px}}h2{{font-size:22px;margin:0 0 8px}}small{{font-size:13px;color:#937f68}}.audio-row{{display:grid;grid-template-columns:86px 1fr;align-items:center;gap:12px;margin:10px 0}}.audio-row span{{font-weight:800;color:#7a5d35}}audio{{width:100%}}.id{{font-size:12px;color:#9a8a77}}.fail{{white-space:pre-wrap;color:#9a4638}}</style></head><body><main class='wrap'><h1>ChatTTS Voice Audition</h1><p class='lead'>ChatTTS 是本地中文多说话人 TTS，和之前 Edge/Google 的在线音色不同。此页生成多个随机说话人，供你挑选自然度和情绪感。</p><section class='grid'>{''.join(cards)}</section>{'<pre class="fail">'+json.dumps(failures, ensure_ascii=False, indent=2)+'</pre>' if failures else ''}</main></body></html>"""
(OUT_DIR / 'index.html').write_text(html, encoding='utf-8')
(OUT_DIR / 'samples.json').write_text(json.dumps({'failures': failures}, ensure_ascii=False, indent=2), encoding='utf-8')
print('[chattts] page', OUT_DIR / 'index.html')
