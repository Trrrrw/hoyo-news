import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconArrowUp,
  IconBrandGithub,
  IconAdjustments,
  IconLoader2,
  IconMoon,
  IconRefresh,
  IconSun,
  IconSunMoon,
} from '@tabler/icons-react'
import {
  Alert,
  Button,
  Drawer,
  Empty,
  FloatButton,
  Form,
  Input,
  Pagination,
  Select,
  Segmented,
  Tag,
  Spin,
  Tooltip,
} from 'antd'
import {
  BASE_URL,
  fetchGameCharacters,
  fetchGames,
  fetchNews,
  fetchNewsTotal,
  fetchNewsSources,
  fetchNewsTags,
} from './api'
import type { GameDataEntry, GameSummary, NewsItem, NewsSource, NewsTagGroup } from './api'
import FilterPanel from './components/FilterPanel'
import { DEFAULT_FILTER_VALUES, UNTAGGED_TAG_VALUE } from './components/FilterPanel'
import type { FilterValues, TagOptionItem } from './components/FilterPanel'
import NewsDrawer from './components/NewsDrawer'
import NewsItemRow from './components/NewsItemRow'
import { useCopyText } from './hooks/useCopyText'
import { readNewsRoute, writeNewsRoute } from './newsRoute'
import type { NewsRouteState } from './newsRoute'
import { useThemeMode } from './theme/ThemeContext'

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message
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

function ThemeToggle() {
  const { mode, cycleTheme } = useThemeMode()

  const config = {
    light: { icon: <IconSun size={18} />, title: '浅色模式' },
    dark: { icon: <IconMoon size={18} />, title: '深色模式' },
    system: { icon: <IconSunMoon size={18} />, title: '跟随系统' },
  }[mode]

  return (
    <Tooltip placement="bottom" title={config.title}>
      <Button
        type="text"
        shape="circle"
        icon={config.icon}
        aria-label={`当前：${config.title}；点击切换主题`}
        onClick={cycleTheme}
      />
    </Tooltip>
  )
}

export default function App() {
  const [filterForm] = Form.useForm<FilterValues>()
  const copyText = useCopyText()
  const [initialRoute] = useState<NewsRouteState>(() => readNewsRoute())
  const [appliedFilters, setAppliedFilters] = useState<Partial<FilterValues>>(initialRoute.values)
  const [keyword, setKeyword] = useState(() => initialRoute.values.q ?? '')
  const keywordRef = useRef(keyword)
  const filterFormRef = useRef(filterForm)
  const routeUserInteracted = useRef(false)
  const paginationRef = useRef<HTMLDivElement>(null)

  // 必填参数：游戏 + 来源（切换后自动重新加载数据）
  const [games, setGames] = useState<GameSummary[]>([])
  const [gameId, setGameId] = useState<string | null>(null)
  const [sources, setSources] = useState<NewsSource[]>([])
  const [sourceId, setSourceId] = useState<string | null>(null)

  // 可选筛选相关的派生数据
  const [tagGroups, setTagGroups] = useState<NewsTagGroup[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [characters, setCharacters] = useState<GameDataEntry[]>([])
  const [loadingCharacters, setLoadingCharacters] = useState(false)
  const [filterCollapsed, setFilterCollapsed] = useState(true)
  const [selectedCharacterNames, setSelectedCharacterNames] = useState<Record<string, string>>({})
  const characterCache = useRef(new Map<string, Promise<GameDataEntry[]>>())
  const tagCache = useRef(new Map<string, Promise<NewsTagGroup[]>>())
  const [filterRevision, setFilterRevision] = useState(0)

  // 新闻详情抽屉
  const [drawerItem, setDrawerItem] = useState<NewsItem | null>(null)

  // 新闻列表 + 分页
  const [news, setNews] = useState<NewsItem[]>([])
  const [total, setTotal] = useState(0)
  const [sourceTotal, setSourceTotal] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loadingNews, setLoadingNews] = useState(false)
  const [loadingGames, setLoadingGames] = useState(true)
  const [loadingSources, setLoadingSources] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reqSeq = useRef(0)

  const getCurrentFilterValues = useCallback(
    () => ({
      ...filterFormRef.current.getFieldsValue(true),
      q: keywordRef.current.trim() || undefined,
    }),
    [],
  )

  useEffect(() => {
    const input = paginationRef.current?.querySelector<HTMLInputElement>(
      '.ant-pagination-options-quick-jumper input',
    )
    if (!input) return
    input.id = 'pagination_quick_page'
    input.name = 'pagination_quick_page'
  }, [page, pageSize, total])

  // 拉取新闻列表（过滤条件 + 分页）
  const refreshNews = useCallback(
    async (opts: { gameId: string; sourceId: string; page: number; values?: Partial<FilterValues> }) => {
      const seq = ++reqSeq.current
      setLoadingNews(true)
      setError(null)
      const values: FilterValues = {
        news_type: 'all',
        during: null,
        limit: 20,
        reverse: false,
        untagged: false,
        characters: undefined,
        ...(opts.values ?? getCurrentFilterValues()),
      }
      const requestValues: FilterValues = {
        ...values,
        tags: values.tags?.filter(tag => tag !== UNTAGGED_TAG_VALUE),
        untagged: Boolean(values.untagged || values.tags?.includes(UNTAGGED_TAG_VALUE)),
      }
      const limit = requestValues.limit && requestValues.limit >= 1 ? requestValues.limit : 20
      const q = requestValues.q?.trim()
      const published_from = requestValues.during?.[0]
        ? requestValues.during[0].format('YYYY-MM-DD')
        : undefined
      const published_to = requestValues.during?.[1]
        ? requestValues.during[1].format('YYYY-MM-DD')
        : undefined

      setAppliedFilters(requestValues)
      try {
        const data = await fetchNews({
          game_id: opts.gameId,
          source: opts.sourceId,
          q: q || undefined,
          tag: requestValues.tags?.length ? requestValues.tags : undefined,
          untagged: requestValues.untagged || undefined,
          character: requestValues.characters?.length ? requestValues.characters : undefined,
          news_type: requestValues.news_type === 'all' ? undefined : requestValues.news_type,
          published_from,
          published_to,
          limit,
          offset: (opts.page - 1) * limit,
          order: requestValues.reverse ? 'asc' : 'desc',
        })
        if (seq !== reqSeq.current) return
        setNews(data.items)
        setTotal(data.total)
        setPage(opts.page)
        setPageSize(data.limit)
        writeNewsRoute(opts.gameId, opts.sourceId, requestValues, opts.page, data.limit)
      } catch (e) {
        if (seq !== reqSeq.current) return
        setNews([])
        setTotal(0)
        setError(toMessage(e))
      } finally {
        if (seq === reqSeq.current) setLoadingNews(false)
      }
    },
    [getCurrentFilterValues],
  )

  // 加载游戏列表（仅一次）
  useEffect(() => {
    const ctrl = new AbortController()
    setLoadingGames(true)
    fetchGames(ctrl.signal)
      .then(d => {
        setGames(d.items)
        const routeGame = d.items.find(gameItem => gameItem.id === initialRoute.gameId)?.id
        setGameId(prev => prev ?? routeGame ?? d.items[0]?.id ?? null)
      })
      .catch(e => {
        if (!isAbortError(e)) setError(toMessage(e))
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingGames(false)
      })
    return () => ctrl.abort()
  }, [initialRoute.gameId])

  // 按游戏复用角色数据，关闭抽屉不取消正在进行的请求
  useEffect(() => {
    if (filterCollapsed || !gameId) return
    let active = true
    setLoadingCharacters(true)
    cachedRequest(characterCache.current, gameId, () =>
      fetchGameCharacters(gameId).then(items => items.filter(item => item.name)),
    )
      .then(items => { if (active) setCharacters(items) })
      .catch(e => { if (active) setError(toMessage(e)) })
      .finally(() => { if (active) setLoadingCharacters(false) })
    return () => { active = false; setLoadingCharacters(false) }
  }, [filterCollapsed, gameId, filterRevision])

  // 游戏变化 → 加载来源列表
  useEffect(() => {
    if (!gameId) return
    const ctrl = new AbortController()
    setLoadingSources(true)
    fetchNewsSources(gameId, ctrl.signal)
      .then(d => {
        setSources(d.items)
        const routeSource = d.items.find(sourceItem => sourceItem.id === initialRoute.sourceId)?.id
        setSourceId(routeSource ?? d.items[0]?.id ?? null)
      })
      .catch(e => {
        if (!isAbortError(e)) setError(toMessage(e))
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingSources(false)
      })
    return () => ctrl.abort()
  }, [gameId, initialRoute.sourceId])

  // 来源变化 → 加载新闻列表和当前来源总数（第 1 页）
  useEffect(() => {
    if (!gameId || !sourceId) return
    const ctrl = new AbortController()
    setSourceTotal(null)
    fetchNewsTotal(gameId, sourceId, ctrl.signal)
      .then(d => setSourceTotal(d.total))
      .catch(e => {
        if (!isAbortError(e)) setSourceTotal(null)
      })
    const applyInitialRoute =
      !routeUserInteracted.current &&
      initialRoute.gameId === gameId &&
      (!initialRoute.sourceId || initialRoute.sourceId === sourceId)
    if (applyInitialRoute) {
      filterForm.setFieldsValue(initialRoute.values)
      refreshNews({ gameId, sourceId, page: initialRoute.page, values: initialRoute.values })
    } else {
      refreshNews({ gameId, sourceId, page: 1 })
    }
    return () => ctrl.abort()
  }, [
    filterForm,
    gameId,
    initialRoute.gameId,
    initialRoute.page,
    initialRoute.sourceId,
    initialRoute.values,
    refreshNews,
    sourceId,
  ])

  // 标签按游戏和来源隔离，重复打开复用请求结果
  useEffect(() => {
    if (filterCollapsed || !gameId || !sourceId) return
    let active = true
    setLoadingTags(true)
    const key = JSON.stringify([gameId, sourceId])
    cachedRequest(tagCache.current, key, () =>
      fetchNewsTags(gameId, sourceId).then(data => data.groups),
    )
      .then(groups => { if (active) setTagGroups(groups) })
      .catch(e => { if (active) setError(toMessage(e)) })
      .finally(() => { if (active) setLoadingTags(false) })
    return () => { active = false; setLoadingTags(false) }
  }, [filterCollapsed, gameId, sourceId, filterRevision])

  const handleGameChange = (id: string) => {
    routeUserInteracted.current = true
    setGameId(id)
    setSourceId(null)
    setTagGroups([])
    setCharacters([])
    // 标签和角色按游戏/来源区分，切换游戏时清空已选条件
    filterForm.setFieldsValue({ tags: undefined, characters: undefined })
  }

  const handleSourceChange = (id: string) => {
    routeUserInteracted.current = true
    setTagGroups([])
    filterForm.setFieldsValue({ tags: undefined, untagged: false })
    setSourceId(id)
  }

  const handleQuery = (values: FilterValues) => {
    if (gameId && sourceId) {
      refreshNews({
        gameId,
        sourceId,
        page: 1,
        values: { ...values, q: keywordRef.current.trim() || undefined, limit: pageSize },
      })
    }
  }

  const handleKeywordChange = (value: string) => {
    keywordRef.current = value
    setKeyword(value)
  }

  const handleKeywordSearch = (value: string) => {
    handleKeywordChange(value)
    if (gameId && sourceId) {
      refreshNews({
        gameId,
        sourceId,
        page: 1,
        values: { ...getCurrentFilterValues(), q: value.trim() || undefined, limit: pageSize },
      })
    }
  }

  const handleReset = () => {
    filterForm.setFieldsValue(DEFAULT_FILTER_VALUES)
    handleKeywordChange('')
    if (gameId && sourceId) {
      refreshNews({ gameId, sourceId, page: 1, values: { limit: pageSize, q: undefined } })
    }
  }

  const handleTagSelect = (tag: string) => {
    const current = filterForm.getFieldValue('tags') ?? []
    if (current.includes(tag)) return
    filterForm.setFieldsValue({ tags: [...current, tag] })
    if (gameId && sourceId) {
      refreshNews({
        gameId,
        sourceId,
        page: 1,
        values: { ...getCurrentFilterValues(), limit: pageSize, tags: [...current, tag] },
      })
    }
  }

  const handlePageChange = (p: number, size: number) => {
    if (gameId && sourceId) {
      refreshNews({
        gameId,
        sourceId,
        page: p,
        values: { ...getCurrentFilterValues(), limit: size },
      })
    }
  }

  const handleRefresh = async () => {
    if (!gameId || !sourceId) return

    setError(null)
    characterCache.current.delete(gameId)
    tagCache.current.delete(JSON.stringify([gameId, sourceId]))
    setFilterRevision(revision => revision + 1)
    try {
      const [, sourceCount] = await Promise.all([
        refreshNews({
          gameId,
          sourceId,
          page,
          values: { ...getCurrentFilterValues(), limit: pageSize },
        }),
        fetchNewsTotal(gameId, sourceId),
      ])
      setSourceTotal(sourceCount.total)
    } catch (e) {
      if (!isAbortError(e)) setError(toMessage(e))
    }
  }

  const handleCopyRss = () => {
    if (!gameId || !sourceId) return

    const values = getCurrentFilterValues()
    const params = new URLSearchParams()
    params.set('source', sourceId)
    params.set('limit', String(pageSize))

    const q = values.q?.trim()
    if (q) params.set('q', q)
    for (const character of values.characters ?? []) params.append('character', character)
    const hasUntagged = Boolean(values.untagged || values.tags?.includes(UNTAGGED_TAG_VALUE))
    for (const tag of values.tags ?? []) {
      if (tag !== UNTAGGED_TAG_VALUE) params.append('tag', tag)
    }
    if (hasUntagged) params.set('untagged', 'true')
    if (values.news_type !== 'all') params.set('news_type', values.news_type)
    if (values.during?.[0]) params.set('published_from', values.during[0].format('YYYY-MM-DD'))
    if (values.during?.[1]) params.set('published_to', values.during[1].format('YYYY-MM-DD'))

    const rssUrl = `${BASE_URL}/api/v1/games/${encodeURIComponent(gameId)}/news/rss?${params.toString()}`
    void copyText(rssUrl, 'RSS 链接已复制')
  }

  const applyFilters = (patch: Partial<FilterValues>) => {
    const next = { ...DEFAULT_FILTER_VALUES, ...appliedFilters, ...patch, limit: pageSize }
    filterForm.setFieldsValue({ ...next, tags: [...(next.tags ?? []), ...(next.untagged ? [UNTAGGED_TAG_VALUE] : [])] })
    if ('q' in patch) handleKeywordChange(patch.q ?? '')
    if (gameId && sourceId) refreshNews({ gameId, sourceId, page: 1, values: next })
  }
  const filterChips: { key: string; label: string; remove: Partial<FilterValues> }[] = []
  if (appliedFilters.q) filterChips.push({ key: 'q', label: `搜索：${appliedFilters.q}`, remove: { q: undefined } })
  for (const tag of appliedFilters.tags ?? []) filterChips.push({ key: `tag:${tag}`, label: tag, remove: { tags: appliedFilters.tags?.filter(value => value !== tag) } })
  if (appliedFilters.untagged) filterChips.push({ key: 'untagged', label: '未分类', remove: { untagged: false } })
  for (const id of appliedFilters.characters ?? []) filterChips.push({ key: `character:${id}`, label: `角色：${characters.find(item => item.id === id)?.name ?? selectedCharacterNames[`${gameId}:${id}`] ?? id}`, remove: { characters: appliedFilters.characters?.filter(value => value !== id) } })
  if (appliedFilters.during?.[0] || appliedFilters.during?.[1]) filterChips.push({ key: 'during', label: `${appliedFilters.during[0]?.format('YYYY-MM-DD') ?? '不限'} 至 ${appliedFilters.during[1]?.format('YYYY-MM-DD') ?? '不限'}`, remove: { during: null } })
  if (appliedFilters.news_type && appliedFilters.news_type !== 'all') filterChips.push({ key: 'type', label: appliedFilters.news_type === 'article' ? '文章' : '视频', remove: { news_type: 'all' } })
  if (appliedFilters.reverse) filterChips.push({ key: 'order', label: '最早发布', remove: { reverse: false } })

  const drawerIndex = drawerItem ? news.findIndex(item => item.id === drawerItem.id && item.source === drawerItem.source) : -1

  const game = games.find(g => g.id === gameId) ?? null
  const source = sources.find(s => s.id === sourceId) ?? null

  const tagOptions: TagOptionItem[] = [
    ...tagGroups.map(g => ({
      label: g.name ?? '未分组',
      options: g.tags.map(t => ({
        label: `${t.name}（${t.news_count.total}）`,
        value: t.name,
      })),
    })),
    { label: '未分类', value: UNTAGGED_TAG_VALUE },
  ]

  const characterOptions = characters.map(character => ({
    label: character.name as string,
    value: character.id,
  }))

  return (
    <div className="news-app min-h-screen text-neutral-900 dark:text-neutral-100">
      <header className="news-header">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <a href="/" aria-label="蒸汽鸟报首页" className="shrink-0">
              <img
                src="/steambird-mark.png"
                alt="蒸汽鸟报"
                draggable={false}
                className="h-10 w-10 select-none rounded-lg"
              />
            </a>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight">
                蒸汽鸟报
              </h1>
              <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                {loadingGames
                  ? '正在加载游戏列表…'
                  : game
                    ? source && sourceTotal !== null
                      ? `${game.name} · ${source.name} · 共 ${sourceTotal} 条`
                      : `${game.name}${source ? ` · ${source.name}` : ''} · 正在加载来源数据…`
                    : '请选择游戏与新闻来源'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <Tooltip title="GitHub 仓库">
              <Button
                type="text"
                shape="circle"
                href="https://github.com/Trrrrw/hoyo-news"
                target="_blank"
                rel="noreferrer"
                icon={<IconBrandGithub size={18} />}
                aria-label="GitHub 仓库"
              />
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="news-main mx-auto max-w-6xl px-4">
        <section className="news-searchbar" aria-label="搜索新闻">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
          <Input.Search
            allowClear
            value={keyword}
            placeholder="搜索新闻标题"
            enterButton="搜索"
            loading={loadingNews}
            onChange={event => handleKeywordChange(event.target.value)}
            onSearch={handleKeywordSearch}
            aria-label="搜索新闻标题"
          />
            </div>
            <Button icon={<IconAdjustments size={18} />} onClick={() => setFilterCollapsed(false)} aria-haspopup="dialog">筛选{filterChips.length ? ` (${filterChips.length})` : ''}</Button>
          </div>
        </section>
        <Drawer title="筛选新闻" open={!filterCollapsed} onClose={() => setFilterCollapsed(true)}
          size="min(720px, 100vw)" forceRender rootClassName="news-filter-drawer"
          footer={<div className="flex items-center justify-between gap-3">
            <Button onClick={handleReset}>清除全部条件</Button>
            <Button type="primary" loading={loadingNews} onClick={() => setFilterCollapsed(true)}>{error ? '返回列表' : `查看 ${total.toLocaleString()} 条结果`}</Button>
          </div>}
        >
          <p className="mb-4 text-sm text-neutral-500">选择后自动更新结果，可同时选择多个标签和角色</p>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-sm text-neutral-600 dark:text-neutral-300">
              游戏
            </div>
            <div className="flex items-center gap-2">
              {game?.icon && (
                <img
                  src={game.icon}
                  alt={game.name}
                  className="h-8 w-8 shrink-0 rounded-md object-cover"
                />
              )}
              <Select
                className="min-w-0 flex-1"
                aria-label="选择游戏"
                placeholder="选择游戏"
                value={gameId ?? undefined}
                onChange={handleGameChange}
                loading={loadingGames}
                showSearch
                optionFilterProp="label"
                options={games.map(g => ({ label: g.name, value: g.id }))}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm text-neutral-600 dark:text-neutral-300">
              新闻来源
            </div>
            <Select
              className="w-full"
              aria-label="选择新闻来源"
              placeholder={gameId ? '选择新闻来源' : '请先选择游戏'}
              value={sourceId ?? undefined}
              onChange={handleSourceChange}
              loading={loadingSources}
              disabled={!gameId}
              options={sources.map(s => ({ label: s.name, value: s.id }))}
            />
          </div>
        </div>

        <div className="quick-filters">
          <Segmented aria-label="新闻类型" value={appliedFilters.news_type ?? 'all'}
            options={[{ label: '全部', value: 'all' }, { label: '文章', value: 'article' }, { label: '视频', value: 'video' }]}
            onChange={value => applyFilters({ news_type: value as FilterValues['news_type'] })} />
          <Select aria-label="排序方式" value={appliedFilters.reverse ? 'asc' : 'desc'}
            options={[{ label: '最新发布', value: 'desc' }, { label: '最早发布', value: 'asc' }]}
            onChange={value => applyFilters({ reverse: value === 'asc' })} />
        </div>
          <FilterPanel
            form={filterForm}
            tagOptions={tagOptions}
            characterOptions={characterOptions}
            loadingTags={loadingTags}
            loadingCharacters={loadingCharacters}
            onQuery={handleQuery}
          />
          {error && <Alert type="error" showIcon title={error} />}
        </Drawer>
        {filterChips.length > 0 && (
          <div className="active-filters" aria-label="已应用的筛选条件">
            <span>已筛选</span>
            {filterChips.map(chip => <Tag key={chip.key} closable onClose={() => applyFilters(chip.remove)}>{chip.label}</Tag>)}
            <Button type="link" size="small" onClick={handleReset}>清除全部</Button>
          </div>
        )}
        <div className="feed-heading">
          <h3>资讯一览 <span>{source?.name ?? '新闻'}</span></h3>
          <div className="flex items-center gap-3"><span className="text-xs text-neutral-500" aria-live="polite">{loadingNews ? '正在加载…' : `共 ${total.toLocaleString()} 条结果`}</span><Button size="small" onClick={handleCopyRss} disabled={!sourceId}>复制 RSS</Button></div>
        </div>
        {error && <Alert className="mt-4" type="error" showIcon title={error} />}

        <Spin spinning={loadingNews}>
          {news.length > 0 ? (
            <div className="news-feed">
              {news.map(item => (
                <NewsItemRow
                  key={item.id}
                  item={item}
                  gameIcon={game?.icon ?? null}
                  sourceName={source?.name ?? item.source}
                  onOpen={setDrawerItem}
                  onTagClick={handleTagSelect}
                />
              ))}
            </div>
          ) : loadingNews || loadingSources ? null : (
            <Empty
              className="mt-6"
              description={
                sourceId ? <span>没有找到符合条件的新闻<Button type="link" onClick={handleReset}>清除筛选</Button></span> : '请选择游戏与新闻来源'
              }
            />
          )}
        </Spin>

        {total > 0 && (
          <div ref={paginationRef} className="mobile-pagination mt-4 flex justify-center">
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              showQuickJumper
              showTotal={t => `共 ${t} 条`}
              onChange={handlePageChange}
            />
          </div>
        )}
      </main>

      {gameId && sourceId && (
        <FloatButton.Group
          type="primary"
          shape="circle"
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 50 }}
        >
          <FloatButton
            icon={
              loadingNews || loadingTags ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconRefresh size={16} />
              )
            }
            aria-label="刷新数据"
            tooltip="刷新数据"
            disabled={loadingNews || loadingTags}
            onClick={handleRefresh}
          />
          <FloatButton.BackTop
            icon={<IconArrowUp size={16} />}
            aria-label="回到顶部"
            tooltip="回到顶部"
            visibilityHeight={200}
          />
        </FloatButton.Group>
      )}

      <NewsDrawer
        onCharacterClick={(id, name) => {
          setSelectedCharacterNames(current => ({ ...current, [`${gameId}:${id}`]: name }))
          applyFilters({ characters: [...new Set([...(appliedFilters.characters ?? []), id])] })
        }}
        previous={drawerIndex > 0 ? news[drawerIndex - 1] : undefined}
        next={drawerIndex >= 0 ? news[drawerIndex + 1] : undefined}
        onNavigate={setDrawerItem}
        item={drawerItem}
        gameIcon={game?.icon ?? null}
        gameId={gameId}
        source={drawerItem?.source ?? sourceId ?? ''}
        sourceName={drawerItem ? source?.name ?? drawerItem.source : ''}
        onClose={() => setDrawerItem(null)}
        onTagClick={handleTagSelect}
      />

      <footer className="site-footer mt-8 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-xs text-neutral-500 dark:text-neutral-400">
          <span>
            数据来自{' '}
            <a
              className="text-inherit"
              href={`${BASE_URL}/scalar`}
              target="_blank"
              rel="noreferrer"
            >
              Akasha
            </a>
          </span>
          <a
            className="text-inherit"
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
          >
            皖ICP备2025089713号-2
          </a>
          <a
            className="text-inherit"
            href="https://trrw.cn/#contact"
            target="_blank"
            rel="noreferrer"
          >
            联系方式
          </a>
          <a
            className="text-inherit"
            href="https://video.trrw.cn"
            target="_blank"
            rel="noreferrer"
          >
            影像档案架
          </a>
        </div>
      </footer>
    </div>
  )
}
