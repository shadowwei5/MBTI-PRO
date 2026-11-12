
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
import torch
import ChatTTS
from scipy.io import wavfile

ROOT = Path(r'H:\ccwork\MBTI-PRO')
FFMPEG = ROOT / 'scripts' / 'video-pipeline' / 'node_modules' / '@ffmpeg-installer' / 'win32-x64' / 'ffmpeg.exe'
if not FFMPEG.exists():
    FFMPEG = Path('ffmpeg')

CONFIGS = []
for index in range(20):
    CONFIGS.append({
        'index': index,
        'seed': 2026070200 + index,
        'temperature': [0.20, 0.25, 0.30, 0.35][index % 4],
        'top_P': [0.65, 0.70, 0.75, 0.80][index % 4],
        'top_K': [15, 20, 25, 30][index % 4],
        'prompt': ['[oral_2][laugh_0][break_4]', '[oral_2][laugh_0][break_5]', '[oral_1][laugh_0][break_4]', '[oral_2][laugh_1][break_4]'][index % 4],
    })

def run(args):
    subprocess.run([str(FFMPEG), *args], check=True)

def get_duration_ms(path: Path) -> int:
    result = subprocess.run([
        str(FFMPEG), '-i', str(path)
    ], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='ignore')
    import re
    match = re.search(r'Duration:\s*(\d+):(\d+):(\d+)\.(\d+)', result.stdout)
    if not match:
        return 0
    hours, minutes, seconds, fraction = match.groups()
    return int((int(hours)*3600 + int(minutes)*60 + int(seconds) + float('0.' + fraction)) * 1000)

def ms_to_srt(ms: int) -> str:
    total = max(0, int(ms))
    h = total // 3600000
    total %= 3600000
    m = total // 60000
    total %= 60000
    s = total // 1000
    milli = total % 1000
    return f'{h:02d}:{m:02d}:{s:02d},{milli:03d}'

def split_chunks(text: str):
    text = ' '.join(str(text or '').split()).strip()
    chunks=[]; buf=''
    for ch in text:
        buf += ch
        should = ch in '。！？!?；;' or (ch in '，,、：:' and len(buf) >= 12) or len(buf) >= 24
        if should:
            if buf.strip() and buf.strip() not in '。！？!?；;，,、：:': chunks.append(buf.strip())
            buf=''
    if buf.strip(): chunks.append(buf.strip())
    return chunks

def wrap_subtitle(text: str):
    text = str(text or '').strip()
    if len(text) <= 18:
        return text
    for sep in ['，','。','：','；','、',' '] :
        pos = text.rfind(sep, 0, 20)
        if 8 <= pos <= 20:
            return text[:pos+1] + '\n' + text[pos+1:]
    return text[:18] + '\n' + text[18:]

def make_silence(path: Path, ms: int):
    duration = max(0.05, ms / 1000)
    run(['-y','-hide_banner','-loglevel','error','-f','lavfi','-i',f'anullsrc=r=24000:cl=mono','-t',f'{duration:.3f}','-c:a','pcm_s16le',str(path)])

def default_pause_ms(text: str, index: int, total: int) -> int:
    if index >= total - 1:
        return 0
    if any(p in text for p in ['？','?','！','!']):
        return 190
    if len(text) <= 14:
        return 130
    return 170

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--segments-json', required=True)
    parser.add_argument('--out-dir', required=True)
    parser.add_argument('--prefix', required=True)
    parser.add_argument('--speaker-index', type=int, default=15)
    parser.add_argument('--speed', type=float, default=1.08)
    parser.add_argument('--prompt-override', default='')
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    segments = json.loads(Path(args.segments_json).read_text(encoding='utf-8'))
    cfg = dict(CONFIGS[args.speaker_index])
    if args.prompt_override:
        cfg['prompt'] = args.prompt_override
    audio_path = out_dir / f'{args.prefix}.mp3'
    wav_concat = out_dir / f'{args.prefix}_chattts15.wav'
    subtitle_path = out_dir / f'{args.prefix}.srt'
    metadata_path = out_dir / f'{args.prefix}_chattts15.json'

    print('[chattts-voice] loading model...')
    chat = ChatTTS.Chat()
    chat.load(source='huggingface', compile=False)

    temp_files=[]
    subtitle_entries=[]
    current_ms=0
    sub_index=1

    for i, seg in enumerate(segments):
        text = str(seg.get('text','')).strip()
        if not text:
            continue
        temp_wav = out_dir / f'_chattts15_{i:03d}.wav'
        print(f'[chattts-voice] {i+1}/{len(segments)} {text[:28]}')
        torch.manual_seed(cfg['seed'])
        rand_spk = chat.sample_random_speaker()
        params_infer_code = ChatTTS.Chat.InferCodeParams(
            spk_emb=rand_spk,
            temperature=cfg['temperature'],
            top_P=cfg['top_P'],
            top_K=cfg['top_K'],
            show_tqdm=False,
        )
        params_refine_text = ChatTTS.Chat.RefineTextParams(prompt=cfg['prompt'], show_tqdm=False)
        wavs = chat.infer([text], params_refine_text=params_refine_text, params_infer_code=params_infer_code, use_decoder=True)
        wav = wavs[0]
        if not isinstance(wav, np.ndarray):
            wav = np.array(wav, dtype=np.float32)
        wav = np.asarray(wav, dtype=np.float32).reshape(-1)
        peak = float(np.max(np.abs(wav))) if wav.size else 1.0
        if peak > 0:
            wav = wav / max(1.0, peak)
        wavfile.write(str(temp_wav), 24000, (wav * 32767).astype(np.int16))

        duration_ms = get_duration_ms(temp_wav)
        start_ms = current_ms
        end_ms = start_ms + duration_ms
        chunks = split_chunks(text)
        total_weight = sum(max(1, len(c.replace(' ',''))) for c in chunks) or 1
        chunk_start = start_ms
        for ci, chunk in enumerate(chunks):
            is_last = ci == len(chunks) - 1
            weight = max(1, len(chunk.replace(' ','')))
            chunk_dur = (end_ms - chunk_start) if is_last else max(900, round(duration_ms * weight / total_weight))
            chunk_end = end_ms if is_last else min(end_ms, chunk_start + chunk_dur)
            subtitle_entries.append(f'{sub_index}\n{ms_to_srt(chunk_start)} --> {ms_to_srt(chunk_end)}\n{wrap_subtitle(chunk)}\n')
            sub_index += 1
            chunk_start = chunk_end
            if chunk_start >= end_ms:
                break
        current_ms = end_ms
        temp_files.append(temp_wav)

        pause_ms = int(seg.get('pauseMs') if seg.get('pauseMs') is not None else default_pause_ms(text, i, len(segments)))
        if pause_ms > 0 and i < len(segments) - 1:
            pause_wav = out_dir / f'_chattts15_{i:03d}_pause.wav'
            make_silence(pause_wav, pause_ms)
            temp_files.append(pause_wav)
            current_ms += pause_ms

    list_path = out_dir / '_chattts15_concat.txt'
    list_path.write_text('\n'.join(f"file '{str(p).replace(chr(92), '/')}'" for p in temp_files), encoding='utf-8')
    run(['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(list_path),'-c','copy',str(wav_concat)])
    atempo = args.speed
    run(['-y','-hide_banner','-loglevel','error','-i',str(wav_concat),'-filter:a',f'atempo={atempo},loudnorm=I=-16:TP=-1.5:LRA=11','-c:a','libmp3lame','-b:a','192k',str(audio_path)])
    subtitle_path.write_text('\n'.join(subtitle_entries), encoding='utf-8')
    metadata_path.write_text(json.dumps({'voice':'ChatTTS+15 local random speaker','config':cfg,'speed':args.speed,'segments':segments},ensure_ascii=False,indent=2), encoding='utf-8')

    for p in temp_files + [list_path, wav_concat]:
        try:
            p.unlink()
        except Exception:
            pass
    print('[chattts-voice] audio', audio_path)
    print('[chattts-voice] srt', subtitle_path)

if __name__ == '__main__':
    main()
