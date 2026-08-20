import { Button, DatePicker, Form, Input, Segmented, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import type { Dayjs } from 'dayjs'

const { RangePicker } = DatePicker

function RssIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <circle cx="5" cy="19" r="1.8" fill="currentColor" />
      <path
        d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

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

interface FilterPanelProps {
  form: FormInstance<FilterValues>
  tagOptions: TagOptionItem[]
  characterOptions: { label: string; value: string }[]
  loadingTags: boolean
  loadingCharacters: boolean
  queryLoading: boolean
  onQuery: (values: FilterValues) => void
  onReset: () => void
  onRss: () => void
}

/**
 * 可选筛选面板（对应 /news 接口的可选参数）:
 * q（标题查询）、tag（标签/未分类）、character（角色）、news_type、
 * published_from/published_to（日期范围）、limit、order（时间顺序）
 */
export default function FilterPanel({
  form,
  tagOptions,
  characterOptions,
  loadingTags,
  loadingCharacters,
  queryLoading,
  onQuery,
  onReset,
  onRss,
}: FilterPanelProps) {
  return (
    <Form<FilterValues>
      form={form}
      layout="vertical"
      initialValues={DEFAULT_FILTER_VALUES}
      onFinish={onQuery}
    >
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
        <Form.Item name="q" label="关键词 (q)" className="sm:col-span-2">
          <Input
            allowClear
            placeholder="标题查询：空格 AND、| OR、- 排除、引号短语"
          />
        </Form.Item>
        <div>
          <div className="mb-2 text-sm leading-6 text-neutral-700">
            <span id="news_type_label">新闻类型</span>
          </div>
          <Form.Item name="news_type" noStyle>
            <Segmented
              aria-labelledby="news_type_label"
              block
              options={[
                { label: '全部', value: 'all' },
                { label: '文章', value: 'article' },
                { label: '视频', value: 'video' },
              ]}
            />
          </Form.Item>
        </div>
        <Form.Item name="during" label="发布日期范围">
          <RangePicker
            className="w-full"
            id={{ start: 'during', end: 'during_end' }}
          />
        </Form.Item>
        <Form.Item name="tags" label="标签 (tags)" className="sm:col-span-2">
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="选择标签，可多选（任一匹配即可）"
            options={tagOptions}
            loading={loadingTags}
          />
        </Form.Item>
        <Form.Item name="characters" label="角色 (character)" className="sm:col-span-2">
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="选择角色，可多选（任一匹配即可）"
            options={characterOptions}
            loading={loadingCharacters}
            notFoundContent={loadingCharacters ? '正在加载角色…' : '暂无角色数据'}
          />
        </Form.Item>
        <Form.Item
          name="reverse"
          label="时间顺序 (order)"
          valuePropName="checked"
          className="mb-0"
        >
          <Switch checkedChildren="升序" unCheckedChildren="降序" />
        </Form.Item>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button onClick={onReset}>重置</Button>
        <Button variant="solid" color="primary" htmlType="submit" loading={queryLoading}>
          查询
        </Button>
        <Button
          shape="circle"
          icon={<RssIcon />}
          aria-label="复制 RSS 链接"
          title="复制 RSS 链接"
          onClick={onRss}
        />
      </div>
    </Form>
  )
}
