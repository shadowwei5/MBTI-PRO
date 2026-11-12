import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getStoryTypeScript } from './generate-audio.js'

const ROOT = resolve(import.meta.dirname, '..', '..')
const WORK_DIR = join(ROOT, 'video', 'work')
const CONTENT_DIR = join(ROOT, 'content-marketing')

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { code: '' }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--type' || arg === '--code') opts.code = (args[++i] || '').toUpperCase()
  }
  if (!/^[EAI][NBS][TCF][JDP]$/.test(opts.code)) throw new Error('请使用 --type CODE，例如 --type ENTP')
  return opts
}

function ensureTypeData(code: string) {
  const dataPath = join(WORK_DIR, code, `${code}.json`)
  if (!existsSync(dataPath)) throw new Error(`缺少人格数据缓存：${dataPath}`)
  return JSON.parse(readFileSync(dataPath, 'utf8'))
}

function main() {
  const { code } = parseArgs()
  const data = ensureTypeData(code)
  const segments = getStoryTypeScript(data)
  const audioDir = join(WORK_DIR, code, 'audio')
  const reviewDir = join(CONTENT_DIR, 'review-html', `${new Date().toISOString().slice(0, 10)}_${code}_jianying_liuyuxi`)
  mkdirSync(audioDir, { recursive: true })
  mkdirSync(reviewDir, { recursive: true })

  const speechText = segments.map(seg => seg.speechText || seg.text).join('\n')
  const subtitleText = segments.map(seg => seg.subtitleText || seg.text).join('\n')
  const scriptPath = join(audioDir, `${code}_jianying_liuyuxi_script.txt`)
  const subtitleScriptPath = join(audioDir, `${code}_subtitle_script.txt`)
  const expectedVoicePath = join(audioDir, `${code}_jianying_liuyuxi.mp3`)
  writeFileSync(scriptPath, speechText + '\n', 'utf8')
  writeFileSync(subtitleScriptPath, subtitleText + '\n', 'utf8')

  const htmlPath = join(reviewDir, 'index.html')
  writeFileSync(htmlPath, `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${code} 剪映刘语熙配音交接</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;background:#f8eedc;color:#2f261b;margin:0;padding:36px}.wrap{max-width:980px;margin:auto}.card{background:#fffdf7;border:1px solid #e7d4b7;border-radius:24px;padding:24px;margin:18px 0;box-shadow:0 16px 48px #7a58241a}textarea{width:100%;min-height:360px;font-size:22px;line-height:1.8;border:1px solid #e7d4b7;border-radius:18px;padding:18px;background:white;color:#2f261b}code{background:#fff4df;padding:2px 6px;border-radius:6px}.ok{color:#2e8b57;font-weight:800}.warn{color:#a65f00;font-weight:800}li{margin:10px 0;font-size:18px;line-height:1.6}</style></head>
<body><div class="wrap"><h1>${code}｜剪映“刘语熙”配音交接</h1>
<div class="card"><h2>操作步骤</h2><ol>
<li>在剪映导入无配音视频：<code>H:/ccwork/MBTI-PRO/video/output/${code}_daily_liuyuxi_clean_2k_novoice.mp4</code></li>
<li>新增文本，粘贴下面“刘语熙口播稿”。</li>
<li>文字转语音选择 <strong>刘语熙</strong>，确认开头读成清楚的 <strong>E N T P</strong>（或对应字母）。</li>
<li>导出纯配音或含配音视频均可；优先导出纯音频到：<code>${expectedVoicePath.replace(/\\/g, '/')}</code></li>
<li>完成后告诉 Codex，我会自动把刘语熙配音、BGM、字幕和无配音高清视频合成最终发布版。</li>
</ol></div>
<div class="card"><h2>刘语熙口播稿（用于粘贴到剪映）</h2><p class="warn">注意：这里故意把 ENTP 写成 E N T P，是为保证发音清楚；视频字幕仍显示 ENTP。</p><textarea readonly>${speechText.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea></div>
<div class="card"><h2>字幕稿（展示用，不粘贴配音）</h2><textarea readonly>${subtitleText.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea></div>
</div></body></html>`, 'utf8')

  console.log('✅ 剪映刘语熙配音交接文件已生成')
  console.log(`口播稿: ${scriptPath}`)
  console.log(`字幕稿: ${subtitleScriptPath}`)
  console.log(`审核页: ${htmlPath}`)
  console.log(`剪映配音期望导出路径: ${expectedVoicePath}`)
}

main()
