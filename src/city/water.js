import * as THREE from 'three'
import { WATER_LEVEL } from './substrate.js'

export function createWaterMaterial(world, uniforms, cutaway = false) {
  const material = new THREE.MeshStandardMaterial({
    roughness: cutaway ? 0.55 : 0.26,
    metalness: cutaway ? 0 : 0.14,
    side: cutaway ? THREE.DoubleSide : THREE.FrontSide
  })
  material.name = cutaway ? 'Water column' : 'Depth-colored water surface'
  material.customProgramCacheKey = () => `city-water-${cutaway ? 'column' : 'surface'}`
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      cityTime: uniforms.time,
      depthScale: { value: Math.sqrt(world.size / 120) },
      shallowWater: { value: new THREE.Color('#53b5ac') },
      deepWater: { value: new THREE.Color(cutaway ? '#175368' : '#287f91') }
    })
    shader.vertexShader = `
      attribute float waterDepth;
      varying float vWaterDepth;
      varying vec3 vWaterPosition;
    ` + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvWaterPosition = position; vWaterDepth = waterDepth;'
    )
    shader.fragmentShader = `
      uniform float cityTime, depthScale;
      uniform vec3 shallowWater, deepWater;
      varying float vWaterDepth;
      varying vec3 vWaterPosition;
    ` + shader.fragmentShader
    const columnColor = /* glsl */ `
      float depth = max(0.0, ${WATER_LEVEL.toFixed(2)} - vWaterPosition.y);
      float absorption = 1.0 - exp(-depth / depthScale * 0.48);
      diffuseColor.rgb = mix(shallowWater, deepWater, absorption);
      float nearBed = 1.0 - smoothstep(0.0, 0.55 * depthScale, vWaterDepth - depth);
      diffuseColor.rgb *= 1.0 - nearBed * 0.16;
      float light = sin((vWaterPosition.x + vWaterPosition.z) * 1.7 + depth * 1.9 + cityTime * 0.2);
      diffuseColor.rgb *= 1.0 + light * 0.025 * exp(-depth);
    `
    const surfaceColor = /* glsl */ `
      vec2 q = vWaterPosition.xz;
      float depth = vWaterDepth / depthScale;
      diffuseColor.rgb = mix(shallowWater, deepWater, 1.0 - exp(-depth * 0.38));
      float ripple = sin(q.x * 2.0 + q.y * 3.5 + sin(q.x * .55 + cityTime * .25) * 1.4 + cityTime * .9);
      float waterPatch = sin(q.x * .7 - q.y * .8 + cityTime * .08) * sin(q.y * .33 + q.x * .2);
      float glint = smoothstep(.985, 1.0, ripple) * smoothstep(.45, .9, waterPatch);
      diffuseColor.rgb *= .94 + waterPatch * .09;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.46, .79, .77), glint * .7);
    `
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n' + (cutaway ? columnColor : surfaceColor)
    )
  }
  return material
}
