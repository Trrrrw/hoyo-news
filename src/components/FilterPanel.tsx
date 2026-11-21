import { useMemo, useState } from 'react'
import { IconCheck, IconSearch } from '@tabler/icons-react'
import { Alert, Button, DatePicker, Drawer, Input, Spin } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { UNTAGGED_TAG_VALUE } from '../filters'
import type { FilterValues, TagOption, TagOptionGroup, TagOptionItem } from '../filters'

const { RangePicker } = DatePicker

const DATE_PRESETS: { label: string; value: [Dayjs, Dayjs] }[] = [
  { label: '近 7 天', value: [dayjs().subtract(6, 'day'), dayjs()] },
  { label: '近 30 天', value: [dayjs().subtract(29, 'day'), dayjs()] },
  { label: '近 90 天', value: [dayjs().subtract(89, 'day'), dayjs()] },
  { label: '近 1 年', value: [dayjs().subtract(1, 'year').add(1, 'day'), dayjs()] },
]

interface OptionPickerProps {
  value: string[]
  onChange: (value: string[]) => void
  options: TagOptionItem[]
  loading: boolean
  kind: string
  labelMap?: Record<string, string>
}

function OptionPicker({ value, onChange, options, loading, kind, labelMap }: OptionPickerProps) {
  const [search, setSearch] = useState('')

  const groups = useMemo(() => {
    const grouped: TagOptionGroup[] = options.filter((option): option is TagOptionGroup => 'options' in option)
    const ungrouped: TagOption[] = options.filter((option): option is TagOption => !('options' in option))
    return ungrouped.length ? [...grouped, { label: '', options: ungrouped }] : grouped
  }, [options])

  const allOptions = useMemo(() => groups.flatMap(group => group.options), [groups])
  const selectedSet = useMemo(() => new Set(value), [value])
  const knownValues = useMemo(() => new Set(allOptions.map(option => option.value)), [allOptions])

  const query = search.trim().toLocaleLowerCase()
  const matches = useMemo(
    () => (query ? allOptions.filter(option => option.label.toLocaleLowerCase().includes(query)) : allOptions),
    [allOptions, query],
  )
  const visible = useMemo(() => {
    const set = new Set(matches.map(option => option.value))
    // 已选项始终可见，便于直接取消
    for (const selected of value) set.add(selected)
    return set
  }, [matches, value])

  const toggle = (key: string) => {
    onChange(selectedSet.has(key) ? value.filter(item => item !== key) : [...value, key])
  }

  const orphanSelected = value.filter(key => !knownValues.has(key))

  return (
    <div className="option-picker" role="group" aria-label={`${kind}多选`}>
      <div className="option-picker-tools">
        <span className="tabular-nums">
          {value.length > 0 ? `已选 ${value.length} 项 / 共 ${allOptions.length} 项` : `共 ${allOptions.length} 项`}
        </span>
        {value.length > 0 && (
          <Button size="small" type="link" onClick={() => onChange([])}>
            清空
          </Button>
        )}
        {allOptions.length > 10 && (
          <Input
            allowClear
            size="small"
            value={search}
            prefix={<IconSearch size={14} className="text-[var(--ink-secondary)]" />}
            onChange={event => setSearch(event.target.value)}
            placeholder={`筛选${kind}`}
            aria-label={`筛选${kind}`}
            className="option-search"
          />
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--ink-secondary)]">
          <Spin size="small" />
          <span>正在加载{kind}…</span>
        </div>
      ) : (
        <>
          {groups.map((group, index) => {
            const items = group.options.filter(option => visible.has(option.value))
            if (!items.length) return null
            return (
              <div className="option-group" key={`${group.label}:${index}`}>
                {group.label && <div className="option-group-label">{group.label}</div>}
                <div className="option-buttons">
                  {items.map(option => {
                    const selected = selectedSet.has(option.value)
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        className={selected ? 'option-chip is-selected' : 'option-chip'}
                        onClick={() => toggle(option.value)}
                      >
                        {selected && <IconCheck size={14} className="shrink-0" aria-hidden="true" />}
                        <span>{option.label}</span>
                        {option.count != null && (
                          <span className="option-chip-count tabular-nums">{option.count}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {orphanSelected.length > 0 && (
            <div className="option-group">
              <div className="option-buttons">
                {orphanSelected.map(key => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed
                    className="option-chip is-selected"
                    onClick={() => toggle(key)}
                  >
                    <IconCheck size={14} className="shrink-0" aria-hidden="true" />
                    <span>{labelMap?.[key] ?? key}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {allOptions.length === 0 && <p className="option-empty">暂无可选{kind}</p>}
          {query && matches.length === 0 && (
            <p className="option-empty">
              没有匹配的{kind}
              {value.length > 0 ? '，已选项仍保留显示' : ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}

interface FilterPanelProps {
  open: boolean
  filters: FilterValues
  gameId: string | null
  tagOptions: TagOptionItem[]
  characterOptions: TagOption[]
  characterNameMap: Record<string, string>
  loadingTags: boolean
  loadingCharacters: boolean
  loadingNews: boolean
  total: number
  error: string | null
  onClose: () => void
  onUpdateFilters: (patch: Partial<FilterValues>) => void
  onResetFilters: () => void
}

export default function FilterPanel({
  open,
  filters,
  gameId,
  tagOptions,
  characterOptions,
  characterNameMap,
  loadingTags,
  loadingCharacters,
  loadingNews,
  total,
  error,
  onClose,
  onUpdateFilters,
  onResetFilters,
}: FilterPanelProps) {
  const selectedTagValues = useMemo(
    () => (filters.untagged ? [...filters.tags, UNTAGGED_TAG_VALUE] : filters.tags),
    [filters.tags, filters.untagged],
  )

  const characterFallbackNames = useMemo(() => {
    if (!gameId) return {}
    const result: Record<string, string> = {}
    for (const id of filters.characters) {
      const name = characterNameMap[`${gameId}:${id}`]
      if (name) result[id] = name
    }
    return result
  }, [characterNameMap, filters.characters, gameId])

  const handleTagSelectionChange = (values: string[]) => {
    const untagged = values.includes(UNTAGGED_TAG_VALUE)
    const tags = values.filter(item => item !== UNTAGGED_TAG_VALUE)
    onUpdateFilters({ tags, untagged })
  }

  return (
    <Drawer
      title="高级筛选"
      open={open}
      onClose={onClose}
      size="min(640px, 100vw)"
      rootClassName="news-filter-drawer"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button onClick={onResetFilters}>重置全部筛选</Button>
          <Button type="primary" loading={loadingNews} onClick={onClose}>
            {error ? '返回列表' : `查看 ${total.toLocaleString()} 条结果`}
          </Button>
        </div>
      }
    >
      <div className="filter-drawer-sections">
        <section className="filter-section">
          <h3 className="filter-section-title">发布日期</h3>
          <RangePicker
            className="filter-date w-full"
            presets={DATE_PRESETS}
            value={filters.during}
            allowEmpty={[true, true]}
            id={{ start: 'during', end: 'during_end' }}
            onChange={dates =>
              onUpdateFilters({
                during: dates && (dates[0] || dates[1]) ? [dates[0] ?? null, dates[1] ?? null] : null,
              })
            }
          />
        </section>

        <section className="filter-section">
          <h3 className="filter-section-title">标签</h3>
          <OptionPicker
            value={selectedTagValues}
            onChange={handleTagSelectionChange}
            options={tagOptions}
            loading={loadingTags}
            kind="标签"
          />
        </section>

        <section className="filter-section">
          <h3 className="filter-section-title">角色</h3>
          <OptionPicker
            value={filters.characters}
            onChange={characters => onUpdateFilters({ characters })}
            options={characterOptions}
            loading={loadingCharacters}
            kind="角色"
            labelMap={characterFallbackNames}
          />
        </section>

        {error && <Alert type="error" showIcon title={error} />}
      </div>
    </Drawer>
  )
}
