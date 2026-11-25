export type Category = 'Hauts' | 'Chemises & polos' | 'Pulls' | 'Pantalons & jeans' | 'Vestes & manteaux' | 'Robes & ensembles' | 'Chaussures' | 'Accessoires'

export const CATEGORIES: Category[] = ['Hauts', 'Chemises & polos', 'Pulls', 'Pantalons & jeans', 'Vestes & manteaux', 'Robes & ensembles', 'Chaussures', 'Accessoires']
export const STYLES = ['Classique', 'Élégant', 'Casual', 'Streetwear', 'Chic', 'Preppy', 'Vintage', 'Minimaliste', 'Sportif', 'Business', 'Old Money']
export const SEASONS = ['Toutes saisons', 'Printemps', 'Été', 'Automne', 'Hiver']

export interface Item {
  id: string
  name: string
  category: Category
  color: string
  material: string
  brand: string
  season: string
  style: string
  image?: string
  imageBack?: string
  notes: string
  favorite: boolean
  createdAt: string
}
export interface Outfit {
  id: string
  title: string
  itemIds: string[]
  occasion: string
  notes: string
  favorite: boolean
  createdAt: string
}
export interface Schedule {
  id: string
  date: string
  outfitId: string
  note: string
  worn: boolean
}
export interface Preferences {
  name: string
  styles: string[]
  colors: string[]
  brands: string
  location: string
  language: 'fr'
  theme: 'clair' | 'sombre' | 'systeme'
  visualStyle: 'classique' | 'liquid' | 'minimal'
  accent: 'bronze' | 'prune' | 'olive' | 'bleu'
  density: 'confortable' | 'compacte'
  corners: 'arrondis' | 'nets'
  fontSize: 'petit' | 'standard' | 'grand'
  dateFormat: 'long' | 'court'
  reducedMotion: boolean
  highContrast: boolean
}
export interface AppData {
  items: Item[]
  outfits: Outfit[]
  schedules: Schedule[]
  preferences: Preferences
}
export interface SharedProps {
  data: AppData
  update: (fn: (current: AppData) => AppData) => void
  notify: (message: string) => void
}
export const emptyData: AppData = { items: [], outfits: [], schedules: [], preferences: { name: '', styles: [], colors: [], brands: '', location: '', language: 'fr', theme: 'clair', visualStyle: 'liquid', accent: 'bronze', density: 'confortable', corners: 'arrondis', fontSize: 'standard', dateFormat: 'long', reducedMotion: false, highContrast: false } }
export const makeId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
