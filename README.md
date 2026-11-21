# 蒸汽鸟报

一个从 Akasha API 获取游戏官方新闻并提供检索、筛选和阅读的非官方 Web 应用

[Akasha API 文档](https://akasha.trrw.cn/scalar) · [联系方式](https://trrw.cn/#contact) · [影像档案架](https://video.trrw.cn)

## 功能

- 按游戏和新闻来源浏览新闻
- 支持关键词、标签、未分类、角色、新闻类型和发布日期范围筛选
- 支持升序或降序排列新闻
- 通过 URL 保存当前游戏、来源、筛选条件和分页状态，可直接分享或刷新
- 复制当前筛选条件对应的 RSS 订阅链接
- 在居中详情弹窗中查看封面、正文、标签、关联角色和新闻 ID
- 支持视频新闻播放，并通过 API 获取有效的视频播放地址
- 新闻封面使用懒加载，列表针对移动端进行适配
- 提供刷新数据和回到顶部按钮

## 技术栈

- [React](https://react.dev/) 与 [TypeScript](https://www.typescriptlang.org/)
- [Ant Design](https://ant.design/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite](https://vite.dev/)
- [Day.js](https://day.js.org/)

## 本地开发

请先安装 Node.js 和 [pnpm](https://pnpm.io/)，然后执行：

```bash
# 在项目目录执行
pnpm install
pnpm dev
```

开发服务器默认运行在 `http://localhost:5173`。如果需要从局域网内其他设备访问，可以执行：

```bash
pnpm dev --host 0.0.0.0
```

## 环境变量

项目通过根目录下的 `.env` 配置开发环境 API 地址：

```dotenv
VITE_DEV_BACKEND_BASE=http://127.0.0.1:7040
```

未配置时，前端默认请求线上 API：

```text
https://akasha.trrw.cn
```

本地 API 文档地址通常为 `http://127.0.0.1:7040/scalar`。`VITE_` 开头的变量会被写入前端构建结果，请勿在其中保存密钥或其他敏感信息

## URL 与筛选参数

新闻列表使用游戏 ID 作为路径、新闻来源和筛选条件作为查询参数，例如：

```text
/ys?source=web_cn&limit=20&offset=0&order=desc
```

支持的主要查询参数如下：

| 参数 | 说明 |
| --- | --- |
| `source` | 新闻来源 ID |
| `q` | 标题关键词查询，支持空格 AND、`\|` OR、`-` 排除和引号短语 |
| `search_body=true` | 同时搜索标题和正文 |
| `tag` | 标签，可重复传入多个值 |
| `untagged=true` | 包含未分类新闻 |
| `character` | 角色 ID，可重复传入多个值 |
| `news_type` | `article` 或 `video` |
| `published_from` | 发布日期起始值，格式为 `YYYY-MM-DD` |
| `published_to` | 发布日期结束值，格式为 `YYYY-MM-DD` |
| `limit` | 每页数量 |
| `offset` | 分页偏移量 |
| `order` | `asc` 或 `desc` |

顶部导航栏可直接切换游戏与新闻来源；工具栏支持关键词检索、切换“含正文”搜索、按类型与时间排序，并可打开筛选抽屉按发布日期、标签、未分类和角色进一步筛选。标签与角色选项在页面会话内缓存，手动刷新会使当前缓存失效。选择“未分类”标签时，前端会将其转换为 API 参数 `untagged=true`。

开启搜索栏中的“含正文”会同时搜索标题和正文，并在列表（包括移动端）高亮结果中的匹配词。分享页面网址可保留该设置。

## API 接口

前端使用的主要接口包括：

```text
GET /api/v1/games
GET /api/v1/news/sources?game={game_id}
GET /api/v1/news/tags?game={game_id}&source={source}
GET /api/v1/games/{game_id}/characters?limit={limit}&offset={offset}
GET /api/v1/news?game={game_id}&source={source}&...
GET /api/v1/news/search?game={game_id}&source={source}&q={keyword}
GET /api/v1/news/{game_id}/{source}/{news_id}
GET /api/v1/news/{game_id}/{source}/{news_id}/media/video
GET /api/v1/news/rss?game={game_id}&source={source}&...
```

完整的接口定义和响应结构请参考 [Akasha API 文档](https://akasha.trrw.cn/scalar)

## 检查与构建

```bash
# 类型检查
pnpm exec tsc -b --pretty false

# 代码检查
pnpm lint

# 生产构建
pnpm build

# 本地预览构建结果
pnpm preview
```

构建产物位于 `dist` 目录。部署时需要将未知路径回退到 `index.html`，以支持前端路由直接访问和刷新

## 项目结构

```text
public/
├── favicon.svg
└── steambird-mark.png

src/
├── api.ts                        API 请求、响应类型和数据模型
├── App.tsx                       页面布局与主交互编排
├── filters.ts                    筛选模型、归一化与 RSS 地址生成
├── components/
│   ├── AppHeader.tsx             顶部报头与主题切换
│   ├── FilterPanel.tsx           高级筛选抽屉（日期、标签、角色）
│   ├── GameSourceNav.tsx         游戏与新闻来源导航条
│   ├── NewsModal.tsx             新闻详情弹窗、正文清理与视频播放
│   ├── NewsFeedSkeleton.tsx      新闻列表加载骨架屏
│   ├── NewsItemRow.tsx           新闻列表项与高亮片段展示
│   ├── SearchToolbar.tsx         搜索栏、快捷筛选与已选条件标签
│   └── VideoPlayer.tsx           直链与 YouTube 嵌入视频播放器
├── hooks/
│   ├── useCopyText.ts            复制文本和消息提示
│   └── useNewsFeed.ts            新闻数据、筛选状态、缓存与路由同步
├── theme/
│   ├── ThemeContext.ts           主题上下文定义
│   └── ThemeProvider.tsx         浅色/深色主题与 Ant Design 配置
├── index.css                     设计变量、全局样式和响应式样式
├── main.tsx                      React 入口
├── newsRoute.ts                  URL 查询参数读写
└── utils.ts                      正文清理、时间和时长格式化
```

## 内容与版权声明

本项目是个人制作的非官方新闻整理工具，仅用于索引、整理和个人非商业浏览相关游戏官方发布的新闻内容，不代表米哈游或其他权利方，也未获得其官方授权

站内展示的新闻标题、正文、图片、视频、游戏名称、角色名称及其他相关素材，其著作权、商标权和其他权利归米哈游及相关权利方所有。本项目不主张对上述素材享有任何权利

如有版权或内容问题，请通过[联系方式](https://trrw.cn/#contact)联系
