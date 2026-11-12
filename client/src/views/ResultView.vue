<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import DimensionSpectrum from '../components/DimensionSpectrum.vue'
import SharePoster from '../components/SharePoster.vue'
import AccessGate from '../components/AccessGate.vue'
import { api, type PersonalityType } from '../services/api'
import { getAccessToken } from '../services/access'
import { IS_DEMO } from '../services/demoMode'
import { getTypeColor, getNineGroupCode, getNineGroupColor } from '../utils/colors'
import { typeImageUrl } from '../utils/typeImage'
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
const paidReport = ref(false)
const accessToken = ref(getAccessToken())
const recordId = computed(() => typeof route.query.recordId === 'string' ? route.query.recordId : '')

// 是否来自真实测试（有分数数据）
const hasTestData = computed(() => !!route.query.scores)

async function loadTypeData() {
  typeData.value = await api.getResult(typeCode.value, accessToken.value || undefined, recordId.value || undefined)
  paidReport.value = IS_DEMO || !!typeData.value.paid
}

async function onAccessUnlocked(token: string) {
  accessToken.value = token
  try {
    await loadTypeData()
  } catch {
    fetchError.value = 'typeData'
  }
}

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
    await loadTypeData()
  } catch {
    fetchError.value = 'typeData'
  }

  setTimeout(() => { isLoaded.value = true }, 200)

  // 注入 JSON-LD 结构化数据
  injectJsonLd()
})

const typeName = computed(() => {
  return [
    chars.value.E_I === 'A' ? '平衡型' : chars.value.E_I === 'E' ? '外向型' : '内向型',
    chars.value.S_N === 'B' ? '均衡型' : chars.value.S_N === 'N' ? '直觉型' : '实感型',
    chars.value.T_F === 'C' ? '复合型' : chars.value.T_F === 'T' ? '思考型' : '情感型',
    chars.value.P_J === 'D' ? '动态型' : chars.value.P_J === 'J' ? '判断型' : '感知型',
  ].join(' · ')
})

const isTraditional = computed(() => {
  return !['A', 'B', 'C', 'D'].some(c => typeCode.value.includes(c))
})

// 9组颜色分类
const typeColor = computed(() => getTypeColor(typeCode.value))
const groupCode = computed(() => getNineGroupCode(typeCode.value))
const groupColor = computed(() => getNineGroupColor(groupCode.value))

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

const dimensionRows = computed(() => [
  { key: 'E_I', index: '01', label: '能量来源', char: chars.value.E_I, nickname: nicknames.value.E_I },
  { key: 'S_N', index: '02', label: '认知方式', char: chars.value.S_N, nickname: nicknames.value.S_N },
  { key: 'T_F', index: '03', label: '决策方式', char: chars.value.T_F, nickname: nicknames.value.T_F },
  { key: 'P_J', index: '04', label: '生活态度', char: chars.value.P_J, nickname: nicknames.value.P_J },
])

const featuredProfile = computed(() =>
  typeData.value?.celebrityStories?.find(p => p.story) || null,
)

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
  () => typeData.value?.imageUrl || typeImageUrl(typeCode.value),
  () => typeCode.value,
)

// JSON-LD 结构化数据（搜索引擎富文本卡片）
let jsonLdScript: HTMLScriptElement | null = null
function injectJsonLd() {
  const code = typeCode.value
  const name = typeData.value?.name || typeName.value
  const desc = oneLiner.value
  const img = typeData.value?.imageUrl || typeImageUrl(code)
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

</script>

<template>
  <div class="result-page">
    <header class="result-header">
      <button class="result-brand" type="button" @click="$router.push('/')">
        MBTI <span>—</span> PRO
      </button>
      <p class="result-caption">RESULT / {{ isTraditional ? '16-TYPE' : '81-TYPE' }}</p>
      <button v-if="hasTestData" type="button" class="header-share" @click="showSharePoster = true">
        分享结果 <span aria-hidden="true">↗</span>
      </button>
    </header>

    <div v-if="!isLoaded" class="result-state">
      <span>◌</span>
      <p>正在整理你的档案…</p>
    </div>

    <main v-else class="result-main">
      <section class="result-hero">
        <div class="result-identity">
          <p class="result-kicker"><span>YOUR ARCHIVE</span><span>{{ groupColor.name }}</span></p>
          <h1 class="result-code">{{ typeCode }}</h1>
          <div class="result-name-row">
            <h2>{{ typeData?.name?.replace('型', '') || '人格坐标' }}</h2>
            <span class="result-dot" :style="{ background: typeColor.hex }" />
          </div>
          <p class="result-axis">{{ typeName }}</p>
          <blockquote v-if="typeData?.summary" class="result-quote">“{{ typeData.summary }}”</blockquote>
          <p class="result-footnote">
            {{ isTraditional ? '传统 16 型组合' : '81 型中间型组合' }} · 结果仅供自我探索
          </p>
        </div>

        <aside class="result-portrait">
          <div class="portrait-frame">
            <span class="portrait-index">81</span>
            <img
              :src="typeImageUrl(typeCode)"
              :alt="`${typeCode} 人格画像`"
              :class="{ 'portrait-image--loaded': imageLoaded }"
              @load="imageLoaded = true"
              @error="imageLoaded = true; ($event.target as HTMLImageElement).style.display = 'none'"
            />
            <span class="portrait-code">{{ typeCode }}</span>
          </div>
          <div class="portrait-caption">
            <span>{{ groupColor.name }}</span>
            <span>PERSONALITY ARCHIVE</span>
          </div>
        </aside>
      </section>

      <section v-if="hasTestData" class="result-section">
        <div class="section-head"><span>01 / COORDINATE + PORTRAIT</span><h2>四维坐标与日常画像</h2></div>
        <DimensionSpectrum
          :typeCode="typeCode"
          :typeName="typeName"
          :scores="scores"
          :chars="chars"
          :dimTotals="dimTotals"
          :dimAnswered="dimAnswered"
        />
        <div class="dimension-grid">
          <div v-for="dim in dimensionRows" :key="dim.key" class="dimension-item">
            <span class="dim-index">{{ dim.index }}</span>
            <span class="dim-label">{{ dim.label }}</span>
            <span class="dim-char">{{ dim.char }}</span>
            <span class="dim-nick">{{ dim.nickname }}</span>
          </div>
        </div>
      </section>

      <AccessGate
        v-if="hasTestData && typeData && !paidReport"
        compact
        title="解锁完整 81 型报告"
        description="在小红书店铺购买 0.99 元商品后，输入订单里的兑换码。兑换成功后，本页全部内容立即解锁，不再需要邮箱、分享或二次付费。"
        @unlocked="onAccessUnlocked"
      />

      <div v-if="paidReport" class="report-content">
        <section class="result-section">
          <div class="section-head"><span>02 / PORTRAIT</span><h2>人格概览</h2></div>
          <div class="long-copy">{{ typeData?.overview }}</div>
        </section>

        <section v-if="typeData?.celebrityStories?.length" class="result-section">
          <div class="section-head"><span>03 / REFERENCES</span><h2>代表人物</h2></div>
          <div class="person-strip">
            <div v-for="(person, i) in typeData.celebrityStories" :key="person.name" class="person-row">
              <span class="person-index">{{ ('0' + (i + 1)).slice(-2) }}</span>
              <span class="person-name">{{ person.name }}</span>
              <span class="person-field">{{ person.field }}</span>
            </div>
          </div>
          <p class="person-note">标注作品名的为虚构角色，仅作性格类比，与作品版权方无关联；真人部分只引用公开可查的经历，不代表本人测评或认可。</p>
        </section>

        <section v-if="typeData?.eiModule || typeData?.snModule || typeData?.tfModule || typeData?.pjModule" class="result-section">
          <div class="section-head"><span>04 / DEPTH</span><h2>代表人物解读</h2></div>
          <div v-if="featuredProfile" class="depth-person">
            <p class="depth-person-kicker">PERSON IN CONTEXT / {{ featuredProfile.name }} · {{ featuredProfile.field }}</p>
            <p class="depth-person-story">下面四条建议，都来自这位人物公开可查的经历：他从哪里起步、怎么看局面、怎么做关键抉择，以及代价最后落在哪里。</p>
            <blockquote v-if="featuredProfile.quote">“{{ featuredProfile.quote }}”</blockquote>
          </div>
          <div class="depth-list">
            <div v-if="typeData?.eiModule" class="depth-row">
              <span>起点与志向</span><p>{{ typeData.eiModule }}</p>
            </div>
            <div v-if="typeData?.snModule" class="depth-row">
              <span>看世界的角度</span><p>{{ typeData.snModule }}</p>
            </div>
            <div v-if="typeData?.tfModule" class="depth-row">
              <span>关键抉择</span><p>{{ typeData.tfModule }}</p>
            </div>
            <div v-if="typeData?.pjModule" class="depth-row">
              <span>代价与教训</span><p>{{ typeData.pjModule }}</p>
            </div>
          </div>
          <p class="depth-note">以上四条由该型主人物的公开生平与关键抉择推导，仅作性格参照，不构成对人物本人的测评或评价。</p>
        </section>
      </div>

      <div class="result-actions">
        <button v-if="hasTestData" type="button" class="primary-action" @click="showSharePoster = true">
          分享结果 <span aria-hidden="true">↗</span>
        </button>
        <button type="button" class="text-action" @click="$router.push('/')">
          再测一次
        </button>
      </div>

      <footer class="result-disclaimer">
        <span>MBTI-PRO / 81-TYPE PERSONALITY ARCHIVE</span>
        <span>结果仅供个人参考，不构成临床诊断或招聘决策依据</span>
      </footer>
    </main>

    <SharePoster
      v-if="showSharePoster"
      :typeCode="typeCode"
      :typeName="typeData?.name || typeName"
      :typeColor="typeColor"
      :groupColor="groupColor"
      :oneLiner="oneLiner"
      :imageUrl="typeData?.imageUrl || `/api/images/${typeCode}`"
      :recordId="recordId"
      :scores="hasTestData ? scores : undefined"
      :chars="hasTestData ? chars : undefined"
      :dimTotals="dimTotals"
      @close="showSharePoster = false"
    />
  </div>
</template>


<style scoped>
.result-page {
  --paper: #f2ede3;
  --paper-light: #f8f4ec;
  --ink: #1e1d1a;
  --muted: #6f685d;
  --rule: #d2c8b8;
  --accent: #a63d2c;
  --moss: #2f4037;
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", system-ui, sans-serif;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  max-width: 1180px;
  margin: 0 auto;
  padding: 22px 40px;
  border-bottom: 1px solid var(--rule);
}
.result-brand {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 14px;
  letter-spacing: .08em;
}
.result-brand span { color: var(--accent); }
.result-caption {
  margin: 0;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 10px;
  letter-spacing: .12em;
}
.header-share {
  padding: 8px 0;
  border: 0;
  border-bottom: 1px solid var(--ink);
  background: none;
  color: var(--ink);
  font-size: 12px;
}
.header-share span { color: var(--accent); margin-left: 6px; }
.result-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 11px;
}
.result-state span { color: var(--accent); font-size: 28px; margin-bottom: 14px; }

.result-main { max-width: 1120px; margin: 0 auto; padding: 66px 40px 34px; }
.result-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, .82fr);
  gap: clamp(40px, 8vw, 110px);
  align-items: center;
  min-height: 430px;
  padding-bottom: 60px;
}
.result-kicker {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  margin: 0 0 20px;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 10px;
  letter-spacing: .1em;
}
.result-kicker span:first-child { color: var(--accent); }
.result-code {
  margin: 0;
  font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif;
  font-size: clamp(96px, 14vw, 172px);
  font-weight: 600;
  line-height: .88;
  letter-spacing: -.07em;
}
.result-name-row { display: flex; align-items: center; gap: 12px; margin-top: 24px; }
.result-name-row h2 {
  margin: 0;
  font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif;
  font-size: clamp(26px, 3vw, 38px);
  font-weight: 600;
  letter-spacing: -.04em;
}
.result-dot { width: 9px; height: 9px; display: inline-block; }
.result-axis { margin: 8px 0 0; color: var(--muted); font-size: 13px; }
.result-quote {
  max-width: 660px;
  margin: 28px 0 0;
  padding-left: 18px;
  border-left: 2px solid var(--accent);
  color: var(--ink);
  font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif;
  font-size: 20px;
  line-height: 1.8;
}
.result-footnote { margin: 26px 0 0; color: var(--muted); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 10px; letter-spacing: .04em; }
.result-portrait {
  width: min(100%, 380px);
  justify-self: end;
}
.portrait-frame {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border: 1px solid var(--ink);
  background: var(--paper-light);
}
.portrait-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity .45s ease;
}
.portrait-frame img.portrait-image--loaded { opacity: 1; }
.portrait-index, .portrait-code {
  position: absolute;
  z-index: 1;
  padding: 3px 6px;
  background: var(--paper);
  color: var(--accent);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 10px;
  letter-spacing: .08em;
}
.portrait-index { top: 10px; left: 10px; }
.portrait-code { right: 10px; bottom: 10px; color: var(--ink); }
.portrait-caption {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-top: 9px;
  color: var(--muted);
  font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace;
  font-size: 9px;
  letter-spacing: .05em;
}

.result-section { padding: 48px 0 52px; border-top: 1px solid var(--rule); }
.section-head { display: flex; align-items: baseline; gap: 26px; margin-bottom: 30px; }
.section-head span { color: var(--accent); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 10px; letter-spacing: .08em; white-space: nowrap; }
.section-head h2 { margin: 0; font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif; font-size: clamp(30px, 3.4vw, 40px); font-weight: 600; letter-spacing: -.04em; }
.long-copy { max-width: 860px; color: var(--muted); font-size: 16px; line-height: 2.05; white-space: pre-line; }

.dimension-grid { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--ink); }
.dimension-item { display: grid; grid-template-columns: 36px 1fr auto; column-gap: 12px; padding: 20px 0; border-bottom: 1px solid var(--rule); }
.dimension-item:nth-child(odd) { padding-right: 32px; }
.dimension-item:nth-child(even) { padding-left: 32px; border-left: 1px solid var(--rule); }
.dim-index { color: var(--accent); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 10px; }
.dim-label { color: var(--muted); font-size: 12px; }
.dim-char { grid-row: span 2; grid-column: 3; font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 28px; line-height: 1; }
.dim-nick { grid-column: 2; color: var(--ink); font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif; font-size: 17px; margin-top: 5px; }

.person-strip { border-top: 1px solid var(--ink); }
.person-row { display: grid; grid-template-columns: 36px 1fr 1.2fr; gap: 18px; align-items: baseline; padding: 15px 0; border-bottom: 1px solid var(--rule); }
.person-index { color: var(--accent); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 10px; }
.person-name { font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif; font-size: 18px; font-weight: 600; }
.person-field { color: var(--muted); font-size: 12px; text-align: right; }
.person-note { margin: 12px 0 0; color: var(--muted); font-size: 11px; line-height: 1.7; }

.depth-person { margin-bottom: 28px; padding: 22px 24px; border-left: 2px solid var(--accent); background: rgba(166, 61, 44, .045); }
.depth-person-kicker { margin: 0 0 10px; color: var(--accent); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 9px; letter-spacing: .08em; }
.depth-person-story { max-width: 850px; margin: 0; color: var(--muted); font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif; font-size: 16px; line-height: 1.95; }
.depth-person blockquote { margin: 14px 0 0; color: var(--ink); font-family: "Playfair Display", "Songti SC", "STSong", SimSun, "Noto Serif CJK SC", "Source Han Serif SC", serif; font-size: 18px; line-height: 1.7; }
.depth-list { border-top: 1px solid var(--ink); }
.depth-row { display: grid; grid-template-columns: 120px 1fr; gap: 24px; padding: 20px 0; border-bottom: 1px solid var(--rule); }
.depth-row > span { color: var(--accent); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 10px; letter-spacing: .05em; padding-top: 4px; }
.depth-row p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.9; }
.depth-note { margin: 14px 0 0; color: var(--muted); font-size: 11px; line-height: 1.7; }

.result-actions { display: flex; align-items: center; gap: 22px; padding: 38px 0 20px; border-top: 1px solid var(--rule); }
.primary-action {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 30px;
  min-width: 160px; padding: 14px 18px; border: 1px solid var(--ink); border-radius: 0;
  background: var(--ink); color: var(--paper-light); font-size: 13px; font-weight: 600;
}
.primary-action:hover { background: var(--accent); border-color: var(--accent); }
.text-action { padding: 8px 0; border: 0; border-bottom: 1px solid transparent; background: none; color: var(--muted); font-size: 13px; }
.text-action:hover { color: var(--ink); border-color: var(--ink); }
.result-disclaimer { display: flex; justify-content: space-between; gap: 24px; padding: 24px 0 0; border-top: 1px solid var(--rule); color: var(--muted); font-family: "DM Mono", "SF Mono", Consolas, "Roboto Mono", monospace; font-size: 9px; letter-spacing: .03em; }

@media (max-width: 760px) {
  .result-header { padding: 18px 22px; }
  .result-caption { display: none; }
  .result-main { padding: 44px 22px 26px; }
  .result-hero { grid-template-columns: 1fr; gap: 34px; min-height: 0; padding-bottom: 42px; }
  .result-code { font-size: 92px; }
  .result-quote { font-size: 18px; }
  .result-portrait { width: 280px; justify-self: start; }
  .result-section { padding: 36px 0 40px; }
  .section-head { display: block; margin-bottom: 22px; }
  .section-head span { display: block; margin-bottom: 10px; }
  .dimension-grid { grid-template-columns: 1fr; }
  .dimension-item:nth-child(odd), .dimension-item:nth-child(even) { padding-left: 0; padding-right: 0; border-left: 0; }
  .depth-row { grid-template-columns: 92px 1fr; gap: 14px; }
  .result-disclaimer { flex-direction: column; gap: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .primary-action { transition: none; }
}
</style>
