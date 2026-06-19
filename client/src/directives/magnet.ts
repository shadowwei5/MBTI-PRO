// v-magnet 指令：鼠标悬停时元素轻微跟随光标
import type { Directive } from 'vue'

export const vMagnet: Directive<HTMLElement, number> = {
  mounted(el, binding) {
    const strength = binding.value ?? 8

    function onMove(e: MouseEvent) {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      const rx = +(y / rect.height * strength).toFixed(1)
      const ry = -(x / rect.width * strength).toFixed(1)
      el.style.transition = 'transform 0.1s ease-out'
      el.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(2px)`
    }

    function onLeave() {
      el.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      el.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) translateZ(0px)'
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)

    // store for cleanup
    ;(el as any).__magnetCleanup = () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  },

  unmounted(el) {
    ;(el as any).__magnetCleanup?.()
  },
}
