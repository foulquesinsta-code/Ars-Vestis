import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, CircleHelp, Heart, Home as HomeIcon, Layers2, Plus, Search, Share2, Shield, ShoppingBag, Sparkles, UserRound, WandSparkles } from 'lucide-react'
import Wardrobe from './Wardrobe'
import { Calendar, Looks, shareOutfit } from './Looks'
import Catalog from './Catalog'
import Settings from './Settings'
import Studio from './Studio'
import { readData, writeData } from './storage'
import { emptyData, type AppData, type SharedProps } from './types'
import { captureInstallPrompt } from './pwa'

type Page = 'home' | 'wardrobe' | 'looks' | 'calendar' | 'catalog' | 'discover' | 'profile' | 'studio'
const nav: Array<{ id: Page; title: string; icon: typeof HomeIcon }> = [
  { id: 'home', title: 'Accueil', icon: HomeIcon },
  { id: 'looks', title: 'Mes tenues', icon: Sparkles },
  { id: 'studio', title: 'Studio d’essayage', icon: WandSparkles },
  { id: 'wardrobe', title: 'Mon dressing', icon: Layers2 },
  { id: 'calendar', title: 'Calendrier', icon: CalendarDays },
  { id: 'catalog', title: 'Catalogue', icon: ShoppingBag },
  { id: 'discover', title: 'Découvrir', icon: BookOpen },
  { id: 'profile', title: 'Mon profil', icon: UserRound },
]

function Logo({ small = false }: { small?: boolean }) {
  return <div className={small ? 'brand brand-small' : 'brand'}><div className="brand-icon"><img src="/brand.svg" alt=""/></div><div className="brand-copy"><strong>ARS VESTIS</strong><span>VOTRE STYLE, À VOTRE FAÇON</span></div></div>
}

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [data, setData] = useState<AppData>(emptyData)
  const [loaded, setLoaded] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [readError, setReadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const queue = useRef<Promise<void>>(Promise.resolve())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => { const onInstall = (event: Event) => captureInstallPrompt(event); window.addEventListener('beforeinstallprompt', onInstall); return () => window.removeEventListener('beforeinstallprompt', onInstall) }, [])
  useEffect(() => { readData().then(setData).catch(() => { setReadError(true); setStorageError('Impossible de lire vos données sur cet appareil. Vérifiez les paramètres du navigateur avant de réessayer.') }).finally(() => setLoaded(true)) }, [])
  useEffect(() => {
    if (!loaded || storageError) return
    setSaving(true)
    queue.current = queue.current.then(() => writeData(data)).then(() => setSaving(false)).catch(() => { setSaving(false); setStorageError('Impossible d’enregistrer les dernières modifications sur cet appareil. Exportez vos données dans Profil.') })
  }, [data, loaded, storageError])
  const update = useCallback((fn: (current: AppData) => AppData) => setData(current => fn(current)), [])
  const notify = useCallback((message: string) => { setToast(storageError ? 'Modification en mémoire uniquement. Exportez vos données et réessayez la sauvegarde.' : message); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 3500) }, [storageError])
  const go = (next: Page) => { setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const props: SharedProps = { data, update, notify }
  useEffect(() => {
    const prefs = data.preferences
    document.documentElement.dataset.theme = prefs.theme === 'systeme' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair') : prefs.theme
    document.documentElement.dataset.visualStyle = prefs.visualStyle || 'classique'
  }, [data.preferences.theme, data.preferences.visualStyle])
  const activeTitle = nav.find(item => item.id === page)?.title || 'Accueil'
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  if (!loaded) return <div className="loading-screen"><Logo/><div className="loading-line"/><p>Préparation de votre espace…</p></div>
  if (readError) return <div className="loading-screen"><Logo/><p role="alert">{storageError}</p><button className="button button-dark" onClick={() => { void readData().then(value => { setData(value); setReadError(false); setStorageError('') }).catch(() => setStorageError('La lecture reste impossible. Vérifiez l’accès au stockage du navigateur.')) }}>Réessayer la lecture</button></div>

  return <div className="app-shell">
    <aside className="sidebar">
      <Logo/>
      <div className="sidebar-rule"/>
      <span className="side-label">VOTRE ESPACE</span>
      <nav className="side-nav" aria-label="Navigation principale">{nav.slice(0, 6).map(({ id, title, icon: Icon }) => <button key={id} className={page === id ? 'side-link active' : 'side-link'} onClick={() => go(id)}><Icon size={18} strokeWidth={1.5}/><span>{title}</span>{page === id && <span className="active-indicator"/>}</button>)}</nav>
      <span className="side-label inspiration-label">L’UNIVERS ARS VESTIS</span>
      <nav className="side-nav"><button className={page === 'discover' ? 'side-link active' : 'side-link'} onClick={() => go('discover')}><BookOpen size={18} strokeWidth={1.5}/><span>Découvrir</span></button><button className={page === 'profile' ? 'side-link active' : 'side-link'} onClick={() => go('profile')}><UserRound size={18} strokeWidth={1.5}/><span>Mon profil</span></button></nav>
      <div className="sidebar-end"><div className="sidebar-quote"><span>LA NOTE ARS VESTIS</span><p>Posséder moins.<br/><em>Imaginer plus.</em></p><span className="quote-rule"/></div><button className="sidebar-profile" onClick={() => go('profile')}><div className="avatar">{data.preferences.name ? data.preferences.name.charAt(0).toUpperCase() : <UserRound size={16}/>}</div><div><b>{data.preferences.name || 'Votre espace'}</b><span>{saving ? 'Enregistrement…' : 'Espace personnel'}</span></div><ChevronRight size={16}/></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="mobile-brand"><Logo small/></div><div className="desktop-crumb">VOTRE ESPACE <span> / </span> <b>{activeTitle.toUpperCase()}</b></div><div className="topbar-right"><span className="date-label">{date}</span><button className="top-profile" onClick={() => go('profile')} aria-label="Ouvrir mon profil">{data.preferences.name ? data.preferences.name.charAt(0).toUpperCase() : <UserRound size={17}/>}</button></div></header>
      {storageError && <div className="storage-warning" role="alert">{storageError} <button onClick={() => setStorageError('')}>Réessayer la sauvegarde</button></div>}
      {page === 'home' && <Dashboard data={data} go={go}/>}
      {page === 'wardrobe' && <Wardrobe {...props}/>}
      {page === 'studio' && <Studio {...props}/>}
      {page === 'looks' && <Looks {...props}/>}
      {page === 'calendar' && <Calendar {...props}/>}
      {page === 'catalog' && <Catalog {...props}/>}
      {page === 'discover' && <Discover go={go} data={data} notify={notify}/>}
      {page === 'profile' && <Settings {...props}/>}
      <footer className="app-footer"><span>ARS VESTIS <i>©</i> {new Date().getFullYear()}</span><span>LE STYLE EST UNE HISTOIRE PERSONNELLE.</span><button onClick={() => go('profile')}><Shield size={12}/> Confidentialité & données</button></footer>
    </main>
    <nav className="mobile-nav" aria-label="Navigation mobile">{nav.filter(({ id }) => id !== 'discover' && id !== 'catalog').map(({ id, title, icon: Icon }) => <button key={id} className={page === id ? 'mobile-link active' : 'mobile-link'} onClick={() => go(id)}><Icon size={20} strokeWidth={1.6}/><span>{title === 'Mon dressing' ? 'Dressing' : title === 'Mes tenues' ? 'Tenues' : title === 'Studio d’essayage' ? 'Studio' : title === 'Mon profil' ? 'Profil' : title}</span></button>)}</nav>
    {toast && <div className="toast" role="status">{storageError ? <CircleHelp size={15}/> : <Check size={15}/>} {toast}</div>}
  </div>
}

function Dashboard({ data, go }: { data: AppData; go: (page: Page) => void }) {
  const firstName = data.preferences.name.trim().split(' ')[0]
  const recent = [...data.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3)
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const upcoming = data.schedules.filter(s => !s.worn && s.date >= today)
  const next = [...upcoming].sort((a, b) => a.date.localeCompare(b.date))[0]
  const nextOutfit = next && data.outfits.find(o => o.id === next.outfitId)
  return <div className="screen dashboard">
      <div className="dashboard-heading"><div><span className="section-kicker">VOTRE UNIVERS PERSONNEL <span> / </span> 01</span><h1>{firstName ? `Bonjour, ${firstName}.` : 'Votre style, à votre façon.'}</h1><p>Un espace pensé autour de ce que vous aimez porter.</p></div><button className="button button-light compact" onClick={() => go('looks')}><Sparkles size={16}/> Composer un look</button></div>
    <section className="hero-panel"><div className="hero-copy"><div className="hero-topline"><span className="eyebrow-bronze">THE PERSONAL WARDROBE</span><span>01 / 03</span></div><div className="hero-title-wrap"><div className="hero-rule"/><h2>Votre dressing.<br/><em>Vos possibilités.</em></h2><p>Redécouvrez ce que vous possédez déjà et imaginez de nouvelles façons de le porter.</p><button className="button button-dark" onClick={() => go('looks')}>Composer une tenue <ArrowRight size={16}/></button></div><div className="hero-bottom"><span>UNE ALLURE QUI VOUS RESSEMBLE</span><ArrowDown size={15}/></div></div><div className="hero-visual"><img src="/assets/wardrobe-editorial.jpg" alt="Dressing aux tons naturels"/><div className="image-shade"/><div className="hero-image-label"><div className="tiny-sparkle"><Sparkles size={16}/></div><div><span>LE DRESSING</span><b>En toute simplicité.</b></div></div><div className="hero-image-mark">AV</div></div></section>
    <div className="dashboard-columns"><section className="summary-section"><div className="block-header"><div><span className="section-kicker">EN UN COUP D’ŒIL</span><h2>Votre univers</h2></div><button className="text-action" onClick={() => go('wardrobe')}>Explorer <ArrowRight size={15}/></button></div><div className="summary-grid"><button className="glass metric-card" onClick={() => go('wardrobe')}><div className="metric-icon"><Layers2 size={17}/></div><strong>{String(data.items.length).padStart(2, '0')}</strong><span>pièces dans votre dressing</span><ChevronRight size={16}/></button><button className="glass metric-card" onClick={() => go('looks')}><div className="metric-icon"><Sparkles size={17}/></div><strong>{String(data.outfits.length).padStart(2, '0')}</strong><span>tenues enregistrées</span><ChevronRight size={16}/></button><button className="glass metric-card" onClick={() => go('calendar')}><div className="metric-icon"><CalendarDays size={17}/></div><strong>{String(upcoming.length).padStart(2, '0')}</strong><span>tenues à venir</span><ChevronRight size={16}/></button></div></section><section className="glass next-card"><span className="section-kicker">VOTRE PROCHAIN LOOK</span><div className="next-icon"><CalendarDays size={19}/></div><h2>{nextOutfit ? nextOutfit.title : 'L’inspiration se prépare.'}</h2><p>{next && nextOutfit ? `${new Date(`${next.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${next.note ? ` · ${next.note}` : ''}` : 'Planifiez votre prochaine tenue, à votre rythme.'}</p><button className="text-action" onClick={() => go('calendar')}>Ouvrir le calendrier <ArrowRight size={15}/></button></section></div>
    <section className="recent-section"><div className="block-header"><div><span className="section-kicker">VOTRE COLLECTION</span><h2>Les pièces de votre dressing</h2></div><button className="text-action" onClick={() => go('wardrobe')}>Tout voir <ArrowRight size={15}/></button></div>{recent.length ? <div className="recent-grid">{recent.map(item => <button className="recent-item glass" onClick={() => go('wardrobe')} key={item.id}><div className="recent-image">{item.image ? <img src={item.image} alt=""/> : <Layers2 size={26}/>}</div><div><span>{item.category}</span><strong>{item.name}</strong><small>{[item.color, item.brand].filter(Boolean).join(' · ') || 'Votre pièce'}</small></div><ChevronRight size={15}/></button>)}</div> : <div className="empty-dashboard glass"><div className="empty-symbol"><Plus size={22}/></div><div><h3>Une belle histoire commence ici.</h3><p>Ajoutez votre première pièce pour créer votre dressing personnel.</p></div><button className="button button-dark" onClick={() => go('wardrobe')}>Créer mon dressing <ArrowRight size={15}/></button></div>}</section>
  </div>
}

function Discover({ go, data, notify }: { go: (page: Page) => void; data: AppData; notify: (message: string) => void }) {
  const [term, setTerm] = useState('')
  const search = (e: React.FormEvent) => { e.preventDefault(); if (term.trim()) window.open(`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(term.trim())}`, '_blank', 'noopener,noreferrer') }
  const lookbook = data.outfits.slice(0, 3)
  return <div className="screen discover-screen"><span className="section-kicker">L’UNIVERS ARS VESTIS</span><div className="screen-heading"><div><h1>L’art de <em>bien choisir.</em></h1><p>Un peu d’inspiration pour composer avec intention.</p></div></div><div className="discover-grid"><div className="discover-intro glass"><span className="mini-label">À LA RECHERCHE D’UNE PIÈCE ?</span><h2>Une idée, un nom,<br/><em>une découverte.</em></h2><p>Recherchez une marque ou une référence sur le web. Les résultats s’ouvrent sur un service externe ; vous pouvez ajouter vos propres pièces au dressing.</p><form onSubmit={search} className="discover-search"><Search size={18}/><input value={term} onChange={e => setTerm(e.target.value)} placeholder="Marque, modèle, couleur…"/><button type="submit" aria-label="Rechercher sur le web"><ArrowRight size={18}/></button></form><small>Recherche externe · les produits ne sont pas vérifiés par ARS VESTIS.</small></div><div className="glass editorial-note"><div className="note-orbit"><WandSparkles size={22}/></div><span className="mini-label">VOTRE STYLISTE PERSONNEL</span><h2>Le beau commence<br/><em>par l’essentiel.</em></h2><p>Associez vos propres vêtements dans l’atelier de composition. Un assistant conversationnel IA pourra être activé lorsqu’un fournisseur réellement gratuit et disponible sera connecté.</p><button className="text-action" onClick={() => go('looks')}>Aller à l’atelier <ArrowRight size={15}/></button></div></div><section className="discover-lookbook glass" aria-labelledby="discover-lookbook-title"><div className="discover-lookbook-head"><div><span className="mini-label">VOTRE CARNET DE PARTAGE</span><h2 id="discover-lookbook-title">Des looks à <em>envoyer.</em></h2><p>Partagez une tenue avec vos proches depuis les applications de votre appareil. Rien n’est publié publiquement sans compte.</p></div><button className="text-action" onClick={() => go('looks')}>Créer un look <ArrowRight size={15}/></button></div>{lookbook.length ? <div className="discover-lookbook-list">{lookbook.map(outfit => <article className="discover-lookbook-item" key={outfit.id}><div><strong>{outfit.title}</strong><span>{outfit.itemIds.length} pièce{outfit.itemIds.length > 1 ? 's' : ''}{outfit.occasion ? ` · ${outfit.occasion}` : ''}</span></div><button type="button" onClick={() => void shareOutfit(outfit, data.items, notify)} aria-label={`Partager ${outfit.title}`}><Share2 size={15}/> Partager</button></article>)}</div> : <div className="discover-lookbook-empty"><Sparkles size={17}/><span>Enregistrez votre premier look pour construire votre carnet de partage.</span><button className="text-action" onClick={() => go('looks')}>Ouvrir l’atelier <ArrowRight size={14}/></button></div>}</section><div className="discover-help"><CircleHelp size={17}/><span>Les comptes, publications publiques et interactions communautaires restent à connecter ; aucun faux fil social n’est affiché.</span><Heart size={15}/></div></div>
}
