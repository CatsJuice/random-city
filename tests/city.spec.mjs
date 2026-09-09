import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

const output = new URL('../artifacts/', import.meta.url)
async function inspect(page) {
  return page.evaluate(() => {
    const s = window.__CITY__.inspect()
    return {
      ready: s.ready,
      camera: s.camera,
      stats: s.world?.stats,
      memory: s.memory,
      render: s.render,
      time: s.state.time,
      weather: s.state.weather,
      agents: s.agents?.map((a) => ({ edge: a.edge, t: a.t }))
    }
  })
}
async function canvasSignature(page) {
  return page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 80
    c.height = 60
    const ctx = c.getContext('2d')
    ctx.drawImage(document.querySelector('.city-stage canvas'), 0, 0, 80, 60)
    const d = ctx.getImageData(0, 0, 80, 60).data
    let colors = new Set(),
      hash = 0
    for (let i = 0; i < d.length; i += 4) {
      colors.add(`${d[i] >> 4}:${d[i + 1] >> 4}:${d[i + 2] >> 4}`)
      hash = (Math.imul(hash, 31) + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0
    }
    return { colors: colors.size, hash }
  })
}

test('coherent 3D city renders, moves, orbits, pans, regenerates and responds on mobile', async ({
  page
}) => {
  await mkdir(output, { recursive: true })
  const errors = [],
    failed = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`)
  })
  await page.goto('/?seed=SHIO-2048')
  await page.waitForFunction(() => window.__CITY__?.inspect().ready, null, { timeout: 60000 })
  await expect(page.getByRole('complementary', { name: '城市设置' })).toHaveCount(0)
  await page.getByRole('button', { name: '城市设置', exact: true }).click()
  await expect.poll(async () => (await canvasSignature(page)).colors).toBeGreaterThan(60)
  await expect(page.getByRole('status')).toHaveCount(0)
  const initial = await inspect(page),
    firstPixels = await canvasSignature(page)
  expect(initial.stats.buildings).toBeGreaterThan(50)
  expect(initial.stats.bridges).toBeGreaterThan(0)
  expect(firstPixels.colors).toBeGreaterThan(60)
  await page.screenshot({ path: new URL('rebuild-desktop.png', output).pathname })
  await page.waitForTimeout(1500)
  const desktopFps = await page.locator('.fps').innerText()
  expect((await inspect(page)).agents).not.toEqual(initial.agents)
  expect((await canvasSignature(page)).hash).not.toBe(firstPixels.hash)
  await page.getByRole('button', { name: '暂停模拟', exact: true }).click()
  const pause = await inspect(page)
  await page.waitForTimeout(600)
  expect((await inspect(page)).agents).toEqual(pause.agents)
  await page.mouse.move(620, 485)
  await page.mouse.down()
  await page.mouse.move(800, 550, { steps: 18 })
  await page.mouse.up()
  await page.waitForTimeout(800)
  expect((await inspect(page)).camera.position).not.toEqual(initial.camera.position)
  await page.screenshot({ path: new URL('rebuild-rotated.png', output).pathname })
  await page.getByRole('button', { name: '平移视角', exact: true }).click()
  const prePan = await inspect(page)
  await page.mouse.move(600, 450)
  await page.mouse.down()
  await page.mouse.move(680, 510, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(700)
  expect((await inspect(page)).camera.target).not.toEqual(prePan.camera.target)
  await page.getByRole('button', { name: '回到全景' }).click()
  await page.getByRole('button', { name: '放大', exact: true }).click({ clickCount: 4 })
  await page.waitForTimeout(500)
  expect((await inspect(page)).camera.zoom).toBeGreaterThan(1.5)
  await page.screenshot({ path: new URL('rebuild-detail.png', output).pathname })
  const exported = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出城市图片' }).click()
  const download = await exported
  expect(await download.failure()).toBe(null)
  await download.saveAs(new URL('exported-city.png', output).pathname)
  await page.getByRole('button', { name: '自动环绕', exact: true }).click()
  const beforeOrbit = (await inspect(page)).camera.position
  await page.waitForTimeout(700)
  expect((await inspect(page)).camera.position).not.toEqual(beforeOrbit)
  await page.getByRole('button', { name: '自动环绕', exact: true }).click()
  await page.getByRole('button', { name: '回到全景' }).click()
  await page.getByLabel('城市时间', { exact: true }).focus()
  await page.keyboard.press('End')
  await page.waitForTimeout(700)
  expect((await inspect(page)).time).toBeGreaterThan(23)
  await page.screenshot({ path: new URL('rebuild-night.png', output).pathname })
  await page.evaluate(() => window.__CITY__.set({ time: 10.5 }))
  await page.getByRole('button', { name: '雨天', exact: true }).click()
  await page.waitForTimeout(500)
  expect((await inspect(page)).weather).toBe('rain')
  await page.screenshot({ path: new URL('rebuild-rain.png', output).pathname })
  await page.getByRole('button', { name: '雪天', exact: true }).click()
  await page.waitForTimeout(5500)
  expect((await inspect(page)).render.points).toBeGreaterThan(0)
  await page.screenshot({ path: new URL('rebuild-snow.png', output).pathname })
  await page.getByRole('button', { name: '晴天', exact: true }).click()
  await page.waitForTimeout(5500)
  const memory = []
  for (const seed of ['COAST-431', 'SHIO-2048', 'SHIO-2048']) {
    await page.getByLabel('地图种子', { exact: true }).fill(seed)
    await page.getByRole('button', { name: '生成城市', exact: true }).click()
    await page.waitForFunction(() => window.__CITY__.inspect().ready)
    memory.push((await inspect(page)).memory)
  }
  expect(memory[2].geometries).toBe(memory[1].geometries)
  expect(memory[2].textures).toBe(memory[1].textures)
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(700)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  expect((await canvasSignature(page)).colors).toBeGreaterThan(50)
  await page.screenshot({ path: new URL('rebuild-mobile.png', output).pathname })
  await page.getByRole('button', { name: '城市设置', exact: true }).click()
  await page.getByRole('button', { name: '雨天', exact: true }).click()
  await page.screenshot({ path: new URL('rebuild-mobile-controls.png', output).pathname })
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  await page.getByRole('button', { name: '旋转视角', exact: true }).click()
  const beforeMobile = await inspect(page)
  await page.mouse.move(160, 440)
  await page.mouse.down()
  await page.mouse.move(240, 470, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(600)
  expect((await inspect(page)).camera.position).not.toEqual(beforeMobile.camera.position)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const preTouch = await inspect(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 160, y: 430, id: 1 }]
  })
  for (let i = 1; i <= 12; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 160 + i * 5, y: 430 + i * 2, id: 1 }]
    })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(500)
  expect((await inspect(page)).camera.position).not.toEqual(preTouch.camera.position)
  const prePinch = (await inspect(page)).camera.zoom
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 150, y: 425, id: 1 },
      { x: 230, y: 425, id: 2 }
    ]
  })
  for (let i = 1; i <= 10; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 150 - i * 4, y: 425, id: 1 },
        { x: 230 + i * 4, y: 425, id: 2 }
      ]
    })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(500)
  expect((await inspect(page)).camera.zoom).toBeGreaterThan(prePinch)
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
  await page.getByRole('button', { name: '回到全景' }).click()
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: new URL('rebuild-wide.png', output).pathname })
  await page.setViewportSize({ width: 320, height: 720 })
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  await page.screenshot({ path: new URL('rebuild-small-mobile.png', output).pathname })
  const gpu = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2')
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable'
  })
  const assets = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .filter((e) => e.name.includes('/models/') && e.name.endsWith('.glb'))
      .map((e) => ({ url: e.name, bytes: e.transferSize }))
  )
  expect(assets.length).toBeGreaterThan(30)
  await writeFile(
    new URL('verification.json', output),
    JSON.stringify(
      { initial, memory, gpu, desktopFps, assets, errors, failed, final: await inspect(page) },
      null,
      2
    )
  )
  expect(errors).toEqual([])
  expect(failed).toEqual([])
})
