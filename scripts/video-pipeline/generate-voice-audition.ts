import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

const ROOT_DIR = resolve(import.meta.dirname, '..', '..')
const OUT_DIR = join(ROOT_DIR, 'content-marketing', 'review-html', 'voice-audition-2026-07-02')
const BGM_PATH = join(ROOT_DIR, 'video', 'BGM.mp3')
const FFMPEG = ffmpegInstaller.path
const RATE = '+30%'

const SAMPLE_TEXT = 'ENFP突然安静的时候，往往比他吵吵闹闹更让人心疼。快乐的人也会累，他只是太怕自己的低落，会把别人的兴致也拖下去。'

const VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', gender: '女声', style: '温暖，新闻/小说' },
  { id: 'zh-CN-XiaoyiNeural', name: '晓伊', gender: '女声', style: '活泼，卡通/小说' },
  { id: 'zh-CN-YunjianNeural', name: '云健', gender: '男声', style: '热情，运动/小说' },
  { id: 'zh-CN-YunxiNeural', name: '云希', gender: '男声', style: '阳光，小说' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏', gender: '男声', style: '可爱，卡通/小说' },
  { id: 'zh-CN-YunyangNeural', name: '云扬', gender: '男声', style: '专业，新闻' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', name: '辽宁晓北', gender: '女声', style: '幽默，方言' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', name: '陕西晓妮', gender: '女声', style: '明亮，方言' },
  { id: 'zh-HK-HiuGaaiNeural', name: '粤语 HiuGaai', gender: '女声', style: '友好，香港' },
  { id: 'zh-HK-HiuMaanNeural', name: '粤语 HiuMaan', gender: '女声', style: '友好，香港' },
  { id: 'zh-HK-WanLungNeural', name: '粤语 WanLung', gender: '男声', style: '友好，香港' },
  { id: 'zh-TW-HsiaoChenNeural', name: '台湾晓臻', gender: '女声', style: '友好，台湾' },
  { id: 'zh-TW-HsiaoYuNeural', name: '台湾晓雨', gender: '女声', style: '友好，台湾' },
  { id: 'zh-TW-YunJheNeural', name: '台湾云哲', gender: '男声', style: '友好，台湾' },
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

async function tts(voice: string, outPath: string) {
  const candidates = process.platform === 'win32'
    ? [{ command: 'py', prefix: ['-m', 'edge_tts'] }, { command: 'python', prefix: ['-m', 'edge_tts'] }]
    : [{ command: 'python3', prefix: ['-m', 'edge_tts'] }, { command: 'python', prefix: ['-m', 'edge_tts'] }]
  const args = ['--voice', voice, '--rate', RATE, '--text', SAMPLE_TEXT, '--write-media', outPath]
  const errors: string[] = []
  for (const candidate of candidates) {
    try {
      await run(candidate.command, [...candidate.prefix, ...args])
      return
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error(errors.join(' | '))
}

async function mixWithBgm(voicePath: string, outPath: string) {
  if (!existsSync(BGM_PATH)) throw new Error(`BGM不存在：${BGM_PATH}`)
  await run(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', voicePath,
    '-stream_loop', '-1', '-i', BGM_PATH,
    '-filter_complex', '[0:a]volume=1.25,aresample=44100[voice];[1:a]volume=0.14,atrim=0:18,asetpts=N/SR/TB,afade=t=out:st=16:d=2[bgm];[voice][bgm]amix=inputs=2:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11[a]',
    '-map', '[a]', '-c:a', 'libmp3lame', '-b:a', '192k', outPath,
  ])
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const rows: string[] = []
  for (const voice of VOICES) {
    const base = voice.id.replace(/[^a-z0-9_-]/gi, '_')
    const raw = join(OUT_DIR, `${base}_raw.mp3`)
    const mixed = join(OUT_DIR, `${base}_bgm.mp3`)
    console.log(`[voice] ${voice.id}`)
    if (!existsSync(raw)) await tts(voice.id, raw)
    if (!existsSync(mixed)) await mixWithBgm(raw, mixed)
    rows.push(`<article class="card">
      <h2>${htmlEscape(voice.name)} <small>${htmlEscape(voice.id)}</small></h2>
      <p><b>${htmlEscape(voice.gender)}</b>｜${htmlEscape(voice.style)}</p>
      <div class="audio-row"><span>纯配音</span><audio controls src="${base}_raw.mp3"></audio></div>
      <div class="audio-row"><span>配音+BGM</span><audio controls src="${base}_bgm.mp3"></audio></div>
      <p class="path">${htmlEscape(raw)}</p>
    </article>`)
  }

  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>MBTI-PRO Edge TTS 音色试听审核</title>
<style>
body{margin:0;background:#f7efe2;color:#2f2922;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif}.wrap{max-width:1160px;margin:0 auto;padding:34px}h1{font-size:34px;margin:0 0 12px}.lead{font-size:18px;line-height:1.7;color:#65584b}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(480px,1fr));gap:18px;margin-top:24px}.card{background:#fffaf0;border:1px solid rgba(89,70,45,.16);border-radius:24px;padding:20px;box-shadow:0 14px 40px rgba(102,76,38,.10)}h2{margin:0 0 8px;font-size:24px}small{font-size:13px;color:#8a7662}.audio-row{display:grid;grid-template-columns:86px 1fr;align-items:center;gap:12px;margin:12px 0}.audio-row span{font-weight:800;color:#7a5d35}audio{width:100%}.path{font-size:12px;color:#9a8a77;word-break:break-all}.criteria{background:#fff3d8;border-left:6px solid #d99b2b;border-radius:18px;padding:16px 20px;margin-top:18px;line-height:1.75}.pick{font-size:18px;font-weight:900;color:#80510d}</style>
</head><body><main class="wrap"><h1>Edge TTS 中文音色试听审核</h1>
<p class="lead">目标：从 edge-tts 内置中文音色里，选择最适合替代剪映「刘语熙」的口播音色。试听文本使用 ENFP 样片风格短句，所有样本语速为 ${RATE}，并提供纯配音与已混入你导出的 BGM 两个版本。</p>
<section class="criteria"><div class="pick">请你审核时重点选择：</div><ol><li>是否像抖音情绪共鸣口播，不像新闻播报。</li><li>是否自然、有温度，不机械。</li><li>与 BGM 混合后，人声是否清楚舒服。</li><li>适合长期批量生成 81 型人格视频。</li></ol></section>
<section class="grid">${rows.join('\n')}</section></main></body></html>`
  const htmlPath = join(OUT_DIR, 'index.html')
  writeFileSync(htmlPath, html, 'utf8')
  writeFileSync(join(OUT_DIR, 'voices.json'), JSON.stringify({ rate: RATE, sampleText: SAMPLE_TEXT, voices: VOICES }, null, 2), 'utf8')
  console.log(`\n✅ 审核页：${htmlPath}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})