import { test, expect } from '@playwright/test'

test('the ocean cutaway contains deep blue water above its sloping seabed', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/?seed=SHIO-2&size=120&model=astra')
  await page.waitForFunction(() => window.__CITY__?.inspect().ready)
  await page.evaluate(() => window.__CITY__.set({ paused: true }))
  for (const viewport of [{ width: 1440, height: 980 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(400)
    const samples = await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js')
      const { seabedAt, WATER_LEVEL } = await import('/src/city/substrate.js')
      const state = window.__CITY__.inspect(), size = state.world.size
      const canvas = document.querySelector('.city-stage canvas')
      const width = canvas.clientWidth, height = canvas.clientHeight, aspect = width / height
      const halfHeight = (aspect < 1 ? 90 / aspect : 82) * size / 120
      const camera = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, 0.1, 700)
      camera.position.fromArray(state.camera.position)
      camera.zoom = state.camera.zoom
      camera.lookAt(new THREE.Vector3().fromArray(state.camera.target))
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      const image = document.createElement('canvas')
      image.width = canvas.width
      image.height = canvas.height
      const ctx = image.getContext('2d')
      ctx.drawImage(canvas, 0, 0)
      const pixel = (x, y, z) => {
        const p = new THREE.Vector3(x, y, z).project(camera)
        const px = Math.floor((p.x + 1) / 2 * image.width)
        const py = Math.floor((1 - p.y) / 2 * image.height)
        return Array.from(ctx.getImageData(px, py, 1, 1).data).slice(0, 3)
      }
      const candidates = []
      for (let i = 1; i < 10; i++) {
        const t = size * (i / 10 - 0.5)
        for (const [x, z] of [[t, size / 2], [size / 2, t]]) {
          const bed = seabedAt(state.world, x, z)
          if (bed < -4) candidates.push({ x, z, bed })
        }
      }
      return candidates.map(({ x, z, bed }) => ({
        shallow: pixel(x, WATER_LEVEL - 0.7, z),
        deep: pixel(x, WATER_LEVEL - 3.0, z),
        rock: pixel(x, bed - 0.65, z)
      }))
    })
    const blue = ([r, g, b]) => g > r * 1.25 && b > r * 1.25
    expect(samples.length).toBeGreaterThan(2)
    expect(samples.filter(({ shallow, deep, rock }) =>
      blue(shallow) && blue(deep) && !blue(rock) && deep[0] + deep[1] + deep[2] < shallow[0] + shallow[1] + shallow[2]
    ).length).toBeGreaterThan(samples.length / 2)
    await page.screenshot({ path: test.info().outputPath(`ocean-${viewport.width}.png`) })
  }
  expect(errors).toEqual([])
})
