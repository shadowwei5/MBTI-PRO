import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { KokoroTTS } from 'kokoro-js'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const OUT_DIR = join(ROOT_DIR, 'content-marketing', 'review-html', 'voice-audition-kokoro-2026-07-02')
const BGM_PATH = join(ROOT_DIR, 'video', 'BGM.mp3')
const FFMPEG = ffmpegInstaller.path
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const SAMPLE_TEXT = 'ENFP suddenly goes quiet, and somehow that hurts more than when they are loud. Happy people get tired too. Sometimes they just hide it because they do not want to ruin the mood.'

const voices = [
  { id: 'af_heart', label: 'Kokoro af_heart', desc: 'female, top grade in Kokoro model card' },
  { id: 'af_bella', label: 'Kokoro af_bella', desc: 'female, energetic/high quality' },
  { id: 'bf_emma', label: 'Kokoro bf_emma', desc: 'British female, softer' },
  { id: 'af_nicole', label: 'Kokoro af_nicole', desc: 'female, calmer' },
  { id: 'af_sarah', label: 'Kokoro af_sarah', desc: 'female, stable' },
  { id: 'am_michael', label: 'Kokoro am_michael', desc: 'male, stable' },
]

function run(command: string, args: string[]) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'pipe', shell: false })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`${command} exited ${code}: ${stderr.slice(-500)}`)))
    child.on('error', reject)
  })
}

async function mixWithBgm(voicePath: string, outPath: string) {
  await run(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', voicePath,
    '-stream_loop', '-1', '-i', BGM_PATH,
    '-filter_complex', '[0:a]volume=1.35,aresample=44100[voice];[1:a]volume=0.13,atrim=0:18,asetpts=N/SR/TB,afade=t=out:st=16:d=2[bgm];[voice][bgm]amix=inputs=2:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]',
    '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '192k', outPath,
  ])
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log('[kokoro] loading model, first run may download files...')
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'cpu' })
  let available: unknown = []
  try { available = tts.list_voices() } catch {}
  writeFileSync(join(OUT_DIR, 'available-voices.json'), JSON.stringify(available ?? [], null, 2), 'utf8')
  const cards: string[] = []
  const failures: any[] = []
  for (const voice of voices) {
    const wav = join(OUT_DIR, `${voice.id}_raw.wav`)
    const mixed = join(OUT_DIR, `${voice.id}_bgm.mp3`)
    console.log(`[kokoro] ${voice.id}`)
    try {
      if (!existsSync(wav)) {
        const audio = await tts.generate(SAMPLE_TEXT, { voice: voice.id })
        audio.save(wav)
      }
      if (!existsSync(mixed)) await mixWithBgm(wav, mixed)
      cards.push(`<article class="card"><h2>${voice.label}<small> kokoro</small></h2><p>${voice.desc}</p><p>濞夈劍鍓伴敍娆縪koro 瑜版挸澧犳稉鏄忣洣閺勵垵瀚抽弬鍥叾閼硅绱濇潻娆戠矋閻劋绨拠鍕強閼奉亞鍔ф惔锔跨瑐闂勬劧绱濇稉宥囨纯閹恒儰缍旀稉杞拌厬閺傚洭鏆遍張鐔告煙濡楀牄鈧?/p><div class="audio-row"><span>raw</span><audio controls src="${voice.id}_raw.wav"></audio></div><div class="audio-row"><span>with BGM</span><audio controls src="${voice.id}_bgm.mp3"></audio></div><p class="id">${voice.id}</p></article>`)
    } catch (error) {
      failures.push({ voice: voice.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Kokoro Voice Audition</title><style>body{margin:0;background:#f7efe2;color:#2e281f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}.wrap{max-width:1120px;margin:0 auto;padding:34px}.lead{font-size:18px;line-height:1.7;color:#635649}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:16px}.card{background:#fffaf0;border:1px solid rgba(89,70,45,.16);border-radius:24px;padding:18px;box-shadow:0 14px 40px rgba(102,76,38,.10)}h1{font-size:34px}h2{font-size:22px;margin:0 0 8px}small{font-size:13px;color:#937f68}.audio-row{display:grid;grid-template-columns:86px 1fr;align-items:center;gap:12px;margin:10px 0}.audio-row span{font-weight:800;color:#7a5d35}audio{width:100%}.id{font-size:12px;color:#9a8a77}.fail{white-space:pre-wrap;color:#9a4638}</style></head><body><main class="wrap"><h1>Kokoro Voice Audition</h1><p class="lead">Kokoro 閺勵垱婀伴崷鏉跨磻濠?TTS閵嗗倸缍嬮崜宥喣侀崹瀣╁瘜鐟曚焦妲搁懟杈ㄦ瀮闂婂疇澹婇敍灞芥礈濮濄倓绗夐柌宥咁槻 Edge/Google 娑擃厽鏋冮棅瀹犲閿涘苯褰ч悽銊ょ艾閸掋倖鏌囨担鐘虫Ц閸氾附娲块崰婊勵偨鏉╂瑧顫掗懛顏嗗姧鎼达负鈧倸顩ч弸婊勬煙閸氭垼顓婚崣顖ょ礉閸愬秶鎴风紒顓烆嚢閹靛彞鑵戦弬鍥х磻濠ф劖膩閸ㄥ鈧?/p><section class="grid">${cards.join('\n')}</section>${failures.length ? `<pre class="fail">${JSON.stringify(failures, null, 2)}</pre>` : ''}</main></body></html>`
  writeFileSync(join(OUT_DIR, 'index.html'), html, 'utf8')
  console.log(`閴?${join(OUT_DIR, 'index.html')}`)
}

main().catch(error => { console.error(error); process.exit(1) })