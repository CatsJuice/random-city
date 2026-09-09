import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const output = new URL('../artifacts/living-city/', import.meta.url)
const waitReady = (page) =>
  page.waitForFunction(() => window.__CITY__?.inspect().ready, null, { timeout: 120000 })
async function pixels(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    ctx.drawImage(document.querySelector('.city-stage canvas'), 0, 0, 600, 400)
    const data = ctx.getImageData(0, 0, 600, 400).data
    let warm = 0,
      colors = new Set()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 130 && data[i] > data[i + 2] * 1.35 && data[i + 1] > 85) warm++
      colors.add(`${data[i] >> 4}:${data[i + 1] >> 4}:${data[i + 2] >> 4}`)
    }
    return { warm, colors: colors.size }
  })
}

test('night lights, moving boats, mountain walks and larger boards stay interactive', async ({
  page
}) => {
  await mkdir(output, { recursive: true })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('/?seed=SHIO-2')
  await waitReady(page)
  await page.getByRole('button', { name: '城市设置', exact: true }).click()
  const initial = await page.evaluate(() => {
    const s = window.__CITY__.inspect()
    return { boats: s.boats, hikers: s.hikers, stats: s.world.stats, lighting: s.lighting }
  })
  expect(initial.boats.length).toBeGreaterThan(0)
  expect(initial.hikers.length).toBeGreaterThan(0)
  await page.waitForTimeout(1600)
  const moved = await page.evaluate(() => ({
    boats: window.__CITY__.inspect().boats,
    hikers: window.__CITY__.inspect().hikers
  }))
  expect(moved.boats).not.toEqual(initial.boats)
  expect(moved.hikers).not.toEqual(initial.hikers)
  await page.getByRole('button', { name: '暂停模拟', exact: true }).click()
  await page.getByLabel('城市时间', { exact: true }).fill('23')
  await page.waitForTimeout(500)
  await page.screenshot({ path: new URL('night-coast.png', output).pathname })
  const night = await page.evaluate(() => window.__CITY__.inspect().lighting)
  expect(night.lamps).toBeGreaterThan(100)
  expect(night.headlights).toBeGreaterThan(20)
  expect(night.lighthouseIntensity).toBeGreaterThan(30)
  const nightPixels = await pixels(page)
  expect(nightPixels.warm).toBeGreaterThan(150)
  const frozen = await page.evaluate(() => window.__CITY__.inspect().boats)
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => window.__CITY__.inspect().boats)).toEqual(frozen)
  await page.getByRole('button', { name: '放大', exact: true }).click({ clickCount: 2 })
  await page.screenshot({ path: new URL('night-detail.png', output).pathname })
  await page.getByRole('button', { name: '回到全景' }).click()
  await page.getByRole('button', { name: '继续模拟', exact: true }).click()
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => window.__CITY__.inspect().lighting.beaconAngle)).not.toBe(
    night.beaconAngle
  )
  await page.getByLabel('城市时间', { exact: true }).fill('10.5')
  await page.getByRole('button', { name: '俯视地图' }).click()
  await page.screenshot({ path: new URL('mountain-paths.png', output).pathname })
  const scales = []
  for (const size of [180, 240, 120, 240]) {
    await page.getByLabel('罗盘尺寸', { exact: true }).fill(String(size))
    await page.getByRole('button', { name: '生成城市', exact: true }).click()
    await waitReady(page)
    await page.waitForTimeout(1500)
    const info = await page.evaluate(() => {
      const s = window.__CITY__.inspect()
      return {
        size: s.world.size,
        stats: s.world.stats,
        memory: s.memory,
        render: s.render,
        camera: s.camera,
        lighting: s.lighting
      }
    })
    expect(info.size).toBe(size)
    expect(new URL(page.url()).searchParams.get('size')).toBe(String(size))
    expect((await pixels(page)).colors).toBeGreaterThan(80)
    scales.push(info)
    await page.screenshot({ path: new URL(`board-${size}.png`, output).pathname })
  }
  expect(scales[1].stats.buildings).toBeGreaterThan(initial.stats.buildings * 2)
  expect(scales[3].memory).toEqual(scales[1].memory)
  await page.getByLabel('城市时间', { exact: true }).fill('23')
  const frames = await page.evaluate(async () => {
    const times = [],
      start = performance.now()
    let previous = start
    await new Promise((resolve) => {
      const frame = (time) => {
        times.push(time - previous)
        previous = time
        if (time - start < 4000) requestAnimationFrame(frame)
        else resolve()
      }
      requestAnimationFrame(frame)
    })
    times.shift()
    times.sort((a, b) => a - b)
    return {
      fps: 1000 / (times.reduce((s, n) => s + n, 0) / times.length),
      p95ms: times[Math.floor(times.length * 0.95)]
    }
  })
  await page.screenshot({ path: new URL('large-night.png', output).pathname })
  expect(frames.fps).toBeGreaterThan(25)
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)
  expect((await pixels(page)).colors).toBeGreaterThan(60)
  await page.screenshot({ path: new URL('large-mobile.png', output).pathname })
  await page.getByRole('button', { name: '城市设置', exact: true }).click()
  await page.getByLabel('罗盘尺寸', { exact: true }).scrollIntoViewIfNeeded()
  await expect(page.getByLabel('罗盘尺寸', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({ path: new URL('mobile-settings.png', output).pathname })
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  await page.getByRole('button', { name: '放大', exact: true }).click({ clickCount: 3 })
  const before = await page.evaluate(() => window.__CITY__.inspect().camera.position)
  await page.mouse.move(140, 420)
  await page.mouse.down()
  await page.mouse.move(240, 460, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => window.__CITY__.inspect().camera.position)).not.toEqual(before)
  await page.screenshot({ path: new URL('large-mobile-close.png', output).pathname })
  await writeFile(
    new URL('verification.json', output),
    JSON.stringify({ initial, night, nightPixels, scales, frames, errors }, null, 2)
  )
  expect(errors).toEqual([])
})

test('large dense cities render through weather changes and superseded generation is cancelled', async ({
  page
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('/?seed=SHIO-949156&size=240')
  await waitReady(page)
  await page.getByRole('button', { name: '城市设置', exact: true }).click()
  const initial = await page.evaluate(() => window.__CITY__.inspect().world.stats)
  expect(initial.buildings).toBeGreaterThan(400)
  await page.getByLabel('城市时间', { exact: true }).fill('23')
  const performance = []
  for (const weather of ['雨天', '雪天', '晴天']) {
    await page.getByRole('button', { name: weather, exact: true }).click()
    await page.waitForTimeout(1600)
    expect((await pixels(page)).colors).toBeGreaterThan(70)
    performance.push({ weather, fps: await page.locator('.fps').innerText() })
  }
  await page.screenshot({ path: new URL('dense-night.png', output).pathname })
  await page.evaluate(async () => {
    const a = window.__CITY__.rebuild('cancelled-city', 0.84, 240)
    const b = window.__CITY__.rebuild('SHIO-2', 0.84, 120)
    await Promise.all([a, b])
  })
  await waitReady(page)
  const final = await page.evaluate(() => ({
    seed: window.__CITY__.inspect().seed,
    size: window.__CITY__.inspect().world.size
  }))
  expect(final).toEqual({ seed: 'SHIO-2', size: 120 })
  await writeFile(
    new URL('dense-verification.json', output),
    JSON.stringify({ initial, performance, final, errors }, null, 2)
  )
  expect(errors).toEqual([])
})
