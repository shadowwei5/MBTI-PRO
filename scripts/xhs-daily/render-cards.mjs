// 把 docs/xhs-daily/template/cards.html 渲染为 1080x1440 PNG。
// 用法：
//   node scripts/xhs-daily/render-cards.mjs --all
//       → 7 天各 9 张，输出到 docs/xhs-daily/week1/day1 … day7
//   node scripts/xhs-daily/render-cards.mjs --note day3 --out <目录>
//       → 单日 9 张
//   node scripts/xhs-daily/render-cards.mjs --note elon --out <目录>
//       → 名人坐标篇备用稿
// 只做本地 HTML 截图，不调用任何付费 AI 生图接口，不执行发布动作。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..', '..');
const HTML = resolve(ROOT, 'docs', 'xhs-daily', 'template', 'cards.html');
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const ALL = argv.includes('--all');
const WEEK = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
const single = arg('--note', '');
const outRoot = arg('--out', ALL ? 'docs/xhs-daily/week1' : 'docs/xhs-daily/template/preview');

const targets = ALL
  ? WEEK.map(n => ({ note: n, out: resolve(ROOT, outRoot, n) }))
  : [{ note: single || 'day1', out: resolve(ROOT, outRoot) }];

const browser = await chromium.launch();
let total = 0;

for (const t of targets) {
  mkdirSync(t.out, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 });
  await page.addInitScript(k => { window.__NOTE_OVERRIDE = k; }, t.note);
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'load' });
  await page.waitForSelector('.page');
  await page.evaluate(() => document.fonts.ready);

  const count = await page.locator('.page').count();
  if (count !== 9) throw new Error(`[${t.note}] 期望 9 页，实际 ${count} 页，请检查 NOTE.signs 是否为 3 条`);

  for (let i = 0; i < count; i++) {
    const name = `${String(i + 1).padStart(2, '0')}.png`;
    const file = resolve(t.out, name);
    const tmp = resolve(t.out, `.${name}.${process.pid}.tmp`);
    const buf = await page.locator('.page').nth(i).screenshot();
    let done = false;
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      try {
        writeFileSync(tmp, buf);
        renameSync(tmp, file);
        done = true;
      } catch (err) {
        if (attempt === 2) throw new Error(`写入失败 ${file}: ${err.message}`);
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }
  await page.close();
  total += count;
  console.log(`[${t.note}] 9 张 → ${t.out}`);
}

await browser.close();
console.log(`完成：${targets.length} 天 × 9 张 = ${total} 张 1080x1440 图片`);
