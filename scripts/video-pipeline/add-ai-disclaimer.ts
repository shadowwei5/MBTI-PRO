/**
 * add-ai-disclaimer.ts
 * 给 drafts/*.json 中每条 copies.description 末尾追加合规声明尾句。
 * 幂等：已含尾句则跳过。
 * 用法：npx tsx add-ai-disclaimer.ts [--dry] [--type INTP]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..')
const DRAFT_DIR = join(ROOT, 'content-marketing', 'automation', 'drafts')

const TAIL = '（本内容由本人策划，AI 辅助生成人格插画与剪辑，正文由本人撰写。）'
const SIGNATURE = 'AI 辅助生成人格插画与剪辑'

interface Copy { platform: string; description: string; [k: string]: unknown }
interface Draft { copies?: Copy[]; typeCode?: string; [k: string]: unknown }

function parseArgs() {
  const a = process.argv.slice(2)
  const opts: { dry: boolean; type?: string } = { dry: false }
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    if (x === '--dry') opts.dry = true
    else if (x === '--type' || x === '--code') opts.type = String(a[++i] || '').toUpperCase()
  }
  return opts
}

const opts = parseArgs()
const files = readdirSync(DRAFT_DIR).filter(n => n.endsWith('.json'))
let touched = 0
for (const name of files) {
  const p = join(DRAFT_DIR, name)
  const draft = JSON.parse(readFileSync(p, 'utf-8')) as Draft
  if (opts.type && draft.typeCode?.toUpperCase() !== opts.type) continue
  let changed = false
  for (const c of draft.copies || []) {
    if (typeof c.description !== 'string') continue
    if (c.description.includes(SIGNATURE)) continue
    c.description = c.description.replace(/\s+$/, '') + '\n\n' + TAIL
    changed = true
  }
  if (changed) {
    touched++
    if (!opts.dry) writeFileSync(p, JSON.stringify(draft, null, 2), 'utf-8')
    console.log(`${opts.dry ? '[DRY]' : '[OK]'} ${name}`)
  }
}
console.log(`\n共处理 ${touched} 个草稿${opts.dry ? '（dry-run）' : ''}`)
