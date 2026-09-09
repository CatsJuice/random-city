import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createGrassTexture, createGroundMaterial, GRASS_TEXTURE_SIZE } from '../src/city/grass.js'

test('grass uses a deterministic, tileable atlas with a fixed memory budget', () => {
  const a = createGrassTexture('A'), again = createGrassTexture('A'), b = createGrassTexture('B')
  assert.deepEqual(a.image.data, again.image.data)
  assert.notDeepEqual(a.image.data, b.image.data)
  assert.equal(a.image.data.byteLength, GRASS_TEXTURE_SIZE ** 2 * 4)
  assert.equal(a.image.data.byteLength, 1024 * 1024)
  assert.equal(a.wrapS, THREE.RepeatWrapping)
  assert.equal(a.wrapT, THREE.RepeatWrapping)
  assert.equal(a.minFilter, THREE.LinearMipmapLinearFilter)
  assert.equal(a.generateMipmaps, true)
  for (let channel = 0; channel < 4; channel++) {
    let count = 0
    for (let i = channel; i < a.image.data.length; i += 4) if (a.image.data[i] > 0) count++
    assert.ok(count > 100, `channel ${channel}`)
  }
  for (const texture of [a, again, b]) texture.dispose()
})

test('ground material releases the generated texture on regeneration and shares the snow uniform', () => {
  const snow = { value: 0 }
  const material = createGroundMaterial({ seed: 'SHIO-2' }, { snow })
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' }
  material.onBeforeCompile(shader)
  assert.equal(shader.uniforms.snow, snow)
  let released = 0
  shader.uniforms.grassAtlas.value.addEventListener('dispose', () => released++)
  material.dispose()
  assert.equal(released, 1)
})
