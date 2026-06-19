# MBTI-PRO 生产部署方案对比

> 版本: v1.0 | 日期: 2026-06-19

---

## 一、五种方案横评

| # | 方案 | 月费 | 备案 |
|---|------|------|------|
| A | Vercel + Render（海外免费） | ¥0 | 不需要 |
| B | 腾讯云轻量香港（单机全包） | ¥67 | 不需要 |
| C | 腾讯云轻量国内（单机全包） | ¥68 | 需要（15-20天） |
| D | Vercel(优选CNAME) + Render | ¥0 | 不需要 |
| E | Vercel + 腾讯云轻量香港(仅后端) | ¥67 | 不需要 |

---

## 二、多维度对比

### 国内用户访问速度

| 方案 | 首次加载 | 图片加载 | 晚高峰 |
|------|---------|---------|--------|
| A Vercel + Render | 3-8秒 | 5-15秒 | 极不稳定 |
| B 腾讯云香港 | 0.5-1.5秒 | 0.3-1秒 | 稳定 |
| C 腾讯云国内 | 0.2-0.8秒 | 0.1-0.5秒 | 最稳定 |
| D Vercel优选CNAME | 1-3秒 | 3-8秒 | 依赖社区 |
| E Vercel + 香港后端 | 前端3-8秒 | 0.3-1秒 | 前端慢 |

### 国外用户访问速度

| 方案 | 速度 |
|------|------|
| A/C/D | Vercel 全球CDN，极快 |
| B | 香港国际带宽好，较快 |
| C | 国内带宽出海窄，慢 |

### 成本

| 方案 | 首年 | 后续每年 |
|------|------|---------|
| A/D | ¥0 | ¥0 |
| B/E | ¥804 | ¥804 |
| C | ¥816 | ¥816 |

### 安全性

| 方案 | 风险 |
|------|------|
| A/D | 数据存美国/新加坡，MBTI结果属敏感个人信息，可能违反《个保法》数据出境条款 |
| B/E | 香港属"境外"但风险低于美国 |
| C | 国内服务器，完全合规 |

### 代码更新便利性

| 方案 | 方式 | 时间 |
|------|------|------|
| A/D | Git push → 自动部署 | 2-3分钟 |
| B/C | SSH + git pull + pm2 restart | 1-5分钟 |
| E | 前端自动，后端手动 | 1-5分钟 |

### 稳定性

| 方案 | 风险 |
|------|------|
| A | Render 免费版 15分钟无访问休眠；Vercel 国内可能被墙 |
| B/C | 腾讯云 S1级别，99.95%可用性 |
| D | 优选CNAME依赖社区维护，可能失效 |

---

## 三、推荐路径

| 阶段 | 方案 | 原因 |
|------|------|------|
| **现在** | A（Vercel + Render） | 10分钟免费上线，先验证产品 |
| **用户反馈"太慢"** | B（腾讯云香港） | 折中最优，不需要备案 |
| **用户量大+需合规** | C（腾讯云国内） | 备案后可绑定微信小程序 |

---

## 四、方案 A 部署步骤（当前实施）

### 前置条件
- GitHub 仓库：`shadowwei5/MBTI-PRO`
- Vercel 账号（用 GitHub 登录）
- Render 账号（用 GitHub 登录）

### 部署 Render 后端

1. Render Dashboard → New Web Service → 连接 GitHub
2. 配置：
   - Build: `cd server && npm install --include=dev && npx prisma generate`
   - Start: `cd server && bash start.sh`
   - Region: Singapore
3. 添加 1GB 持久化磁盘：mountPath=`/opt/render/project/persist`
4. 环境变量：`CLIENT_ORIGIN=https://mbti-pro.vercel.app`
5. 部署后获得后端 URL：`https://mbti-pro-api.onrender.com`

### 部署 Vercel 前端

1. Vercel → Import Project → 选择 GitHub 仓库
2. 配置：Framework=Vite, Root=client, Output=dist
3. 环境变量：`VITE_API_BASE=https://mbti-pro-api.onrender.com/api`
4. 部署后获得前端 URL：`https://mbti-pro.vercel.app`

### Vercel 国内加速（可选）

将域名 CNAME 指向优选节点：
- `vercel-cname.xingpingcn.top`
- `vercel.cdn.yt-blog.top`

---

## 五、方案 B 部署步骤（腾讯云香港）

1. 购买腾讯云轻量香港（2C2G 50GB，¥67/月）
2. SSH 登录，安装 Node.js 20+
3. `git clone` 仓库
4. `cd server && npm install --include=dev && npx prisma generate && npx prisma db push && npx tsx src/seed.ts`
5. `npm install -g pm2 && pm2 start src/index.ts --name mbti-pro`
6. 配置 Nginx 反向代理 + HTTPS（Let's Encrypt）
7. 前端构建：`cd client && npm install && npm run build`
8. Nginx 指向 `client/dist/` 静态文件 + SPA fallback

---

## 六、费用汇总

| 项目 | 方案A | 方案B/C |
|------|-------|---------|
| 服务器 | ¥0 | ¥804/年 |
| 域名（可选） | ¥60/年 | ¥60/年 |
| SSL证书 | ¥0 | ¥0 |
| **总计** | **¥0-60/年** | **¥864/年** |
