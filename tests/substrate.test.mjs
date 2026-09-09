import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createEarthMaterial, seabedAt, substrateBottom, SUBSTRATE_TOP, WATER_LEVEL } from '../src/city/substrate.js'
import { buildLandscape } from '../src/city/landscape.js'
import { generateGeography, waterDistance } from '../src/city/geography.js'
import { GROUND, MAP_SIZES, random } from '../src/city/world.js'

function landscape(seed, size) {
  const world = { size, seed, edges: [], geography: generateGeography(random(seed), size) }
  const parent = new THREE.Group()
  buildLandscape(world, parent, { snow: { value: 0 }, time: { value: 0 } })
  return { world, parent }
}

function dispose(parent) {
  parent.traverse((mesh) => mesh.geometry?.dispose())
  new Set(parent.children.map((mesh) => mesh.material)).forEach((material) => material.dispose())
}

test('the substrate stays flush with every map size with a bounded perimeter mesh', () => {
  for (const size of MAP_SIZES) {
    const { parent } = landscape('SHIO-2', size)
    const { geometry } = parent.getObjectByName('Geological cutaway')
    geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox
    assert.deepEqual([min.x, min.z, max.x, max.z], [-size / 2, -size / 2, size / 2, size / 2])
    assert.ok(Math.abs(max.y - SUBSTRATE_TOP) < 1e-6)
    assert.ok(Math.abs(min.y - substrateBottom(size)) < 1e-6)
    assert.ok(GROUND - min.y > 7.5)
    assert.ok(geometry.attributes.position.count / 3 <= Math.round(size * 1.2) * 16 + 2)
    dispose(parent)
  }
})

test('earth material is seeded and uses geometry coordinates shared by the banks and base', () => {
  function compile(seed) {
    const material = createEarthMaterial({ size: 120, seed })
    const shader = {
      uniforms: {},
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <color_fragment>'
    }
    material.onBeforeCompile(shader)
    material.dispose()
    return shader
  }
  const a = compile('A'), b = compile('B'), again = compile('A')
  assert.deepEqual(a.uniforms, again.uniforms)
  assert.notDeepEqual(a.uniforms.earthOffset, b.uniforms.earthOffset)
  assert.ok(a.vertexShader.includes('vEarthPosition = position;'))
  assert.ok(a.fragmentShader.includes('earthColor(vEarthPosition)'))
  assert.ok(!Object.hasOwn(a.uniforms, 'snow'))
  assert.ok(!Object.hasOwn(a.uniforms, 'time'))
})

test('offshore water is deeper than rivers and keeps bedrock below every seabed', () => {
  for (const size of MAP_SIZES) {
    const geography = {
      islands: [], lakes: [], rivers: [],
      coast: { angle: 0, level: 0, amplitude: 0, frequency: 0.05, phase: 0 }
    }
    const world = { size, geography }
    const heights = [0, 2, 6, 14, 32].map((x) => seabedAt(world, x * size / 120, 0))
    assert.equal(heights[0], SUBSTRATE_TOP)
    for (let i = 1; i < heights.length; i++) assert.ok(heights[i] < heights[i - 1])
    assert.ok(heights.at(-1) > substrateBottom(size) + Math.sqrt(size / 120))
    assert.ok(WATER_LEVEL - heights.at(-1) > 4)
    assert.equal(seabedAt(world, -10, 0), SUBSTRATE_TOP)
    const river = {
      ...world, geography: { ...geography, coast: null,
        rivers: [{ angle: 0, offset: 0, amplitude: 0, frequency: 0.05, phase: 0, width: 3 }] }
    }
    assert.ok(seabedAt(river, 0, 0) > heights.at(-1))
  }
})

test('water, seabed and earth share exactly the same cut boundary in coastal and river maps', () => {
  for (const size of MAP_SIZES) {
    for (const seed of ['SHIO-2', 'SHIO-2048']) {
      const { world, parent } = landscape(seed, size)
      const base = parent.getObjectByName('Geological cutaway')
      const bank = parent.getObjectByName('Terrain cut faces')
      const water = parent.getObjectByName('Water cut faces')
      assert.equal(bank.material, base.material)
      const earth = base.geometry.attributes.position, tops = new Map()
      const key = (p, i) => `${p.getX(i)}:${p.getZ(i)}`
      for (let i = 6; i < earth.count; i += 6) {
        tops.set(key(earth, i), earth.getY(i))
        tops.set(key(earth, i + 1), earth.getY(i + 1))
      }
      const vertices = water.geometry.attributes.position, depths = water.geometry.attributes.waterDepth
      assert.ok(vertices.count > 0)
      for (let i = 0; i < vertices.count; i += 6) {
        const x = (vertices.getX(i) + vertices.getX(i + 1)) / 2
        const z = (vertices.getZ(i) + vertices.getZ(i + 1)) / 2
        assert.ok(Math.abs(Math.abs(x) - size / 2) < 1e-5 || Math.abs(Math.abs(z) - size / 2) < 1e-5)
        assert.ok(waterDistance(world.geography, x, z) < 0.06)
        assert.ok(Math.abs(vertices.getY(i) - WATER_LEVEL) < 1e-6)
        assert.equal(vertices.getY(i + 2), tops.get(key(vertices, i)))
        assert.equal(vertices.getY(i + 4), tops.get(key(vertices, i + 1)))
        assert.ok(Math.abs(depths.getX(i) - (WATER_LEVEL - vertices.getY(i + 2))) < 1e-6)
      }
      const surface = parent.getObjectByName('Water surface').geometry.attributes
      const bed = parent.getObjectByName('Submerged seabed').geometry.attributes.position
      assert.equal(surface.position.count, bed.count)
      for (let i = 0; i < bed.count; i++) {
        assert.equal(surface.position.getX(i), bed.getX(i))
        assert.equal(surface.position.getZ(i), bed.getZ(i))
        assert.ok(surface.normal.getY(i) >= 0)
        assert.ok(Math.abs(surface.waterDepth.getX(i) - (WATER_LEVEL - bed.getY(i))) < 1e-6)
      }
      dispose(parent)
    }
  }
})
