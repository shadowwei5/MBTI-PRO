# MBTI-PRO 人格测试系统 - 架构设计文档

> 版本: v1.6 | 日期: 2026-06-18 | 状态: 100题重构 + 评分统一对称阈值 + 图片后处理管线 + 3张图待API重新生成

---

## 一、架构概览

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户端 (Client)                        │
│  ┌──────────────────────┐  ┌─────────────────────────┐  │
│  │   Web SPA (Vue 3)    │  │   移动端 H5 (响应式)      │  │
│  │   Desktop + Mobile   │  │   微信/浏览器内嵌         │  │
│  └──────────┬───────────┘  └───────────┬─────────────┘  │
└─────────────┼──────────────────────────┼────────────────┘
              │         HTTPS              │
┌─────────────▼──────────────────────────▼────────────────┐
│                    应用层 (Application)                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Express.js 5 + Prisma + SQLite         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │  │
│  │  │ 题目路由  │ │ 结果路由  │ │  记录路由        │   │  │
│  │  │/api/questions│ │/api/results│ │ /api/records    │   │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘   │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                    数据层 (Data)                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │              SQLite (开发) / MySQL (生产)            │  │
│  │  3 表：questions / personality_types / test_records │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 1.2 技术选型（实际）

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| **前端框架** | Vue 3 + TypeScript | 3.4+ | Composition API，生态成熟 |
| **构建工具** | Vite | 5.x | 极速HMR，构建 ~3.5s |
| **CSS框架** | Tailwind CSS | 3.4 | 原子化CSS，响应式友好 |
| **路由** | Vue Router | 4.x | SPA 路由 |
| **后端框架** | Express.js | 5.x | 轻量灵活 |
| **ORM** | Prisma | 5.8 | 类型安全，迁移管理 |
| **数据库** | SQLite (当前) | - | 零配置开发 |

---

## 二、前端架构

### 2.1 实际目录结构

```
client/src/
├── components/
│   ├── TypeAvatar.vue          # 81型算法式 SVG 几何头像
│   ├── DimensionSpectrum.vue   # 四维度光谱可视化（含得分圆圈）
│   ├── OptionGroupBipolar.vue  # 双极 likert 选项组件
│   ├── SharePosterModal.vue    # 分享海报弹窗 (Canvas 750×1334 + QR)
│   └── ProgressBar.vue         # 答题进度条
├── views/
│   ├── HomeView.vue            # 首页（品牌 + 介绍 + 81型网格全览）
│   ├── TestView.vue            # 答题页（100题 + 断点续答 + 客观题倒计时 + 后端评分）
│   └── ResultView.vue          # 结果页（头像 + AI大图 + 概览 + 光谱 + 日常画像 + 优劣势 + 海报）
├── services/
│   └── api.ts                  # API 服务层（含 submitScore POST /api/results/score）
├── utils/
│   ├── colors.ts               # 四气质12色调色板 + 色彩分配引擎
│   └── meta.ts                 # OG / Twitter 动态 meta 注入
├── router/
│   └── index.ts
├── App.vue
└── main.ts
```

### 2.2 着色系统架构

```
colors.ts
├── TEMPERAMENT_COLORS     # 传统四气质色定义 (NT/NF/SJ/SP)
├── FAMILY_PALETTE         # 4色系 × 3 E_I色阶 = 12色调色板
├── getTypeColorFamily()   # 81型 → 四气质色系 (规则引擎)
├── getTypeHex()           # 81型 → 专属 hex 颜色
├── getTypeColor()         # 81型 → 完整颜色信息
├── getTemperament()       # 传统16型 → 四气质标签
└── getTemperamentColor()  # 传统16型 → 气质颜色
```

### 2.3 路由设计

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | HomeView | 首页 |
| `/test` | TestView | 答题页 |
| `/result/:type` | ResultView | 结果页（支持直接 URL 访问 + 测试后跳转） |

### 2.4 核心数据流

```
用户答题 → localStorage 缓存储存 → 提交（携带 presentedIds）
    ↓
POST /api/results/score (后端纯函数评分)
    ↓
返回 { typeCode, scores, chars, confidence }
    ↓
POST /api/records (写入测试记录)
    ↓
跳转 /result/:type?scores=&chars= → ResultView 渲染（头像 + AI大图 + 概览 + 光谱 + 海报）
```

---

## 三、后端架构

### 3.1 实际目录结构

```
server/src/
├── index.ts                    # Express 入口 (端口 3001)
├── seed.ts                     # 种子脚本 (100题 + 81型)
├── routes/
│   ├── questions.ts            # GET /api/questions
│   ├── results.ts              # GET /api/results, /api/results/:code, POST /api/results/score
│   ├── records.ts              # POST /api/records
│   └── images.ts               # GET /api/images/:typeCode (24h 缓存静态托管)
├── services/
│   ├── scoring.ts              # 纯函数评分引擎（双源合并 T_F + 三级阈值 + 置信度）
│   └── __tests__/
│       └── scoring.test.ts     # vitest 20 个用例（边界/阈值/置信度/元数据）
└── content/
    └── types.ts                # 81型内容引擎
        ├── 12 维度模块 (ei/sn/tf/pj × 3位置)
        ├── 81 型全职业映射 FULL_CAREER_MAP
        ├── 81 型中文名称 TYPE_NAMES
        ├── 16 型手写精品描述 handCraftedTypes
        ├── buildTypeContent()  # 组装引擎
        └── generateAllTypeCodes()

server/ (根目录脚本与产物)
├── scripts/
│   ├── generate_images.py      # 豆包 Seedream-5.0 批量生成 81 张人格大图
│   ├── regenerate_text_images.py # 重新生成含文字图片（强化反文字 prompt）
│   ├── detect_text.py          # easyocr 文字检测扫描
│   ├── remove_text.py          # 文字去除 V1（easyocr + 纯色填充）
│   ├── remove_text_v2.py       # 文字去除 V2（easyocr + OpenCV inpainting）
│   ├── adjust_colors.py        # 琥珀组颜色偏移 V1
│   ├── adjust_colors_v3.py     # 琥珀组颜色偏移 V3（肤色保护）
│   ├── repair_images.py        # 被误删区域 inpainting 修复
│   ├── repair_pollinations.py  # 尝试 Pollinations.AI 重新生成
│   └── config.py               # 火山引擎 API 配置
├── generated_images/           # 81 张 JPG + 9 张备份 + 检测报告
│   ├── <TYPE>.jpg (×81)        # 人格画像 (2048×2048, Low Poly 矢量插画)
│   ├── <TYPE>_backup.jpg (×9)  # 琥珀组原始备份
│   └── _text_detection_report.json
├── expand_overviews.py         # 概览扩充工具 (V1/V2/V3 三轮)
├── generate_image_prompts.py   # 65型 AI 图像提示词生成器
├── image_prompts_65.json       # 机器可读提示词数据
└── image_prompts_65.md         # 人类可读提示词文档 (9组组织)
```

### 3.2 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/questions` | 获取全部 100 题 |
| GET | `/api/results` | 获取全部 81 型列表（网格用） |
| GET | `/api/results/:typeCode` | 获取指定类型详情（概览+优势+成长+职业+名人+维度模块） |
| POST | `/api/results/score` | 后端评分（接收 answers + 可选 questionIds，返回 typeCode/scores/chars/confidence） |
| POST | `/api/records` | 保存测试记录 |
| GET | `/api/images/:typeCode` | 81 型 AI 大图静态托管（60s 浏览器缓存，便于颜色调整后即时生效） |

### 3.2.1 评分服务

```
services/scoring.ts (纯函数, 22 vitest 用例全部通过)
  ├─ classifySymmetric(score, dim)  # 四维统一对称阈值: < -17 / [-17,+16] / > +16
  ├─ classifyTF(score)              # T_F 同对称阈值（因双源合并后满分与其他维度相同）
  ├─ computeConfidence(scores)       # 各维度归一化到最近阈值距离的平均 (0-1)
  └─ calculateScore(answers, questions, timedOut)
       ├─ Likert: A/B/C/D/E → +2/+1/0/-1/-2（未答跳过，不计分）
       ├─ 客观题: 答对 +2 / 答错 -2 / 超时 -2 / 未答且未超时 0
       ├─ T_F 双源: T_F_sub (15主观 [-30,+30]) + T_F_obj (10客观 [-20,+20]) 合并
       ├─ timedOut: 前端 20 秒倒计时强制锁定，标记超时题目
       └─ 输出: { typeCode, scores(T_F_sub/T_F_obj), chars, dimAnswered, dimTotals, confidence }
```
> 2026-06-17 更新：T_F 阈值从不对称 [10,29] 统一为对称 ±17。100 题结构：四维各 25 题，T_F = 15 主观 + 10 客观固定。

### 3.3 数据库设计（Prisma + SQLite）

```prisma
model Question {
  id            Int     @id
  text          String
  dimension     String  // E_I, S_N, T_F, P_J
  type          String  // likert, objective
  direction     String  // positive, negative
  options       String  // JSON
  correctAnswer String?
  sortOrder     Int     @default(0)
}

model PersonalityType {
  code           String @id // "ENTJ", "EABJ", etc.
  name           String     // "指挥官型", etc.
  isTraditional  Boolean
  overview       String     // 700字+叙事概览
  strengths      String     // JSON array (8项)
  growthAreas    String     // JSON array (4项)
  careers        String     // JSON array (7个)
  suitableFields String     // JSON array (5个)
  population     String?    // 人口占比
  celebrities    String?    // JSON array (5位)
  eiModule       String?    // E_I 维度详细描述
  snModule       String?    // S_N 维度详细描述
  tfModule       String?    // T_F 维度详细描述
  pjModule       String?    // P_J 维度详细描述
}

model TestRecord {
  id        String   @id @default(cuid())
  typeCode  String
  scores    String   // JSON
  chars     String   // JSON
  answers   String   // JSON
  duration  Int
  createdAt DateTime @default(now())
}
```

### 3.4 9组颜色分类架构

基于感知维度(S/N/B) × 判断维度(T/C/F) 交叉形成 9 组配色方案，用于 AI 图像生成：

```
getColorGroup(code)
  ├─ 提取感知维度 = S | B | N
  ├─ 提取判断维度 = T | C | F
  ├─ 查表 → 9组之一 (G1-G9)
  └─ 返回 { groupName, hexColor, visualKeywords, shapeStyle, texture, mood }

9 组定义：
  S×T → G1 岩灰组   S×C → G2 钢蓝组   S×F → G3 琥珀组
  B×T → G4 银灰组   B×C → G5 燕麦组   B×F → G6 炭灰组
  N×T → G7 靛青组   N×C → G8 翠绿组   N×F → G9 深紫组
```

### 3.5 AI 图像提示词生成架构

```
generate_image_prompts.py
  ├─ 定义 9 组颜色方案 (组名/hex/关键词/形状/纹理/情绪)
  ├─ 遍历 65 新型人格类型
  ├─ 按代码推导感知×判断组合 → 匹配颜色组
  ├─ 生成完整提示词 (风格/色彩/构图/纹理/氛围/情绪/维度特质)
  ├─ 生成简短提示词 (核心视觉要素浓缩)
  ├─ 输出 image_prompts_65.json (机器可读)
  └─ 输出 image_prompts_65.md  (人类可读，按9组组织)

推荐国内 AI 模型：通义万相 (首选) → 即梦 Dreamina (备选) → 文心一格 (第三)
```

### 3.6 81型内容引擎

```
buildTypeContent(code)
  ├─ 解析4字母 → 查表4个维度模块
  ├─ 组装概览：开场白 + ei段落 + sn段落 + tf段落 + pj段落 + 收尾
  ├─ 合并 strengths = 4模块 × 2项 = 8项
  ├─ 合并 growthAreas = 4模块 × 1项 = 4项
  ├─ 职业映射：FULL_CAREER_MAP[code] (81型精准映射)
  └─ 名人数据：16型手写 + 65型推导

概览内容 (81型全部达标)：
  └─ 传统16型平均 693 字，新65型平均 663 字，全局81型平均 669 字
  └─ 全部概览已清除"在16型中"类表述，与 81 型体系完全吻合
  └─ 三轮扩充 (V1/V2/V3) 将 23 型从 400 字以下扩展至 535 字以上
```

---

## 四、部署方案

### 4.1 当前开发环境

```
前端: Vite Dev Server → localhost:5173
后端: Express 5 + SQLite → localhost:3001
```

### 4.2 生产部署建议

```
Nginx (静态资源 + 反向代理)
├── Vue SPA dist/ (静态文件)
└── → Node.js API (PM2)
    └── SQLite / MySQL
```

---

## 五、安全设计

- 匿名设计，无需注册
- 答题数据 localStorage 存储
- Prisma ORM 参数化查询（防注入）
- 生产环境 HTTPS + Helmet + CSP

---

## 六、图片后处理管线

### 6.1 文字检测与去除

```
文字检测 (detect_text.py)            → 扫描全部 81 张，生成检测报告
    ↓
文字去除 V1 (remove_text.py)         → easyocr 检测 + 纯色填充（48→6 张含文字）
    ↓
文字去除 V2 (remove_text_v2.py)      → easyocr + OpenCV TELEA inpainting
    ↓                                    （0 张有意义的文字残留）
最终验证                              81/81 全部干净
```

### 6.2 暖金 vs 琥珀颜色区分

```
原始图片 (9 张琥珀组)
    ↓ backup
adjust_colors.py V1                 → HSV 色相偏移 -15°（太微妙）
    ↓
adjust_colors_v2.py                 → HSV -20° + 饱和 x1.15 + 亮度 -5%（脸部产生花纹）
    ↓ restore from backup
adjust_colors_v3.py                 → HSV -20° + 肤色保护 (is_skin_tone)
    ↓                                    → 9 张琥珀图片颜色区分明显，脸部正常
结果                                  琥珀组 H≈16° (橙红) vs 暖金组 H≈30° (金黄)
```

> 肤色保护：检测 R>G>B、低饱和 (<45%)、中高亮度 (40-95%)、色相 5-35° 的区域跳过偏移。

### 6.3 已知问题

| 问题 | 状态 | 原因 |
|------|------|------|
| EBCJ/ENFJ/INFJ 角色部位被误删 | ⚠️ 部分修复 | 角色名/类型码嵌入画面，文字去除时误填充。无原始备份。修复需重新生成。 |
| 火山引擎 API 不可用 | ❌ AccountOverdueError | 账户欠费，需充值后运行 `regenerate_text_images.py` |
| 免费 API 替代方案 | ❌ 质量不匹配 | Pollinations.AI 仅 768px (~29KB)，Pixazo 需邮箱注册 |

---

## 七、扩展规划

### V1.1
- ~~分享海报（Canvas 生成）~~ ✅ 已上线
- ~~100题重构 + 评分统一阈值~~ ✅ 已上线
- ~~图片后处理（文字去除/颜色调整）~~ ✅ 已上线
- 用户注册/登录
- 历史测试记录（基于 TestRecord）
- Playwright E2E 自动化

### V2.0
- 微信小程序
- 人格对比工具
- PDF 报告下载
- EBCJ/ENFJ/INFJ 图片重新生成
