import test from 'node:test'
import assert from 'node:assert/strict'
import { editSavedOutfit, removeOutfitPiece, renameOutfit } from './looks-edits.ts'

const outfit = { id: 'look', title: 'Ancien nom', itemIds: ['haut', 'bas'], occasion: 'Bureau', notes: 'Notes', favorite: true, createdAt: '2026-01-01' }
const data = {
  items: [{ id: 'haut' }, { id: 'bas' }],
  outfits: [outfit, { ...outfit, id: 'autre' }],
  schedules: [{ id: 'planning', outfitId: 'look', date: '2026-11-25', note: 'Déjeuner', worn: false }],
  preferences: { name: '', styles: [], colors: [], brands: '', location: '' },
}

test('retirer une pièce ne modifie ni dressing, ni planifications, ni favoris', () => {
  const result = editSavedOutfit(data, 'look', saved => removeOutfitPiece(saved, 'haut'))
  assert.deepEqual(result.outfits[0].itemIds, ['bas'])
  assert.deepEqual(outfit.itemIds, ['haut', 'bas'])
  assert.equal(result.items, data.items)
  assert.equal(result.schedules, data.schedules)
  assert.equal(result.schedules[0].outfitId, result.outfits[0].id)
  assert.equal(result.outfits[0].favorite, true)
  assert.equal(result.outfits[1], data.outfits[1])
})

test('la dernière pièce reste dans la tenue et une pièce absente ne change rien', () => {
  const single = { ...outfit, itemIds: ['haut'] }
  assert.equal(removeOutfitPiece(single, 'haut'), single)
  assert.equal(removeOutfitPiece(outfit, 'inconnue'), outfit)
})

test('renommer conserve l’identité, les pièces, les favoris et les dates planifiées', () => {
  const result = editSavedOutfit(data, 'look', saved => renameOutfit(saved, '  Nouvelle tenue  '))
  assert.equal(result.outfits[0].title, 'Nouvelle tenue')
  assert.equal(result.outfits[0].id, outfit.id)
  assert.equal(result.outfits[0].itemIds, outfit.itemIds)
  assert.equal(result.outfits[0].favorite, true)
  assert.equal(result.schedules, data.schedules)
  assert.equal(result.items, data.items)
  assert.equal(renameOutfit(outfit, '   '), outfit)
})
