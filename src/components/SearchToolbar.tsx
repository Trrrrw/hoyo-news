import { useState } from 'react'
import {
  IconAdjustments,
  IconFileSearch,
  IconHelpCircle,
  IconSearch,
} from '@tabler/icons-react'
import { Badge, Button, Input, Popover, Segmented, Select, Tag, Tooltip } from 'antd'
import { countDrawerFilters } from '../filters'
import type { FilterValues } from '../filters'

interface SearchToolbarProps {
  filters: FilterValues
  gameId: string | null
  disabled: boolean
  characterNameMap: Record<string, string>
  onUpdateFilters: (patch: Partial<FilterValues>) => void
  onResetFilters: () => void
  onOpenFilterDrawer: () => void
}

const SEARCH_SYNTAX_HELP = (
  <div className="search-help-popover">
    <div className="search-help-row">
      <code>A B</code>
      <span>同时包含 A 和 B</span>
    </div>
    <div className="search-help-row">
      <code>A | B</code>
      <span>包含 A 或 B</span>
    </div>
    <div className="search-help-row">
      <code>-A</code>
      <span>排除包含 A 的结果</span>
    </div>
    <div className="search-help-row">
      <code>&quot;完整短语&quot;</code>
      <span>精确短语匹配</span>
    </div>
  </div>
)

export default function SearchToolbar({
  filters,
  gameId,
  disabled,
  characterNameMap,
  onUpdateFilters,
  onResetFilters,
  onOpenFilterDrawer,
}: SearchToolbarProps) {
  // 记录上次外部 filters.q，确保外部重置/回退时同步输入框而不触发 effect 中的 setState
  const [draft, setDraft] = useState(() => filters.q ?? '')
  const [syncedQuery, setSyncedQuery] = useState(() => filters.q ?? '')

  const currentQuery = filters.q ?? ''
  if (currentQuery !== syncedQuery) {
    setSyncedQuery(currentQuery)
    setDraft(currentQuery)
  }

  const drawerCount = countDrawerFilters(filters)
  const searchPlaceholder = filters.search_body ? '搜索新闻标题与正文…' : '搜索新闻标题…'

  const submitSearch = (value: string) => {
    const trimmed = value.trim() || undefined
    setDraft(value)
    setSyncedQuery(trimmed ?? '')
    onUpdateFilters({ q: trimmed })
  }

  const toggleBodySearch = () => {
    const next = !filters.search_body
    const trimmed = draft.trim() || undefined
    if (trimmed !== filters.q) {
      setSyncedQuery(trimmed ?? '')
    }
    onUpdateFilters({ q: trimmed, search_body: next })
  }

  const filterChips: { key: string; label: string; remove: Partial<FilterValues> }[] = []
  if (filters.q) {
    filterChips.push({
      key: 'q',
      label: `${filters.search_body ? '全文' : '标题'}：${filters.q}`,
      remove: { q: undefined },
    })
  }
  for (const tag of filters.tags) {
    filterChips.push({
      key: `tag:${tag}`,
      label: tag,
      remove: { tags: filters.tags.filter(value => value !== tag) },
    })
  }
  if (filters.untagged) {
    filterChips.push({
      key: 'untagged',
      label: '未分类',
      remove: { untagged: false },
    })
  }
  for (const id of filters.characters) {
    const name = (gameId ? characterNameMap[`${gameId}:${id}`] : undefined) ?? id
    filterChips.push({
      key: `character:${id}`,
      label: `角色：${name}`,
      remove: { characters: filters.characters.filter(value => value !== id) },
    })
  }
  if (filters.during?.[0] || filters.during?.[1]) {
    filterChips.push({
      key: 'during',
      label: `${filters.during[0]?.format('YYYY-MM-DD') ?? '不限'} 至 ${filters.during[1]?.format('YYYY-MM-DD') ?? '不限'}`,
      remove: { during: null },
    })
  }
  if (filters.news_type !== 'all') {
    filterChips.push({
      key: 'type',
      label: filters.news_type === 'article' ? '文章' : '视频',
      remove: { news_type: 'all' },
    })
  }
  if (filters.reverse) {
    filterChips.push({
      key: 'order',
      label: '最早发布',
      remove: { reverse: false },
    })
  }

  return (
    <section className="news-toolbar" aria-label="搜索与筛选">
      <div className="news-toolbar-row">
        <div className="news-search-group">
          <Input
            allowClear
            value={draft}
            disabled={disabled}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            prefix={<IconSearch size={16} className="text-[var(--ink-secondary)]" />}
            suffix={
              <Popover content={SEARCH_SYNTAX_HELP} title="搜索语法" trigger="click" placement="bottomRight">
                <button
                  type="button"
                  className="search-syntax-btn"
                  aria-label="查看搜索语法"
                  onMouseDown={event => event.preventDefault()}
                >
                  <IconHelpCircle size={16} />
                </button>
              </Popover>
            }
            onChange={event => {
              const nextValue = event.target.value
              setDraft(nextValue)
              // 点击清空按钮时立即清除已生效的搜索词
              if (nextValue === '' && filters.q) {
                setSyncedQuery('')
                onUpdateFilters({ q: undefined })
              }
            }}
            onPressEnter={() => submitSearch(draft)}
          />
          <Tooltip placement="bottom" title={filters.search_body ? '当前同时搜索标题与正文' : '点击开启正文全文搜索'}>
            <Button
              type={filters.search_body ? 'primary' : 'default'}
              icon={<IconFileSearch size={16} />}
              disabled={disabled}
              aria-pressed={filters.search_body}
              onClick={toggleBodySearch}
            >
              <span className="hidden sm:inline">含正文</span>
            </Button>
          </Tooltip>
          <Button
            type="primary"
            disabled={disabled}
            onClick={() => submitSearch(draft)}
          >
            搜索
          </Button>
        </div>

        <div className="news-toolbar-actions">
          <Segmented
            aria-label="新闻类型"
            disabled={disabled}
            value={filters.news_type}
            options={[
              { label: '全部', value: 'all' },
              { label: '文章', value: 'article' },
              { label: '视频', value: 'video' },
            ]}
            onChange={value => onUpdateFilters({ news_type: value as FilterValues['news_type'] })}
          />
          <Select
            aria-label="排序方式"
            disabled={disabled}
            className="news-sort-select"
            value={filters.reverse ? 'asc' : 'desc'}
            options={[
              { label: '最新发布', value: 'desc' },
              { label: '最早发布', value: 'asc' },
            ]}
            onChange={value => onUpdateFilters({ reverse: value === 'asc' })}
          />
          <Badge count={drawerCount} size="small" offset={[-4, 4]}>
            <Button
              icon={<IconAdjustments size={17} />}
              disabled={disabled}
              aria-haspopup="dialog"
              onClick={onOpenFilterDrawer}
            >
              筛选
            </Button>
          </Badge>
        </div>
      </div>

      {filterChips.length > 0 && (
        <div className="active-filters" aria-label="已应用的筛选条件">
          {filterChips.map(chip => (
            <Tag
              key={chip.key}
              closable
              onClose={event => {
                event.preventDefault()
                onUpdateFilters(chip.remove)
              }}
            >
              {chip.label}
            </Tag>
          ))}
          <Button type="link" size="small" onClick={onResetFilters}>
            清除全部
          </Button>
        </div>
      )}
    </section>
  )
}
