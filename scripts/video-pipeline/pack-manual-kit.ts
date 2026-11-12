/**
 * pack-manual-kit.ts
 * 生成小红书/合规敏感平台的"手动素材包"：机器备料 + 人手发布
 * 用法：npx tsx pack-manual-kit.ts --type INTP [--platform xiaohongshu] [--out <dir>]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { join, resolve, basename, extname } from 'node:path'

type Platform = 'xiaohongshu' | 'bilibili' | 'douyin' | 'wechat'

interface Copy {
  platform: Platform
  title: string
  description: string
  hashtags: string[]
  firstComment?: string
  publishUrl?: string
}

interface Draft {
  id: string
  typeCode: string
  typeName?: string
  videoPath: string
  coverPath: string
  coverPathByPlatform?: Partial<Record<Platform, string>>
  copies: Copy[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DRAFT_DIR = join(ROOT, 'content-marketing', 'automation', 'drafts')
const KIT_ROOT = join(ROOT, 'content-marketing', 'xhs_manual_kit')

const AI_TAIL = '\n\n（本内容由本人策划，AI 辅助生成人格插画与剪辑，正文由本人撰写。）'

function parseArgs() {
  const a = process.argv.slice(2)
  const opts: { typeCode?: string; platform: Platform; out?: string; draftPath?: string } = {
    platform: 'xiaohongshu',
  }
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    if (x === '--type' || x === '--code') opts.typeCode = String(a[++i] || '').toUpperCase()
    else if (x === '--platform') opts.platform = String(a[++i] || 'xiaohongshu') as Platform
    else if (x === '--out') opts.out = a[++i]
    else if (x === '--draft') opts.draftPath = a[++i]
  }
  if (!opts.typeCode && !opts.draftPath) throw new Error('必须指定 --type <CODE> 或 --draft <path>')
  return opts
}

function findDraftPath(typeCode: string, platform: Platform): string {
  if (!existsSync(DRAFT_DIR)) throw new Error(`草稿目录不存在: ${DRAFT_DIR}`)
  const files = readdirSync(DRAFT_DIR)
    .filter(n => n.endsWith('.json'))
    .filter(n => n.toUpperCase().includes(typeCode.toUpperCase()))
    .sort((x, y) => y.localeCompare(x))
  if (!files[0]) throw new Error(`未找到含 ${typeCode} 的草稿。先运行 publish:prepare。`)
  return join(DRAFT_DIR, files[0])
}

function ensureDir(p: string) { if (!existsSync(p)) mkdirSync(p, { recursive: true }) }

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function main() {
  const opts = parseArgs()
  const draftPath = opts.draftPath || findDraftPath(opts.typeCode!, opts.platform)
  const draft: Draft = JSON.parse(readFileSync(draftPath, 'utf-8'))
  const code = draft.typeCode
  const copy = draft.copies.find(c => c.platform === opts.platform)
  if (!copy) throw new Error(`草稿缺少 ${opts.platform} 文案`)

  const outDir = opts.out ? resolve(opts.out) : join(KIT_ROOT, code)
  ensureDir(outDir)

  // 1) 复制视频
  const videoExt = extname(draft.videoPath) || '.mp4'
  const videoOut = join(outDir, `${code}_video${videoExt}`)
  copyFileSync(draft.videoPath, videoOut)

  // 2) 复制封面（优先平台专属）
  const coverSrc = draft.coverPathByPlatform?.[opts.platform] && existsSync(draft.coverPathByPlatform[opts.platform]!)
    ? draft.coverPathByPlatform[opts.platform]!
    : draft.coverPath
  const coverExt = extname(coverSrc) || '.png'
  const coverOut = join(outDir, `${code}_cover${coverExt}`)
  copyFileSync(coverSrc, coverOut)

  // 3) 文本文件
  const titleOut = join(outDir, 'title.txt')
  const rawTitle = (copy.title || '').slice(0, opts.platform === 'xiaohongshu' ? 20 : 30)
  writeFileSync(titleOut, rawTitle, 'utf-8')

  const descBody = (copy.description || '').trim()
  // 拼接：正文 + 空行 + hashtags + AI 声明
  const hashLine = (copy.hashtags || []).map(t => t.startsWith('#') ? t : `#${t}`).join(' ')
  const TAIL_MARK = 'AI 辅助生成人格插画与剪辑'
  let bodyClean = descBody
  const tailIdx = bodyClean.indexOf(TAIL_MARK)
  if (tailIdx >= 0) {
    const parenStart = bodyClean.lastIndexOf('（', tailIdx)
    if (parenStart >= 0) bodyClean = bodyClean.slice(0, parenStart).trimEnd()
  }
  const descFull = [bodyClean, hashLine, AI_TAIL.trim()].filter(Boolean).join('\n\n')
  writeFileSync(join(outDir, 'desc.txt'), descFull, 'utf-8')
  writeFileSync(join(outDir, 'hashtags.txt'), (copy.hashtags || []).join('\n'), 'utf-8')
  if (copy.firstComment) writeFileSync(join(outDir, 'first_comment.txt'), copy.firstComment, 'utf-8')

  // 4) PowerShell 剪贴板脚本（双击后 title -> 剪贴板；再运行一次会切到 desc）
  const ps1 = `<#
  用法：右键"用 PowerShell 运行"或双击。
  第 1 次：把标题放入剪贴板。
  第 2 次：把正文+话题放入剪贴板。
  第 3 次：还原为标题。
#>
$flag = Join-Path $PSScriptRoot '.clip_state'
$state = if (Test-Path $flag) { Get-Content $flag -Raw } else { '' }
if ($state -eq 'title') {
  Get-Content (Join-Path $PSScriptRoot 'desc.txt') -Raw | Set-Clipboard
  'desc' | Set-Content $flag
  Write-Host '[已复制] 正文+话题 → 剪贴板'
} else {
  Get-Content (Join-Path $PSScriptRoot 'title.txt') -Raw | Set-Clipboard
  'title' | Set-Content $flag
  Write-Host '[已复制] 标题 → 剪贴板'
}
Start-Sleep 2
`
  writeFileSync(join(outDir, 'to_clipboard.ps1'), ps1, 'utf-8')

  // 5) checklist
  const videoBytes = statSync(videoOut).size
  const coverBytes = statSync(coverOut).size
  const check = `# ${code} · ${opts.platform} 手动发布 checklist

**为什么手动**：小红书 2026-07 新规将 Playwright 自动填表判为「AI 及第三方托管行为」。
本 kit 只负责备料，最后 4 步由**真人**在**手机 App**里完成。

## 素材清单
- 视频：\`${basename(videoOut)}\`（${fmtBytes(videoBytes)}）
- 封面：\`${basename(coverOut)}\`（${fmtBytes(coverBytes)}，1080x1920）
- 标题：\`title.txt\`（${rawTitle.length} 字，${opts.platform === 'xiaohongshu' ? '≤20' : '≤30'}）
- 正文：\`desc.txt\`（含话题 + AI 声明尾句）
- 备用话题：\`hashtags.txt\`
- 剪贴板脚本：\`to_clipboard.ps1\`

## 发布步骤（手机 App，全部真人操作）

1. **推素材到手机**
   - 微信文件传输助手 / QQ / AirDrop 把 \`${basename(videoOut)}\` 和 \`${basename(coverOut)}\` 发到手机
   - 或用 iOS 系统 AirDrop 直接把整个文件夹推过去

2. **PC 端准备文案**
   - 双击 \`to_clipboard.ps1\` → 手机端"标题"栏长按粘贴
   - 再双击一次 \`to_clipboard.ps1\` → 手机端"正文"栏长按粘贴

3. **App 内发布**
   - 打开小红书 App → 底部"+" → 从相册选视频 → 下一步
   - 选封面：从相册选 \`${basename(coverOut)}\`
   - 粘贴标题、粘贴正文
   - 检查正文最后一行有 AI 声明
   - 点"发布笔记"

4. **发布后**
   - 截图发布成功页 → 存到 \`content-marketing/automation/xhs_status/${code}_${new Date().toISOString().slice(0, 10)}.png\`
   - 24 小时内不要在 PC 端用同账号操作，减少"多端跳变"风控

## 违规红线（本 kit 已规避）
- ❌ Web 端 + Playwright/脚本填字段（新规判为托管）
- ❌ 无 AI 声明（新规要求主动标注）
- ❌ 同一账号短时多端切换（触发指纹异常）
- ❌ 完全 AI 生成无真人痕迹（要求"真人感"）

## 真人感加分建议（可选，2 分钟）
- 正文首行改成一句你自己的观察，例："上周我表哥就是这样，问他晚饭吃啥他愣了 20 秒才说'我在想'"
- 结尾追加一句你的 CTA："你身边有这样的 ${code} 吗？评论区聊聊"
`
  writeFileSync(join(outDir, 'publish_checklist.md'), check, 'utf-8')

  // 6) 汇总 index
  const index = {
    typeCode: code,
    platform: opts.platform,
    generatedAt: new Date().toISOString(),
    files: {
      video: videoOut,
      cover: coverOut,
      title: titleOut,
      desc: join(outDir, 'desc.txt'),
      hashtags: join(outDir, 'hashtags.txt'),
      checklist: join(outDir, 'publish_checklist.md'),
    },
    title: rawTitle,
    charCount: rawTitle.length,
    videoBytes,
    coverBytes,
    aiTailAppended: true,
  }
  writeFileSync(join(outDir, 'kit.json'), JSON.stringify(index, null, 2), 'utf-8')

  console.log(`\n[OK] 手动素材包已生成：${outDir}`)
  console.log(`  视频  ${basename(videoOut)}  ${fmtBytes(videoBytes)}`)
  console.log(`  封面  ${basename(coverOut)}  ${fmtBytes(coverBytes)}`)
  console.log(`  标题  ${rawTitle}`)
  console.log(`  下一步：把整个目录用微信/AirDrop 推到手机，按 publish_checklist.md 操作。`)
}

main()
