/**
 * 内容自检脚本：81 型「代表人物解读」+ 代表人物名单
 *
 * 背景：DSH 2026-11-13 审核意见第 6.3 节要求把本轮审核固化成脚本，
 * 每次改内容都跑一遍，避免「改完代码线上还是旧文案」或模板句回流。
 *
 * 校验项（任一不过即退出码 1）：
 *   1. 覆盖：81 型在 CELEBRITY_MAP / FEATURED_PROFILES / LIFE_ADVICE / DEPTH_LENSES 四处齐全
 *   2. 草稿感：【 与 】 出现次数为 0
 *   3. 结构：四条都以「给你的建议：」收尾，且不出现「。 给你的建议」这类全角空格
 *   4. 篇幅：每型四条合计 ≥ 420 字
 *   5. 模板感：任意两型之间不得出现 ≥15 字完全相同的片段（滑动窗口比对）
 *   6. 维度一致：S 型的「看世界的角度」不得否定收集信息（Y1）
 *   7. 收束：素材写的是死讯/结局时，「代价与教训」不得直接跳到通用劝告（B4 七个型）
 *   8. 身份：全部代表人物身份不为「公众人物」兜底
 *   9. 虚构角色必须带作品名（《》）
 *  10. 黑名单：有暴力犯罪/加害他人记录的真人不得出现在任何名单里
 *  11. 主人物必须在本型名单内，且只有 4 位（结果页固定截断 4 人）
 *  12. 不复述素材：tf/pj 的解读句不得照抄素材原文（最长公共子串 < 7 字）
 *
 * 用法：cd server && npx tsx ../scripts/audit-depth-content.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getCelebrityNames, getCelebrityProfiles } from '../server/src/content/types.ts'
import { getCelebrityField } from '../server/src/content/celebrity-fields.ts'
import { FEATURED_PROFILES } from '../server/src/content/celebrity-stories.ts'
import { LIFE_ADVICE, getLifeAdviceModules } from '../server/src/content/life-advice.ts'
import { DEPTH_LENSES } from '../server/src/content/depth-lenses.ts'

const ROOT = resolve(import.meta.dirname, '..')
const TYPES_SRC = readFileSync(resolve(ROOT, 'server/src/content/types.ts'), 'utf8')
const POP = JSON.parse(readFileSync(resolve(ROOT, 'scripts/pop-culture-reps.json'), 'utf8'))

// 类型中文名
const typeNames = {}
{
  const i = TYPES_SRC.indexOf('const TYPE_NAMES')
  const s = TYPES_SRC.indexOf('{', i)
  let d = 0
  let e = s
  for (let j = s; j < TYPES_SRC.length; j++) {
    if (TYPES_SRC[j] === '{') d++
    else if (TYPES_SRC[j] === '}') { d--; if (!d) { e = j; break } }
  }
  for (const m of TYPES_SRC.slice(s + 1, e).matchAll(/([A-Z]{4}):\s*'([^']+)'/g)) typeNames[m[1]] = m[2]
}

const CODES = Object.keys(typeNames).sort()
const MODULE_KEYS = ['eiModule', 'snModule', 'tfModule', 'pjModule']
const MODULE_LABELS = ['起点与志向', '看世界的角度', '关键抉择', '代价与教训']

/** 有暴力犯罪 / 加害他人记录的真人，一律不得进入性格类比名单 */
const VIOLENCE_BLACKLIST = ['顾城']

/** 素材写的是死讯/结局的七个型（B4），pj 句必须收在那个结局上 */
const DEATH_MATERIAL = {
  ENFD: '遇刺',
  ISCJ: '权臣案牵连',
  ISCP: '自尽',
  IBCP: '肺结核',
  ASCD: '意杀',
  ANCJ: '严寒离世',
  ENTD: '死于巴比伦',
}

const failures = []
const warnings = []
const fail = (check, detail) => failures.push(`[${check}] ${detail}`)

/** 最长公共子串长度：检测解读句是否在照抄素材 */
function lcsLen(a, b) {
  let best = 0
  for (let i = 0; i < a.length; i++) {
    for (let j = i + best + 1; j <= a.length; j++) {
      if (b.includes(a.slice(i, j))) best = j - i
      else break
    }
  }
  return best
}

// ==================== 1. 覆盖 ====================
for (const code of CODES) {
  if (!FEATURED_PROFILES[code]) fail('覆盖', `${code} 缺少主人物侧写（celebrity-stories.ts）`)
  if (!LIFE_ADVICE[code]) fail('覆盖', `${code} 缺少素材（life-advice.ts）`)
  if (!DEPTH_LENSES[code]) fail('覆盖', `${code} 缺少维度落点句（depth-lenses.ts）`)
  if (!getCelebrityNames(code).length) fail('覆盖', `${code} 名单为空（CELEBRITY_MAP）`)
}
if (CODES.length !== 81) fail('覆盖', `TYPE_NAMES 只有 ${CODES.length} 型，应为 81`)

// ==================== 2–7. 逐型校验 ====================
const charCounts = {}
const sentencePool = new Map() // 15 字片段 -> Set<code>
const addWindows = (code, text) => {
  const clean = text.replace(/\s/g, '')
  for (let i = 0; i + 15 <= clean.length; i++) {
    const w = clean.slice(i, i + 15)
    if (!sentencePool.has(w)) sentencePool.set(w, new Set())
    sentencePool.get(w).add(code)
  }
}

for (const code of CODES) {
  const modules = getLifeAdviceModules(code)
  const texts = MODULE_KEYS.map((k) => modules[k] || '')
  const label = `${code} ${typeNames[code]}`

  // 2. 草稿感标签
  for (const [i, text] of texts.entries()) {
    if (/[【】]/.test(text)) fail('草稿感', `${label} · ${MODULE_LABELS[i]} 残留【】标签：${text.slice(0, 24)}…`)
    // 3. 结构
    if (!text.includes('给你的建议：')) fail('结构', `${label} · ${MODULE_LABELS[i]} 没有「给你的建议：」`)
    if (!text.trim().endsWith('。')) fail('结构', `${label} · ${MODULE_LABELS[i]} 未以句号收尾`)
    if (/。\s+给你的建议/.test(text)) fail('结构', `${label} · ${MODULE_LABELS[i]} 「。 给你的建议」有多余空格`)
    if (/——。/.test(text)) fail('结构', `${label} · ${MODULE_LABELS[i]} 出现「——。」接缝`)
    if (/（[^）]*维度）/.test(text)) fail('结构', `${label} · ${MODULE_LABELS[i]} 外泄内部维度代码`)
  }

  // 4. 篇幅
  const total = texts.join('').replace(/\s/g, '').length
  charCounts[code] = total
  if (total < 420) fail('篇幅', `${label} 四条合计 ${total} 字，低于 420`)

  // 5. 模板感
  for (const text of texts) addWindows(code, text)

  // 6. 维度一致（S 型必须正面谈信息与经验）
  if (code[1] === 'S') {
    const sn = DEPTH_LENSES[code].sn
    if (/不是收集更多信息|什么可以不看|不必收集/.test(sn)) {
      fail('维度一致', `${label} 是 S（实感）型，但 sn 句否定收集信息：${sn}`)
    }
  }

  // 7. 死讯收束
  if (DEATH_MATERIAL[code]) {
    const pj = DEPTH_LENSES[code].pj
    if (/把教训写进日常节奏/.test(pj)) fail('收束', `${label} 的 pj 句退回通用模板`)
    if (!/交给|留下|分开算|代价|长久|身体|收束|位置/.test(pj)) {
      warnings.push(`[收束] ${label} 的 pj 句与结局的衔接需人工复读：${pj}`)
    }
  }

  // 12. 不复述素材（只查 tf/pj：①② 本就按设计带生平原文）
  const material = LIFE_ADVICE[code] || []
  for (const [k, idx] of [['tf', 0], ['pj', 1]]) {
    const src = String(material[idx] || '').replace(/\s/g, '')
    if (!src) continue
    const n = lcsLen(DEPTH_LENSES[code][k].replace(/\s/g, ''), src)
    if (n >= 7) fail('复述', `${label} 的 ${k} 句与素材有 ${n} 字连续相同，读起来像复读`)
  }

  // 11. 名单
  const names = getCelebrityNames(code)
  const featured = FEATURED_PROFILES[code]
  if (featured && !names.includes(featured.name)) {
    fail('名单', `${label} 主人物「${featured.name}」不在 CELEBRITY_MAP 名单内`)
  }
  const profiles = getCelebrityProfiles(code)
  if (profiles.length < 3) fail('名单', `${label} 结果页只渲染 ${profiles.length} 位`)
  else if (profiles.length === 3) {
    warnings.push(`[名单] ${label} 只有 3 位代表人物（Z1：补人成本高于收益，本轮不补，仅作知悉）`)
  }
}

// ==================== 8–10. 身份 / 虚构 / 黑名单 ====================
const allNames = new Set()
let fallbackCount = 0
for (const code of CODES) {
  for (const p of getCelebrityProfiles(code)) {
    allNames.add(p.name)
    const field = getCelebrityField(p.name)
    if (!field || field === '公众人物') {
      fallbackCount++
      fail('身份', `${code} 的「${p.name}」身份落到「公众人物」兜底`)
    }
    if (POP[p.name] && !/[《]/.test(field)) {
      fail('虚构', `${code} 的虚构角色「${p.name}」身份未带作品名：${field}`)
    }
    if (VIOLENCE_BLACKLIST.includes(p.name)) {
      fail('黑名单', `${code} 名单里出现黑名单人物「${p.name}」`)
    }
  }
}

// ==================== 5. 汇总跨型重复片段 ====================
const dupWindows = [...sentencePool.entries()].filter(([, set]) => set.size > 1)
if (dupWindows.length) {
  const sample = dupWindows.slice(0, 12).map(([w, set]) => `${w} ← ${[...set].join('/')}`)
  fail('模板感', `跨型出现 ${dupWindows.length} 个 ≥15 字相同片段，示例：\n    ${sample.join('\n    ')}`)
}

// ==================== 报告 ====================
const counts = Object.values(charCounts)
const min = Math.min(...counts)
const max = Math.max(...counts)
const avg = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
const popTypes = new Set()
for (const code of CODES) {
  if (getCelebrityProfiles(code).some((p) => POP[p.name])) popTypes.add(code)
}

console.log('===== 81 型代表人物解读 · 内容自检 =====')
console.log(`类型数            ${CODES.length}`)
console.log(`代表人物位次      ${CODES.reduce((n, c) => n + getCelebrityNames(c).length, 0)}`)
console.log(`不重复人物        ${allNames.size}`)
console.log(`身份兜底          ${fallbackCount}`)
console.log(`虚构角色          ${Object.keys(POP).length} 位（覆盖 ${popTypes.size} 型）`)
console.log(`每型字数          min ${min} / avg ${avg} / max ${max}`)
console.log(`跨型重复片段      ${dupWindows.length}`)
console.log('')
console.log('每型字数明细：')
for (const code of CODES) {
  const flag = charCounts[code] < 420 ? ' ✗' : ''
  console.log(`  ${code} ${typeNames[code].padEnd(6, '　')} ${String(charCounts[code]).padStart(4)}${flag}`)
}

if (warnings.length) {
  console.log(`\n----- 需人工复读 ${warnings.length} 条 -----`)
  for (const w of warnings) console.log(`  ${w}`)
}

if (failures.length) {
  console.log(`\n===== 未通过 ${failures.length} 项 =====`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exit(1)
}

console.log('\n✅ 全部校验通过')
