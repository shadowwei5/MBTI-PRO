import { api } from './api'

// 会话令牌（sessionStorage）：本浏览器会话的解锁凭证，关闭标签页/浏览器即失效。
// 要求：任何网页在新的会话里都必须重新验证（点发货链接自动兑换，或手动输入兑换码）才能测试。
const SESSION_TOKEN_KEY = 'mbti-pro-access-token'
// 设备令牌（localStorage）：记住本机曾成功兑换过。重复点击发货链接时静默复用，
// 不重复调用兑换接口、不消耗兑换码额度。
const DEVICE_TOKEN_KEY = 'mbti-pro-device-token'

// 兼容迁移：旧版把令牌直接存 localStorage 的 SESSION_TOKEN_KEY，升级后挪到设备令牌。
function migrateLegacyToken(): void {
  try {
    const legacy = localStorage.getItem(SESSION_TOKEN_KEY)
    if (legacy && !localStorage.getItem(DEVICE_TOKEN_KEY)) {
      localStorage.setItem(DEVICE_TOKEN_KEY, legacy)
    }
    localStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    // ignore
  }
}
migrateLegacyToken()

export function getAccessToken(): string {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAccessToken(token: string): void {
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token)
  } catch {
    // 隐私模式/存储被禁用时，仍允许本次会话使用返回值
  }
  try {
    localStorage.setItem(DEVICE_TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export function getDeviceToken(): string {
  try {
    return localStorage.getItem(DEVICE_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function clearAccessToken(): void {
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY)
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY)
  } catch {
    // ignore
  }
}

export async function redeemAccessCode(code: string): Promise<string> {
  const data = await api.redeemAccess(code.trim())
  if (!data.accessToken) throw new Error('兑换失败，请稍后重试。')
  setAccessToken(data.accessToken)
  return data.accessToken
}

// 本机曾兑换过：校验设备令牌仍有效后恢复会话解锁（不调用兑换接口、不消耗兑换码额度）。
export async function resumeDeviceUnlock(): Promise<boolean> {
  migrateLegacyToken()
  const token = getDeviceToken()
  if (!token) return false
  try {
    const data = await api.checkAccess(token)
    if (data.valid) {
      setAccessToken(token)
      return true
    }
    clearAccessToken()
    return false
  } catch {
    return false
  }
}
