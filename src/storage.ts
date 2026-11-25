import { CATEGORIES, emptyData, type AppData, type Category, type Item, type Outfit } from './types'

const DB_NAME = 'ars-vestis-personal'
const STORE_NAME = 'user-data'
const DATA_KEY = 'workspace-v1'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Stockage indisponible'))
  })
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === 'string')

export function normalizeData(input: unknown): AppData {
  if (!record(input) || !Array.isArray(input.items) || !Array.isArray(input.outfits) || !Array.isArray(input.schedules) || !record(input.preferences)) throw new Error('Fichier de sauvegarde invalide : structure manquante.')
  const p = input.preferences
  if (typeof p.name !== 'string' || !strings(p.styles) || !strings(p.colors) || typeof p.brands !== 'string' || typeof p.location !== 'string') throw new Error('Fichier de sauvegarde invalide : préférences incorrectes.')
  const validItems = input.items.every(i => record(i) && typeof i.id === 'string' && typeof i.name === 'string' && CATEGORIES.includes(i.category as Category) && typeof i.color === 'string' && typeof i.material === 'string' && typeof i.brand === 'string' && typeof i.season === 'string' && typeof i.style === 'string' && (i.image === undefined || typeof i.image === 'string') && (i.imageBack === undefined || typeof i.imageBack === 'string') && typeof i.notes === 'string' && typeof i.favorite === 'boolean' && typeof i.createdAt === 'string')
  const validOutfits = input.outfits.every(o => record(o) && typeof o.id === 'string' && typeof o.title === 'string' && strings(o.itemIds) && typeof o.occasion === 'string' && typeof o.notes === 'string' && typeof o.favorite === 'boolean' && typeof o.createdAt === 'string')
  const validSchedules = input.schedules.every(s => record(s) && typeof s.id === 'string' && typeof s.date === 'string' && typeof s.outfitId === 'string' && typeof s.note === 'string' && typeof s.worn === 'boolean')
  if (!validItems || !validOutfits || !validSchedules) throw new Error('Fichier de sauvegarde invalide : certains éléments sont incomplets.')
  return { ...(input as unknown as AppData), preferences: { ...emptyData.preferences, ...input.preferences } }
}

export async function readData(): Promise<AppData> {
  const db = await openDB()
  try {
    const value = await new Promise<AppData | undefined>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(DATA_KEY)
      request.onsuccess = () => resolve(request.result as AppData | undefined)
      request.onerror = () => reject(request.error)
    })
    if (value) return normalizeData(value)
    const oldItems = JSON.parse(localStorage.getItem('ars-items') || '[]') as Array<Record<string, unknown>>
    const oldOutfits = JSON.parse(localStorage.getItem('ars-outfits') || '[]') as Array<Record<string, unknown>>
    // Prior versions automatically inserted six examples. If anything was customized,
    // preserve all records and label the examples; leave the original localStorage untouched.
    const examples = [
      ['Trench signature', 'Vestes', 'Sable', 'Coton', 'photo-1551488831-00ddcb6c6bd3', true],
      ['Chemise Oxford', 'Hauts', 'Blanc cassé', 'Coton', 'photo-1603252110481-7ba873bf42ab', false],
      ['Jean droit 501', 'Bas', 'Indigo', 'Denim', 'photo-1542272604-787c3835535d', true],
      ['Derbies cuir', 'Chaussures', 'Marron', 'Cuir', 'photo-1614252369475-531eba835eb1', false],
      ['Pull col rond', 'Hauts', 'Noir', 'Laine mérinos', 'photo-1611312449408-fcece27cdbb7', false],
      ['Montre acier', 'Accessoires', 'Acier', 'Acier', 'photo-1524805444758-089113d48a6d', false],
    ] as const
    const exampleOutfits = [
      { title: 'Élégance quotidienne', occasion: 'Bureau · Aujourd’hui', itemIds: [1, 2, 3, 4] },
      { title: 'Minimal après-midi', occasion: 'Déjeuner · Samedi', itemIds: [5, 3, 4] },
    ]
    const originalItems = oldItems.length === 6 && oldItems.every(item => {
      const example = examples[Number(item.id) - 1]
      return example && item.name === example[0] && item.category === example[1] && item.color === example[2] && item.material === example[3] && typeof item.image === 'string' && item.image.includes(example[4]) && !!item.favorite === example[5]
    }) && new Set(oldItems.map(item => item.id)).size === 6
    const originalOutfits = oldOutfits.length === 2 && oldOutfits.every(outfit => {
      const example = exampleOutfits[Number(outfit.id) - 1]
      return example && outfit.title === example.title && outfit.occasion === example.occasion && !!outfit.saved && JSON.stringify(outfit.itemIds) === JSON.stringify(example.itemIds)
    }) && new Set(oldOutfits.map(outfit => outfit.id)).size === 2
    const changed = (localStorage.getItem('ars-items') !== null || localStorage.getItem('ars-outfits') !== null) && !(originalItems && originalOutfits)
    if (!changed) return structuredClone(emptyData)
    const categories: Record<string, Category> = { 'Vestes': 'Vestes & manteaux', 'Hauts': 'Hauts', 'Bas': 'Pantalons & jeans', 'Chaussures': 'Chaussures', 'Accessoires': 'Accessoires' }
    const items: Item[] = oldItems.filter(i => typeof i.id === 'number').map(i => {
      const example = Number(i.id) <= 6
      const creationDate = new Date(Number(i.id))
      const placeholder = typeof i.image === 'string' && i.image.includes('photo-1596755389378-c31d21fd1273')
      return { id: String(i.id), name: `${String(i.name || 'Pièce')}${example ? ' (exemple)' : ''}`, category: categories[String(i.category)] || 'Hauts', color: String(i.color || ''), material: String(i.material || ''), brand: '', season: 'Toutes saisons', style: '', image: typeof i.image === 'string' && !placeholder ? i.image : undefined, notes: example ? 'Pièce d’exemple de l’ancienne version ; vous pouvez la supprimer ou la modifier.' : placeholder ? 'L’ancienne image par défaut a été retirée ; ajoutez votre photo.' : '', favorite: !!i.favorite, createdAt: !example && Number.isFinite(creationDate.getTime()) ? creationDate.toISOString() : new Date().toISOString() }
    })
    const outfits: Outfit[] = oldOutfits.filter(o => typeof o.id === 'number').map(o => {
      const creationDate = new Date(Number(o.id))
      return { id: String(o.id), title: `${String(o.title || 'Tenue')}${Number(o.id) <= 2 ? ' (exemple)' : ''}`, itemIds: Array.isArray(o.itemIds) ? o.itemIds.map(String) : [], occasion: String(o.occasion || '').replace('Suggestion IA · maintenant', 'Suggestion de l’ancienne version'), notes: Number(o.id) <= 2 ? 'Exemple issu de l’ancienne version.' : '', favorite: !!o.saved, createdAt: Number(o.id) > 2 && Number.isFinite(creationDate.getTime()) ? creationDate.toISOString() : new Date().toISOString() }
    })
    return { ...structuredClone(emptyData), items, outfits }
  } finally { db.close() }
}

export async function writeData(data: AppData): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(data, DATA_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('Enregistrement impossible'))
      transaction.onabort = () => reject(transaction.error || new Error('Enregistrement interrompu'))
    })
  } finally { db.close() }
}
