import { useEffect, useMemo, useRef, useState } from 'react'
import { IconArrowUp, IconLoader2, IconRefresh } from '@tabler/icons-react'
import { Alert, Button, Empty, FloatButton, Pagination } from 'antd'
import { BASE_URL } from './api'
import type { NewsItem } from './api'
import AppHeader from './components/AppHeader'
import FilterPanel from './components/FilterPanel'
import GameSourceNav from './components/GameSourceNav'
import NewsDrawer from './components/NewsDrawer'
import NewsFeedSkeleton from './components/NewsFeedSkeleton'
import NewsItemRow from './components/NewsItemRow'
import SearchToolbar from './components/SearchToolbar'
import { UNTAGGED_TAG_VALUE, buildRssUrl, hasActiveFilters } from './filters'
import type { TagOptionItem } from './filters'
import { useCopyText } from './hooks/useCopyText'
import { useNewsFeed } from './hooks/useNewsFeed'

export default function App() {
  const copyText = useCopyText()
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [drawerItem, setDrawerItem] = useState<NewsItem | null>(null)
  const paginationRef = useRef<HTMLDivElement>(null)

  const feed = useNewsFeed(filterDrawerOpen)

  // 为 Ant Design 分页快速跳转输入框补充语义属性
  useEffect(() => {
    const input = paginationRef.current?.querySelector<HTMLInputElement>(
      '.ant-pagination-options-quick-jumper input',
    )
    if (!input) return
    input.id = 'pagination_quick_page'
    input.name = 'pagination_quick_page'
  }, [feed.page, feed.pageSize, feed.total])

  const tagOptions = useMemo<TagOptionItem[]>(() => {
    const grouped: TagOptionItem[] = feed.tagGroups.map(group => ({
      label: group.name ?? '未分组',
      options: group.tags.map(tag => ({
        label: tag.name,
        value: tag.name,
        count: tag.news_count.total,
      })),
    }))
    if (feed.untaggedTotal === null || feed.untaggedTotal > 0 || feed.filters.untagged) {
      grouped.push({
        label: '未分类',
        value: UNTAGGED_TAG_VALUE,
        count: feed.untaggedTotal ?? undefined,
      })
    }
    return grouped
  }, [feed.tagGroups, feed.untaggedTotal, feed.filters.untagged])

  const characterOptions = useMemo(
    () =>
      feed.characters.map(character => ({
        label: character.name,
        value: character.id,
      })),
    [feed.characters],
  )

  const isFiltered = useMemo(() => hasActiveFilters(feed.filters), [feed.filters])

  const drawerIndex = drawerItem
    ? feed.news.findIndex(item => item.id === drawerItem.id && item.source === drawerItem.source)
    : -1

  const handleCopyRss = () => {
    if (!feed.gameId || !feed.sourceId) return
    const rssUrl = buildRssUrl(BASE_URL, feed.gameId, feed.sourceId, feed.filters, feed.pageSize)
    void copyText(rssUrl, 'RSS 链接已复制')
  }

  const showInitialSkeleton =
    (feed.loadingGames || feed.loadingSources || (feed.loadingNews && !feed.hasLoadedNews)) &&
    !feed.error

  return (
    <div className="news-app min-h-screen">
      <AppHeader />

      <GameSourceNav
        games={feed.games}
        gameId={feed.gameId}
        loadingGames={feed.loadingGames}
        sources={feed.sources}
        sourceId={feed.sourceId}
        loadingSources={feed.loadingSources}
        total={feed.total}
        sourceTotal={feed.sourceTotal}
        loadingNews={feed.loadingNews}
        isFiltered={isFiltered}
        onSelectGame={feed.selectGame}
        onSelectSource={feed.selectSource}
        onCopyRss={handleCopyRss}
      />

      <main className="news-main mx-auto max-w-6xl px-4">
        <SearchToolbar
          filters={feed.filters}
          gameId={feed.gameId}
          disabled={!feed.gameId || !feed.sourceId}
          characterNameMap={feed.characterNameMap}
          onUpdateFilters={feed.updateFilters}
          onResetFilters={feed.resetFilters}
          onOpenFilterDrawer={() => setFilterDrawerOpen(true)}
        />

        {feed.error && (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            title={feed.error}
            action={
              <Button size="small" onClick={feed.refresh}>
                重试
              </Button>
            }
          />
        )}

        {showInitialSkeleton ? (
          <NewsFeedSkeleton />
        ) : feed.news.length > 0 ? (
          <div className={feed.loadingNews ? 'news-feed is-updating' : 'news-feed'}>
            {feed.news.map(item => (
              <NewsItemRow
                key={`${item.game_id}:${item.source}:${item.id}`}
                item={item}
                gameIcon={feed.game?.icon ?? null}
                sourceName={feed.source?.name ?? item.source}
                onOpen={setDrawerItem}
                onTagClick={feed.addTagFilter}
                onCharacterClick={feed.addCharacterFilter}
              />
            ))}
          </div>
        ) : feed.loadingNews ? (
          <NewsFeedSkeleton />
        ) : (
          <div className="news-empty-box">
            <Empty
              description={
                feed.sourceId ? (
                  <span>
                    没有找到符合条件的新闻
                    {isFiltered && (
                      <Button type="link" onClick={feed.resetFilters}>
                        清除筛选
                      </Button>
                    )}
                  </span>
                ) : (
                  '暂无可用的游戏或新闻来源'
                )
              }
            />
          </div>
        )}

        {feed.total > 0 && (
          <div ref={paginationRef} className="mobile-pagination">
            <Pagination
              current={feed.page}
              total={feed.total}
              pageSize={feed.pageSize}
              showQuickJumper
              showSizeChanger
              pageSizeOptions={[10, 20, 50]}
              showTotal={count => `共 ${count.toLocaleString()} 条`}
              onChange={feed.changePage}
            />
          </div>
        )}
      </main>

      {feed.gameId && feed.sourceId && (
        <FloatButton.Group
          type="primary"
          shape="circle"
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 50 }}
        >
          <FloatButton
            icon={
              feed.loadingNews || feed.loadingTags ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconRefresh size={16} />
              )
            }
            aria-label="刷新数据"
            tooltip="刷新数据"
            disabled={feed.loadingNews || feed.loadingTags}
            onClick={feed.refresh}
          />
          <FloatButton.BackTop
            icon={<IconArrowUp size={16} />}
            aria-label="回到顶部"
            tooltip="回到顶部"
            visibilityHeight={240}
          />
        </FloatButton.Group>
      )}

      <FilterPanel
        open={filterDrawerOpen}
        filters={feed.filters}
        gameId={feed.gameId}
        tagOptions={tagOptions}
        characterOptions={characterOptions}
        characterNameMap={feed.characterNameMap}
        loadingTags={feed.loadingTags}
        loadingCharacters={feed.loadingCharacters}
        loadingNews={feed.loadingNews}
        total={feed.total}
        error={feed.drawerError}
        onClose={() => setFilterDrawerOpen(false)}
        onUpdateFilters={feed.updateFilters}
        onResetFilters={feed.resetFilters}
      />

      <NewsDrawer
        item={drawerItem}
        gameIcon={feed.game?.icon ?? null}
        gameId={feed.gameId}
        source={drawerItem?.source ?? feed.sourceId ?? ''}
        sourceName={drawerItem ? (feed.source?.name ?? drawerItem.source) : ''}
        previous={drawerIndex > 0 ? feed.news[drawerIndex - 1] : undefined}
        next={drawerIndex >= 0 ? feed.news[drawerIndex + 1] : undefined}
        onNavigate={setDrawerItem}
        onClose={() => setDrawerItem(null)}
        onTagClick={feed.addTagFilter}
        onCharacterClick={feed.addCharacterFilter}
      />

      <footer className="site-footer">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-5 text-xs">
          <span>
            数据来自{' '}
            <a href={`${BASE_URL}/scalar`} target="_blank" rel="noreferrer">
              Akasha
            </a>
          </span>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
            皖ICP备2025089713号-2
          </a>
          <a href="https://trrw.cn/#contact" target="_blank" rel="noreferrer">
            联系方式
          </a>
          <a href="https://video.trrw.cn" target="_blank" rel="noreferrer">
            影像档案架
          </a>
        </div>
      </footer>
    </div>
  )
}
