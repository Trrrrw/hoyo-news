import { App as AntdApp } from 'antd'
import { useCallback } from 'react'

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('copy failed')
}

let copyMessageId = 0
type CopyTextInput = string | Promise<string>

export function useCopyText() {
  const { message } = AntdApp.useApp()

  return useCallback(
    async (
      text: CopyTextInput,
      successMessage = '已复制',
      errorMessage = '复制失败，请检查浏览器权限',
    ) => {
      const key = `copy-text-${++copyMessageId}`
      message.loading({
        key,
        content: '复制中…',
        duration: 0,
      })

      try {
        await copyText(await text)
        message.success({
          key,
          content: successMessage,
          duration: 2,
        })
      } catch {
        message.error({
          key,
          content: errorMessage,
          duration: 3,
        })
      }
    },
    [message],
  )
}
