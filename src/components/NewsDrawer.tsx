import { useCallback, useEffect, useState } from 'react'
import { Button, Drawer, Spin, Tag } from 'antd'
import { fetchNewsVideo } from '../api'
import type { NewsItem, VideoPlayback } from '../api'
import { DirectVideoPlayer, YouTubeVideoPlayer } from './VideoPlayer'
import { formatDuration, formatPublishTime } from '../utils'
import { useCopyText } from '../hooks/useCopyText'

function ReaderTag({ children, color, onClick }: { children: string; color?: string; onClick: () => void }) {
  return <Tag color={color} role="button" tabIndex={0} onClick={onClick} onKeyDown={event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick()
    }
  }}>{children}</Tag>
}

interface NewsDrawerProps {
  item: NewsItem | null
  gameIcon: string | null
  gameId: string | null
  source: string
  sourceName: string
  onClose: () => void
  onTagClick: (tag: string) => void
  onCharacterClick: (id: string, name: string) => void
  previous?: NewsItem
  next?: NewsItem
  onNavigate: (item: NewsItem) => void
}

/**
 * 抽屉内的视频播放器。
 * 播放地址统一通过 /news/{id}/media/video 后端接口获取
 */
function DrawerVideoPlayer({
  item,
  gameId,
  source,
}: {
  item: NewsItem
  gameId: string | null
  source: string
}) {
  const [video, setVideo] = useState<{ url: string; playback: VideoPlayback } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setVideo(null)
    fetchNewsVideo(gameId, source, item.id)
      .then(d => {
        if (!cancelled) {
          setVideo({
            url: d.video_url,
            playback: d.video_playback ?? item.video_playback ?? 'direct',
          })
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '获取视频地址失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [item.id, item.video_playback, gameId, source, attempt])

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
        <Spin tip="正在获取视频地址…" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-300">
        <span>获取视频地址失败：{error}</span>
        <Button size="small" onClick={() => setAttempt(a => a + 1)}>
          重试
        </Button>
      </div>
    )
  }
  if (!video) return null
  return video.playback === 'embed' ? (
    <YouTubeVideoPlayer src={video.url} title={item.title} />
  ) : (
    <DirectVideoPlayer src={video.url} />
  )
}

export default function NewsDrawer({
  item,
  gameIcon,
  gameId,
  source,
  sourceName,
  onClose,
  onTagClick,
  onCharacterClick,
  previous,
  next,
  onNavigate,
}: NewsDrawerProps) {
  const copyText = useCopyText()
  const resetScroll = useCallback((element: HTMLElement | null) => {
    if (element) element.closest('.ant-drawer-body')?.scrollTo({ top: 0 })
  }, [])
  // 视频地址单独获取，避免使用正文内过期的签名
  const introHtml = item?.intro?.replace(/<video[\s\S]*?<\/video>/gi, '') ?? ''
  const showCover = item?.cover && item.news_type !== 'video' && !/<img\b/i.test(introHtml)

  return (
    <Drawer
      open={item != null}
      onClose={onClose}
      title="新闻详情"
      size="min(820px, 100vw)"
      rootClassName="news-reader"
      destroyOnHidden
      placement="right"
      extra={item && <div className="flex items-center gap-1">
        <Button type="text" size="small" onClick={() => void copyText(item.source_url, '原文链接已复制')}>复制链接</Button>
        <Button href={item.source_url} target="_blank" rel="noreferrer">查看原文 ↗</Button>
      </div>}
      footer={item && <div className="reader-navigation">
        <Button disabled={!previous} onClick={() => previous && onNavigate(previous)} title={previous?.title}>← 上一篇</Button>
        <span>当前列表内切换</span>
        <Button disabled={!next} onClick={() => next && onNavigate(next)} title={next?.title}>下一篇 →</Button>
      </div>}
    >
      {item && <article key={`${source}:${item.id}`} className="reader-article" ref={resetScroll}>
        <div className="reader-meta">
          {gameIcon && <img src={gameIcon} alt="" className="reader-game-icon" />}
          <span>{sourceName}</span>
          <span>{formatPublishTime(item.publish_time)}</span>
          <Tag color={item.news_type === 'video' ? 'purple' : 'blue'}>
            {item.news_type === 'video' ? `视频${item.video_duration != null ? ` · ${formatDuration(item.video_duration)}` : ''}` : '文章'}
          </Tag>
        </div>
        <h1 className="reader-title">{item.title}</h1>
        {showCover && <img src={item.cover!} alt="" className="reader-cover" />}
        {item.news_type === 'video' && <DrawerVideoPlayer item={item} gameId={gameId} source={source} />}
        {introHtml.trim() ? <div className="news-intro reader-content" dangerouslySetInnerHTML={{ __html: introHtml }} /> :
          <div className="reader-empty">{item.news_type === 'video' ? '暂无文字介绍' : '暂无正文内容，可通过右上角查看原文'}</div>}
        {(item.tags.length > 0 || item.characters.length > 0) && <section className="reader-related" aria-label="关联信息">
          {item.tags.length > 0 && <div className="reader-tags" aria-label="标签">
            {item.tags.map(tag => <ReaderTag key={tag} onClick={() => { onTagClick(tag); onClose() }}>{tag}</ReaderTag>)}
          </div>}
          {item.characters.length > 0 && <div className="reader-tags" aria-label="关联角色">
            {item.characters.map(character => <ReaderTag key={character.id} color="blue" onClick={() => { onCharacterClick(character.id, character.name); onClose() }}>{character.name}</ReaderTag>)}
          </div>}
        </section>}
        <div className="reader-id">新闻 ID：{item.id}</div>
      </article>}
    </Drawer>
  )
}
