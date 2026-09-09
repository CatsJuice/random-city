import { test, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

test('independent seeds produce visibly different geography', async ({ page }) => {
  const directory = new URL('../artifacts/random-layouts/', import.meta.url)
  await mkdir(directory, { recursive: true })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.setViewportSize({ width: 1080, height: 900 })
  await page.goto('/?seed=SHIO-0')
  await page.waitForFunction(() => window.__CITY__?.inspect().ready)
  await expect(page.getByRole('complementary', { name: '城市设置' })).toHaveCount(0)
  const rows = []
  for (const seed of ['SHIO-0', 'SHIO-1', 'SHIO-2', 'SHIO-5', 'SHIO-6', 'SHIO-18']) {
    await page.getByRole('button', { name: '城市设置', exact: true }).click()
    await page.getByLabel('地图种子', { exact: true }).fill(seed)
    await page.getByRole('button', { name: '生成城市', exact: true }).click()
    await page.waitForFunction(() => window.__CITY__.inspect().ready)
    await page.getByRole('button', { name: '关闭设置', exact: true }).click()
    await page.evaluate(() => window.__CITY__.set({ paused: true, time: 10.5 }))
    await page.getByRole('button', { name: '俯视地图', exact: true }).click()
    await page.waitForTimeout(350)
    const world = await page.evaluate(() => {
      const w = window.__CITY__.inspect().world
      return { seed: w.seed, type: w.geography.name, stats: w.stats, peaks: w.peaks.length }
    })
    const png = await page
      .locator('.city-stage canvas')
      .evaluate((canvas) => canvas.toDataURL('image/png'))
    await writeFile(new URL(seed + '.png', directory), Buffer.from(png.split(',')[1], 'base64'))
    rows.push(world)
  }
  expect(new Set(rows.map((w) => w.type)).size).toBe(6)
  expect(new Set(rows.map((w) => w.stats.bridges)).size).toBeGreaterThan(2)
  const cards = await Promise.all(
    rows.map(async (w) => {
      const image = (await readFile(new URL(w.seed + '.png', directory))).toString('base64')
      return (
        '<section><h2>' +
        w.type +
        ' <small>' +
        w.seed +
        '</small></h2><img src="data:image/png;base64,' +
        image +
        '"><p>' +
        w.stats.buildings +
        ' 栋建筑 / ' +
        w.stats.bridges +
        ' 座桥 / ' +
        w.peaks +
        ' 座山峰</p></section>'
      )
    })
  )
  const html =
    '<html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#e2eae4;color:#34594b;font-family:system-ui}main{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}section{min-width:0}h1{font-size:22px;margin:0 0 18px}h2{font-size:17px;margin:0 0 4px}small{font-size:11px;font-weight:400;color:#688578}img{width:100%;display:block}p{margin:5px 0 10px;font-size:12px}</style><h1>同一生成器，不同种子的实际俯视图</h1><main>' +
    cards.join('') +
    '</main></html>'
  await writeFile(new URL('index.html', directory), html)
  await writeFile(new URL('report.json', directory), JSON.stringify({ rows, errors }, null, 2))
  await page.setViewportSize({ width: 1536, height: 1050 })
  await page.setContent(html)
  await page.screenshot({ path: new URL('comparison.png', directory).pathname, fullPage: true })
  expect(errors).toEqual([])
})
