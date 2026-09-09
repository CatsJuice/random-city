export const IMPLEMENTATIONS = [
  { id: 'astra', label: 'GPT-5.6 Astra' },
  { id: 'gpt-5.5', label: 'GPT-5.5' }
]

export const normalizeImplementation = (value) => (value === 'gpt-5.5' ? value : 'astra')

export async function loadImplementation(id) {
  if (id === 'gpt-5.5') return (await import('./legacy/canvas-renderer.js')).createLegacyCity
  return (await import('./city/renderer.js')).createCity
}
