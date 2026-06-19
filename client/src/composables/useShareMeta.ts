import { watch, onUnmounted } from 'vue'

export function useShareMeta(
  title: () => string,
  description: () => string,
  imageUrl?: () => string,
  typeCode?: () => string,
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
      // Canonical URL
      const code = typeCode?.()
      if (code) {
        let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
        if (!el) {
          el = document.createElement('link')
          el.setAttribute('rel', 'canonical')
          document.head.appendChild(el)
        }
        el.setAttribute('href', `${window.location.origin}/result/${code}`)
      }
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
