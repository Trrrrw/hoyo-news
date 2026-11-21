import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'antd-icons', test: /node_modules[\\/](@ant-design|@tabler)[\\/]/, priority: 25 },
            { name: 'rc-vendor', test: /node_modules[\\/]@rc-component[\\/]/, priority: 20 },
            { name: 'antd', test: /node_modules[\\/]antd[\\/]/, priority: 15 },
            { name: 'dayjs', test: /node_modules[\\/]dayjs[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
