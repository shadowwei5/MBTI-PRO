// 生成 Week 1 单文件审核页：docs/xhs-daily/week1/review.html
// 用法：node scripts/xhs-daily/build-review.mjs
// 读取 day1..day7.md 与 dayN/01..09.png，产物为离线可用的静态 HTML（图片用相对路径）。
// 文案或图片更新后重跑本脚本即可，不需要手工改 HTML。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const DIR = resolve(ROOT, 'docs', 'xhs-daily', 'week1');
const OUT = resolve(DIR, 'review.html');

const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const inline = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.+?)`/g, '<code>$1</code>');

const PAGE_NAMES = ['封面', '争议', '一边', '另一边', '另外三维', '结论', '题目', '人物', '互动'];

const days = [];
for (let i = 1; i <= 7; i++) {
  const md = readFileSync(resolve(DIR, `day${i}.md`), 'utf8');
  const blocks = [...md.matchAll(/```\n([\s\S]*?)\n```/g)].map(m => m[1]);
  const meta = [...md.matchAll(/^> (.+)$/gm)].map(m => m[1]);
  const table = [...md.matchAll(/^\| (P\d) \| (.+?) \|$/gm)].map(m => [m[1], m[2]]);
  const checks = [...md.matchAll(/^- \[([ x])\] (.+)$/gm)].map(m => [m[1] === 'x', m[2]]);
  if (blocks.length < 4) throw new Error(`day${i}.md 代码块不足 4 个`);
  if (table.length !== 9) throw new Error(`day${i}.md 的 9 图表格只有 ${table.length} 行`);

  const imgs = [];
  for (let j = 1; j <= 9; j++) {
    const rel = `day${i}/${String(j).padStart(2, '0')}.png`;
    if (!existsSync(resolve(DIR, rel))) throw new Error(`缺图：${rel}`);
    imgs.push(rel);
  }
  days.push({
    n: i, title: blocks[0].trim(), body: blocks[1].trim(),
    tags: blocks[2].trim(), pin: blocks[3].trim(),
    meta, table, checks, imgs
  });
}

const sections = days.map(d => `
<section class="day" id="day${d.n}" data-day="${d.n}">
  <div class="dayhead">
    <div class="daynum">DAY ${String(d.n).padStart(2, '0')} <span class="dot"></span></div>
    <h2>${esc(d.title)}</h2>
    <div class="meta">${d.meta.map(inline).join(' <i>｜</i> ')}</div>
  </div>

  <div class="cols">
    <div class="col copy">
      <div class="blk">
        <div class="lbl">标题 <button class="cp" data-copy="t${d.n}">复制</button></div>
        <pre id="t${d.n}">${esc(d.title)}</pre>
      </div>
      <div class="blk">
        <div class="lbl">正文 <button class="cp" data-copy="b${d.n}">复制</button></div>
        <pre id="b${d.n}" class="body">${esc(d.body)}</pre>
      </div>
      <div class="blk two">
        <div><div class="lbl">话题标签 <button class="cp" data-copy="g${d.n}">复制</button></div><pre id="g${d.n}">${esc(d.tags)}</pre></div>
        <div><div class="lbl">置顶评论 <button class="cp" data-copy="p${d.n}">复制</button></div><pre id="p${d.n}">${esc(d.pin)}</pre></div>
      </div>
      <div class="blk">
        <div class="lbl">9 图逐页文字</div>
        <table><tbody>${d.table.map(r => `<tr><th>${esc(r[0])}</th><td>${inline(r[1])}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="blk">
        <div class="lbl">发布前自检</div>
        <ul class="checks">${d.checks.map(c => `<li class="${c[0] ? 'ok' : 'todo'}"><span>${c[0] ? '☑' : '☐'}</span>${inline(c[1])}</li>`).join('')}</ul>
      </div>
    </div>

    <div class="col pics">
      <div class="lbl">9 张成品图 <small>1080×1440 · 点击放大</small></div>
      <div class="grid">${d.imgs.map((rel, j) => `
        <figure><img src="${rel}" alt="P${j + 1} ${PAGE_NAMES[j]}" loading="lazy">
        <figcaption>P${j + 1} · ${PAGE_NAMES[j]}</figcaption></figure>`).join('')}</div>
    </div>
  </div>

  <div class="review">
    <div class="lbl">审核结论</div>
    <div class="opts">
      <label><input type="radio" name="r${d.n}" value="pass">通过</label>
      <label><input type="radio" name="r${d.n}" value="fix">需修改</label>
      <label><input type="radio" name="r${d.n}" value="hold">待定</label>
    </div>
    <textarea id="note${d.n}" rows="3" placeholder="写下需要修改的点；编号列出更方便我逐条改。例如：1. 封面人物名再大一点 2. P6 公式保留"></textarea>
  </div>
</section>`).join('\n');

const CLIENT_JS = [
  "var KEY = 'mbti-pro-xhs-week1-review';",
  "var state = {};",
  "try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { state = {}; }",
  "var cur = 1;",
  "function badge(n) {",
  "  var s = state[n]; var el = document.querySelector('.nav button[data-day=\"' + n + '\"] .badge');",
  "  if (!el) return;",
  "  el.textContent = !s || !s.status ? '' : (s.status === 'pass' ? '✓' : (s.status === 'fix' ? '!' : '·'));",
  "  el.className = 'badge ' + (!s || !s.status ? '' : s.status);",
  "}",
  "function save() { localStorage.setItem(KEY, JSON.stringify(state)); }",
  "function show(n) {",
  "  if (n < 1 || n > 7) return;",
  "  cur = n;",
  "  var all = document.querySelectorAll('.day');",
  "  for (var i = 0; i < all.length; i++) all[i].classList.toggle('on', +all[i].dataset.day === n);",
  "  var btns = document.querySelectorAll('.nav button[data-day]');",
  "  for (var j = 0; j < btns.length; j++) btns[j].classList.toggle('on', +btns[j].dataset.day === n);",
  "  document.getElementById('progress').textContent = '第 ' + n + ' / 7 天';",
  "  window.scrollTo(0, 0);",
  "}",
  "document.addEventListener('click', function (e) {",
  "  var nav = e.target.closest('.nav button[data-day]');",
  "  if (nav) { show(+nav.dataset.day); return; }",
  "  var cp = e.target.closest('.cp');",
  "  if (cp) {",
  "    var el = document.getElementById(cp.dataset.copy);",
  "    if (!el) return;",
  "    var txt = el.innerText;",
  "    if (navigator.clipboard && navigator.clipboard.writeText) {",
  "      navigator.clipboard.writeText(txt).then(function () { cp.textContent = '已复制'; setTimeout(function () { cp.textContent = '复制'; }, 1200); });",
  "    } else { cp.textContent = '请手动选中复制'; setTimeout(function () { cp.textContent = '复制'; }, 1600); }",
  "    return;",
  "  }",
  "  var im = e.target.closest('.grid img');",
  "  if (im) { document.getElementById('lbimg').src = im.src; document.getElementById('lightbox').showModal(); return; }",
  "  if (e.target.id === 'prev') show(cur - 1);",
  "  if (e.target.id === 'next') show(cur + 1);",
  "  if (e.target.id === 'export') {",
  "    var out = { exportedAt: new Date().toISOString(), days: state };",
  "    var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });",
  "    var a = document.createElement('a');",
  "    a.href = URL.createObjectURL(blob); a.download = 'xhs-week1-review.json'; a.click();",
  "    URL.revokeObjectURL(a.href);",
  "  }",
  "});",
  "document.addEventListener('change', function (e) {",
  "  var r = e.target.closest('input[type=\"radio\"]');",
  "  if (!r) return;",
  "  var n = +r.name.slice(1);",
  "  state[n] = state[n] || {}; state[n].status = r.value; save(); badge(n);",
  "});",
  "document.addEventListener('input', function (e) {",
  "  if (e.target.tagName !== 'TEXTAREA') return;",
  "  var n = +e.target.id.slice(4);",
  "  state[n] = state[n] || {}; state[n].note = e.target.value; save();",
  "});",
  "document.addEventListener('keydown', function (e) {",
  "  if (e.key === 'ArrowLeft') show(cur - 1);",
  "  if (e.key === 'ArrowRight') show(cur + 1);",
  "  if (e.key === 'Escape') { var d = document.getElementById('lightbox'); if (d.open) d.close(); }",
  "});",
  "document.getElementById('lightbox').addEventListener('click', function (e) { if (e.target === this) this.close(); });",
  "for (var n = 1; n <= 7; n++) {",
  "  var s = state[n]; if (!s) continue;",
  "  if (s.status) { var r = document.querySelector('input[name=\"r' + n + '\"][value=\"' + s.status + '\"]'); if (r) r.checked = true; }",
  "  var t = document.getElementById('note' + n); if (t && s.note) t.value = s.note;",
  "  badge(n);",
  "}",
  "show(1);"
].join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MBTI-PRO 小红书 Week 1 审核台 · 7 天文案与图片</title>
<style>
:root { --paper:#FDF8F0; --card:#FFFFFF; --ink:#1E1D1A; --accent:#A63D2C; --muted:#6F685D; --rule:#E0D8CC; --ok:#2F4037; }
* { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--paper); color:var(--ink); font-family:'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif; font-size:14px; line-height:1.6; }
.top { position:sticky; top:0; z-index:20; background:rgba(253,248,240,.97); border-bottom:1px solid var(--rule); padding:14px 28px; }
.top-row { display:flex; align-items:center; gap:16px; flex-wrap:wrap; max-width:1600px; margin:0 auto; }
.brand { font-family:'Noto Serif SC','Songti SC','SimSun',serif; font-size:18px; font-weight:500; letter-spacing:.04em; margin-right:6px; }
.brand b { color:var(--accent); font-weight:500; }
.nav { display:flex; gap:6px; flex-wrap:wrap; }
.nav button { position:relative; border:1px solid var(--rule); background:var(--card); color:var(--muted); padding:7px 13px; border-radius:4px; cursor:pointer; font-size:13px; font-family:inherit; }
.nav button:hover { border-color:var(--accent); color:var(--accent); }
.nav button.on { background:var(--accent); border-color:var(--accent); color:#fff; }
.badge { display:inline-block; width:14px; text-align:center; font-weight:700; }
.badge.pass { color:#2F7A4F; } .badge.fix { color:#C0533F; } .badge.hold { color:#9C958E; }
.spacer { flex:1; }
.tools { display:flex; align-items:center; gap:8px; }
.tools button { border:1px solid var(--rule); background:var(--card); color:var(--ink); padding:7px 12px; border-radius:4px; cursor:pointer; font-size:13px; font-family:inherit; }
.tools button:hover { border-color:var(--accent); color:var(--accent); }
#progress { font-size:12px; color:var(--muted); letter-spacing:.08em; min-width:80px; text-align:right; }
.hint { max-width:1600px; margin:10px auto 0; font-size:12px; color:var(--muted); }
.wrap { max-width:1600px; margin:0 auto; padding:28px; }
.day { display:none; }
.day.on { display:block; }
.dayhead { border-bottom:1px solid var(--rule); padding-bottom:18px; margin-bottom:22px; }
.daynum { font-family:'DM Mono','Consolas',monospace; font-size:12px; letter-spacing:.2em; color:var(--accent); }
.dayhead h2 { font-family:'Noto Serif SC','Songti SC','SimSun',serif; font-size:34px; font-weight:500; margin:8px 0 10px; }
.meta { font-size:13px; color:var(--muted); }
.meta i { font-style:normal; color:var(--rule); margin:0 6px; }
.cols { display:grid; grid-template-columns:minmax(0,440px) minmax(0,1fr); gap:24px; align-items:start; }
.blk { background:var(--card); border:1px solid var(--rule); border-radius:6px; padding:14px 16px; margin-bottom:14px; }
.lbl { font-size:12px; letter-spacing:.1em; color:var(--muted); margin-bottom:10px; display:flex; align-items:center; gap:10px; }
.lbl small { font-weight:400; letter-spacing:0; color:var(--muted); opacity:.8; }
.cp { margin-left:auto; border:1px solid var(--rule); background:transparent; color:var(--muted); font-size:11px; padding:2px 8px; border-radius:3px; cursor:pointer; font-family:inherit; }
.cp:hover { border-color:var(--accent); color:var(--accent); }
pre { white-space:pre-wrap; word-break:break-word; font-family:inherit; font-size:14px; line-height:1.85; }
pre.body { font-size:14px; }
.two { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.two > div { min-width:0; }
table { width:100%; border-collapse:collapse; font-size:12.5px; }
th, td { border-top:1px solid var(--rule); padding:7px 6px; text-align:left; vertical-align:top; }
th { width:38px; color:var(--accent); font-weight:500; white-space:nowrap; }
td strong { color:var(--accent); font-weight:500; }
code { font-family:'DM Mono','Consolas',monospace; font-size:12px; background:#F5F0E8; padding:1px 4px; border-radius:3px; }
.checks { list-style:none; font-size:12.5px; }
.checks li { display:flex; gap:8px; padding:4px 0; border-top:1px solid #F1ECE2; }
.checks li:first-child { border-top:none; }
.checks li.ok span { color:var(--ok); } .checks li.todo span { color:var(--accent); }
.grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
figure { background:var(--card); border:1px solid var(--rule); border-radius:5px; overflow:hidden; }
figure img { display:block; width:100%; height:auto; cursor:zoom-in; }
figcaption { padding:7px 9px; font-size:11px; color:var(--muted); border-top:1px solid var(--rule); letter-spacing:.04em; }
.review { margin-top:22px; background:var(--card); border:1px solid var(--rule); border-radius:6px; padding:16px; }
.opts { display:flex; gap:20px; margin-bottom:12px; font-size:13px; }
.opts label { cursor:pointer; display:flex; align-items:center; gap:6px; }
textarea { width:100%; border:1px solid var(--rule); border-radius:4px; padding:10px 12px; font-family:inherit; font-size:13px; line-height:1.7; resize:vertical; background:#FDFBF7; color:var(--ink); }
textarea:focus { outline:2px solid var(--accent); outline-offset:1px; }
dialog { border:none; padding:0; background:transparent; max-width:94vw; max-height:94vh; }
dialog::backdrop { background:rgba(30,29,26,.82); }
dialog img { display:block; max-width:92vw; max-height:90vh; border-radius:4px; }
@media (max-width:1100px) { .cols { grid-template-columns:1fr; } .grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:640px) { .wrap { padding:16px; } .grid { grid-template-columns:1fr; } .two { grid-template-columns:1fr; } .dayhead h2 { font-size:26px; } }
</style>
</head>
<body>
<div class="top">
  <div class="top-row">
    <div class="brand">MBTI-PRO <b>/</b> Week 1 审核台</div>
    <nav class="nav">${days.map(d => `<button data-day="${d.n}">D${d.n}<span class="badge"></span></button>`).join('')}</nav>
    <div class="spacer"></div>
    <div class="tools"><button id="prev">← 上一天</button><button id="next">下一天 →</button><button id="export">导出审核结果</button></div>
    <div id="progress">第 1 / 7 天</div>
  </div>
  <div class="hint">依次审核 7 天；文案可直接复制，图片点击放大。结论与备注自动保存在本机浏览器，点「导出审核结果」可把反馈交给我。键盘 ← → 切换。</div>
</div>

<div class="wrap">${sections}</div>

<dialog id="lightbox"><img id="lbimg" alt="放大预览"></dialog>

<script>
${CLIENT_JS}
</script>
</body>
</html>
`;

writeFileSync(OUT, html, 'utf8');
console.log(`已生成 ${OUT}`);
console.log(`7 天 · ${days.length * 9} 张图片引用 · ${html.length} 字符`);
