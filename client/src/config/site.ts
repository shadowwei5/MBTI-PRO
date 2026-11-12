/**
 * 站点级配置常量
 *
 * ⚠️ 上线前检查：SITE_CONTACT_EMAIL 必须替换为真实邮箱，
 * 否则法务页（联系我们 / 隐私政策）没有可用的非订单联系渠道。
 * 只需改这一处，LegalView 会自动引用。
 */
export const SITE_CONTACT_EMAIL = '19183986542@163.com'

/** 法务页"客服渠道"文案：有邮箱用邮箱，没有就先给过渡口径 */
export const CONTACT_CHANNEL_LINE = SITE_CONTACT_EMAIL
  ? `非订单问题（页面异常、内容纠错、侵权投诉）：${SITE_CONTACT_EMAIL}，通常 48 小时内回复。`
  : '非订单问题（页面异常、内容纠错、侵权投诉）：请通过小红书店铺客服留言，我们会尽快回复；独立投诉邮箱将在正式上线时公布于此。'
