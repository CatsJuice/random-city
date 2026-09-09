import { test, expect } from '@playwright/test'

test('the header shows only the current city name and keeps controls clear on mobile', async ({ page }) => {
  await page.goto('/?seed=SHIO-2&model=astra')
  await page.waitForFunction(() => window.__CITY__?.inspect().ready)
  const title = page.getByRole('heading', { level: 1 })
  await expect(title).toHaveText('海湾城镇')
  await expect(page.locator('.world-status')).not.toContainText(/居民|辆车|城市构建中/)
  await expect(page.locator('.status-dot')).toHaveCount(0)
  await expect(page.locator('.fps')).toBeVisible()
  await expect(page.locator('.brand, .brand-mark, .brand-caption, .location-tag, .edition')).toHaveCount(0)
  await expect(page.getByText('CITY ATLAS', { exact: true })).toHaveCount(0)
  await expect(page.getByText('THE COASTAL COLLECTION', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '城市设置', exact: true }).click()
  await page.getByLabel('地图种子', { exact: true }).fill('SHIO-2048')
  await page.getByRole('button', { name: '生成城市', exact: true }).click()
  await expect(title).toHaveText('曲流河谷')
  await page.getByRole('button', { name: '关闭设置', exact: true }).click()
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 980 : 844 })
    const a = await title.boundingBox()
    expect(a.x).toBeGreaterThanOrEqual(0)
    for (const control of await page.locator('.header-actions > *').all()) {
      const b = await control.boundingBox()
      expect(b.x + b.width).toBeLessThanOrEqual(width)
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      expect(overlapX > 0 && overlapY > 0).toBe(false)
    }
    await page.screenshot({ path: test.info().outputPath(`city-header-${width}.png`) })
  }
  await page.getByRole('combobox', { name: '实现模型' }).selectOption('gpt-5.5')
  await expect(title).toHaveText('城市罗盘')
})
