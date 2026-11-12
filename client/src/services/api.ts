// 开发环境通过 Vite proxy 访问 /api，生产环境使用同源 /api
// 静态演示版（VITE_DEMO_MODE=1）走本地静态数据，见文件末尾的导出。
import { demoApi } from './demoApi'
import { IS_DEMO } from './demoMode'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function adminKey(): string {
  try {
    return localStorage.getItem('mbti-admin-key') || ''
  } catch {
    return ''
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed: ${res.status}`)
  }
  return json.data
}

export interface ApiQuestion {
  id: number
  text: string
  textLeft?: string | null
  textRight?: string | null
  dimension: string
  type: 'likert' | 'objective'
  options: { key: string; label: string }[]
  correctAnswer?: string
}

export interface CelebrityProfile {
  name: string
  field: string
  story: string
  quote?: string
}

export interface PersonalityType {
  code: string
  name: string
  isTraditional: boolean
  summary?: string | null
  overview: string
  strengths: string[]
  growthAreas: string[]
  careers: string[]
  suitableFields: string[]
  population?: string | null
  celebrities?: string[] | null
  celebrityStories?: CelebrityProfile[]
  eiModule?: string | null
  snModule?: string | null
  tfModule?: string | null
  pjModule?: string | null
  imageUrl?: string
  paid?: boolean
}

export interface TestRecordPayload {
  typeCode: string
  scores: Record<string, number>
  chars: Record<string, string>
  answers: Record<string, string>
  duration: number
  dimAnswered?: Record<string, number>
  dimTotals?: Record<string, number>
  confidence?: number
  questionTimings?: Record<number, number>
  deviceInfo?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

export interface ReferralReward {
  code: string
  referrerRecordId: string
  referrerTypeCode: string
  referrerEmail?: string | null
  clickedCount: number
  validCompletedCount: number
  rewardUnlocked: boolean
}

export interface SocialUnlockRequest {
  id: string
  recordId: string
  typeCode: string
  email: string
  platform: 'douyin' | 'xiaohongshu'
  socialHandle?: string | null
  commentText?: string | null
  screenshotData: string
  status: 'pending' | 'approved' | 'rejected'
  reviewerNote?: string | null
  reportSentAt?: string | null
  sendError?: string | null
  createdAt: string
}

export interface ScoreResponse {
  typeCode: string
  scores: {
    E_I: number
    S_N: number
    T_F: number
    P_J: number
    T_F_sub: number
    T_F_obj: number
  }
  chars: {
    E_I: string
    S_N: string
    T_F: string
    P_J: string
  }
  confidence: number
}

export const realApi = {
  getQuestions: () => request<ApiQuestion[]>('/questions'),

  getQuestionCount: () => request<{ count: number }>('/questions/count'),

  redeemAccess: (code: string) =>
    request<{ accessToken: string; expiresAt: string | null }>('/access/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  checkAccess: (token: string) =>
    request<{ valid: boolean }>(`/access/check?token=${encodeURIComponent(token)}`),

  getResult: (typeCode: string, unlockToken?: string, recordId?: string) => {
    const params = new URLSearchParams()
    if (unlockToken) params.set('token', unlockToken)
    if (recordId) params.set('recordId', recordId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return request<PersonalityType>(`/results/${typeCode}${query}`)
  },

  getResultSummary: (typeCode: string) =>
    request<Pick<PersonalityType, 'code' | 'name' | 'isTraditional' | 'overview'>>(`/results/${typeCode}/summary`),

  getAllTypes: () =>
    request<Pick<PersonalityType, 'code' | 'name' | 'isTraditional' | 'population' | 'celebrities'>[]>('/results'),

  submitScore: (answers: Record<string, string>, questionIds?: number[], timedOut?: Record<number, boolean>) =>
    request<ScoreResponse>('/results/score', {
      method: 'POST',
      body: JSON.stringify({ answers, questionIds, timedOut }),
    }),

  saveRecord: (payload: TestRecordPayload) =>
    request<{ id: string; typeCode: string; confidence: number | null }>('/records', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitFeedback: (userType: string, likedType: string, dislikedType: string, recordId?: string) =>
    request<{ id: string }>('/feedback', {
      method: 'POST',
      body: JSON.stringify({ userType, likedType, dislikedType, recordId }),
    }),

  createPayment: (typeCode: string, typeName: string, email?: string, referralCode?: string, recordId?: string): Promise<{ qrUrl?: string; orderId?: string; aoid?: string; unlockToken: string; expiresIn?: number; paid?: boolean }> => {
    return fetch(`${API_BASE}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typeCode, typeName, email, referralCode, recordId }),
    }).then(async (res) => {
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '支付服务暂不可用')
      if (json.data?.paid && json.data?.unlockToken) return json.data
      if (json.data?.qrUrl) return json.data
      throw new Error(json.error || '获取支付二维码失败')
    })
  },

  checkPayment: (typeCode: string, unlockToken: string, recordId?: string) => {
    const params = new URLSearchParams({ token: unlockToken })
    if (recordId) params.set('recordId', recordId)
    return request<{ paid: boolean }>(`/payment/check/${typeCode}?${params.toString()}`)
  },

  createDonation: (amount: number, payType: 'alipay' | 'native') =>
    request<{ qrUrl?: string; aoid?: string; orderId?: string; expiresIn?: number; paid?: boolean }>('/donation/create', {
      method: 'POST',
      body: JSON.stringify({ amount, payType }),
    }),

  checkDonation: (aoid: string) =>
    request<{ paid: boolean; status: string }>(`/donation/check/${aoid}`),

  createShareUnlock: (payload: { recordId: string; typeCode: string; email: string; channel?: string }) =>
    request<{ unlockToken: string; sent: boolean; id: string }>('/share-unlocks/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  saveEmail: (email: string, typeCode: string, source: string = 'paywall') =>
    request<{ id: string }>('/email', {
      method: 'POST',
      body: JSON.stringify({ email, typeCode, source }),
    }),

  createReferral: (recordId: string, typeCode: string, email: string) =>
    request<ReferralReward>('/referrals/create', {
      method: 'POST',
      body: JSON.stringify({ recordId, typeCode, email }),
    }),

  trackReferralClick: (code: string) =>
    request<{ found: boolean }>('/referrals/click', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  completeReferral: (referralCode: string, referredRecordId: string) =>
    request<{ counted: boolean; rewardUnlocked: boolean }>('/referrals/complete', {
      method: 'POST',
      body: JSON.stringify({ referralCode, referredRecordId }),
    }),

  submitSocialUnlock: (payload: { recordId: string; typeCode: string; email: string; platform: 'douyin' | 'xiaohongshu'; socialHandle?: string; commentText?: string; screenshotData: string }) =>
    request<{ id: string; status: string; message: string }>('/social-unlocks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSocialUnlocks: (status = 'pending') =>
    request<SocialUnlockRequest[]>(`/social-unlocks/admin?key=${encodeURIComponent(adminKey())}&status=${encodeURIComponent(status)}`),

  approveSocialUnlock: (id: string) =>
    request<{ id: string; sent: boolean; email: string; typeCode: string }>(`/social-unlocks/admin/${id}/approve?key=${encodeURIComponent(adminKey())}`, { method: 'POST' }),

  rejectSocialUnlock: (id: string, note?: string) =>
    request<{ id: string; status: string }>(`/social-unlocks/admin/${id}/reject?key=${encodeURIComponent(adminKey())}`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
}

/**
 * 对外统一入口。
 *
 * 构建时设置 `VITE_DEMO_MODE=1` 即切换到静态演示实现：
 * 数据来自 /demo/*.json，评分在本地完成，所有写入类接口停用。
 * 正式环境（默认）走 realApi，即上面的 HTTP 实现。
 */
export const api = (IS_DEMO ? demoApi : realApi) as typeof realApi

