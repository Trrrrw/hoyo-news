import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { DEFAULT_PAGE_SIZE, normalizeFilters } from './filters'
import type { FilterValues } from './filters'

export interface NewsRouteState {
  gameId: string | null
  sourceId: string | null
  page: number
  limit: number
  filters: FilterValues
}

function parseInteger(value: string | null, fallback: number, minimum: number) {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback
}

function parseDate(value: string | null): Dayjs | null {
  if (!value) return null
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed : null
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function readNewsRoute(): NewsRouteState {
  const params = new URLSearchParams(window.location.search)
  const pathParts = window.location.pathname.split('/').filter(Boolean)
  const limit = Math.min(100, parseInteger(params.get('limit'), DEFAULT_PAGE_SIZE, 1))
  const offset = parseInteger(params.get('offset'), 0, 0)
  const newsType = params.get('news_type')
  const publishedFrom = parseDate(params.get('published_from'))
  const publishedTo = parseDate(params.get('published_to'))
  const hasDateRange = publishedFrom != null || publishedTo != null

  return {
    gameId: pathParts[0] ? safeDecodeURIComponent(pathParts[0]) : null,
    sourceId: params.get('source'),
    page: Math.floor(offset / limit) + 1,
    limit,
    filters: normalizeFilters({
      q: params.get('q') || undefined,
      search_body: params.get('search_body') === 'true',
      tags: params.getAll('tag'),
      characters: params.getAll('character'),
      untagged: params.get('untagged') === 'true',
      news_type: newsType === 'article' || newsType === 'video' ? newsType : 'all',
      during: hasDateRange ? [publishedFrom, publishedTo] : null,
      reverse: params.get('order') === 'asc',
    }),
  }
}

export function buildNewsRouteUrl(
  gameId: string,
  sourceId: string,
  filters: FilterValues,
  page: number,
  limit: number,
): string {
  const params = new URLSearchParams()
  params.set('source', sourceId)

  if (filters.q) params.set('q', filters.q)
  if (filters.search_body) params.set('search_body', 'true')
  for (const tag of filters.tags) params.append('tag', tag)
  for (const character of filters.characters) params.append('character', character)
  if (filters.untagged) params.set('untagged', 'true')
  if (filters.news_type !== 'all') params.set('news_type', filters.news_type)
  if (filters.during?.[0]) params.set('published_from', filters.during[0].format('YYYY-MM-DD'))
  if (filters.during?.[1]) params.set('published_to', filters.during[1].format('YYYY-MM-DD'))
  params.set('limit', String(limit))
  params.set('offset', String(Math.max(0, (page - 1) * limit)))
  params.set('order', filters.reverse ? 'asc' : 'desc')

  return `/${encodeURIComponent(gameId)}?${params.toString()}`
}

export function writeNewsRoute(
  gameId: string,
  sourceId: string,
  filters: FilterValues,
  page: number,
  limit: number,
  mode: 'replace' | 'push' = 'replace',
) {
  const nextUrl = buildNewsRouteUrl(gameId, sourceId, filters, page, limit)
  const currentUrl = `${window.location.pathname}${window.location.search}`
  if (nextUrl === currentUrl) return
  if (mode === 'push') {
    window.history.pushState(null, '', nextUrl)
  } else {
    window.history.replaceState(null, '', nextUrl)
  }
}
