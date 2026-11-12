# MBTI-PRO

81 型人格测试网站 — Vue 3 + TypeScript + Tailwind CSS 前端，Express.js + Prisma + SQLite 后端，部署于腾讯云。

> **2026-11-12 当前产品口径（优先于下方旧描述）**
> - 首发测试为 **40 题**：四维各 10 题，约 6-8 分钟；T_F 不再把逻辑推理题计入人格类型。
> - 商业模式：**小红书店铺 0.99 元购买 → 兑换码 → 一次解锁 40 题测试和全部报告内容**；不再使用邮箱/分享/打赏/二次付费。
> - 题目选择与评分规则见 `server/src/content/short-form.ts`、`server/src/services/scoring.ts`；题库精简依据见 `docs/MBTI-PRO-题库精简与最短题量评估-2026-11-12.md`。
> - 兑换码生成：`cd server && npm run access:codes -- --count 100 --batch xhs-2026-11`；输出 `server/access-codes/`（已 gitignore，不入库）。

## 项目结构

```
client/          Vue 3 + Vite 前端 (TypeScript + Tailwind CSS)
server/          Express.js 后端 API (TypeScript + Prisma + SQLite)
scripts/         视频管线、图片生成、数据脚本
```

## 线上地址

- 网站：https://mbti-pro.com/
- 自动部署：push 到 `master` 分支 → GitHub Actions → SSH 到腾讯云 → git reset + build + `systemctl restart mbti-pro`
- 线上服务器（2026-11-12 重建）：腾讯云香港轻量 `43.132.217.70`，nginx + systemd + certbot，运维细节见 `docs/MBTI-PRO-上线完成与运维交接-2026-11-12.md`

## 服务器关键路径

| 路径 | 说明 |
|------|------|
| `/opt/MBTI-PRO` | 项目根目录 |
| `/opt/MBTI-PRO/server/generated_images/` | 81 型人格 JPG 原图 |
| `/opt/MBTI-PRO/server/generated_images/thumbs/` | 320px WebP 缩略图 |
| `/opt/MBTI-PRO/server/generated_images/mediums/` | 640px WebP 中图 |
| `/opt/MBTI-PRO/server/prisma/dev.db` | SQLite 数据库 |

## 图片端点

| 端点 | 用途 | 大小 |
|------|------|------|
| `/api/images/:code` | 原图 JPG | 全尺寸 |
| `/api/mediums/:code` | 中图 WebP (详情页/海报) | 640px |
| `/api/thumbs/:code` | 缩略图 WebP (首页网格) | 320px |

## ⚠️ 关键规则

### AI 生成内容审核（强制）

**使用外部非免费的 AI 大模型生成图片或视频之前，必须先将生成词（prompt）发给用户审核。**
用户审核通过后，才能执行生成任务。

此规则适用于：
- 火山引擎 Doubao Seedream 图片生成
- 任何付费 AI 图片/视频生成 API
- edge-tts 等免费 TTS 工具不受此限制

违反此规则将造成 API 费用浪费和返工。

### 名称修改（强制）

人格类型的中文名称同时存在两个位置：
1. **代码文件**：`server/src/content/types.ts` 中的 `typeNames` 映射
2. **数据库**：`PersonalityType` 表的 `name` 字段

修改名称时两个位置都必须更新。部署脚本已包含 `npx tsx scripts/fix-names.ts` 自动修复数据库名称。

### 代表人物选人红线（强制）

81 型「代表人物」是付费内容的一部分，选人须遵守三条红线（来源：DSH 内容审核 2026-11-13 · Y4）：

1. **在世政治人物、在世宗教领袖、在世道德模范**一律不进**主人物位**；次位可以，且只写正面公开身份。
2. **有暴力犯罪、加害他人记录的真人**一律不用（顾城即此类，已写入 `scripts/audit-depth-content.mjs` 的 `VIOLENCE_BLACKLIST`）。
3. 已故人物的死因 / 疾病 / 性取向 / 司法遭遇，只在**中性、公开、已被主流媒体长期报道**的范围内引用，不新增细节、不做评价。

名单唯一事实源是 `server/src/content/types.ts` 的 `CELEBRITY_MAP`。改完必须同步三处，否则线上仍是旧名单：

```bash
cd server
npx tsx ../scripts/audit-depth-content.mjs   # 必须退出码 0
npx tsx ../scripts/sync-handcrafted-celebrities.mjs
npx tsx ../scripts/sync-db-celebrities.mjs
npm run demo:export                          # client/public/demo/types.json 是内容快照
```

新增姓名的身份必须补进 `server/src/content/celebrity-fields.ts`，虚构角色还要登记 `scripts/pop-culture-reps.json`（身份写《作品》），否则结果页会显示「公众人物」或审核表不标「流行」。

### 部署流程

```bash
git add . && git commit -m "..." && git push origin master
# GitHub Actions 自动完成后续部署（~50s）
```

部署验证：
```bash
curl -s "https://mbti-pro.com/api/results/ABCD" | grep -o '"name":"[^"]*"'
# 预期输出: "name":"全能者型"
```

## 技术栈

- **前端**: Vue 3 (Composition API + `<script setup>`) + Vite + TypeScript + Tailwind CSS
- **后端**: Express.js + TypeScript + Prisma ORM + SQLite
- **部署**: Tencent Cloud（香港轻量）+ nginx + systemd + certbot + GitHub Actions
- **视频**: Playwright headless + Python edge-tts + FFmpeg
