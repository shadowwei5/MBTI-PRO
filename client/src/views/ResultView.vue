<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import DimensionSpectrum from '../components/DimensionSpectrum.vue'
import TypeAvatar from '../components/TypeAvatar.vue'
import SharePoster from '../components/SharePoster.vue'
import PaywallSection from '../components/PaywallSection.vue'
import { api, type PersonalityType } from '../services/api'
import { getTypeColor, getTemperament, TEMPERAMENT_COLORS, getNineGroupCode, getNineGroupColor } from '../utils/colors'
import { useShareMeta } from '../composables/useShareMeta'

const route = useRoute()

const typeCode = computed(() => route.params.type as string)
const scores = ref({ E_I: 0, S_N: 0, T_F: 0, P_J: 0 })
const chars = ref({ E_I: '', S_N: '', T_F: '', P_J: '' })
const dimTotals = ref({ E_I: 0, S_N: 0, T_F: 0, P_J: 0 })
const dimAnswered = ref({ E_I: 0, S_N: 0, T_F: 0, P_J: 0 })
const isLoaded = ref(false)
const typeData = ref<PersonalityType | null>(null)
const fetchError = ref('')
const showSharePoster = ref(false)
const imageLoaded = ref(false)

// 是否来自真实测试（有分数数据）
const hasTestData = computed(() => !!route.query.scores)

onMounted(async () => {
  try {
    if (route.query.scores) scores.value = JSON.parse(route.query.scores as string)
    if (route.query.chars) chars.value = JSON.parse(route.query.chars as string)
    if (route.query.dimTotals) dimTotals.value = JSON.parse(route.query.dimTotals as string)
    if (route.query.dimAnswered) dimAnswered.value = JSON.parse(route.query.dimAnswered as string)
  } catch { /* use defaults */ }

  if (typeCode.value.length === 4) {
    chars.value = {
      E_I: typeCode.value[0],
      S_N: typeCode.value[1],
      T_F: typeCode.value[2],
      P_J: typeCode.value[3],
    }
  }

  try {
    typeData.value = await api.getResult(typeCode.value)
  } catch {
    fetchError.value = 'typeData'
  }

  setTimeout(() => { isLoaded.value = true }, 200)

  // 注入 JSON-LD 结构化数据
  injectJsonLd()
})

// Dimension display data
const dimensionLabels: Record<string, { label: string; left: string; mid: string; right: string; color: string }> = {
  E_I: { label: '能量来源', left: 'I 内向型', mid: 'A 平衡型', right: 'E 外向型', color: '#82B1FF' },
  S_N: { label: '认知方式', left: 'N 直觉型', mid: 'B 均衡型', right: 'S 实感型', color: '#B388FF' },
  T_F: { label: '决策方式', left: 'F 情感型', mid: 'C 复合型', right: 'T 思考型', color: '#40C4FF' },
  P_J: { label: '生活态度', left: 'P 感知型', mid: 'D 动态型', right: 'J 判断型', color: '#FFD740' },
}

const typeName = computed(() => {
  return `${chars.value.E_I === 'A' ? '平衡型' : chars.value.E_I === 'E' ? '外向型' : '内向型'} ·
    ${chars.value.S_N === 'B' ? '均衡型' : chars.value.S_N === 'N' ? '直觉型' : '实感型'} ·
    ${chars.value.T_F === 'C' ? '复合型' : chars.value.T_F === 'T' ? '思考型' : '情感型'} ·
    ${chars.value.P_J === 'D' ? '动态型' : chars.value.P_J === 'J' ? '判断型' : '感知型'}`
})

const isTraditional = computed(() => {
  return !['A', 'B', 'C', 'D'].some(c => typeCode.value.includes(c))
})

// 9组颜色分类
const typeColor = computed(() => getTypeColor(typeCode.value))
const groupCode = computed(() => getNineGroupCode(typeCode.value))
const groupColor = computed(() => getNineGroupColor(groupCode.value))
const temperament = computed(() => getTemperament(typeCode.value))
const temperamentColor = computed(() => temperament.value ? TEMPERAMENT_COLORS[temperament.value] : null)

// 维度别称（用于日常描述）
const dimNicknames: Record<string, Record<string, string>> = {
  E_I: { E: '社交达人', A: '灵活切换者', I: '安静的思想家' },
  S_N: { N: '未来梦想家', B: '务实幻想家', S: '脚踏实地者' },
  T_F: { T: '逻辑分析派', C: '理性共情者', F: '温暖感受派' },
  P_J: { J: '计划执行者', D: '弹性规划者', P: '随性探索者' },
}

const nicknames = computed(() => ({
  E_I: dimNicknames.E_I[chars.value.E_I] || '',
  S_N: dimNicknames.S_N[chars.value.S_N] || '',
  T_F: dimNicknames.T_F[chars.value.T_F] || '',
  P_J: dimNicknames.P_J[chars.value.P_J] || '',
}))

// 一句话描述（用于分享海报）
const oneLiner = computed(() => {
  if (typeData.value?.overview) {
    const firstSentence = typeData.value.overview.split(/[。.！!？?\n]/)[0]
    if (firstSentence && firstSentence.length > 4) return firstSentence
  }
  return `${groupColor.value.name} · ${typeName.value}`
})

// 动态更新分享元标签 + SEO
useShareMeta(
  () => `${typeCode.value} ${typeData.value?.name || typeName.value}`,
  () => oneLiner.value,
  () => typeData.value?.imageUrl || `/api/images/${typeCode.value}`,
  () => typeCode.value,
)

// JSON-LD 结构化数据（搜索引擎富文本卡片）
let jsonLdScript: HTMLScriptElement | null = null
function injectJsonLd() {
  const code = typeCode.value
  const name = typeData.value?.name || typeName.value
  const desc = oneLiner.value
  const img = typeData.value?.imageUrl || `/api/images/${code}`
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${code} — ${name.replace('型', '')} | MBTI-PRO`,
    description: desc,
    image: img,
    url: `${window.location.origin}/result/${code}`,
    about: {
      '@type': 'Thing',
      name: `${code} 人格类型`,
      description: `${code} 是 MBTI-PRO 81型人格体系中的一种独特类型，在能量来源、认知方式、决策方式和生活态度四个维度上展现出独特的偏好组合。`,
    },
  }
  jsonLdScript = document.createElement('script')
  jsonLdScript.type = 'application/ld+json'
  jsonLdScript.textContent = JSON.stringify(ld)
  document.head.appendChild(jsonLdScript)
}
onUnmounted(() => { jsonLdScript?.remove() })

// Fallback defaults
const defaultItems = {
  strengths: [
    '在多个维度上保持平衡，具备出色的情境适应能力',
    '能够从多角度看待问题，不局限于单一思维模式',
    '在不同社交和工作环境下都能找到适合自己的节奏',
  ],
  growthAreas: [
    '偶尔可能因选择过多而感到犹豫不决',
    '在需要坚定立场时，需要有意识地做出明确选择',
    '建议定期进行自我反思，明确自己的核心需求',
  ],
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Loading -->
    <div v-if="!isLoaded" class="min-h-screen flex items-center justify-center">
      <div class="w-10 h-10 rounded-full border-4 border-coral-soft border-t-coral animate-spin" />
    </div>

    <!-- Result content -->
    <div v-else class="max-w-2xl mx-auto px-5 py-12 md:py-20">
      <div class="stagger">
        <!-- ====== 免费区域：图片 + 名称 + 四维状态条 + 分享海报 ====== -->

        <!-- Type Badge -->
        <div class="text-center mb-10">
          <!-- Badges row -->
          <div class="flex flex-wrap items-center justify-center gap-2 mb-6">
            <!-- 四色系标记 -->
            <div
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
              :style="{ background: typeColor.hex + '18', color: typeColor.hex, borderColor: typeColor.hex + '40' }"
            >
              <span class="w-1.5 h-1.5 rounded-full" :style="{ background: typeColor.hex }" />
              {{ groupColor.name }}
            </div>
            <!-- 传统四气质徽章（纯端值16型） -->
            <div
              v-if="temperamentColor"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
              :style="{ background: temperamentColor.hex + '18', color: temperamentColor.text, borderColor: temperamentColor.hex + '40' }"
            >
              <span class="w-1.5 h-1.5 rounded-full" :style="{ background: temperamentColor.hex }" />
              {{ temperamentColor.name }} · {{ temperament }}
            </div>
            <!-- 81型独有 -->
            <div
              v-if="!isTraditional"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-coral/10 text-coral border border-coral/30"
            >
              MBTI PRO 独有
            </div>
          </div>

          <!-- Geometric Avatar -->
          <div class="mb-6 flex justify-center">
            <TypeAvatar :type-code="typeCode" :size="96" />
          </div>

          <!-- AI-Generated Personality Image -->
          <div class="mb-8 flex justify-center">
            <div class="relative w-56 h-56 sm:w-72 sm:h-72 md:w-96 md:h-96 rounded-3xl overflow-hidden shadow-xl border-2 border-border/20 bg-surface-alt/30">
              <img
                :src="`/api/mediums/${typeCode}`"
                :alt="`${typeCode} 人格类型画像`"
                class="w-full h-full object-cover object-center transition-opacity duration-700"
                :class="{ 'opacity-0': !imageLoaded }"
                loading="eager"
                @load="imageLoaded = true"
                @error="imageLoaded = true; ($event.target as HTMLImageElement).style.display = 'none'"
              />
              <div v-if="!imageLoaded" class="absolute inset-0 flex items-center justify-center bg-surface-alt/30">
                <div class="w-8 h-8 rounded-full border-3 border-coral-soft border-t-coral animate-spin" />
              </div>
            </div>
          </div>

          <!-- Type Code -->
          <div
            class="relative inline-block mb-4 px-8 py-4 rounded-3xl"
            :style="{ background: `linear-gradient(135deg, ${typeColor.hex}12, ${typeColor.hex}08)` }"
          >
            <h1 class="text-5xl md:text-7xl font-display font-black tracking-widest">
              <span
                v-for="(ch, i) in typeCode.split('')"
                :key="i"
                class="pop-char inline-block"
                :style="{ color: typeColor.hex, animationDelay: `${0.3 + i * 0.1}s` }"
              >{{ ch }}</span>
            </h1>
          </div>
          <p v-if="typeData?.name" class="text-xl md:text-2xl font-display font-bold text-charcoal mb-3">
            {{ typeData.name.replace('型', '') }}
          </p>
          <p class="text-lg text-text-secondary leading-relaxed max-w-md mx-auto">
            {{ typeName }}
          </p>
        </div>

        <!-- Dimension Spectrum (仅测试后显示) -->
        <div v-if="hasTestData" class="bg-white/70 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-border shadow-sm mb-8">
          <h2 class="text-sm font-semibold text-text-muted uppercase tracking-widest mb-6 text-center">
            四维度分析
            <span
              class="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium align-middle"
              :style="{ background: typeColor.hex + '18', color: typeColor.hex }"
            >
              <span class="w-1.5 h-1.5 rounded-full" :style="{ background: typeColor.hex }" />
              {{ groupColor.name }}
            </span>
          </h2>
          <DimensionSpectrum
            :typeCode="typeCode"
            :typeName="typeName"
            :scores="scores"
            :chars="chars"
            :dimTotals="dimTotals"
            :dimAnswered="dimAnswered"
          />
        </div>

        <!-- ====== 🔒 付费解锁：所有文字内容 ====== -->
        <PaywallSection
          v-if="typeData"
          :type-code="typeData.code"
          :type-name="typeData.name"
          :type-color="typeColor.hex"
        >
          <div class="deep-content space-y-6 mt-2">

            <!-- 人格概览 -->
            <div class="bg-white/70 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-border shadow-sm">
              <h2 class="text-lg font-display font-bold text-charcoal mb-4">人格概览</h2>
              <div v-if="typeData" class="text-text-secondary leading-relaxed whitespace-pre-line">
                {{ typeData.overview }}
              </div>
              <p v-else class="text-text-secondary leading-relaxed">
                {{ typeCode }} 型人格{{ isTraditional ? '属于经典的MBTI 16型之一。' : '是MBTI PRO 81型分类体系中的独特类型。' }}
                你在四个核心维度上展现出独特的偏好组合。
              </p>
            </div>

            <!-- 四维度日常画像 -->
            <div class="bg-white/70 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-border shadow-sm">
              <h2 class="text-lg font-display font-bold text-charcoal mb-5">你的日常画像</h2>
              <div class="grid md:grid-cols-2 gap-4">
                <div
                  v-for="dim in [
                    { key: 'E_I', icon: 'energy', label: '能量来源', dLabel: dimensionLabels.E_I, accent: '#82B1FF' },
                    { key: 'S_N', icon: 'cognition', label: '认知方式', dLabel: dimensionLabels.S_N, accent: '#B388FF' },
                    { key: 'T_F', icon: 'decision', label: '决策方式', dLabel: dimensionLabels.T_F, accent: '#40C4FF' },
                    { key: 'P_J', icon: 'lifestyle', label: '生活态度', dLabel: dimensionLabels.P_J, accent: '#FFD740' },
                  ]"
                  :key="dim.key"
                  class="flex items-start gap-4 p-4 rounded-2xl bg-surface-alt/50 group hover:bg-surface-alt/80 transition-colors duration-300"
                >
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :style="{ background: dim.accent + '18' }">
                    <svg v-if="dim.icon === 'energy'" class="w-5 h-5" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="2.5" :stroke="dim.accent" stroke-width="1.8" />
                      <circle cx="10" cy="10" r="6.5" :stroke="dim.accent" stroke-width="1.2" opacity="0.5" />
                    </svg>
                    <svg v-if="dim.icon === 'cognition'" class="w-5 h-5" viewBox="0 0 20 20" fill="none">
                      <path d="M10 2L17.5 6.5V15.5L10 20L2.5 15.5V6.5L10 2Z" :stroke="dim.accent" stroke-width="1.5" stroke-linejoin="round" />
                      <circle cx="10" cy="11" r="3" :stroke="dim.accent" stroke-width="1.2" opacity="0.5" />
                    </svg>
                    <svg v-if="dim.icon === 'decision'" class="w-5 h-5" viewBox="0 0 20 20" fill="none">
                      <path d="M10 3v14M5 8l-3 2 3 2M15 8l3 2-3 2" :stroke="dim.accent" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                      <circle cx="10" cy="8" r="1.5" :fill="dim.accent" opacity="0.3" />
                    </svg>
                    <svg v-if="dim.icon === 'lifestyle'" class="w-5 h-5" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="7.5" :stroke="dim.accent" stroke-width="1.5" />
                      <path d="M10 2.5v15M2.5 10h15" :stroke="dim.accent" stroke-width="1" opacity="0.4" />
                      <circle cx="10" cy="10" r="2" :stroke="dim.accent" stroke-width="1.5" />
                      <path d="M10 4l2 6-2 6" :stroke="dim.accent" stroke-width="1.2" opacity="0.6" />
                    </svg>
                  </div>
                  <div>
                    <p class="text-xs text-text-muted mb-0.5">{{ dim.label }}</p>
                    <p class="text-sm font-semibold text-charcoal">
                      {{ dim.dLabel[['A','B','C','D'].includes(chars[dim.key]) ? 'mid' : ['E','S','T','J'].includes(chars[dim.key]) ? 'right' : 'left'] }}
                    </p>
                    <p class="text-xs text-text-secondary mt-0.5">{{ nicknames[dim.key] }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Celebrities (仅有人物数据时显示) -->
            <div v-if="typeData?.celebrities?.length" class="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-sage/30 shadow-sm">
              <h3 class="text-sm font-semibold text-sage uppercase tracking-widest mb-3 flex items-center gap-2">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                代表人物
              </h3>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="(name, i) in typeData.celebrities"
                  :key="i"
                  class="px-3 py-1 rounded-full text-sm bg-surface-alt text-text-secondary border border-border"
                >{{ name }}</span>
              </div>
            </div>

            <!-- Strengths & Growth -->
            <div class="grid md:grid-cols-2 gap-6">
              <div class="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-sage/30 shadow-sm">
                <h3 class="text-sm font-semibold text-sage uppercase tracking-widest mb-3 flex items-center gap-2">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                  核心优势
                </h3>
                <ul class="space-y-2 text-sm text-text-secondary">
                  <li v-for="(s, i) in (typeData?.strengths ?? defaultItems.strengths)" :key="i" class="flex items-start gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-sage mt-1.5 shrink-0" />
                    {{ s }}
                  </li>
                </ul>
              </div>
              <div class="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-coral-soft/30 shadow-sm">
                <h3 class="text-sm font-semibold text-coral uppercase tracking-widest mb-3 flex items-center gap-2">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                  成长空间
                </h3>
                <ul class="space-y-2 text-sm text-text-secondary">
                  <li v-for="(g, i) in (typeData?.growthAreas ?? defaultItems.growthAreas)" :key="i" class="flex items-start gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-coral mt-1.5 shrink-0" />
                    {{ g }}
                  </li>
                </ul>
              </div>
            </div>

            <!-- 四维深度解析 -->
            <div v-if="typeData.eiModule || typeData.snModule || typeData.tfModule || typeData.pjModule" class="bg-white/70 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-border shadow-sm">
              <h2 class="text-lg font-display font-bold text-charcoal mb-5">四维深度解析</h2>
              <div class="space-y-4">
                <div v-if="typeData.eiModule" class="text-text-secondary text-sm leading-relaxed">
                  <strong class="text-charcoal">能量来源：</strong>{{ typeData.eiModule }}
                </div>
                <div v-if="typeData.snModule" class="text-text-secondary text-sm leading-relaxed">
                  <strong class="text-charcoal">认知方式：</strong>{{ typeData.snModule }}
                </div>
                <div v-if="typeData.tfModule" class="text-text-secondary text-sm leading-relaxed">
                  <strong class="text-charcoal">决策方式：</strong>{{ typeData.tfModule }}
                </div>
                <div v-if="typeData.pjModule" class="text-text-secondary text-sm leading-relaxed">
                  <strong class="text-charcoal">生活态度：</strong>{{ typeData.pjModule }}
                </div>
              </div>
            </div>

          </div>
        </PaywallSection>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <button
            @click="$router.push('/')"
            class="px-8 py-4 min-h-[52px] bg-charcoal text-cream font-semibold rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
          >
            {{ hasTestData ? '重新测试' : '开始测试' }}
          </button>
          <button
            v-if="hasTestData"
            @click="showSharePoster = true"
            class="px-8 py-4 min-h-[52px] bg-coral text-white font-semibold rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
          >
            分享结果
          </button>
          <button
            v-else
            @click="$router.push('/')"
            class="px-8 py-4 min-h-[52px] bg-coral text-white font-semibold rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
          >
            返回首页
          </button>
        </div>

        <!-- Disclaimer -->
        <p class="text-center text-xs text-text-muted mt-8">
          测试结果仅供个人参考，不构成任何临床诊断或招聘决策依据。<br />
          人格具有可塑性，建议每 6-12 个月重新测试。
        </p>
      </div>
    </div>

    <!-- Share Poster Modal -->
    <SharePoster
      v-if="showSharePoster"
      :typeCode="typeCode"
      :typeName="typeData?.name || typeName"
      :typeColor="typeColor"
      :groupColor="groupColor"
      :oneLiner="oneLiner"
      :imageUrl="typeData?.imageUrl || `/api/images/${typeCode}`"
      :scores="hasTestData ? scores : undefined"
      :chars="hasTestData ? chars : undefined"
      @close="showSharePoster = false"
    />
  </div>
</template>
