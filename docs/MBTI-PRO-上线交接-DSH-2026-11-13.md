# 上线交接 · 内容改版（DSH 执行 push 与验收）

> **交接方**：WorkBuddy｜**接收方**：DSH｜**时间**：2026-11-13 01:30
> **一句话**：内容改版已全部改完、本地已提交两条、四处自检全绿。**你 push 即可上线**；push 后跑一条验收命令（16 项断言），再人眼看 3 处，就算交付。

---

## 0. 三分钟版

| | 状态 |
|---|---|
| 仓库 / 分支 | `H:\ccwork\MBTI-PRO` · `master`（remote：`git@github.com:shadowwei5/MBTI-PRO.git`） |
| 待推送 | **2 条 commit**（`8acee84f` 全量内容改版 + `597eaf43` ABFP 换人 + 验收脚本），另有本文档 1 条 |
| 工作区 | 干净（`git status` 无输出） |
| 自检 | audit 退出码 0 · tsc 通过 · npm test 60 passed · client build 通过 |
| 风险等级 | **低**：只动内容文案、一处 PDF 渲染、一处结果页标题；**不动**题库 / 计分 / 兑换码 / 支付 / 数据库结构 |
| 你实际要做 | ① `git push origin master` ② 等 Actions（~60s）③ 跑验收脚本 ④ 人眼看 3 处 |

---

## 1. 这两条 commit 改了什么

### `8acee84f` 按 DSH 审核意见改到位（B1–B6 + Y1–Y8 + Z2/Z3/Z4）

| 层 | 变化 |
|---|---|
| 内容 | 结果页「04 / DEPTH」从**四维深度解析**改为**代表人物解读**，四条标签变成「起点与志向 / 看世界的角度 / 关键抉择 / 代价与教训」；324 条正文全部重写（删掉 81 型共用的 101 字模板） |
| 名单 | 顾城移出；INTJ 补罗辑、ESTP 补樱木花道、ENFJ 补欧尔麦特；IBCP 有马公生换芙莉莲 |
| 事实 | 扁鹊改双出处、马丁·路德·金时间线修正 |
| 合规 | PDF 代表人物改「姓名 · 身份」两列 + 虚构类比声明 + 真人声明；网页与 PDF 各补一道 DEPTH 免责；页脚补免责 |
| 工程 | 新增 `server/src/content/depth-lenses.ts`（81×4 条唯一句）、`scripts/audit-depth-content.mjs`（12 项校验） |

### `597eaf43` ABFP 主人物 梭罗 → 丰子恺

- `CELEBRITY_MAP.ABFP` = 丰子恺 / 夏目贵志 / 徐志摩 / 梭罗（梭罗退回第 4 位，**没删人**）
- 侧写、六条素材、四条解读句全部改为丰子恺（师从李叔同 / 子恺漫画 / 缘缘堂被毁 / 《护生画集》守约 44 年）
- 新增 `scripts/verify-online-content.mjs`：上线验收脚本

---

## 2. 你要执行的三步

### ① 确认并 push

```bash
cd /h/ccwork/MBTI-PRO
git status --short                      # 应为空
git log --oneline -3                    # 应看到「上线交接」文档 / 597eaf43 / 8acee84f
git push origin master
```

### ② 等自动部署

推送后 GitHub Actions 会 SSH 到服务器执行：`git reset --hard origin/master` → `npm install`（依赖未变则跳过）→ `prisma generate` + `db push` → `fix-names` → 前端 build → `systemctl restart mbti-pro` → 健康检查。约 60 秒。

看进度：仓库 Actions 页面（`Deploy to Tencent Cloud`）。**本机没装 `gh`**，只能用网页。

### ③ 跑验收脚本（一条命令）

```bash
cd /h/ccwork/MBTI-PRO
node scripts/verify-online-content.mjs --code=<测试兑换码>
```

- **会真实兑换 1 次**（每码默认 3 次额度），请用一张**不卖给用户**的测试码；没有就先跑 `cd server && npm run access:codes -- --count 1 --batch deploy-check`。
- 16 项断言覆盖：健康检查 / 兑换链路 / `paid=true` / 主人物是丰子恺 / 梭罗仍在名单 / 4 位全带身份 / 四条都返回 / 无【】/ 都以「给你的建议：」收尾 / 无全角空格 / 无维度代码外泄 / 字数 ≥420 / 与 ABCD 无 15 字重复。
- 输出长这样（本地实测，已通过）：

```
  PASS  站点健康检查 /api/health　（HTTP 200）
  PASS  兑换码换取 accessToken
  PASS  付费字段已解锁（paid=true）
  PASS  ABFP 主人物已换为丰子恺（第 1 位）
  PASS  4 位代表人物全部带身份（无「公众人物」兜底）
  PASS  ABFP 四条合计 ≥420 字　（实际 520 字）
  PASS  ABFP 与 ABCD 无 ≥15 字相同片段
  ...
✓ 全部 16 项通过
```

退出码 `0` = 全过；`1` = 有断言失败（输出会指出是哪一项、实际值是多少）；`2` = 参数或网络问题。

---

## 3. 可做可不做：同步数据库名单

```bash
ssh <服务器> 'cd /opt/MBTI-PRO/server && npx tsx scripts/sync-db-celebrities.mjs --dry'
# 先看会改哪几型，确认后去掉 --dry 再跑一次
```

**为什么是可选的**：`results.ts` 里代表人物以 `CELEBRITY_MAP` 为准，库里的 `celebrities` 列只在 MAP 缺项时兜底（见 `server/src/routes/results.ts:225-228`）。所以不同步也不影响结果页，只是库与代码会漂移，下次排查时容易误判。脚本幂等、只改这一列、不碰其它表。

---

## 4. 出问题怎么回滚

推荐 revert（保留历史，Actions 会重新部署）：

```bash
cd /h/ccwork/MBTI-PRO
git revert --no-edit 597eaf43 8acee84f
git push origin master
```

只说「别慌」的几点：

- **没有数据库迁移**，回滚不涉及数据；
- 服务器上会被 `git reset --hard` 覆盖，**所以不要直接在服务器改文案**，改了下次部署就丢；
- 若只是某一型的文案不对，不用回滚整批：改 `server/src/content/depth-lenses.ts` 对应那一句 → 跑 `npx tsx ../scripts/audit-depth-content.mjs` → 提交推送即可。

---

## 5. 脚本测不到、需要人眼的 3 处

| # | 看什么 | 怎么看 | 合格标准 |
|---|---|---|---|
| ① | 小红书 App 内置浏览器（WebView） | 手机小红书里打开商品链接 → 站点 → 用兑换码解锁一型 | 04 区块标题为「代表人物解读」，四条标签正确，文字不被截断、不换行错位 |
| ② | PDF 邮件报告 | 用测试邮箱走一次「发到邮箱」 | 代表人物是「姓名 · 身份」两列；虚构声明 + 真人声明在；页脚有「不构成临床诊断或招聘决策依据」；标题里没有「（E/A/I 维度）」 |
| ③ | 首页与分享海报 | 手机打开首页，分享一次 | 首屏无 404 图、海报文案没变 |

---

## 6. 上线后用户会看到的变化（对照验收用）

| 位置 | 改版前 | 改版后 |
|---|---|---|
| 04 区块标题 | 四维深度解析 | **代表人物解读** |
| 四条标签 | 能量来源 / 认知方式 / 决策方式 / 生活态度 | **起点与志向 / 看世界的角度 / 关键抉择 / 代价与教训** |
| 正文开头 | 「【生平】曾国藩（晚清名臣）书生带兵…」 | 「书生带兵，组建湘军平定太平天国。奇谋他也会…」 |
| 正文句式 | 81 型共用同一句过渡（101 字） | 每型 4 句各不相同 |
| ABFP 主人物 | 梭罗 | **丰子恺**（梭罗仍在名单第 4 位） |
| 商品页 / 小红书文案 | 四维深度解析 | 人物解读 · 代表人物生平与关键抉择给四条建议 |
| PDF 代表人物 | 一排姓名标签，无身份 | 姓名 · 身份两列 + 两道合规声明 |

---

## 7. 这轮不要顺手做的事

- **不要** 在服务器跑 `npm run db:seed`（会清库重建，线上数据丢失）；
- **不要** 改 `TYPE_NAMES` / 数据库 `PersonalityType.name`（`fix-names.ts` 会覆盖）；
- **不要** 重跑 `generate_images` 或任何付费图片生成（prompt 需用户先审，见 `AGENTS.md`）；
- **不要** 提交 `server/access-codes/`（已 gitignore）；
- **不要** 手改 `docs/*.html` 与 `docs/MBTI-PRO-内容审核交接-*.md`（都是生成物，改数据后重跑脚本）。

---

## 8. 你回传什么

1. `git push` 与 Actions 结果（成功/失败 + 耗时）；
2. `node scripts/verify-online-content.mjs --code=...` 的**完整输出**；
3. §5 三处人眼的结论（通过 / 需改 + 截图或文字描述）。

若验收有失败项，直接把输出贴回来，我按断言名定位（每条断言对应一处代码位置，见 `scripts/verify-online-content.mjs`）。

---

## 9. 附：本轮所有校验结果（本地，push 前跑的）

```
类型数            81
代表人物位次      317
不重复人物        317
身份兜底          0
虚构角色          45 位（覆盖 44 型）
每型字数          min 420 / avg 455 / max 553
跨型重复片段      0
✅ 全部校验通过（脚本 12 项，退出码 0）

tsc           通过
npm test      12 文件 / 60 测试 全通过
demo:export   types.json 81 型 · 438.7 KB · images 81 张
client build  通过（2.2s）
```
