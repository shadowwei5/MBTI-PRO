<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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
const showConfirm = ref(false)
const startTime = ref(Date.now())

// Fetch questions from API & restore saved progress
async function fetchQuestions() {
  loading.value = true
  loadError.value = ''

  // Check localStorage for saved test session
  const saved = localStorage.getItem('mbti-pro-test')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.questions && parsed.questions.length > 0) {
        questions.value = parsed.questions
        answers.value = parsed.answers || {}
        currentIndex.value = parsed.currentIndex || 0
        loading.value = false
        return
      }
    } catch { /* ignore */ }
  }

  // Fresh test: fetch all questions, randomly select 20 objective
  try {
    const data = await api.getQuestions()
    const parsed = data.map(q => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string),
    }))
    const likert = parsed.filter(q => q.type === 'likert')
    const objective = parsed.filter(q => q.type === 'objective')
    // Randomly select 10 objective questions
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

// Save progress (includes question list for persistence)
watch([answers, currentIndex], () => {
  localStorage.setItem('mbti-pro-test', JSON.stringify({
    questions: questions.value,
    answers: answers.value,
    currentIndex: currentIndex.value,
  }))
}, { deep: true })

const currentQuestion = computed(() => questions.value[currentIndex.value])
const progress = computed(() => Object.keys(answers.value).length)
const totalQuestions = computed(() => questions.value.length)
const canGoNext = computed(() => !!answers.value[currentQuestion.value?.id])
const isLastQuestion = computed(() => currentIndex.value >= questions.value.length - 1)

let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null

function selectOption(key: string) {
  answers.value[currentQuestion.value.id] = key
  // Clear any pending auto-advance from a previous selection
  if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer)
  autoAdvanceTimer = setTimeout(() => {
    goNext()
  }, 150)
}

function goNext() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
  if (isLastQuestion.value) {
    showConfirm.value = true
    return
  }
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
  }
}

function goPrev() {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

function submitTest() {
  showConfirm.value = false
  localStorage.removeItem('mbti-pro-test')

  // Calculate score (simplified demo logic)
  const scores = { E_I: 0, S_N: 0, T_F_obj: 0, T_F_sub: 0, P_J: 0 }
  questions.value.forEach(q => {
    const answer = answers.value[q.id]
    if (!answer) return
    if (q.type === 'objective') {
      if (answer === q.correctAnswer) scores.T_F_obj += 2
    } else {
      const valMap: Record<string, number> = { A: 2, B: 1, C: 0, D: -1, E: -2 }
      const val = valMap[answer] || 0
      if (q.dimension === 'T_F') {
        scores.T_F_sub += val
      } else {
        scores[q.dimension as keyof typeof scores] += val
      }
    }
  })

  // Merge T_F
  const T_F_total = scores.T_F_sub + scores.T_F_obj

  // Classify
  function classify(score: number, dim: string): string {
    if (dim === 'T_F') {
      if (score > 19) return 'T'
      if (score < 0) return 'F'
      return 'C'
    }
    if (score > 16) {
      if (dim === 'E_I') return 'E'
      if (dim === 'S_N') return 'S'
      return 'J'
    }
    if (score < -17) {
      if (dim === 'E_I') return 'I'
      if (dim === 'S_N') return 'N'
      return 'P'
    }
    if (dim === 'E_I') return 'A'
    if (dim === 'S_N') return 'B'
    return 'D'
  }

  const chars = {
    E_I: classify(scores.E_I, 'E_I'),
    S_N: classify(scores.S_N, 'S_N'),
    T_F: classify(T_F_total, 'T_F'),
    P_J: classify(scores.P_J, 'P_J'),
  }

  const typeCode = chars.E_I + chars.S_N + chars.T_F + chars.P_J

  // Save record (fire-and-forget, non-blocking)
  api.saveRecord({
    typeCode,
    scores: { ...scores, T_F: T_F_total },
    chars,
    answers: { ...answers.value },
    duration: Math.round((Date.now() - startTime.value) / 1000),
  }).catch(() => { /* non-critical */ })

  // Count answered questions per dimension
  const dimAnswered = { E_I: 0, S_N: 0, T_F: 0, P_J: 0 }
  const dimTotals = { E_I: 0, S_N: 0, T_F: 0, P_J: 0 }
  questions.value.forEach(q => {
    if (q.dimension in dimTotals) {
      dimTotals[q.dimension as keyof typeof dimTotals]++
      if (answers.value[q.id]) dimAnswered[q.dimension as keyof typeof dimAnswered]++
    }
  })

  // Navigate to result
  router.push({
    name: 'result',
    params: { type: typeCode },
    query: {
      scores: JSON.stringify({ ...scores, T_F: T_F_total }),
      chars: JSON.stringify(chars),
      dimTotals: JSON.stringify(dimTotals),
      dimAnswered: JSON.stringify(dimAnswered),
    },
  })
}

function jumpTo(index: number) {
  if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null }
  if (index >= 0 && index <= questions.value.length - 1) {
    currentIndex.value = index
  }
}

// Keyboard navigation
function onKeydown(e: KeyboardEvent) {
  if (showConfirm.value) return
  const q = currentQuestion.value
  if (!q) return

  if (e.key >= '1' && e.key <= String(q.options.length)) {
    selectOption(q.options[Number(e.key) - 1].key)
  }
  if (e.key === 'ArrowRight' || e.key === 'Enter') {
    if (canGoNext.value) goNext()
  }
  if (e.key === 'ArrowLeft') goPrev()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

// Cleanup listener on unmount (Vue auto-handles via onUnmounted)
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
          <!-- Question type badge -->
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
          :disabled="currentIndex === 0"
          class="px-5 py-2.5 text-sm font-medium text-text-secondary rounded-xl transition-all duration-300 hover:bg-surface-alt disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← 上一题
        </button>

        <!-- Dot indicators -->
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
          class="px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 bg-charcoal text-cream hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
        >
          {{ isLastQuestion ? '提交结果' : '下一题 →' }}
        </button>
      </div>
    </footer>

    <!-- Submit Confirm Modal -->
    <Transition name="modal">
      <div v-if="showConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-5">
        <div class="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" @click="showConfirm = false" />
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
              @click="showConfirm = false"
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
