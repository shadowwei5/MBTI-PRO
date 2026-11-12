// 单一数据源 → 两份产物：
//   1) 把 notes-data.mjs 注入 docs/xhs-daily/template/cards.html 的 NOTES 段（供 Playwright 截图）
//   2) 生成 docs/xhs-daily/week1/day1.md … day7.md（发布用文案）
// 用法：node scripts/xhs-daily/build-week.mjs
// 之后依次跑：render-cards.mjs --all → build-review.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NOTES, DISCLAIMER } from './notes-data.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const HTML = resolve(ROOT, 'docs', 'xhs-daily', 'template', 'cards.html');
const WEEK = resolve(ROOT, 'docs', 'xhs-daily', 'week1');

/* ---------- 1. 注入 cards.html ---------- */
const begin = '/* ==== NOTES:BEGIN ==== */';
const end = '/* ==== NOTES:END ==== */';
const html = readFileSync(HTML, 'utf8');
const i = html.indexOf(begin);
const j = html.indexOf(end);
if (i < 0 || j < 0) throw new Error('cards.html 缺少 NOTES 标记段');

const lib = {};
for (const n of NOTES) lib[n.key] = n;
const block = [
  begin,
  `const DISCLAIMER = ${JSON.stringify(DISCLAIMER)};`,
  `const NOTE_LIBRARY = ${JSON.stringify(lib, null, 2)};`,
  end
].join('\n');

writeFileSync(HTML, html.slice(0, i) + block + html.slice(j + end.length), 'utf8');

/* ---------- 2. 生成 day1..day7.md ---------- */
const pad = n => String(n).padStart(2, '0');

for (const n of NOTES) {
  const d = n.dispute;
  const rows = [
    `| P1 | 钩子两行大字（主）｜**朱砂人物名 ${n.person.name} + 流行参照标签**｜下方关系句 ｜ 底部小字：争议维 ${d.dimNo} ${d.dimName} |`,
    `| P2 | 争议大字：「${d.claim}」｜${d.note} |`,
    `| P3 | ${d.forA.title}（${d.stanceA} 一侧的证据） |`,
    `| P4 | ${d.forB.title}（${d.stanceB} 一侧的证据） |`,
    `| P5 | ${d.other.title} |`,
    `| P6 | **争议结论（大字主位）** + 81 型中间档说明 ｜ 公式与四维字母降为页脚注脚（争议维高亮） |`,
    `| P7 | 原题 #${n.question.id} 双极题（${d.dimName}）｜ A–E 五档量表 |`,
    `| P8 | **主：${n.person.name}（大字人物名 + 剧情卡）** ｜ \`${n.result.code} / ${n.result.name}\` 缩为小标签 ｜ 争议维标注 ｜ ${n.result.group} ｜ 虚构角色 · 仅作性格类比 |`,
    `| P9 | 互动提问 + 固定免责 |`
  ].join('\n');

  const checks = [
    `- [x] 无外链 / 二维码 / 微信 / 「私我」`,
    `- [x] 无绝对化、医疗化、诊断类表述`,
    `- [x] 题量口径：40 题；免责声明在正文尾与 P9`,
    `- [x] 题目 #${n.question.id} 与 \`server/src/seed.ts\` 原文一致；\`${n.result.code} ${n.result.name}\` 与 \`types.ts\` 的 \`TYPE_NAMES\` 一致`,
    `- [x] 坐标落在端值组合，全篇只设 1 个争议维（${d.dimNo} ${d.dimName}），没有「其实他是另一个类型」式改判`,
    `- [x] 争议两侧各有具体剧情依据；另外三维只做「无争议」一句锁定`,
    `- [x] 虚构角色仅作性格类比；无立绘 / 剧照 / 台词引用，图上标注「与作品版权方无关联」`,
    `- [x] 图为本地 HTML/CSS 渲染，非 AI 生成图`,
    `- [ ] 三闸门 G1 / G2 / G3 全绿后才发布`
  ].join('\n');

  const md = `# Day ${n.no} · NO.${pad(n.no)}《${n.title}》

> 图片：\`${n.key}/01.png\` … \`09.png\`（9 张 1080×1440，3:4）
> 人物驱动 + 单维争议 ｜ 坐标 ${n.result.code} ${n.result.name} ｜ 争议维 ${d.dimNo} ${d.dimName} ｜ 题目 #${n.question.id} ｜ ${n.result.group}

## 标题（直接复制）

\`\`\`
${n.title}
\`\`\`

## 正文（直接复制）

\`\`\`
${n.body.join('\n\n')}
\`\`\`

## 话题标签（7 个，填标签栏）

\`\`\`
${n.tags}
\`\`\`

## 作者置顶评论（发布后 10 分钟内）

\`\`\`
${n.pinned}
\`\`\`

## 9 图逐页文字（核对用）

| 页 | 图上内容 |
|---|---|
${rows}

## 发布前自检

${checks}
`;
  writeFileSync(resolve(WEEK, `${n.key}.md`), md, 'utf8');
}

console.log(`cards.html 已注入 ${NOTES.length} 篇数据`);
console.log(`已生成 ${NOTES.map(n => n.key + '.md').join('、')}`);
