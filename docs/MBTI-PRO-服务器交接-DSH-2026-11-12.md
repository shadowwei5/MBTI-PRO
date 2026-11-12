# 服务器操作交接（DSH 专版 · 终版 v2）

> 交接时间：2026-11-13 00:10 ｜ 状态：网站已上线（https://mbti-pro.com 健康检查 200）｜ 商品文案/上架图/发货说明已全部定稿
> **你只剩两件事：①在服务器生成全店统一兑换码；②把码填进发货说明并完成店铺上架。** 全程约 15 分钟。

---

## 0. 背景速读（30 秒）

- 商品：小红书个人店 0.99 元电子测评（40 题 → 81 型人格档案报告），`{{code}}` 变量发货**不可用**（实测发货说明为固定文本 ≤500 字）→ 采用**全店统一码**模式。
- 统一码服务端护栏已内置：`maxRedemptions=3000` 次额度、**单码单日成功兑换 ≤500 次**（`DAILY_REDEEM_CAP`，防公开分享后脚本刷爆）、180 天有效期、redeem 同 IP 10 分钟 30 次限速。
- 商品名称/详情/上架图已定稿：`docs/MBTI-PRO-小红书商品上架-2026-11-12.md` 的「零、直接复制区」（发货说明里的码是占位符，等你生成后替换）。

## 1. 任务一：生成全店统一兑换码

```bash
ssh root@43.132.217.70 "cd /opt/MBTI-PRO/server && npx tsx scripts/generate-access-codes.ts --count 1 --max-redemptions 3000 --days 180 --batch xhs-unified"
```

- 输出末尾 `示例: XXXXX` 就是**实际统一码**（5 位数字，永不 0 开头）；码已写入服务器 SQLite（`AccessCode` 表），CSV 同时落在 `/opt/MBTI-PRO/server/access-codes/xhs-unified-*.csv`。
- 查看确认：`ssh root@43.132.217.70 "cat /opt/MBTI-PRO/server/access-codes/xhs-unified-*.csv"`
- **把实际码发到对话里**：①用户粘贴进发货说明；②同步到 `docs/MBTI-PRO-小红书商品上架-2026-11-12.md` 零·③ 与 `docs/access-code-fulfillment.md` §2.3（把 82417 示例替换掉）。

> 参数说明：`--count 1` 只要一个码；`--max-redemptions 3000` 全店兑换额度；`--days 180` 有效期。如需调整：`--digits 4|5|6`、`--style alnum`（旧长码格式）。

## 2. 任务二：发货说明 + 商品上架（网页操作）

1. 打开发货说明模板：`docs/MBTI-PRO-小红书商品上架-2026-11-12.md` →「零、③ 自动发货 → 发货说明」，把 `【兑换码】`/`82417` 替换为任务一的实际码，整段（约 300 字）粘贴到商品「自动发货 → 发货说明」（那个 0/500 输入框），点确定。
2. 商品名称/详情/5 张上架图：按同文档「零、①②」与 `docs/xhs-shop/商品图-1~5.png` 填写上传（标题上限 20 字，已按此拟好）。
3. 上架前过一遍同文档「六、合规自查」（已预检 ✓，复核即可）。

## 3. 任务三：上架后验证（10 分钟，按序）

1. 用户/你真实下单 1 笔 → 自动发货消息到达 → 点 `https://mbti-pro.com/?code=实际码` → 自动兑换进入测试 → 答 40 题出报告 → 分享海报可保存；
2. 同一订单走「申请售后」退款 → 原路到账确认；
3. 换手机在小红书 App 内置浏览器打开链接：3 秒内可交互、字体正常（无 googleapis 请求）；
4. 换个浏览器输入同一码再测一次 → 应正常（统一码允许多人多设备使用）。

## 4. 监控与运维（长期，每天 1 分钟）

```bash
# 统一码已用次数 / 剩余额度（把'实际码'换掉）
ssh root@43.132.217.70 "cd /opt/MBTI-PRO/server && npx tsx -e \"import{PrismaClient}from'@prisma/client';const p=new PrismaClient();p.accessCode.findUnique({where:{code:'实际码'}}).then(c=>{console.log(c.redemptions,'/',c.maxRedemptions);return p.\\\$disconnect()})\""
```

- `redemptions` 接近 3000 → 生成新码（同命令换 `--batch xhs-unified-2`）→ 编辑商品发货说明换码 → `disabled` 旧码；
- `redemptions` 单日暴涨异常（远超销量）→ 说明码被外传：禁用旧码 + 换码，并在发货说明更新；
- **SQLite 每日备份**（建议今天就配）：`mkdir -p /opt/MBTI-PRO/backups` 后加 cron：
  `0 4 * * * sqlite3 /opt/MBTI-PRO/server/prisma/dev.db ".backup /opt/MBTI-PRO/backups/dev-$(date +\%F).db"`
- 服务日志：`journalctl -u mbti-pro -n 100`；重启：`systemctl restart mbti-pro`。

## 5. 红线（不要做）

- 整批/统一码**不要**发到笔记、评论、公开群、网盘分享页（`server/access-codes/` 已 gitignore）；
- 发货说明里的测评链接**只放这个字段**——商品图、商品详情、笔记、评论区一律不放链接/二维码；
- 不要在售后中索要用户的测评结果、身份证或站外联系方式（口径见站内 `/refund`、`/contact`）；
- 商品标题/详情不加极限词与医疗词（已预检，改动时保持）。

## 6. 出问题查哪里

| 症状 | 查 |
|---|---|
| 用户说"兑换码无效" | 查码是否存在 / `disabled` / `redemptions` 是否已达 3000（服务器上进 server 目录用 Prisma 查 `AccessCode`） |
| 用户说"今日上限" | 当日成功兑换 ≥500 次触发 `DAILY_REDEEM_CAP`（429），次日 0 点自动恢复；若正常销量触顶说明生意好，调大 `DAILY_REDEEM_CAP`（`server/src/routes/access.ts`）后 push |
| 网站打不开 | `systemctl status mbti-pro`、`journalctl -u mbti-pro -n 100`、`curl -I http://127.0.0.1:3001/api/health` |
| 部署失败 | GitHub Actions 运行日志（push master 自动部署，DEPLOY_* Secrets） |
| 其他 | `.workbuddy/memory/2026-11-12.md` 当日日志 + `docs/MBTI-PRO-上线完成与运维交接-2026-11-12.md` |
