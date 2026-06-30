// 开发环境通过 Vite proxy 访问 /api，生产环境使用完整 URL
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

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

export const api = {
  getQuestions: () => request<ApiQuestion[]>('/questions'),

  getQuestionCount: () => request<{ count: number }>('/questions/count'),

  getResult: (typeCode: string, unlockToken?: string) => {
    const query = unlockToken ? `?token=${encodeURIComponent(unlockToken)}` : ''
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
    request<{ id: string }>('/records', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitFeedback: (userType: string, likedType: string, dislikedType: string, recordId?: string) =>
    request<{ id: string }>('/feedback', {
      method: 'POST',
      body: JSON.stringify({ userType, likedType, dislikedType, recordId }),
    }),

  // ====== 支付相关 ======

  /** 创建支付订单，返回二维码内容；已支付时返回 null */
  createPayment: (typeCode: string, typeName: string): Promise<{ qrUrl?: string; orderId?: string; aoid?: string; unlockToken: string; expiresIn?: number; paid?: boolean }> => {
    const API_BASE = import.meta.env.VITE_API_BASE || '/api'
    return fetch(`${API_BASE}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typeCode, typeName }),
    }).then(async (res) => {
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '支付服务暂不可用')
      if (json.data?.paid && json.data?.unlockToken) return json.data
      // 返回二维码数据
      if (json.data?.qrUrl) return json.data
      throw new Error(json.error || '获取支付二维码失败')
    })
  },

  /** 检查某个类型是否已支付 */
  checkPayment: (typeCode: string, unlockToken: string) =>
    request<{ paid: boolean }>(`/payment/check/${typeCode}?token=${encodeURIComponent(unlockToken)}`),

  /** 保存邮箱 */
  saveEmail: (email: string, typeCode: string, source: string = 'paywall') =>
    request<{ id: string }>('/email', {
      method: 'POST',
      body: JSON.stringify({ email, typeCode, source }),
    }),
}
