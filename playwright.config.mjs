import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  testIgnore: '**/pages.spec.mjs',
  workers: 1,
  timeout: 180000,
  use: {
    baseURL: process.env.CITY_TEST_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 980 },
    headless: true,
    launchOptions: {
      args: process.platform === 'darwin'
        ? ['--use-angle=metal']
        : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    },
    screenshot: 'only-on-failure'
  }
})
