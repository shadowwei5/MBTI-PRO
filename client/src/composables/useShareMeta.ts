import { watch, onUnmounted } from 'vue'

function toAbsoluteUrl(url?: string) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  const prefix = url.startsWith('/') ? '' : '/'
  return `${window.location.origin}${prefix}${url}`
}

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

  function setCanonical(url: string) {
    let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!el) {
      el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      document.head.appendChild(el)
    }
    el.setAttribute('href', url)
  }

  const stop = watch(
    () => ({ t: title(), d: description(), i: imageUrl?.(), code: typeCode?.() }),
    ({ t, d, i, code }) => {
      const url = code ? `${window.location.origin}/result/${code}` : window.location.origin
      const absoluteImageUrl = toAbsoluteUrl(i || '/share-card.png')

      document.title = `${t} | MBTI-PRO`
      setMeta('og:title', `${t} | MBTI-PRO 81型人格`)
      setMeta('og:description', d)
      setMeta('og:type', 'article')
      setMeta('og:url', url)
      setMeta('og:image', absoluteImageUrl)
      setMeta('og:image:width', '1200')
      setMeta('og:image:height', '630')
      setNameMeta('description', d)
      setNameMeta('twitter:title', `${t} | MBTI-PRO`)
      setNameMeta('twitter:description', d)
      setNameMeta('twitter:image', absoluteImageUrl)
      setNameMeta('twitter:card', 'summary_large_image')
      setCanonical(url)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    stop()
    document.title = 'MBTI-PRO | 81型人格测试'
  })
}
