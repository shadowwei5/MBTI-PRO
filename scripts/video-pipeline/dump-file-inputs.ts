// dump-file-inputs.ts v3 —— string-form evaluate 绕开 tsx/esbuild __name 装饰器；小红书加主页热身 + networkidle
import { chromium, type BrowserContext, type Page, type Frame } from 'playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', '..')
const AUTOMATION_DIR = join(ROOT, 'content-marketing', 'automation')
const PROFILE = process.env.MBTIPRO_CHROME_PROFILE || join(AUTOMATION_DIR, 'state', 'chrome-profile')
const OUT_DIR = join(AUTOMATION_DIR, 'logs')
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const URLS: Record<string, string> = {
  douyin: 'https://creator.douyin.com/creator-micro/content/upload',
  xiaohongshu: 'https://creator.xiaohongshu.com/publish/publish',
}

// 用字符串形式的 evaluate 避免 tsx/esbuild 注入 __name 装饰器
const DUMP_SRC = `
(function() {
  function describe(el) {
    var html = el.outerHTML || '';
    var cs = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    return {
      tag: el.tagName,
      id: el.id || null,
      cls: (el.className && el.className.toString ? el.className.toString() : el.className) || null,
      accept: el.accept || null,
      multiple: el.multiple || false,
      name: el.name || null,
      type: el.type || null,
      visible: el.offsetParent !== null,
      rect: cs ? { x: Math.round(cs.x), y: Math.round(cs.y), w: Math.round(cs.width), h: Math.round(cs.height) } : null,
      parentTag: el.parentElement ? el.parentElement.tagName : null,
      parentCls: el.parentElement ? (el.parentElement.className && el.parentElement.className.toString ? el.parentElement.className.toString() : el.parentElement.className) : null,
      html: html.slice(0, 600)
    };
  }
  var seen = [];
  function walk(root) {
    try {
      var iter = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      var n = iter.currentNode;
      while (n) {
        if (n.shadowRoot) walk(n.shadowRoot);
        if (n.tagName === 'INPUT' && n.type === 'file') seen.push(n);
        n = iter.nextNode();
      }
    } catch(e) {}
  }
  walk(document);
  var all = document.querySelectorAll('input[type=file]');
  for (var i=0;i<all.length;i++){ if (seen.indexOf(all[i])<0) seen.push(all[i]); }
  var kws = ['上传视频','上传封面','更换封面','编辑封面','选择封面','本地上传','发布','作品标题','标题','拖拽','点击上传','添加视频','添加封面','填写作品信息','视频描述','正文','话题'];
  var textHits = [];
  var nodes = document.querySelectorAll('button, div, span, a, label, section, p');
  for (var j=0;j<nodes.length;j++){
    var el = nodes[j];
    var t = (el.innerText || '').trim();
    if (!t || t.length > 40) continue;
    for (var k=0;k<kws.length;k++){
      if (t === kws[k] || t.indexOf(kws[k])>=0) {
        var r = el.getBoundingClientRect();
        if (r.width>4 && r.height>4) textHits.push({text:t, tag:el.tagName, cls:(el.className && el.className.toString ? el.className.toString() : el.className || '').slice(0,80), rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}});
        break;
      }
    }
  }
  return { url: location.href, title: document.title, inputs: seen.map(describe), textHits: textHits.slice(0,80) };
})()
`;

async function dumpFrame(frame: Frame) {
  try {
    return await frame.evaluate(DUMP_SRC as any)
  } catch (err) {
    return { error: String(err) }
  }
}

async function dumpPage(page: Page, tag: string) {
  const out: any = { tag, mainUrl: page.url(), frames: [] }
  for (const f of page.frames()) {
    const d: any = await dumpFrame(f)
    d.frameUrl = f.url()
    out.frames.push(d)
  }
  return out
}

async function warmup(page: Page, name: string) {
  if (name === 'xiaohongshu') {
    try {
      await page.goto('https://www.xiaohongshu.com', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForTimeout(3000)
      try { await page.goto('https://creator.xiaohongshu.com', { waitUntil: 'domcontentloaded', timeout: 60_000 }) } catch {}
      await page.waitForTimeout(2500)
    } catch {}
  }
}

async function main() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null
  const context: BrowserContext = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: { width: 1440, height: 1000 },
    args: ['--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
  })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const result: any = {}
  try {
    for (const [name, url] of Object.entries(URLS)) {
      if (only && only !== name) continue
      const page = await context.newPage()
      console.log(`\n=== [${name}] 打开 ${url} ===`)
      await warmup(page, name)
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      } catch (e) {
        console.log(`  goto 失败: ${String(e).slice(0, 200)}`)
      }
      // 等页面 idle + 观察
      try { await page.waitForLoadState('networkidle', { timeout: 30_000 }) } catch {}
      for (let i = 0; i < 5; i++) {
        await page.waitForTimeout(3000)
        console.log(`   [${name}] +${3 * (i + 1)}s, url=${page.url()}`)
      }
      const shot1 = join(OUT_DIR, `dumpv3_${name}_before_${ts}.png`)
      await page.screenshot({ path: shot1, fullPage: false }).catch(() => undefined)
      const first: any = await dumpPage(page, name + '_before')
      first.screenshot = shot1
      const inputCount1 = first.frames.reduce((s: number, f: any) => s + (f.inputs?.length || 0), 0)
      console.log(`   [${name}] 初次 file inputs: ${inputCount1}`)

      if (inputCount1 < 2) {
        console.log(`   [${name}] 尝试模拟触发上传入口...`)
        const triggers = ['上传视频', '点击上传', '添加视频', '本地上传', '上传', '发布视频', '选择视频', '拖拽']
        for (const kw of triggers) {
          const loc = page.locator(`text=${kw}`).first()
          if (await loc.count().catch(() => 0)) {
            try {
              await loc.scrollIntoViewIfNeeded({ timeout: 2000 })
              await loc.hover({ timeout: 1500 }).catch(() => undefined)
              await page.waitForTimeout(400)
              await loc.click({ timeout: 2000 }).catch(() => undefined)
              await page.waitForTimeout(1500)
              console.log(`     hover+click: ${kw}`)
              break
            } catch {}
          }
        }
      }
      const shot2 = join(OUT_DIR, `dumpv3_${name}_after_${ts}.png`)
      await page.screenshot({ path: shot2, fullPage: false }).catch(() => undefined)
      const second: any = await dumpPage(page, name + '_after')
      second.screenshot = shot2
      const inputCount2 = second.frames.reduce((s: number, f: any) => s + (f.inputs?.length || 0), 0)
      console.log(`   [${name}] 触发后 file inputs: ${inputCount2}`)

      result[name] = { before: first, after: second }
    }
    const outFile = join(OUT_DIR, `dumpv3_inputs_${ts}.json`)
    writeFileSync(outFile, JSON.stringify(result, null, 2), 'utf-8')
    console.log(`\n✓ 写入 ${outFile}`)
  } finally {
    await context.close().catch(() => undefined)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
