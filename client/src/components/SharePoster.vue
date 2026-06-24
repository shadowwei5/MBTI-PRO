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

const emit = defineEmits<{
  close: []
}>()

const qrDataUrl = ref('')
const generatedImageUrl = ref('')
const isGenerating = ref(true)
const showModal = ref(false)
const hasError = ref(false)

const W = 750
const H = 1334

// 二维码指向测试页（带追踪参数，便于统计分享转化）
async function generateQR() {
  try {
    const baseUrl = window.location.origin
    qrDataUrl.value = await QRCode.toDataURL(`${baseUrl}/#/test?ref=share`, {
      width: 180,
      margin: 1,
      color: { dark: '#2D2D2D', light: '#FFFFFF' },
    })
  } catch { /* fallback */ }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

async function drawPoster() {
  const canvas = document.createElement('canvas')
  canvas.width = W * 2
  canvas.height = H * 2
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)

  // 1. 背景
  const bgGrad = ctx.createLinearGradient(0, 0, W, H)
  bgGrad.addColorStop(0, props.typeColor.hex + '10')
  bgGrad.addColorStop(0.3, props.typeColor.hex + '25')
  bgGrad.addColorStop(0.65, '#FAFAF8')
  bgGrad.addColorStop(1, props.typeColor.hex + '15')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  // 2. 顶部装饰条
  const topGrad = ctx.createLinearGradient(0, 0, W, 0)
  topGrad.addColorStop(0, props.typeColor.hex)
  topGrad.addColorStop(1, props.groupColor.hex)
  ctx.fillStyle = topGrad
  ctx.fillRect(0, 0, W, 2)

  let y = 72

  // 3. Brand
  ctx.fillStyle = '#9C958E'
  ctx.font = '12px "Noto Sans SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('MBTI PRO', W / 2, y); y += 20
  ctx.font = '10px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#9C958E99'
  ctx.fillText('81 型人格深度测试', W / 2, y); y += 44

  // 4. AI 人格图片（使用缩略图加速，海报显示尺寸约 480px）
  try {
    const thumbUrl = props.imageUrl.replace('/api/images/', '/api/thumbs/').replace('.jpg', '.webp')
    const avatar = await loadImage(thumbUrl)
    const imgSize = 480
    const imgX = (W - imgSize) / 2
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 8
    roundRect(ctx, imgX, y, imgSize, imgSize, 48)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.restore()
    ctx.save()
    roundRect(ctx, imgX, y, imgSize, imgSize, 48); ctx.clip()
    ctx.drawImage(avatar, imgX, y, imgSize, imgSize)
    const maskGrad = ctx.createLinearGradient(0, y + imgSize * 0.67, 0, y + imgSize)
    maskGrad.addColorStop(0, 'transparent'); maskGrad.addColorStop(1, props.typeColor.hex + '30')
    ctx.fillStyle = maskGrad; ctx.fillRect(imgX, y, imgSize, imgSize)
    ctx.restore()
    y += imgSize + 44
  } catch { y += 16 }

  // 5. 类型代码
  ctx.font = '900 88px "Playfair Display", serif'
  ctx.fillStyle = props.typeColor.hex
  ctx.textAlign = 'center'
  ctx.fillText(props.typeCode, W / 2, y + 72); y += 100

  // 6. 类型名称
  ctx.font = 'bold 28px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#2D2D2D'
  ctx.fillText(props.typeName, W / 2, y + 22); y += 44

  // 7.四维状态条 — 圆圈中显示数字得分
  if (props.scores && props.chars) {
    const dims = [
      { key: 'E_I' as const, label: '能量来源', left: 'I', right: 'E', leftColor: '#5C8DFF', rightColor: '#FF8A65' },
      { key: 'S_N' as const, label: '认知方式', left: 'N', right: 'S', leftColor: '#9C6FFF', rightColor: '#69F0AE' },
      { key: 'T_F' as const, label: '决策方式', left: 'F', right: 'T', leftColor: '#1DA8FF', rightColor: '#FFD740' },
      { key: 'P_J' as const, label: '生活态度', left: 'P', right: 'J', leftColor: '#E6B800', rightColor: '#82B1FF' },
    ]
    const barW = 520; const barH = 28; const barX = (W - barW) / 2
    const dimGap = 42; const dimStartY = y

    dims.forEach((dim, i) => {
      const dy = dimStartY + i * dimGap
      const score = props.scores![dim.key]
      const pos = Math.max(3, Math.min(97, 50 + (score / 50) * 47))

      ctx.font = 'bold 16px "Noto Sans SC", sans-serif'
      ctx.textAlign = 'left'; ctx.fillStyle = dim.leftColor
      ctx.fillText(dim.left, barX - 44, dy + barH / 2 + 6)
      ctx.textAlign = 'right'; ctx.fillStyle = dim.rightColor
      ctx.fillText(dim.right, barX + barW + 44, dy + barH / 2 + 6)

      // 背景条
      ctx.fillStyle = '#F0EDE6'; roundRect(ctx, barX, dy, barW, barH, barH / 2); ctx.fill()
      ctx.fillStyle = '#D8D4CA30'; ctx.fillRect(barX + barW / 3, dy, barW / 3, barH)

      // 圆点 — 显示数字得分
      const dotX = barX + (barW * pos) / 100; const dotY = dy + barH / 2; const dotR = 11
      ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      ctx.fillStyle = dim.leftColor; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()

      // 数字得分（非字母）
      ctx.font = 'bold 10px "DM Mono", monospace'
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
      const displayScore = score > 0 ? `+${score}` : `${score}`
      ctx.fillText(displayScore, dotX, dotY + 3)
    })

    y = dimStartY + dims.length * dimGap + 32
  }

  // 8. 分隔线
  ctx.strokeStyle = '#E0D8CC'; ctx.lineWidth = 1; ctx.beginPath()
  ctx.moveTo((W - 96) / 2, y); ctx.lineTo((W + 96) / 2, y); ctx.stroke()
  y += 48

  // 9. 二维码（白底+圆角确保完整显示）
  try {
    const qrImg = await loadImage(qrDataUrl.value)
    const qrSize = 156; const qrX = (W - qrSize) / 2
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4
    roundRect(ctx, qrX - 16, y - 16, qrSize + 32, qrSize + 32, 20)
    ctx.fillStyle = '#ffffff'; ctx.fill()
    ctx.restore()
    ctx.drawImage(qrImg, qrX, y, qrSize, qrSize)
    y += qrSize + 28
  } catch { y += 16 }

  // 10. 扫码文字
  ctx.font = '600 18px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#2D2D2D'
  ctx.fillText('扫码测测你的人格类型', W / 2, y + 16); y += 30
  ctx.font = '13px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#9C958E'
  ctx.fillText('发现你的 81 型专属人格画像', W / 2, y + 12); y += 50

  // 11. Footer
  ctx.font = '11px "Noto Sans SC", sans-serif'
  ctx.fillStyle = '#9C958E80'
  ctx.fillText('测试结果仅供个人参考，不构成任何临床诊断依据', W / 2, y + 10)

  generatedImageUrl.value = canvas.toDataURL('image/jpeg', 0.90)
}

onMounted(async () => {
  await generateQR()
  try { await drawPoster() }
  catch { hasError.value = true }
  finally { isGenerating.value = false; showModal.value = true }
})

function downloadPoster() {
  if (!generatedImageUrl.value) return
  const a = document.createElement('a')
  a.href = generatedImageUrl.value
  a.download = `MBTI-PRO-${props.typeCode}.jpg`
  a.click()
}

async function copyToClipboard() {
  if (!generatedImageUrl.value) return
  try {
    const blob = await (await fetch(generatedImageUrl.value)).blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
  } catch { downloadPoster() }
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
      <div class="relative bg-cream rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
        <h3 class="text-lg font-display font-bold text-charcoal mb-2 text-center">分享你的人格画像</h3>
        <p class="text-sm text-text-muted text-center mb-5">长按保存图片，分享到朋友圈</p>
        <div class="rounded-2xl overflow-hidden mb-5" style="box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
          <img :src="generatedImageUrl" :alt="`${typeCode} 分享海报`" class="w-full" />
        </div>
        <div class="flex gap-3">
          <button @click="emit('close')" class="flex-1 px-4 py-3 text-sm font-medium text-text-secondary border border-border rounded-xl hover:bg-surface-alt transition-all duration-300">关闭</button>
          <button @click="downloadPoster" class="flex-1 px-4 py-3 text-sm font-semibold bg-charcoal text-cream rounded-xl hover:shadow-lg transition-all duration-300">保存图片</button>
          <button @click="copyToClipboard" class="flex-1 px-4 py-3 text-sm font-semibold text-white rounded-xl hover:shadow-lg transition-all duration-300" :style="{ background: typeColor.hex }">复制图片</button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="modal">
    <div v-if="showError" class="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div class="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" @click="emit('close')" />
      <div class="relative bg-cream rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
        <h3 class="text-lg font-display font-bold text-charcoal mb-2 text-center">分享你的人格画像</h3>
        <p class="text-sm text-text-muted text-center mb-5">长按保存下方卡片，分享到朋友圈</p>
        <div class="rounded-2xl p-5 mb-5 flex flex-col items-center" :style="{ background: `linear-gradient(160deg, ${typeColor.hex}10 0%, ${typeColor.hex}25 30%, #FAFAF8 65%, ${typeColor.hex}15 100%)` }">
          <p class="text-[48px] font-black tracking-[0.08em] leading-none mb-2" :style="{ color: typeColor.hex }">{{ typeCode }}</p>
          <p class="text-lg font-bold text-charcoal mb-1">{{ typeName }}</p>
          <p class="text-xs text-text-secondary text-center mb-4">{{ oneLiner }}</p>
          <div v-if="qrDataUrl" class="bg-white rounded-2xl p-3 mb-2">
            <img :src="qrDataUrl" alt="QR" class="w-[120px] h-[120px]" />
          </div>
          <p class="text-[10px] text-text-muted">扫码测测你的人格类型</p>
        </div>
        <div class="flex gap-3">
          <button @click="emit('close')" class="flex-1 px-4 py-3 text-sm font-medium text-text-secondary border border-border rounded-xl hover:bg-surface-alt transition-all duration-300">关闭</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
