const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const ROOT = 'H:/ccwork/MBTI-PRO'
const PIPELINE = `${ROOT}/scripts/video-pipeline`
const FFMPEG = `${PIPELINE}/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe`
const CODE = 'ENFP'
const WIDTH = 1440
const HEIGHT = 2560
const FRAME_DIR = `${ROOT}/video/work/${CODE}/frames_2k`
const AUDIO = `${ROOT}/video/work/${CODE}/audio/${CODE}.mp3`
const SRT = `${ROOT}/video/work/${CODE}/audio/${CODE}.srt`
const OUT_DIR = `${ROOT}/video/output`
const TMP_ASS = `${OUT_DIR}/_temp_${CODE}_2k.ass`
const FINAL = `${OUT_DIR}/${CODE}_daily_2k_review.mp4`
const QA_DIR = `${OUT_DIR}/daily_qa/${CODE}_2k`
const QA_JSON = `${QA_DIR}/${CODE}_daily_2k_qa.json`
function run(args, label) {
  console.log(`\n[ffmpeg] ${label}`)
  const result = spawnSync(FFMPEG, args, { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${label} failed: ${result.status}`)
}
function ffmpegText(args) {
  const result = spawnSync(FFMPEG, args, { encoding: 'utf8' })
  return `${result.stdout || ''}${result.stderr || ''}`
}
function durationOf(file) {
  const text = ffmpegText(['-i', file])
  const match = text.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/)
  if (!match) return 0
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(`0.${match[4]}`)
}
function toAss(value) {
  const m = value.match(/(\d+):(\d+):(\d+),(\d+)/)
  if (!m) return '0:00:00.00'
  return `${Number(m[1])}:${m[2]}:${m[3]}.${m[4].slice(0, 2).padEnd(2, '0')}`
}
function escapeAss(value) { return value.replace(/[{}]/g, '').replace(/\n/g, '\\N') }
function srtToAss2k(srt) {
  const blocks = srt.replace(/\r/g, '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean)
  const dialogues = blocks.flatMap(block => {
    const lines = block.split('\n')
    const idx = lines.findIndex(line => line.includes('-->'))
    if (idx < 0) return []
    const [startRaw, endRaw] = lines[idx].split('-->').map(x => x.trim())
    const text = lines.slice(idx + 1).join('\\N').trim()
    if (!text) return []
    return `Dialogue: 0,${toAss(startRaw)},${toAss(endRaw)},Default,,0,0,0,,${escapeAss(text)}`
  })
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${WIDTH}
PlayResY: ${HEIGHT}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei UI,88,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA6000000,-1,0,0,0,100,100,0,0,1,8,1,2,62,62,280,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${dialogues.join('\n')}
`
}
fs.mkdirSync(QA_DIR, { recursive: true })
fs.writeFileSync(TMP_ASS, srtToAss2k(fs.readFileSync(SRT, 'utf8')), 'utf8')
const safeAss = TMP_ASS.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:')
const audioDuration = durationOf(AUDIO)
const target = Math.min(53.1, Math.max(51.1, audioDuration + 0.55))
run([
  '-y',
  '-framerate', '30',
  '-i', `${FRAME_DIR}/frame_%05d.png`,
  '-i', AUDIO,
  '-t', target.toFixed(2),
  '-vf', `tpad=stop_mode=clone:stop_duration=2,ass='${safeAss}'`,
  '-map', '0:v:0', '-map', '1:a:0',
  '-c:v', 'libx264', '-preset', 'slow',
  '-b:v', '35M', '-minrate', '28M', '-maxrate', '45M', '-bufsize', '90M',
  '-pix_fmt', 'yuv420p', '-r', '30',
  '-c:a', 'aac', '-b:a', '160k',
  '-movflags', '+faststart',
  FINAL,
], '2k high-bitrate final')
const finalDuration = durationOf(FINAL)
const frameTimes = [2, 8, 12, 25, 36, 42, Math.max(1, finalDuration - 1.5)]
const framePaths = []
for (const time of frameTimes) {
  const out = `${QA_DIR}/${CODE}_daily_2k_${String(Math.round(time * 10)).padStart(4, '0')}.png`
  run(['-y', '-ss', Math.min(time, Math.max(0, finalDuration - 0.2)).toFixed(2), '-i', FINAL, '-vframes', '1', out], `qa ${time}`)
  framePaths.push(out)
}
fs.writeFileSync(QA_JSON, JSON.stringify({ code: CODE, width: WIDTH, height: HEIGHT, fps: 30, bitrateTarget: '35M', video: FINAL, audio: AUDIO, finalDuration, framePaths }, null, 2), 'utf8')
console.log(`\nDONE ${FINAL}`)
console.log(`QA ${QA_JSON}`)
