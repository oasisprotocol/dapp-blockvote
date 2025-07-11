import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
import react from '@vitejs/plugin-react-swc'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { visualizer } from 'rollup-plugin-visualizer'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svgr(),
    react(),
    viteSingleFile({
      useRecommendedBuildConfig: false,
      inlinePattern: ['assets/style-*.css'],
    }),
    {
      name: 'generate-404',
      writeBundle() {
        const indexPath = path.resolve(__dirname, 'dist/index.html')
        const notFoundPath = path.resolve(__dirname, 'dist/404.html')
        if (fs.existsSync(indexPath)) {
          fs.copyFileSync(indexPath, notFoundPath)
          console.log('Copied dist/index.html to dist/404.html')
        } else {
          console.warn('index.html not found in dist folder')
        }
      },
    },
    visualizer(),
    tailwindcss(),
  ],
  base: './',
  build: {
    sourcemap: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        manualChunks(id: string) {
          if (id.includes('ethers')) {
            return 'ethers'
          }
        },
      },
    },
  },
})
