import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { UNTAGGED_TAG_VALUE } from './components/FilterPanel'
import type { FilterValues } from './components/FilterPanel'

export interface NewsRouteState {
  gameId: string | null
  sourceId: string | null
  page: number
  values: Partial<FilterValues>
}

function parseInteger(value: string | null, fallback: number, minimum: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback
}

function parseDate(value: string | null): Dayjs | null {
  if (!value) return null
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed : null
}

export function readNewsRoute(): NewsRouteState {
  const params = new URLSearchParams(window.location.search)
  const pathParts = window.location.pathname.split('/').filter(Boolean)
  const limit = parseInteger(params.get('limit'), 20, 1)
  const offset = parseInteger(params.get('offset'), 0, 0)
  const newsType = params.get('news_type')
  const publishedFrom = parseDate(params.get('published_from'))
  const publishedTo = parseDate(params.get('published_to'))
  const hasDateRange = publishedFrom != null || publishedTo != null
  const untagged = params.get('untagged') === 'true'
  const routeTags = params.getAll('tag')
  const tags = untagged ? [...routeTags, UNTAGGED_TAG_VALUE] : routeTags

  return {
    gameId: pathParts[0] ? decodeURIComponent(pathParts[0]) : null,
    sourceId: params.get('source'),
    page: Math.floor(offset / limit) + 1,
    values: {
      q: params.get('q') || undefined,
      tags: tags.length ? tags : undefined,
      characters: params.getAll('character').length ? params.getAll('character') : undefined,
      untagged,
      news_type: newsType === 'article' || newsType === 'video' ? newsType : 'all',
      during: hasDateRange ? [publishedFrom, publishedTo] : null,
      limit,
      reverse: params.get('order') === 'asc',
    },
  }
}

export function writeNewsRoute(
  gameId: string,
  sourceId: string,
  values: FilterValues,
  page: number,
  limit: number,
) {
  const params = new URLSearchParams()
  params.set('source', sourceId)

  const q = values.q?.trim()
  if (q) params.set('q', q)
  const hasUntagged = Boolean(values.untagged || values.tags?.includes(UNTAGGED_TAG_VALUE))
  for (const tag of values.tags ?? []) {
    if (tag !== UNTAGGED_TAG_VALUE) params.append('tag', tag)
  }
  for (const character of values.characters ?? []) params.append('character', character)
  if (hasUntagged) params.set('untagged', 'true')
  if (values.news_type !== 'all') params.set('news_type', values.news_type)
  if (values.during?.[0]) params.set('published_from', values.during[0].format('YYYY-MM-DD'))
  if (values.during?.[1]) params.set('published_to', values.during[1].format('YYYY-MM-DD'))
  params.set('limit', String(limit))
  params.set('offset', String(Math.max(0, (page - 1) * limit)))
  params.set('order', values.reverse ? 'asc' : 'desc')

  window.history.replaceState(null, '', `/${encodeURIComponent(gameId)}?${params.toString()}`)
}
