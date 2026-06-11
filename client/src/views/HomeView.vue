<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, type PersonalityType } from '../services/api'
import { getTypeColor, getTypeHex, getTypeColorFamily, getTemperamentColor } from '../utils/colors'
import TypeAvatar from '../components/TypeAvatar.vue'

const router = useRouter()
const loaded = ref(false)
const allTypes = ref<Pick<PersonalityType, 'code' | 'name' | 'isTraditional' | 'population' | 'celebrities'>[]>([])
const fetchError = ref(false)

// 9 groups: EN, EB, ES, AN, AB, AS, IN, IB, IS
const NINE_GROUPS = [
  { prefix: 'EN', label: '暖紫组', desc: '外向直觉 · 远见传播型' },
  { prefix: 'EB', label: '珊瑚组', desc: '外向均衡 · 活跃多面型' },
  { prefix: 'ES', label: '琥珀组', desc: '外向实感 · 行动实践型' },
  { prefix: 'AN', label: '薰紫组', desc: '平衡直觉 · 独立洞察型' },
  { prefix: 'AB', label: '青灰组', desc: '平衡均衡 · 全面适应型' },
  { prefix: 'AS', label: '鼠尾草组', desc: '平衡实感 · 稳健实践型' },
  { prefix: 'IN', label: '靛蓝组', desc: '内向直觉 · 深度思想型' },
  { prefix: 'IB', label: '钢蓝组', desc: '内向均衡 · 内省务实型' },
  { prefix: 'IS', label: '深青组', desc: '内向实感 · 专注务实型' },
]

// Group types by their first 2 letters (E_I × S_N)
const groupedTypes = computed(() => {
  const groups: Record<string, typeof allTypes.value> = {}
  for (const t of allTypes.value) {
    const prefix = t.code.slice(0, 2)
    if (!groups[prefix]) groups[prefix] = []
    groups[prefix].push(t)
  }
  return groups
})

// 计算每组的主色调（该组内出现最多的气质色系）
function getDominantFamily(types: typeof allTypes.value): 'purple' | 'green' | 'blue' | 'gold' {
  const count: Record<string, number> = { purple: 0, green: 0, blue: 0, gold: 0 }
  for (const t of types) {
    count[getTypeColorFamily(t.code)]++
  }
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0][0] as 'purple' | 'green' | 'blue' | 'gold'
}

// 气质色系对应的图标色
const familyBorderColors: Record<string, string> = {
  purple: '#8869A5',
  green: '#33A474',
  blue: '#4298B4',
  gold: '#E4AE3A',
}

onMounted(async () => {
  setTimeout(() => { loaded.value = true }, 100)
  try {
    allTypes.value = await api.getAllTypes()
  } catch {
    fetchError.value = true
  }
})

function startTest() {
  router.push('/test')
}

function goToType(code: string) {
  router.push({ name: 'result', params: { type: code } })
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Hero Section -->
    <main class="flex-1 flex flex-col items-center justify-center px-5 py-16 md:py-24">
      <div class="w-full max-w-2xl mx-auto text-center stagger">
        <!-- Brand Badge -->
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-alt border border-border mb-8">
          <span class="w-2 h-2 rounded-full bg-coral animate-breathe" />
          <span class="text-sm text-warm-gray font-medium tracking-wide">
            全新 81 型人格分类体系
          </span>
        </div>

        <!-- Hero Headline -->
        <h1 class="text-4xl md:text-6xl lg:text-7xl font-display font-black text-charcoal leading-[1.08] mb-6 tracking-tight">
          发现<span class="text-coral italic">真实的</span><br />自己
        </h1>

        <!-- Subheadline -->
        <p class="text-lg md:text-xl text-text-secondary leading-relaxed max-w-lg mx-auto mb-10">
          基于荣格心理类型学，突破传统二分法局限。<br />
          <span class="text-charcoal font-medium">81 型人格</span>精细分类，比传统 MBTI 精准
          <span class="text-coral font-bold">5 倍</span>。
        </p>

        <!-- CTA Button -->
        <button
          @click="startTest"
          class="group relative inline-flex items-center gap-3 px-10 py-5 bg-charcoal text-cream text-lg font-semibold rounded-2xl transition-all duration-500 hover:shadow-2xl hover:shadow-coral/20 hover:-translate-y-0.5 active:translate-y-0"
        >
          <span>开始免费测试</span>
          <svg class="w-5 h-5 transition-transform duration-500 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        <!-- Meta info -->
        <div class="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-text-muted">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>100 道精选题目</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10" /><path stroke-linecap="round" d="M12 6v6l4 2" /></svg>
            <span>20-30 分钟</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <span>无需注册</span>
          </div>
        </div>

        <!-- Decorative blob shapes -->
        <div class="relative mt-12 hidden md:block" aria-hidden="true">
          <div class="absolute -top-8 left-1/4 w-16 h-16 rounded-full bg-coral-soft/30 blur-xl animate-breathe" style="animation-delay: 0s;" />
          <div class="absolute top-0 right-1/4 w-12 h-12 rounded-full bg-sage-soft/30 blur-xl animate-breathe" style="animation-delay: 1s;" />
          <div class="absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-gold/20 blur-xl animate-breathe" style="animation-delay: 2s;" />
        </div>
      </div>
    </main>

    <!-- What is MBTI -->
    <section class="py-16 md:py-24 border-t border-border/50">
      <div class="max-w-4xl mx-auto px-5">
        <div class="text-center mb-12">
          <h2 class="text-2xl md:text-3xl font-display font-bold text-charcoal mb-4">什么是 MBTI？</h2>
          <p class="text-text-secondary max-w-2xl mx-auto leading-relaxed">
            MBTI（Myers-Briggs Type Indicator）是目前全球最广泛应用的人格分类工具之一，每年超过200万人使用。
            它基于瑞士心理学家卡尔·荣格的心理类型理论，由伊莎贝尔·迈尔斯和凯瑟琳·布里格斯母女于二战期间发展完善。
          </p>
        </div>

        <!-- 4 Dimensions Intro -->
        <div class="grid md:grid-cols-2 gap-6">
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-border/50 shadow-sm">
            <div class="flex items-center gap-3 mb-3">
              <span class="w-8 h-8 rounded-lg bg-[#82B1FF]/15 flex items-center justify-center text-sm font-bold text-[#5C8DFF]">E/I</span>
              <h3 class="font-semibold text-charcoal">能量来源：外向 vs 内向</h3>
            </div>
            <p class="text-sm text-text-secondary leading-relaxed">你从哪里获取能量？外向型（E）从人际交往和外部活动中获得动力；内向型（I）则通过独处和内省恢复精力。</p>
          </div>
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-border/50 shadow-sm">
            <div class="flex items-center gap-3 mb-3">
              <span class="w-8 h-8 rounded-lg bg-[#B388FF]/15 flex items-center justify-center text-sm font-bold text-[#9C6FFF]">S/N</span>
              <h3 class="font-semibold text-charcoal">认知方式：实感 vs 直觉</h3>
            </div>
            <p class="text-sm text-text-secondary leading-relaxed">你如何获取和处理信息？实感型（S）信赖具体事实和亲身经验；直觉型（N）关注抽象模式和未来可能性。</p>
          </div>
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-border/50 shadow-sm">
            <div class="flex items-center gap-3 mb-3">
              <span class="w-8 h-8 rounded-lg bg-[#40C4FF]/15 flex items-center justify-center text-sm font-bold text-[#1DA8FF]">T/F</span>
              <h3 class="font-semibold text-charcoal">决策方式：思考 vs 情感</h3>
            </div>
            <p class="text-sm text-text-secondary leading-relaxed">你做决定的主要依据是什么？思考型（T）优先考虑逻辑和客观分析；情感型（F）更重视价值观和人际和谐。</p>
          </div>
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-border/50 shadow-sm">
            <div class="flex items-center gap-3 mb-3">
              <span class="w-8 h-8 rounded-lg bg-[#FFD740]/15 flex items-center justify-center text-sm font-bold text-[#E6B800]">J/P</span>
              <h3 class="font-semibold text-charcoal">生活态度：判断 vs 感知</h3>
            </div>
            <p class="text-sm text-text-secondary leading-relaxed">你喜欢怎样的生活方式？判断型（J）偏好有计划和条理的生活；感知型（P）享受灵活开放、随性而为的节奏。</p>
          </div>
        </div>

        <p class="text-center text-sm text-text-muted mt-8 max-w-2xl mx-auto leading-relaxed">
          以上四个维度各取一个偏好字母，组合成 4 个字母的人格类型代码——这就是传统 MBTI 的 16 型人格分类逻辑。
        </p>
      </div>
    </section>

    <!-- MBTI-PRO Advantages -->
    <section class="py-16 md:py-24 bg-surface-alt/50 border-t border-border/50">
      <div class="max-w-4xl mx-auto px-5">
        <div class="text-center mb-12">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-coral/10 border border-coral/20 mb-6">
            <span class="text-sm text-coral font-semibold tracking-wide">MBTI-PRO 优势</span>
          </div>
          <h2 class="text-2xl md:text-3xl font-display font-bold text-charcoal mb-4">为什么选择 MBTI-PRO？</h2>
          <p class="text-text-secondary max-w-2xl mx-auto leading-relaxed">
            传统 MBTI 用二分法将人简单分为两类（如：你要么是外向 E，要么是内向 I），但真实的人格分布并非如此绝对。
            MBTI-PRO 在每个维度增加了<strong>中间型</strong>，让分类更贴近真实的你。
          </p>
        </div>

        <!-- Comparison Table -->
        <div class="bg-white/70 backdrop-blur-sm rounded-3xl border border-border shadow-sm overflow-hidden mb-8">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left px-6 py-4 font-semibold text-charcoal w-1/4">对比维度</th>
                <th class="text-left px-6 py-4 font-semibold text-text-muted w-3/8 border-l border-border/50">传统 MBTI</th>
                <th class="text-left px-6 py-4 font-semibold text-coral w-3/8 border-l border-border/50">MBTI-PRO</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/50">
              <tr>
                <td class="px-6 py-4 font-medium text-charcoal">类型数量</td>
                <td class="px-6 py-4 text-text-secondary border-l border-border/50">16 型（4×2）</td>
                <td class="px-6 py-4 text-coral font-medium border-l border-border/50">81 型（4×3）</td>
              </tr>
              <tr>
                <td class="px-6 py-4 font-medium text-charcoal">分类方式</td>
                <td class="px-6 py-4 text-text-secondary border-l border-border/50">非此即彼的二分法</td>
                <td class="px-6 py-4 text-coral font-medium border-l border-border/50">三分法：包含中间均衡型</td>
              </tr>
              <tr>
                <td class="px-6 py-4 font-medium text-charcoal">中间状态</td>
                <td class="px-6 py-4 text-text-secondary border-l border-border/50">无法识别，强制选边</td>
                <td class="px-6 py-4 text-coral font-medium border-l border-border/50">A/B/C/D 四种中间态精确识别</td>
              </tr>
              <tr>
                <td class="px-6 py-4 font-medium text-charcoal">精度提升</td>
                <td class="px-6 py-4 text-text-secondary border-l border-border/50">—</td>
                <td class="px-6 py-4 text-coral font-medium border-l border-border/50">5 倍于传统 MBTI 的精细度</td>
              </tr>
              <tr>
                <td class="px-6 py-4 font-medium text-charcoal">测评方法</td>
                <td class="px-6 py-4 text-text-secondary border-l border-border/50">纯主观自评量表</td>
                <td class="px-6 py-4 text-coral font-medium border-l border-border/50">自评量表 + 客观逻辑推理题</td>
              </tr>
              <tr>
                <td class="px-6 py-4 font-medium text-charcoal">题目数量</td>
                <td class="px-6 py-4 text-text-secondary border-l border-border/50">通常 60-93 题</td>
                <td class="px-6 py-4 text-coral font-medium border-l border-border/50">100 题（含 20 道客观推理）</td>
              </tr>
              <tr>
                <td class="px-6 py-4 font-medium text-charcoal">题目设计</td>
                <td class="px-6 py-4 text-text-secondary border-l border-border/50">单极量表，某端表述更"正面"</td>
                <td class="px-6 py-4 text-coral font-medium border-l border-border/50">双极正面描述，两端同等认可</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Key differentiators -->
        <div class="grid md:grid-cols-4 gap-6">
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-sage/30 shadow-sm text-center">
            <div class="w-10 h-10 mx-auto mb-3 rounded-xl bg-sage/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 class="font-semibold text-charcoal mb-2">中间型识别</h3>
            <p class="text-sm text-text-secondary leading-relaxed">不再被迫"二选一"。A/B/C/D 四种中间型让结果更贴近真实的你。</p>
          </div>
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gold/30 shadow-sm text-center">
            <div class="w-10 h-10 mx-auto mb-3 rounded-xl bg-gold/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <h3 class="font-semibold text-charcoal mb-2">科学测评</h3>
            <p class="text-sm text-text-secondary leading-relaxed">引入 20 道逻辑推理题，将客观能力与主观倾向相结合，提升测试效度。</p>
          </div>
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-coral-soft/30 shadow-sm text-center">
            <div class="w-10 h-10 mx-auto mb-3 rounded-xl bg-coral-soft/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </div>
            <h3 class="font-semibold text-charcoal mb-2">深度内容</h3>
            <p class="text-sm text-text-secondary leading-relaxed">每种人格含 8 项优势 + 4 项成长建议 + 7 个职业推荐 + 代表人物参考。</p>
          </div>
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-indigo/30 shadow-sm text-center">
            <div class="w-10 h-10 mx-auto mb-3 rounded-xl bg-indigo/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-indigo" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4h1m-1 4h1m5-4v1m0 3v1m5-5h1m-1 4h1M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm6-4l4-4-4-4" /></svg>
            </div>
            <h3 class="font-semibold text-charcoal mb-2">双极正面描述</h3>
            <p class="text-sm text-text-secondary leading-relaxed">每题两端均为积极描述，避免某一方被"先入为主"地认为是正确答案。</p>
          </div>
        </div>

        <div class="text-center mt-10">
          <button
            @click="startTest"
            class="group inline-flex items-center gap-3 px-10 py-5 bg-charcoal text-cream text-lg font-semibold rounded-2xl transition-all duration-500 hover:shadow-2xl hover:shadow-coral/20 hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>免费开始测试，了解真实的自己</span>
            <svg class="w-5 h-5 transition-transform duration-500 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </section>

    <!-- 81-Type Grid -->
    <section class="py-16 md:py-24 border-t border-border/50">
      <div class="max-w-6xl mx-auto px-5">
        <div class="text-center mb-14">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sage/10 border border-sage/20 mb-6">
            <span class="text-sm text-sage font-semibold tracking-wide">81 型人格全览</span>
          </div>
          <h2 class="text-2xl md:text-3xl font-display font-bold text-charcoal mb-4">探索全部 81 种人格类型</h2>
          <p class="text-text-secondary max-w-2xl mx-auto leading-relaxed">
            按传统四气质色系着色：<span class="text-[#8869A5] font-semibold">紫(NT分析师)</span> ·
            <span class="text-[#33A474] font-semibold">绿(NF外交家)</span> ·
            <span class="text-[#4298B4] font-semibold">蓝(SJ守护者)</span> ·
            <span class="text-[#E4AE3A] font-semibold">金(SP探险家)</span><br />
            点击任意类型即可查看详细人格描述。
          </p>
        </div>

        <!-- Loading state -->
        <div v-if="!allTypes.length && !fetchError" class="text-center py-12">
          <div class="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-coral-soft border-t-coral animate-spin" />
          <p class="text-text-muted text-sm">加载人格类型数据...</p>
        </div>

        <!-- Error state -->
        <div v-else-if="fetchError" class="text-center py-12">
          <p class="text-text-muted">人格类型数据加载失败，请刷新页面重试。</p>
        </div>

        <!-- 9 Groups -->
        <div v-else class="space-y-16">
          <div v-for="group in NINE_GROUPS" :key="group.prefix">
            <!-- Group Header -->
            <div class="flex items-center gap-3 mb-5">
              <span class="text-sm font-semibold text-text-muted tracking-wider shrink-0">
                {{ group.label }}
              </span>
              <span class="text-xs text-text-muted/60 hidden sm:inline">{{ group.desc }}</span>
              <div class="h-px flex-1 bg-border/40 ml-3" />
            </div>

            <!-- Type Cards Grid (3 cols × 3 rows) -->
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              <button
                v-for="t in groupedTypes[group.prefix]"
                :key="t.code"
                @click="goToType(t.code)"
                class="group relative bg-white/70 backdrop-blur-sm rounded-2xl p-4 md:p-5 border border-border/40 shadow-sm text-left transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                :style="{ borderColor: getTypeColorFamily(t.code) === 'purple' ? '#8869A520' : getTypeColorFamily(t.code) === 'green' ? '#33A47420' : getTypeColorFamily(t.code) === 'blue' ? '#4298B420' : '#E4AE3A20' }"
              >
                <!-- Accent bar at top -->
                <div
                  class="absolute top-0 left-4 right-4 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  :style="{ background: getTypeHex(t.code) }"
                />
                <div class="flex items-center gap-3 mb-2">
                  <div class="shrink-0 transition-transform duration-300 group-hover:scale-110">
                    <TypeAvatar :type-code="t.code" :size="44" />
                  </div>
                  <div class="min-w-0">
                    <p
                      class="text-sm md:text-base font-display font-bold tracking-wide"
                      :style="{ color: getTypeHex(t.code) }"
                    >
                      {{ t.code }}
                    </p>
                    <p class="text-xs text-text-muted truncate">{{ t.name?.replace('型', '') }}</p>
                  </div>
                </div>

                <!-- Hover: right arrow -->
                <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <svg class="w-4 h-4" :style="{ color: getTypeHex(t.code) }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div class="text-center mt-16">
          <button
            @click="startTest"
            class="group inline-flex items-center gap-3 px-10 py-5 bg-charcoal text-cream text-lg font-semibold rounded-2xl transition-all duration-500 hover:shadow-2xl hover:shadow-coral/20 hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>开始测试，发现你的专属类型</span>
            <svg class="w-5 h-5 transition-transform duration-500 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="text-center py-8 text-xs text-text-muted space-x-4">
      <span>测试结果仅供个人参考</span>
      <span>&middot;</span>
      <span>不用于临床诊断或招聘决策</span>
    </footer>
  </div>
</template>
