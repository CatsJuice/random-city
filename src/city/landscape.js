import * as THREE from 'three'
import { Batch, ribbon } from './geometry.js'
import { GROUND, heightAt, smooth, segmentDistance, isLand } from './world.js'
import { waterDistance } from './geography.js'
import { buildSubstrate, createEarthMaterial, seabedAt, SUBSTRATE_TOP, WATER_LEVEL } from './substrate.js'
import { createWaterMaterial } from './water.js'
import { createGroundMaterial } from './grass.js'

export function buildLandscape(world, parent, uniforms) {
  const batch = new Batch()
  const size = world.size,
    half = size / 2
  const earthMaterial = createEarthMaterial(world)

  const positions = [],
    colors = [],
    groundCover = [],
    walls = [],
    waterWalls = [],
    waterWallDepths = [],
    waterPositions = [],
    waterDepths = [],
    bedPositions = [],
    boundary = [],
    grid = [],
    resolution = Math.round(size * 1.2),
    step = size / resolution
  const color = new THREE.Color(),
    grass = new THREE.Color('#8ca772'),
    rock = new THREE.Color('#829388'),
    snow = new THREE.Color('#e7efdf'),
    sand = new THREE.Color('#d9cba5')
  for (let z = 0; z <= resolution; z++)
    for (let x = 0; x <= resolution; x++) {
      const px = -half + x * step,
        pz = -half + z * step
      const d = waterDistance(world.geography, px, pz)
      grid.push({ x: px, z: pz, d, shore: false, bed: seabedAt(world, px, pz, d) })
    }
  const crossing = (a, b) => {
    const t = a.d / (a.d - b.d)
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, d: 0, shore: true, bed: SUBSTRATE_TOP }
  }
  function wall(a, b, water = false) {
    const ay = water ? WATER_LEVEL : heightAt(world, a.x, a.z),
      by = water ? WATER_LEVEL : heightAt(world, b.x, b.z),
      target = water ? waterWalls : walls
    target.push(
      a.x,
      ay,
      a.z,
      b.x,
      by,
      b.z,
      a.x,
      a.bed,
      a.z,
      b.x,
      by,
      b.z,
      b.x,
      b.bed,
      b.z,
      a.x,
      a.bed,
      a.z
    )
    if (water) {
      const da = WATER_LEVEL - a.bed, db = WATER_LEVEL - b.bed
      waterWallDepths.push(da, db, da, db, db, da)
    }
  }
  const posts = new Set()
  function quay(a, b) {
    const x = (a.x + b.x) / 2,
      z = (a.z + b.z) / 2
    if (Math.abs(x) > half - 3 || Math.abs(z) > half - 3 || heightAt(world, x, z) > GROUND + 0.025)
      return
    const nearest = Math.min(
      ...world.edges.map((e) => segmentDistance({ x, z }, world.nodes[e.a], world.nodes[e.b]))
    )
    if (nearest < 3 || nearest > 10) return
    let nx =
        waterDistance(world.geography, x + 0.1, z) - waterDistance(world.geography, x - 0.1, z),
      nz = waterDistance(world.geography, x, z + 0.1) - waterDistance(world.geography, x, z - 0.1)
    const length = Math.hypot(nx, nz) || 1
    nx /= length
    nz /= length
    const points = [a, b].map((p) => ({ x: p.x + nx * 0.9, z: p.z + nz * 0.9, y: GROUND + 0.03 }))
    if (!points.every((p) => isLand(world, p.x, p.z, 0.55))) return
    batch.add(ribbon(points, 1.1), '#d2d2b7')
    batch.tube(
      [a, b].map((p) => ({ x: p.x + nx * 0.35, z: p.z + nz * 0.35, y: GROUND + 0.68 })),
      0.035,
      '#526d6c',
      1
    )
    const key = Math.floor(x / 2) + ':' + Math.floor(z / 2)
    if (!posts.has(key)) {
      posts.add(key)
      batch.cylinder(x + nx * 0.35, GROUND + 0.34, z + nz * 0.35, 0.05, 0.06, 0.7, '#526d6c', 6)
    }
  }
  function triangle(vertices) {
    const clipped = [], submerged = []
    for (let i = 0; i < 3; i++) {
      const a = vertices[i],
        b = vertices[(i + 1) % 3]
      if (a.d >= 0) clipped.push(a)
      else submerged.push(a)
      if (a.d >= 0 !== b.d >= 0) {
        const p = crossing(a, b)
        clipped.push(p)
        submerged.push(p)
      }
    }
    for (let i = 1; i < submerged.length - 1; i++) {
      for (const p of [submerged[0], submerged[i], submerged[i + 1]]) {
        waterPositions.push(p.x, WATER_LEVEL, p.z)
        waterDepths.push(WATER_LEVEL - p.bed)
        bedPositions.push(p.x, p.bed, p.z)
      }
    }
    if (clipped.length < 3) return
    for (let i = 1; i < clipped.length - 1; i++)
      for (const p of [clipped[0], clipped[i], clipped[i + 1]]) {
        const y = heightAt(world, p.x, p.z)
        positions.push(p.x, y, p.z)
        groundCover.push(smooth(p.d / 2.1) * (1 - smooth((y - 6) / 8)))
        color
          .copy(grass)
          .lerp(rock, smooth((y - 3) / 10))
          .lerp(snow, smooth((y - 16) / 4))
        color
          .lerp(sand, (1 - smooth(p.d / 1.8)) * 0.7)
          .multiplyScalar(0.975 + 0.025 * Math.sin(p.x * 0.7 + p.z * 0.4))
        color.toArray(colors, colors.length)
      }
    for (let i = 0; i < clipped.length; i++) {
      const a = clipped[i],
        b = clipped[(i + 1) % clipped.length]
      if (a.shore && b.shore) {
        wall(a, b)
        quay(a, b)
      }
    }
  }
  for (let z = 0; z < resolution; z++)
    for (let x = 0; x < resolution; x++) {
      const i = z * (resolution + 1) + x,
        a = grid[i],
        b = grid[i + 1],
        c = grid[i + resolution + 2],
        d = grid[i + resolution + 1]
      triangle([a, d, b])
      triangle([b, d, c])
    }
  for (let i = 0; i < resolution; i++)
    for (const [a, b] of [
      [grid[i], grid[i + 1]],
      [grid[resolution * (resolution + 1) + i], grid[resolution * (resolution + 1) + i + 1]],
      [grid[i * (resolution + 1)], grid[(i + 1) * (resolution + 1)]],
      [grid[i * (resolution + 1) + resolution], grid[(i + 1) * (resolution + 1) + resolution]]
    ]) {
      if (a.d >= 0 !== b.d >= 0) {
        const p = crossing(a, b)
        boundary.push([a, p], [p, b])
      } else {
        boundary.push([a, b])
      }
    }
  for (const [a, b] of boundary) wall(a, b, a.d < 0 || b.d < 0)
  buildSubstrate(world, parent, earthMaterial, boundary)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('groundCover', new THREE.Float32BufferAttribute(groundCover, 1))
  geometry.computeVertexNormals()
  const material = createGroundMaterial(world, uniforms)
  const land = new THREE.Mesh(geometry, material)
  land.name = 'Ground surface'
  land.castShadow = true
  land.receiveShadow = true
  parent.add(land)
  const wallGeometry = new THREE.BufferGeometry()
  wallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(walls, 3))
  wallGeometry.computeVertexNormals()
  const bank = new THREE.Mesh(wallGeometry, earthMaterial)
  bank.name = 'Terrain cut faces'
  bank.receiveShadow = true
  parent.add(bank)
  batch.finish(parent, uniforms)
  const bedGeometry = new THREE.BufferGeometry()
  bedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bedPositions, 3))
  bedGeometry.computeVertexNormals()
  const seabed = new THREE.Mesh(bedGeometry, new THREE.MeshStandardMaterial({ color: '#a5aa8c', roughness: 1 }))
  seabed.name = 'Submerged seabed'
  parent.add(seabed)
  const waterGeometry = new THREE.BufferGeometry()
  waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3))
  waterGeometry.setAttribute('waterDepth', new THREE.Float32BufferAttribute(waterDepths, 1))
  waterGeometry.computeVertexNormals()
  const water = new THREE.Mesh(waterGeometry, createWaterMaterial(world, uniforms))
  water.name = 'Water surface'
  water.receiveShadow = true
  parent.add(water)
  const waterEdgeGeometry = new THREE.BufferGeometry()
  waterEdgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterWalls, 3))
  waterEdgeGeometry.setAttribute('waterDepth', new THREE.Float32BufferAttribute(waterWallDepths, 1))
  waterEdgeGeometry.computeVertexNormals()
  const waterEdges = new THREE.Mesh(
    waterEdgeGeometry,
    createWaterMaterial(world, uniforms, true)
  )
  waterEdges.name = 'Water cut faces'
  waterEdges.receiveShadow = true
  parent.add(waterEdges)
}
