// 9 图排版自检：检查 63 页是否存在文字溢出、压页脚、元素重叠。
// 用法：node scripts/xhs-daily/audit-cards.mjs
// 只读不写，供改完 cards.html 后跑一遍。
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..', '..');
const HTML = resolve(ROOT, 'docs', 'xhs-daily', 'template', 'cards.html');
const WEEK = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
const SEL = '.cover-title,.person-line,.person-link,.dtag,.scene,.note,.spec,' +
  '.idx,.bar,.title,.desc,.body,.footnote,.q-title,.q-sub,.qwrap,.scale,.qfoot,' +
  '.hook,.type-tag,.dispute,.group,.card,.cta,.hint,.disc,.qcol';

const browser = await chromium.launch();
let bad = 0;
for (const note of WEEK) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1440 } });
  await page.addInitScript(k => { window.__NOTE_OVERRIDE = k; }, note);
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'load' });
  await page.waitForSelector('.page');
  await page.evaluate(() => document.fonts.ready);
  const res = await page.evaluate(sel => {
    const out = [];
    document.querySelectorAll('.page').forEach((pg, pi) => {
      const pr = pg.getBoundingClientRect();
      const foot = pg.querySelector('.footer')?.getBoundingClientRect();
      const rects = [];
      pg.querySelectorAll(sel).forEach(el => {
        const r = el.getBoundingClientRect();
        const cls = el.className.split(' ')
          .filter(c => !/^p[1-9]$/.test(c)).join('.') || el.tagName;
        if (r.bottom > pr.bottom - 4) out.push(`P${pi + 1} ${cls} 超出底部 ${Math.round(r.bottom - pr.top)}`);
        if (r.right > pr.right - 4) out.push(`P${pi + 1} ${cls} 超出右边界 ${Math.round(r.right - pr.left)}`);
        if (foot && r.bottom > foot.top + 2) out.push(`P${pi + 1} ${cls} 压页脚 ${Math.round(r.bottom - pr.top)} > ${Math.round(foot.top - pr.top)}`);
        if (r.height > 6 && r.width > 6) rects.push({ cls, el, top: r.top, bottom: r.bottom, left: r.left, right: r.right });

      });
      pg.querySelectorAll('.qwrap').forEach(w => {
        const wh = w.clientHeight;
        w.querySelectorAll('.qcol').forEach(c => {
          if (c.scrollHeight > wh + 2) out.push(`P${pi + 1} 题栏文字撑破题框 ${c.scrollHeight} > ${wh}`);
        });
      });
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], c = rects[j];
          if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
          const ov = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
          const ox = Math.min(a.right, c.right) - Math.max(a.left, c.left);
          if (ov > 6 && ox > 6) out.push(`P${pi + 1} 重叠 ${a.cls} × ${c.cls} ${Math.round(ov)}px`);
        }
      }
    });
    return out;
  }, SEL);
  if (res.length) { bad += res.length; console.log(`[${note}]`); res.forEach(r => console.log('  ' + r)); }
  await page.close();
}
await browser.close();
console.log(bad ? `共 ${bad} 处问题` : '全部 63 页：无溢出、无压页脚、无重叠');
