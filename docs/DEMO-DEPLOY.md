# 静态演示版部署说明

> 背景：MBTI-PRO 的服务器已到期停用。本方案用**零成本的纯静态托管**继续提供
> 可访问的演示站点，保留产品 90% 的展示价值。
>
> 关键设计：**评分引擎是纯函数，内容与题库都是静态数据** —— 所以整站可以不要后端。

---

## 1. 它和正式版的区别

| | 正式版（已停用） | 静态演示版 |
|---|---|---|
| 首页 / 答题 / 结果页 | ✅ | ✅ **完全可用** |
| 题库 | 数据库 | 构建期导出的 JSON（100 题） |
| 评分 | 后端计算 | **浏览器本地计算**（复用同一份纯函数） |
| 81 型内容 | 数据库 | 构建期导出的 JSON（含 4 个维度模块） |
| 类型插画 | 后端动态返回 | 预生成 webp（81 张） |
| 支付 / 打赏 | ✅ | ❌ 停用，按钮改为「演示环境 · 查看完整报告」 |
| 邮件发送报告 | ✅ | ❌ 停用 |
| 数据落库 / 邀请裂变统计 | ✅ | ❌ 停用（不写入任何数据） |
| 页面顶部标识 | — | 有明确的**「演示环境」**横幅 |

**演示版页面顶部有一条深色横幅**说明"支付与邮件服务已停用，不会产生任何收费"，
并且解锁按钮不要求邮箱、也不声称"PDF 已发送"。**不做虚假承诺。**

---

## 2. 重新构建（数据变了才需要）

```bash
# 第 1 步：从题库与内容模块导出静态数据（含 81 张插画）
cd server
./node_modules/.bin/tsx scripts/export-demo-data.ts
#   → client/public/demo/{questions.json, types.json, meta.json, images/*.webp}

# 第 2 步：构建演示版
cd ../client
node scripts/build-demo.mjs
#   → dist/（含 404.html，用于 SPA 深链回退）
```

**本地预览**

```bash
cd client
npx vite preview --port 4174
```

**构建后冒烟测试**（真实 Chrome，检查渲染 / 图片 / 付费墙 / 演示解锁）

```bash
cd server
DEMO_SHOT_DIR=/tmp ./node_modules/.bin/tsx scripts/verify-demo-build.ts http://127.0.0.1:4174
```

---

## 3. 部署方式（三选一，都是 0 元）

### 方式 A：GitHub Pages（**推荐，已为你准备好**）

`gh-pages` 分支**已经推送完成**，内容是构建好的 `dist`（含 `.nojekyll` 与
`404.html`，并且 `robots.txt` 设为 `Disallow` 以免演示站被搜索引擎收录）。

**你只需要做一步：**

> 打开 https://github.com/shadowwei5/MBTI-PRO/settings/pages
> → **Source** 选 `Deploy from a branch`
> → **Branch** 选 `gh-pages` / `(root)`
> → **Save**

约 1 分钟后可访问：

```
https://shadowwei5.github.io/MBTI-PRO/
```

**更新演示站**（改了数据或代码后）：

```bash
cd client && node scripts/build-demo.mjs
# 然后把 dist 内容重新推送到 gh-pages 分支
```

---

### 方式 B：Vercel

1. 在 Vercel 导入 `shadowwei5/MBTI-PRO` 仓库
2. **Root Directory** 保持仓库根目录（根目录已有 `vercel.json`）
3. **Environment Variable** 加一条：`VITE_DEMO_MODE` = `1`
4. 部署

> 仓库根目录的 `vercel.json` 已经配置好了构建命令、输出目录与 SPA 重写规则。
> 但它的 rewrite 是 `/((?!api/).*)` → 会把 `/demo/*.json` 也重写掉。
> **如果用 Vercel，请把 rewrite 改成 `/((?!api/|demo/|assets/).*)`。**

---

### 方式 C：Netlify

1. 在 Netlify 导入仓库
2. **Base directory** = `client`
3. **Build command** = `node scripts/build-demo.mjs`
4. **Publish directory** = `client/dist`
5. 环境变量：`VITE_DEMO_MODE` = `1`

---

## 4. 关于域名

`mbti-pro.com` 域名保留着，两种用法：

| 用法 | 做法 |
|---|---|
| 指向静态演示站 | Vercel / Netlify 项目里绑定自定义域名（免费）；GitHub Pages 也支持 |
| 做作品展示页 | 只放两个项目的介绍、截图、录屏与联系方式，指向 GitHub |

> ⚠️ **如果域名暂时不解析，请不要在作品集里放这个链接。** 打不开的链接比没有链接更伤信任。

---

## 5. 演示版不写入任何数据

这是刻意的设计，不是缺陷：

- 静态数据来自 `client/public/demo/*.json`，只读
- `saveRecord` / `saveEmail` / `submitFeedback` 等只返回本地生成的假 id
- `createPayment` / `createDonation` / 邮件相关接口抛出明确提示「演示环境：该功能已停用」
- 邀请码统计返回空结果

所以**演示站不可能产生订单、邮件或被刷**，可以放心公开。

---

## 6. 相关文件

| 文件 | 作用 |
|---|---|
| `server/scripts/export-demo-data.ts` | 导出题库 + 81 型内容 + 81 张插画到 `client/public/demo/` |
| `client/scripts/build-demo.mjs` | 以 `VITE_DEMO_MODE=1` 构建，并生成 `404.html` |
| `server/scripts/verify-demo-build.ts` | 真实浏览器冒烟测试 |
| `client/src/services/demoMode.ts` | 演示模式开关（读 `VITE_DEMO_MODE`） |
| `client/src/services/demoApi.ts` | 静态数据实现，接口与 `api.ts` 完全一致 |
| `client/src/services/scoring.ts` | 评分引擎（与后端同一份纯函数，复制而来） |
| `client/src/utils/typeImage.ts` | 类型插画地址（区分正式/演示两种路径） |

---

## 7. 一个曾经的坑（已修）

`server/src/seed.ts` 原先在模块加载时**无条件执行 `main()`**。当
`export-demo-data.ts` import 它来复用题库数组时，会连带**清空数据库并重写**。

现已改为只有被直接执行时才跑：

```ts
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) { main() /* ... */ }
```

`npm run db:seed` 行为不变；作为模块 import 则不再有副作用。
