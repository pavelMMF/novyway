import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Сборка одним самодостаточным HTML-файлом (для быстрого просмотра без сервера)
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: 'dist-single',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 8000,
    cssCodeSplit: false,
  },
})
