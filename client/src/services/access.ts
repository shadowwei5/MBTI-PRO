import { api } from './api'

const ACCESS_TOKEN_KEY = 'mbti-pro-access-token'

export function getAccessToken(): string {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAccessToken(token: string): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  } catch {
    // 隐私模式/存储被禁用时，仍允许本次会话使用返回值
  }
}

export function clearAccessToken(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
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
