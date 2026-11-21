import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ThemeContext,
  type ResolvedTheme,
  type ThemeMode,
} from './ThemeContext'

const storageKey = 'theme-mode'

function readThemeMode(): ThemeMode {
  const stored = localStorage.getItem(storageKey)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light')

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const resolvedTheme = mode === 'system' ? systemTheme : mode

  useEffect(() => {
    localStorage.setItem(storageKey, mode)
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
    document.documentElement.style.colorScheme = resolvedTheme
  }, [mode, resolvedTheme])

  const cycleTheme = useCallback(() => {
    setMode(current => (current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system'))
  }, [])

  const value = useMemo(
    () => ({ mode, resolvedTheme, cycleTheme }),
    [mode, resolvedTheme, cycleTheme],
  )

  const isDark = resolvedTheme === 'dark'

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        locale={zhCN}
        button={{ autoInsertSpace: false }}
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: isDark ? '#4ba0bf' : '#276d89',
            borderRadius: 10,
            controlHeight: 36,
            fontFamily:
              '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Segoe UI", system-ui, -apple-system, sans-serif',
            colorBgContainer: isDark ? '#141d24' : '#ffffff',
            colorBgElevated: isDark ? '#1a252e' : '#ffffff',
            colorBorder: isDark ? '#283946' : '#d8e1e7',
            colorBorderSecondary: isDark ? '#21303b' : '#e6edf1',
            colorText: isDark ? '#e4edf2' : '#132632',
            colorTextSecondary: isDark ? '#8fa5b2' : '#526572',
          },
        }}
      >
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
