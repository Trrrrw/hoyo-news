import { useEffect, useState } from 'react'
import { Button, Drawer, Spin, Tag } from 'antd'
import { fetchNewsVideo } from '../api'
import type { NewsItem, VideoPlayback } from '../api'
import { DirectVideoPlayer, YouTubeVideoPlayer } from './VideoPlayer'
import { formatDuration, formatPublishTime } from '../utils'

interface NewsDrawerProps {
  item: NewsItem | null
  gameIcon: string | null
  gameId: string | null
  source: string
  sourceName: string
  onClose: () => void
  onTagClick: (tag: string) => void
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
}: NewsDrawerProps) {
  const coverSrc = item?.cover ?? gameIcon ?? null

  // 正文中原样保留，但去掉内嵌 <video> 标签（其签名地址会过期）：
  // 视频统一由上方播放器播放，地址来自 /news/{id}/media/video 后端接口。
  const introHtml = item?.intro?.replace(/<video[\s\S]*?<\/video>/gi, '') ?? ''

  return (
    <Drawer
      open={item != null}
      onClose={onClose}
      title={item?.title ?? ''}
      size="min(760px, 92vw)"
      destroyOnHidden
      placement="right"
      extra={
        item ? (
          <Button
            variant="solid"
            color="primary"
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
          >
            查看原文
          </Button>
        ) : null
      }
    >
      {item && (
        <div className="flex flex-col gap-4">
          {coverSrc && (
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <img src={coverSrc} alt={item.title} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Tag color={item.news_type === 'video' ? 'purple' : 'blue'}>
              {item.news_type === 'video'
                ? `视频${item.video_duration != null ? ` · ${formatDuration(item.video_duration)}` : ''}`
                : '文章'}
            </Tag>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{sourceName}</span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">{formatPublishTime(item.publish_time)}</span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">ID：{item.id}</span>
          </div>
          {item.news_type === 'video' && (
            <DrawerVideoPlayer item={item} gameId={gameId} source={source} />
          )}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.tags.map(tag => (
                <Tag
                  key={tag}
                  className="cursor-pointer"
                  title="点击按此标签筛选"
                  onClick={() => {
                    onTagClick(tag)
                    onClose()
                  }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
          )}
          {item.characters.length > 0 && (
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              关联角色：{item.characters.map(c => c.name).join(' / ')}
            </div>
          )}
          <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
            {introHtml ? (
              <div
                className="news-intro text-sm leading-relaxed text-neutral-700 dark:text-neutral-300"
                dangerouslySetInnerHTML={{ __html: introHtml }}
              />
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">暂无正文简介</p>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
