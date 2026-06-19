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
}

export interface TestRecordPayload {
  typeCode: string
  scores: Record<string, number>
  chars: Record<string, string>
  answers: Record<string, string>
  duration: number
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

  getResult: (typeCode: string) => request<PersonalityType>(`/results/${typeCode}`),

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
}
