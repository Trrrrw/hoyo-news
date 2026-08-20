import dayjs from 'dayjs'

export function formatPublishTime(time: string | null): string {
  if (!time) return '时间未知'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : time
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 去掉 intro 中的 HTML 标签与常见实体，保留段落/换行结构（仅去除首尾空白），用于纯文本展示 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<img[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_s, n: string) => String.fromCharCode(Number(n)))
    .trim()
}
