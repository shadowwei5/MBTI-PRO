// 一次性检查：完全重名 + 同一人不同写法（子串包含）
import { readFileSync } from 'node:fs';
const t = readFileSync('server/src/content/types.ts', 'utf8');
const block = src => {
  const i = src.indexOf('const CELEBRITY_MAP');
  const s = src.indexOf('{', i);
  let d = 0;
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(s + 1, j); }
  }
};
const map = {};
for (const line of block(t).split('\n')) {
  const m = line.match(/^\s*([A-Z]{4}):\s*\[(.*)\]/);
  if (m) map[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map(x => x[1]);
}
const all = [];
for (const [c, ns] of Object.entries(map)) for (const n of ns) all.push([n, c]);
const seen = new Map();
for (const [n, c] of all) {
  if (!seen.has(n)) seen.set(n, []);
  seen.get(n).push(c);
}
console.log('— 完全重名 —');
for (const [n, cs] of seen) if (cs.length > 1) console.log(' ', n, cs.join('/'));

console.log('— 疑似同一人（一方包含另一方） —');
const names = [...seen.keys()];
for (let i = 0; i < names.length; i++) {
  for (let j = 0; j < names.length; j++) {
    if (i === j) continue;
    const a = names[i], b = names[j];
    if (a.length >= 2 && b.includes(a) && a !== b) console.log(` ${a} (${seen.get(a)}) ⊂ ${b} (${seen.get(b)})`);
  }
}
console.log('总位次', all.length, '去重', seen.size);
