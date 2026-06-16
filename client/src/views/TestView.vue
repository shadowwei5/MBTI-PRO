<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import ProgressBar from '../components/ProgressBar.vue'
import OptionGroup from '../components/OptionGroup.vue'
import OptionGroupBipolar from '../components/OptionGroupBipolar.vue'
import { api, type ApiQuestion } from '../services/api'

const router = useRouter()

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
const answers = ref<Record<number, string>>({})
const showSubmitConfirm = ref(false)
const startTime = ref(Date.now())

// 客观题相关状态
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
async function fetchQuestions() {
  loading.value = true
  loadError.value = ''

  const saved = localStorage.getItem('mbti-pro-test')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.questions && parsed.questions.length > 0) {
        questions.value = parsed.questions
        answers.value = parsed.answers || {}
        currentIndex.value = parsed.currentIndex || 0
        objectiveIntroShown.value = parsed.objectiveIntroShown || false
        timerRemaining.value = parsed.timerRemaining || {}
        loading.value = false
        return
      }
    } catch { /* ignore */ }
  }

  try {
    const data = await api.getQuestions()
    const parsed = data.map(q => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string),
    }))
    const likert = parsed.filter(q => q.type === 'likert')
    const objective = parsed.filter(q => q.type === 'objective')
    const shuffled = [...objective].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, 10).map((q, i) => ({ ...q, sortOrder: 81 + i }))
    questions.value = [...likert, ...selected]
  } catch {
    loadError.value = '题目加载失败，请检查网络后刷新重试。'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchQuestions()
})

// Save progress
watch([answers, currentIndex, objectiveIntroShown, timerRemaining], () => {
  localStorage.setItem('mbti-pro-test', JSON.stringify({
    questions: questions.value,
    answers: answers.value,
    currentIndex: currentIndex.value,
    objectiveIntroShown: objectiveIntroShown.value,
    timerRemaining: timerRemaining.value,
  }))
}, { deep: true })

const currentQuestion = computed(() => questions.value[currentIndex.value])
const progress = computed(() => Object.keys(answers.value).length)
const totalQuestions = computed(() => questions.value.length)
const canGoNext = computed(() => !!answers.value[currentQuestion.value?.id])
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
  if (isObjectiveLocked.value) return
  answers.value[currentQuestion.value.id] = key
  if (currentQuestion.value.type === 'objective') {
    saveTimerRemaining()
    stopObjectiveTimer()
  }
  if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer)
  autoAdvanceTimer = setTimeout(() => {
    goNext()
  }, 150)
}

function goNext() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
  saveTimerRemaining()
  stopObjectiveTimer()

  if (isLastQuestion.value) {
    showSubmitConfirm.value = true
    return
  }

  const nextIdx = currentIndex.value + 1
  // 检测是否即将进入第一道客观题
  if (nextIdx >= firstObjectiveIndex.value && !objectiveIntroShown.value) {
    currentIndex.value = nextIdx
    showObjectiveIntro.value = true
    return
  }

  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
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

function goPrev() {
  if (isInObjectiveMode.value) return
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
  saveTimerRemaining()
  stopObjectiveTimer()
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

async function submitTest() {
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
    const presentedIds = questions.value.map(q => q.id)
    const score = await api.submitScore({ ...answers.value }, presentedIds)
    localStorage.removeItem('mbti-pro-test')

    api.saveRecord({
      typeCode: score.typeCode,
      scores: score.scores,
      chars: score.chars,
      answers: { ...answers.value },
      duration: Math.round((Date.now() - startTime.value) / 1000),
    }).catch(() => { /* non-critical */ })

    router.push({
      name: 'result',
      params: { type: score.typeCode },
      query: {
        scores: JSON.stringify(score.scores),
        chars: JSON.stringify(score.chars),
        confidence: String(score.confidence),
        dimTotals: JSON.stringify(dimTotals),
        dimAnswered: JSON.stringify(dimAnswered),
      },
    })
  } catch (err) {
    loadError.value = (err instanceof Error ? err.message : '评分失败') + '，请稍后重试。'
  }
}

function jumpTo(index: number) {
  if (isInObjectiveMode.value) return
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
  saveTimerRemaining()
  stopObjectiveTimer()
  if (index >= 0 && index <= questions.value.length - 1) {
    currentIndex.value = index
  }
}

// 监听进入客观题自动启动计时（有剩余秒数则恢复，已归零则不再启动）
watch(currentIndex, () => {
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
  if (showSubmitConfirm.value || showObjectiveIntro.value) return
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
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  stopObjectiveTimer()
})
</script>

<template>
  <div class="min-h-screen flex flex-col" @keydown="onKeydown">
    <!-- Header -->
    <header class="sticky top-0 z-10 bg-cream/80 backdrop-blur-sm border-b border-border">
      <div class="max-w-2xl mx-auto px-5 py-4">
        <ProgressBar :modelValue="currentIndex" :max="totalQuestions - 1" @update:modelValue="jumpTo" />
      </div>
    </header>

    <!-- Question Area -->
    <main class="flex-1 flex flex-col items-center justify-center px-5 py-12">
      <!-- Loading -->
      <div v-if="loading" class="text-center">
        <div class="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-coral-soft border-t-coral animate-spin" />
        <p class="text-text-muted text-sm">正在加载题目...</p>
      </div>

      <!-- Error -->
      <div v-else-if="loadError" class="text-center">
        <p class="text-coral mb-4">{{ loadError }}</p>
        <button @click="fetchQuestions()"
          class="px-6 py-2 bg-charcoal text-cream rounded-xl text-sm">刷新重试</button>
      </div>

      <!-- Questions -->
      <Transition v-else name="question" mode="out-in">
        <div
          v-if="currentQuestion"
          :key="currentQuestion.id"
          class="w-full max-w-2xl mx-auto stagger"
        >
          <!-- Question type badge + timer -->
          <div class="flex items-center gap-3 mb-8">
            <span
              class="text-xs font-semibold px-3 py-1 rounded-full tracking-wide"
              :class="currentQuestion.type === 'objective'
                ? 'bg-gold/10 text-gold border border-gold/30'
                : 'bg-sage/10 text-sage border border-sage/30'"
            >
              {{ currentQuestion.type === 'objective' ? '客观推理题' : '主观选择题' }}
            </span>
            <span class="text-xs text-text-muted">第 {{ currentIndex + 1 }} 题 / 共 {{ totalQuestions }} 题</span>

            <!-- 客观题倒计时 -->
            <span
              v-if="isInObjectiveMode"
              class="ml-auto text-sm font-mono font-bold tabular-nums"
              :class="objectiveSeconds <= 5 ? 'text-coral animate-pulse' : 'text-charcoal'"
            >
              <svg class="w-4 h-4 inline-block mr-1 -mt-0.5" :class="objectiveSeconds <= 5 ? 'text-coral' : 'text-gold'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <path stroke-linecap="round" d="M12 6v6l4 2" />
              </svg>
              {{ objectiveSeconds }}s
            </span>
          </div>

          <!-- Question text (objective) -->
          <h2
            v-if="currentQuestion.type === 'objective'"
            class="text-xl md:text-2xl font-display font-bold text-charcoal leading-relaxed mb-10 whitespace-pre-line"
          >
            {{ currentQuestion.text }}
          </h2>

          <!-- Bipolar layout (likert) -->
          <OptionGroupBipolar
            v-if="currentQuestion.type === 'likert' && currentQuestion.textLeft && currentQuestion.textRight"
            :textLeft="currentQuestion.textLeft"
            :textRight="currentQuestion.textRight"
            :modelValue="answers[currentQuestion.id] ?? null"
            @update:modelValue="selectOption"
          />

          <!-- Options (objective) -->
          <OptionGroup
            v-if="currentQuestion.type === 'objective'"
            :options="currentQuestion.options"
            :modelValue="answers[currentQuestion.id] ?? null"
            :disabled="isObjectiveLocked"
            @update:modelValue="selectOption"
          />

          <!-- Keyboard hint -->
          <p class="mt-6 text-xs text-text-muted text-center">
            方向键切换题目
          </p>
        </div>
      </Transition>
    </main>

    <!-- Bottom Navigation -->
    <footer class="sticky bottom-0 bg-cream/80 backdrop-blur-sm border-t border-border">
      <div class="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
        <button
          @click="goPrev"
          :disabled="currentIndex === 0 || isInObjectiveMode"
          class="px-5 py-3 min-h-[44px] text-sm font-medium text-text-secondary rounded-xl transition-all duration-300 hover:bg-surface-alt disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← 上一题
        </button>

        <div class="hidden md:flex items-center gap-1.5">
          <button
            v-for="(_, idx) in questions"
            :key="idx"
            @click="jumpTo(idx)"
            class="w-2 h-2 rounded-full transition-all duration-300"
            :class="idx === currentIndex
              ? 'bg-coral w-6'
              : answers[questions[idx].id] ? 'bg-sage' : 'bg-border'"
          />
        </div>

        <button
          @click="goNext"
          class="px-6 py-3 min-h-[44px] text-sm font-semibold rounded-xl transition-all duration-300 bg-charcoal text-cream hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
        >
          {{ isLastQuestion ? '提交结果' : '下一题 →' }}
        </button>
      </div>
    </footer>

    <!-- 客观题介绍弹窗 -->
    <Transition name="modal">
      <div v-if="showObjectiveIntro" class="fixed inset-0 z-50 flex items-center justify-center p-5">
        <div class="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" />
        <div class="relative bg-cream rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in">
          <div class="w-12 h-12 mx-auto mb-4 rounded-2xl bg-gold/10 flex items-center justify-center">
            <svg class="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 class="text-xl font-display font-bold text-charcoal mb-3 text-center">即将进入逻辑推理挑战</h3>
          <div class="text-sm text-text-secondary leading-relaxed mb-6 space-y-2">
            <p>接下来是 <span class="font-bold text-charcoal">10 道客观推理题</span>，请注意以下规则：</p>
            <ul class="space-y-1.5 text-text-secondary">
              <li class="flex items-start gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 shrink-0" />
                <span>每题限时 <span class="font-bold text-coral">20 秒</span>，超时自动跳过</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-[#82B1FF] mt-1.5 shrink-0" />
                <span>选择后自动跳转下一题，不可返回修改</span>
              </li>
            </ul>
          </div>
          <div class="flex gap-3">
            <button
              @click="cancelObjectiveIntro"
              class="flex-1 px-4 py-3 text-sm font-medium text-text-secondary border border-border rounded-xl hover:bg-surface-alt transition-all duration-300"
            >
              返回上一题
            </button>
            <button
              @click="confirmObjectiveIntro"
              class="flex-1 px-4 py-3 text-sm font-semibold bg-gold text-white rounded-xl hover:brightness-110 transition-all duration-300"
            >
              准备好了
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Submit Confirm Modal -->
    <Transition name="modal">
      <div v-if="showSubmitConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-5">
        <div class="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" @click="showSubmitConfirm = false" />
        <div class="relative bg-cream rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in">
          <h3 class="text-xl font-display font-bold text-charcoal mb-3">确认提交？</h3>
          <p class="text-text-secondary mb-2">
            你已完成 <span class="font-bold text-charcoal">{{ progress }}</span> / {{ totalQuestions }} 道题。
          </p>
          <p v-if="progress < totalQuestions" class="text-sm text-coral mb-6">
            还有 {{ totalQuestions - progress }} 道题未作答，提交后将无法修改。
          </p>
          <div class="flex gap-3">
            <button
              @click="showSubmitConfirm = false"
              class="flex-1 px-4 py-3 text-sm font-medium text-text-secondary border border-border rounded-xl hover:bg-surface-alt transition-all duration-300"
            >
              继续答题
            </button>
            <button
              @click="submitTest"
              class="flex-1 px-4 py-3 text-sm font-semibold bg-coral text-white rounded-xl hover:bg-clay transition-all duration-300"
            >
              确认提交
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.question-enter-active,
.question-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.question-enter-from {
  opacity: 0;
  transform: translateX(40px);
}
.question-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
