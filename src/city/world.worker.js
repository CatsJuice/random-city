import { generateWorld } from './world.js'

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ world: generateWorld(data.seed, data.density, data.size) })
  } catch (error) {
    self.postMessage({ error: error.message })
  }
}
