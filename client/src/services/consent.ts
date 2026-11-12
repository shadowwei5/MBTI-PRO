/**
 * 隐私"显式单独同意"的存取
 *
 * PIPL 要求处理敏感个人信息（答题记录、用时等）需取得单独同意，
 * 且不能与用户协议打包成一个勾选框。这里只存这一件事的同意记录：
 * key 固定、带版本号与时间戳，用户可随时清掉浏览器数据撤回。
 */

const CONSENT_KEY = 'mbti-pro-consent-v1'

export function hasPrivacyConsent(): boolean {
  try {
    return !!localStorage.getItem(CONSENT_KEY)
  } catch {
    return false
  }
}

export function agreePrivacy(): void {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: 1, at: new Date().toISOString() }))
  } catch { /* 隐私模式等场景下忽略 */ }
}
