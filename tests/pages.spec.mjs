import { test, expect } from '@playwright/test'

async function pixels(page) {
  return page.locator('.city-stage canvas').evaluate((source) => {
    const sample = document.createElement('canvas')
    sample.width = 100
    sample.height = 80
    const ctx = sample.getContext('2d')
    ctx.drawImage(source, 0, 0, 100, 80)
    const data = ctx.getImageData(0, 0, 100, 80).data
    const colors = new Set()
    let hash = 0
    for (let i = 0; i < data.length; i += 4) {
      colors.add(`${data[i] >> 4}:${data[i + 1] >> 4}:${data[i + 2] >> 4}`)
      hash = (Math.imul(hash, 31) + data[i] + data[i + 1] * 3 + data[i + 2] * 7) | 0
    }
    return { colors: colors.size, hash }
  })
}
async function ready(page) {
  await expect(page.locator('.city-stage canvas')).toHaveCount(1)
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 90000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect.poll(async () => (await pixels(page)).colors).toBeGreaterThan(35)
}

async function headerFits(page) {
  const boxes = await page.locator('.brand, .header-actions > *').evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    })
  )
  const width = page.viewportSize().width
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      expect(overlapX > 0 && overlapY > 0).toBe(false)
    }
  }
}

test('production site works under the Pages path in both implementations', async ({ page, baseURL }) => {
  const site = new URL(baseURL), errors = [], failed = [], models = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(message.text())
  })
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.origin !== site.origin) return
    if (response.status() >= 400) failed.push(response.url())
    if (url.pathname.endsWith('.glb')) models.push(url.pathname)
  })
  await page.goto(new URL('?seed=SHIO-261079&size=120&model=astra', site).href)
  await ready(page)
  await expect(page.getByRole('complementary', { name: '城市设置' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '汐湾城市罗盘' })).toHaveAttribute('href', site.pathname)
  const github = page.getByRole('link', { name: 'GitHub 仓库' })
  await expect(github).toHaveAttribute('href', 'https://github.com/CatsJuice/random-city')
  await expect(github).toHaveAttribute('target', '_blank')
  await expect(github).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(github.locator('use')).toHaveAttribute('href', `${site.pathname}icons.svg#github-icon`)
  await headerFits(page)
  expect(models.length).toBeGreaterThan(5)
  expect(models.every((path) => path.startsWith(`${site.pathname}models/`))).toBe(true)
  await page.screenshot({ path: test.info().outputPath('pages-astra-desktop.png') })
  await page.getByRole('button', { name: '城市设置', exact: true }).click()
  await page.getByRole('button', { name: '暂停模拟', exact: true }).click()
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  await page.waitForTimeout(800)
  const before = await pixels(page)
  await page.getByRole('button', { name: '放大', exact: true }).click({ clickCount: 2 })
  await expect.poll(async () => (await pixels(page)).hash).not.toBe(before.hash)
  for (const version of ['gpt-5.5', 'astra']) {
    await page.getByRole('combobox', { name: '实现模型' }).selectOption(version)
    await ready(page)
    expect(new URL(page.url()).pathname).toBe(site.pathname)
    expect(new URL(page.url()).searchParams.get('model')).toBe(version)
    if (version === 'gpt-5.5') {
      expect(await page.locator('.city-stage canvas').evaluate((c) => !!c.getContext('2d'))).toBe(true)
      await page.reload()
      await ready(page)
      await expect(page.getByRole('combobox', { name: '实现模型' })).toHaveValue(version)
    }
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await headerFits(page)
      await expect.poll(async () => (await pixels(page)).colors).toBeGreaterThan(35)
      await page.screenshot({ path: test.info().outputPath(`pages-${version}-${width}.png`) })
    }
  }
  await page.getByRole('link', { name: '汐湾城市罗盘' }).click()
  await ready(page)
  expect(new URL(page.url()).pathname).toBe(site.pathname)
  expect(failed).toEqual([])
  expect(errors).toEqual([])
})

test('deployed sharing image and icon resolve inside the Pages path', async ({ page, request, baseURL }) => {
  await page.goto(baseURL)
  const site = new URL(baseURL)
  const image = new URL(await page.locator('meta[property="og:image"]').getAttribute('content'))
  expect(image.protocol).toBe('https:')
  expect(image.pathname).toBe(`${site.pathname}og-image.png`)
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', image.href)
  // Local preview retains the production OG origin; fetch the matching local asset.
  const response = await request.get(new URL(image.pathname, site.origin).href)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/png')
  const icon = await page.locator('link[rel="icon"]').getAttribute('href')
  expect(icon).toBe(`${site.pathname}favicon.svg`)
  expect((await request.get(new URL(icon, site.origin).href)).ok()).toBe(true)
  const symbols = await request.get(new URL(`${site.pathname}icons.svg`, site.origin).href)
  expect(symbols.ok()).toBe(true)
  expect(await symbols.text()).toContain('id="github-icon"')
})
