import * as THREE from 'three'
import { random } from './world.js'

export const GRASS_TEXTURE_SIZE = 512
export const GRASS_TILE_SIZE = 30

export function createGrassTexture(seed) {
  const size = GRASS_TEXTURE_SIZE, rng = random(`${seed}:grass`)
  const data = new Uint8Array(size * size * 4)
  // Pack grain, shaded blades, lit blades and clover into one mipmapped texture.
  for (let i = 0; i < data.length; i += 4) data[i] = 80 + Math.floor(rng() * 96)
  const stroke = (ax, ay, bx, by, radius, channel, strength) => {
    const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy || 1
    for (let y = Math.floor(Math.min(ay, by) - radius - 1); y <= Math.ceil(Math.max(ay, by) + radius + 1); y++) {
      for (let x = Math.floor(Math.min(ax, bx) - radius - 1); x <= Math.ceil(Math.max(ax, bx) + radius + 1); x++) {
        const t = THREE.MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / length2, 0, 1)
        const d = Math.hypot(x - ax - t * dx, y - ay - t * dy)
        const coverage = THREE.MathUtils.clamp(radius * (1 - t * 0.65) + 0.65 - d, 0, 1)
        const i = (((y % size + size) % size) * size + (x % size + size) % size) * 4 + channel
        data[i] = Math.max(data[i], Math.round(coverage * strength))
      }
    }
  }
  for (let i = 0; i < 650; i++) {
    const x = rng() * size, y = rng() * size, angle = rng() * Math.PI * 2
    const length = 10 + rng() * 12, shade = 190 + rng() * 65
    for (let blade = -1; blade <= 1; blade++) {
      const a = angle + blade * 0.6
      stroke(x, y, x + Math.sin(a) * length, y + Math.cos(a) * length, 2.0 + rng() * 1.2, blade === 1 ? 2 : 1, shade)
    }
    if (i % 13 === 0) {
      for (let leaf = 0; leaf < 3; leaf++) {
        const a = angle + leaf * Math.PI * 2 / 3
        stroke(x + 18, y, x + 18 + Math.sin(a) * 5, y + Math.cos(a) * 5, 3, 3, 230)
      }
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.name = 'Ground cover detail atlas'
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

export function createGroundMaterial(world, uniforms) {
  const texture = createGrassTexture(world.seed)
  const rng = random(`${world.seed}:ground-tint`)
  const offset = new THREE.Vector2(rng() * 100, rng() * 100)
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })
  material.name = 'Mipmapped grassland'
  material.addEventListener('dispose', () => texture.dispose())
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { snow: uniforms.snow, grassAtlas: { value: texture }, grassOffset: { value: offset } })
    shader.vertexShader = 'attribute float groundCover; varying float vGroundCover; varying vec3 vGroundPosition;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vGroundPosition = position;
      vGroundCover = groundCover * smoothstep(0.45, 0.8, normal.y);
    `)
    shader.fragmentShader = /* glsl */ `
      uniform float snow;
      uniform sampler2D grassAtlas;
      uniform vec2 grassOffset;
      varying float vGroundCover;
      varying vec3 vGroundPosition;
      float grassHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float grassNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(grassHash(i), grassHash(i + vec2(1, 0)), u.x),
          mix(grassHash(i + vec2(0, 1)), grassHash(i + vec2(1, 1)), u.x), u.y);
      }
    ` + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /* glsl */ `
      #include <color_fragment>
      vec2 ground = vGroundPosition.xz;
      float cover = vGroundCover * (1.0 - snow);
      float variation = grassNoise(ground * 0.19 + grassOffset) - 0.5;
      float meadow = grassNoise(ground * 0.047 + grassOffset + 31.0) - 0.5;
      diffuseColor.rgb *= 1.0 + (variation * 0.32 + meadow * 0.18) * cover;
      diffuseColor.rgb += vec3(0.035, 0.025, -0.025) * variation * cover;

      // Keep grass visible in the overview; mipmaps filter subpixel blades without hiding them.
      float detail = cover;
      vec2 grassUV = ground / ${GRASS_TILE_SIZE.toFixed(1)} + grassOffset;
      vec2 uvDx = dFdx(grassUV), uvDy = dFdy(grassUV);
      if (detail > 0.001) {
        vec4 blades = textureGrad(grassAtlas, grassUV, uvDx, uvDy);
        diffuseColor.rgb *= 1.0 + (blades.r - 0.5) * 0.035 * detail;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.42, 0.57, 0.3), blades.g * detail * 0.85);
        diffuseColor.rgb += vec3(0.13, 0.16, 0.045) * blades.b * detail;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.78, 0.43), blades.a * detail);
      }
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.89, 0.94, 0.98), snow * 0.85);
    `)
  }
  return material
}
