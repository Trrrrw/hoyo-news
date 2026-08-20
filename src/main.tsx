import { createRoot } from 'react-dom/client'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './index.css'
import App from './App.tsx'

dayjs.locale('zh-cn')

createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={zhCN}>
    <AntdApp>
      <App />
    </AntdApp>
  </ConfigProvider>,
)
