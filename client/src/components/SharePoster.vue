<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{
  typeCode: string
  typeName: string
  typeColor: { hex: string; name: string }
  groupColor: { hex: string; name: string }
  oneLiner: string
  imageUrl: string
  scores?: { E_I: number; S_N: number; T_F: number; P_J: number }
  chars?: { E_I: string; S_N: string; T_F: string; P_J: string }
}>()

const emit = defineEmits<{ close: [] }>()

const qrDataUrl = ref('')
const generatedImageUrl = ref('')
const isGenerating = ref(true)
const showModal = ref(false)
const hasError = ref(false)

const W = 750; const H = 1334

const DIM_COLORS: Record<string, string> = {
  I: '#3D6FFF', E: '#FF5722', N: '#6A1B9A', S: '#00796B',
  F: '#0277BD', T: '#E65100', P: '#BF8C00', J: '#1565C0',
}

async function generateQR() {
  try {
    qrDataUrl.value = await QRCode.toDataURL(`${location.origin}/#/test?ref=share`, {
      width: 120, margin: 0,
      color: { dark: '#1A1A1A', light: '#FFFFFF' },
    })
  } catch {}
}

function loadImage(src: string): Promise<HTMLImageElement> { return new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = reject; img.src = src }) }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

async function drawPoster() {
  const canvas = document.createElement('canvas')
  canvas.width = W * 2; canvas.height = H * 2
  const ctx = canvas.getContext('2d')!; ctx.scale(2, 2)

  // 1. 纯白底
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H)

  // 2. 深色顶栏
  const headerH = 390
  const hg = ctx.createLinearGradient(0, 0, 0, headerH)
  hg.addColorStop(0, '#1A1A2E'); hg.addColorStop(1, '#2D2D44')
  ctx.fillStyle = hg; ctx.fillRect(0, 0, W, headerH)

  let y = 54

  // 3. Brand
  ctx.font = 'bold 12px "Noto Sans SC", sans-serif'; ctx.fillStyle = '#FFFFFF60'; ctx.textAlign = 'center'
  ctx.fillText('MBTI PRO', W / 2, y); y += 20
  ctx.font = '10px "Noto Sans SC", sans-serif'; ctx.fillStyle = '#FFFFFF30'
  ctx.fillText('81 型人格深度测试', W / 2, y); y += 32

  // 4. 圆形图片 — 用中图640px快速加载，280px圆足够清晰
  try {
    const avatar = await loadImage(`/api/mediums/${props.typeCode}`)
    const sz = 260; const sx = (W - sz) / 2
    ctx.save()
    ctx.beginPath(); ctx.arc(W / 2, y + sz / 2, sz / 2 + 4, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF18'; ctx.fill()
    ctx.beginPath(); ctx.arc(W / 2, y + sz / 2, sz / 2, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(avatar, sx, y, sz, sz); ctx.restore()
    y += sz + 28
  } catch { y += 16 }

  // 5. 类型代码
  ctx.font = '900 76px "Playfair Display", serif'; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'
  ctx.fillText(props.typeCode, W / 2, y + 60); y += 82

  // 6. 类型名称
  ctx.font = 'bold 24px "Noto Sans SC", sans-serif'; ctx.fillStyle = '#FFFFFFE0'
  ctx.fillText(props.typeName.replace('型', ''), W / 2, y + 18)
  y = headerH + 52

  // 7. 四维状态条（主要区域）
  if (props.scores && props.chars) {
    const dims = [
      { key: 'E_I' as const, left: 'I', right: 'E' },
      { key: 'S_N' as const, left: 'N', right: 'S' },
      { key: 'T_F' as const, left: 'F', right: 'T' },
      { key: 'P_J' as const, left: 'P', right: 'J' },
    ]
    const barW = 520; const barH = 22; const barX = (W - barW) / 2
    const dimGap = 50

    dims.forEach((dim, i) => {
      const dy = y + i * dimGap
      const score = props.scores![dim.key]
      const pos = Math.max(3, Math.min(97, 50 + (score / 50) * 47))
      const lc = DIM_COLORS[dim.left]; const rc = DIM_COLORS[dim.right]

      ctx.font = 'bold 15px "Noto Sans SC", sans-serif'
      ctx.textAlign = 'left'; ctx.fillStyle = lc; ctx.fillText(dim.left, barX - 50, dy + barH / 2 + 5)
      ctx.textAlign = 'right'; ctx.fillStyle = rc; ctx.fillText(dim.right, barX + barW + 50, dy + barH / 2 + 5)

      ctx.fillStyle = '#E8E5DF'; roundRect(ctx, barX, dy, barW, barH, barH / 2); ctx.fill()
      ctx.fillStyle = '#D0CCC4'; ctx.fillRect(barX + barW / 2 - 1.5, dy, 3, barH)
      const lg = ctx.createLinearGradient(barX, 0, barX + barW / 2, 0); lg.addColorStop(0, lc + '45'); lg.addColorStop(1, '#E8E5DF')
      ctx.fillStyle = lg; ctx.fillRect(barX, dy, barW / 2, barH)
      const rg = ctx.createLinearGradient(barX + barW / 2, 0, barX + barW, 0); rg.addColorStop(0, '#E8E5DF'); rg.addColorStop(1, rc + '45')
      ctx.fillStyle = rg; ctx.fillRect(barX + barW / 2, dy, barW / 2, barH)

      const dotX = barX + (barW * pos) / 100; const dotY = dy + barH / 2; const dotR = 9
      ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      ctx.fillStyle = pos >= 50 ? rc : lc; ctx.fill()
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.5; ctx.stroke()

      ctx.font = 'bold 9px "DM Mono", monospace'; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'
      ctx.fillText(score > 0 ? `+${score}` : `${score}`, dotX, dotY + 3)
    })

    y += dims.length * dimGap + 50
  }

  // 8. 分隔线
  ctx.strokeStyle = '#E0D8CC'; ctx.lineWidth = 1; ctx.beginPath()
  ctx.moveTo((W - 60) / 2, y); ctx.lineTo((W + 60) / 2, y); ctx.stroke()
  y += 36

  // 9. 底部区域：左侧文字 + 右侧小二维码
  const qrSize = 100; const qrX = W - qrSize - 52
  const textX = 60

  // 左侧文字
  ctx.textAlign = 'left'
  ctx.font = 'bold 20px "Noto Sans SC", sans-serif'; ctx.fillStyle = '#2D2D2D'
  ctx.fillText('扫码测测你的人格类型', textX, y + 20)
  ctx.font = '14px "Noto Sans SC", sans-serif'; ctx.fillStyle = '#9C958E'
  ctx.fillText('发现你的 81 型专属人格画像', textX, y + 44)

  // 右侧二维码（小尺寸紧凑）
  try {
    const qrImg = await loadImage(qrDataUrl.value)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.06)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2
    roundRect(ctx, qrX - 8, y - 8, qrSize + 16, qrSize + 16, 12)
    ctx.fillStyle = '#FFFFFF'; ctx.fill()
    ctx.restore()
    ctx.drawImage(qrImg, qrX, y, qrSize, qrSize)
  } catch {}

  y += qrSize + 44

  // 10. 免责声明
  ctx.textAlign = 'center'; ctx.font = '11px "Noto Sans SC", sans-serif'; ctx.fillStyle = '#B0A89E'
  ctx.fillText('测试结果仅供个人参考，不构成任何临床诊断依据', W / 2, y + 8)

  generatedImageUrl.value = canvas.toDataURL('image/jpeg', 0.92)
}

onMounted(async () => {
  await generateQR()
  try { await drawPoster() } catch { hasError.value = true }
  finally { isGenerating.value = false; showModal.value = true }
})

function downloadPoster() {
  if (!generatedImageUrl.value) return
  const a = document.createElement('a'); a.href = generatedImageUrl.value; a.download = `MBTI-PRO-${props.typeCode}.jpg`; a.click()
}
async function copyToClipboard() {
  if (!generatedImageUrl.value) return
  try { const b = await (await fetch(generatedImageUrl.value)).blob(); await navigator.clipboard.write([new ClipboardItem({ [b.type]: b })]) }
  catch { downloadPoster() }
}
const showShare = computed(() => showModal.value && !isGenerating.value && !hasError.value)
const showError = computed(() => showModal.value && !isGenerating.value && hasError.value)
</script>

<template>
  <Transition name="modal">
    <div v-if="isGenerating" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" />
      <div class="relative bg-cream rounded-3xl p-10 flex flex-col items-center shadow-2xl">
        <div class="w-10 h-10 rounded-full border-4 border-coral-soft border-t-coral animate-spin mb-4" />
        <p class="text-sm text-text-secondary">正在生成分享海报...</p>
      </div>
    </div>
  </Transition>
  <Transition name="modal">
    <div v-if="showShare" class="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div class="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" @click="emit('close')" />
      <div class="relative bg-cream rounded-3xl p-6 max-w-sm w-full shadow-2xl">
        <h3 class="text-lg font-bold text-charcoal mb-2 text-center">分享你的人格画像</h3>
        <p class="text-sm text-text-muted text-center mb-5">长按保存图片，分享到朋友圈</p>
        <div class="rounded-2xl overflow-hidden mb-5" style="box-shadow:0 8px 32px rgba(0,0,0,.1)"><img :src="generatedImageUrl" class="w-full" /></div>
        <div class="flex gap-3">
          <button @click="emit('close')" class="flex-1 px-4 py-3 text-sm font-medium text-text-secondary border border-border rounded-xl">关闭</button>
          <button @click="downloadPoster" class="flex-1 px-4 py-3 text-sm font-semibold bg-charcoal text-cream rounded-xl">保存图片</button>
          <button @click="copyToClipboard" class="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl" :style="{background:typeColor.hex}">复制图片</button>
        </div>
      </div>
    </div>
  </Transition>
  <Transition name="modal">
    <div v-if="showError" class="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div class="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" @click="emit('close')" />
      <div class="relative bg-cream rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
        <h3 class="text-lg font-bold text-charcoal mb-2">分享你的人格画像</h3>
        <p class="text-sm text-text-muted mb-5">长按保存下方卡片</p>
        <div class="rounded-2xl p-5 flex flex-col items-center" :style="{background:`linear-gradient(160deg,${typeColor.hex}10,${typeColor.hex}25,#FAFAF8)`}">
          <p class="text-5xl font-black tracking-wide mb-2" :style="{color:typeColor.hex}">{{typeCode}}</p>
          <p class="text-lg font-bold text-charcoal mb-1">{{typeName}}</p>
          <div v-if="qrDataUrl" class="bg-white rounded-2xl p-3"><img :src="qrDataUrl" class="w-28 h-28" /></div>
          <p class="text-xs text-text-muted mt-2">扫码测测你的人格类型</p>
        </div>
        <button @click="emit('close')" class="mt-4 px-4 py-3 text-sm border border-border rounded-xl w-full">关闭</button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,.modal-leave-active{transition:all .3s ease}
.modal-enter-from,.modal-leave-to{opacity:0}
</style>
