import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchGameCharacters,
  fetchGames,
  fetchNews,
  fetchNewsSources,
  fetchNewsTags,
  fetchNewsTotal,
} from '../api'
import type { GameCharacter, GameSummary, NewsItem, NewsSource, NewsTagGroup } from '../api'
import { DEFAULT_FILTER_VALUES, normalizeFilters, serializeFiltersKey } from '../filters'
import type { FilterValues } from '../filters'
import { readNewsRoute, writeNewsRoute } from '../newsRoute'

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '请求失败，请稍后重试'
}

// 同一页面会话复用已完成和进行中的请求，失败结果不缓存
function cachedRequest<T>(cache: Map<string, Promise<T>>, key: string, request: () => Promise<T>): Promise<T> {
  const existing = cache.get(key)
  if (existing) return existing
  const pending = request().catch(error => {
    if (cache.get(key) === pending) cache.delete(key)
    throw error
  })
  cache.set(key, pending)
  return pending
}

interface SourcesResult {
  gameId: string
  items: NewsSource[]
  error: string | null
}

interface NewsResult {
  key: string
  items: NewsItem[]
  total: number
  limit: number
  error: string | null
}

interface SourceTotalResult {
  key: string
  total: number | null
}

interface TagsResult {
  key: string
  groups: NewsTagGroup[]
  untaggedTotal: number
  error: string | null
}

interface CharactersResult {
  key: string
  items: GameCharacter[]
  error: string | null
}

interface RouteBootstrap {
  gameId: string | null
  sourceId: string | null
  page: number
  limit: number
  filters: FilterValues
}

export function useNewsFeed(filterDrawerOpen: boolean) {
  const initial = useMemo<RouteBootstrap>(() => readNewsRoute(), [])

  const [gamesState, setGamesState] = useState<{ items: GameSummary[]; error: string | null } | null>(null)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(initial.gameId)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(initial.sourceId)
  const [filters, setFilters] = useState<FilterValues>(initial.filters)
  const [page, setPage] = useState<number>(initial.page)
  const [pageSize, setPageSize] = useState<number>(initial.limit)
  const [refreshRevision, setRefreshRevision] = useState(0)

  const pendingHistoryModeRef = useRef<'replace' | 'push'>('replace')

  const [sourcesResult, setSourcesResult] = useState<SourcesResult | null>(null)
  const [newsResult, setNewsResult] = useState<NewsResult | null>(null)
  const [sourceTotalResult, setSourceTotalResult] = useState<SourceTotalResult | null>(null)
  const [tagsResult, setTagsResult] = useState<TagsResult | null>(null)
  const [charactersResult, setCharactersResult] = useState<CharactersResult | null>(null)
  const [knownCharacterNames, setKnownCharacterNames] = useState<Record<string, string>>({})

  const characterCacheRef = useRef(new Map<string, Promise<GameCharacter[]>>())
  const tagCacheRef = useRef(new Map<string, Promise<{ groups: NewsTagGroup[]; untaggedTotal: number }>>())

  // 1. 加载游戏列表（仅一次）
  useEffect(() => {
    const controller = new AbortController()
    fetchGames(controller.signal)
      .then(data => {
        if (controller.signal.aborted) return
        setGamesState({ items: data.items, error: null })
      })
      .catch(error => {
        if (controller.signal.aborted || isAbortError(error)) return
        setGamesState({ items: [], error: toErrorMessage(error) })
      })
    return () => controller.abort()
  }, [])

  // 监听浏览器前进/后退
  useEffect(() => {
    const handlePopState = () => {
      const route = readNewsRoute()
      pendingHistoryModeRef.current = 'replace'
      setSelectedGameId(route.gameId)
      setSelectedSourceId(route.sourceId)
      setFilters(route.filters)
      setPage(route.page)
      setPageSize(route.limit)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const games = useMemo(() => gamesState?.items ?? [], [gamesState])
  const loadingGames = gamesState === null

  // 解析有效的 gameId（优先匹配路由/用户选择，否则回退到第一个游戏）
  const gameId = useMemo(() => {
    if (!games.length) return null
    if (selectedGameId && games.some(item => item.id === selectedGameId)) {
      return selectedGameId
    }
    return games[0].id
  }, [games, selectedGameId])

  // 2. 游戏变化 → 加载新闻来源
  useEffect(() => {
    if (!gameId) return
    const controller = new AbortController()
    fetchNewsSources(gameId, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return
        setSourcesResult({ gameId, items: data.items, error: null })
      })
      .catch(error => {
        if (controller.signal.aborted || isAbortError(error)) return
        setSourcesResult({ gameId, items: [], error: toErrorMessage(error) })
      })
    return () => controller.abort()
  }, [gameId])

  const sources = useMemo(
    () => (gameId && sourcesResult?.gameId === gameId ? sourcesResult.items : []),
    [gameId, sourcesResult],
  )
  const loadingSources = Boolean(gameId) && sourcesResult?.gameId !== gameId

  // 解析有效的 sourceId
  const sourceId = useMemo(() => {
    if (!sources.length) return null
    if (selectedSourceId && sources.some(item => item.id === selectedSourceId)) {
      return selectedSourceId
    }
    return sources[0].id
  }, [sources, selectedSourceId])

  // 3. 来源变化或手动刷新 → 加载当前来源总数
  const sourceTotalKey = gameId && sourceId ? `${gameId}:${sourceId}:${refreshRevision}` : null
  useEffect(() => {
    if (!gameId || !sourceId || !sourceTotalKey) return
    const controller = new AbortController()
    fetchNewsTotal(gameId, sourceId, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return
        setSourceTotalResult({ key: sourceTotalKey, total: data.total })
      })
      .catch(error => {
        if (controller.signal.aborted || isAbortError(error)) return
        setSourceTotalResult({ key: sourceTotalKey, total: null })
      })
    return () => controller.abort()
  }, [gameId, sourceId, sourceTotalKey])

  const sourceTotal = sourceTotalResult?.key === sourceTotalKey ? sourceTotalResult.total : null

  // 4. 加载新闻列表（带 AbortController 自动取消过期请求）
  const filtersKey = useMemo(() => serializeFiltersKey(filters), [filters])
  const newsRequestKey =
    gameId && sourceId ? `${gameId}:${sourceId}:${page}:${pageSize}:${filtersKey}:${refreshRevision}` : null

  useEffect(() => {
    if (!gameId || !sourceId || !newsRequestKey) return
    const controller = new AbortController()

    fetchNews(
      {
        game_id: gameId,
        source: sourceId,
        q: filters.q,
        search_body: filters.q ? filters.search_body : undefined,
        tag: filters.tags.length ? filters.tags : undefined,
        untagged: filters.untagged || undefined,
        character: filters.characters.length ? filters.characters : undefined,
        news_type: filters.news_type === 'all' ? undefined : filters.news_type,
        published_from: filters.during?.[0]?.format('YYYY-MM-DD'),
        published_to: filters.during?.[1]?.format('YYYY-MM-DD'),
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: filters.reverse ? 'asc' : 'desc',
      },
      controller.signal,
    )
      .then(data => {
        if (controller.signal.aborted) return
        setNewsResult({
          key: newsRequestKey,
          items: data.items,
          total: data.total,
          limit: data.limit,
          error: null,
        })
        const mode = pendingHistoryModeRef.current
        pendingHistoryModeRef.current = 'replace'
        writeNewsRoute(gameId, sourceId, filters, page, data.limit, mode)
      })
      .catch(error => {
        if (controller.signal.aborted || isAbortError(error)) return
        setNewsResult({
          key: newsRequestKey,
          items: [],
          total: 0,
          limit: pageSize,
          error: toErrorMessage(error),
        })
      })

    return () => controller.abort()
  }, [gameId, sourceId, filters, page, pageSize, newsRequestKey])

  const loadingNews = Boolean(newsRequestKey) && newsResult?.key !== newsRequestKey
  const news = newsResult?.error ? [] : (newsResult?.items ?? [])
  const total = newsResult?.error ? 0 : (newsResult?.total ?? 0)
  const effectivePageSize = newsResult?.limit ?? pageSize
  const hasLoadedNews = newsResult !== null

  // 5. 按需加载标签（打开筛选抽屉时），按游戏与来源缓存
  const tagsKey = filterDrawerOpen && gameId && sourceId ? `${gameId}:${sourceId}:${refreshRevision}` : null
  useEffect(() => {
    if (!filterDrawerOpen || !gameId || !sourceId || !tagsKey) return
    let active = true
    const cacheKey = `${gameId}:${sourceId}`
    cachedRequest(tagCacheRef.current, cacheKey, () =>
      fetchNewsTags(gameId, sourceId).then(data => ({
        groups: data.groups,
        untaggedTotal: data.untagged.news_count.total,
      })),
    )
      .then(data => {
        if (!active) return
        setTagsResult({
          key: tagsKey,
          groups: data.groups,
          untaggedTotal: data.untaggedTotal,
          error: null,
        })
      })
      .catch(error => {
        if (!active) return
        setTagsResult({
          key: tagsKey,
          groups: [],
          untaggedTotal: 0,
          error: toErrorMessage(error),
        })
      })
    return () => {
      active = false
    }
  }, [filterDrawerOpen, gameId, sourceId, tagsKey])

  const activeTagsKey = gameId && sourceId ? `${gameId}:${sourceId}:${refreshRevision}` : null
  const tagGroups = useMemo(
    () => (activeTagsKey && tagsResult?.key === activeTagsKey ? tagsResult.groups : []),
    [activeTagsKey, tagsResult],
  )
  const untaggedTotal =
    activeTagsKey && tagsResult?.key === activeTagsKey ? tagsResult.untaggedTotal : null
  const loadingTags = Boolean(tagsKey) && tagsResult?.key !== tagsKey

  // 6. 按需加载角色（打开筛选抽屉，或 URL 中已有已选角色需要反查名称时）
  const shouldLoadCharacters = Boolean(gameId) && (filterDrawerOpen || filters.characters.length > 0)
  const charactersKey = shouldLoadCharacters && gameId ? `${gameId}:${refreshRevision}` : null
  useEffect(() => {
    if (!shouldLoadCharacters || !gameId || !charactersKey) return
    let active = true
    cachedRequest(characterCacheRef.current, gameId, () =>
      fetchGameCharacters(gameId).then(items => items.filter(item => item.name)),
    )
      .then(items => {
        if (!active) return
        setCharactersResult({ key: charactersKey, items, error: null })
      })
      .catch(error => {
        if (!active) return
        setCharactersResult({ key: charactersKey, items: [], error: toErrorMessage(error) })
      })
    return () => {
      active = false
    }
  }, [shouldLoadCharacters, gameId, charactersKey])

  const activeCharactersKey = gameId ? `${gameId}:${refreshRevision}` : null
  const characters = useMemo(
    () => (activeCharactersKey && charactersResult?.key === activeCharactersKey ? charactersResult.items : []),
    [activeCharactersKey, charactersResult],
  )
  const loadingCharacters = Boolean(charactersKey) && charactersResult?.key !== charactersKey

  const characterNameMap = useMemo(() => {
    const map: Record<string, string> = { ...knownCharacterNames }
    if (gameId) {
      for (const character of characters) {
        map[`${gameId}:${character.id}`] = character.name
      }
    }
    return map
  }, [characters, gameId, knownCharacterNames])

  // 聚合当前最高优先级错误
  const error =
    gamesState?.error ??
    (sourcesResult?.gameId === gameId ? sourcesResult.error : null) ??
    (newsResult?.key === newsRequestKey ? newsResult.error : null) ??
    null

  const drawerError =
    (tagsResult?.key === activeTagsKey ? tagsResult.error : null) ??
    (charactersResult?.key === activeCharactersKey ? charactersResult.error : null) ??
    error

  // 操作方法
  const selectGame = useCallback(
    (nextGameId: string) => {
      if (nextGameId === gameId) return
      pendingHistoryModeRef.current = 'push'
      setSelectedGameId(nextGameId)
      setSelectedSourceId(null)
      setPage(1)
      // 切换游戏时清空游戏专属的标签和角色条件
      setFilters(current =>
        normalizeFilters({
          ...current,
          tags: [],
          untagged: false,
          characters: [],
        }),
      )
    },
    [gameId],
  )

  const selectSource = useCallback(
    (nextSourceId: string) => {
      if (nextSourceId === sourceId) return
      pendingHistoryModeRef.current = 'push'
      setSelectedSourceId(nextSourceId)
      setPage(1)
      // 标签按来源隔离，切换来源时清空标签条件
      setFilters(current =>
        normalizeFilters({
          ...current,
          tags: [],
          untagged: false,
        }),
      )
    },
    [sourceId],
  )

  const updateFilters = useCallback((patch: Partial<FilterValues>) => {
    setPage(1)
    setFilters(current => normalizeFilters({ ...current, ...patch }))
  }, [])

  const resetFilters = useCallback(() => {
    setPage(1)
    setFilters(DEFAULT_FILTER_VALUES)
  }, [])

  const addTagFilter = useCallback((tag: string) => {
    setPage(1)
    setFilters(current => {
      if (current.tags.includes(tag)) return current
      return normalizeFilters({ ...current, tags: [...current.tags, tag] })
    })
  }, [])

  const addCharacterFilter = useCallback(
    (id: string, name: string) => {
      if (gameId) {
        setKnownCharacterNames(current => ({ ...current, [`${gameId}:${id}`]: name }))
      }
      setPage(1)
      setFilters(current => {
        if (current.characters.includes(id)) return current
        return normalizeFilters({ ...current, characters: [...current.characters, id] })
      })
    },
    [gameId],
  )

  const changePage = useCallback((nextPage: number, nextSize: number) => {
    setPage(nextPage)
    setPageSize(nextSize)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const refresh = useCallback(() => {
    if (!gameId || !sourceId) return
    characterCacheRef.current.delete(gameId)
    tagCacheRef.current.delete(`${gameId}:${sourceId}`)
    setRefreshRevision(value => value + 1)
  }, [gameId, sourceId])

  const game = useMemo(() => games.find(item => item.id === gameId) ?? null, [games, gameId])
  const source = useMemo(() => sources.find(item => item.id === sourceId) ?? null, [sources, sourceId])

  return {
    games,
    game,
    gameId,
    loadingGames,
    sources,
    source,
    sourceId,
    loadingSources,
    filters,
    page,
    pageSize: effectivePageSize,
    news,
    total,
    sourceTotal,
    loadingNews,
    hasLoadedNews,
    tagGroups,
    untaggedTotal,
    loadingTags,
    characters,
    loadingCharacters,
    characterNameMap,
    error,
    drawerError,
    selectGame,
    selectSource,
    updateFilters,
    resetFilters,
    addTagFilter,
    addCharacterFilter,
    changePage,
    refresh,
  }
}
