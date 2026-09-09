import { test, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const output = new URL('../artifacts/implementations/', import.meta.url)
async function ready(page, version) {
  await expect(page.locator('main.atlas')).toHaveAttribute('data-implementation', version)
  await page.waitForFunction(() => window.__CITY__?.inspect().ready, null, { timeout: 60000 })
  await expect(page.locator('.city-stage canvas')).toHaveCount(1)
  await expect(page.getByRole('status')).toHaveCount(0)
}
async function signature(page) {
  return page.locator('.city-stage canvas').evaluate((source) => {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 80
    const context = canvas.getContext('2d')
    context.drawImage(source, 0, 0, 100, 80)
    const data = context.getImageData(0, 0, 100, 80).data,
      colors = new Set()
    for (let i = 0; i < data.length; i += 4)
      colors.add(`${data[i] >> 4}:${data[i + 1] >> 4}:${data[i + 2] >> 4}`)
    return colors.size
  })
}

test('version picker loads the archived renderer and cleanly returns to Astra', async ({
  page
}) => {
  await mkdir(output, { recursive: true })
  const errors = [],
    failed = []
  page.on('pageerror', (e) => errors.push(e.stack || e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(r.url())
  })
  await page.goto('/?seed=SHIO-692653&size=120')
  await ready(page, 'astra')
  await expect(page.getByRole('complementary', { name: '城市设置' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: '实现模型' })).toHaveValue('astra')
  expect(await signature(page)).toBeGreaterThan(50)
  await page.screenshot({ path: new URL('astra-desktop.png', output).pathname })
  const originalMemory = await page.evaluate(() => window.__CITY__.inspect().memory)
  for (let i = 0; i < 3; i++) {
    await page.getByRole('combobox', { name: '实现模型' }).selectOption('gpt-5.5')
    await ready(page, 'gpt-5.5')
    expect(new URL(page.url()).searchParams.get('model')).toBe('gpt-5.5')
    expect(await page.evaluate(() => window.__CITY__.inspect().renderer)).toBe('canvas-2d')
    expect(await page.evaluate(() => window.__CITY__.inspect().world.buildings.length)).toBeGreaterThan(20)
    expect(await page.locator('.city-stage canvas').evaluate((canvas) => !!canvas.getContext('2d'))).toBe(true)
    await expect(page.getByRole('button', { name: '旋转视角', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '自动环绕', exact: true })).toHaveCount(0)
    expect(await signature(page)).toBeGreaterThan(50)
    const oldFrame = await page.evaluate(() => window.__CITY__.inspect().render.frame)
    await page.waitForTimeout(650)
    expect(await page.evaluate(() => window.__CITY__.inspect().render.frame)).toBeGreaterThan(
      oldFrame + 3
    )
    if (i === 0) {
      await page.screenshot({ path: new URL('gpt-5.5-desktop.png', output).pathname })
      const before = await page.evaluate(() => window.__CITY__.inspect().camera)
      await page.mouse.move(600, 460)
      await page.mouse.down()
      await page.mouse.move(790, 490, { steps: 12 })
      await page.mouse.up()
      expect(await page.evaluate(() => window.__CITY__.inspect().camera.offset)).not.toEqual(
        before.offset
      )
      await page.getByRole('button', { name: '放大', exact: true }).click()
      expect(await page.evaluate(() => window.__CITY__.inspect().camera.zoom)).toBeGreaterThan(
        before.zoom
      )
      await page.getByRole('button', { name: '城市设置', exact: true }).click()
      await expect(page.getByLabel('罗盘尺寸')).toHaveCount(0)
      await expect(page.getByLabel('建筑密度')).toHaveCount(0)
      await page.getByLabel('城市时间', { exact: true }).fill('21')
      await page.getByRole('button', { name: '雨天', exact: true }).click()
      await page.getByLabel('地图种子').fill('OLD-TEST')
      await page.getByRole('button', { name: '生成城市', exact: true }).click()
      await ready(page, 'gpt-5.5')
      expect(await page.evaluate(() => window.__CITY__.inspect().seed)).toBe('OLD-TEST')
      await page.getByRole('button', { name: '晴天', exact: true }).click()
      await page.getByLabel('城市时间', { exact: true }).fill('10.5')
      await page.getByLabel('地图种子').fill('SHIO-692653')
      await page.getByRole('button', { name: '生成城市', exact: true }).click()
      await ready(page, 'gpt-5.5')
      await page.getByRole('button', { name: '关闭设置', exact: true }).click()
    }
    await page.getByRole('combobox', { name: '实现模型' }).selectOption('astra')
    await ready(page, 'astra')
    expect(await page.evaluate(() => !!window.__CITY__.inspect().world.geography)).toBe(true)
    expect(await page.evaluate(() => window.__CITY__.inspect().memory)).toEqual(originalMemory)
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    for (const version of ['gpt-5.5', 'astra']) {
      await page.getByRole('combobox', { name: '实现模型' }).selectOption(version)
      await ready(page, version)
      const bounds = await page.getByRole('combobox', { name: '实现模型' }).boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
      expect(await signature(page)).toBeGreaterThan(40)
      await page.screenshot({ path: new URL(`${version}-${width}.png`, output).pathname })
    }
  }
  await page.getByRole('combobox', { name: '实现模型' }).selectOption('gpt-5.5')
  await ready(page, 'gpt-5.5')
  await page.reload()
  await ready(page, 'gpt-5.5')
  await expect(page.getByRole('complementary', { name: '城市设置' })).toHaveCount(0)
  const archived = await readFile(new URL('../src/townscape3d.js', import.meta.url))
  expect(createHash('sha256').update(archived).digest('hex')).toBe(
    '0bb30f515a0c7984de42926a0c49702e8e5604f10a51aaf3cf96990d3a006a68'
  )
  const originalDrawing = await readFile(new URL('../src/cityEngine.js', import.meta.url))
  expect(createHash('sha256').update(originalDrawing).digest('hex')).toBe(
    'a27e2de8c86e59328108a38caab3de4f7901eca3bb640c0f7654615ff90a48a4'
  )
  await writeFile(
    new URL('verification.json', output),
    JSON.stringify({ originalMemory, errors, failed }, null, 2)
  )
  expect(errors).toEqual([])
  expect(failed).toEqual([])
})

test('original drawing renderer works without assets, pauses, exports and handles touch', async ({ page }) => {
  await mkdir(output, { recursive: true })
  const assetRequests = [], errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route(/\/(assets|models)\//, (route) => {
    assetRequests.push(route.request().url())
    return route.abort()
  })
  await page.goto('/?seed=SHIO-692653&model=gpt-5.5')
  await ready(page, 'gpt-5.5')
  expect(await signature(page)).toBeGreaterThan(50)
  await page.getByRole('button', { name: '城市设置', exact: true }).click()
  await page.getByRole('button', { name: '暂停模拟', exact: true }).click()
  const paused = await page.evaluate(() => window.__CITY__.inspect().elapsedSeconds)
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.__CITY__.inspect().elapsedSeconds)).toBe(paused)
  for (const [weather, name, time] of [['sun', '晴天', '10.5'], ['rain', '雨天', '21'], ['snow', '雪天', '14']]) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByLabel('城市时间', { exact: true }).fill(time)
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => window.__CITY__.inspect().state.weather)).toBe(weather)
    expect(await signature(page)).toBeGreaterThan(35)
    await page.screenshot({ path: new URL(`gpt-5.5-${weather}.png`, output).pathname })
  }
  await page.getByRole('button', { name: '晴天', exact: true }).click()
  await page.getByLabel('城市时间', { exact: true }).fill('10.5')
  const oldFrame = await page.evaluate(() => window.__CITY__.inspect().render.frame)
  await page.getByRole('button', { name: '继续模拟', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__CITY__.inspect().render.frame)).toBeGreaterThan(oldFrame + 3)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出城市图片', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('city-gpt-5.5-SHIO-692653.png')
  await download.saveAs(new URL('gpt-5.5-export.png', output).pathname)
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  const touch = await page.context().newCDPSession(page)
  const initial = await page.evaluate(() => window.__CITY__.inspect().camera)
  const touchPoint = (id, x, y) => ({ id, x, y })
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint(1, 140, 440), touchPoint(2, 230, 440)] })
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touchPoint(1, 100, 460), touchPoint(2, 280, 460)] })
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const pinched = await page.evaluate(() => window.__CITY__.inspect().camera)
  expect(pinched.zoom).toBeGreaterThan(initial.zoom * 1.5)
  expect(pinched.offset).not.toEqual(initial.offset)
  await page.getByRole('button', { name: '回到全景', exact: true }).click()
  const reset = await page.evaluate(() => window.__CITY__.inspect().camera)
  expect(reset.zoom).toBe(1)
  expect(reset.offset).toEqual([0, 0])
  await touch.detach()
  expect(assetRequests).toEqual([])
  expect(errors).toEqual([])
})

test('social metadata points to the generated OG image', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    '汐湾 · City Atlas'
  )
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image'
  )
  const url = await page.locator('meta[property="og:image"]').getAttribute('content')
  const response = await request.get(url)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/png')
  const dimensions = await page.evaluate(async (src) => {
    const image = new Image()
    image.src = src
    await image.decode()
    return [image.naturalWidth, image.naturalHeight]
  }, url)
  expect(dimensions).toEqual([1737, 905])
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
    'content',
    String(dimensions[0])
  )
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute(
    'content',
    String(dimensions[1])
  )
})
