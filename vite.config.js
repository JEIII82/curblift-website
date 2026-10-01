import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        services: resolve(__dirname, 'services/index.html'),
        results: resolve(__dirname, 'results/index.html'),
        about: resolve(__dirname, 'about/index.html'),
        areas: resolve(__dirname, 'areas/index.html'),
        contact: resolve(__dirname, 'contact/index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
    },
  },
})
