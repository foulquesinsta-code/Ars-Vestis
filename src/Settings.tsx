import { useEffect, useRef, useState } from 'react'
import { Check, Download, ShieldCheck, Upload, UserRound, Smartphone, Palette, Sparkles } from 'lucide-react'
import CloudSync from './CloudSync'
import { normalizeData } from './storage'
import { STYLES, type SharedProps } from './types'
import { clearInstallPrompt, getInstallPrompt } from './pwa'

const COLORS = ['Noir', 'Blanc', 'Écru', 'Beige', 'Marron', 'Gris', 'Bleu', 'Vert', 'Rouge', 'Rose']

export default function Settings({ data, update, notify }: SharedProps) {
  const file = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(data.preferences.name)
  const [brands, setBrands] = useState(data.preferences.brands)
  const [location, setLocation] = useState(data.preferences.location)
  const [styles, setStyles] = useState(data.preferences.styles)
  const [colors, setColors] = useState(data.preferences.colors)
  const [theme, setTheme] = useState(data.preferences.theme)
  const [visualStyle, setVisualStyle] = useState(data.preferences.visualStyle || 'liquid')
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)
  useEffect(() => {
    setInstallPrompt(getInstallPrompt())
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); clearInstallPrompt() }
    window.addEventListener('appinstalled', onInstalled)
    return () => window.removeEventListener('appinstalled', onInstalled)
  }, [])
  useEffect(() => {
    setName(data.preferences.name); setBrands(data.preferences.brands); setLocation(data.preferences.location)
    setStyles(data.preferences.styles); setColors(data.preferences.colors); setTheme(data.preferences.theme); setVisualStyle(data.preferences.visualStyle || 'liquid')
  }, [data.preferences])
  const toggle = (values: string[], value: string) => values.includes(value) ? values.filter(item => item !== value) : [...values, value]
  function save(e: React.FormEvent) {
    e.preventDefault()
    update(current => ({ ...current, preferences: { ...current.preferences, name: name.trim(), brands: brands.trim(), location: location.trim(), styles, colors, theme, visualStyle } }))
    notify('Vos préférences ont été enregistrées.')
  }
  function exportBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `ars-vestis-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url)
    notify('Votre sauvegarde a été téléchargée.')
  }
  async function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    try {
      if (selected.size > 40_000_000) throw new Error('Le fichier dépasse 40 Mo.')
      const imported = normalizeData(JSON.parse(await selected.text()))
      if (window.confirm('Restaurer cette sauvegarde remplacera les données présentes sur cet appareil. Continuer ?')) {
        update(() => imported); notify('Sauvegarde restaurée sur cet appareil.')
        setName(imported.preferences.name); setBrands(imported.preferences.brands); setLocation(imported.preferences.location); setStyles(imported.preferences.styles); setColors(imported.preferences.colors)
      }
    } catch (error) { notify(error instanceof Error ? error.message : 'Impossible de lire cette sauvegarde.') }
    e.target.value = ''
  }
  async function installApp() {
    const prompt = getInstallPrompt() as any; if (prompt) { await prompt.prompt(); const choice = await prompt.userChoice; if (choice?.outcome === 'accepted') notify('Installation de l’application lancée.'); setInstallPrompt(null); clearInstallPrompt(); return }
    notify('Sur Android : ouvrez le menu ⋮ du navigateur puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».')
  }
  return <div className="screen settings-screen">
    <div className="section-kicker">VOTRE ESPACE <span> / </span> PERSONNALISATION</div>
    <div className="screen-heading"><div><h1>Tout commence <em>par vous.</em></h1><p>Quelques détails pour faire de cet espace le vôtre.</p></div><div className="heading-icon"><UserRound size={22}/></div></div>
    <div className="settings-grid">
      <form className="glass settings-card" onSubmit={save}>
        <div className="card-heading"><div><span className="mini-label">01 — VOTRE IDENTITÉ</span><h2>Votre profil</h2></div><UserRound size={19}/></div>
        <div className="settings-fields"><label>Prénom ou nom<input value={name} onChange={e => setName(e.target.value)} placeholder="Comment vous appeler ?" maxLength={70}/></label><label>Ville <span>optionnel</span><input value={location} onChange={e => setLocation(e.target.value)} placeholder="Votre ville" maxLength={100}/></label><label>Marques favorites <span>optionnel</span><input value={brands} onChange={e => setBrands(e.target.value)} placeholder="Séparez les marques par une virgule" maxLength={200}/></label></div>
        <div className="preference-block"><h3>Les styles qui vous ressemblent</h3><p>Choisissez-en autant que vous voulez.</p><div className="chip-list">{STYLES.map(style => <button type="button" key={style} className={styles.includes(style) ? 'choice-chip selected' : 'choice-chip'} onClick={() => setStyles(toggle(styles, style))}>{styles.includes(style) && <Check size={12}/>} {style}</button>)}</div></div>
        <div className="preference-block"><h3>Vos couleurs</h3><div className="chip-list">{COLORS.map(color => <button type="button" key={color} className={colors.includes(color) ? 'choice-chip selected' : 'choice-chip'} onClick={() => setColors(toggle(colors, color))}>{colors.includes(color) && <Check size={12}/>} {color}</button>)}</div></div>
        <button className="button button-dark" type="submit">Enregistrer mes préférences</button>
      </form>
      <div className="settings-side"><div className="glass settings-card appearance-card"><div className="card-heading"><div><span className="mini-label">02 — APPARENCE</span><h2>Votre univers visuel</h2></div><Palette size={21}/></div><div className="preference-block"><h3>Thème</h3><div className="appearance-options">{([{id:'clair',label:'Clair'},{id:'sombre',label:'Sombre'},{id:'systeme',label:'Automatique'}] as const).map(option => <button type="button" key={option.id} className={theme === option.id ? 'appearance-choice selected' : 'appearance-choice'} onClick={() => setTheme(option.id)}>{option.label}{theme === option.id && <Check size={13}/>}</button>)}</div></div><div className="preference-block"><h3>Style de l’interface</h3><div className="appearance-options">{([{id:'liquid',label:'Liquid Glass'},{id:'classique',label:'Éditorial'},{id:'minimal',label:'Minimal'}] as const).map(option => <button type="button" key={option.id} className={visualStyle === option.id ? 'appearance-choice selected' : 'appearance-choice'} onClick={() => setVisualStyle(option.id)}>{option.label}{visualStyle === option.id && <Check size={13}/>}</button>)}</div></div><p className="appearance-hint">Enregistrez vos préférences pour appliquer le thème à toute l’application.</p><button className="button button-dark" type="button" onClick={() => { update(current => ({ ...current, preferences: { ...current.preferences, theme, visualStyle } })); notify('Apparence mise à jour.') }}><Sparkles size={15}/> Appliquer l’apparence</button></div><div className="glass settings-card install-card"><div className="card-heading"><div><span className="mini-label">03 — APPLICATION</span><h2>Emportez votre dressing.</h2></div><Smartphone size={21}/></div><p>Installez ARS VESTIS sur votre téléphone comme une application, avec son icône et une ouverture en plein écran. Gratuit, sans passer par un store.</p><button className="button button-dark" type="button" onClick={installApp}><Download size={15}/> {installed ? 'Application installée' : 'Installer ARS VESTIS'}</button><small>{installPrompt ? 'Votre navigateur permet l’installation directe.' : 'Si le bouton ne déclenche rien : menu ⋮ du navigateur → Installer l’application / Ajouter à l’écran d’accueil.'}</small></div><CloudSync data={data} update={update} notify={notify}/><div className="glass settings-card backup-card"><div className="card-heading"><div><span className="mini-label">VOS DONNÉES</span><h2>Vous gardez le contrôle.</h2></div><ShieldCheck size={21}/></div><p>Sans synchronisation, votre dressing reste sur cet appareil. Exportez régulièrement une copie : effacer les données du navigateur peut aussi effacer votre dressing.</p><div className="backup-actions"><button className="button button-light" type="button" onClick={exportBackup}><Download size={15}/> Exporter mes données</button><button className="button button-ghost" type="button" onClick={() => file.current?.click()}><Upload size={15}/> Importer une sauvegarde</button><input hidden ref={file} type="file" accept="application/json,.json" onChange={importBackup}/></div></div></div>
    </div>
  </div>
}
