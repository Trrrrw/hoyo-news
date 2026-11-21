import {
  IconBrandGithub,
  IconMoon,
  IconSun,
  IconSunMoon,
} from '@tabler/icons-react'
import { Button, Tooltip } from 'antd'
import { useThemeMode } from '../theme/ThemeContext'

function ThemeToggle() {
  const { mode, cycleTheme } = useThemeMode()

  const config = {
    light: { icon: <IconSun size={18} />, title: '浅色模式' },
    dark: { icon: <IconMoon size={18} />, title: '深色模式' },
    system: { icon: <IconSunMoon size={18} />, title: '跟随系统' },
  }[mode]

  return (
    <Tooltip placement="bottom" title={config.title}>
      <Button
        type="text"
        shape="circle"
        icon={config.icon}
        aria-label={`当前：${config.title}；点击切换主题`}
        onClick={cycleTheme}
      />
    </Tooltip>
  )
}

export default function AppHeader() {
  return (
    <header className="news-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <a href="/" aria-label="蒸汽鸟报首页" className="news-brand">
          <img
            src="/steambird-mark.png"
            alt=""
            draggable={false}
            className="h-9 w-9 shrink-0 select-none rounded-lg"
          />
          <h1 className="news-brand-title">蒸汽鸟报</h1>
        </a>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <Tooltip placement="bottom" title="GitHub 仓库">
            <Button
              type="text"
              shape="circle"
              href="https://github.com/Trrrrw/hoyo-news"
              target="_blank"
              rel="noreferrer"
              icon={<IconBrandGithub size={18} />}
              aria-label="GitHub 仓库"
            />
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
