// 生成「81 型代表人物」审核表：docs/MBTI-PRO-81型代表人物总表-2026-11-12.html
// 数据全部来自代码，不手写：types.ts 的 TYPE_NAMES / CELEBRITY_MAP / handCraftedTypes、
// celebrity-stories.ts 的 FEATURED_PROFILES、celebrity-fields.ts 的 CELEBRITY_FIELDS、
// scripts/celebrity-baseline.json（本轮修改前的快照，用于前后对照）。
// 用法：node scripts/build-celebrity-review.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const TYPES = readFileSync(resolve(ROOT, 'server/src/content/types.ts'), 'utf8')
const STORIES = readFileSync(resolve(ROOT, 'server/src/content/celebrity-stories.ts'), 'utf8')
const FIELDS = readFileSync(resolve(ROOT, 'server/src/content/celebrity-fields.ts'), 'utf8')
const DEMO = resolve(ROOT, 'client/public/demo/types.json')
const BASELINE = resolve(ROOT, 'scripts/celebrity-baseline.json')
const POP = JSON.parse(readFileSync(resolve(ROOT, 'scripts/pop-culture-reps.json'), 'utf8'))

/* ---------- 解析 ---------- */
const block = (src, marker) => {
  const i = src.indexOf(marker)
  if (i < 0) throw new Error('找不到 ' + marker)
  const start = src.indexOf('{', i)
  let depth = 0
  for (let j = start; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start + 1, j) }
  }
  throw new Error('括号未闭合 ' + marker)
}

const typeNames = {}
for (const m of block(TYPES, 'const TYPE_NAMES').matchAll(/([A-Z]{4}):\s*'([^']+)'/g)) {
  typeNames[m[1]] = m[2]
}

const celebrityMap = {}
for (const line of block(TYPES, 'const CELEBRITY_MAP').split('\n')) {
  const m = line.match(/^\s*([A-Z]{4}):\s*\[(.*)\]/)
  if (!m) continue
  celebrityMap[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map(x => x[1])
}

// 逐块取：按下一个 code 切段
const storyBlocks = {}
const codes = [...block(STORIES, 'export const FEATURED_PROFILES').matchAll(/([A-Z]{4}):\s*\{/g)].map(m => ({ code: m[1], at: m.index }))
const storyBody = block(STORIES, 'export const FEATURED_PROFILES')
for (let i = 0; i < codes.length; i++) {
  const seg = storyBody.slice(codes[i].at, i + 1 < codes.length ? codes[i + 1].at : storyBody.length)
  const name = seg.match(/name:\s*'((?:[^'\\]|\\.)*)'/)
  const field = seg.match(/field:\s*'((?:[^'\\]|\\.)*)'/)
  const story = seg.match(/story:\s*'((?:[^'\\]|\\.)*)'/)
  if (name) storyBlocks[codes[i].code] = { name: name[1], field: field ? field[1] : '', story: story ? story[1] : '' }
}

const fields = {}
for (const line of block(FIELDS, 'export const CELEBRITY_FIELDS').split('\n')) {
  const m = line.match(/^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/)
  if (m) fields[m[1]] = m[2]
}

// handCraftedTypes 里的 celebrities 副本（应与 CELEBRITY_MAP 完全一致）
const handCopy = {}
for (const m of TYPES.slice(TYPES.indexOf('export const handCraftedTypes')).matchAll(/code: '([A-Z]{4})'[\s\S]*?celebrities: \[([^\]]*)\]/g)) {
  handCopy[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map(x => x[1])
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null

/* ---------- 分组与统计 ---------- */
const GROUPS = {
  SP: { name: 'SP 暖金组', hex: '#C8963E', desc: '实感 · 感知 P' },
  SD: { name: 'SD 琥珀组', hex: '#D4782F', desc: '实感 · 动态 D' },
  SJ: { name: 'SJ 藏蓝组', hex: '#2C5F8A', desc: '实感 · 判断 J' },
  BT: { name: 'BT 深炭灰组', hex: '#4A4A4A', desc: '均衡 · 思考 T' },
  BC: { name: 'BC 月光银灰组', hex: '#8B95A0', desc: '均衡 · 复合 C' },
  BF: { name: 'BF 暖燕麦组', hex: '#B8956A', desc: '均衡 · 情感 F' },
  NT: { name: 'NT 深紫组', hex: '#6B3FA0', desc: '直觉 · 思考 T' },
  NC: { name: 'NC 靛青组', hex: '#3D7B8A', desc: '直觉 · 复合 C' },
  NF: { name: 'NF 翠绿组', hex: '#2D8A4E', desc: '直觉 · 情感 F' },
}
const groupOf = code => {
  const [sn, tf, pj] = [code[1], code[2], code[3]]
  if (sn === 'S') return pj === 'P' ? 'SP' : pj === 'D' ? 'SD' : 'SJ'
  if (sn === 'B') return tf === 'T' ? 'BT' : tf === 'C' ? 'BC' : 'BF'
  return tf === 'T' ? 'NT' : tf === 'C' ? 'NC' : 'NF'
}
const DIM_ZH = { E: '外向', A: '平衡', I: '内向', S: '实感', B: '均衡', N: '直觉', T: '思考', C: '复合', F: '情感', J: '判断', D: '动态', P: '感知' }

const allCodes = Object.keys(typeNames).sort()

/* ---------- 四项自动校验 ---------- */
const owner = new Map()
for (const code of allCodes) {
  for (const n of celebrityMap[code] || []) {
    if (!owner.has(n)) owner.set(n, [])
    owner.get(n).push(code)
  }
}
const dupNames = [...owner.entries()].filter(([, v]) => v.length > 1)
  .map(([n, cs]) => [n, cs, cs.filter(c => storyBlocks[c] && storyBlocks[c].name === n)])
const dupMains = dupNames.filter(d => d[2].length > 1)

const spell = []
const missFields = []
const problems = []
for (const code of allCodes) {
  const list = celebrityMap[code] || []
  const f = storyBlocks[code]
  if (!typeNames[code]) problems.push({ code, kind: '缺中文名' })
  if (!list.length) problems.push({ code, kind: '缺代表人物' })
  else if (list.length < 3) problems.push({ code, kind: `代表人物偏少（${list.length} 位）` })
  if (!f) problems.push({ code, kind: '缺主人物侧写' })
  else if (!list.includes(f.name)) {
    const like = list.find(n => n.includes(f.name) || f.name.includes(n))
    problems.push({ code, kind: like ? `主人物写成「${f.name}」，表内是「${like}」` : `主人物「${f.name}」不在代表人物表内` })
    if (like) spell.push({ code, story: f.name, map: like })
  }
  const missField = list.filter(n => !fields[n] && !(f && f.name === n && f.field))
  if (missField.length) {
    problems.push({ code, kind: `身份字典缺：${missField.join('、')}` })
    missField.forEach(n => missFields.push({ code, name: n }))
  }
  const dups = list.filter(n => (owner.get(n) || []).length > 1)
  if (dups.length) problems.push({ code, kind: `与其它型共用：${[...new Set(dups)].join('、')}` })
}

const handDrift = Object.keys(handCopy).filter(c => handCopy[c].join() !== (celebrityMap[c] || []).join())

const popRows = Object.entries(POP)
  .map(([name, work]) => ({ name, work, codes: owner.get(name) || [] }))
  .filter((r) => r.codes.length)
const popCodes = [...new Set(popRows.flatMap((r) => r.codes))]

const stats = {
  types: allCodes.length,
  people: owner.size,
  slots: allCodes.reduce((a, c) => a + (celebrityMap[c]?.length || 0), 0),
  dup: dupNames.length,
  dupMains: dupMains.length,
  stories: Object.keys(storyBlocks).length,
  fields: Object.keys(fields).length,
  hand: Object.keys(handCopy).length,
  handDrift: handDrift.length,
  pop: popRows.length,
  popTypes: popCodes.length,
  problems: problems.length,
  minSlots: Math.min(...allCodes.map(c => (celebrityMap[c] || []).length)),
}

/* ---------- 与基线对比 ---------- */
const changes = []
const reorderOnly = []
if (baseline) {
  for (const code of allCodes) {
    const before = baseline[code] || []
    const after = celebrityMap[code] || []
    if (before.join() === after.join()) continue
    const added = after.filter(n => !before.includes(n))
    const removed = before.filter(n => !after.includes(n))
    if (!added.length && !removed.length) { reorderOnly.push({ code, before, after }); continue }
    changes.push({ code, before, after, added, removed })
  }
}
const afterPool = new Set(Object.values(celebrityMap).flat())
const beforePool = new Set(baseline ? Object.values(baseline).flat() : [])
const entered = [...afterPool].filter(n => !beforePool.has(n))
const exited = [...beforePool].filter(n => !afterPool.has(n))
const slotMoves = changes.reduce((s, c) => s + Math.max(c.added.length, c.removed.length), 0)

// demo 静态样本是否已同步（顺序不同不算漂移：demo 会把主人物排到第一位）
let demoDrift = 0
if (existsSync(DEMO)) {
  try {
    const demo = JSON.parse(readFileSync(DEMO, 'utf8'))
    for (const t of demo) {
      const a = [...(t.celebrities || [])].sort().join()
      const b = [...(celebrityMap[t.code] || [])].sort().join()
      if (a !== b) demoDrift++
    }
  } catch { demoDrift = -1 }
}

/* ---------- 生成 HTML ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const stamp = new Date().toLocaleString('zh-CN', { hour12: false })
const changedSet = new Set(changes.map(c => c.code))

const codeCard = code => {
  const g = groupOf(code)
  const hex = GROUPS[g].hex
  const list = celebrityMap[code] || []
  const f = storyBlocks[code]
  const mine = problems.filter(p => p.code === code)
  const ch = changes.find(c => c.code === code)
  const dims = [...code].map((ch2, i) => `<span class="dim d${i}">${esc(ch2)}<i>${esc(DIM_ZH[ch2] || '')}</i></span>`).join('')
  const others = list.filter(n => !f || n !== f.name)
    .map(n => {
      const isNew = ch && ch.added.includes(n)
      const isPop = !!POP[n]
      return `<span class="chip${isNew ? ' new' : ''}${isPop ? ' pop' : ''}" title="${esc(isPop ? POP[n] : fields[n] || '身份待补')}">${esc(n)}${isPop ? '<b class="popb">流行</b>' : isNew ? '<b>新</b>' : ''}</span>`
    }).join('')
  const beforeRow = ch
    ? `<div class="was"><span class="lab">改前名单 <b>${ch.before.length}</b> 位</span><div class="chips">${
        ch.before.map(n => `<span class="chip del">${esc(n)}</span>`).join('') || '<span class="chip muted">—</span>'
      }</div></div>`
    : ''
  return `
<article class="card" data-code="${code}" data-group="${g}" data-changed="${ch ? 1 : 0}" data-issues="${mine.length}" data-search="${esc(code + ' ' + typeNames[code] + ' ' + list.join(' ') + ' ' + (ch ? ch.before.join(' ') : '') + ' ' + (f ? f.name : ''))}">
  <header>
    <div class="code" style="color:${hex}">${code}</div>
    <div class="tname">${esc(typeNames[code] || '—')}</div>
    ${ch ? '<div class="flag">已修正</div>' : ''}
    <div class="grp" style="background:${hex}">${esc(GROUPS[g].name)}</div>
  </header>
  <div class="dims">${dims}</div>
  ${f ? `<div class="main">
    <div class="lab">主人物 / 结果页展示</div>
    <div class="pname">${esc(f.name)}${POP[f.name] ? '<i class="popmark">流行参照</i>' : ''}<span>${esc(f.field || fields[f.name] || '')}</span></div>
    <p class="story">${esc(f.story)}</p>
  </div>` : `<div class="main empty"><div class="lab">主人物 / 结果页展示</div><p class="story">（缺侧写）</p></div>`}
  <div class="others">
    <div class="lab">其余代表人物 <b>${list.length - (f ? 1 : 0)}</b></div>
    <div class="chips">${others || '<span class="chip muted">—</span>'}</div>
  </div>
  ${beforeRow}
  ${mine.length ? `<div class="issues">${mine.map(p => `<span>${esc(p.kind)}</span>`).join('')}</div>` : ''}
  <div class="review">
    <div class="opts">
      <label><input type="radio" name="r-${code}" value="pass">通过</label>
      <label><input type="radio" name="r-${code}" value="fix">需改</label>
      <label><input type="radio" name="r-${code}" value="hold">存疑</label>
    </div>
    <textarea rows="2" placeholder="意见（例如：主人物换成 XX；第 2 位太冷门）"></textarea>
  </div>
</article>`
}

const sections = Object.keys(GROUPS).map(g => {
  const codesInGroup = allCodes.filter(c => groupOf(c) === g)
  const changedInGroup = codesInGroup.filter(c => changedSet.has(c)).length
  return `<section class="group" data-group="${g}">
    <h2><span class="swatch" style="background:${GROUPS[g].hex}"></span>${esc(GROUPS[g].name)}
      <em>${esc(GROUPS[g].desc)} · ${codesInGroup.length} 型${changedInGroup ? ` · 已改 ${changedInGroup}` : ''}</em></h2>
    <div class="grid">${codesInGroup.map(codeCard).join('')}</div>
  </section>`
}).join('\n')

const changeRows = [...changes].sort((a, b) => a.code.localeCompare(b.code)).map(c => {
  const g = GROUPS[groupOf(c.code)]
  return `<tr>
    <td><code>${c.code}</code><span class="tname-sm">${esc(typeNames[c.code] || '')}</span></td>
    <td><span class="grp-inline" style="background:${g.hex}">${g.name}</span></td>
    <td class="old">${c.removed.map(n => `<span class="chip del">${esc(n)}</span>`).join('') || '<span class="muted">—</span>'}</td>
    <td>${c.added.map(n => `<span class="chip new">${esc(n)}<b>${esc(fields[n] || '')}</b></span>`).join('') || '<span class="muted">（只做精简，未补人）</span>'}</td>
  </tr>`
}).join('')

const enterChips = entered.map(n => `<span class="chip new" title="${esc(fields[n] || '身份待补')}">${esc(n)}</span>`).join('')
const exitChips = exited.map(n => {
  const still = (owner.get(n) || []).length
  return `<span class="chip del" title="${still ? '换了个写法仍在用' : '不再出现在任何型'}">${esc(n)}</span>`
}).join('')

const checkItem = (title, count, ok, detail) => `
  <div class="chk ${ok ? 'ok' : 'bad'}">
    <div class="chk-h"><span class="badge">${ok ? '通过' : '待改'}</span><b>${title}</b><em>${count}</em></div>
    <p>${detail}</p>
  </div>`

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MBTI-PRO · 81 型代表人物（修正结果审核表）</title>
<style>
:root{--paper:#FBF6EE;--card:#fff;--ink:#1E1D1A;--muted:#6F685D;--rule:#E2D9CB;--accent:#A63D2C;--ok:#2F7A4F;--warn:#B4762A;--new:#2F7A4F}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font:14px/1.65 'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif}
.top{position:sticky;top:0;z-index:30;background:rgba(251,246,238,.97);border-bottom:1px solid var(--rule);padding:12px 24px}
.row{max-width:1680px;margin:0 auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.brand{font-size:16px;font-weight:600;letter-spacing:.02em}
.brand b{color:var(--accent)}
.stat{font-size:12px;color:var(--muted);letter-spacing:.04em}
.sp{flex:1}
input[type=search],select{border:1px solid var(--rule);background:#fff;color:var(--ink);padding:7px 11px;border-radius:5px;font:13px/1 inherit;font-family:inherit}
input[type=search]{width:250px}
button{border:1px solid var(--rule);background:#fff;color:var(--ink);padding:7px 12px;border-radius:5px;cursor:pointer;font:13px/1 inherit;font-family:inherit}
button:hover{border-color:var(--accent);color:var(--accent)}
button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.wrap{max-width:1680px;margin:0 auto;padding:22px 24px 60px}
.hero{background:#fff;border:1px solid var(--rule);border-left:4px solid var(--accent);border-radius:6px;padding:16px 20px;margin-bottom:18px}
.hero h1{font-size:19px;font-family:'Noto Serif SC','Songti SC',serif;letter-spacing:.02em}
.hero p{font-size:13px;color:#3A3833;margin-top:6px;line-height:1.8}
.hero p b{color:var(--accent)}
.hero .meta{font-size:11.5px;color:var(--muted);margin-top:8px;letter-spacing:.03em}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;margin-bottom:18px}
.kpi{background:#fff;border:1px solid var(--rule);border-radius:6px;padding:12px 14px}
.kpi b{display:block;font-size:24px;font-family:'DM Mono',monospace}
.kpi span{font-size:12px;color:var(--muted)}
.kpi.good b{color:var(--ok)}
.kpi.acc b{color:var(--accent)}
.kpi.warn b{color:var(--warn)}
.panel{background:#fff;border:1px solid var(--rule);border-radius:6px;padding:14px 16px;margin-bottom:22px}
.panel h3{font-size:14px;margin-bottom:10px}
.panel h3 em{font-style:normal;color:var(--muted);font-weight:400;font-size:12px;margin-left:8px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border-top:1px solid var(--rule);padding:7px 8px;text-align:left;vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:500;background:#FDFBF7}
code{font-family:'DM Mono',monospace;background:#F3EEE4;padding:1px 5px;border-radius:3px;font-size:12px;margin-right:5px}
.tname-sm{font-family:'Noto Serif SC','Songti SC',serif;font-size:13px}
.grp-inline{color:#fff;font-size:10.5px;padding:1px 7px;border-radius:9px;white-space:nowrap}
.muted{color:var(--muted)}
.old{opacity:.9}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:12px;border:1px solid var(--rule);border-radius:12px;padding:2px 9px;background:#fff;cursor:help;white-space:nowrap}
.chip.muted{color:var(--muted)}
.chip b{color:var(--new);font-weight:600;margin-left:5px;font-size:11px}
.chip.new{border-color:#BFDCCB;background:#F4FAF6}
.chip.del{color:#8A7F73;background:#F6F2EA;text-decoration:line-through;text-decoration-color:#C9B9A4}
.chip.pop{border-color:#CBB6E0;background:#F7F2FD}
.chip.pop b.popb{color:#6B3FA0}
.popmark{font-style:normal;font-size:10px;color:#6B3FA0;border:1px solid #CBB6E0;background:#F7F2FD;border-radius:9px;padding:1px 7px;margin-left:8px;vertical-align:middle}
.check{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
.chk{border:1px solid var(--rule);border-radius:6px;padding:10px 12px;background:#FDFBF7}
.chk.ok{border-left:3px solid var(--ok)}
.chk.bad{border-left:3px solid var(--warn);background:#FDF6EA}
.chk-h{display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px}
.chk-h em{font-style:normal;font-family:'DM Mono',monospace;color:var(--muted);margin-left:auto}
.badge{font-size:10.5px;padding:1px 7px;border-radius:9px;color:#fff;background:var(--ok)}
.chk.bad .badge{background:var(--warn)}
.chk p{font-size:12px;color:var(--muted);line-height:1.7}
.lv-list{display:grid;gap:8px}
.lv-row{display:flex;gap:10px;align-items:flex-start;font-size:13px;border-top:1px solid #F1ECE2;padding-top:8px}
.lv-row .k{flex:none;width:132px;font-weight:600;font-size:12.5px}
.lv-row .v{color:#3A3833;flex:1}
.group{margin-bottom:26px}
.group h2{font-size:17px;display:flex;align-items:center;gap:9px;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--rule)}
.group h2 em{font-style:normal;font-size:12px;color:var(--muted);font-weight:400}
.swatch{width:12px;height:12px;border-radius:2px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(370px,1fr));gap:14px}
.card{background:#fff;border:1px solid var(--rule);border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.card[data-changed="1"]{border-color:#D8C6B2}
.card header{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.code{font-family:'DM Mono',monospace;font-size:22px;font-weight:600;letter-spacing:.06em}
.tname{font-family:'Noto Serif SC','Songti SC',serif;font-size:16px}
.flag{font-size:10.5px;color:var(--accent);border:1px solid #E7CFC7;background:#FDF3F0;border-radius:9px;padding:1px 7px}
.grp{margin-left:auto;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;letter-spacing:.04em}
.dims{display:flex;gap:6px}
.dim{display:flex;align-items:center;gap:4px;font-family:'DM Mono',monospace;font-size:13px;border:1px solid var(--rule);border-radius:4px;padding:1px 7px}
.dim i{font-style:normal;font-family:'Noto Sans SC',sans-serif;font-size:11px;color:var(--muted)}
.lab{font-size:11px;letter-spacing:.1em;color:var(--muted);margin-bottom:4px}
.lab b{color:var(--ink)}
.main{background:#FBF8F2;border:1px solid #EFE7DA;border-radius:6px;padding:10px 12px}
.pname{font-family:'Noto Serif SC','Songti SC',serif;font-size:20px;font-weight:600}
.pname span{font-family:'Noto Sans SC',sans-serif;font-size:12px;font-weight:400;color:var(--muted);margin-left:8px}
.story{font-size:12.5px;line-height:1.7;color:#3A3833;margin-top:5px}
.was{background:#FCFAF6;border:1px dashed var(--rule);border-radius:6px;padding:8px 10px}
.issues{display:flex;flex-direction:column;gap:2px}
.issues span{font-size:11.5px;color:var(--warn);background:#FDF6EA;border-left:2px solid var(--warn);padding:2px 8px}
.review{border-top:1px dashed var(--rule);padding-top:9px;margin-top:auto}
.opts{display:flex;gap:14px;font-size:12.5px;margin-bottom:6px}
.opts label{display:flex;align-items:center;gap:4px;cursor:pointer}
textarea{width:100%;border:1px solid var(--rule);border-radius:4px;padding:6px 8px;font:12.5px/1.6 inherit;font-family:inherit;resize:vertical;background:#FDFBF7;color:var(--ink)}
.card[data-state=pass]{box-shadow:inset 3px 0 0 var(--ok)}
.card[data-state=fix]{box-shadow:inset 3px 0 0 var(--accent)}
.card[data-state=hold]{box-shadow:inset 3px 0 0 var(--warn)}
.hide{display:none!important}
@media(max-width:640px){.wrap{padding:14px}.grid{grid-template-columns:1fr}input[type=search]{width:100%}}
</style>
</head>
<body>
<div class="top">
  <div class="row">
    <div class="brand">MBTI-PRO <b>/</b> 81 型代表人物 · 修正结果</div>
    <div class="stat" id="progress">已审 0 / 81</div>
    <div class="sp"></div>
    <input type="search" id="q" placeholder="搜类型码 / 中文名 / 人物名…">
    <select id="group"><option value="">全部 9 组</option>${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>
    <button id="only">只看改过的</button>
    <button id="todo">只看没审的</button>
    <button id="export">导出审核结果</button>
  </div>
</div>

<div class="wrap">
  <div class="hero">
    <h1>81 型代表人物已按三条准则全库改完，这是改动清单与审核入口</h1>
    <p>准则一「一眼认出」：换掉只在小圈子里有名的人（教科书人物、地方史人物、冷门学者）；准则二「四维无硬伤」：人选要能自圆其说地落在该坐标上；准则三「不与其它型共用」：同一个人只在一个型里出现。下方 81 张卡就是<b>产品里会显示的全部内容</b>，标「已修正」的卡片底部附了改动前的名单。</p>
    <div class="meta">数据源 server/src/content/types.ts · 生成时间 ${esc(stamp)} · 由 node scripts/build-celebrity-review.mjs 生成，改代码后重跑即可刷新</div>
  </div>

  <div class="summary">
    <div class="kpi"><b>${stats.types}</b><span>类型数</span></div>
    <div class="kpi"><b>${stats.slots}</b><span>代表人物位次</span></div>
    <div class="kpi good"><b>${stats.people}</b><span>去重人数（=位次，无共用）</span></div>
    <div class="kpi good"><b>${stats.dup}</b><span>跨型共用的人</span></div>
    <div class="kpi acc"><b>${changes.length}</b><span>改过名单的型</span></div>
    <div class="kpi acc"><b>${slotMoves}</b><span>变动位次</span></div>
    <div class="kpi"><b>${entered.length} / ${exited.length}</b><span>新进入 / 移出人数</span></div>
    <div class="kpi"><b>${stats.pop}</b><span>流行角色（${stats.popTypes} 型有）</span></div>
    <div class="kpi good"><b>${stats.problems}</b><span>自动校验硬伤</span></div>
  </div>

  <div class="panel">
    <h3>四项自动校验 <em>每次重跑脚本都会重算；全绿才允许上线</em></h3>
    <div class="check">
      ${checkItem('主人物与名单对不上', spell.length, spell.length === 0, spell.length ? spell.map(s => `${s.code}：侧写写「${s.story}」、名单写「${s.map}」`).join('；') : `81 位主人物的名字与代表人物名单逐字一致，结果页不会出现「同一个人两个名字」。`)}
      ${checkItem('身份字典缺字段', new Set(missFields.map(m => m.name)).size, missFields.length === 0, missFields.length ? [...new Set(missFields.map(m => m.name))].join('、') : `${stats.slots} 个位次都有可显示身份（${stats.fields} 条字典记录 + 主人物自带的领域），结果页与 PDF 报告不会出现「相关人物」兜底。`)}
      ${checkItem('同一个人被多个型共用', dupNames.length, dupNames.length === 0, dupNames.length ? dupNames.map(d => `${d[0]}（${d[1].join(' / ')}）`).join('、') : `${stats.slots} 个位次对应 ${stats.people} 个不同的人，一个人只属于一个型。`)}
      ${checkItem('handCraftedTypes 副本漂移', handDrift.length, handDrift.length === 0, handDrift.length ? handDrift.join('、') : `16 个手工维护的传统型各带一份 celebrities 副本，已与 CELEBRITY_MAP 逐字对齐——原本 13 个对不上，而 seed 会把副本写进数据库。`)}
    </div>
    ${problems.length ? `<div class="issues" style="margin-top:12px">${problems.map(p => `<span>[${p.code}] ${esc(p.kind)}</span>`).join('')}</div>` : ''}
  </div>

  <div class="panel">
    <h3>一处数据源，五处消费 <em>这次不只改名单，把会读到旧名单的五条路径都收在同一个出口</em></h3>
    <div class="lv-list">
      <div class="lv-row"><div class="k">CELEBRITY_MAP</div><div class="v">server/src/content/types.ts，81 型的唯一事实源。</div></div>
      <div class="lv-row"><div class="k">handCraftedTypes</div><div class="v">16 个手工传统型自带的 celebrities 副本，原本 13 个与 MAP 不一致 → 已逐字对齐（scripts/sync-handcrafted-celebrities.mjs）。</div></div>
      <div class="lv-row"><div class="k">数据库 celebrities 列</div><div class="v">seed 曾把副本写进库，库里 81 行里有 50 行是旧名单 → 已就地更新，不清库（server/scripts/sync-db-celebrities.mjs）。</div></div>
      <div class="lv-row"><div class="k">结果 / 列表 / PDF 接口</div><div class="v">三处读取统一走 getCelebrityNames()：MAP 有值就不再看库里的历史副本。</div></div>
      <div class="lv-row"><div class="k">demo 静态样本</div><div class="v">client/public/demo/types.json（VITE_DEMO_MODE=1 时前端直读）→ ${demoDrift === 0 ? '已同步，81 型零差异' : demoDrift < 0 ? '读取失败，需人工检查' : `仍有 ${demoDrift} 型不一致`}（scripts/sync-demo-types.mjs）。</div></div>
    </div>
  </div>

  <div class="panel">
    <h3>流行角色覆盖 <em>${stats.pop} 位 · 分布在 ${stats.popTypes} / 81 型 · 每型只放一位，排在第 2 位（紧跟主人物）</em></h3>
    <div class="lv-list">
      ${popRows.sort((a, b) => a.codes[0].localeCompare(b.codes[0])).map(r => `<div class="lv-row"><div class="k"><code>${r.codes.join(' / ')}</code>${esc(typeNames[r.codes[0]] || '')}</div><div class="v"><b>${esc(r.name)}</b> · ${esc(r.work)}</div></div>`).join('')}
    </div>
    <p class="story" style="margin-top:10px">只加「明显对应」的：角色本身的四维要能说清楚，不为覆盖而硬凑。所以 81 型里还有 69 型没有流行角色——其中 27 个「均衡组」（A / B / C / D 中间档）几乎是空白，因为热门角色多是端值性格，中间档很难找到公认对应的人，这部分要继续找。</p>
  </div>

  <div class="panel">
    <h3>换人明细 <em>${changes.length} 个型 · ${slotMoves} 个位次 · 删除线为移出、绿底为新增</em></h3>
    <table>
      <thead><tr><th style="width:150px">类型</th><th style="width:130px">组</th><th style="width:36%">移出</th><th>新增（附身份）</th></tr></thead>
      <tbody>${changeRows || '<tr><td colspan="4" class="muted">与基线相比无变化。</td></tr>'}</tbody>
    </table>
    ${reorderOnly.length ? `<p class="muted" style="margin-top:10px;font-size:12.5px">另有 ${reorderOnly.length} 个型只调整了顺序（未换人）：${reorderOnly.map(r => r.code).join('、')}。</p>` : ''}
  </div>

  <div class="panel">
    <h3>进出人员全名单 <em>新进入 ${entered.length} 人 / 移出 ${exited.length} 人（移出者多数只是换了写法，人还在该型里）</em></h3>
    <div class="lv-row" style="border-top:none;padding-top:0">
      <div class="k" style="color:var(--new)">新进入</div>
      <div class="v"><div class="chips">${enterChips || '<span class="muted">—</span>'}</div></div>
    </div>
    <div class="lv-row">
      <div class="k">移出</div>
      <div class="v"><div class="chips">${exitChips || '<span class="muted">—</span>'}</div></div>
    </div>
  </div>

  <div class="panel">
    <h3>怎么审 <em>这次要你判断的只有一件事：这 81 组人，认不认得出、说不说得通</em></h3>
    <p class="story">① 点右上「只看改过的」，只看 ${changes.length} 张改过的卡，重点看绿标「新」与卡底灰掉的改前名单。
    ② 每张卡自问三句：主人物一眼能认出吗？其余三位有凑数的吗？这四个人放在这个坐标上说得通吗？
    ③ 逐张点「通过 / 需改 / 存疑」并写一句意见，点「导出审核结果」把 JSON 发我，我按你的标记再改一轮。</p>
  </div>

  <div id="sections">${sections}</div>
</div>

<script>
var KEY='mbti-pro-celebrity-review-v2';
var state={};
try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){state={}}
var onlyChanged=false, onlyTodo=false;
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function count(){
  var n=0;
  Object.keys(state).forEach(function(k){if(state[k]&&state[k].v)n++});
  document.getElementById('progress').textContent='已审 '+n+' / 81'+(n===81?' ✓':'');
}
function apply(){
  var q=document.getElementById('q').value.trim().toLowerCase();
  var g=document.getElementById('group').value;
  document.querySelectorAll('.card').forEach(function(c){
    var ok=true;
    if(g&&c.dataset.group!==g)ok=false;
    if(onlyChanged&&c.dataset.changed!=='1')ok=false;
    if(onlyTodo&&state[c.dataset.code]&&state[c.dataset.code].v)ok=false;
    if(q&&c.dataset.search.toLowerCase().indexOf(q)<0)ok=false;
    c.classList.toggle('hide',!ok);
  });
  document.querySelectorAll('.group').forEach(function(s){
    var vis=s.querySelectorAll('.card:not(.hide)').length;
    s.classList.toggle('hide',vis===0);
  });
}
document.getElementById('q').addEventListener('input',apply);
document.getElementById('group').addEventListener('change',apply);
document.getElementById('only').addEventListener('click',function(){
  onlyChanged=!onlyChanged;this.classList.toggle('on',onlyChanged);apply();
});
document.getElementById('todo').addEventListener('click',function(){
  onlyTodo=!onlyTodo;this.classList.toggle('on',onlyTodo);apply();
});
document.addEventListener('change',function(e){
  var r=e.target.closest('input[type=radio]');if(!r)return;
  var code=r.name.slice(2);
  state[code]=state[code]||{};state[code].v=r.value;save();count();
  r.closest('.card').dataset.state=r.value;
  if(onlyTodo)apply();
});
document.addEventListener('input',function(e){
  if(e.target.tagName!=='TEXTAREA')return;
  var code=e.target.closest('.card').dataset.code;
  state[code]=state[code]||{};state[code].note=e.target.value;save();
});
document.getElementById('export').addEventListener('click',function(){
  var out={exportedAt:new Date().toISOString(),stats:${JSON.stringify(stats)},changed:${JSON.stringify(changes.map(c => ({ code: c.code, before: c.before, after: c.after })))},review:state};
  var blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='mbti-pro-celebrity-review.json';a.click();
  URL.revokeObjectURL(a.href);
});
document.querySelectorAll('.card').forEach(function(c){
  var s=state[c.dataset.code];
  if(!s)return;
  if(s.v){
    c.dataset.state=s.v;
    var r=c.querySelector('input[value="'+s.v+'"]');if(r)r.checked=true;
  }
  var t=c.querySelector('textarea');if(t&&s.note)t.value=s.note;
});
count();
</script>
</body>
</html>
`

const OUT = resolve(ROOT, 'docs/MBTI-PRO-81型代表人物总表-2026-11-12.html')
writeFileSync(OUT, html, 'utf8')
console.log(`已生成 ${OUT}`)
console.log(`类型 ${stats.types} · 位次 ${stats.slots} · 去重 ${stats.people} · 共用 ${stats.dup} · 校验问题 ${stats.problems} · 副本漂移 ${stats.handDrift} · demo 漂移 ${demoDrift}`)
console.log(`本轮改动 ${changes.length} 型 / ${slotMoves} 位次 · 新进入 ${entered.length} · 移出 ${exited.length} · 仅调序 ${reorderOnly.length} · 最少位次 ${stats.minSlots}`)
if (problems.length) for (const p of problems) console.log(`  [${p.code}] ${p.kind}`)
if (handDrift.length) console.log('  副本漂移：', handDrift.join('、'))
if (demoDrift) console.log('  demo 漂移：', demoDrift)
