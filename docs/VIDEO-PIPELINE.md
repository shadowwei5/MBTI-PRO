# MBTI-PRO 视频自动化管线 · 完整文档

> 最后更新：2026-06-28 | 状态：生产就绪

---

## 一、管线概览

```
npx tsx scripts/video-pipeline/index.ts --type ENFJ
     │
     ├── [1/5] 数据获取 ──→ API / 本地 JSON
     ├── [2/5] Playwright 录屏 ──→ WebM（CSS 动画实时捕获）
     ├── [3/5] TTS 配音 ──→ MP3 + SRT 字幕
     ├── [4/5] FFmpeg 合成 ──→ MP4（H.264 + AAC）
     └── [5/5] 封面生成 ──→ PNG（1024×1365）
```

---

## 二、命令速查

### 视频生成

```bash
# 日常视频：每天一种人格，30 秒
npx tsx scripts/video-pipeline/index.ts --type ENFJ

# 介绍视频：首条宣传片，54 秒
npx tsx scripts/video-pipeline/index.ts --type ENFJ --template intro-video --duration 54

# 批量生成：未来 7 天内容
npx tsx scripts/video-pipeline/index.ts --batch --count 7

# 预览模式：不实际生成，只看类型列表
npx tsx scripts/video-pipeline/index.ts --batch --count 7 --dry-run
```

### 素材生成

```bash
# 头像 + 背景 + 封面模板
npx tsx scripts/video-pipeline/render-assets.ts
```

### 仅封面

```bash
# 通用封面（??? 好奇驱动）
npx tsx scripts/video-pipeline/generate-cover.ts --default

# 指定类型封面
npx tsx scripts/video-pipeline/generate-cover.ts --type ENFJ
```

---

## 三、产出文件

```
video/
├── output/
│   ├── ENFJ_daily-type.mp4      ← 日常视频
│   ├── ENFJ_intro-video.mp4     ← 介绍视频
│   └── cover_ENFJ.png           ← ENFJ 类型封面（1024×1365）
├── assets/
│   ├── avatar_200x200.png       ← 抖音头像
│   ├── bg_1080x480.png          ← 抖音主页背景
│   └── cover_template_1024x1365.png  ← 通用封面模板
├── work/{CODE}/                 ← 临时工作目录（.gitignore）
│   ├── {CODE}.json              ← 类型数据缓存
│   ├── recording/               ← Playwright 录屏
│   └── audio/                   ← TTS 配音 + 字幕
└── raw-footage/                 ← 用户原始素材（.gitignore）
```

---

## 四、抖音发布固定流程

### 首次发布前（一次性）

1. 确认 MBTI-PRO 服务器运行（`localhost:3001`）
2. 注册抖音账号「MBTI-PRO 测试官方」
3. 上传头像：`video/assets/avatar_200x200.png`
4. 上传背景：`video/assets/bg_1080x480.png`
5. 填写简介：`MBTI-PRO 是全新的 81 型人格分类体系，突破传统二分法局限，比传统 MBTI 精准 5 倍。完全免费测试网址：https://mbti-pro.duckdns.org/`

### 首条视频发布

```bash
# 生成介绍视频
npx tsx scripts/video-pipeline/index.ts --type ENFJ --template intro-video --duration 54
```

发布参数：
- 视频：`video/output/ENFJ_intro-video.mp4`
- 封面：`video/output/cover_ENFJ.png`（或通用封面 `video/assets/cover_template_1024x1365.png`）
- 标题：`你测的 MBTI，可能根本不准 #MBTI #人格测试`
- 标签：`#MBTI #MBTI测试 #人格测试 #性格分析 #81型人格 #心理学 #自我认知 #你是哪种人格`

### 日常发布（第 2 天起，每天 1 条，共 81 天）

```bash
# 一次生成未来 7 天
npx tsx scripts/video-pipeline/index.ts --batch --count 7
```

每条视频发布参数：
- 视频：`video/output/{CODE}_daily-type.mp4`
- 封面：`video/output/cover_{CODE}.png`
- 标题模板：`你是 {类型名} 型人格吗？#MBTI`
- 标签：`#MBTI #人格测试 #81型人格 #性格分析 #自我认知 #{CODE}`

---

## 五、管线调整指南

### 改视频时长

```bash
--duration 30   # 当前日常视频 30 秒
--duration 45   # 如需要更长的
```

### 改配音脚本

编辑 `scripts/video-pipeline/generate-audio.ts`：
- `getIntroVideoScript()` → 介绍视频文案
- `getDailyTypeScript()` → 日常视频文案

### 改视频画面

编辑 `scripts/video-pipeline/templates/`：
- `daily-type.html` → 日常视频画面模板
- `intro-video.html` → 介绍视频画面模板

### 改 TTS 语速/声音

编辑 `scripts/video-pipeline/generate-audio.ts`：
- `VOICE` → 语音角色（当前 `zh-CN-XiaoxiaoNeural`）
- `RATE` → 语速（当前 `+15%`，范围 `-50%` ~ `+100%`）

### 添加字幕

编辑 `scripts/video-pipeline/index.ts`，在 Step 4 中把 `muxAudioAndSubtitles(tempMp4, audioPath, '', outputPath)` 的第三个参数 `''` 改为 `subtitlePath`。

调整字幕样式：编辑 `scripts/video-pipeline/compose-video.ts` 中的 `force_style` 参数。

### 重新生成视觉素材

```bash
# 修改 render-assets.ts 后重新运行
npx tsx scripts/video-pipeline/render-assets.ts
```

### 生成通用封面

```bash
npx tsx scripts/video-pipeline/index.ts --cover-only
```

---

## 六、关键文件索引

| 文件 | 作用 |
|------|------|
| `scripts/video-pipeline/index.ts` | CLI 主入口 |
| `scripts/video-pipeline/generate-audio.ts` | TTS 配音脚本 + 文案 |
| `scripts/video-pipeline/render-frames.ts` | Playwright 录屏引擎 |
| `scripts/video-pipeline/compose-video.ts` | FFmpeg 合成引擎 |
| `scripts/video-pipeline/generate-cover.ts` | 封面图生成 |
| `scripts/video-pipeline/render-assets.ts` | 头像/背景/封面模板生成 |
| `scripts/video-pipeline/utils/colors.ts` | 9 组颜色系统 |
| `scripts/video-pipeline/templates/daily-type.html` | 日常视频 HTML 模板 |
| `scripts/video-pipeline/templates/intro-video.html` | 介绍视频 HTML 模板 |
| `video/assets/` | 视觉素材输出 |
| `video/output/` | 视频+封面输出 |
| `决策/抖音账号定位/` | 账号策略决策文件（dbs-decision） |

---

## 七、问题排查

| 问题 | 检查 |
|------|------|
| 视频没有声音 | 确认 `pip install edge-tts` 已安装 |
| 图片不显示 | 确认服务器运行 `localhost:3001` |
| 字体不渲染 | 自动 fallback 到 Microsoft YaHei，不影响 |
| 封面颜色不对 | 检查 `utils/colors.ts` 中该人格代码的颜色计算 |
| 配音时长不匹配 | 调整 `RATE` 参数或修改文案长度 |
