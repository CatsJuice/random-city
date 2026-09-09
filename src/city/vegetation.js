import * as THREE from 'three'
import { random, heightAt, isLand, segmentDistance, STREET_WIDTH, boxesOverlap } from './world.js'
import { nearTrail } from './routes.js'

// Reuse the world's cleared tree sites, with a bounded population independent of zoom.
export function buildVegetation(world, parent, uniforms) {
  const rng = random(`${world.seed}:undergrowth`), chunks = new Map()
  const positions = [], colors = []
  for (let blade = 0; blade < 5; blade++) {
    const angle = blade * 2.4, dx = Math.cos(angle), dz = Math.sin(angle)
    const height = 0.35 + rng() * 0.35, width = 0.045 + rng() * 0.025
    const points = []
    for (let level = 0; level < 3; level++) {
      const t = level / 2, bend = t * t * 0.28
      for (const side of [-1, 1]) points.push([dx * bend - dz * width * (1 - t) * side, height * t, dz * bend + dx * width * (1 - t) * side])
    }
    for (const index of [0, 1, 2, 1, 3, 2, 2, 3, 4]) {
      positions.push(...points[index])
      const t = points[index][1] / height
      colors.push(0.12 + t * 0.23, 0.24 + t * 0.3, 0.055 + t * 0.1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const growth = { value: 0 }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { grassGrowth: growth, grassTime: uniforms.time, grassSnow: uniforms.snow })
    shader.vertexShader = 'uniform float grassGrowth; uniform float grassTime; uniform float grassSnow;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float bladeHeight = position.y;
      transformed.x += sin(grassTime * 1.4 + instanceMatrix[3].x * 0.7 + instanceMatrix[3].z) * bladeHeight * bladeHeight * 0.16;
      transformed.y *= grassGrowth * (1.0 - grassSnow);
    `)
  }
  let count = 0
  for (const tree of world.trees) {
    if (count >= 6000) break
    for (let i = 0; i < 18 && count < 6000; i++) {
      const angle = rng() * Math.PI * 2, radius = 0.25 + rng() * 1.05
      const p = { x: tree.x + Math.cos(angle) * radius, z: tree.z + Math.sin(angle) * radius, w: 0.6, d: 0.6 }
      if (!isLand(world, p.x, p.z, 1.3) || heightAt(world, p.x, p.z) > 9) continue
      if (world.edges.some(e => segmentDistance(p, world.nodes[e.a], world.nodes[e.b]) < STREET_WIDTH / 2 + 0.5)) continue
      if (world.footpaths.some(f => segmentDistance(p, f.a, f.b) < f.width / 2 + 0.5)) continue
      if (world.buildings.some(b => boxesOverlap(p, b, 0.4))) continue
      if (nearTrail(world, p, 0.7)) continue
      if ([world.fairground, world.lighthouse].some(site => site && boxesOverlap(p, site, 0.5))) continue
      const key = `${Math.floor(p.x / 16)}:${Math.floor(p.z / 16)}`
      if (!chunks.has(key)) chunks.set(key, [])
      chunks.get(key).push({ ...p, y: heightAt(world, p.x, p.z), yaw: rng() * Math.PI * 2, scale: 0.65 + rng() * 0.55 })
      count++
    }
  }
  const dummy = new THREE.Object3D(), meshes = []
  for (const sites of chunks.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, sites.length)
    mesh.name = 'Near-view grass clumps'
    sites.forEach((p, index) => {
      dummy.position.set(p.x, p.y + 0.02, p.z)
      dummy.rotation.y = p.yaw
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.computeBoundingSphere()
    mesh.visible = false
    parent.add(mesh)
    meshes.push(mesh)
  }
  if (!meshes.length) { geometry.dispose(); material.dispose() }
  geometry.addEventListener('dispose', () => meshes.forEach(mesh => mesh.dispose()))
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4()
  return {
    update(camera, viewportHeight) {
      const pixelsPerUnit = viewportHeight * camera.zoom / (camera.top - camera.bottom)
      growth.value = THREE.MathUtils.smoothstep(pixelsPerUnit, 12, 24)
      camera.updateMatrixWorld()
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
      let visible = 0
      for (const mesh of meshes) {
        mesh.visible = growth.value > 0.01 && uniforms.snow.value < 0.98 && frustum.intersectsObject(mesh) && visible < 24
        if (mesh.visible) visible++
      }
    }
  }
}
