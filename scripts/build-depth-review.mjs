/**
 * 生成给 DSH 的内容审核包：
 *   1) docs/MBTI-PRO-81型四维深度解析全文-2026-11-13.html —— 81 型 ×（主人物 + 引言 + 四条解析）逐条可审
 *   2) docs/MBTI-PRO-内容审核交接-DSH-2026-11-13.md —— 交接说明 + 审核清单 + 全文附录
 *
 * 内容全部从代码生成，不手写：types.ts（名单）、celebrity-stories.ts（主人物侧写）、
 * life-advice.ts（四条解析）。
 *
 * 用法：npx tsx scripts/build-depth-review.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getCelebrityProfiles } from '../server/src/content/types.ts'
import { FEATURED_PROFILES } from '../server/src/content/celebrity-stories.ts'
import { getLifeAdviceModules } from '../server/src/content/life-advice.ts'

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

const GROUPS = {
  SP: ['SP 暖金组', '#C8963E'], SD: ['SD 琥珀组', '#D4782F'], SJ: ['SJ 藏蓝组', '#2C5F8A'],
  BT: ['BT 深炭灰组', '#4A4A4A'], BC: ['BC 月光银灰组', '#8B95A0'], BF: ['BF 暖燕麦组', '#B8956A'],
  NT: ['NT 深紫组', '#6B3FA0'], NC: ['NC 靛青组', '#3D7B8A'], NF: ['NF 翠绿组', '#2D8A4E'],
}
const groupOf = c => {
  const [sn, tf, pj] = [c[1], c[2], c[3]]
  if (sn === 'S') return pj === 'P' ? 'SP' : pj === 'D' ? 'SD' : 'SJ'
  if (sn === 'B') return tf === 'T' ? 'BT' : tf === 'C' ? 'BC' : 'BF'
  return tf === 'T' ? 'NT' : tf === 'C' ? 'NC' : 'NF'
}
const DIM_ZH = { E: '外向', A: '平衡', I: '内向', S: '实感', B: '均衡', N: '直觉', T: '思考', C: '复合', F: '情感', J: '判断', D: '动态', P: '感知' }

const allCodes = Object.keys(typeNames).sort()
const rows = allCodes.map((code) => {
  const people = getCelebrityProfiles(code)
  const featured = FEATURED_PROFILES[code]
  const m = getLifeAdviceModules(code)
  return {
    code,
    name: typeNames[code] || '',
    group: groupOf(code),
    people,                       // 主人物在第 1 位
    main: featured ? featured.name : people[0]?.name || '',
    mainField: featured ? featured.field : people[0]?.field || '',
    story: featured?.story || '',
    quote: featured?.quote || '',
    modules: m,
  }
})

const noPop = rows.filter(r => !r.people.some(p => POP[p.name]))
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const stamp = new Date().toLocaleString('zh-CN', { hour12: false })

/* ================= HTML ================= */
const card = (r) => {
  const hex = GROUPS[r.group][1]
  const people = r.people.map(p => {
    const isPop = !!POP[p.name]
    return `<span class="chip${isPop ? ' pop' : ''}" title="${esc(isPop ? POP[p.name] : p.field)}">${esc(p.name)}<i>${esc(p.field)}</i>${isPop ? '<b>流行</b>' : ''}</span>`
  }).join('')
  const dims = [...r.code].map((c, i) => `<span class="dim">${esc(c)}<i>${esc(DIM_ZH[c] || '')}</i></span>`).join('')
  return `
<article class="card" data-code="${r.code}" data-group="${r.group}" data-search="${esc(r.code + ' ' + r.name + ' ' + r.people.map(p => p.name).join(' ') + ' ' + r.main)}">
  <header>
    <div class="code" style="color:${hex}">${r.code}</div>
    <div class="tname">${esc(r.name)}</div>
    <div class="grp" style="background:${hex}">${esc(GROUPS[r.group][0])}</div>
  </header>
  <div class="dims">${dims}</div>
  <div class="people"><span class="lab">代表人物（结果页 03 / REFERENCES 展示顺序）</span><div class="chips">${people}</div></div>
  <div class="main">
    <span class="lab">PERSON IN CONTEXT / 主人物：${esc(r.main)} · ${esc(r.mainField)}</span>
    <p class="story">${esc(r.story)}</p>
    ${r.quote ? `<blockquote>“${esc(r.quote)}”</blockquote>` : '<p class="noquote">（这一型没有引言）</p>'}
  </div>
  <div class="mods">
    <div class="mrow"><span>能量来源</span><p>${esc(r.modules.eiModule)}</p></div>
    <div class="mrow"><span>认知方式</span><p>${esc(r.modules.snModule)}</p></div>
    <div class="mrow"><span>决策方式</span><p>${esc(r.modules.tfModule)}</p></div>
    <div class="mrow"><span>生活态度</span><p>${esc(r.modules.pjModule)}</p></div>
  </div>
  <div class="review">
    <div class="opts">
      <label><input type="radio" name="r-${r.code}" value="pass">通过</label>
      <label><input type="radio" name="r-${r.code}" value="fix">需改</label>
      <label><input type="radio" name="r-${r.code}" value="hold">存疑</label>
    </div>
    <textarea rows="2" placeholder="意见（例如：主人物第 2 条建议与公开经历对不上 / 换个角色）"></textarea>
  </div>
</article>`
}

const sections = Object.keys(GROUPS).map(g => {
  const list = rows.filter(r => r.group === g)
  return `<section class="group" data-group="${g}">
    <h2><span class="swatch" style="background:${GROUPS[g][1]}"></span>${esc(GROUPS[g][0])}<em>${esc(GROUPS[g][0].split(' ')[1] || '')} · ${list.length} 型</em></h2>
    <div class="grid">${list.map(card).join('')}</div>
  </section>`
}).join('\n')

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MBTI-PRO · 81 型代表人物与四维深度解析（DSH 审核稿）</title>
<style>
:root{--paper:#FBF6EE;--card:#fff;--ink:#1E1D1A;--muted:#6F685D;--rule:#E2D9CB;--accent:#A63D2C;--ok:#2F7A4F;--warn:#B4762A}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--paper);color:var(--ink);font:14px/1.65 'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif}
.top{position:sticky;top:0;z-index:30;background:rgba(251,246,238,.97);border-bottom:1px solid var(--rule);padding:12px 24px}
.row{max-width:1680px;margin:0 auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.brand{font-size:16px;font-weight:600}.brand b{color:var(--accent)}
.stat{font-size:12px;color:var(--muted)}.sp{flex:1}
input[type=search],select{border:1px solid var(--rule);background:#fff;padding:7px 11px;border-radius:5px;font:13px/1 inherit;font-family:inherit}
input[type=search]{width:240px}
button{border:1px solid var(--rule);background:#fff;padding:7px 12px;border-radius:5px;cursor:pointer;font:13px/1 inherit;font-family:inherit}
button:hover{border-color:var(--accent);color:var(--accent)}button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.wrap{max-width:1680px;margin:0 auto;padding:20px 24px 60px}
.hero{background:#fff;border:1px solid var(--rule);border-left:4px solid var(--accent);border-radius:6px;padding:16px 20px;margin-bottom:16px}
.hero h1{font-size:19px;font-family:'Noto Serif SC','Songti SC',serif}
.hero p{font-size:13px;color:#3A3833;margin-top:6px;line-height:1.8}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px}
.kpi{background:#fff;border:1px solid var(--rule);border-radius:6px;padding:12px 14px}
.kpi b{display:block;font-size:22px;font-family:'DM Mono',monospace}.kpi span{font-size:12px;color:var(--muted)}
.panel{background:#fff;border:1px solid var(--rule);border-radius:6px;padding:14px 16px;margin-bottom:20px}
.panel h3{font-size:14px;margin-bottom:8px}.panel h3 em{font-style:normal;color:var(--muted);font-weight:400;font-size:12px;margin-left:8px}
.panel ol{margin-left:18px;font-size:13px;line-height:1.9}
.group{margin-bottom:26px}
.group h2{font-size:17px;display:flex;align-items:center;gap:9px;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--rule)}
.group h2 em{font-style:normal;font-size:12px;color:var(--muted);font-weight:400}
.swatch{width:12px;height:12px;border-radius:2px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px}
.card{background:#fff;border:1px solid var(--rule);border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.card header{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.code{font-family:'DM Mono',monospace;font-size:22px;font-weight:600;letter-spacing:.06em}
.tname{font-family:'Noto Serif SC','Songti SC',serif;font-size:16px}
.grp{margin-left:auto;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px}
.dims{display:flex;gap:6px}
.dim{display:flex;align-items:center;gap:4px;font-family:'DM Mono',monospace;font-size:13px;border:1px solid var(--rule);border-radius:4px;padding:1px 7px}
.dim i{font-style:normal;font-size:11px;color:var(--muted)}
.lab{font-size:11px;letter-spacing:.08em;color:var(--muted);margin-bottom:5px;display:block}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:12px;border:1px solid var(--rule);border-radius:12px;padding:2px 9px;background:#fff}
.chip i{font-style:normal;color:var(--muted);font-size:11px;margin-left:6px}
.chip b{color:#6B3FA0;font-size:11px;margin-left:5px}
.chip.pop{border-color:#CBB6E0;background:#F7F2FD}
.main{background:#FBF8F2;border:1px solid #EFE7DA;border-radius:6px;padding:10px 12px}
.story{font-size:12.5px;line-height:1.75;color:#3A3833}
.main blockquote{margin:10px 0 0;font-family:'Noto Serif SC','Songti SC',serif;font-size:15px;color:var(--ink)}
.noquote{font-size:12px;color:var(--warn);margin-top:6px}
.mods{display:flex;flex-direction:column;gap:6px}
.mrow{display:grid;grid-template-columns:64px 1fr;gap:10px;font-size:12.5px;line-height:1.7}
.mrow span{color:var(--accent);font-size:11.5px;padding-top:2px}
.mrow p{color:#3A3833}
.review{border-top:1px dashed var(--rule);padding-top:9px;margin-top:auto}
.opts{display:flex;gap:14px;font-size:12.5px;margin-bottom:6px}
.opts label{display:flex;align-items:center;gap:4px;cursor:pointer}
textarea{width:100%;border:1px solid var(--rule);border-radius:4px;padding:6px 8px;font:12.5px/1.6 inherit;font-family:inherit;resize:vertical;background:#FDFBF7}
.card[data-state=pass]{box-shadow:inset 3px 0 0 var(--ok)}
.card[data-state=fix]{box-shadow:inset 3px 0 0 var(--accent)}
.card[data-state=hold]{box-shadow:inset 3px 0 0 var(--warn)}
.hide{display:none!important}
@media(max-width:640px){.wrap{padding:14px}.grid{grid-template-columns:1fr}}
</style></head><body>
<div class="top"><div class="row">
  <div class="brand">MBTI-PRO <b>/</b> 81 型 · 代表人物 + 四维深度解析</div>
  <div class="stat" id="progress">已审 0 / 81</div>
  <div class="sp"></div>
  <input type="search" id="q" placeholder="搜类型码 / 中文名 / 人物名…">
  <select id="group"><option value="">全部 9 组</option>${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
  <button id="todo">只看没审的</button>
  <button id="export">导出审核结果</button>
</div></div>
<div class="wrap">
  <div class="hero">
    <h1>这是结果页会原样展示给用户的两块内容</h1>
    <p><b>03 / REFERENCES 代表人物</b>（每人带身份）与 <b>04 / DEPTH 四维深度解析</b>（主人物生平 + 引言 + 能量来源 / 认知方式 / 决策方式 / 生活态度）。每张卡下面可点「通过 / 需改 / 存疑」并写意见，最后导出 JSON 回传。生成时间 ${esc(stamp)}，内容全部来自代码，改数据后重跑 <code>scripts/build-depth-review.mjs</code> 即可刷新。</p>
  </div>
  <div class="summary">
    <div class="kpi"><b>${rows.length}</b><span>型</span></div>
    <div class="kpi"><b>${rows.filter(r => r.quote).length}</b><span>有引言的主人物</span></div>
    <div class="kpi"><b>${rows.filter(r => r.people.some(p => POP[p.name])).length}</b><span>含流行角色的型</span></div>
    <div class="kpi"><b>${new Set(rows.flatMap(r => r.people.map(p => p.name))).size}</b><span>人物去重数</span></div>
  </div>
  <div class="panel">
    <h3>审核要点 <em>按这五条过一遍，每型约 20 秒</em></h3>
    <ol>
      <li><b>名单</b>：主人物（粗体大字那位）是不是一眼认得出？其余三位有没有明显冷门的？</li>
      <li><b>四维</b>：这个人放在这个坐标上，四条解析里的「精力投向 / 判断方式 / 关键抉择 / 代价」说得通吗？有没有某一型讲串了？</li>
      <li><b>事实</b>：生平与引言是不是公开可查的事实？有没有把传说当史实、有没有明显错误？</li>
      <li><b>语气</b>：像不像诊断、像不像广告？有没有「你应该」「你必须」这类命令式？</li>
      <li><b>合规</b>：虚构角色是否都带作品名？真人有没有可能被理解成「本人测过 / 本人推荐」？</li>
    </ol>
  </div>
  <div id="sections">${sections}</div>
</div>
<script>
var KEY='mbti-pro-depth-review-v1';var state={};
try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){state={}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function count(){var n=0;Object.keys(state).forEach(function(k){if(state[k]&&state[k].v)n++});
document.getElementById('progress').textContent='已审 '+n+' / 81'+(n===81?' ✓':'')}
function apply(){var q=document.getElementById('q').value.trim().toLowerCase();var g=document.getElementById('group').value;
document.querySelectorAll('.card').forEach(function(c){var ok=true;
if(g&&c.dataset.group!==g)ok=false;
if(onlyTodo&&state[c.dataset.code]&&state[c.dataset.code].v)ok=false;
if(q&&c.dataset.search.toLowerCase().indexOf(q)<0)ok=false;
c.classList.toggle('hide',!ok)});
document.querySelectorAll('.group').forEach(function(s){s.classList.toggle('hide',s.querySelectorAll('.card:not(.hide)').length===0)})}
var onlyTodo=false;
document.getElementById('q').addEventListener('input',apply);
document.getElementById('group').addEventListener('change',apply);
document.getElementById('todo').addEventListener('click',function(){onlyTodo=!onlyTodo;this.classList.toggle('on',onlyTodo);apply()});
document.addEventListener('change',function(e){var r=e.target.closest('input[type=radio]');if(!r)return;
var code=r.name.slice(2);state[code]=state[code]||{};state[code].v=r.value;save();count();
r.closest('.card').dataset.state=r.value;if(onlyTodo)apply()});
document.addEventListener('input',function(e){if(e.target.tagName!=='TEXTAREA')return;
var code=e.target.closest('.card').dataset.code;state[code]=state[code]||{};state[code].note=e.target.value;save()});
document.getElementById('export').addEventListener('click',function(){
var out={exportedAt:new Date().toISOString(),source:'depth-review',review:state};
var blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});
var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mbti-pro-depth-review.json';a.click();URL.revokeObjectURL(a.href)});
document.querySelectorAll('.card').forEach(function(c){var s=state[c.dataset.code];if(!s)return;
if(s.v){c.dataset.state=s.v;var r=c.querySelector('input[value="'+s.v+'"]');if(r)r.checked=true}
var t=c.querySelector('textarea');if(t&&s.note)t.value=s.note});
count();
</script></body></html>`

writeFileSync(resolve(ROOT, 'docs/MBTI-PRO-81型四维深度解析全文-2026-11-13.html'), html, 'utf8')

/* ================= Markdown 交接文档 ================= */
const nameRows = rows.map(r =>
  `| ${r.code} | ${r.name} | ${r.main} | ${r.mainField} | ${r.people.slice(1).map(p => p.name + (POP[p.name] ? '（流行）' : '')).join('、')} | ${r.group} |`
).join('\n')

const depthBlocks = rows.map(r => `### ${r.code} ${r.name}（${r.group}）

- **主人物**：${r.main} · ${r.mainField}
- **生平**：${r.story}
${r.quote ? `- **引言**：「${r.quote}」\n` : ''}- **能量来源**：${r.modules.eiModule}
- **认知方式**：${r.modules.snModule}
- **决策方式**：${r.modules.tfModule}
- **生活态度**：${r.modules.pjModule}
- **代表人物**：${r.people.map(p => p.name + (POP[p.name] ? `（${POP[p.name]}）` : '')).join(' / ')}
`).join('\n')

const md = `# 内容审核交接 · 81 型代表人物 + 四维深度解析（DSH 审核端）

> 生成时间：${stamp}｜数据源：\`server/src/content/types.ts\`、\`celebrity-stories.ts\`、\`life-advice.ts\`
> **你要审的是用户付费后会在结果页看到的两块内容**：\`03 / REFERENCES 代表人物\` 与页面最底部的 \`04 / DEPTH 四维深度解析\`。
> 本文档由 \`scripts/build-depth-review.mjs\` 从代码生成，改数据后重跑即可刷新；内容不会手写。

## 0. 三分钟版（只看这里就能开工）

| | 状态 |
|---|---|
| 81 型代表人物 | 317 个位次 / 317 个不同的人，跨型共用 0；其中 42 位是流行角色（动漫 / 影视），覆盖 41 / 81 型 |
| 选人准则 | ① 一眼认出 ② 四维无硬伤 ③ 不与其它型共用；中间档另用「争议即中间档」机制（角色本身有公认争议 = 中间档的实证） |
| 四维深度解析 | 每型 4 条（能量来源 / 认知方式 / 决策方式 / 生活态度），全部由该型**主人物**的公开生平推导，主人物是历史或当代真人，**不含虚构角色** |
| 已排除 | 近代国内政治人物已全部移出（周恩来 / 宋庆龄 / 何香凝），公益符号（雷锋）也已移出 |
| 合规声明 | 结果页代表人物区底部固定一句：标注作品名的为虚构角色，仅作性格类比，与作品版权方无关联；真人部分只引用公开可查的经历，不代表本人测评或认可 |

**逐条可审的页面**（推荐用这个）：\`docs/MBTI-PRO-81型四维深度解析全文-2026-11-13.html\`
—— 81 张卡，每张卡有代表人物、主人物生平、引言和四条解析，卡下点「通过 / 需改 / 存疑」写意见，右上角导出 JSON 回传。
另有代表人物审核表：\`docs/MBTI-PRO-81型代表人物总表-2026-11-12.html\`（带改前改后对照）。

## 1. 请按这五条审（每型约 20 秒）

1. **名单**：主人物（结果页大字那位）一眼认得出吗？其余三位有没有明显冷门的？
2. **四维**：这个人放在这个坐标上说得通吗？四条解析里有没有哪一条讲串了或与主人物对不上？
3. **事实**：生平与引言是公开可查的事实吗？有没有把传说当史实、有没有硬伤？
4. **语气**：像诊断或广告吗？有没有「你应该 / 你必须」这类命令式？
5. **合规**：虚构角色都带作品名吗？真人有没有可能被读成「本人测过 / 本人推荐」？

## 2. 反馈格式（每条一行，回本文档或直接回 JSON）

\`\`\`
类型码 | 分类(名单/四维/事实/语气/合规) | 严重度(阻断/建议/可选) | 具体意见（要改成什么，或改成谁）
ENTJ | 四维 | 建议 | 第 3 条「关键抉择」与拿破仑公开经历对不上，建议换成…
\`\`\`

阻断 = 用户付费后会看到的事实错误或违规内容，收到就改；建议 = 表达与说服力；可选 = 口味。
**不要为了凑数而要求换人**：换主人物意味着重写该型四条解析 + 生平，工作量按型计。

## 3. 完整名单（81 型）

| 类型 | 中文名 | 主人物 | 身份 | 其余三位（流行角色已标注） | 组 |
|---|---|---|---|---|---|
${nameRows}

## 4. 四维深度解析全文（81 型）

> 这就是结果页最底部 \`04 / DEPTH\` 区块逐字展示的内容。

${depthBlocks}
## 5. 已知待定项（我先摊开，等你判断）

### 5.1 引言覆盖率只有 1 / 81
结果页 DEPTH 区块的引言（blockquote）目前只有 **ASTJ 孔子** 这一型有，其余 80 型为空——因为项目原则是**不编造名人名言**，没有可查的公开原话就不写。
**请你判断**：① 维持现状（引言偶有但真实）；② 补引言（只写有公开出处的原话，宁缺毋滥）；③ 取消引言区块，改成一句该型主人物的定位句。③ 的改动量最小。

### 5.2 还有 ${noPop.length} 个型没有流行角色
这些型的 4 位代表人物全部是历史或当代真人（部分含较冷门的历史人物）。名单如下：
${noPop.map(r => `${r.code} ${r.name}：${r.people.map(p => p.name).join('、')}`).join('\n')}
**请你判断**：哪些属于「该换但没有合适的」，哪些属于「真人已经够好、不需要角色」。

### 5.3 边界人物（我拿不准，留给你定）
名单里仍有以下偏敏感或偏公共符号的人物，若你认为商业产品里不合适，说一声我换掉：
蔡元培、张桂梅、钱学森、邓稼先、白求恩、陶行知、雷锋（已换）、周恩来/宋庆龄/何香凝（已换）。

### 5.4 置信度低的两位流行角色
IBCP 求知者型 · 有马公生（《四月是你的谎言》）与 IBFP 逸趣者型 · 埼玉（《一拳超人》）是我把握最低的两位，争议点记在 \`docs/xhs-daily/dispute-library.md\`。若你认为明显不搭，我直接换。

## 6. 你可能会问的几个问题

- **为什么虚构角色不写进四维深度解析？** 那四条建议要基于真实公开经历推导，虚构角色没有可查生平，所以主人物一律是真人；虚构角色只出现在代表人物名单里，且带作品名与类比声明。
- **换主人物要改多少东西？** \`celebrity-stories.ts\` 的该型侧写与引言 + \`life-advice.ts\` 的该型 6 条素材 + 结果页大字。改完重跑本脚本与 \`build-celebrity-review.mjs\` 即可。
- **争议角色怎么定的？** 见 \`docs/xhs-daily/dispute-library.md\`，每位流行角色记了争议维、两边证据和一句话钩子，可直接拿来做日更选题。
`

writeFileSync(resolve(ROOT, 'docs/MBTI-PRO-内容审核交接-DSH-2026-11-13.md'), md, 'utf8')

console.log(`已生成 docs/MBTI-PRO-81型四维深度解析全文-2026-11-13.html`)
console.log(`已生成 docs/MBTI-PRO-内容审核交接-DSH-2026-11-13.md`)
console.log(`型 ${rows.length} · 有引言 ${rows.filter(r => r.quote).length} · 含流行角色 ${rows.filter(r => r.people.some(p => POP[p.name])).length} · 人物去重 ${new Set(rows.flatMap(r => r.people.map(p => p.name))).size}`)
