import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const cache = new Map()
const loader = new GLTFLoader()
const paint = ['#e9b89c', '#bed4c8', '#e3cc8e', '#cad7de', '#dfaaa9'].map((c) => new THREE.Color(c))

function windowMask(geometry, key) {
  const p = geometry.attributes.position,
    uv = geometry.attributes.uv,
    mask = new Float32Array(p.count)
  if (!key.includes('building') || !uv) return mask
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    ab = new THREE.Vector3(),
    ac = new THREE.Vector3()
  const index = geometry.index,
    total = index ? index.count : p.count
  // Kenney's palette has no semantic window material. Select dark vertical panes,
  // excluding light plaster, horizontal roofs and thin trim triangles.
  for (let f = 0; f < total; f += 3) {
    const ids = [0, 1, 2].map((n) => (index ? index.getX(f + n) : f + n))
    const u = ids.reduce((s, i) => s + uv.getX(i), 0) / 3,
      v = ids.reduce((s, i) => s + uv.getY(i), 0) / 3
    if (!((u < 0.15 && v > 0.5 && v < 0.75) || (u > 0.53 && u < 0.64 && v > 0.25 && v < 0.5)))
      continue
    a.fromBufferAttribute(p, ids[0])
    b.fromBufferAttribute(p, ids[1])
    c.fromBufferAttribute(p, ids[2])
    const height = Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y)
    const width = Math.hypot(
      Math.max(a.x, b.x, c.x) - Math.min(a.x, b.x, c.x),
      Math.max(a.z, b.z, c.z) - Math.min(a.z, b.z, c.z)
    )
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    ab.cross(ac)
    const area = ab.length() / 2,
      up = Math.abs(ab.y) / (area * 2 || 1)
    if (
      height > 0.025 &&
      width > 0.035 &&
      width / height < 4 &&
      width / height > 0.12 &&
      up < 0.08 &&
      area / (width * height) > 0.35 &&
      Math.max(a.y, b.y, c.y) > 0.15
    )
      ids.forEach((i) => (mask[i] = 1))
  }
  return mask
}

async function loadModel(key) {
  const { scene } = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${key}.glb`)
  scene.updateMatrixWorld(true)
  const parts = []
  scene.traverse((obj) => {
    if (!obj.isMesh) return
    const geometry = obj.geometry.clone().applyMatrix4(obj.matrixWorld)
    geometry.deleteAttribute('tangent')
    const colors = new Float32Array(geometry.attributes.position.count * 3)
    const emissive = windowMask(geometry, key)
    const img = obj.material.map?.image
    let pixels, width, height
    if (img) {
      const canvas = document.createElement('canvas')
      canvas.width = width = img.width
      canvas.height = height = img.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      pixels = ctx.getImageData(0, 0, width, height).data
    }
    const uv = geometry.attributes.uv
    const color = new THREE.Color()
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      if (pixels && uv) {
        const u = THREE.MathUtils.clamp(Math.floor(uv.getX(i) * width), 0, width - 1)
        const v = THREE.MathUtils.clamp(Math.floor(uv.getY(i) * height), 0, height - 1)
        const k = (v * width + u) * 4
        color.setRGB(
          pixels[k] / 255,
          pixels[k + 1] / 255,
          pixels[k + 2] / 255,
          THREE.SRGBColorSpace
        )
      } else {
        color.copy(obj.material.color)
        if (key.startsWith('nature/') && obj.material.name.toLowerCase().includes('leaf'))
          color.set('#477f50')
        if (key.startsWith('nature/') && obj.material.name.toLowerCase().includes('wood'))
          color.set('#8b7760')
        if (key.includes('stone_')) color.set('#8b9992')
      }
      color.toArray(colors, i * 3)
    }
    geometry.deleteAttribute('uv')
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('windowMask', new THREE.BufferAttribute(emissive, 1))
    parts.push(geometry)
  })
  const geometry = mergeGeometries(parts, false)
  parts.forEach((g) => g.dispose())
  geometry.computeBoundingBox()
  const box = geometry.boundingBox,
    center = box.getCenter(new THREE.Vector3()),
    size = box.getSize(new THREE.Vector3())
  geometry.translate(-center.x, -box.min.y, -center.z)
  const disposedTextures = new Set()
  scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose()
      if (obj.material.map && !disposedTextures.has(obj.material.map)) {
        disposedTextures.add(obj.material.map)
        obj.material.map.dispose()
      }
      obj.material.dispose()
    }
  })
  return { geometry, size }
}

export async function loadAssets(world, onProgress = () => {}) {
  const names = [
    ...new Set([
      ...world.buildings.map((b) => b.asset),
      ...[...world.trees, ...world.rocks].map((t) => `nature/${t.asset}`),
      'nature/plant_bushDetailed',
      'nature/flower_yellowA',
      'commercial/detail-parasol-a',
      'suburban/planter',
      ...['sedan', 'taxi', 'van', 'suv', 'delivery'].map((a) => `cars/${a}`)
    ])
  ]
  let complete = 0
  const entries = await Promise.all(
    names.map(async (key) => {
      if (!cache.has(key))
        cache.set(
          key,
          loadModel(key).catch((error) => {
            cache.delete(key)
            throw error
          })
        )
      const model = await cache.get(key)
      onProgress(++complete / names.length)
      return [key, model]
    })
  )
  return new Map(entries)
}

export function paintedGeometry(source, palette, key) {
  const geometry = source.clone(),
    colors = geometry.attributes.color
  const tint = paint[palette % paint.length],
    c = new THREE.Color()
  for (let i = 0; i < colors.count; i++) {
    c.fromBufferAttribute(colors, i)
    const max = Math.max(c.r, c.g, c.b),
      min = Math.min(c.r, c.g, c.b)
    if (key.includes('building') && min > 0.7) c.multiply(tint)
    if (key.includes('suburban') && c.g > c.r * 1.6 && c.g > c.b * 1.25) {
      const roof = [0xb35d4d, 0x607d87, 0xbd8858, 0x557b72, 0x995e59][palette % 5]
      c.setHex(roof).multiplyScalar(0.9 + max * 0.16)
    }
    c.toArray(colors.array, i * 3)
  }
  return geometry
}

export function makeAssetMaterial(uniforms) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.02
  })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader =
      'attribute float windowMask; varying float vWindowMask; varying vec3 vCityNormal;\n' +
      shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvWindowMask = windowMask * (1.0-smoothstep(0.2,0.7,abs(normal.y))); vCityNormal = normal;'
    )
    shader.fragmentShader =
      'uniform float night; uniform float snow; varying float vWindowMask; varying vec3 vCityNormal;\n' +
      shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.87,0.93,0.97),snow*smoothstep(0.4,0.9,vCityNormal.y)*0.92);'
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.0,0.55,0.18)*vWindowMask*night*0.62;'
    )
  }
  material.customProgramCacheKey = () => 'city-assets-v1'
  return material
}
