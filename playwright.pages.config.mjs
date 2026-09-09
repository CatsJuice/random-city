import { defineConfig } from '@playwright/test'
import config from './playwright.config.mjs'

const baseURL = process.env.CITY_PAGES_TEST_URL || 'http://127.0.0.1:4174/random-city/'
const url = new URL(baseURL)

export default defineConfig({
  ...config,
  testMatch: '**/pages.spec.mjs',
  testIgnore: [],
  use: { ...config.use, baseURL },
  webServer: url.hostname === '127.0.0.1' ? {
    command: `npm run preview -- --host 127.0.0.1 --port ${url.port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { VITE_BASE_PATH: url.pathname }
  } : undefined
})
