#!/usr/bin/env node
/**
 * 把构建好的 dist 推送到 GitHub Pages（gh-pages 分支）
 *
 * 用法：
 *   node scripts/deploy-ghpages.mjs            # 用已有 dist
 *   node scripts/deploy-ghpages.mjs --build    # 先构建再推送
 *
 * 前置：
 *   - 已配置 origin 为 MBTI-PRO 仓库，且本机 SSH key 对该仓库有写权限
 *   - dist 已由 build-demo.mjs 生成
 *
 * 首次推送后，需要在 GitHub 仓库设置里启用 Pages：
 *   Settings → Pages → Source = Deploy from a branch → Branch = gh-pages / (root)
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = path.resolve(__dirname, '..')
const DIST = path.join(CLIENT_DIR, 'dist')
const REPO = process.env.GHPAGES_REPO || 'git@github.com:shadowwei5/MBTI-PRO.git'

function run(cmd, cwd) {
  console.log(`$ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error(`\n✗ 未找到 ${DIST}/index.html，请先执行： node scripts/build-demo.mjs\n`)
  process.exit(1)
}

if (process.argv.includes('--build')) {
  run('node scripts/build-demo.mjs', CLIENT_DIR)
}

// 在临时目录里组装 gh-pages 分支（不污染主仓库的工作区）
const STAGE = fs.mkdtempSync(path.join(os.tmpdir(), 'mbti-ghpages-'))
console.log(`\n暂存目录: ${STAGE}`)

fs.cpSync(DIST, STAGE, { recursive: true })

// GitHub Pages 需要 .nojekyll，否则不会服务 _ 开头的文件并会做 Jekyll 处理
fs.writeFileSync(path.join(STAGE, '.nojekyll'), '')
// 演示站不应被搜索引擎收录，避免与正式域名竞争
fs.writeFileSync(path.join(STAGE, 'robots.txt'), 'User-agent: *\nDisallow: /\n')
const sitemap = path.join(STAGE, 'sitemap.xml')
if (fs.existsSync(sitemap)) fs.rmSync(sitemap)

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)

run('git init -q -b gh-pages', STAGE)
run('git add -A', STAGE)
execSync(
  `git -c user.name="shadowwei5" -c user.email="348026613@qq.com" commit -q -m ${JSON.stringify(
    `deploy: MBTI-PRO 静态演示版（${stamp}）`,
  )}`,
  { cwd: STAGE, stdio: 'inherit' },
)
run(`git remote add origin ${REPO}`, STAGE)
run('git push -f origin gh-pages', STAGE)

fs.rmSync(STAGE, { recursive: true, force: true })

const fileCount = (function count(dir) {
  let n = 0
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? count(path.join(dir, e.name)) : 1
  }
  return n
})(DIST)

console.log(`\n✓ 已推送 ${fileCount} 个文件到 gh-pages`)
console.log('  访问地址: https://shadowwei5.github.io/MBTI-PRO/')
console.log('  若尚未启用 Pages，请到仓库 Settings → Pages 选择 gh-pages 分支')
