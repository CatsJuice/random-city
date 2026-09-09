import * as THREE from 'three'
import { GROUND, random, smooth } from './world.js'
import { waterDistance } from './geography.js'

export const WATER_LEVEL = 0.04
export const SUBSTRATE_TOP = -0.45
export const substrateBottom = (size) => GROUND - 7.6 * Math.sqrt(size / 120)

export function seabedAt(world, x, z, distance = waterDistance(world.geography, x, z)) {
  const offshore = Math.max(0, -distance), extent = world.size / 120
  const shelf = 1 - Math.exp(-offshore / (9 * extent))
  const relief = (Math.sin(x * 0.13 + z * 0.08) + Math.sin(z * 0.17 - x * 0.05)) * 0.16
  const bed = SUBSTRATE_TOP - Math.sqrt(extent) * (4.9 * shelf + relief * smooth(offshore / 5))
  return Math.max(substrateBottom(world.size) + 1.25 * Math.sqrt(extent), Math.min(SUBSTRATE_TOP, bed))
}

const surfaceShader = /* glsl */ `
  varying vec3 vEarthPosition;
  uniform vec2 earthOffset;
  uniform float earthScale;
  uniform vec3 earthTopsoil, earthLoam, earthClay, earthWeathered, earthBedrock, earthStone;

  vec2 earthHash(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }
  float earthNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(earthHash(i).x, earthHash(i + vec2(1, 0)).x, u.x),
      mix(earthHash(i + vec2(0, 1)).x, earthHash(i + vec2(1, 1)).x, u.x), u.y);
  }
  // One continuous coordinate around the square keeps strata and inclusions joined at corners.
  vec4 earthCells(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    float first = 8.0, second = 8.0, id = 0.0, facet = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 h = earthHash(cell + neighbor);
        vec2 delta = neighbor + 0.05 + h * 0.9 - f;
        float d = dot(delta, delta);
        if (d < first) {
          second = first;
          first = d;
          id = h.x;
          facet = delta.y + delta.x * 0.6;
        } else second = min(second, d);
      }
    }
    return vec4(sqrt(first), sqrt(second) - sqrt(first), id, facet);
  }
  vec3 earthColor(vec3 p) {
    vec2 horizontal = p.xz * 0.11 + earthOffset;
    float fold = (earthNoise(horizontal) - 0.5) * 1.1
      + (earthNoise(horizontal * 2.7 + 17.0) - 0.5) * 0.28;
    float depth = (${GROUND.toFixed(1)} - p.y) / earthScale;
    float strata = depth + fold * smoothstep(0.0, 0.8, depth);
    vec2 q = vec2(p.x + p.z, p.y) + earthOffset;
    vec2 footprint = fwidth(q);
    float mottling = earthNoise(q * vec2(1.4, 3.0));
    float edge = (mottling - 0.5) * 0.085;
    vec3 soil = mix(earthTopsoil, earthLoam, smoothstep(0.65 + edge, 0.79 + edge, strata));
    soil = mix(soil, earthClay, smoothstep(1.75 + edge, 1.92 + edge, strata));
    soil = mix(soil, earthWeathered, smoothstep(3.45 + edge, 3.75 + edge, strata));
    float bedrock = smoothstep(4.9 + edge, 5.25 + edge, strata);
    soil = mix(soil, earthBedrock, bedrock);
    soil *= 0.92 + mottling * 0.16;

    // Faint sediment lenses follow the folds instead of forming perfectly parallel stripes.
    float sediment = sin(strata * 19.0 + earthNoise(horizontal * 2.0) * 4.0);
    float detail = 1.0 - smoothstep(0.04, 0.22, fwidth(strata));
    soil *= 1.0 - smoothstep(0.82, 0.99, sediment) * 0.075 * detail
      * smoothstep(1.2, 2.0, strata) * (1.0 - bedrock);

    if (bedrock < 1.0) {
      vec2 scatter = q * vec2(0.9, 1.7);
      scatter += (earthNoise(q * 0.65) - 0.5) * 0.45;
      vec4 pebble = earthCells(scatter);
      float radius = 0.1 + fract(pebble.z * 73.0) * 0.26;
      float aa = max(max(footprint.x * 0.9, footprint.y * 1.7) * 0.65, 0.012);
      float stone = (1.0 - smoothstep(radius - aa, radius + aa, pebble.x))
        * step(0.66 + earthNoise(q * 0.18) * 0.12, pebble.z)
        * smoothstep(0.6, 1.2, strata) * (1.0 - bedrock);
      vec3 stoneColor = earthStone * (0.65 + pebble.z * 0.28 + pebble.w * 0.2);
      soil = mix(soil, stoneColor, stone * 0.85);
    }
    if (bedrock > 0.0) {
      vec2 rockPosition = q * vec2(0.57, 1.0);
      rockPosition += vec2(earthNoise(q * 0.4), earthNoise(q * 0.5 + 31.0)) * 0.65;
      vec4 rock = earthCells(rockPosition);
      float aa = max(max(footprint.x * 0.57, footprint.y), 0.008);
      float joint = 1.0 - smoothstep(0.018, 0.018 + aa, rock.y);
      vec3 rockColor = earthBedrock * (0.83 + rock.z * 0.25 + rock.w * 0.1);
      rockColor *= 1.0 - joint * 0.2;
      soil = mix(soil, rockColor, bedrock);
    }
    float grain = earthHash(floor(q * 32.0)).x - 0.5;
    soil *= 1.0 + grain * 0.1 * (1.0 - smoothstep(0.02, 0.12, max(footprint.x, footprint.y)));
    return soil;
  }
`

export function createEarthMaterial(world) {
  const rng = random(`${world.seed}:substrate`)
  const uniforms = {
    earthOffset: { value: new THREE.Vector2(rng() * 100, rng() * 100) },
    earthScale: { value: Math.sqrt(world.size / 120) },
    earthTopsoil: { value: new THREE.Color('#68503a') },
    earthLoam: { value: new THREE.Color('#9e7751') },
    earthClay: { value: new THREE.Color('#bea078') },
    earthWeathered: { value: new THREE.Color('#978b77') },
    earthBedrock: { value: new THREE.Color('#777970') },
    earthStone: { value: new THREE.Color('#c4bca4') }
  }
  const material = new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide })
  material.name = 'Soil and bedrock cross-section'
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = 'varying vec3 vEarthPosition;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvEarthPosition = position;'
    )
    shader.fragmentShader = surfaceShader + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb *= earthColor(vEarthPosition);'
    )
  }
  return material
}

export function buildSubstrate(world, parent, material, boundary) {
  const bottom = substrateBottom(world.size), half = world.size / 2
  const positions = [
    -half, bottom, -half, half, bottom, -half, -half, bottom, half,
    half, bottom, -half, half, bottom, half, -half, bottom, half
  ]
  // The top of every cut face follows the actual seabed, leaving room for the water volume.
  for (const [a, b] of boundary) {
    positions.push(
      a.x, a.bed, a.z, b.x, b.bed, b.z, a.x, bottom, a.z,
      b.x, b.bed, b.z, b.x, bottom, b.z, a.x, bottom, a.z
    )
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'Geological cutaway'
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
}
