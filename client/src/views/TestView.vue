<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import OptionGroup from '../components/OptionGroup.vue'
import OptionGroupBipolar from '../components/OptionGroupBipolar.vue'
import ConsentGate from '../components/ConsentGate.vue'
import { hasPrivacyConsent } from '../services/consent'
import { api } from '../services/api'
import { getAccessToken } from '../services/access'
import { IS_DEMO } from '../services/demoMode'

const router = useRouter()
const REFERRAL_KEY = 'mbti-pro-referral-code'

interface Question {
  id: number
  text: string
  textLeft?: string | null
  textRight?: string | null
  dimension: string
  type: 'likert' | 'objective'
  options: { key: string; label: string }[]
  correctAnswer?: string
}

const questions = ref<Question[]>([])
const loading = ref(true)
const loadError = ref('')
const currentIndex = ref(0)
// 通过「上一题」回看已答题目时不自动跳走，改完由用户自己决定去哪
const isReviewingHistory = ref(false)
const answers = ref<Record<number, string>>({})
const showSubmitConfirm = ref(false)
// 隐私"显式单独同意"：未同意前不允许作答（PIPL 对敏感个人信息的要求）
const showConsent = ref(false)
const submitError = ref('')
const submitting = ref(false)
const startTime = ref(Date.now())
// 每道题的进入时间与答题耗时（用于后台分析题目卡点）
const questionEnterAt = ref<Record<number, number>>({})
const questionTimings = ref<Record<number, number>>({})
const questionActiveMs = ref<Record<number, number>>({})

// 客观题相关状态（40 题首发版没有客观题，保留代码以兼容旧题库）
const objectiveIntroShown = ref(false)
const showObjectiveIntro = ref(false)
const objectiveSeconds = ref(20)
const timerRemaining = ref<Record<number, number>>({})  // 每道客观题的剩余秒数
let objectiveTimerInterval: ReturnType<typeof setInterval> | null = null

// 检测是否是第一道客观题的索引
const firstObjectiveIndex = computed(() => {
  const idx = questions.value.findIndex(q => q.type === 'objective')
  return idx === -1 ? Infinity : idx
})

const objectiveCount = computed(() => questions.value.filter(q => q.type === 'objective').length)

// 当前是否在客观题答题中（已确认开始）
const isInObjectiveMode = computed(() => {
  const q = currentQuestion.value
  return q?.type === 'objective' && objectiveIntroShown.value && !showObjectiveIntro.value
})

// 当前客观题是否已锁定（计时器归零，不可修改答案）
const isObjectiveLocked = computed(() => {
  const q = currentQuestion.value
  return q?.type === 'objective' && timerRemaining.value[q.id] !== undefined && timerRemaining.value[q.id] <= 0
})

// Fetch questions from API & restore saved progress
//
// 关键：题目列表永远以 API 为准（题库可能从 100 题改成 40 题）。
// localStorage 里的进度只有在题目 id 集合完全一致时才恢复，
// 否则直接丢弃 —— 否则旧题库缓存会让 dimTotals 变成 25/25/25/25，
// 阈值被放大到 ±17，几乎所有得分都落进中间档，结果永远是 ABCD。
async function fetchQuestions() {
  loading.value = true
  loadError.value = ''

  try {
    const data = await api.getQuestions()
    const parsed = data.map(q => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string),
    }))
    // 40 题版按 API 给定的 E/S/T/P 交叉顺序展示，不再把客观题全部挪到末尾
    questions.value = parsed
  } catch {
    loadError.value = '题目加载失败，请检查网络后刷新重试。'
    questions.value = []
    loading.value = false
    return
  }

  // 题目已就绪，再尝试恢复进度
  const saved = localStorage.getItem('mbti-pro-test')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      const savedIds: number[] = Array.isArray(parsed.questionIds) ? parsed.questionIds : []
      const currentIds = questions.value.map(q => q.id)
      const sameBank = savedIds.length === currentIds.length && savedIds.every((id, i) => id === currentIds[i])

      if (sameBank && parsed.answers && Object.keys(parsed.answers).length > 0) {
        answers.value = parsed.answers || {}
        currentIndex.value = Math.min(parsed.currentIndex || 0, questions.value.length - 1)
        objectiveIntroShown.value = parsed.objectiveIntroShown || false
        timerRemaining.value = parsed.timerRemaining || {}
        questionTimings.value = parsed.questionTimings || {}
        questionActiveMs.value = parsed.questionActiveMs || {}
      } else {
        // 题库版本不一致（旧题库残留），清掉旧进度
        localStorage.removeItem('mbti-pro-test')
      }
    } catch {
      localStorage.removeItem('mbti-pro-test')
    }
  }

  loading.value = false
}

onMounted(() => {
  if (!IS_DEMO && !getAccessToken()) {
    router.replace('/')
    return
  }
  showConsent.value = !hasPrivacyConsent()
  const params = new URLSearchParams(window.location.search)
  const referralCode = params.get('ref')
  if (referralCode) {
    localStorage.setItem(REFERRAL_KEY, referralCode)
    api.trackReferralClick(referralCode).catch(() => {})
  }
  fetchQuestions()
})

function markQuestionEntered() {
  const q = currentQuestion.value
  if (!q || questionEnterAt.value[q.id]) return
  questionEnterAt.value[q.id] = Date.now()
}

function flushCurrentQuestionTiming() {
  const q = currentQuestion.value
  if (!q) return
  const enterAt = questionEnterAt.value[q.id]
  if (!enterAt) return
  const elapsed = Date.now() - enterAt
  if (document.visibilityState === 'visible' && elapsed > 0) {
    questionActiveMs.value[q.id] = (questionActiveMs.value[q.id] || 0) + Math.min(elapsed, 120000)
  }
  questionEnterAt.value[q.id] = Date.now()
}

function finalizeQuestionTiming(questionId: number) {
  const activeMs = questionActiveMs.value[questionId]
  if (!activeMs || activeMs <= 0) return
  questionTimings.value[questionId] = Math.round(Math.min(activeMs / 1000, 120) * 10) / 10
}

// Save progress
// 只存题目 id 指纹 + 答案，不再把整份题目列表塞进 localStorage
watch([answers, currentIndex, objectiveIntroShown, timerRemaining], () => {
  if (questions.value.length === 0) return
  localStorage.setItem('mbti-pro-test', JSON.stringify({
    questionIds: questions.value.map(q => q.id),
    answers: answers.value,
    currentIndex: currentIndex.value,
    objectiveIntroShown: objectiveIntroShown.value,
    timerRemaining: timerRemaining.value,
    questionTimings: questionTimings.value,
    questionActiveMs: questionActiveMs.value,
  }))
}, { deep: true })

const currentQuestion = computed(() => questions.value[currentIndex.value])
const progress = computed(() => Object.keys(answers.value).length)
const totalQuestions = computed(() => questions.value.length)
const canGoNext = computed(() => !!answers.value[currentQuestion.value?.id])

const dimensionNames: Record<string, string> = {
  E_I: '能量来源',
  S_N: '认知方式',
  T_F: '决策方式',
  P_J: '生活态度',
}
const currentDimension = computed(() => dimensionNames[currentQuestion.value?.dimension || ''] || '')
const progressPct = computed(() => totalQuestions.value ? Math.round((progress.value / totalQuestions.value) * 100) : 0)
function pad(n: number) { return String(n).padStart(2, '0') }
const isLastQuestion = computed(() => currentIndex.value >= questions.value.length - 1)

let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null

// 客观题倒计时
function startObjectiveTimer(initialSeconds = 20) {
  stopObjectiveTimer()
  objectiveSeconds.value = initialSeconds
  objectiveTimerInterval = setInterval(() => {
    objectiveSeconds.value--
    if (objectiveSeconds.value <= 0) {
      onObjectiveTimeout()
    }
  }, 1000)
}

function stopObjectiveTimer() {
  if (objectiveTimerInterval) {
    clearInterval(objectiveTimerInterval)
    objectiveTimerInterval = null
  }
}

function saveTimerRemaining() {
  const q = currentQuestion.value
  if (q?.type === 'objective' && objectiveTimerInterval) {
    timerRemaining.value[q.id] = objectiveSeconds.value
  }
}

function onObjectiveTimeout() {
  const q = currentQuestion.value
  if (q) {
    questionActiveMs.value[q.id] = Math.max(questionActiveMs.value[q.id] || 0, 20000)
    finalizeQuestionTiming(q.id)
  }
  stopObjectiveTimer()
  timerRemaining.value[currentQuestion.value.id] = 0
  // 已作答的不再自动跳转
  if (answers.value[currentQuestion.value.id]) return
  if (isLastQuestion.value) {
    showSubmitConfirm.value = true
  } else if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
  }
}

function selectOption(key: string) {
  if (showConsent.value) return
  if (isObjectiveLocked.value) return
  const q = currentQuestion.value
  if (!q) return
  if (!questionEnterAt.value[q.id]) markQuestionEntered()
  flushCurrentQuestionTiming()
  finalizeQuestionTiming(q.id)
  answers.value[q.id] = key
  if (q.type === 'objective') {
    saveTimerRemaining()
    stopObjectiveTimer()
  }
  if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer)
  // 回看模式下改完答案同样自动前进 —— goNext 在回看模式里只单步前进一题
  autoAdvanceTimer = setTimeout(() => {
    goNext()
  }, 320)
}

// 找到下一道未答的题目
function findNextUnanswered(): number {
  for (let i = currentIndex.value + 1; i < questions.value.length; i++) {
    if (!answers.value[questions.value[i].id]) return i
  }
  return -1 // 没有未答的
}

function goNext() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
  saveTimerRemaining()
  stopObjectiveTimer()

  // 回看模式：一次只前进一题，不再跳到「下一道未答题」
  if (isReviewingHistory.value) {
    if (!isLastQuestion.value) currentIndex.value++
    else { submitError.value = ''; showSubmitConfirm.value = true }
    return
  }

  if (isLastQuestion.value) {
    submitError.value = ''
    showSubmitConfirm.value = true
    return
  }

  const next = findNextUnanswered()
  if (next >= 0) {
    // 检测是否即将进入第一道客观题
    if (next >= firstObjectiveIndex.value && !objectiveIntroShown.value) {
      currentIndex.value = next
      showObjectiveIntro.value = true
      return
    }
    currentIndex.value = next
  } else {
    // 全部答完，跳到最后一题提交
    currentIndex.value = questions.value.length - 1
  }
}

function confirmObjectiveIntro() {
  showObjectiveIntro.value = false
  objectiveIntroShown.value = true
  startObjectiveTimer()
}

function cancelObjectiveIntro() {
  showObjectiveIntro.value = false
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

// 「上一题」= 真正的上一道（按展示顺序回退一格），不是「上一道未答题」。
// 旧实现会跳过所有已答题，正常作答时前面全答过 → 直接落到第 1 题。
function goPrev() {
  if (isInObjectiveMode.value) return
  if (currentIndex.value <= 0) return
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
  saveTimerRemaining()
  stopObjectiveTimer()
  isReviewingHistory.value = true
  currentIndex.value = currentIndex.value - 1
}

async function submitTest() {
  flushCurrentQuestionTiming()

  if (Object.keys(answers.value).length === 0) {
    showSubmitConfirm.value = false
    submitError.value = '还没有作答任何题目，请先完成至少一道题再提交。'
    return
  }

  submitting.value = true
  showSubmitConfirm.value = false
  stopObjectiveTimer()

  // Count answered questions per dimension (for display in result)
  const dimAnswered = { E_I: 0, S_N: 0, T_F: 0, P_J: 0 }
  const dimTotals = { E_I: 0, S_N: 0, T_F: 0, P_J: 0 }
  questions.value.forEach(q => {
    if (q.dimension in dimTotals) {
      dimTotals[q.dimension as keyof typeof dimTotals]++
      if (answers.value[q.id]) dimAnswered[q.dimension as keyof typeof dimAnswered]++
    }
  })

  try {
    // 只上报真正作答过的题：后端据此计算实际计分题数与阈值
    const presentedIds = questions.value.filter(q => answers.value[q.id]).map(q => q.id)
    const timedOut: Record<number, boolean> = {}
    for (const q of questions.value) {
      if (q.type === 'objective') {
        timedOut[q.id] = timerRemaining.value[q.id] === 0 && !answers.value[q.id]
      }
    }
    const score = await api.submitScore({ ...answers.value }, presentedIds, timedOut)
    localStorage.removeItem('mbti-pro-test')

    // 收集设备信息
    const deviceInfo = JSON.stringify({
      os: navigator.platform || 'unknown',
      screen: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
    })

    // 收集UTM参数
    const urlParams = new URLSearchParams(window.location.search)
    const utmSource = urlParams.get('utm_source') || undefined
    const utmMedium = urlParams.get('utm_medium') || undefined
    const utmCampaign = urlParams.get('utm_campaign') || undefined

    const recordRes = await api.saveRecord({
      typeCode: score.typeCode,
      scores: score.scores,
      chars: score.chars,
      answers: { ...answers.value },
      duration: Math.round((Date.now() - startTime.value) / 1000),
      dimAnswered,
      dimTotals,
      confidence: score.confidence,
      questionTimings: { ...questionTimings.value },
      deviceInfo,
      utmSource,
      utmMedium,
      utmCampaign,
    })

    const referralCode = localStorage.getItem(REFERRAL_KEY) || ''
    if (referralCode && recordRes?.id && score.confidence >= 92) {
      api.completeReferral(referralCode, recordRes.id)
        .then(() => localStorage.removeItem(REFERRAL_KEY))
        .catch(() => {})
    }

    // 答案已落库，直接进入结果页；不再插入强制反馈步骤
    router.push({
      name: 'result',
      params: { type: recordRes?.typeCode || score.typeCode },
      query: {
        scores: JSON.stringify(score.scores),
        chars: JSON.stringify(score.chars),
        confidence: String(score.confidence),
        dimTotals: JSON.stringify(dimTotals),
        dimAnswered: JSON.stringify(dimAnswered),
        recordId: recordRes?.id,
      },
    })
    submitting.value = false
  } catch (err) {
    submitting.value = false
    loadError.value = (err instanceof Error ? err.message : '评分失败') + '，请稍后重试。'
  }
}

// 监听进入客观题自动启动计时（有剩余秒数则恢复，已归零则不再启动）
watch(currentIndex, () => {
  flushCurrentQuestionTiming()
  markQuestionEntered()
  const q = currentQuestion.value
  if (q?.type === 'objective' && objectiveIntroShown.value && !showObjectiveIntro.value) {
    const saved = timerRemaining.value[q.id]
    if (saved === undefined) {
      startObjectiveTimer(20)  // 首次进入
    } else if (saved > 0) {
      startObjectiveTimer(saved)  // 恢复剩余时间
    } else {
      objectiveSeconds.value = 0  // 已超时，显示 0
    }
  }
})

// Keyboard navigation
function onKeydown(e: KeyboardEvent) {
  if (showSubmitConfirm.value || showObjectiveIntro.value || showConsent.value) return
  const q = currentQuestion.value
  if (!q) return

  if (e.key >= '1' && e.key <= String(q.options.length)) {
    selectOption(q.options[Number(e.key) - 1].key)
  }
  if (e.key === 'ArrowRight' || e.key === 'Enter') {
    if (canGoNext.value) goNext()
  }
  if (e.key === 'ArrowLeft' && !isInObjectiveMode.value) goPrev()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibilityChange)
  markQuestionEntered()
})

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    flushCurrentQuestionTiming()
  } else {
    questionEnterAt.value = {}
    markQuestionEntered()
  }
}

onUnmounted(() => {
  flushCurrentQuestionTiming()
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopObjectiveTimer()
})
</script>

<template>
  <div class="test-page" @keydown="onKeydown">
    <header class="test-header">
      <button class="test-brand" type="button" @click="router.push('/')">
        MBTI <span>—</span> PRO
      </button>
      <div class="test-meta">
        <span>PERSONALITY ARCHIVE / 40 QUESTIONS</span>
        <span>{{ pad(currentIndex + 1) }} / {{ pad(totalQuestions) }}</span>
      </div>
    </header>

    <div class="test-progress">
      <span :style="{ width: `${progressPct}%` }" />
    </div>

    <main class="test-main">
      <div v-if="loading" class="test-state">
        <span class="state-mark">◌</span>
        <p>正在整理题目…</p>
      </div>

      <div v-else-if="loadError" class="test-state">
        <p>{{ loadError }}</p>
        <button type="button" class="text-action" @click="fetchQuestions()">重新加载</button>
      </div>

      <div v-else-if="currentQuestion" class="question-shell">
        <div class="question-meta">
          <span>QUESTION {{ pad(currentIndex + 1) }}</span>
          <span>{{ currentDimension }}</span>
          <span v-if="isInObjectiveMode" class="timer">{{ objectiveSeconds }}s</span>
        </div>

        <h1 v-if="currentQuestion.type === 'likert'" class="question-headline">
          哪一种更像平时的你？
        </h1>
        <h1 v-else class="question-headline">
          {{ currentQuestion.text }}
        </h1>

        <p v-if="currentQuestion.type === 'likert'" class="question-sub">
          读完两段描述，选更像你的一段。没有标准答案。
        </p>

        <div class="question-body">
          <OptionGroupBipolar
            v-if="currentQuestion.type === 'likert' && currentQuestion.textLeft && currentQuestion.textRight"
            :textLeft="currentQuestion.textLeft"
            :textRight="currentQuestion.textRight"
            :modelValue="answers[currentQuestion.id] ?? null"
            @update:modelValue="selectOption"
          />
          <OptionGroup
            v-else
            :options="currentQuestion.options"
            :modelValue="answers[currentQuestion.id] ?? null"
            :disabled="isObjectiveLocked"
            @update:modelValue="selectOption"
          />
        </div>
      </div>
    </main>

    <footer class="test-footer">
      <button
        type="button"
        class="text-action"
        :disabled="currentIndex === 0 || isInObjectiveMode"
        @click="goPrev"
      >
        ← 上一题
      </button>
      <span class="auto-save">{{ isReviewingHistory ? '回看中 · 作答或点「下一题」继续' : '答案自动保存 · 可中断' }}</span>
      <button type="button" class="next-action" @click="goNext">
        {{ isLastQuestion ? '提交结果' : '下一题' }}
        <span aria-hidden="true">→</span>
      </button>
    </footer>

    <ConsentGate v-if="showConsent" @agreed="showConsent = false" />

    <Transition name="modal">
      <div v-if="showObjectiveIntro" class="modal-overlay">
        <div class="modal-backdrop" />
        <div class="modal-panel">
          <p class="modal-kicker">SECTION 05 / REASONING</p>
          <h2>接下来是 {{ objectiveCount }} 道客观推理题</h2>
          <div class="modal-copy">
            <p>每题限时 20 秒，超时自动跳过。</p>
            <p>选择后自动进入下一题，不可返回修改。</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="text-action" @click="cancelObjectiveIntro">返回</button>
            <button type="button" class="next-action" @click="confirmObjectiveIntro">准备好了 →</button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="modal">
      <div v-if="showSubmitConfirm" class="modal-overlay">
        <div class="modal-backdrop" @click="showSubmitConfirm = false" />
        <div class="modal-panel">
          <p class="modal-kicker">FINAL CHECK</p>
          <h2>确认提交？</h2>
          <div class="modal-copy">
            <p>你已完成 <strong>{{ progress }}</strong> / {{ totalQuestions }} 道题。</p>
            <p v-if="progress < totalQuestions">还有 {{ totalQuestions - progress }} 道题未作答，提交后将无法修改。</p>
            <p v-if="submitError" class="modal-error">{{ submitError }}</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="text-action" @click="showSubmitConfirm = false">继续答题</button>
            <button type="button" class="next-action" :disabled="submitting" @click="submitTest">
              {{ submitting ? '提交中…' : '确认提交 →' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.test-page {
  --paper: #f2ede3;
  --paper-light: #f8f4ec;
  --ink: #1e1d1a;
  --muted: #6f685d;
  --rule: #d2c8b8;
  --accent: #a63d2c;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--paper);
  color: var(--ink);
  font-family: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", system-ui, sans-serif;
}

.test-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 22px 40px;
  border-bottom: 1px solid var(--rule);
}
.test-brand {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 14px;
  letter-spacing: .08em;
}
.test-brand span { color: var(--accent); }
.test-meta {
  display: flex;
  align-items: center;
  gap: 26px;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 10px;
  letter-spacing: .08em;
}
.test-meta span:last-child { color: var(--ink); }
.test-progress { height: 1px; background: var(--rule); }
.test-progress span { display: block; height: 100%; background: var(--accent); transition: width .25s ease; }

.test-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 64px 40px 52px;
}
.test-state {
  align-self: center;
  text-align: center;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 12px;
}
.state-mark { display: block; margin-bottom: 14px; color: var(--accent); font-size: 28px; }
.question-shell { width: 100%; }
.question-meta {
  display: flex;
  align-items: center;
  gap: 22px;
  margin-bottom: 26px;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 10px;
  letter-spacing: .1em;
}
.question-meta span:first-child { color: var(--accent); }
.question-meta .timer { margin-left: auto; color: var(--accent); font-size: 12px; }
.question-headline {
  max-width: 840px;
  margin: 0;
  font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif;
  font-size: clamp(38px, 5.2vw, 64px);
  font-weight: 600;
  line-height: 1.32;
  letter-spacing: -.045em;
  text-wrap: balance;
}
.question-sub { margin: 18px 0 0; color: var(--muted); font-size: 13px; line-height: 1.8; }
.question-body { margin-top: 44px; }

.test-footer {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 18px 40px;
  border-top: 1px solid var(--rule);
  background: rgba(242, 237, 227, .94);
  backdrop-filter: blur(8px);
}
.text-action {
  padding: 8px 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: none;
  color: var(--muted);
  font-size: 13px;
  transition: color .2s ease, border-color .2s ease;
}
.text-action:hover:not(:disabled) { color: var(--ink); border-color: var(--ink); }
.text-action:disabled { opacity: .3; cursor: not-allowed; }
.auto-save { color: var(--muted); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 10px; letter-spacing: .04em; }
.next-action {
  display: inline-flex;
  align-items: center;
  gap: 22px;
  min-width: 142px;
  justify-content: space-between;
  padding: 13px 18px;
  border: 1px solid var(--ink);
  border-radius: 0;
  background: var(--ink);
  color: var(--paper-light);
  font-size: 13px;
  font-weight: 600;
  transition: background .2s ease, border-color .2s ease;
}
.next-action:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); }
.next-action:disabled { opacity: .45; cursor: not-allowed; }

.modal-overlay { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal-backdrop { position: absolute; inset: 0; background: rgba(30, 29, 26, .55); backdrop-filter: blur(4px); }
.modal-panel {
  position: relative;
  width: 100%;
  max-width: 520px;
  padding: 30px;
  border: 1px solid var(--ink);
  border-radius: 2px;
  background: var(--paper-light);
  color: var(--ink);
}
.modal-kicker { margin: 0 0 14px; color: var(--accent); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 10px; letter-spacing: .1em; }
.modal-panel h2 { margin: 0; font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif; font-size: 27px; font-weight: 600; letter-spacing: -.03em; }
.modal-copy { margin-top: 16px; color: var(--muted); font-size: 13px; line-height: 1.8; }
.modal-copy p { margin: 0 0 6px; }
.modal-copy strong { color: var(--ink); }
.modal-copy .modal-error { color: var(--accent); font-weight: 600; }
.modal-actions { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 26px; }
.modal-actions .next-action { min-width: 120px; }

.modal-enter-active, .modal-leave-active { transition: opacity .22s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

@media (max-width: 700px) {
  .test-header { padding: 18px 22px; }
  .test-meta span:first-child { display: none; }
  .test-main { padding: 42px 22px 36px; }
  .question-headline { font-size: 34px; line-height: 1.36; }
  .question-body { margin-top: 30px; }
  .test-footer { padding: 14px 22px; gap: 10px; }
  .auto-save { display: none; }
  .next-action { min-width: 122px; padding: 12px 14px; gap: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .test-progress span, .next-action, .text-action { transition: none; }
}
</style>
