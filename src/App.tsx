import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DownOutlined,
  GithubOutlined,
  LoadingOutlined,
  ReloadOutlined,
  UpOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Empty, FloatButton, Form, Pagination, Select, Spin, Tooltip } from 'antd'
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
import { UNTAGGED_TAG_VALUE } from './components/FilterPanel'
import type { FilterValues, TagOptionItem } from './components/FilterPanel'
import NewsDrawer from './components/NewsDrawer'
import NewsItemRow from './components/NewsItemRow'
import { useCopyText } from './hooks/useCopyText'
import { readNewsRoute, writeNewsRoute } from './newsRoute'
import type { NewsRouteState } from './newsRoute'

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return '请求失败，请稍后重试'
}

export default function App() {
  const [filterForm] = Form.useForm<FilterValues>()
  const copyText = useCopyText()
  const [initialRoute] = useState<NewsRouteState>(() => readNewsRoute())
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
        ...(opts.values ?? filterForm.getFieldsValue()),
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
    [filterForm],
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

  // 展开筛选条件 → 加载角色列表（角色数据接口目前仅部分游戏提供）
  useEffect(() => {
    if (filterCollapsed || !gameId) return
    const ctrl = new AbortController()
    setCharacters([])
    setLoadingCharacters(true)
    fetchGameCharacters(gameId, ctrl.signal)
      .then(items => setCharacters(items.filter(item => item.name)))
      .catch(e => {
        if (!isAbortError(e)) setCharacters([])
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingCharacters(false)
      })
    return () => ctrl.abort()
  }, [filterCollapsed, gameId])

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

  // 展开筛选条件 → 加载当前来源的标签
  useEffect(() => {
    if (filterCollapsed || !gameId || !sourceId) return
    const ctrl = new AbortController()
    setTagGroups([])
    setLoadingTags(true)
    fetchNewsTags(gameId, sourceId, ctrl.signal)
      .then(d => setTagGroups(d.groups))
      .catch(e => {
        if (!isAbortError(e)) setTagGroups([])
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadingTags(false)
      })
    return () => ctrl.abort()
  }, [filterCollapsed, gameId, sourceId])

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
    setSourceId(id)
  }

  const handleQuery = (values: FilterValues) => {
    if (gameId && sourceId) {
      refreshNews({ gameId, sourceId, page: 1, values: { ...values, limit: pageSize } })
    }
  }

  const handleReset = () => {
    filterForm.resetFields()
    if (gameId && sourceId) {
      refreshNews({ gameId, sourceId, page: 1, values: { limit: pageSize } })
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
        values: { ...filterForm.getFieldsValue(), limit: pageSize, tags: [...current, tag] },
      })
    }
  }

  const handlePageChange = (p: number, size: number) => {
    if (gameId && sourceId) {
      refreshNews({
        gameId,
        sourceId,
        page: p,
        values: { ...filterForm.getFieldsValue(), limit: size },
      })
    }
  }

  const handleRefresh = async () => {
    if (!gameId || !sourceId) return

    setError(null)
    const shouldRefreshTags = !filterCollapsed
    if (shouldRefreshTags) setLoadingTags(true)
    try {
      const [, tags, sourceCount] = await Promise.all([
        refreshNews({
          gameId,
          sourceId,
          page,
          values: { ...filterForm.getFieldsValue(), limit: pageSize },
        }),
        shouldRefreshTags ? fetchNewsTags(gameId, sourceId) : Promise.resolve(null),
        fetchNewsTotal(gameId, sourceId),
      ])
      if (tags) setTagGroups(tags.groups)
      setSourceTotal(sourceCount.total)
    } catch (e) {
      if (!isAbortError(e)) setError(toMessage(e))
    } finally {
      if (shouldRefreshTags) setLoadingTags(false)
    }
  }

  const handleCopyRss = () => {
    if (!gameId || !sourceId) return

    const values = filterForm.getFieldsValue()
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
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {game?.icon ? (
              <img src={game.icon} alt={game.name} className="h-10 w-10 shrink-0 rounded-lg" />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-lg bg-neutral-200" />
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight">
                蒸汽鸟报
              </h1>
              <p className="truncate text-sm text-neutral-500">
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
          <Tooltip title="GitHub 仓库尚未上传，建议名称：hoyo-news">
            <span className="inline-flex shrink-0">
              <Button
                disabled
                icon={<GithubOutlined />}
                aria-label="GitHub 仓库（尚未上传）"
              />
            </span>
          </Tooltip>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-sm text-neutral-600">
              游戏 <span className="text-red-500">*</span>
            </div>
            <Select
              className="w-full"
              placeholder="选择游戏"
              value={gameId ?? undefined}
              onChange={handleGameChange}
              loading={loadingGames}
              showSearch
              optionFilterProp="label"
              options={games.map(g => ({ label: g.name, value: g.id }))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm text-neutral-600">
              新闻来源 <span className="text-red-500">*</span>
            </div>
            <Select
              className="w-full"
              placeholder={gameId ? '选择新闻来源' : '请先选择游戏'}
              value={sourceId ?? undefined}
              onChange={handleSourceChange}
              loading={loadingSources}
              disabled={!gameId}
              options={sources.map(s => ({ label: s.name, value: s.id }))}
            />
          </div>
        </div>

        <Card
          title={
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 border-0 bg-transparent p-0 text-left font-semibold"
              aria-controls="news-filter-panel"
              aria-expanded={!filterCollapsed}
              onClick={() => setFilterCollapsed(collapsed => !collapsed)}
            >
              <span>筛选条件</span>
              {filterCollapsed ? <DownOutlined aria-hidden /> : <UpOutlined aria-hidden />}
            </button>
          }
          styles={{ body: filterCollapsed ? { display: 'none' } : undefined }}
        >
          <div id="news-filter-panel">
          <FilterPanel
            form={filterForm}
            tagOptions={tagOptions}
            characterOptions={characterOptions}
            loadingTags={loadingTags}
            loadingCharacters={loadingCharacters}
            queryLoading={loadingNews}
            onQuery={handleQuery}
            onReset={handleReset}
            onRss={handleCopyRss}
          />
          </div>
        </Card>

        {error && <Alert className="mt-4" type="error" showIcon title={error} />}

        <Spin spinning={loadingNews}>
          {news.length > 0 ? (
            <div className="mt-2 divide-y divide-neutral-200">
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
                sourceId ? '暂无符合条件的新闻，可调整筛选条件' : '请选择游戏与新闻来源'
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
            icon={loadingNews || loadingTags ? <LoadingOutlined spin /> : <ReloadOutlined />}
            aria-label="刷新数据"
            tooltip="刷新数据"
            disabled={loadingNews || loadingTags}
            onClick={handleRefresh}
          />
          <FloatButton.BackTop
            icon={<VerticalAlignTopOutlined />}
            aria-label="回到顶部"
            tooltip="回到顶部"
            visibilityHeight={200}
          />
        </FloatButton.Group>
      )}

      <NewsDrawer
        item={drawerItem}
        gameIcon={game?.icon ?? null}
        gameId={gameId}
        source={drawerItem?.source ?? sourceId ?? ''}
        sourceName={drawerItem ? source?.name ?? drawerItem.source : ''}
        onClose={() => setDrawerItem(null)}
        onTagClick={handleTagSelect}
      />

      <footer className="site-footer mt-8 border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-xs text-neutral-500">
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
