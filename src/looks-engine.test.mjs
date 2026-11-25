import test from 'node:test'
import assert from 'node:assert/strict'
import { containsLabel, makeItemSets, matchesSeason, matchingLabels, materialClues, scoreItem } from './looks-engine.ts'

const context = { season: 'Toutes saisons', weather: 'Non précisée' }
const noPreferences = { styles: [], colors: [] }
const item = (id, category = 'Hauts', fields = {}) => ({
  id, name: id, category, color: '', material: '', brand: '', season: '', style: '',
  notes: '', favorite: false, createdAt: '', ...fields,
})
const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)

test('les libellés libres comparent mots entiers, accents et casse sans inventer de correspondances', () => {
  assert.equal(containsLabel('  BLEU-marine / Écru ', 'bleu'), true)
  assert.equal(containsLabel('  BLEU-marine / Écru ', 'ecru'), true)
  assert.equal(containsLabel('Bleuté', 'bleu'), false)
  assert.equal(containsLabel('Indigo', 'Bleu'), false)
  assert.equal(containsLabel('', ''), false)
  assert.deepEqual(matchingLabels('casual chic', ['Casual', 'Chic', 'Vintage']), ['Casual', 'Chic'])
})

test('les styles et couleurs préférés influencent bien le score sans champs inventés', () => {
  const piece = item('a', 'Hauts', { style: 'Élégant', color: 'Bleu marine' })
  const prefs = { styles: ['Elegant'], colors: ['Bleu'] }
  assert.equal(scoreItem(piece, context, prefs), 6)
  assert.equal(scoreItem(piece, context, noPreferences), 0)
  assert.equal(scoreItem(item('b'), context, prefs), 0)
  assert.equal(scoreItem(item('c', 'Hauts', { style: 'Élégant', color: 'Bleuté' }), context, prefs), 3)
})

test('la saison correspondante ou toutes saisons est favorisée, sans exclure les champs vides ou différents', () => {
  const winter = { season: 'Hiver', weather: 'Non précisée' }
  assert.equal(matchesSeason('automne / hiver', 'Hiver'), true)
  assert.equal(matchesSeason('Toutes saisons', 'Hiver'), true)
  assert.equal(matchesSeason('', 'Hiver'), false)
  assert.equal(matchesSeason('Été', 'Hiver'), false)
  assert.equal(scoreItem(item('a', 'Hauts', { season: 'Hiver' }), winter, noPreferences), 4)
  assert.equal(scoreItem(item('b', 'Hauts', { season: 'Toutes saisons' }), winter, noPreferences), 4)
  assert.equal(scoreItem(item('c', 'Hauts', { season: '' }), winter, noPreferences), 0)
  assert.equal(scoreItem(item('d', 'Hauts', { season: 'Été' }), winter, noPreferences), 0)
})

test('la météo manuelle utilise seulement les catégories et mots de matière explicitement prévus', () => {
  const pull = item('a', 'Pulls', { material: 'Laine mérinos et cachemire' })
  assert.equal(scoreItem(pull, { ...context, weather: 'Froid' }, noPreferences), 4)
  assert.equal(scoreItem(pull, { ...context, weather: 'Chaud' }, noPreferences), 0)
  assert.deepEqual(materialClues('Lin et coton', 'Chaud'), ['lin'])
  assert.deepEqual(materialClues('Coton', 'Chaud'), [])
  assert.deepEqual(materialClues('Laine', 'Pluie'), [])
  assert.deepEqual(materialClues('laineux', 'Froid'), [])
})

test('un libellé identique entre pièces apporte un léger bonus, les champs vides restent neutres', () => {
  const a = item('a', 'Hauts', { color: 'Bleu marine', style: 'Élégant' })
  const b = item('b', 'Pantalons & jeans', { color: 'bleu marine', style: 'elegant' })
  assert.equal(scoreItem(b, context, noPreferences, [a]), 2)
  assert.equal(scoreItem(item('c'), context, noPreferences, [item('d')]), 0)
})

test('les préférences changent réellement la distribution des suggestions', () => {
  const pieces = [item('favori', 'Hauts', { color: 'Bleu', style: 'Casual' }), item('autre')]
  const prefs = { styles: ['Casual'], colors: ['Bleu'] }
  let preferredWithPrefs = 0
  let preferredWithoutPrefs = 0
  for (let seed = 1; seed <= 300; seed++) {
    // Vary the seed enough that the first draw covers the full range.
    const value = Math.imul(seed, 1597334677) >>> 0
    if (makeItemSets(pieces, context, prefs, seeded(value))[0][0].id === 'favori') preferredWithPrefs++
    if (makeItemSets(pieces, context, noPreferences, seeded(value))[0][0].id === 'favori') preferredWithoutPrefs++
  }
  assert.ok(preferredWithPrefs > preferredWithoutPrefs + 70, `${preferredWithPrefs} contre ${preferredWithoutPrefs}`)
})

test('la saison et la matière modifient réellement les choix sans exclure les autres pièces', () => {
  const pieces = [item('repere', 'Hauts', { season: 'Hiver', material: 'Laine' }), item('autre', 'Hauts', { season: 'Été', material: 'Coton' })]
  const count = selectedContext => {
    let result = 0
    for (let seed = 1; seed <= 300; seed++) {
      const value = Math.imul(seed, 1597334677) >>> 0
      if (makeItemSets(pieces, selectedContext, noPreferences, seeded(value))[0][0].id === 'repere') result++
    }
    return result
  }
  const baseline = count(context)
  const winter = count({ season: 'Hiver', weather: 'Non précisée' })
  const cold = count({ season: 'Toutes saisons', weather: 'Froid' })
  assert.ok(winter > baseline + 50 && winter < 300, `${winter} contre ${baseline}`)
  assert.ok(cold > baseline + 25 && cold < 300, `${cold} contre ${baseline}`)
})

test('un dressing vide ou partiel reste utilisable et ne crée aucune pièce', () => {
  assert.deepEqual(makeItemSets([], context, noPreferences, seeded(1)), [])
  for (const category of ['Hauts', 'Pantalons & jeans', 'Robes & ensembles', 'Chaussures', 'Vestes & manteaux', 'Accessoires']) {
    const source = [item('unique', category)]
    const sets = makeItemSets(source, context, noPreferences, seeded(2))
    assert.equal(sets.length, 1, category)
    assert.deepEqual(sets[0].map(piece => piece.id), ['unique'])
    assert.equal(sets[0][0], source[0])
  }
})

test('les propositions sont distinctes, sans doublon, et ajoutent une veste par pluie si disponible', () => {
  const pieces = [item('top1'), item('top2'), item('bas1', 'Pantalons & jeans'), item('bas2', 'Pantalons & jeans'), item('shoe', 'Chaussures'), item('jacket', 'Vestes & manteaux')]
  const sets = makeItemSets(pieces, { season: 'Hiver', weather: 'Pluie' }, noPreferences, seeded(478))
  assert.equal(sets.length, 3)
  assert.equal(new Set(sets.map(set => JSON.stringify(set.map(piece => piece.id).sort()))).size, sets.length)
  for (const set of sets) {
    assert.equal(new Set(set.map(piece => piece.id)).size, set.length)
    assert.ok(set.some(piece => piece.id === 'jacket'))
    assert.ok(set.some(piece => piece.category === 'Pantalons & jeans'))
    assert.ok(set.some(piece => piece.category === 'Hauts'))
  }
})

test('robes et ensembles peuvent remplacer le haut et le bas', () => {
  const pieces = [item('robe', 'Robes & ensembles'), item('top'), item('bas', 'Pantalons & jeans'), item('chaussure', 'Chaussures')]
  let dressFound = false
  let separatesFound = false
  for (let seed = 1; seed <= 20; seed++) {
    for (const set of makeItemSets(pieces, context, noPreferences, seeded(Math.imul(seed, 1523743827) >>> 0))) {
      if (set.some(piece => piece.id === 'robe')) {
        dressFound = true
        assert.ok(!set.some(piece => ['top', 'bas'].includes(piece.id)))
      } else if (set.some(piece => piece.id === 'top') && set.some(piece => piece.id === 'bas')) separatesFound = true
    }
  }
  assert.ok(dressFound && separatesFound)
})
