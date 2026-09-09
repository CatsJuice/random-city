import { test, expect } from '@playwright/test'

test('grass remains visible at distance, stays off snow and bare ground, and adds no draw calls', async ({ page }) => {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/?seed=SHIO-2&model=astra')
  await page.waitForFunction(() => window.__CITY__?.inspect().ready)
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js')
    const { createGroundMaterial } = await import('/src/city/grass.js')
    const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
    renderer.setSize(256, 256)
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xffffff, 0x778866, 2))
    const camera = new THREE.OrthographicCamera(-32, 32, 32, -32, 0.1, 300)
    camera.position.set(0, 100, 0)
    camera.up.set(0, 0, -1)
    camera.lookAt(0, 0, 0)
    const geometry = new THREE.PlaneGeometry(256, 256).rotateX(-Math.PI / 2)
    const color = new THREE.Color('#8ca772')
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: 4 }, () => color.toArray()).flat(), 3))
    geometry.setAttribute('groundCover', new THREE.Float32BufferAttribute([1, 1, 1, 1], 1))
    const uniforms = { snow: { value: 0 } }, material = createGroundMaterial({ seed: 'SHIO-2' }, uniforms)
    let atlas
    const compile = material.onBeforeCompile
    material.onBeforeCompile = (shader) => { compile(shader); atlas = shader.uniforms.grassAtlas.value }
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    const gl = renderer.getContext()
    const pixels = () => {
      renderer.render(scene, camera)
      const data = new Uint8Array(256 * 256 * 4)
      gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, data)
      return data
    }
    try {
      const baselineMaterial = new THREE.MeshStandardMaterial({ vertexColors: true })
      mesh.material = baselineMaterial
      pixels()
      const baselineTextures = renderer.info.memory.textures
      mesh.material = material
      baselineMaterial.dispose()
      pixels()
      const original = atlas.image.data.slice(), flat = new Uint8Array(original.length)
      for (let i = 0; i < flat.length; i += 4) flat[i] = 128
      const compare = (zoom, snow, cover) => {
        camera.zoom = zoom
        camera.updateProjectionMatrix()
        uniforms.snow.value = snow
        geometry.attributes.groundCover.array.fill(cover)
        geometry.attributes.groundCover.needsUpdate = true
        atlas.image.data = original
        atlas.needsUpdate = true
        const detailed = pixels()
        atlas.image.data = flat
        atlas.needsUpdate = true
        const plain = pixels()
        let difference = 0, changed = 0
        for (let i = 0; i < detailed.length; i += 4) {
          const delta = Math.abs(detailed[i] - plain[i]) + Math.abs(detailed[i + 1] - plain[i + 1]) + Math.abs(detailed[i + 2] - plain[i + 2])
          difference += delta
          if (delta > 2) changed++
        }
        return { difference, changed, calls: renderer.info.render.calls, textures: renderer.info.memory.textures - baselineTextures }
      }
      return { overview: compare(0.55, 0, 1), far: compare(1, 0, 1), near: compare(5, 0, 1), snow: compare(5, 1, 1), bare: compare(5, 0, 0) }
    } finally {
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    }
  })
  expect(result.overview.changed).toBeGreaterThan(1000)
  expect(result.far.changed).toBeGreaterThan(1000)
  expect(result.near.changed).toBeGreaterThan(1000)
  expect(result.snow.difference).toBe(0)
  expect(result.bare.difference).toBe(0)
  for (const item of Object.values(result)) {
    expect(item.calls).toBe(1)
    expect(item.textures).toBe(1)
  }
  expect(errors).toEqual([])
})
