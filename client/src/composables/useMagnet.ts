// 磁吸效果：鼠标悬停时卡片轻微跟随光标移动
import { ref, onUnmounted, type Ref } from 'vue'

export function useMagnet(elRef: Ref<HTMLElement | null>, strength = 8) {
  const transform = ref('')

  function onMove(e: MouseEvent) {
    const el = elRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    const rotateX = (y / rect.height) * strength
    const rotateY = -(x / rect.width) * strength
    transform.value = `perspective(600px) rotateX(${rotateX.toFixed(1)}deg) rotateY(${rotateY.toFixed(1)}deg) translateZ(2px)`
  }

  function onLeave() {
    transform.value = 'perspective(600px) rotateX(0deg) rotateY(0deg) translateZ(0px)'
  }

  return { transform, onMove, onLeave }
}
