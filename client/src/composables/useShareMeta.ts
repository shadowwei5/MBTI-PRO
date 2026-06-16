import { watch, onUnmounted } from 'vue'

export function useShareMeta(
  title: () => string,
  description: () => string,
  imageUrl?: () => string,
) {
  function setMeta(property: string, content: string) {
    let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('property', property)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  function setNameMeta(name: string, content: string) {
    let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
    if (!el) {
      el = document.createElement('meta')
      el.setAttribute('name', name)
      document.head.appendChild(el)
    }
    el.setAttribute('content', content)
  }

  const stop = watch(
    () => ({ t: title(), d: description(), i: imageUrl?.() }),
    ({ t, d, i }) => {
      document.title = `${t} | MBTI-PRO`
      setMeta('og:title', `${t} | MBTI-PRO 81型人格`)
      setMeta('og:description', d)
      setMeta('og:type', 'article')
      setNameMeta('description', d)
      setNameMeta('twitter:title', `${t} | MBTI-PRO`)
      setNameMeta('twitter:description', d)
      if (i) {
        setMeta('og:image', i)
        setNameMeta('twitter:image', i)
        setNameMeta('twitter:card', 'summary_large_image')
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    stop()
    document.title = 'MBTI-PRO | 81型人格测试'
  })
}
