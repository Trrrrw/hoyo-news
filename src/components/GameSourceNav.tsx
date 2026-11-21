import { IconRss } from '@tabler/icons-react'
import { Button, Tooltip } from 'antd'
import type { GameSummary, NewsSource } from '../api'

interface GameSourceNavProps {
  games: GameSummary[]
  gameId: string | null
  loadingGames: boolean
  sources: NewsSource[]
  sourceId: string | null
  loadingSources: boolean
  total: number
  sourceTotal: number | null
  loadingNews: boolean
  isFiltered: boolean
  onSelectGame: (gameId: string) => void
  onSelectSource: (sourceId: string) => void
  onCopyRss: () => void
}

export default function GameSourceNav({
  games,
  gameId,
  loadingGames,
  sources,
  sourceId,
  loadingSources,
  total,
  sourceTotal,
  loadingNews,
  isFiltered,
  onSelectGame,
  onSelectSource,
  onCopyRss,
}: GameSourceNavProps) {
  const countText = loadingNews
    ? '加载中…'
    : isFiltered && sourceTotal !== null
      ? `${total.toLocaleString()} / ${sourceTotal.toLocaleString()} 条`
      : `共 ${total.toLocaleString()} 条`

  return (
    <nav className="news-nav-band" aria-label="游戏与来源导航">
      <div className="mx-auto max-w-6xl px-4">
        <div className="game-strip" role="tablist" aria-label="选择游戏">
          {loadingGames ? (
            Array.from({ length: 4 }, (_, index) => (
              <span key={index} className="game-pill-skeleton" aria-hidden="true" />
            ))
          ) : (
            games.map(game => {
              const active = game.id === gameId
              return (
                <button
                  key={game.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? 'game-pill is-active' : 'game-pill'}
                  onClick={() => onSelectGame(game.id)}
                >
                  {game.icon && (
                    <img
                      src={game.icon}
                      alt=""
                      className="h-5 w-5 shrink-0 rounded object-cover"
                    />
                  )}
                  <span>{game.name}</span>
                </button>
              )
            })
          )}
        </div>

        <div className="source-bar">
          <div className="source-tabs" role="tablist" aria-label="选择新闻来源">
            {loadingSources ? (
              Array.from({ length: 3 }, (_, index) => (
                <span key={index} className="source-tab-skeleton" aria-hidden="true" />
              ))
            ) : (
              sources.map(source => {
                const active = source.id === sourceId
                return (
                  <button
                    key={source.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={active ? 'source-tab is-active' : 'source-tab'}
                    onClick={() => onSelectSource(source.id)}
                  >
                    {source.name}
                  </button>
                )
              })
            )}
          </div>

          <div className="source-meta">
            <span className="result-count tabular-nums" aria-live="polite">
              {sourceId ? countText : ''}
            </span>
            <Tooltip placement="bottom" title="复制当前筛选条件的 RSS 订阅链接">
              <Button
                size="small"
                icon={<IconRss size={14} />}
                onClick={onCopyRss}
                disabled={!sourceId}
              >
                RSS
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </nav>
  )
}
