import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export class Batch {
  constructor() {
    this.parts = new Map()
  }
  add(geometry, color, matrix) {
    if (matrix) geometry.applyMatrix4(matrix)
    geometry.deleteAttribute('uv')
    geometry.deleteAttribute('tangent')
    const key = String(color)
    if (!this.parts.has(key)) this.parts.set(key, [])
    this.parts.get(key).push(geometry.index ? geometry.toNonIndexed() : geometry)
    if (geometry.index) geometry.dispose()
  }
  box(x, y, z, w, h, d, color, rotation = 0) {
    const geometry = new THREE.BoxGeometry(w, h, d).rotateY(rotation).translate(x, y, z)
    this.add(geometry, color)
  }
  cylinder(x, y, z, top, bottom, h, color, segments = 12) {
    this.add(new THREE.CylinderGeometry(top, bottom, h, segments).translate(x, y, z), color)
  }
  sphere(x, y, z, r, color, sx = 1, sy = 1, sz = 1) {
    this.add(new THREE.SphereGeometry(r, 10, 6).scale(sx, sy, sz).translate(x, y, z), color)
  }
  tube(points, r, color, segments = 30) {
    if (points.length < 2) return
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, p.y, p.z)))
    this.add(new THREE.TubeGeometry(curve, segments, r, 6, false), color)
  }
  finish(parent, uniforms) {
    for (const [color, parts] of this.parts) {
      const geometry = mergeGeometries(parts, false)
      parts.forEach((p) => p.dispose())
      const material = new THREE.MeshStandardMaterial({ color, roughness: 0.86 })
      if (uniforms) {
        material.onBeforeCompile = (shader) => {
          shader.uniforms.snow = uniforms.snow
          shader.vertexShader = 'varying vec3 vCityNormal;\n' + shader.vertexShader
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvCityNormal=normal;'
          )
          shader.fragmentShader =
            'uniform float snow;varying vec3 vCityNormal;\n' + shader.fragmentShader
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.87,0.93,0.97),snow*smoothstep(0.4,0.9,vCityNormal.y)*0.88);'
          )
        }
      }
      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      parent.add(mesh)
    }
    this.parts.clear()
  }
}

export function ribbon(points, width) {
  const positions = [],
    uvs = [],
    indices = []
  points.forEach((p, i) => {
    const prev = points[Math.max(0, i - 1)],
      next = points[Math.min(points.length - 1, i + 1)]
    const dx = next.x - prev.x,
      dz = next.z - prev.z,
      l = Math.hypot(dx, dz) || 1
    for (const side of [-1, 1]) {
      positions.push(
        p.x - (((dz / l) * width) / 2) * side,
        p.y,
        p.z + (((dx / l) * width) / 2) * side
      )
      uvs.push((side + 1) / 2, i / (points.length - 1))
    }
    if (i < points.length - 1) {
      const n = i * 2
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  // Top faces must face +Y for both X- and Z-directed paths.
  if (g.attributes.normal.getY(0) < 0) {
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
    g.setIndex(indices)
    g.computeVertexNormals()
  }
  return g
}
