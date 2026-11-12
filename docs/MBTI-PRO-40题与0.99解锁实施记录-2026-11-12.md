# 40 题与 0.99 全解锁：实施记录

> 日期：2026-11-12  
> 状态：代码与本地验证完成，**尚未部署正式站**。

## 1. 本次已改

### 题目与评分
- 新增 `server/src/content/short-form.ts`：40 题固定清单，四维各 10 题，按 E/S/T/P 交叉排列。
- `/api/questions` 只返回这 40 题；`/api/questions/count` 返回 40。
- `server/src/services/scoring.ts` 与 `client/src/services/scoring.ts` 改为按维度题数动态计算边界：每维 10 题、最大 ±20、边界 ±7。
- 修正 `S_N` 计分方向：题库左侧是 S（实感），正分应为 S，而不是 N。
- T_F 首发版不再使用 10 道逻辑推理题；40 题全部为 5 点 Likert。
- 更新评分单测：覆盖 40 题全端值、全中立、±7 边界、S_N 方向、旧 100 题兼容。

### 解锁流程
- 新增 `AccessCode` / `AccessGrant` 表（`server/prisma/schema.prisma`）。
- 新增 `server/src/routes/access.ts`：
  - `POST /api/access/redeem`：兑换小红书商品码；
  - `GET /api/access/check?token=...`：校验访问令牌。
- `/api/results/:typeCode` 支持访问令牌直接返回完整报告。
- 新增 `server/scripts/generate-access-codes.ts` 和 `npm run access:codes`，批量生成 CSV 到 `server/access-codes/`（已 gitignore）。
- 前端新增 `client/src/components/AccessGate.vue`、`client/src/services/access.ts`。
- 首页支持：
  - 无 token → 点击开始测试弹出兑换码；
  - `https://mbti-pro.com/?code=XXXX` → 自动兑换并进入测试。
- 结果页：
  - 有 token → 直接展示完整内容；
  - 无 token → 只显示基础结果 + 兑换卡；
  - 已移除邮箱、分享解锁、打赏、二次付费。
- 分享海报改为指向落地页，不再依赖邮箱/推荐关系。
- 首页移除“精准 5 倍”表述，改为“81 种人格坐标”。

### 安全顺手修复
- 移除后台硬编码 fallback key `mbti-pro-admin-2026`。
- `/api/admin/stats`、`/api/admin/traffic` 增加 `ADMIN_KEY` 鉴权。
- `ADMIN_KEY` 缺失时后台接口一律 403。
- 公开首页移除 `/admin` 链接。
- `.env.example` 增加 `ADMIN_KEY` 占位。

## 2. 本地验证结果

| 检查 | 结果 |
|---|---|
| `cd server && npm run build` | 通过 |
| `cd server && npm test -- --run` | 52 个测试通过（含 src/dist 重复） |
| `cd client && npm run build` | 通过 |
| 40 题接口 | 40 题，四维各 10，全部 likert |
| 全 A 答案 | ESTJ |
| 全 E 答案 | INFP |
| 全 C 答案 | ABCD |
| 兑换码 | 5 个测试码生成成功；无效码返回 404 |
| 访问令牌解锁 | `paid=true`，完整 overview/维度模块返回 |
| 未兑换结果页 | 只显示兑换卡，不显示完整报告 |
| 本地 40 题演示站 | 冒烟检查全部通过，0 个 404 / 0 个 console error |

## 3. 未完成/上线前必须做

- 正式站 `https://mbti-pro.com/` 仍不可用（Cloudflare 525），需要先恢复服务器、SSL 和部署。
- GitHub Pages 子路径资源仍 404（构建 `base` 未修）。
- 需要确认小红书店铺电子资源类目、自动发货/兑换码交付方式是否符合最新规则。
- 需要补隐私政策、用户协议、退款说明、联系方式。
- 需要配置生产 `ADMIN_KEY`，并确保 `.env` 不进仓库。
- 需要 8 人真人测试，确认 40 题完成时长与结果认同度。
- 需要真实订单测试：下单 → 发码 → 兑换 → 40 题 → 完整报告 → 退款/补发。

## 4. 备份与回滚

```text
Git tag: pre-40q-2026-11-12
Archive: H:/ccwork/MBTI-PRO-backups/MBTI-PRO-pre-40q-2026-11-12.tar.gz
Patch:   H:/ccwork/MBTI-PRO-backups/working-tree-before-40q-2026-11-12.patch
```

回滚代码前先备份当前数据库；`AccessCode` / `AccessGrant` 是新增表，不会覆盖旧数据。
