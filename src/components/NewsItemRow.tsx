import { Tag } from 'antd'
import type { NewsItem } from '../api'
import { formatDuration, formatPublishTime, stripHtml } from '../utils'

interface NewsItemRowProps {
  item: NewsItem
  gameIcon: string | null
  sourceName: string
  onOpen: (item: NewsItem) => void
  onTagClick: (tag: string) => void
}

export default function NewsItemRow({ item, gameIcon, sourceName, onOpen, onTagClick }: NewsItemRowProps) {
  const coverSrc = item.cover ?? gameIcon
  const intro = stripHtml(item.intro)

  return (
    <article
      className="flex cursor-pointer flex-col gap-3 py-4 transition-colors hover:bg-neutral-100/70 sm:flex-row sm:gap-4"
      onClick={() => onOpen(item)}
    >
      {coverSrc ? (
        <img
          src={coverSrc}
          alt={item.title}
          loading="lazy"
          className="aspect-video h-auto w-full shrink-0 rounded-lg object-cover sm:aspect-auto sm:h-28 sm:w-44"
        />
      ) : (
        <div className="flex aspect-video h-auto w-full shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-xs text-neutral-500 sm:aspect-auto sm:h-28 sm:w-44">
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
          <span className="text-xs text-neutral-400">{sourceName}</span>
          <span className="text-xs text-neutral-400">{formatPublishTime(item.publish_time)}</span>
        </div>
        <div className="text-base font-semibold">{item.title}</div>
        {item.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
            {item.tags.map(tag => (
              <Tag
                key={tag}
                className="cursor-pointer"
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
          <div className="mt-1.5 text-xs text-neutral-400">
            关联角色：{item.characters.map(c => c.name).join(' / ')}
          </div>
        )}
        {intro && <p className="mt-1.5 line-clamp-2 text-sm text-neutral-500">{intro}</p>}
      </div>
    </article>
  )
}
