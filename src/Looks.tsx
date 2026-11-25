import { useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, Bookmark, CalendarDays, Check, ChevronLeft, ChevronRight, Heart, Layers3, Pencil, Plus, RefreshCw, Share2, Shirt, Sparkles, Trash2, X } from 'lucide-react'
import { makeId, SEASONS } from './types'
import type { Item, Outfit, Schedule, SharedProps } from './types'
import { makeItemSets, matchesSeason, matchingLabels, materialClues, TOPS } from './looks-engine'
import type { LookPreferences } from './looks-engine'
import { editSavedOutfit, removeOutfitPiece, renameOutfit } from './looks-edits'
import './looks.css'

type Context = { occasion: string; season: string; weather: string }
type Suggestion = { outfit: Outfit; context: Context; preferences: LookPreferences }

const WEATHER = ['Non précisée', 'Doux', 'Chaud', 'Frais', 'Froid', 'Pluie']
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function localDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dateLabel(value: string) {
  const parts = value.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return value
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  if (localDate(date) !== value) return value
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function outfitRef(outfit: Outfit) { return outfit.id.slice(-6).toUpperCase() }

const QUICK_OCCASIONS = ['Quotidien', 'Bureau', 'Dîner', 'Week-end']

export async function shareOutfit(outfit: Outfit, items: Item[], notify: (message: string) => void) {
  const names = outfit.itemIds.map(id => items.find(item => item.id === id)?.name || 'Pièce indisponible')
  const text = `${outfit.title}\n${names.join(' · ')}${outfit.occasion ? `\nPour : ${outfit.occasion}` : ''}\nCréé avec ARS VESTIS.`
  try {
    if (navigator.share) {
      await navigator.share({ title: `ARS VESTIS · ${outfit.title}`, text })
      notify('Look partagé depuis votre appareil.')
      return
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      notify('Détails du look copiés. Vous pouvez les envoyer à qui vous voulez.')
      return
    }
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
    notify('Détails du look copiés.')
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    notify('Le partage est indisponible sur cet appareil.')
  }
}

function makeSuggestions(items: Item[], context: Context, preferences: LookPreferences): Suggestion[] {
  const selectedPreferences = { styles: [...preferences.styles], colors: [...preferences.colors] }
  return makeItemSets(items, context, selectedPreferences).map((picked, position) => {
    const index = String(position + 1).padStart(2, '0')
    const occasion = context.occasion.trim()
    return {
      context: { ...context, occasion },
      preferences: selectedPreferences,
      outfit: {
        id: makeId(), title: `Silhouette ${index}`, itemIds: picked.map(item => item.id), occasion,
        notes: `Saison indiquée : ${context.season}. Météo saisie : ${context.weather.toLowerCase()}.`,
        favorite: false, createdAt: new Date().toISOString(),
      },
    }
  })
}

function missingCategories(items: Item[]): string[] {
  const hasTop = items.some(item => TOPS.includes(item.category))
  const hasBottom = items.some(item => item.category === 'Pantalons & jeans')
  const hasDress = items.some(item => item.category === 'Robes & ensembles')
  const missing: string[] = []
  if (!hasDress && !hasTop) missing.push('un haut, une chemise ou un pull')
  if (!hasDress && !hasBottom) missing.push('un pantalon ou un jean')
  if (!items.some(item => item.category === 'Chaussures')) missing.push('des chaussures')
  return missing
}

function compatibleReplacement(item: Item | undefined, candidate: Item) {
  if (!item) return true
  return candidate.category === item.category || (TOPS.includes(item.category) && TOPS.includes(candidate.category))
}

function Piece({ item, itemId, items, selectedIds, onReplace, onRemove }: { item?: Item; itemId: string; items: Item[]; selectedIds: string[]; onReplace: (oldId: string, newId: string) => void; onRemove: (id: string) => void }) {
  const options = items.filter(candidate => compatibleReplacement(item, candidate) && (candidate.id === itemId || !selectedIds.includes(candidate.id)))
  return <div className="lk-piece">
    <div className="lk-piece-image">
      {item?.image ? <img src={item.image} alt={item.name} /> : <Shirt aria-hidden="true" />}
    </div>
    <div className="lk-piece-copy"><strong>{item?.name || 'Pièce retirée du dressing'}</strong><span>{item ? [item.category, item.color].filter(Boolean).join(' · ') : 'Choisissez une pièce de remplacement'}</span></div>
    <label className="lk-swap"><span className="lk-sr-only">Remplacer {item?.name || 'la pièce supprimée'}</span><select value={itemId} onChange={event => onReplace(itemId, event.target.value)} disabled={options.length <= (item ? 1 : 0)}>
      {!item && <option value={itemId}>Pièce indisponible</option>}
      {options.map(option => <option key={option.id} value={option.id}>{option.id === itemId ? 'Remplacer' : option.name}</option>)}
    </select></label>
    <button type="button" className="lk-remove-piece" onClick={() => onRemove(itemId)} disabled={selectedIds.length <= 1} aria-label={`Retirer ${item?.name || 'la pièce indisponible'} de la tenue`} title={selectedIds.length <= 1 ? 'Une tenue doit conserver au moins une pièce' : 'Retirer de la tenue'}><X size={15} /></button>
  </div>
}

function PlanningForm({ initialDate, actionLabel, onCancel, onSubmit }: { initialDate: string; actionLabel: string; onCancel: () => void; onSubmit: (date: string, note: string) => void }) {
  const [date, setDate] = useState(initialDate)
  const [note, setNote] = useState('')
  return <form className="lk-plan-form" onSubmit={event => { event.preventDefault(); if (date) onSubmit(date, note.trim()) }}>
    <div className="lk-plan-form-title"><CalendarDays size={16} /><strong>Choisir une date</strong><button type="button" className="lk-icon-button" onClick={onCancel} aria-label="Fermer la planification"><X size={16} /></button></div>
    <div className="lk-plan-inputs"><label>Date<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label><label>Note <span>(facultatif)</span><input value={note} onChange={event => setNote(event.target.value)} placeholder="Ex. déjeuner" maxLength={160} /></label></div>
    <button className="lk-button lk-button-dark" type="submit"><CalendarDays size={15} />{actionLabel}</button>
  </form>
}

export function Looks({ data, update, notify }: SharedProps) {
  const [occasion, setOccasion] = useState('')
  const [season, setSeason] = useState('Toutes saisons')
  const [weather, setWeather] = useState('Non précisée')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [generated, setGenerated] = useState(false)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [planningId, setPlanningId] = useState<string | null>(null)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const missing = missingCategories(data.items)

  const generate = () => {
    const next = makeSuggestions(data.items, { occasion, season, weather }, data.preferences)
    setSuggestions(next)
    setGenerated(true)
    setPlanningId(null)
    if (!next.length) notify('Ajoutez des pièces à votre dressing pour composer une tenue.')
  }

  const save = (outfit: Outfit) => {
    if (!outfit.itemIds.length || outfit.itemIds.some(id => !data.items.some(item => item.id === id))) {
      notify('Une pièce n’est plus disponible. Remplacez-la avant d’enregistrer.')
      return
    }
    update(current => current.outfits.some(saved => saved.id === outfit.id) ? current : { ...current, outfits: [outfit, ...current.outfits] })
    setSuggestions(current => current.filter(suggestion => suggestion.outfit.id !== outfit.id))
    setPlanningId(null)
    notify('Tenue enregistrée dans votre collection.')
  }

  const schedule = (outfit: Outfit, date: string, note: string, isSuggestion: boolean) => {
    if (!date) return
    if (isSuggestion && (!outfit.itemIds.length || outfit.itemIds.some(id => !data.items.some(item => item.id === id)))) {
      notify('Une pièce n’est plus disponible. Remplacez-la avant de programmer.')
      return
    }
    const entry: Schedule = { id: makeId(), date, outfitId: outfit.id, note, worn: false }
    update(current => ({ ...current, outfits: current.outfits.some(saved => saved.id === outfit.id) ? current.outfits : [outfit, ...current.outfits], schedules: [...current.schedules, entry] }))
    if (isSuggestion) setSuggestions(current => current.filter(suggestion => suggestion.outfit.id !== outfit.id))
    setPlanningId(null)
    notify(isSuggestion ? 'Tenue enregistrée et programmée.' : 'Tenue ajoutée au calendrier.')
  }

  const replace = (outfit: Outfit, oldId: string, newId: string, isSuggestion: boolean) => {
    if (oldId === newId || outfit.itemIds.includes(newId) || !data.items.some(item => item.id === newId)) return
    if (isSuggestion) setSuggestions(current => current.map(suggestion => suggestion.outfit.id === outfit.id ? { ...suggestion, outfit: { ...suggestion.outfit, itemIds: suggestion.outfit.itemIds.map(id => id === oldId ? newId : id) } } : suggestion))
    else update(current => ({ ...current, outfits: current.outfits.map(saved => saved.id === outfit.id ? { ...saved, itemIds: saved.itemIds.map(id => id === oldId ? newId : id) } : saved) }))
    if (!isSuggestion) notify('Pièce remplacée dans la tenue.')
  }

  const addPiece = (outfit: Outfit, newId: string, isSuggestion: boolean) => {
    if (!newId || outfit.itemIds.includes(newId) || !data.items.some(item => item.id === newId)) return
    if (isSuggestion) setSuggestions(current => current.map(suggestion => suggestion.outfit.id === outfit.id ? { ...suggestion, outfit: { ...suggestion.outfit, itemIds: [...suggestion.outfit.itemIds, newId] } } : suggestion))
    else update(current => ({ ...current, outfits: current.outfits.map(saved => saved.id === outfit.id ? { ...saved, itemIds: [...saved.itemIds, newId] } : saved) }))
    if (!isSuggestion) notify('Pièce ajoutée à la tenue.')
  }

  const removePiece = (outfit: Outfit, itemId: string, isSuggestion: boolean) => {
    if (outfit.itemIds.length <= 1 || !outfit.itemIds.includes(itemId)) return
    if (isSuggestion) setSuggestions(current => current.map(suggestion => suggestion.outfit.id === outfit.id ? { ...suggestion, outfit: removeOutfitPiece(suggestion.outfit, itemId) } : suggestion))
    else update(current => editSavedOutfit(current, outfit.id, saved => removeOutfitPiece(saved, itemId)))
    if (!isSuggestion) notify('Pièce retirée de la tenue ; le dressing est inchangé.')
  }

  const rename = (outfit: Outfit) => {
    const title = titleDraft.trim()
    if (!title) { notify('Indiquez un nom pour cette tenue.'); return }
    update(current => editSavedOutfit(current, outfit.id, saved => renameOutfit(saved, title)))
    setEditingTitleId(null)
    notify('Tenue renommée.')
  }

  const remove = (outfit: Outfit) => {
    const planned = data.schedules.filter(entry => entry.outfitId === outfit.id).length
    const question = planned ? `Supprimer cette tenue et ${planned === 1 ? 'sa planification' : `ses ${planned} planifications`} ?` : 'Supprimer cette tenue enregistrée ?'
    if (!window.confirm(question)) return
    update(current => ({ ...current, outfits: current.outfits.filter(saved => saved.id !== outfit.id), schedules: current.schedules.filter(entry => entry.outfitId !== outfit.id) }))
    if (planningId === outfit.id) setPlanningId(null)
    if (editingTitleId === outfit.id) setEditingTitleId(null)
    notify('Tenue supprimée.')
  }

  const toggleFavorite = (outfit: Outfit) => {
    update(current => ({ ...current, outfits: current.outfits.map(saved => saved.id === outfit.id ? { ...saved, favorite: !saved.favorite } : saved) }))
    notify(outfit.favorite ? 'Tenue retirée des favoris.' : 'Tenue ajoutée aux favoris.')
  }

  const card = (outfit: Outfit, isSuggestion: boolean, context?: Context, preferences?: LookPreferences) => {
    const unavailable = outfit.itemIds.filter(id => !data.items.some(item => item.id === id)).length
    const selectedSeason = context?.season || outfit.notes.match(/^Saison indiquée : (.*?)\./)?.[1]
    const selectedItems = outfit.itemIds.map(id => data.items.find(item => item.id === id)).filter((item): item is Item => !!item)
    const nonMatching = selectedSeason && selectedSeason !== 'Toutes saisons' ? selectedItems.filter(item => !matchesSeason(item.season, selectedSeason)) : []
    const styles = preferences ? [...new Set(selectedItems.flatMap(item => matchingLabels(item.style, preferences.styles)))] : []
    const colors = preferences ? [...new Set(selectedItems.flatMap(item => matchingLabels(item.color, preferences.colors)))] : []
    const materials = context ? [...new Set(selectedItems.flatMap(item => materialClues(item.material, context.weather)))] : []
    const partial = isSuggestion ? missingCategories(selectedItems) : []
    return <article className="lk-look-card" key={outfit.id}>
      <div className="lk-card-top"><div><span className="lk-kicker">{isSuggestion ? 'PROPOSITION' : `TENUE ENREGISTRÉE · RÉF. ${outfitRef(outfit)}`}</span><h3>{outfit.title}</h3><p>{outfit.occasion || 'Sans occasion précisée'} · {outfit.itemIds.length} pièce{outfit.itemIds.length > 1 ? 's' : ''}</p></div>
        {!isSuggestion && <div className="lk-card-tools"><button className="lk-icon-button" type="button" onClick={() => { setEditingTitleId(outfit.id); setTitleDraft(outfit.title) }} aria-label={`Renommer ${outfit.title}`}><Pencil size={16} /></button><button className={`lk-icon-button lk-heart ${outfit.favorite ? 'lk-active' : ''}`} type="button" onClick={() => toggleFavorite(outfit)} aria-label={outfit.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={outfit.favorite}><Heart size={18} /></button></div>}
      </div>
      {editingTitleId === outfit.id && !isSuggestion && <form className="lk-rename" onSubmit={event => { event.preventDefault(); rename(outfit) }}><label>Nom de la tenue<input autoFocus required maxLength={120} value={titleDraft} onChange={event => setTitleDraft(event.target.value)} /></label><div><button type="submit" className="lk-button lk-button-dark">Enregistrer</button><button type="button" className="lk-button lk-button-outline" onClick={() => setEditingTitleId(null)}>Annuler</button></div></form>}
      <div className="lk-look-visual" aria-label={`Aperçu visuel de ${outfit.title}`}>{outfit.itemIds.slice(0, 4).map(id => { const item = data.items.find(piece => piece.id === id); return <div className="lk-look-visual-piece" key={id}>{item?.image ? <img src={item.image} alt="" /> : <Shirt size={25} />}</div> })}</div>
      <div className="lk-pieces">{outfit.itemIds.map(id => <Piece key={id} itemId={id} item={data.items.find(item => item.id === id)} items={data.items} selectedIds={outfit.itemIds} onReplace={(oldId, newId) => replace(outfit, oldId, newId, isSuggestion)} onRemove={itemId => removePiece(outfit, itemId, isSuggestion)} />)}</div>
      {outfit.itemIds.length === 1 && <p className="lk-piece-hint">Une tenue doit conserver au moins une pièce. Le retrait ne supprime rien du dressing.</p>}
      {data.items.some(item => !outfit.itemIds.includes(item.id)) && <label className="lk-add-piece"><span className="lk-sr-only">Ajouter une pièce à {outfit.title}</span><select value="" onChange={event => addPiece(outfit, event.target.value, isSuggestion)}><option value="">Ajouter une pièce…</option>{data.items.filter(item => !outfit.itemIds.includes(item.id)).map(item => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}</select></label>}
      {unavailable > 0 && <p className="lk-warning">{unavailable} pièce{unavailable > 1 ? 's ne sont plus disponibles' : ' n’est plus disponible'} dans le dressing. Remplacez-la pour compléter la tenue.</p>}
      {partial.length > 0 && <p className="lk-warning">Proposition partielle : il manque {partial.join(', ')}.</p>}
      <p className="lk-explanation"><Sparkles size={14} /> <span>{selectedItems.length > 0 && `Composition : ${selectedItems.map(item => item.category.toLowerCase()).join(', ')}. `}{outfit.notes || 'Composition enregistrée à partir de votre dressing.'}{styles.length > 0 && ` Styles préférés présents : ${styles.join(', ')}.`}{colors.length > 0 && ` Couleurs préférées présentes : ${colors.join(', ')}.`}{materials.length > 0 && ` Mots repérés dans les matières : ${materials.join(', ')}.`}{nonMatching.length > 0 && ` Saison différente ou non renseignée : ${nonMatching.map(item => item.name).join(', ')}.`}</span></p>
      <div className="lk-card-actions">
        {isSuggestion ? <button type="button" className="lk-button lk-button-dark" onClick={() => save(outfit)}><Bookmark size={15} /> Enregistrer</button> : <button type="button" className="lk-button lk-button-quiet lk-delete" onClick={() => remove(outfit)}><Trash2 size={15} /> Supprimer</button>}
        <button type="button" className="lk-button lk-button-outline lk-share-button" onClick={() => void shareOutfit(outfit, data.items, notify)}><Share2 size={15} /> Partager</button>
        <button type="button" className="lk-button lk-button-outline" onClick={() => setPlanningId(planningId === outfit.id ? null : outfit.id)}><CalendarDays size={15} /> Programmer</button>
      </div>
      {planningId === outfit.id && <PlanningForm initialDate={localDate()} actionLabel={isSuggestion ? 'Enregistrer et programmer' : 'Ajouter au calendrier'} onCancel={() => setPlanningId(null)} onSubmit={(date, note) => schedule(outfit, date, note, isSuggestion)} />}
    </article>
  }

  return <div className="lk-page lk-looks">
    <header className="lk-page-head"><div><span className="lk-kicker">L’ART DE COMPOSER</span><h1>Mes <em>tenues.</em></h1><p>Redécouvrez ce que vous possédez déjà, une silhouette à la fois.</p></div><div className="lk-head-count"><Layers3 size={18} /><span><strong>{data.outfits.length}</strong> tenue{data.outfits.length > 1 ? 's' : ''} enregistrée{data.outfits.length > 1 ? 's' : ''}</span></div></header>
    <section className="lk-composer" aria-labelledby="lk-compose-title">
      <div className="lk-composer-intro"><div className="lk-composer-icon"><Sparkles size={20} /></div><div><span className="lk-kicker">VOTRE ATELIER</span><h2 id="lk-compose-title">Une nouvelle idée de tenue</h2><p>Choisissez un contexte, puis laissez ARS VESTIS composer avec les pièces que vous possédez.</p></div></div>
      <form onSubmit={event => { event.preventDefault(); generate() }}>
        <div className="lk-quick-occasions" aria-label="Occasions rapides"><span>Pour :</span>{QUICK_OCCASIONS.map(value => <button type="button" key={value} className={occasion === value ? 'lk-quick-chip lk-quick-chip-active' : 'lk-quick-chip'} onClick={() => setOccasion(current => current === value ? '' : value)} aria-pressed={occasion === value}>{value}</button>)}</div>
        <div className="lk-context-fields"><label>Occasion <span>(facultatif)</span><input value={occasion} onChange={event => setOccasion(event.target.value)} placeholder="Ex. bureau, dîner…" maxLength={80} /></label><label>Saison<select value={season} onChange={event => setSeason(event.target.value)}>{SEASONS.map(value => <option key={value}>{value}</option>)}</select></label><label>Météo <span>(saisie manuelle)</span><select value={weather} onChange={event => setWeather(event.target.value)}>{WEATHER.map(value => <option key={value}>{value}</option>)}</select></label></div>
        <details className="lk-rules"><summary>Comment sont choisies les pièces ?</summary><p><strong>Préférences enregistrées</strong> · Styles : {data.preferences.styles.join(', ') || 'aucun'} · Couleurs : {data.preferences.colors.join(', ') || 'aucune'}.</p><p>Les correspondances utilisent uniquement vos champs renseignés : saison, style, couleur, matière et diversité. La météo est un repère manuel ; elle ne garantit ni confort ni protection.</p></details>
        <div className="lk-composer-bottom"><p>Une idée rapide, basée sur votre dressing réel.</p><button className="lk-button lk-button-dark" type="submit" disabled={!data.items.length}><Sparkles size={16} /> Composer mon look <ArrowRight size={15} /></button></div>
      </form>
      {data.items.length === 0 ? <div className="lk-notice"><Shirt size={17} /><span>Votre dressing est vide. Ajoutez des pièces pour obtenir des suggestions.</span></div> : missing.length > 0 ? <div className="lk-notice"><Shirt size={17} /><span>Pour une tenue complète, il manque {missing.join(', ')}. {missing.length > 1 || missing[0] !== 'des chaussures' ? 'Une robe ou un ensemble peut aussi remplacer le haut et le bas. ' : ''}Les propositions seront partielles.</span></div> : null}
    </section>

    {generated && <section className="lk-section" aria-labelledby="lk-suggestions-title"><div className="lk-section-heading"><div><span className="lk-kicker">SÉLECTION DU DRESSING</span><h2 id="lk-suggestions-title">Vos propositions</h2><p>Chaque pièce provient de votre dressing. Remplacez-la pour personnaliser la silhouette.</p></div><button type="button" className="lk-text-button" onClick={generate} disabled={!data.items.length}><RefreshCw size={15} /> Autres idées</button></div>
      {suggestions.length ? <><div className="lk-card-grid">{suggestions.map(suggestion => card(suggestion.outfit, true, suggestion.context, suggestion.preferences))}</div>{suggestions.length < 3 && <p className="lk-fineprint">Peu de variantes distinctes ont été trouvées cette fois. Ajoutez des pièces ou composez à nouveau pour varier.</p>}</> : <div className="lk-empty lk-empty-small"><Check size={20} /><p>Aucune proposition en attente. Composez à nouveau pour en découvrir d’autres.</p></div>}
    </section>}

    <section className="lk-section" aria-labelledby="lk-saved-title"><div className="lk-section-heading"><div><span className="lk-kicker">VOTRE COLLECTION</span><h2 id="lk-saved-title">Tenues enregistrées</h2><p>Vos silhouettes préférées, prêtes à être portées.</p></div><button type="button" className={`lk-filter ${favoritesOnly ? 'lk-filter-active' : ''}`} onClick={() => setFavoritesOnly(!favoritesOnly)} aria-pressed={favoritesOnly}><Heart size={15} /> Favoris</button></div>
      {data.outfits.filter(outfit => !favoritesOnly || outfit.favorite).length ? <div className="lk-card-grid">{data.outfits.filter(outfit => !favoritesOnly || outfit.favorite).map(outfit => card(outfit, false))}</div> : <div className="lk-empty"><div className="lk-empty-icon"><Bookmark size={20} /></div><h3>{favoritesOnly ? 'Pas encore de favori' : 'Votre collection commence ici'}</h3><p>{favoritesOnly ? 'Marquez une tenue enregistrée avec le cœur pour la retrouver ici.' : 'Composez une tenue à partir de vos pièces et enregistrez celles qui vous plaisent.'}</p>{favoritesOnly && <button className="lk-text-button" onClick={() => setFavoritesOnly(false)}>Voir toutes les tenues <ArrowRight size={14} /></button>}</div>}
    </section>
  </div>
}

export function Calendar({ data, update, notify }: SharedProps) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1) })
  const [selectedDate, setSelectedDate] = useState(() => localDate())
  const [outfitId, setOutfitId] = useState('')
  const [note, setNote] = useState('')
  const [showForm, setShowForm] = useState(false)
  const today = localDate()
  const firstOffset = (month.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(month)
  const byDate = useMemo(() => {
    const map = new Map<string, Schedule[]>()
    data.schedules.forEach(entry => map.set(entry.date, [...(map.get(entry.date) || []), entry]))
    return map
  }, [data.schedules])
  const selected = byDate.get(selectedDate) || []

  const navigate = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1)
    setMonth(next)
    setSelectedDate(localDate(next))
    setShowForm(false)
  }
  const goToday = () => {
    const now = new Date()
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(localDate(now))
    setShowForm(false)
  }
  const addSchedule = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data.outfits.some(outfit => outfit.id === outfitId)) { notify('Choisissez une tenue enregistrée.'); return }
    const entry: Schedule = { id: makeId(), date: selectedDate, outfitId, note: note.trim(), worn: false }
    update(current => ({ ...current, schedules: [...current.schedules, entry] }))
    setNote('')
    setShowForm(false)
    notify('Tenue ajoutée au calendrier.')
  }
  const toggleWorn = (entry: Schedule) => {
    update(current => ({ ...current, schedules: current.schedules.map(schedule => schedule.id === entry.id ? { ...schedule, worn: !schedule.worn } : schedule) }))
    notify(entry.worn ? 'Tenue marquée comme non portée.' : 'Tenue marquée comme portée.')
  }
  const deleteSchedule = (entry: Schedule) => {
    update(current => ({ ...current, schedules: current.schedules.filter(schedule => schedule.id !== entry.id) }))
    notify('Planification supprimée.')
  }

  return <div className="lk-page lk-calendar-page">
    <header className="lk-page-head"><div><span className="lk-kicker">VOTRE TEMPS, VOTRE STYLE</span><h1>Mon <em>calendrier.</em></h1><p>Planifiez vos silhouettes, une journée à la fois.</p></div><button type="button" className="lk-button lk-button-outline" onClick={goToday}>Aujourd’hui</button></header>
    <div className="lk-calendar-layout"><section className="lk-calendar-panel" aria-label="Calendrier mensuel">
      <div className="lk-calendar-head"><div><span className="lk-kicker">PLANNING</span><h2>{monthName}</h2></div><div className="lk-calendar-nav"><button type="button" className="lk-icon-button" onClick={() => navigate(-1)} aria-label="Mois précédent"><ChevronLeft size={19} /></button><button type="button" className="lk-icon-button" onClick={() => navigate(1)} aria-label="Mois suivant"><ChevronRight size={19} /></button></div></div>
      <div className="lk-weekdays">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
      <div className="lk-days">{Array.from({ length: firstOffset }, (_, index) => <span className="lk-day-blank" key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1
        const date = localDate(new Date(month.getFullYear(), month.getMonth(), day))
        const count = byDate.get(date)?.length || 0
        return <button type="button" key={date} className={`lk-day ${date === selectedDate ? 'lk-day-selected' : ''} ${date === today ? 'lk-day-today' : ''}`} onClick={() => { setSelectedDate(date); setShowForm(false) }} aria-label={`${dateLabel(date)}${count ? `, ${count} tenue${count > 1 ? 's' : ''} prévue${count > 1 ? 's' : ''}` : ''}`} aria-pressed={date === selectedDate}><span>{day}</span>{count > 0 && <small>{count > 1 ? `${count} tenues` : '1 tenue'}</small>}</button>
      })}</div>
      <div className="lk-calendar-legend"><span><i /> Tenue programmée</span><span><b /> Aujourd’hui</span></div>
    </section>
    <aside className="lk-day-panel"><div className="lk-day-heading"><div><span className="lk-kicker">JOUR SÉLECTIONNÉ</span><h2>{dateLabel(selectedDate)}</h2><p>{selected.length ? `${selected.length} tenue${selected.length > 1 ? 's' : ''} programmée${selected.length > 1 ? 's' : ''}` : 'Rien de prévu pour ce jour.'}</p></div><button type="button" className="lk-add-button" onClick={() => setShowForm(!showForm)} aria-label="Programmer une tenue" aria-expanded={showForm}>{showForm ? <X size={18} /> : <Plus size={18} />}</button></div>
      {showForm && (data.outfits.length ? <form className="lk-calendar-form" onSubmit={addSchedule}><label>Tenue<select required value={outfitId} onChange={event => setOutfitId(event.target.value)}><option value="">Choisir une tenue enregistrée</option>{data.outfits.map(outfit => <option key={outfit.id} value={outfit.id}>{outfit.title}{outfit.occasion ? ` · ${outfit.occasion}` : ''} · réf. {outfitRef(outfit)} · {outfit.itemIds.map(id => data.items.find(item => item.id === id)?.name || 'pièce retirée').join(', ')}</option>)}</select></label><label>Note <span>(facultatif)</span><input value={note} onChange={event => setNote(event.target.value)} maxLength={160} placeholder="Ex. dîner entre amis" /></label><button className="lk-button lk-button-dark" type="submit"><Plus size={15} /> Ajouter à cette date</button></form> : <div className="lk-notice">Enregistrez d’abord une tenue dans « Mes tenues » pour la programmer ici.</div>)}
      {selected.length ? <div className="lk-scheduled-list">{selected.map(entry => {
        const outfit = data.outfits.find(item => item.id === entry.outfitId)
        const names = outfit?.itemIds.map(id => data.items.find(item => item.id === id)?.name || 'Pièce indisponible') || []
        return <article className="lk-scheduled-card" key={entry.id}><div className="lk-scheduled-top"><div className="lk-scheduled-icon"><Shirt size={17} /></div><div><span className="lk-kicker">{entry.worn ? 'PORTÉE' : 'À PORTER'}</span><h3>{outfit?.title || 'Tenue indisponible'}</h3><p>{outfit?.occasion || 'Sans occasion précisée'}</p></div></div>{names.length > 0 && <p className="lk-scheduled-pieces">{names.join(' · ')}</p>}{entry.note && <p className="lk-scheduled-note">{entry.note}</p>}<div className="lk-scheduled-actions"><button type="button" className={`lk-worn ${entry.worn ? 'lk-worn-active' : ''}`} onClick={() => toggleWorn(entry)} aria-pressed={entry.worn}><Check size={15} /> {entry.worn ? 'Portée' : 'Marquer portée'}</button><button type="button" className="lk-icon-button lk-delete" onClick={() => deleteSchedule(entry)} aria-label={`Supprimer la planification ${outfit?.title || 'de cette tenue'}`}><Trash2 size={16} /></button></div></article>
      })}</div> : !showForm && <div className="lk-day-empty"><div className="lk-empty-icon"><CalendarDays size={20} /></div><h3>Un jour à imaginer</h3><p>Sélectionnez une tenue enregistrée pour la retrouver à cette date.</p><button type="button" className="lk-text-button" onClick={() => setShowForm(true)}>Programmer une tenue <ArrowDown size={14} /></button></div>}
    </aside></div>
  </div>
}
