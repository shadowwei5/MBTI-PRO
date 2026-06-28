# MBTI-PRO

81 型人格测试网站 — Vue 3 + TypeScript + Tailwind CSS 前端，Express.js + Prisma + SQLite 后端，部署于腾讯云。

## 项目结构

```
client/          Vue 3 + Vite 前端 (TypeScript + Tailwind CSS)
server/          Express.js 后端 API (TypeScript + Prisma + SQLite)
scripts/         视频管线、图片生成、数据脚本
```

## 线上地址

- 网站：https://mbti-pro.com/
- 自动部署：push 到 `master` 分支 → GitHub Actions → SSH 到腾讯云 → git pull + build + pm2 restart

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
- **部署**: Tencent Cloud + nginx + pm2 + GitHub Actions
- **视频**: Playwright headless + Python edge-tts + FFmpeg
