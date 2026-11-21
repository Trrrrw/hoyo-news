import dayjs from 'dayjs'

export function formatPublishTime(time: string | null): string {
  if (!time) return '时间未知'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : time
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 去掉 intro 中的 HTML 标签与常见实体，保留段落/换行结构，用于纯文本摘要展示 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<img[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_s, n: string) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const REMOVED_TAGS = new Set(['script', 'style', 'video', 'object', 'embed', 'form', 'input', 'button'])

/**
 * 清理正文 HTML：
 * 1. 移除视频（由专用播放器通过签名接口播放）与不安全脚本标签
 * 2. 清理内联事件处理器和 javascript: 协议
 * 3. 外链统一新标签页打开，图片启用懒加载
 * 4. 清除会破坏深色模式对比度的硬编码文本/背景颜色
 */
export function sanitizeNewsHtml(html: string | null | undefined): string {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<video[\s\S]*?<\/video>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '')
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')

  for (const tag of REMOVED_TAGS) {
    doc.body.querySelectorAll(tag).forEach(node => node.remove())
  }

  doc.body.querySelectorAll('*').forEach(element => {
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim()
      if (name.startsWith('on')) {
        element.removeAttribute(attr.name)
        continue
      }
      if ((name === 'href' || name === 'src') && /^javascript:/i.test(value)) {
        element.removeAttribute(attr.name)
      }
    }

    if (element instanceof HTMLElement && element.style.length > 0) {
      element.style.removeProperty('color')
      element.style.removeProperty('background')
      element.style.removeProperty('background-color')
      element.style.removeProperty('font-family')
      element.style.removeProperty('font-size')
      element.style.removeProperty('line-height')
      if (!element.getAttribute('style')?.trim()) {
        element.removeAttribute('style')
      }
    }

    if (element.tagName === 'A') {
      const href = element.getAttribute('href')
      if (href && /^https?:\/\//i.test(href)) {
        element.setAttribute('target', '_blank')
        element.setAttribute('rel', 'noopener noreferrer')
      }
    }

    if (element.tagName === 'IMG') {
      element.setAttribute('loading', 'lazy')
      element.setAttribute('decoding', 'async')
      element.removeAttribute('width')
      element.removeAttribute('height')
    }
  })

  return doc.body.innerHTML
}
