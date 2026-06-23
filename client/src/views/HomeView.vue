<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api'
import { getTypeHex, getNineGroupCode } from '../utils/colors'
import TypeAvatar from '../components/TypeAvatar.vue'

const router = useRouter()
const loaded = ref(false)
const allTypes = ref<{ code: string; name: string; isTraditional: boolean; population?: string | null; celebrities?: string[] | null; imageUrl?: string }[]>([])
const fetchError = ref(false)

// 9组颜色分类：严格按 81型人格颜色分类.xlsx 定义
const NINE_GROUP_META: Record<string, { name: string; hex: string; description: string }> = {
  SP: { name: 'SP 暖金组', hex: '#C8963E', description: 'S 系 + 灵活感知 P → 工匠/表演者气质' },
  SD: { name: 'SD 琥珀组', hex: '#C87D3E', description: 'S 系 + 动态平衡 D → 秩序与灵活兼备' },
  SJ: { name: 'SJ 藏蓝组', hex: '#2C5F8A', description: 'S 系 + 秩序判断 J → 护卫者气质' },
  BT: { name: 'BT 深炭灰组', hex: '#4A4A4A', description: 'B 系 + 理性思考 T → 实务技术/管理' },
  BC: { name: 'BC 月光银灰组', hex: '#8B95A0', description: 'B 系 + 复合决策 C → 终极中间态' },
  BF: { name: 'BF 暖燕麦组', hex: '#B8956A', description: 'B 系 + 情感共情 F → 治愈型支持者' },
  NT: { name: 'NT 深紫组', hex: '#6B3FA0', description: 'N 系 + 理性思考 T → 理性者/战略家' },
  NC: { name: 'NC 靛青组', hex: '#3D7B8A', description: 'N 系 + 复合决策 C → 高阶认知统筹' },
  NF: { name: 'NF 翠绿组', hex: '#2D8A4E', description: 'N 系 + 情感共情 F → 理想主义者/外交家' },
}

const NINE_GROUP_ORDER = ['SP', 'SD', 'SJ', 'BT', 'BC', 'BF', 'NT', 'NC', 'NF']

// 按9组归类
const groupedTypes = computed(() => {
  const groups: Record<string, typeof allTypes.value> = {}
  for (const t of allTypes.value) {
    const key = getNineGroupCode(t.code)
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  return groups
})

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
        <div class="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-charcoal border border-coral/30 mb-8 shadow-lg">
          <span class="w-2 h-2 rounded-full bg-coral animate-breathe" />
          <span class="text-sm text-cream font-bold tracking-wider">
            MBTI PRO：全新 81 型人格分类体系
          </span>
        </div>

        <!-- Hero Headline -->
        <h1 class="text-4xl md:text-6xl lg:text-7xl font-display font-black leading-[1.08] mb-6 tracking-tight">
          <span class="shimmer-text" style="--tw-shimmer-from: #2D2A26; --tw-shimmer-via: #E8816B;">发现</span>
          <span class="text-coral italic">真实的</span><br />
          <span class="shimmer-text" style="--tw-shimmer-from: #2D2A26; --tw-shimmer-via: #E8816B;">自己</span>
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

    <!-- 81型由来 -->
    <section class="py-16 md:py-24 bg-surface-alt/30 border-t border-border/50">
      <div class="max-w-4xl mx-auto px-5">
        <div class="text-center mb-12">
          <h2 class="text-2xl md:text-3xl font-display font-bold text-charcoal mb-4">什么是 MBTI PRO 的全新 81 型人格分类体系？</h2>
          <p class="text-text-secondary max-w-2xl mx-auto leading-relaxed">
            传统 MBTI 将每个维度一分为二（如 E 或 I），组合出 16 种人格类型。但真实的人性格分布更接近连续光谱——
            每个人在四个维度上都有自己独特的位置，而非简单的"非此即彼"。
          </p>
        </div>

        <div class="grid md:grid-cols-2 gap-6 mb-8">
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-border/50 shadow-sm">
            <h3 class="font-semibold text-charcoal mb-3">从二分到三分</h3>
            <p class="text-sm text-text-secondary leading-relaxed">
              在每个维度上，除了两个极端倾向之外，MBTI PRO 新增了<strong>中间均衡型</strong>。
              例如，能量来源维度不仅有 E（外向）和 I（内向），还有 A（平衡型）；决策方式维度在 T（思考）和 F（情感）之间加入了 C（复合型）。
              这使得每个维度从 2 种选择扩展为 3 种。
            </p>
          </div>
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-border/50 shadow-sm">
            <h3 class="font-semibold text-charcoal mb-3">3 × 3 × 3 × 3 = 81</h3>
            <p class="text-sm text-text-secondary leading-relaxed">
              四个维度各自有三种可能的位置，组合起来就是 3×3×3×3 = <strong>81 种人格类型</strong>。
              这比传统 16 型精细了整整 5 倍——能够更准确地捕捉到那些"介于两者之间"的真实人格特征，
              让测试结果不再是非黑即白的粗暴分类。
            </p>
          </div>
        </div>

        <!-- 12 维度位置详解 -->
        <div class="bg-white/70 backdrop-blur-sm rounded-3xl p-6 md:p-8 border border-border shadow-sm">
          <h3 class="text-lg font-display font-bold text-charcoal mb-6 text-center">12 个维度位置</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-5">
            <!-- E_I 维度 -->
            <div class="text-center p-4 rounded-xl bg-surface-alt/50">
              <p class="text-sm font-semibold text-charcoal mb-3">能量来源</p>
              <div class="flex justify-center gap-3">
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-[#5C8DFF] leading-tight">I</span>
                  <span class="text-xs text-text-muted">内向</span>
                </div>
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-sage leading-tight">A</span>
                  <span class="text-xs text-text-muted">平衡</span>
                </div>
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-[#5C8DFF] leading-tight">E</span>
                  <span class="text-xs text-text-muted">外向</span>
                </div>
              </div>
            </div>
            <!-- S_N 维度 -->
            <div class="text-center p-4 rounded-xl bg-surface-alt/50">
              <p class="text-sm font-semibold text-charcoal mb-3">认知方式</p>
              <div class="flex justify-center gap-3">
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-[#9C6FFF] leading-tight">N</span>
                  <span class="text-xs text-text-muted">直觉</span>
                </div>
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-sage leading-tight">B</span>
                  <span class="text-xs text-text-muted">均衡</span>
                </div>
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-[#9C6FFF] leading-tight">S</span>
                  <span class="text-xs text-text-muted">实感</span>
                </div>
              </div>
            </div>
            <!-- T_F 维度 -->
            <div class="text-center p-4 rounded-xl bg-surface-alt/50">
              <p class="text-sm font-semibold text-charcoal mb-3">决策方式</p>
              <div class="flex justify-center gap-3">
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-[#1DA8FF] leading-tight">F</span>
                  <span class="text-xs text-text-muted">情感</span>
                </div>
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-sage leading-tight">C</span>
                  <span class="text-xs text-text-muted">复合</span>
                </div>
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-[#1DA8FF] leading-tight">T</span>
                  <span class="text-xs text-text-muted">思考</span>
                </div>
              </div>
            </div>
            <!-- P_J 维度 -->
            <div class="text-center p-4 rounded-xl bg-surface-alt/50">
              <p class="text-sm font-semibold text-charcoal mb-3">生活态度</p>
              <div class="flex justify-center gap-3">
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-[#E6B800] leading-tight">P</span>
                  <span class="text-xs text-text-muted">感知</span>
                </div>
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-sage leading-tight">D</span>
                  <span class="text-xs text-text-muted">动态</span>
                </div>
                <div class="flex flex-col items-center gap-0.5">
                  <span class="text-lg font-bold text-[#E6B800] leading-tight">J</span>
                  <span class="text-xs text-text-muted">判断</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p class="text-center text-sm text-text-muted mt-8 max-w-2xl mx-auto leading-relaxed">
          你的四个维度位置共同构成一个唯一的四字母代码——这就是你在 MBTI PRO 中的专属人格类型。
          无论你是偏传统的纯端值类型，还是带有中间维度的独特组合，81 种类型中总有一种最接近真实的你。
        </p>
      </div>
    </section>

    <!-- MBTI PRO Advantages -->
    <section class="py-16 md:py-24 bg-surface-alt/50 border-t border-border/50">
      <div class="max-w-4xl mx-auto px-5">
        <div class="text-center mb-12">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-coral/10 border border-coral/20 mb-6">
            <span class="text-sm text-coral font-semibold tracking-wide">MBTI PRO 优势</span>
          </div>
          <h2 class="text-2xl md:text-3xl font-display font-bold text-charcoal mb-4">为什么选择 MBTI PRO？</h2>
          <p class="text-text-secondary max-w-2xl mx-auto leading-relaxed">
            传统 MBTI 用二分法将人简单分为两类（如：你要么是外向 E，要么是内向 I），但真实的人格分布并非如此绝对。
            MBTI PRO 在每个维度增加了<strong>中间型</strong>，让分类更贴近真实的你。
          </p>
        </div>

        <!-- Comparison Table -->
        <div class="bg-white/70 backdrop-blur-sm rounded-3xl border border-border shadow-sm overflow-x-auto mb-8">
          <table class="w-full text-sm min-w-[500px]">
            <thead>
              <tr class="border-b border-border">
                <th class="text-left px-6 py-4 font-semibold text-charcoal w-1/4">对比维度</th>
                <th class="text-left px-6 py-4 font-semibold text-text-muted w-3/8 border-l border-border/50">传统 MBTI</th>
                <th class="text-left px-6 py-4 font-semibold text-coral w-3/8 border-l border-border/50">MBTI PRO</th>
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
                <td class="px-6 py-4 text-coral font-medium border-l border-border/50">100 题（含 10 道客观推理）</td>
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
            <p class="text-sm text-text-secondary leading-relaxed">每种人格含 8 项优势 + 4 项成长建议 + 代表人物参考。</p>
          </div>
          <div class="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-[#88619A]/30 shadow-sm text-center">
            <div class="w-10 h-10 mx-auto mb-3 rounded-xl bg-[#88619A]/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-[#88619A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4h1m-1 4h1m5-4v1m0 3v1m5-5h1m-1 4h1M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm6-4l4-4-4-4" /></svg>
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
            按9组颜色分类严格着色：<span class="text-[#6B3FA0] font-semibold">NT深紫</span> ·
            <span class="text-[#3D7B8A] font-semibold">NC靛青</span> ·
            <span class="text-[#2D8A4E] font-semibold">NF翠绿</span> ·
            <span class="text-[#4A4A4A] font-semibold">BT深炭灰</span> ·
            <span class="text-[#8B95A0] font-semibold">BC月光银灰</span> ·
            <span class="text-[#B8956A] font-semibold">BF暖燕麦</span><br />
            <span class="text-[#C8963E] font-semibold">SP暖金</span> ·
            <span class="text-[#C87D3E] font-semibold">SD琥珀</span> ·
            <span class="text-[#2C5F8A] font-semibold">SJ藏蓝</span><br />
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

        <!-- 9 Groups (按81型人格颜色分类) -->
        <div v-else class="space-y-12">
          <div v-for="groupCode in NINE_GROUP_ORDER" :key="groupCode">
            <!-- Group Header -->
            <div class="flex items-center gap-3 mb-4">
              <span
                class="w-3 h-3 rounded-full shrink-0"
                :style="{ background: NINE_GROUP_META[groupCode].hex }"
              />
              <span class="text-sm font-semibold tracking-wider shrink-0"
                :style="{ color: NINE_GROUP_META[groupCode].hex }"
              >
                {{ NINE_GROUP_META[groupCode].name }}
              </span>
              <span class="text-xs text-text-muted/60 hidden sm:inline">
                {{ groupedTypes[groupCode]?.length || 0 }} 型
              </span>
              <span class="text-xs text-text-muted/50 hidden md:inline">
                &middot; {{ NINE_GROUP_META[groupCode].description }}
              </span>
              <div
                class="h-px flex-1 ml-3"
                :style="{ background: `linear-gradient(to right, ${NINE_GROUP_META[groupCode].hex}30, transparent)` }"
              />
            </div>

            <!-- Type Cards Grid -->
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              <button
                v-for="t in groupedTypes[groupCode]"
                :key="t.code"
                v-magnet="6"
                @click="goToType(t.code)"
                class="group relative bg-white/70 backdrop-blur-sm rounded-2xl border border-border/40 shadow-sm text-left transition-shadow duration-300 hover:shadow-lg overflow-hidden"
                style="content-visibility: auto; contain-intrinsic-size: auto 280px"
                :style="{ borderColor: NINE_GROUP_META[groupCode].hex + '20' }"
              >
                <!-- Image thumbnail -->
                <div class="relative w-full aspect-[4/3] overflow-hidden bg-surface-alt/30">
                  <img
                    :src="t.imageUrl || `/api/thumbs/${t.code}`"
                    :alt="`${t.code}`"
                    class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    fetchpriority="low"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  />
                  <!-- Gradient overlay -->
                  <div class="absolute inset-0 bg-gradient-to-t from-white/60 to-transparent" />
                </div>
                <!-- Type info -->
                <div class="p-3 md:p-4 relative">
                  <!-- Accent bar at top -->
                  <div
                    class="absolute top-0 left-4 right-4 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    :style="{ background: NINE_GROUP_META[groupCode].hex }"
                  />
                  <div class="flex items-center gap-3">
                    <div class="shrink-0 transition-transform duration-300 group-hover:scale-110">
                      <TypeAvatar :type-code="t.code" :size="36" />
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
                    <!-- Hover: right arrow -->
                    <div class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300 shrink-0">
                      <svg class="w-4 h-4" :style="{ color: NINE_GROUP_META[groupCode].hex }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
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
