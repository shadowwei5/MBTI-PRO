# MBTI-PRO 人格测试系统 - 架构设计文档

> 版本: v1.4 | 日期: 2026-06-14 | 状态: MVP 架构就绪，全部 81 型概览 700 字达标，65 型 AI 图像提示词就绪

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
│   └── ProgressBar.vue         # 答题进度条
├── views/
│   ├── HomeView.vue            # 首页（品牌 + 介绍 + 81型网格全览）
│   ├── TestView.vue            # 答题页（100题 + 断点续答 + 自动跳转）
│   └── ResultView.vue          # 结果页（头像 + 概览 + 光谱 + 日常画像 + 优劣势）
├── services/
│   └── api.ts                  # API 服务层（5 个端点）
├── utils/
│   └── colors.ts               # 四气质12色调色板 + 色彩分配引擎
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
用户答题 → localStorage 缓存储存 → 提交 → POST /api/records
    ↓                                        ↓
前端评分计算（离线备选）          GET /api/results/:typeCode
    ↓                                        ↓
跳转 /result/:type? scores=&chars=    ResultView 渲染
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
│   ├── results.ts              # GET /api/results, /api/results/:code
│   └── records.ts              # POST /api/records
└── content/
    └── types.ts                # 81型内容引擎
        ├── 12 维度模块 (ei/sn/tf/pj × 3位置)
        ├── 81 型全职业映射 FULL_CAREER_MAP
        ├── 81 型中文名称 TYPE_NAMES
        ├── 16 型手写精品描述 handCraftedTypes
        ├── buildTypeContent()  # 组装引擎
        └── generateAllTypeCodes()

server/ (根目录工具脚本)
├── expand_overviews.py         # V1 概览扩充 (23型 → 529-615字)
├── expand_overviews_v2.py      # V2 概览扩充 (42型 → 480-584字)
├── expand_overviews_v3.py      # V3 概览扩充 (46型重写/扩充 → 535-814字)
├── generate_image_prompts.py   # 65型 AI 图像提示词生成器
│   ├── 9 组颜色定义 (hex/视觉关键词/形状/纹理/情绪)
│   ├── 完整提示词 + 简短提示词 双输出
│   └── 输出 json + markdown 双格式
├── image_prompts_65.json       # 机器可读提示词数据
├── image_prompts_65.md         # 人类可读提示词文档 (9组组织)
└── update_overviews.py         # 概览批量写入工具
```

### 3.2 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/questions` | 获取全部 100 题 |
| GET | `/api/results` | 获取全部 81 型列表（网格用） |
| GET | `/api/results/:typeCode` | 获取指定类型详情（概览+优势+成长+职业+名人） |
| POST | `/api/records` | 保存测试记录 |

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

## 六、扩展规划

### V1.1
- 分享海报（Canvas 生成）
- 用户注册/登录
- 历史测试记录

### V2.0
- 微信小程序
- 人格对比工具
- PDF 报告下载
