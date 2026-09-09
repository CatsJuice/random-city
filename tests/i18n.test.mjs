import test from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGES, messages, normalizeLocale, cityNameFor } from '../src/i18n.js'

test('every supported language has a complete, nonempty translation dictionary', () => {
  const keys = Object.keys(messages.en).sort()
  assert.equal(new Set(LANGUAGES.map(([id]) => id)).size, 10)
  for (const [id, name] of LANGUAGES) {
    assert.ok(name.length > 0)
    assert.deepEqual(Object.keys(messages[id]).sort(), keys, id)
    for (const [key, value] of Object.entries(messages[id])) {
      assert.equal(typeof value, 'string', `${id}.${key}`)
      assert.ok(value.trim().length > 0, `${id}.${key}`)
    }
  }
})

test('browser language tags resolve to supported locales with correct Chinese script handling', () => {
  for (const [input, expected] of [
    ['en-US', 'en'], ['es-MX', 'es'], ['pt-BR', 'pt'], ['fr-CA', 'fr'],
    ['zh', 'zh-CN'], ['zh-SG', 'zh-CN'], ['zh-HK', 'zh-TW'], ['zh-MO', 'zh-TW'],
    ['zh-Hant', 'zh-TW'], ['zh-Hans-HK', 'zh-CN'], ['ja-JP', 'ja'], ['ko-KR', 'ko'],
    ['de-DE', 'de'], ['ru-RU', 'ru'], ['it-IT', null], ['invalid_tag', null], [null, null]
  ]) assert.equal(normalizeLocale(input), expected, String(input))
})

test('generated terrain names and the legacy fallback are localized without changing seed data', () => {
  const names = ['海湾城镇', '曲流河谷', '湖畔街区', '岛屿聚落', '岬角海岸', '交汇河网']
  for (const [id] of LANGUAGES) {
    assert.equal(new Set(names.map((name) => cityNameFor(id, name))).size, 6)
    assert.equal(cityNameFor(id, '城市罗盘'), messages[id].cityAtlas)
    assert.equal(cityNameFor(id, undefined), messages[id].cityAtlas)
  }
  assert.equal(cityNameFor('en', '海湾城镇'), 'Bay Town')
  assert.equal(cityNameFor('zh-TW', '岛屿聚落'), '島嶼聚落')
})
