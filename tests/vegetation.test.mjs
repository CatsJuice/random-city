import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { generateWorld, isLand, segmentDistance, STREET_WIDTH } from '../src/city/world.js'
import { nearTrail } from '../src/city/routes.js'
import { buildVegetation } from '../src/city/vegetation.js'

test('near vegetation has a bounded population, clear paths, shared resources and zoom/snow culling', () => {
  const world = generateWorld('SHIO-2', 0.78, 240)
  const parent = new THREE.Group(), uniforms = { time: { value: 0 }, snow: { value: 0 } }
  const vegetation = buildVegetation(world, parent, uniforms)
  const meshes = parent.children, matrix = new THREE.Matrix4(), p = new THREE.Vector3()
  assert.ok(meshes.length > 0)
  assert.ok(meshes.reduce((sum, mesh) => sum + mesh.count, 0) <= 6000)
  assert.equal(new Set(meshes.map(mesh => mesh.geometry)).size, 1)
  assert.equal(new Set(meshes.map(mesh => mesh.material)).size, 1)
  for (const mesh of meshes) {
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix)
      p.setFromMatrixPosition(matrix)
      assert.ok(isLand(world, p.x, p.z, 1.29))
      assert.ok(!nearTrail(world, p, 0.69))
      assert.ok(world.edges.every(e => segmentDistance(p, world.nodes[e.a], world.nodes[e.b]) > STREET_WIDTH / 2 + 0.49))
    }
  }
  const camera = new THREE.OrthographicCamera(-164, 164, 164, -164, 0.1, 700)
  camera.position.set(0, 300, 0)
  camera.up.set(0, 0, -1)
  camera.lookAt(0, 0, 0)
  vegetation.update(camera, 980)
  assert.equal(meshes.filter(mesh => mesh.visible).length, 0)
  camera.zoom = 10
  camera.updateProjectionMatrix()
  vegetation.update(camera, 980)
  assert.ok(meshes.some(mesh => mesh.visible))
  assert.ok(meshes.filter(mesh => mesh.visible).length <= 24)
  uniforms.snow.value = 1
  vegetation.update(camera, 980)
  assert.equal(meshes.filter(mesh => mesh.visible).length, 0)
  let disposed = 0
  meshes.forEach(mesh => mesh.addEventListener('dispose', () => disposed++))
  meshes[0].geometry.dispose()
  meshes[0].material.dispose()
  assert.equal(disposed, meshes.length)
})
