import type { AppData, Outfit } from './types'

export function removeOutfitPiece(outfit: Outfit, itemId: string): Outfit {
  if (outfit.itemIds.length <= 1 || !outfit.itemIds.includes(itemId)) return outfit
  return { ...outfit, itemIds: outfit.itemIds.filter(id => id !== itemId) }
}

export function renameOutfit(outfit: Outfit, value: string): Outfit {
  const title = value.trim()
  return title && title !== outfit.title ? { ...outfit, title } : outfit
}

export function editSavedOutfit(data: AppData, outfitId: string, edit: (outfit: Outfit) => Outfit): AppData {
  return { ...data, outfits: data.outfits.map(outfit => outfit.id === outfitId ? edit(outfit) : outfit) }
}
