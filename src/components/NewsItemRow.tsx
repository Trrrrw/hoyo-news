import { IconPlayerPlayFilled, IconUser } from '@tabler/icons-react'
import { Tag } from 'antd'
import type { NewsItem, NewsSearchPart } from '../api'
import { formatDuration, formatPublishTime, stripHtml } from '../utils'

interface NewsItemRowProps {
  item: NewsItem
  gameIcon: string | null
  sourceName: string
  onOpen: (item: NewsItem) => void
  onTagClick: (tag: string) => void
  onCharacterClick: (id: string, name: string) => void
}

function SearchParts({ parts }: { parts: NewsSearchPart[] }) {
  return parts.map(({ text, highlight }, index) => (
    <span key={index}>
      {highlight ? <mark className="search-highlight">{text}</mark> : text}
    </span>
  ))
}

export default function NewsItemRow({
  item,
  gameIcon,
  sourceName,
  onOpen,
  onTagClick,
  onCharacterClick,
}: NewsItemRowProps) {
  const coverSrc = item.cover ?? gameIcon
  const isVideo = item.news_type === 'video'
  const durationText = isVideo ? formatDuration(item.video_duration) : ''
  const match = item.search_match
  const intro = match?.body ? null : stripHtml(item.intro)

  return (
    <article className="news-row" onClick={() => onOpen(item)}>
      <div className="news-thumb">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="news-cover"
          />
        ) : (
          <div className="news-cover news-cover-empty" aria-hidden="true">
            无封面
          </div>
        )}
        {isVideo && (
          <span className="news-video-badge tabular-nums" aria-label={durationText ? `视频时长 ${durationText}` : '视频'}>
            <IconPlayerPlayFilled size={10} aria-hidden="true" />
            {durationText && <span>{durationText}</span>}
          </span>
        )}
      </div>

      <div className="news-body">
        <div className="news-meta">
          <span className={isVideo ? 'news-type-pill is-video' : 'news-type-pill'}>
            {isVideo ? '视频' : '文章'}
          </span>
          <time className="news-time tabular-nums" dateTime={item.publish_time ?? undefined}>
            {formatPublishTime(item.publish_time)}
          </time>
          <span className="news-source">{sourceName}</span>
        </div>

        <h3 className="news-title">
          <button
            type="button"
            onClick={event => {
              event.stopPropagation()
              onOpen(item)
            }}
          >
            {match?.title ? <SearchParts parts={match.title} /> : item.title}
          </button>
        </h3>

        {match?.body ? (
          <p className="news-match-snippet">
            <SearchParts parts={match.body} />
          </p>
        ) : (
          intro && <p className="news-excerpt">{intro}</p>
        )}

        {(item.tags.length > 0 || item.characters.length > 0) && (
          <div className="news-foot">
            {item.tags.map(tag => (
              <Tag
                key={tag}
                className="news-tag"
                role="button"
                tabIndex={0}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    onTagClick(tag)
                  }
                }}
                onClick={event => {
                  event.stopPropagation()
                  onTagClick(tag)
                }}
              >
                {tag}
              </Tag>
            ))}
            {item.characters.length > 0 && (
              <div className="news-characters" aria-label="关联角色">
                <IconUser size={13} className="shrink-0" aria-hidden="true" />
                {item.characters.map(character => (
                  <button
                    key={character.id}
                    type="button"
                    className="news-character-btn"
                    onClick={event => {
                      event.stopPropagation()
                      onCharacterClick(character.id, character.name)
                    }}
                  >
                    {character.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
