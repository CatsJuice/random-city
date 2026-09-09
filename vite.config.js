import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { cwd } from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), '')
  const siteUrl = env.VITE_SITE_URL
  const origin = siteUrl ? new URL(siteUrl).origin : ''
  let basePath = env.VITE_BASE_PATH || (siteUrl ? new URL(siteUrl).pathname : '/')
  return {
    base: basePath,
    plugins: [
      react(),
      {
        name: 'city-social-metadata',
        configResolved(config) {
          basePath = config.base
        },
        transformIndexHtml: {
          order: 'pre',
          handler(html, context) {
            const local = context.server?.resolvedUrls?.local[0]
            const socialOrigin = origin || (local ? new URL(local).origin : '')
            if (!socialOrigin) return html
            return html.replaceAll(
              'content="/og-image.png"',
              `content="${socialOrigin}${basePath}og-image.png"`
            )
          }
        }
      }
    ]
  }
})
