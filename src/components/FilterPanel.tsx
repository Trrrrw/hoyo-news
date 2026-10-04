import { useState } from 'react'
import { Button, DatePicker, Form, Input, Spin } from 'antd'
import type { FormInstance } from 'antd'
import type { Dayjs } from 'dayjs'

const { RangePicker } = DatePicker

export interface FilterValues {
  q?: string
  tags?: string[]
  characters?: string[]
  untagged?: boolean
  news_type: 'all' | 'article' | 'video'
  during: [Dayjs | null, Dayjs | null] | null
  limit: number
  reverse: boolean
}

export const DEFAULT_FILTER_VALUES: FilterValues = {
  q: undefined,
  tags: undefined,
  characters: undefined,
  untagged: false,
  news_type: 'all',
  during: null,
  limit: 20,
  reverse: false,
}

export const UNTAGGED_TAG_VALUE = '__untagged__'

export interface TagOption {
  label: string
  value: string
}

export interface TagOptionGroup {
  label: string
  options: TagOption[]
}

export type TagOptionItem = TagOption | TagOptionGroup

interface OptionButtonsProps {
  value?: string[]
  onChange?: (value: string[]) => void
  options: TagOptionItem[]
  loading: boolean
  kind: string
  id?: string
}

function OptionButtons({ value = [], onChange, options, loading, kind, id }: OptionButtonsProps) {
  const [search, setSearch] = useState('')
  const groups: TagOptionGroup[] = options.filter((option): option is TagOptionGroup => 'options' in option)
  const ungrouped = options.filter((option): option is TagOption => !('options' in option))
  if (ungrouped.length) groups.push({ label: '', options: ungrouped })
  const allOptions = groups.flatMap(group => group.options)
  const query = search.trim().toLocaleLowerCase()
  const matches = allOptions.filter(option => option.label.toLocaleLowerCase().includes(query))
  const visible = new Set(matches.map(option => option.value))
  // 已选项始终可见，便于直接取消
  for (const selected of value) visible.add(selected)
  const toggle = (key: string) => onChange?.(value.includes(key) ? value.filter(item => item !== key) : [...value, key])

  return (
    <div id={id} className="option-picker" role="group" aria-label={`${kind}多选`}>
      <div className="option-picker-tools">
        <span>共 {allOptions.length} 项 · 已选 {value.length} 项 · 多选时匹配任一项</span>
        {value.length > 0 && <Button size="small" type="link" onClick={() => onChange?.([])}>清除{kind}</Button>}
        {allOptions.length > 12 && <Input.Search allowClear value={search} onChange={event => setSearch(event.target.value)} placeholder={`查找${kind}`} aria-label={`查找${kind}`} className="option-search" />}
      </div>
      {loading ? <div className="py-3"><Spin size="small" /> <span>正在加载{kind}…</span></div> : <>
        {groups.map((group, index) => {
          const items = group.options.filter(option => visible.has(option.value))
          if (!items.length) return null
          return <div className="option-group" key={`${group.label}:${index}`}>
            {group.label && <div className="option-group-label">{group.label}</div>}
            <div className="option-buttons">{items.map(option => <Button
              key={option.value}
              type={value.includes(option.value) ? 'primary' : 'default'}
              aria-pressed={value.includes(option.value)}
              onClick={() => toggle(option.value)}
            >{value.includes(option.value) && <span aria-hidden="true">✓ </span>}{option.label}</Button>)}</div>
          </div>
        })}
        {value.filter(key => !allOptions.some(option => option.value === key)).map(key => <Button key={key} type="primary" aria-pressed onClick={() => toggle(key)}>✓ {key}</Button>)}
        {allOptions.length === 0 && <p className="option-empty">暂无可选{kind}</p>}
        {query && matches.length === 0 && <p className="option-empty">没有匹配的{kind}{value.length > 0 ? '，已选项仍保留显示' : ''}</p>}
      </>}
    </div>
  )
}

interface FilterPanelProps {
  form: FormInstance<FilterValues>
  tagOptions: TagOptionItem[]
  characterOptions: { label: string; value: string }[]
  loadingTags: boolean
  loadingCharacters: boolean
  onQuery: (values: FilterValues) => void
}

/**
 * 可选筛选面板（对应 /news 接口的可选参数）:
 * tag（标签/未分类）、character（角色）、news_type、
 * published_from/published_to（日期范围）、limit、order（时间顺序）
 */
export default function FilterPanel({
  form,
  tagOptions,
  characterOptions,
  loadingTags,
  loadingCharacters,
  onQuery,
}: FilterPanelProps) {
  return (
    <Form<FilterValues>
      form={form}
      layout="vertical"
      initialValues={DEFAULT_FILTER_VALUES}
      onFinish={onQuery}
      onValuesChange={(_, values) => onQuery({ ...form.getFieldsValue(true), ...values })}
    >
      <div className="filter-fields">
        <Form.Item name="during" label="发布日期范围" className="filter-date">
          <RangePicker
            className="w-full"
            id={{ start: 'during', end: 'during_end' }}
          />
        </Form.Item>
        <Form.Item name="tags" label="标签">
          <OptionButtons options={tagOptions} loading={loadingTags} kind="标签" />
        </Form.Item>
        <Form.Item name="characters" label="角色">
          <OptionButtons options={characterOptions} loading={loadingCharacters} kind="角色" />
        </Form.Item>
      </div>
    </Form>
  )
}
