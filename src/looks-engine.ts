import type { Item, Preferences } from './types'

export type LookContext = { season: string; weather: string }
export type LookPreferences = Pick<Preferences, 'styles' | 'colors'>

export const TOPS: Item['category'][] = ['Hauts', 'Chemises & polos', 'Pulls']

// The wardrobe fields are free text. Only compare explicit, whole words after
// normalizing accents, case and separators; never infer a color or style.
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function containsLabel(value: string, label: string): boolean {
  const text = normalize(value)
  const term = normalize(label)
  return Boolean(text && term && ` ${text} `.includes(` ${term} `))
}

export function matchesSeason(itemSeason: string, season: string): boolean {
  if (season === 'Toutes saisons') return true
  return containsLabel(itemSeason, season) || containsLabel(itemSeason, 'Toutes saisons')
}

const WARM_MATERIALS = ['laine', 'cachemire', 'alpaga', 'mohair']
const LIGHT_MATERIALS = ['lin', 'chanvre']

export function materialClues(material: string, weather: string): string[] {
  const labels = weather === 'Chaud' ? LIGHT_MATERIALS : ['Frais', 'Froid'].includes(weather) ? WARM_MATERIALS : []
  return labels.filter(label => containsLabel(material, label))
}

export function matchingLabels(value: string, preferences: string[]): string[] {
  return preferences.filter(label => containsLabel(value, label))
}

// Small, transparent bonuses are hints, not a compatibility or comfort model.
// An unknown field remains neutral; a different season is never excluded.
export function scoreItem(item: Item, context: LookContext, preferences: LookPreferences, selected: Item[] = []): number {
  let score = 0
  if (context.season !== 'Toutes saisons' && matchesSeason(item.season, context.season)) score += 4
  if (matchingLabels(item.style, preferences.styles).length) score += 3
  if (matchingLabels(item.color, preferences.colors).length) score += 3
  if (['Frais', 'Froid'].includes(context.weather) && item.category === 'Pulls') score += 2
  if (materialClues(item.material, context.weather).length) score += 2

  // Identical recorded labels may bring a little coherence, but are not a
  // statement that colors/styles necessarily work together.
  if (normalize(item.style) && selected.some(other => normalize(other.style) === normalize(item.style))) score += 1
  if (normalize(item.color) && selected.some(other => normalize(other.color) === normalize(item.color))) score += 1
  return score
}

function choose(candidates: Item[], context: LookContext, preferences: LookPreferences, selected: Item[], usage: Map<string, number>, random: () => number): Item | undefined {
  const available = candidates.filter(item => !selected.some(piece => piece.id === item.id))
  if (!available.length) return undefined
  const scores = available.map(item => scoreItem(item, context, preferences, selected) - (usage.get(item.id) || 0) * 2)
  const maximum = scores.reduce((highest, score) => Math.max(highest, score), -Infinity)
  // A positive floor leaves even low-ranked items eligible and keeps partial
  // wardrobes usable. Previously shown pieces receive a diversity penalty.
  const weights = scores.map(score => Math.exp((score - maximum) / 2.5) + 0.05)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let draw = Math.min(Math.max(random(), 0), 0.999999999) * total
  for (let index = 0; index < available.length; index++) {
    draw -= weights[index]
    if (draw < 0) return available[index]
  }
  return available[available.length - 1]
}

export function makeItemSets(items: Item[], context: LookContext, preferences: LookPreferences, random: () => number = Math.random): Item[][] {
  const tops = items.filter(item => TOPS.includes(item.category))
  const bottoms = items.filter(item => item.category === 'Pantalons & jeans')
  const dresses = items.filter(item => item.category === 'Robes & ensembles')
  const shoes = items.filter(item => item.category === 'Chaussures')
  const jackets = items.filter(item => item.category === 'Vestes & manteaux')
  const accessories = items.filter(item => item.category === 'Accessoires')
  const seen = new Set<string>()
  const usage = new Map<string, number>()
  const sets: Item[][] = []

  for (let attempt = 0; attempt < 90 && sets.length < 3; attempt++) {
    const picked: Item[] = []
    const add = (candidates: Item[]) => {
      const item = choose(candidates, context, preferences, picked, usage, random)
      if (item) picked.push(item)
    }
    const useDress = dresses.length > 0 && ((!tops.length && !bottoms.length) || random() < (tops.length && bottoms.length ? 0.4 : 0.75))
    if (useDress) add(dresses)
    else { add(tops); add(bottoms) }
    add(shoes)
    if (['Frais', 'Froid', 'Pluie'].includes(context.weather) || (context.weather !== 'Chaud' && random() < 0.3)) add(jackets)
    if (random() < 0.45) add(accessories)
    if (!picked.length) add(items)
    const signature = JSON.stringify(picked.map(item => item.id).sort())
    if (!picked.length || seen.has(signature)) continue
    seen.add(signature)
    picked.forEach(item => usage.set(item.id, (usage.get(item.id) || 0) + 1))
    sets.push(picked)
  }
  return sets
}
