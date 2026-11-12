// 第二批：把仍然认不出的人换成大众脸（同一套规则，去重后不会与任何型冲突）
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TYPES = resolve(ROOT, 'server/src/content/types.ts');
const FIELDS = resolve(ROOT, 'server/src/content/celebrity-fields.ts');

const EDITS = [
  ['EBTP', '迈克尔·克莱顿', '黄渤'],
  ['ANCP', '姚期智', '杨振宁'],
  ['EBFJ', '晏阳初', '白求恩'],
  ['EBFP', '舒马赫', '蔡澜'],
  ['ANFD', '梁漱溟', '史铁生'],
  ['ABFD', '米哈伊·契克森米哈伊', '林语堂'],
  ['IBFJ', '佩索阿', '余华'],
  ['EBCJ', '子产', '张仪'],
  ['EBCD', '刘晏', '沈万三'], ['EBCD', '郑观应', null],
  ['ASFD', '况钟', '钟南山'], ['ASFD', '徐有功', null],
  ['ISCJ', '刘知几', '陈寅恪'],
  ['ISCD', '李诫', '詹天佑'], ['ISCD', '贾思勰', '祖冲之'],
  ['EBCP', '安东尼·波登', '大张伟'], ['EBCP', '弗雷德·阿斯泰尔', null],
  ['ASCP', '卡地亚', null],
  ['ENTJ', '罗斯福', '富兰克林·罗斯福'],
];

const ADD_FIELDS = {
  '黄渤': '演员 / 导演',
  '杨振宁': '理论物理学家 / 诺贝尔物理学奖得主',
  '白求恩': '外科医生 / 国际主义战士',
  '蔡澜': '作家 / 美食家',
  '史铁生': '作家',
  '林语堂': '作家 / 学者',
  '余华': '作家',
  '张仪': '战国纵横家',
  '沈万三': '元末明初商人',
  '钟南山': '呼吸病学专家',
  '陈寅恪': '历史学家',
  '詹天佑': '铁路工程师',
  '祖冲之': '数学家 / 天文学家',
  '大张伟': '歌手 / 主持人',
  '富兰克林·罗斯福': '美国第 32 任总统',
};

let src = readFileSync(TYPES, 'utf8');
const start = src.indexOf('const CELEBRITY_MAP');
const open = src.indexOf('{', start);
let depth = 0, close = -1;
for (let j = open; j < src.length; j++) {
  if (src[j] === '{') depth++;
  else if (src[j] === '}') { depth--; if (depth === 0) { close = j; break; } }
}
const body = src.slice(open + 1, close);
const map = {};
for (const line of body.split('\n')) {
  const m = line.match(/^\s*([A-Z]{4}):\s*\[(.*)\]/);
  if (m) map[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map(x => x[1]);
}
for (const [code, from, to] of EDITS) {
  const list = map[code];
  if (!list) { console.log('缺类型', code); continue; }
  const i = list.indexOf(from);
  if (i < 0) continue;
  if (to === null) list.splice(i, 1); else list[i] = to;
}
const rebuilt = body.split('\n').map(line => {
  const m = line.match(/^(\s*)([A-Z]{4}):\s*\[(.*)\],?\s*$/);
  if (!m) return line;
  return `${m[1]}${m[2]}: [${map[m[2]].map(n => `'${n}'`).join(', ')}],`;
});
src = src.slice(0, open + 1) + rebuilt.join('\n') + src.slice(close);
writeFileSync(TYPES, src, 'utf8');

let fd = readFileSync(FIELDS, 'utf8');
const fi = fd.indexOf('export const CELEBRITY_FIELDS');
const fo = fd.indexOf('{', fi);
let d2 = 0, fc = -1;
for (let j = fo; j < fd.length; j++) {
  if (fd[j] === '{') d2++;
  else if (fd[j] === '}') { d2--; if (d2 === 0) { fc = j; break; } }
}
const existing = new Set([...fd.slice(fo, fc).matchAll(/'([^']+)':/g)].map(m => m[1]));
const add = Object.entries(ADD_FIELDS).filter(([n]) => !existing.has(n));
if (add.length) {
  const inject = '\n  // ===== 2026-11-12 换人时补齐 =====\n' + add.map(([n, f]) => `  '${n}': '${f}',`).join('\n') + '\n';
  fd = fd.slice(0, fc) + inject + fd.slice(fc);
  writeFileSync(FIELDS, fd, 'utf8');
}
console.log(`第二批替换 ${EDITS.length} 条，补身份 ${add.length} 人`);
