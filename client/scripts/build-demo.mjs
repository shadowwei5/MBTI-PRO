#!/usr/bin/env node
/**
 * 构建静态演示版
 *
 * 服务器到期后，用纯静态托管继续提供可访问的演示站点。
 * 本脚本做三件事：
 *   1. 设置 VITE_DEMO_MODE=1（切换到静态数据 + 本地评分，停用支付/邮件）
 *   2. 调用 vite build
 *   3. 生成 dist/404.html（GitHub Pages / 静态托管的 SPA 深链回退）
 *
 * 用法：node scripts/build-demo.mjs
 * 前置：先在 server 目录跑一次 `tsx scripts/export-demo-data.ts` 导出题库与 81 型内容
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = path.resolve(__dirname, '..')
const DIST = path.join(CLIENT_DIR, 'dist')

function run(cmd) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, {
    cwd: CLIENT_DIR,
    stdio: 'inherit',
    env: { ...process.env, VITE_DEMO_MODE: '1' },
  })
}

// 0. 前置检查：演示数据必须已导出
const dataDir = path.join(CLIENT_DIR, 'public', 'demo')
for (const f of ['questions.json', 'types.json']) {
  if (!fs.existsSync(path.join(dataDir, f))) {
    console.error(
      `\n✗ 缺少演示数据 ${path.join(dataDir, f)}\n` +
        `  请先执行： cd ../server && ./node_modules/.bin/tsx scripts/export-demo-data.ts\n`,
    )
    process.exit(1)
  }
}

const imgCount = fs.existsSync(path.join(dataDir, 'images'))
  ? fs.readdirSync(path.join(dataDir, 'images')).filter((f) => f.endsWith('.webp')).length
  : 0
console.log(`演示数据检查通过：questions.json / types.json / ${imgCount} 张类型插画`)

// 1 + 2. 类型检查与构建
run('npx vue-tsc -b')
run('npx vite build')

// 3. SPA 深链回退
const indexHtml = path.join(DIST, 'index.html')
const notFoundHtml = path.join(DIST, '404.html')
fs.copyFileSync(indexHtml, notFoundHtml)
console.log('\n已生成 dist/404.html（SPA 深链回退）')

// 报告体积
function dirSize(dir) {
  let total = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    total += e.isDirectory() ? dirSize(p) : fs.statSync(p).size
  }
  return total
}
const mb = (dirSize(DIST) / 1048576).toFixed(2)
const files = (function count(dir) {
  let n = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? count(path.join(dir, e.name)) : 1
  }
  return n
})(DIST)

console.log(`\n构建完成：dist/ 共 ${files} 个文件，${mb} MB`)
console.log('本地预览： npx vite preview')
