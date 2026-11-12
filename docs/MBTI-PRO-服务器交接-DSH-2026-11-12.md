# 服务器操作交接（移交 DSH）—— 兑换码池 + 上架收尾

> 交接时间：2026-11-12 23:50 ｜ 背景：网站已上线（https://mbti-pro.com 健康检查 200），商品文案与 5 张上架图已备好（`docs/MBTI-PRO-小红书商品上架-2026-11-12.md`），**剩余的服务器侧操作就是"生成兑换码码池"这一件**，外加店铺后台配置与验证。
> 服务器：腾讯云轻量香港 `43.132.217.70`（root，密钥登录），项目根 `/opt/MBTI-PRO`，后端 systemd 服务名 `mbti-pro`，数据库 SQLite `/opt/MBTI-PRO/server/prisma/dev.db`。

---

## 1. 生成全店统一兑换码（必做，商品上架的"货"）

**实测：小红书个人店「自动发货」的发货说明是固定文本（≤500 字），不支持按订单填变量 → 采用统一码模式**（对标商家同做法），服务端已配护栏：单码 3000 次额度、单码单日成功兑换 ≤500 次防刷（`DAILY_REDEEM_CAP`）、180 天有效期。

一条命令生成（写进线上 SQLite）：

```bash
ssh root@43.132.217.70 "cd /opt/MBTI-PRO/server && npx tsx scripts/generate-access-codes.ts --count 1 --max-redemptions 3000 --days 180 --batch xhs-unified"
```

- 输出示例里会打印实际码（5 位数字）；`cat /opt/MBTI-PRO/server/access-codes/xhs-unified-*.csv` 可再查看。
- **把实际码替换**进发货说明模板（`docs/access-code-fulfillment.md` §2.3，模板里示例码是 82417），整段 ≤500 字直接粘贴到商品「自动发货 → 发货说明」。
- 监控兑换量：`select redemptions from AccessCode where code='实际码';` 接近 3000 就换新码（生成新的 → 编辑商品发货说明 → disable 旧码）。

## 2. 小红书店铺自动发货配置（网页操作，非服务器）

1. 店铺后台 → 商品 → 自动发货设置，把上面导出的码逐个/批量粘贴进码池；
2. 发货消息模板直接抄 `docs/access-code-fulfillment.md` §2.3（`{{code}}` 变量由平台按订单填入），模板里含测评链接 `https://mbti-pro.com/?code={{code}}`——**链接只放发货字段（平台允许），不要放商品图/详情/笔记**；
3. 商品标题/卖点/详情/上架图直接用 `docs/MBTI-PRO-小红书商品上架-2026-11-12.md`，图在 `docs/xhs-shop/商品图-1~5.png`。

## 3. 上架后验证（10 分钟，按序）

1. 自己真实下单 1 笔 → 确认自动发货消息到达、`?code=` 链接**一键进入测试**、答完 40 题报告完整解锁；
2. 再下 1 单 → 订单页「申请售后」走一遍退款，确认原路退回到账；
3. 换一台手机在小红书 App 内置浏览器打开链接：3 秒内可交互、字体正常（已全本地化，无 googleapis 请求）；
4. 复核商品描述与图上的码示例是「5 位数字，如 82417」（已同步）。

## 4. 顺手建议（可选，10 分钟）

- **SQLite 备份**：`ssh root@43.132.217.70 "echo '0 4 * * * sqlite3 /opt/MBTI-PRO/server/prisma/dev.db \".backup /opt/MBTI-PRO/backups/dev-\$(date +\%F).db\"' | crontab -"` 之类的每日备份（目录先 `mkdir -p`）；有真实订单后数据库就是钱。
- **日志检查**：`journalctl -u mbti-pro -n 50` 看一眼启动日志与 5xx。
- **兑换监控**：有订单后不定期跑 `ssh root@43.132.217.70 "cd /opt/MBTI-PRO/server && npx tsx -e \"import{PrismaClient}from'@prisma/client';const p=new PrismaClient();p.accessCode.count({where:{redemptions:{gt:0}}}).then(c=>{console.log('已兑换码数:',c);return p.\\\$disconnect()})\""`（或直接查库）。

## 5. 本轮已完成的关联改动（无需重复做）

- 客服邮箱已改为 `mbti_pro@163.com`（`client/src/config/site.ts`），已构建进 LegalView 并随本次 push 部署；
- 兑换码生成脚本改 5 位纯数字 + 库内查重 + 防前导零，已 push 部署（316f5b29 及后续）；
- 商品图第 1 张已按用户要求品牌大字化（MBTI-PRO 第一视觉）。

## 6. 遇到问题查哪里

- 运维交接：`docs/MBTI-PRO-上线完成与运维交接-2026-11-12.md`（DSH 自己写的）
- 项目记忆/踩坑：`.workbuddy/memory/2026-11-12.md`
- 兑换/发货口径：`docs/access-code-fulfillment.md`；退款口径：站内 `/refund` 页（LegalView.vue）
- 兑换接口限速：同 IP 10 分钟 30 次（`server/src/routes/access.ts`），5 位数字码不可被穷举
