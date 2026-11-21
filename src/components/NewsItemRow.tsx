import { Tag } from 'antd'
import type { NewsItem, NewsSearchPart } from '../api'
import { formatDuration, formatPublishTime, stripHtml } from '../utils'

interface NewsItemRowProps {
  item: NewsItem
  gameIcon: string | null
  sourceName: string
  onOpen: (item: NewsItem) => void
  onTagClick: (tag: string) => void
}

function SearchParts({ parts }: { parts: NewsSearchPart[] }) {
  return parts.map(({ text, highlight }, index) => (
    <span key={index}>{highlight
      ? <mark className="rounded-sm bg-amber-100 font-semibold text-amber-950 dark:bg-amber-900 dark:text-amber-100">{text}</mark>
      : text}</span>
  ))
}

export default function NewsItemRow({ item, gameIcon, sourceName, onOpen, onTagClick }: NewsItemRowProps) {
  const coverSrc = item.cover ?? gameIcon
  const match = item.search_match
  const intro = match?.body ? null : stripHtml(item.intro)

  return (
    <article
      className="news-row"
      onClick={() => onOpen(item)}
    >
      {coverSrc ? (
        <img
          src={coverSrc}
          alt={item.title}
          loading="lazy"
          className="news-cover"
        />
      ) : (
        <div className="flex aspect-video h-auto w-full shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 sm:aspect-auto sm:h-28 sm:w-44">
          无封面
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Tag color={item.news_type === 'video' ? 'purple' : 'blue'}>
            {item.news_type === 'video'
              ? `视频${item.video_duration != null ? ` · ${formatDuration(item.video_duration)}` : ''}`
              : '文章'}
          </Tag>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">{sourceName}</span>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">{formatPublishTime(item.publish_time)}</span>
        </div>
        <h4 className="news-title"><button type="button" onClick={event => { event.stopPropagation(); onOpen(item) }}>{match?.title ? <SearchParts parts={match.title} /> : item.title}</button></h4>
        {item.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
            {item.tags.map(tag => (
              <Tag
                key={tag}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    onTagClick(tag)
                  }
                }}
                onClick={e => {
                  e.stopPropagation()
                  onTagClick(tag)
                }}
              >
                {tag}
              </Tag>
            ))}
          </div>
        )}
        {item.characters.length > 0 && (
          <div className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">
            关联角色：{item.characters.map(c => c.name).join(' / ')}
          </div>
        )}
        {match?.body
          ? <p className="mt-1.5 break-words text-sm leading-relaxed text-neutral-600 dark:text-neutral-300"><SearchParts parts={match.body} /></p>
          : intro && <p className="mt-1.5 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">{intro}</p>}
      </div>
    </article>
  )
}
