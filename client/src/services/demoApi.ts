/**
 * 静态演示版 API 实现
 *
 * 用与 `api.ts` 完全相同的接口签名，但数据全部来自构建期导出的静态 JSON，
 * 评分在浏览器本地完成。用于服务器停用后的零成本静态托管。
 *
 * 数据来源（由 server/scripts/export-demo-data.ts 生成）：
 *   public/demo/questions.json  40 道题
 *   public/demo/types.json      81 型内容（含四个维度模块）
 *   public/demo/meta.json       统计元信息
 *
 * 写入类接口（支付 / 打赏 / 邮件 / 记录落库）在演示模式下不产生任何副作用。
 */

import type {
  ApiQuestion,
  PersonalityType,
  ReferralReward,
  ScoreResponse,
  TestRecordPayload,
} from './api'
import { calculateScore, type AnswerKey, type QuestionMeta } from './scoring'

const DEMO_NOTICE = '演示环境：该功能已停用（本站为静态演示版，不涉及任何支付与数据写入）'

// ── 静态数据加载（只请求一次，之后走内存缓存）────────────────
let questionsPromise: Promise<ApiQuestion[]> | null = null
let typesPromise: Promise<PersonalityType[]> | null = null
let typeMapPromise: Promise<Map<string, PersonalityType>> | null = null

function loadQuestions(): Promise<ApiQuestion[]> {
  if (!questionsPromise) {
    questionsPromise = fetch('/demo/questions.json').then((r) => {
      if (!r.ok) throw new Error('演示数据加载失败：questions.json')
      return r.json() as Promise<ApiQuestion[]>
    })
  }
  return questionsPromise
}

function loadTypes(): Promise<PersonalityType[]> {
  if (!typesPromise) {
    typesPromise = fetch('/demo/types.json').then((r) => {
      if (!r.ok) throw new Error('演示数据加载失败：types.json')
      return r.json() as Promise<PersonalityType[]>
    })
  }
  return typesPromise
}

function loadTypeMap(): Promise<Map<string, PersonalityType>> {
  if (!typeMapPromise) {
    typeMapPromise = loadTypes().then((list) => {
      const m = new Map<string, PersonalityType>()
      for (const t of list) m.set(t.code, t)
      return m
    })
  }
  return typeMapPromise
}

/** 轻微延迟，让加载态可见，交互手感更接近真实站点 */
function resolve<T>(value: T, ms = 40): Promise<T> {
  return new Promise((r) => setTimeout(() => r(value), ms))
}

function demoId(prefix: string): string {
  return `${prefix}-demo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export const demoApi = {
  getQuestions: () => loadQuestions(),

  getQuestionCount: async () => ({ count: (await loadQuestions()).length }),

  /** 演示环境不校验真实商品码，输入任意非空码即可预览完整流程。 */
  redeemAccess: async (code: string) => {
    if (!code.trim()) throw new Error('请输入兑换码。')
    return resolve({ accessToken: demoId('access'), expiresAt: null })
  },

  checkAccess: async (token: string) => resolve({ valid: Boolean(token) }),

  /**
   * 演示模式下：只要带了解锁 token（由 createShareUnlock 返回），即视为已解锁。
   * 这样付费墙的"解锁后校验"流程可以正常走通，而无需任何后端。
   */
  getResult: async (typeCode: string, token?: string): Promise<PersonalityType> => {
    const m = await loadTypeMap()
    const t = m.get(typeCode)
    if (!t) throw new Error(`未找到类型 ${typeCode}`)
    return resolve({ ...t, paid: Boolean(token) })
  },

  getResultSummary: async (typeCode: string) => {
    const m = await loadTypeMap()
    const t = m.get(typeCode)
    if (!t) throw new Error(`未找到类型 ${typeCode}`)
    return resolve({
      code: t.code,
      name: t.name,
      isTraditional: t.isTraditional,
      overview: t.overview,
    })
  },

  getAllTypes: async () => {
    const list = await loadTypes()
    return list.map((t) => ({
      code: t.code,
      name: t.name,
      isTraditional: t.isTraditional,
      population: t.population ?? null,
      celebrities: t.celebrities ?? null,
    }))
  },

  /** 本机评分：与后端同一份 scoring.ts */
  submitScore: async (
    answers: Record<string, string>,
    _questionIds?: number[],
    timedOut?: Record<number, boolean>,
  ): Promise<ScoreResponse> => {
    const qs = await loadQuestions()
    const meta: QuestionMeta[] = qs.map((q) => ({
      id: q.id,
      dimension: q.dimension as QuestionMeta['dimension'],
      type: q.type,
      correctAnswer: q.correctAnswer ?? null,
    }))
    const result = calculateScore(
      answers as Record<number, AnswerKey | undefined>,
      meta,
      timedOut ?? {},
    )
    return resolve({
      typeCode: result.typeCode,
      scores: result.scores,
      chars: result.chars,
      confidence: result.confidence,
    })
  },

  /** 不落库，只在本地返回一个可用 id，供后续页面串联 */
  saveRecord: async (payload: TestRecordPayload) =>
    resolve({
      id: demoId('rec'),
      typeCode: payload.typeCode,
      confidence: payload.confidence ?? null,
    }),

  submitFeedback: async () => resolve({ id: demoId('fb') }),

  createPayment: async (): Promise<never> => {
    throw new Error(DEMO_NOTICE)
  },

  checkPayment: async () => resolve({ paid: false }),

  createDonation: async (): Promise<never> => {
    throw new Error(DEMO_NOTICE)
  },

  checkDonation: async () => resolve({ paid: false, status: 'demo' }),

  createShareUnlock: async () =>
    resolve({ unlockToken: demoId('unlock'), sent: false, id: demoId('su') }),

  saveEmail: async () => resolve({ id: demoId('email') }),

  createReferral: async (): Promise<ReferralReward> =>
    resolve({
      code: 'DEMO',
      referrerRecordId: 'demo',
      referrerTypeCode: 'ENTJ',
      clickedCount: 0,
      validCompletedCount: 0,
      rewardUnlocked: false,
    }),

  trackReferralClick: async () => resolve({ found: false }),

  completeReferral: async () => resolve({ counted: false, rewardUnlocked: false }),

  submitSocialUnlock: async () =>
    resolve({ id: demoId('social'), status: 'pending', message: DEMO_NOTICE }),

  getSocialUnlocks: async () => resolve([]),

  approveSocialUnlock: async (): Promise<never> => {
    throw new Error(DEMO_NOTICE)
  },

  rejectSocialUnlock: async (): Promise<never> => {
    throw new Error(DEMO_NOTICE)
  },
}
