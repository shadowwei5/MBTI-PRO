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
  try { qrDataUrl.value = await QRCode.toDataURL(`${location.origin}/#/test?ref=share`, { width: 100, margin: 0, color: { dark: '#1A1A1A', light: '#FFFFFF' } }) } catch {}
}
function loadImage(s: string): Promise<HTMLImageElement> { return new Promise((rs, rj) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => rs(i); i.onerror = rj; i.src = s }) }
function rRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

async function drawPoster() {
  const cvs = document.createElement('canvas'); cvs.width = W * 2; cvs.height = H * 2
  const ctx = cvs.getContext('2d')!; ctx.scale(2, 2)

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#FAF8F5'); bg.addColorStop(0.3, '#FFFFFF'); bg.addColorStop(1, '#FAF8F5')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)

  // 顶部色条
  ctx.fillStyle = props.typeColor.hex; ctx.fillRect(0, 0, W, 6)
  const tg = ctx.createLinearGradient(0, 6, 0, 140)
  tg.addColorStop(0, props.typeColor.hex + '18'); tg.addColorStop(1, 'transparent')
  ctx.fillStyle = tg; ctx.fillRect(0, 6, W, 140)

  let y = 40

  // Brand
  ctx.font = 'bold 11px "Noto Sans SC"'; ctx.fillStyle = '#B0A89E'; ctx.textAlign = 'center'
  ctx.fillText('MBTI PRO · 81 型人格深度测试', W / 2, y); y += 28

  // 圆形图片
  const imgSz = 300
  try {
    const avatar = await loadImage(`/api/mediums/${props.typeCode}`)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6
    ctx.beginPath(); ctx.arc(W / 2, y + imgSz / 2, imgSz / 2, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.beginPath(); ctx.arc(W / 2, y + imgSz / 2, imgSz / 2, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(avatar, W / 2 - imgSz / 2, y, imgSz, imgSz)
    ctx.restore()
    // 底部渐变遮罩
    const mk = ctx.createLinearGradient(0, y + imgSz * 0.7, 0, y + imgSz)
    mk.addColorStop(0, 'transparent'); mk.addColorStop(1, props.typeColor.hex + '18')
    ctx.fillStyle = mk
    ctx.beginPath(); ctx.arc(W / 2, y + imgSz / 2, imgSz / 2, 0, Math.PI * 2); ctx.fill()
    y += imgSz + 24
  } catch { y += 16 }

  // 类型代码
  ctx.font = '900 80px "Playfair Display", serif'; ctx.fillStyle = props.typeColor.hex; ctx.textAlign = 'center'
  ctx.fillText(props.typeCode, W / 2, y + 64); y += 80

  // 类型名称
  ctx.font = 'bold 26px "Noto Sans SC"'; ctx.fillStyle = '#2D2D2D'
  ctx.fillText(props.typeName.replace('型', ''), W / 2, y + 20); y += 46

  // 四维状态条 — 加大尺寸和间距
  if (props.scores && props.chars) {
    const dims = [
      { key: 'E_I' as const, left: 'I', right: 'E' },
      { key: 'S_N' as const, left: 'N', right: 'S' },
      { key: 'T_F' as const, left: 'F', right: 'T' },
      { key: 'P_J' as const, left: 'P', right: 'J' },
    ]
    const barW = 530; const barH = 24; const barX = (W - barW) / 2
    const dimGap = 56

    dims.forEach((dim, i) => {
      const dy = y + i * dimGap; const score = props.scores![dim.key]
      const pos = Math.max(3, Math.min(97, 50 + (score / 50) * 47))
      const lc = DIM_COLORS[dim.left]; const rc = DIM_COLORS[dim.right]

      ctx.font = 'bold 16px "Noto Sans SC"'
      ctx.textAlign = 'left'; ctx.fillStyle = lc; ctx.fillText(dim.left, barX - 52, dy + barH / 2 + 6)
      ctx.textAlign = 'right'; ctx.fillStyle = rc; ctx.fillText(dim.right, barX + barW + 52, dy + barH / 2 + 6)

      ctx.fillStyle = '#EAE7E0'; rRect(ctx, barX, dy, barW, barH, barH / 2); ctx.fill()
      ctx.fillStyle = '#D4D0C8'; ctx.fillRect(barX + barW / 2 - 1.5, dy, 3, barH)
      const lg = ctx.createLinearGradient(barX, 0, barX + barW / 2, 0); lg.addColorStop(0, lc + '40'); lg.addColorStop(1, '#EAE7E0')
      ctx.fillStyle = lg; ctx.fillRect(barX, dy, barW / 2, barH)
      const rg = ctx.createLinearGradient(barX + barW / 2, 0, barX + barW, 0); rg.addColorStop(0, '#EAE7E0'); rg.addColorStop(1, rc + '40')
      ctx.fillStyle = rg; ctx.fillRect(barX + barW / 2, dy, barW / 2, barH)

      const dotX = barX + (barW * pos) / 100; const dotY = dy + barH / 2; const dotR = 10
      ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      ctx.fillStyle = pos >= 50 ? rc : lc; ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke()

      ctx.font = 'bold 10px "DM Mono", monospace'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
      ctx.fillText(score > 0 ? `+${score}` : `${score}`, dotX, dotY + 3)
    })
    y += dims.length * dimGap + 40
  }

  // 分隔线
  ctx.strokeStyle = '#E0D8CC'; ctx.lineWidth = 1; ctx.beginPath()
  ctx.moveTo((W - 60) / 2, y); ctx.lineTo((W + 60) / 2, y); ctx.stroke()
  y += 24

  // 底部: 左文字 + 右极小二维码（紧凑一排）
  const qrS = 88; const qrX = W - qrS - 56
  ctx.textAlign = 'left'
  ctx.font = 'bold 16px "Noto Sans SC"'; ctx.fillStyle = '#2D2D2D'
  ctx.fillText('扫码测测你的人格类型', 56, y + 18)
  ctx.font = '12px "Noto Sans SC"'; ctx.fillStyle = '#9C958E'
  ctx.fillText('发现你的 81 型专属人格画像', 56, y + 38)

  try {
    const qrImg = await loadImage(qrDataUrl.value)
    rRect(ctx, qrX - 6, y - 6, qrS + 12, qrS + 12, 10)
    ctx.fillStyle = '#fff'; ctx.fill()
    ctx.drawImage(qrImg, qrX, y, qrS, qrS)
  } catch {}
  y += qrS + 20

  // 免责（紧贴二维码下方）
  ctx.textAlign = 'center'; ctx.font = '10px "Noto Sans SC"'; ctx.fillStyle = '#B0A89E'
  ctx.fillText('测试结果仅供个人参考，不构成任何临床诊断依据', W / 2, y + 6)

  generatedImageUrl.value = cvs.toDataURL('image/jpeg', 0.92)
}

onMounted(async () => {
  await generateQR()
  try { await drawPoster() } catch { hasError.value = true }
  finally { isGenerating.value = false; showModal.value = true }
})

function downloadPoster() { if (!generatedImageUrl.value) return; const a = document.createElement('a'); a.href = generatedImageUrl.value; a.download = `MBTI-PRO-${props.typeCode}.jpg`; a.click() }
async function copyToClipboard() { if (!generatedImageUrl.value) return; try { const b = await (await fetch(generatedImageUrl.value)).blob(); await navigator.clipboard.write([new ClipboardItem({ [b.type]: b })]) } catch { downloadPoster() } }
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
</template>

<style scoped>
.modal-enter-active,.modal-leave-active{transition:all .3s ease}
.modal-enter-from,.modal-leave-to{opacity:0}
</style>
