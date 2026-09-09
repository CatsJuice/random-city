import { test, expect } from '@playwright/test'
import { LANGUAGES, LANGUAGE_KEY, messages, cityNameFor } from '../src/i18n.js'

test('all languages fit on desktop and mobile, persist, and do not rebuild the city', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?seed=SHIO-2&size=120&model=astra')
  await page.waitForFunction(() => window.__CITY__?.inspect().ready)
  const background = await page.locator('.settings-button').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(background).toBe(await page.locator('.github-link').evaluate((el) => getComputedStyle(el).backgroundColor))
  expect(background).not.toBe('rgba(0, 0, 0, 0)')
  await page.getByRole('button', { name: messages['zh-CN'].settings, exact: true }).click()
  await page.getByRole('button', { name: messages['zh-CN'].pause, exact: true }).click()
  await page.getByRole('button', { name: messages['zh-CN'].zoomIn, exact: true }).click()
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    window.__LOCALE_TEST__ = { api: window.__CITY__, canvas: document.querySelector('.city-stage canvas') }
  })
  const before = await page.evaluate(() => {
    const s = window.__CITY__.inspect()
    return { camera: s.camera, seed: s.seed, time: s.state.time, weather: s.state.weather }
  })
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 980 : 844 })
    for (const [id] of LANGUAGES) {
      const text = messages[id]
      await page.locator('#language').selectOption(id)
      await expect(page.locator('html')).toHaveAttribute('lang', id)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(cityNameFor(id, '海湾城镇'))
      await expect(page).toHaveTitle(cityNameFor(id, '海湾城镇'))
      await expect(page.locator('.city-stage canvas')).toHaveAttribute('aria-label', text.canvas3d)
      await expect(page.getByRole('button', { name: text.closeSettings, exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: text.resume, exact: true })).toBeVisible()
      const layout = await page.evaluate(() => {
        const panel = document.querySelector('.inspector')
        const selectors = ['.city-title', '.header-actions > *', '.inspector-heading > *', '.section-title > *', '.weather-options button', '.language-picker']
        return {
          overflow: panel.scrollWidth > panel.clientWidth + 1,
          boxes: selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector), (el) => {
            const r = el.getBoundingClientRect()
            return { x: r.x, right: r.right, overflow: el.scrollWidth > el.clientWidth + 1 }
          })),
          sameApi: window.__CITY__ === window.__LOCALE_TEST__.api,
          sameCanvas: document.querySelector('.city-stage canvas') === window.__LOCALE_TEST__.canvas
        }
      })
      expect(layout.overflow, `${id}: sidebar`).toBe(false)
      for (const box of layout.boxes) {
        expect(box.x, id).toBeGreaterThanOrEqual(0)
        expect(box.right, id).toBeLessThanOrEqual(width)
        expect(box.overflow, id).toBe(false)
      }
      expect(layout.sameApi).toBe(true)
      expect(layout.sameCanvas).toBe(true)
      await page.screenshot({ path: test.info().outputPath(`language-${id}-${width}.png`) })
    }
  }
  expect(await page.evaluate(() => {
    const s = window.__CITY__.inspect()
    return { camera: s.camera, seed: s.seed, time: s.state.time, weather: s.state.weather }
  })).toEqual(before)
  await page.locator('#language').selectOption('en')
  await page.reload()
  await page.waitForFunction(() => window.__CITY__?.inspect().ready)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  expect(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_KEY)).toBe('en')
  await page.getByRole('combobox', { name: messages.en.model }).selectOption('gpt-5.5')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.en.cityAtlas)
  await expect(page.locator('.city-stage canvas')).toHaveAttribute('aria-label', messages.en.canvas2d)
  await page.getByRole('button', { name: messages.en.settings, exact: true }).click()
  await page.locator('#language').selectOption('zh-TW')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('城市羅盤')
  expect(errors).toEqual([])
})

test('browser language detection and language switching work when storage is blocked', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ locale: 'fr-CA', baseURL })
  try {
    await context.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage disabled') }
      Storage.prototype.setItem = () => { throw new Error('Storage disabled') }
    })
    const page = await context.newPage()
    await page.goto('/?seed=SHIO-2&model=gpt-5.5')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await page.getByRole('button', { name: messages.fr.settings, exact: true }).click()
    await page.locator('#language').selectOption('ja')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(messages.ja.cityAtlas)
  } finally { await context.close() }
})
