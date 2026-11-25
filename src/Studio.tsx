import { useMemo, useState } from 'react'
import { Check, RotateCcw, Sparkles, UserRound, WandSparkles, BrainCircuit, Save, RefreshCw } from 'lucide-react'
import { makeId, type Category, type Item, type SharedProps } from './types'
import { makeItemSets } from './looks-engine'
import './studio.css'

type Slot = 'top' | 'bottom' | 'outer' | 'shoes' | 'accessory'
const slots: Array<{ id: Slot; title: string; categories: Category[] }> = [
  { id: 'top', title: 'Haut', categories: ['Hauts', 'Chemises & polos', 'Pulls', 'Robes & ensembles'] },
  { id: 'bottom', title: 'Bas', categories: ['Pantalons & jeans'] },
  { id: 'outer', title: 'Veste', categories: ['Vestes & manteaux'] },
  { id: 'shoes', title: 'Chaussures', categories: ['Chaussures'] },
  { id: 'accessory', title: 'Accessoire', categories: ['Accessoires'] },
]

export default function Studio({ data, update, notify }: SharedProps) {
  const [selected, setSelected] = useState<Partial<Record<Slot, string>>>({})
  const [avatar, setAvatar] = useState<'classique' | 'silhouette' | 'croquis'>('classique')
  const [season, setSeason] = useState('Toutes saisons')
  const [weather, setWeather] = useState('Doux')
  const [suggestions, setSuggestions] = useState<Item[][]>([])
  const [activeSuggestion, setActiveSuggestion] = useState(0)
  const pieces = useMemo(() => slots.map(slot => ({ ...slot, item: data.items.find(item => item.id === selected[slot.id]) })), [data.items, selected])
  const completeCount = Object.values(selected).filter(Boolean).length
  const choose = (slot: Slot, id: string) => setSelected(current => ({ ...current, [slot]: current[slot] === id ? undefined : id }))
  const reset = () => { setSelected({}); setSuggestions([]); notify('Le studio a été réinitialisé.') }
  const generateLooks = () => {
    if (data.items.length < 2) { notify('Ajoutez au moins deux vêtements dans votre dressing pour lancer le styliste.'); return }
    const results = makeItemSets(data.items, { season, weather }, { styles: data.preferences.styles, colors: data.preferences.colors })
    setSuggestions(results); setActiveSuggestion(0)
    if (results[0]) applySuggestion(results[0])
    notify(results.length ? `${results.length} propositions créées par votre styliste local.` : 'Ajoutez davantage de pièces pour obtenir des propositions.')
  }
  const applySuggestion = (items: Item[]) => {
    const next: Partial<Record<Slot, string>> = {}
    for (const item of items) {
      if (['Hauts', 'Chemises & polos', 'Pulls', 'Robes & ensembles'].includes(item.category)) next.top = item.id
      else if (item.category === 'Pantalons & jeans') next.bottom = item.id
      else if (item.category === 'Vestes & manteaux') next.outer = item.id
      else if (item.category === 'Chaussures') next.shoes = item.id
      else if (item.category === 'Accessoires') next.accessory = item.id
    }
    setSelected(next)
  }
  const saveSuggestion = () => {
    const items = suggestions[activeSuggestion]
    if (!items?.length) return
    const title = `Suggestion du styliste · ${new Date().toLocaleDateString('fr-FR')}`
    update(current => ({ ...current, outfits: [{ id: makeId(), title, itemIds: items.map(item => item.id), occasion: 'Suggestion du styliste local', notes: 'Composition proposée à partir des couleurs, styles et saisons renseignés dans le dressing.', favorite: false, createdAt: new Date().toISOString() }, ...current.outfits] }))
    notify('Tenue enregistrée dans Mes tenues.')
  }
  return <div className="screen studio-screen">
    <div className="section-kicker">ARS VESTIS <span> / </span> STUDIO CRÉATIF</div>
    <div className="screen-heading"><div><h1>Votre cabine <em>d’essayage.</em></h1><p>Assemblez les pièces de votre dressing et composez un look en quelques instants.</p></div><div className="heading-icon"><WandSparkles size={22}/></div></div>
    <div className="studio-layout">
      <section className="glass studio-preview-card">
        <div className="studio-card-head"><div><span className="mini-label">APERÇU DE LA TENUE</span><h2>Votre mannequin</h2></div><span className="studio-count">{completeCount} / 5 pièces</span></div>
        <div className={`mannequin-stage mannequin-${avatar}`}>
          <div className="mannequin-watermark">AV</div>
          <svg className="mannequin-base" viewBox="0 0 240 480" role="img" aria-label="Silhouette neutre de mannequin">
            <circle cx="120" cy="48" r="30"/><path d="M103 80h34l8 30-25 20-25-20z"/><path d="M82 116q38-20 76 0l22 120-23 24h-74l-23-24z"/><path d="M60 128 35 250l16 8 42-104M180 128l25 122-16 8-42-104"/><path d="m82 260 76 0-7 116-24 0-7-92-7 92h-24z"/><path d="m103 376-8 78h-24l13-78m51 0 13 78h24l-13-78"/>
          </svg>
          <div className="garment-layer garment-outer">{pieces.find(p => p.id === 'outer')?.item?.image && <img src={pieces.find(p => p.id === 'outer')!.item!.image} alt="Veste sélectionnée"/>}</div>
          <div className="garment-layer garment-top">{pieces.find(p => p.id === 'top')?.item?.image && <img src={pieces.find(p => p.id === 'top')!.item!.image} alt="Haut sélectionné"/>}</div>
          <div className="garment-layer garment-bottom">{pieces.find(p => p.id === 'bottom')?.item?.image && <img src={pieces.find(p => p.id === 'bottom')!.item!.image} alt="Bas sélectionné"/>}</div>
          <div className="garment-layer garment-shoes">{pieces.find(p => p.id === 'shoes')?.item?.image && <img src={pieces.find(p => p.id === 'shoes')!.item!.image} alt="Chaussures sélectionnées"/>}</div>
          <div className="garment-layer garment-accessory">{pieces.find(p => p.id === 'accessory')?.item?.image && <img src={pieces.find(p => p.id === 'accessory')!.item!.image} alt="Accessoire sélectionné"/>}</div>
        </div>
        <div className="studio-avatar-options"><span>Style du mannequin</span>{(['classique', 'silhouette', 'croquis'] as const).map(value => <button key={value} className={avatar === value ? 'active' : ''} onClick={() => setAvatar(value)}>{value === 'classique' ? 'Classique' : value === 'silhouette' ? 'Silhouette' : 'Croquis'}</button>)}</div>
        <div className="studio-preview-note"><Sparkles size={15}/> Aperçu de composition : les photos sont superposées visuellement, sans transformation IA ni simulation de coupe.</div>
      </section>
      <section className="studio-builder">
        <div className="studio-builder-head"><div><span className="mini-label">COMPOSITION</span><h2>Construire le look</h2></div><button className="studio-reset" onClick={reset}><RotateCcw size={14}/> Réinitialiser</button></div>
        <section className="studio-local-ai glass">
          <div className="local-ai-heading"><span className="ai-orb"><BrainCircuit size={20}/></span><div><span className="mini-label">ARS VESTIS INTELLIGENCE</span><h3>Votre styliste personnel</h3><p>Un moteur de recommandation créé pour ARS VESTIS. Il fonctionne directement dans votre navigateur, sans compte IA, clé API ni abonnement.</p></div></div>
          <div className="local-ai-controls"><label>Saison<select value={season} onChange={e => setSeason(e.target.value)}><option>Toutes saisons</option><option>Printemps</option><option>Été</option><option>Automne</option><option>Hiver</option></select></label><label>Météo<select value={weather} onChange={e => setWeather(e.target.value)}><option>Doux</option><option>Chaud</option><option>Frais</option><option>Froid</option><option>Pluie</option></select></label><button className="button button-dark" onClick={generateLooks}><Sparkles size={15}/> Générer des tenues</button></div>
          {suggestions.length > 0 && <div className="local-ai-results"><div className="local-ai-result-tabs">{suggestions.map((_, index) => <button key={index} className={activeSuggestion === index ? 'active' : ''} onClick={() => { setActiveSuggestion(index); applySuggestion(suggestions[index]) }}>Proposition {index + 1}</button>)}</div><div className="local-ai-result-copy"><strong>{suggestions[activeSuggestion].map(item => item.name).join(' · ')}</strong><span>{suggestions[activeSuggestion].map(item => item.color).filter(Boolean).join(' / ') || 'Palette à compléter'}{data.preferences.styles.length ? ` · Vos styles : ${data.preferences.styles.slice(0, 3).join(', ')}` : ''}</span><p>La proposition privilégie les pièces disponibles, vos préférences de couleurs et de styles, ainsi que la saison et la météo sélectionnées. Les informations manquantes restent neutres : le moteur ne prétend pas reconnaître ce qui n’est pas renseigné.</p></div><button className="button button-light compact" onClick={saveSuggestion}><Save size={14}/> Enregistrer cette tenue</button><button className="local-ai-refresh" onClick={generateLooks}><RefreshCw size={14}/> Autres idées</button></div>}
        </section>
        {slots.map(slot => {
          const available = data.items.filter(item => slot.categories.includes(item.category))
          const current = data.items.find(item => item.id === selected[slot.id])
          return <div className="studio-slot" key={slot.id}><div className="studio-slot-head"><strong>{slot.title}</strong><span>{current ? current.name : `${available.length} pièce${available.length > 1 ? 's' : ''}`}</span></div>
            {available.length ? <div className="studio-items">{available.map(item => <button key={item.id} className={selected[slot.id] === item.id ? 'studio-item selected' : 'studio-item'} onClick={() => choose(slot.id, item.id)} aria-pressed={selected[slot.id] === item.id}><span className="studio-item-image">{item.image ? <img src={item.image} alt=""/> : <UserRound size={18}/>}</span><span>{item.name}</span>{selected[slot.id] === item.id && <Check size={14}/>}</button>)}</div> : <p className="studio-empty">Aucune pièce dans cette catégorie. Ajoutez-en dans votre dressing.</p>}
          </div>
        })}
        <div className="studio-ai-note"><Sparkles size={17}/><div><strong>Intelligence locale et confidentialité</strong><p>Le styliste analyse les catégories, couleurs, matières, styles et saisons renseignés pour proposer des associations variées. Tout est calculé sur votre appareil : aucune photo ni donnée n'est envoyée à un service externe. Ce moteur est une IA de recommandation légère, pas un modèle génératif : il ne transforme pas encore les photos pour simuler fidèlement le tombé d'un vêtement sur un corps.</p></div></div>
      </section>
    </div>
  </div>
}
