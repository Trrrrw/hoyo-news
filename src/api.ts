// Akasha API 客户端（文档: {BASE_URL}/scalar）

export interface NewsCount {
  total: number
  article: number
  video: number
}

export interface NewsCharacter {
  id: string
  name: string
}

export interface NewsItem {
  id: string
  source: string
  title: string
  source_url: string
  cover: string | null
  intro: string | null
  news_type: 'article' | 'video'
  publish_time: string | null
  tags: string[]
  characters: NewsCharacter[]
  video_url: string | null
  video_duration: number | null
}

export interface GameSummary {
  id: string
  name: string
  index: number
  cover: string | null
  icon: string | null
  news_count: NewsCount
  recent_news: { article: NewsItem[]; video: NewsItem[] }
}

export interface NewsSource {
  id: string
  name: string
  index: number
}

export interface GameDataEntry {
  id: string
  name: string | null
}

export interface NewsTag {
  name: string
  index: number
  news_count: NewsCount
  recent: { article: NewsItem[]; video: NewsItem[] }
}

export interface NewsTagGroup {
  name: string | null
  index: number | null
  tags: NewsTag[]
}

export interface NewsTagsList {
  game_id: string
  source: string
  groups: NewsTagGroup[]
  untagged: { news_count: NewsCount; recent: { article: NewsItem[]; video: NewsItem[] } }
}

export interface NewsListPage {
  total: number
  limit: number
  offset: number
  items: NewsItem[]
  meta: { game_id: string; source: string }
}

export interface NewsQuery {
  game_id: string
  source: string
  q?: string
  tag?: string[]
  untagged?: boolean
  character?: string[]
  news_type?: 'article' | 'video'
  /** YYYY-MM-DD，包含当天 */
  published_from?: string
  /** YYYY-MM-DD，包含当天 */
  published_to?: string
  limit: number
  offset: number
  order?: 'asc' | 'desc'
}

/** API 基础地址：优先使用 .env 中的 VITE_DEV_BACKEND_BASE，缺省回退到线上地址 */
export const BASE_URL = import.meta.env.VITE_DEV_BACKEND_BASE || 'https://akasha.trrw.cn'

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { signal })
  if (!res.ok) {
    let message = `请求失败（HTTP ${res.status}）`
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      /* 响应体不是 JSON 时忽略 */
    }
    throw new Error(message)
  }
  return (await res.json()) as T
}

export function fetchGames(signal?: AbortSignal) {
  return request<{ total: number; items: GameSummary[] }>('/api/v1/games', signal)
}

export function fetchNewsSources(gameId: string, signal?: AbortSignal) {
  return request<{ total: number; items: NewsSource[] }>(
    `/api/v1/games/${encodeURIComponent(gameId)}/news/sources`,
    signal,
  )
}

export function fetchNewsTags(gameId: string, sourceId: string, signal?: AbortSignal) {
  return request<NewsTagsList>(
    `/api/v1/games/${encodeURIComponent(gameId)}/news/tags?source=${encodeURIComponent(sourceId)}`,
    signal,
  )
}

/** 获取游戏角色列表，用于新闻角色筛选 */
export async function fetchGameCharacters(gameId: string, signal?: AbortSignal) {
  const pageSize = 100
  const path = (offset: number) =>
    `/api/v1/games/${encodeURIComponent(gameId)}/data/character?limit=${pageSize}&offset=${offset}`
  const first = await request<{
    total: number
    items: GameDataEntry[]
  }>(path(0), signal)

  if (first.items.length >= first.total) return first.items

  const pages = await Promise.all(
    Array.from(
      { length: Math.ceil((first.total - first.items.length) / pageSize) },
      (_, index) => request<{ items: GameDataEntry[] }>(path((index + 1) * pageSize), signal),
    ),
  )
  return [first, ...pages].flatMap(page => page.items)
}

export function fetchNews(query: NewsQuery, signal?: AbortSignal) {
  const params = new URLSearchParams()
  params.set('source', query.source)
  if (query.q) params.set('q', query.q)
  for (const t of query.tag ?? []) params.append('tag', t)
  if (query.untagged) params.set('untagged', 'true')
  for (const character of query.character ?? []) params.append('character', character)
  if (query.news_type) params.set('news_type', query.news_type)
  if (query.published_from) params.set('published_from', query.published_from)
  if (query.published_to) params.set('published_to', query.published_to)
  params.set('limit', String(query.limit))
  params.set('offset', String(query.offset))
  if (query.order) params.set('order', query.order)
  return request<NewsListPage>(
    `/api/v1/games/${encodeURIComponent(query.game_id)}/news?${params.toString()}`,
    signal,
  )
}

/** 获取指定游戏和来源下的新闻总数，不带其他筛选条件 */
export function fetchNewsTotal(gameId: string, sourceId: string, signal?: AbortSignal) {
  return request<{ total: number }>(
    `/api/v1/games/${encodeURIComponent(gameId)}/news?source=${encodeURIComponent(sourceId)}&limit=1&offset=0`,
    signal,
  )
}

/** 获取新闻视频播放地址（米游社等来源需要通过该接口获取有效地址） */
export function fetchNewsVideo(
  gameId: string,
  source: string,
  newsId: string,
  signal?: AbortSignal,
) {
  return request<{ video_url: string }>(
    `/api/v1/games/${encodeURIComponent(gameId)}/news/${encodeURIComponent(newsId)}/media/video?source=${encodeURIComponent(source)}`,
    signal,
  )
}
