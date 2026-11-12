# MBTI-PRO 上线交接文档（移交 DSH）

> 交接时间：2026-11-12 18:58 ｜ 移交方：WorkBuddy Agent（本轮会话）｜ 接收方：DSH
> 一句话现状：**产品已验收、代码已全部本地提交（领先 origin/master 9 个提交，未 push）、上线方案已定稿，卡在"服务器操作 + DNS 切换 + GitHub Secrets"三件需要控制台/授权的事上，线上 `https://mbti-pro.com` 目前仍是 Cloudflare 525（不可访问）。**

---

## 1. 产品与最终目标（先读这个对齐口径）

- 站点：mbti-pro.com，81 型人格测试。**首发 40 题（约 6-8 分钟），商业模式 = 小红书店铺 0.99 元购买 → 兑换码 → 一次解锁 40 题测试和全部报告**。不再有邮箱/分享/打赏/二次付费。
- **最终场景（用户原话级目标）**：用户在小红书内置浏览器点开自动发货消息里的 `https://mbti-pro.com/?code=XXXX`，**3 秒内稳定打开**并自动兑换进入答题页。
- 用户已明确：**本轮 UI 全部验收通过**，不要再动 UI；当前唯一主线是"上线"。

## 2. 关键事实表（已核实，别重复调查）

| 项 | 状态 |
|---|---|
| 服务器 | **腾讯云轻量香港**（依据：`~/.ssh/mbti-pro-hk` 专用密钥命名 + `docs/DEPLOYMENT.md` 方案 B + STATUS.md 交叉印证）。香港**无需 ICP 备案**，用户也确认从未备案 |
| 公网 IP | **未知** —— 本机 known_hosts 无任何服务器连接记录，从未 SSH 直连过。需要用户在控制台查看，或开启浏览器控制后从轻量控制台读取 |
| 域名 | `mbti-pro.com`，注册 2026-06-28，**到期 2027-06-28，正常可用**（RDAP 已核实）。DNS 托管在 Cloudflare（tori/matias.ns.cloudflare.com） |
| 线上状态 | HTTP **525**（CF 连不上源站 HTTPS）。根因判断：源站证书缺失/过期/自签 + CF Full strict 严格校验。与备案无关 |
| 本地服务 | `H:/ccwork/MBTI-PRO`，后端跑在 3001 端口（`npx tsx src/index.ts`），前后端均最新且全部本地验证通过（server tsc 无报错、56 用例全绿、client vue-tsc + vite build 通过） |
| gh CLI | 本机**没有安装** → GitHub Secrets 只能用户在网页手动配置 |

## 3. 已完成的工作（提交号可查，全部在本地 master）

```
494f011e chore(site): 法务页联系邮箱定稿（163 业务专用号）
087e8ea8 docs(launch): 确认香港服务器无需备案 + 服务器体检/修复脚本 + 业务邮箱定稿
7c6139ff feat(client): 隐私显式单独同意闸门 + 上线方案定稿入档
0bb6a113 docs: 上线前检查清单、UI 重设计八轮记录与兑换履约方案
a07eb2af feat(video-pipeline): 日更与发布链路脚本、配音与 BGM 素材
5a3606b9 feat(client): 纸张档案风 UI 全量改版 + 兑换码解锁 + 法务页
6a7aeaab feat(server): 40 题精简题库、兑换码解锁与 81 型内容体系
04ae2bdb ci: 启用 push-to-master 自动部署工作流
de5f7b1c chore(repo): 忽略本地审核产物、视频管线输出与 agent 工作区
```

本轮 UI/内容要点（都已验收，列出来防止 DSH 误回退）：

- **UI 第八轮**：首页删除底部深色 CTA（3036→2581px）；答题页「上一题」修复为真正回退一格 + 回看模式（回看中作答 320ms 自动单步前进）；正方/反方选中特效统一为同底色+左侧 3px 竖条。
- **81 型四维深读全部重构**：`server/src/content/life-advice.ts`（81 型 × 关键抉择/经验教训/4 条建议），生成器用 `FEATURED_PROFILES.story` 切分；`celebrity-fields.ts` 235 条身份字典，**316 个姓名全覆盖，不再输出「相关人物」**。results.ts / buildTypeContent / export-demo-data / reportPdf 已全部切换；`dimension-modules.ts` 已退役。
- **隐私显式单独同意**：`client/src/components/ConsentGate.vue` + `services/consent.ts`（`mbti-pro-consent-v1`）。未同意不能作答（鼠标+键盘都拦截），同意记录带版本与时间戳。
- **分享海报 800×1067（小红书 3:4）**、字体全本地化（零 googleapis 请求）、`client/public/review.html` 审核后门页**已删除**。
- 联系邮箱已定稿：`client/src/config/site.ts` 的 `SITE_CONTACT_EMAIL = '19183986542@163.com'`。

## 4. 上线方案定稿（已写入上线清单第 11 节，照做即可）

**方案：不换架构、0 元 —— 去掉 Cloudflare 代理（灰云直连或迁 DNSPod）+ 源站 Let's Encrypt 免费证书。**
理由：CF 免费版国内无节点，橙云代理对大陆用户绕境外边缘（TTFB 300ms+、偶发丢包），是"不稳定"和 525 的共同根源。香港服务器直连大陆延迟 0.5-1.5s，完全满足 3 秒验收线。

### 接手后立即要做的 6 步（按序）

1. **浏览器控制**：让用户在 WorkBuddy「设置 → Agent → 浏览器控制」开启内置浏览器（本会话已确认：插件市场无浏览器插件、无已装连接器，内置开关是唯一路径）。开完后打开 `https://console.cloud.tencent.com/` 让用户微信扫码。
2. **控制台三查**（扫码后 AI 代操作）：①轻量应用服务器 → 确认地域香港、运行中、**抄下公网 IP**；②域名注册 → 确认 mbti-pro.com 归属与到期；③云解析 DNS。
3. **DNS 切换（二选一）**：
   - 快路径：CF 面板把 A 记录 Proxy status 改 **DNS only（灰云）**——前提是用户记得 CF 账号密码；
   - 整合路径（**推荐**，把解析迁到 DNSPod）：域名注册商在腾讯的话直接把 NS 从 cloudflare 改为 `f1g1ns1.dnspod.net / f1g1ns2.dnspod.net`，DNSPod 里建 `A @ → 服务器IP`、`CNAME www → mbti-pro.com`。以后所有解析操作都在用户扫码就能进的腾讯控制台，**不再依赖 CF 账号**。
4. **服务器证书**（二选一执行）：用户开网页终端（OrcaTerm）粘贴清单 11.1 体检命令把输出贴回，按 11.2 脚本 A 签发；**或**用户提供 IP 并授权 `ssh -i ~/.ssh/mbti-pro-hk root@<IP>`，DSH 全程 SSH 操作。certbot 签发前提：域名 DNS 已指向源站（第 3 步生效后）。
5. **GitHub Secrets**（用户网页配置，5 项）：`SSH_HOST` / `SSH_USER`（root 或 lighthouse）/ `SSH_KEY`（本地 `~/.ssh/mbti-pro-hk` 私钥全文）/ `SSH_PORT`（22）/ `ADMIN_KEY`（值在本地 `server/.env`，`grep ADMIN_KEY server/.env`）。配完 → `git push origin master` → Actions 自动部署（~50s）。
6. **三端验证**：电脑 Chrome、手机浏览器、**小红书 App 内置浏览器**（小号给大号发一条带 `?code=` 的自动发货消息实测）。验收线：3 秒可交互、自动兑换跳 `/test`、无 googleapis 请求、40 题答完出报告、四维深读是人物生平建议、四位代表人物带身份。

### 之后（不阻塞上线，但阻塞收款闭环）

- G2：小红书店铺建 0.99 元商品页（类目已确认准入）→ 自动发货模板挂 `https://mbti-pro.com/?code=XXXX` → **3 笔真实订单实测** → 退款/补发各一次。履约模板见 `docs/access-code-fulfillment.md`。
- 生成真实兑换码：`cd server && npm run access:codes -- --count 100 --batch xhs-正式`。
- 业务邮箱升级：现在是 163 号（`19183986542@163.com`，**含用户手机号，已向用户提示过隐私风险，用户接受**）；后续可迁 Zoho Mail 免费版 + `contact@mbti-pro.com`（方案见上线清单 11.3）。

## 5. 凭据与关键路径

| 资产 | 位置 |
|---|---|
| SSH 私钥（服务器） | `C:/Users/Administrator/.ssh/mbti-pro-hk`（公钥同名 .pub；**ssh config 里没有对应 Host 条目，known_hosts 无记录**） |
| ADMIN_KEY | 本地 `server/.env`（另有 VOLCENGINE / XORPAY / SMTP 配置，均已 gitignore） |
| 部署工作流 | `.github/workflows/deploy.yml`（已启用；脚本会 `git reset --hard origin/master`、写 ADMIN_KEY 进服务器 .env、prisma db push、build、重启 3001） |
| 联系邮箱常量 | `client/src/config/site.ts` |
| 上线清单（含 11.1 体检命令 / 11.2 修复脚本 / 11.3 邮箱方案） | `docs/MBTI-PRO-上线前检查清单-2026-11-12.md` |
| UI 八轮设计记录 | `docs/MBTI-PRO-UI重设计方案-2026-11-12.md`（4.1-4.10） |
| 兑换履约模板 | `docs/access-code-fulfillment.md` |
| 项目记忆 | `.workbuddy/memory/2026-11-11.md`、`2026-11-12.md`（每日工作日志，含全部踩坑记录） |
| 本地审核入口 | 原 `client/public/review.html` 已删；如需本地复测：`curl -X POST /api/access/redeem -d '{"code":"..."}'` 拿 token 后访问 `/result/TYPE?token=...` |

## 6. ⚠️ 工作区有一批"来历不明"的未提交改动（交接时点实测）

`git status` 有 **66 个修改 + 2 个未追踪**，全部集中在 `docs/xhs-daily/**`（day1-7 文案改版、preview PNG 重渲染）和两个新文件 `docs/xhs-daily/week1/review.html`、`scripts/xhs-daily/build-review.mjs`。**这不是上线主线的改动**（内容是"日更图文改为人物故事卡版式"），疑似用户另一个并行会话所为。

**DSH 处理建议**：不要盲目还原（可能毁掉用户的并行工作）。先问用户一句"日更图文改版是你让另一个会话做的吗"，是则单独提交为一个 commit（不要混进上线 commit），否则 `git checkout -- docs/xhs-daily` 还原。

## 7. 踩坑记录（都是本会话真实踩过的）

1. **本机 Bash 的 heredoc/引号**：长文本写入用 Write 工具落盘脚本再执行，不要用 `python - <<'PY'`（多次遇到 quote 解析错误）。且 **shell 报错 ≠ 没改成功**——判断改动是否生效必须 grep 目标文件核对（本次 3:4 海报就出现过"报 unexpected EOF 但文件其实已写入"）。
2. **81 型文案去重**：批量写人物内容用「字符二元组重叠率扫描」（生平切片 vs 抉择/教训字段，ratio>0.4 即改写），本次共改写 71 处。
3. **Playwright 读动画终态**：要 `addStyleTag` 关掉 transition 后在自动前进（320ms）触发前读 computed style，否则读到淡出中间态得出假结论。
4. **npm 全局包曾被清空过**（见用户级 MEMORY.md），装包用 system node；bun 装不上需绕过。
5. **删除文件进回收站不释放空间**；本机删除走 safe-delete 钩子，批量删除后要清 `C:\$Recycle.Bin`。
6. **deploy 脚本与 AGENTS.md 口径不一致**：deploy.yml 用 `setsid nohup npx tsx src/index.ts`（无 pm2），AGENTS.md 写的是 pm2 restart——首次部署后核对服务器实际进程管理方式，二选一固化。
7. `docs/MBTI-PRO-上线前检查清单` 第 9 节免责声明仍有效：验证都在本地做过，线上要重验。

## 8. 用户协作偏好（照做，效率翻倍）

- 决策闭环：先全面披露 → AI 追问补变量 → AI 给唯一解 → 用户编号列表逐条反馈。用户在多轮修正后依然信任 AI，继续推进即可。
- **能直接干的不要问**；只在真正需要人介入时（扫码、付款、网页面板）给出精确步骤。
- 结构化中文输出（表格、代码块、编号清单）；重要结果要在最终回复里完整复述（用户看的是你的最终回复，不是工具输出）。
- 用户本轮只负责：扫码登录、扫码付款、在 WorkBuddy 设置里开开关。其余全部 AI 操作。

## 9. 首要行动（DSH 打开对话第一件事）

1. 读本文 + `docs/MBTI-PRO-上线前检查清单-2026-11-12.md` 第 11 节；
2. 问用户：浏览器控制开关开了没有 / 日更改版是不是并行会话做的；
3. 按第 4 节 6 步推进。任何一步卡住，先查 `.workbuddy/memory/2026-11-12.md` 当日日志——所有失败尝试与结论都在里面。
