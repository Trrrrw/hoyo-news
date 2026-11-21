import { useCallback, useEffect, useMemo, useState } from 'react'
import { IconArrowLeft, IconArrowRight, IconCopy, IconExternalLink } from '@tabler/icons-react'
import { Button, Modal, Spin, Tag } from 'antd'
import { fetchNewsDetail, fetchNewsVideo } from '../api'
import type { NewsItem, VideoPlayback } from '../api'
import { useCopyText } from '../hooks/useCopyText'
import { formatDuration, formatPublishTime, sanitizeNewsHtml } from '../utils'
import { DirectVideoPlayer, YouTubeVideoPlayer } from './VideoPlayer'

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function ReaderTag({ children, color, onClick }: { children: string; color?: string; onClick: () => void }) {
  return (
    <Tag
      color={color}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
    >
      {children}
    </Tag>
  )
}

interface NewsModalProps {
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

interface VideoLoadState {
  key: string
  video: { url: string; playback: VideoPlayback } | null
  error: string | null
}

/**
 * 弹窗内的视频播放器。
 * 播放地址统一通过 /news/{game_id}/{source}/{id}/media/video 后端接口获取
 */
function ModalVideoPlayer({
  item,
  gameId,
  source,
}: {
  item: NewsItem
  gameId: string | null
  source: string
}) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<VideoLoadState | null>(null)
  const requestKey = gameId ? `${gameId}:${source}:${item.id}:${attempt}` : null

  useEffect(() => {
    if (!gameId || !requestKey) return
    const controller = new AbortController()
    fetchNewsVideo(gameId, source, item.id, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return
        setState({
          key: requestKey,
          video: {
            url: data.video_url,
            playback: data.video_playback ?? item.video_playback ?? 'direct',
          },
          error: null,
        })
      })
      .catch(error => {
        if (controller.signal.aborted || isAbortError(error)) return
        setState({
          key: requestKey,
          video: null,
          error: error instanceof Error ? error.message : '获取视频地址失败',
        })
      })
    return () => controller.abort()
  }, [gameId, source, item.id, item.video_playback, requestKey])

  if (!requestKey) return null
  const current = state?.key === requestKey ? state : null

  if (!current) {
    return (
      <div className="reader-video-loading" role="status">
        <Spin size="small" />
        <span>正在获取视频地址…</span>
      </div>
    )
  }
  if (current.error) {
    return (
      <div className="reader-video-error" role="alert">
        <span>获取视频地址失败：{current.error}</span>
        <Button size="small" onClick={() => setAttempt(value => value + 1)}>
          重试
        </Button>
      </div>
    )
  }
  if (!current.video) return null
  return current.video.playback === 'embed' ? (
    <YouTubeVideoPlayer src={current.video.url} title={item.title} />
  ) : (
    <DirectVideoPlayer src={current.video.url} />
  )
}

function ReaderBody({ item, intro }: { item: NewsItem; intro: string | null }) {
  const introHtml = useMemo(() => sanitizeNewsHtml(intro), [intro])
  const showCover = Boolean(item.cover && item.news_type !== 'video' && !/<img\b/i.test(introHtml))

  return (
    <>
      {showCover && item.cover && <img src={item.cover} alt="" className="reader-cover" />}
      {introHtml.trim() ? (
        <div className="news-intro reader-content" dangerouslySetInnerHTML={{ __html: introHtml }} />
      ) : (
        <div className="reader-empty">
          {item.news_type === 'video' ? '暂无文字介绍' : '暂无正文内容，可通过右上角查看原文'}
        </div>
      )}
    </>
  )
}

interface DetailLoadState {
  key: string
  intro: string | null
  error: string | null
}

function DeferredReaderBody({ item }: { item: NewsItem }) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<DetailLoadState | null>(null)
  const { game_id, source, id } = item
  const requestKey = `${game_id}:${source}:${id}:${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    fetchNewsDetail({ game_id, source, id }, controller.signal)
      .then(detail => {
        if (controller.signal.aborted) return
        setState({ key: requestKey, intro: detail.intro, error: null })
      })
      .catch(error => {
        if (controller.signal.aborted || isAbortError(error)) return
        setState({
          key: requestKey,
          intro: null,
          error: error instanceof Error ? error.message : '请求失败',
        })
      })
    return () => controller.abort()
  }, [game_id, source, id, requestKey])

  const current = state?.key === requestKey ? state : null

  if (!current) {
    return (
      <div className="reader-empty flex items-center gap-2" role="status">
        <Spin size="small" />
        <span>正在加载正文…</span>
      </div>
    )
  }
  if (current.error) {
    return (
      <div role="alert" className="reader-empty flex items-center gap-2">
        <span>获取正文失败：{current.error}</span>
        <Button size="small" onClick={() => setAttempt(value => value + 1)}>
          重试
        </Button>
      </div>
    )
  }
  return <ReaderBody item={item} intro={current.intro} />
}

export default function NewsModal({
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
}: NewsModalProps) {
  const copyText = useCopyText()
  const resetScroll = useCallback((element: HTMLElement | null) => {
    if (element) element.closest('.ant-modal-body')?.scrollTo({ top: 0 })
  }, [])

  // 打开弹窗时支持左右方向键切换上一篇/下一篇
  useEffect(() => {
    if (!item) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'ArrowLeft' && previous) {
        event.preventDefault()
        onNavigate(previous)
      } else if (event.key === 'ArrowRight' && next) {
        event.preventDefault()
        onNavigate(next)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [item, previous, next, onNavigate])

  return (
    <Modal
      open={item != null}
      onCancel={onClose}
      centered
      destroyOnHidden
      width="min(860px, calc(100vw - 32px))"
      rootClassName="news-reader-modal"
      title={
        item && (
          <div className="reader-modal-header">
            <div className="reader-meta">
              {gameIcon && <img src={gameIcon} alt="" className="reader-game-icon" />}
              <span>{sourceName}</span>
              <time className="tabular-nums" dateTime={item.publish_time ?? undefined}>
                {formatPublishTime(item.publish_time)}
              </time>
              <span className={item.news_type === 'video' ? 'news-type-pill is-video' : 'news-type-pill'}>
                {item.news_type === 'video'
                  ? `视频${item.video_duration != null ? ` ${formatDuration(item.video_duration)}` : ''}`
                  : '文章'}
              </span>
            </div>
            <div className="reader-header-actions">
              <Button
                type="text"
                size="small"
                icon={<IconCopy size={15} />}
                onClick={() => void copyText(item.source_url, '原文链接已复制')}
              >
                <span className="hidden sm:inline">复制链接</span>
              </Button>
              <Button
                size="small"
                icon={<IconExternalLink size={15} />}
                iconPlacement="end"
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
              >
                查看原文
              </Button>
            </div>
          </div>
        )
      }
      footer={
        item && (
          <div className="reader-navigation">
            <Button
              disabled={!previous}
              icon={<IconArrowLeft size={15} />}
              onClick={() => previous && onNavigate(previous)}
              title={previous?.title}
            >
              上一篇
            </Button>
            <span className="reader-nav-hint">键盘 ← / → 切换</span>
            <Button
              disabled={!next}
              icon={<IconArrowRight size={15} />}
              iconPlacement="end"
              onClick={() => next && onNavigate(next)}
              title={next?.title}
            >
              下一篇
            </Button>
          </div>
        )
      }
    >
      {item && (
        <article key={`${item.game_id}:${item.source}:${item.id}`} className="reader-article" ref={resetScroll}>
          <h2 className="reader-title">{item.title}</h2>

          {item.news_type === 'video' && (
            <div className="mb-5">
              <ModalVideoPlayer item={item} gameId={gameId} source={source} />
            </div>
          )}

          {item.intro === undefined ? (
            <DeferredReaderBody item={item} />
          ) : (
            <ReaderBody item={item} intro={item.intro} />
          )}

          {(item.tags.length > 0 || item.characters.length > 0) && (
            <section className="reader-related" aria-label="关联信息">
              {item.tags.length > 0 && (
                <div className="reader-tags" aria-label="标签">
                  {item.tags.map(tag => (
                    <ReaderTag
                      key={tag}
                      onClick={() => {
                        onTagClick(tag)
                        onClose()
                      }}
                    >
                      {tag}
                    </ReaderTag>
                  ))}
                </div>
              )}
              {item.characters.length > 0 && (
                <div className="reader-tags" aria-label="关联角色">
                  {item.characters.map(character => (
                    <ReaderTag
                      key={character.id}
                      color="cyan"
                      onClick={() => {
                        onCharacterClick(character.id, character.name)
                        onClose()
                      }}
                    >
                      {character.name}
                    </ReaderTag>
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="reader-id tabular-nums">ID: {item.id}</div>
        </article>
      )}
    </Modal>
  )
}
