import type { Dayjs } from 'dayjs'

export interface FilterValues {
  q?: string
  search_body: boolean
  tags: string[]
  characters: string[]
  untagged: boolean
  news_type: 'all' | 'article' | 'video'
  during: [Dayjs | null, Dayjs | null] | null
  reverse: boolean
}

export const DEFAULT_FILTER_VALUES: FilterValues = {
  q: undefined,
  search_body: false,
  tags: [],
  characters: [],
  untagged: false,
  news_type: 'all',
  during: null,
  reverse: false,
}

export const DEFAULT_PAGE_SIZE = 20
export const UNTAGGED_TAG_VALUE = '__untagged__'

export interface TagOption {
  label: string
  value: string
  count?: number
}

export interface TagOptionGroup {
  label: string
  options: TagOption[]
}

export type TagOptionItem = TagOption | TagOptionGroup

export function normalizeFilters(values: Partial<FilterValues>): FilterValues {
  const rawTags = values.tags ?? []
  const hasUntaggedSentinel = rawTags.includes(UNTAGGED_TAG_VALUE)
  const tags = Array.from(new Set(rawTags.filter(tag => tag && tag !== UNTAGGED_TAG_VALUE)))
  const characters = Array.from(new Set((values.characters ?? []).filter(Boolean)))
  const trimmedQ = values.q?.trim() || undefined
  const during =
    values.during && (values.during[0] || values.during[1])
      ? ([values.during[0] ?? null, values.during[1] ?? null] as [Dayjs | null, Dayjs | null])
      : null

  return {
    q: trimmedQ,
    search_body: Boolean(values.search_body),
    tags,
    characters,
    untagged: Boolean(values.untagged || hasUntaggedSentinel),
    news_type: values.news_type === 'article' || values.news_type === 'video' ? values.news_type : 'all',
    during,
    reverse: Boolean(values.reverse),
  }
}

/** 统计筛选抽屉内已激活的条件数量（日期范围、标签、未分类、角色） */
export function countDrawerFilters(filters: FilterValues): number {
  let count = 0
  if (filters.during?.[0] || filters.during?.[1]) count += 1
  count += filters.tags.length
  if (filters.untagged) count += 1
  count += filters.characters.length
  return count
}

export function hasActiveFilters(filters: FilterValues): boolean {
  return Boolean(
    filters.q ||
      filters.tags.length > 0 ||
      filters.untagged ||
      filters.characters.length > 0 ||
      filters.news_type !== 'all' ||
      filters.during?.[0] ||
      filters.during?.[1] ||
      filters.reverse,
  )
}

export function serializeFiltersKey(filters: FilterValues): string {
  return JSON.stringify({
    q: filters.q ?? '',
    search_body: filters.q ? filters.search_body : false,
    tags: filters.tags,
    characters: filters.characters,
    untagged: filters.untagged,
    news_type: filters.news_type,
    from: filters.during?.[0]?.format('YYYY-MM-DD') ?? '',
    to: filters.during?.[1]?.format('YYYY-MM-DD') ?? '',
    reverse: filters.reverse,
  })
}

export function buildRssUrl(
  baseUrl: string,
  gameId: string,
  sourceId: string,
  filters: FilterValues,
  limit: number,
): string {
  const params = new URLSearchParams()
  params.set('game', gameId)
  params.set('source', sourceId)
  params.set('limit', String(limit))

  if (filters.q) {
    params.set('q', filters.q)
    if (filters.search_body) params.set('search_body', 'true')
  }
  for (const character of filters.characters) params.append('character', character)
  for (const tag of filters.tags) params.append('tag', tag)
  if (filters.untagged) params.set('untagged', 'true')
  if (filters.news_type !== 'all') params.set('news_type', filters.news_type)
  if (filters.during?.[0]) params.set('published_from', filters.during[0].format('YYYY-MM-DD'))
  if (filters.during?.[1]) params.set('published_to', filters.during[1].format('YYYY-MM-DD'))

  return `${baseUrl}/api/v1/news/rss?${params.toString()}`
}
