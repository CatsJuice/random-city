import * as THREE from 'three'
import { Batch, ribbon } from './geometry.js'
import { GROUND, heightAt, smooth, segmentDistance, isLand } from './world.js'
import { waterDistance } from './geography.js'

export function buildLandscape(world, parent, uniforms) {
  const batch = new Batch()
  const size = world.size,
    half = size / 2
  batch.box(0, -1.65, 0, size + 2.4, 2.5, size + 2.4, '#3f6869')
  batch.box(0, -0.5, 0, size + 2.1, 0.22, size + 2.1, '#b8cebb')
  for (const x of [-half - 1, half + 1]) batch.box(x, -0.08, 0, 0.42, 0.7, size + 2, '#e5e6ce')
  for (const z of [-half - 1, half + 1]) batch.box(0, -0.08, z, size + 2, 0.7, 0.42, '#e5e6ce')

  const positions = [],
    colors = [],
    walls = [],
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
      grid.push({ x: px, z: pz, d: waterDistance(world.geography, px, pz), shore: false })
    }
  const crossing = (a, b) => {
    const t = a.d / (a.d - b.d)
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, d: 0, shore: true }
  }
  function wall(a, b) {
    const ay = heightAt(world, a.x, a.z),
      by = heightAt(world, b.x, b.z)
    walls.push(
      a.x,
      ay,
      a.z,
      b.x,
      by,
      b.z,
      a.x,
      -0.45,
      a.z,
      b.x,
      by,
      b.z,
      b.x,
      -0.45,
      b.z,
      a.x,
      -0.45,
      a.z
    )
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
    const clipped = []
    for (let i = 0; i < 3; i++) {
      const a = vertices[i],
        b = vertices[(i + 1) % 3]
      if (a.d >= 0) clipped.push(a)
      if (a.d >= 0 !== b.d >= 0) clipped.push(crossing(a, b))
    }
    if (clipped.length < 3) return
    for (let i = 1; i < clipped.length - 1; i++)
      for (const p of [clipped[0], clipped[i], clipped[i + 1]]) {
        const y = heightAt(world, p.x, p.z)
        positions.push(p.x, y, p.z)
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
      if (a.d >= 0 && b.d >= 0) wall(a, b)
      else if (a.d >= 0 !== b.d >= 0) {
        const p = crossing(a, b)
        a.d >= 0 ? wall(a, p) : wall(p, b)
      }
    }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.snow = uniforms.snow
    shader.fragmentShader = 'uniform float snow;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.89,0.94,0.98),snow*0.85);'
    )
  }
  const land = new THREE.Mesh(geometry, material)
  land.castShadow = true
  land.receiveShadow = true
  parent.add(land)
  const wallGeometry = new THREE.BufferGeometry()
  wallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(walls, 3))
  wallGeometry.computeVertexNormals()
  const bank = new THREE.Mesh(
    wallGeometry,
    new THREE.MeshStandardMaterial({ color: '#c6c0a2', roughness: 1, side: THREE.DoubleSide })
  )
  bank.receiveShadow = true
  parent.add(bank)
  batch.finish(parent, uniforms)
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: '#329aa2',
    roughness: 0.26,
    metalness: 0.14
  })
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.cityTime = uniforms.time
    shader.vertexShader =
      'varying vec3 vWaterPosition; uniform float cityTime;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvWaterPosition=position;'
    )
    shader.fragmentShader =
      'varying vec3 vWaterPosition; uniform float cityTime;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec2 q=vWaterPosition.xy;
      float ripple=sin(q.x*2.0+q.y*3.5+sin(q.x*.55+cityTime*.25)*1.4+cityTime*.9);
      float waterPatch=sin(q.x*.7-q.y*.8+cityTime*.08)*sin(q.y*.33+q.x*.2);
      float glint=smoothstep(.985,1.,ripple)*smoothstep(.45,.9,waterPatch);
      diffuseColor.rgb*=.94+waterPatch*.09;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.46,.79,.77),glint*.7);
    `
    )
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(size + 1.6, size + 1.6), waterMaterial)
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.04
  water.receiveShadow = true
  parent.add(water)
}
