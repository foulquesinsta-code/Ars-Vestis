import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { CATEGORIES, makeId, SEASONS, STYLES } from './types'
import type { Category, Item, SharedProps } from './types'
import './wardrobe.css'

type IconName = 'plus' | 'search' | 'heart' | 'camera' | 'upload' | 'close' | 'hanger' | 'edit' | 'trash' | 'image' | 'arrow'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></>,
    heart: <path d="M20.5 9c0 4.9-8.5 10-8.5 10S3.5 13.9 3.5 9a4.6 4.6 0 0 1 8.5-2.5A4.6 4.6 0 0 1 20.5 9Z" />,
    camera: <><path d="M4 7h3l1.4-2h7.2L17 7h3v11H4z" /><circle cx="12" cy="12.5" r="3.2" /></>,
    upload: <><path d="M12 15V4m-4 4 4-4 4 4M5 15v4h14v-4" /></>,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    hanger: <path d="M9.5 6.5a2.5 2.5 0 1 1 5 0c0 1.5-2.5 2-2.5 3.5v.5l8 5a1.5 1.5 0 0 1-.8 2.8H4.8a1.5 1.5 0 0 1-.8-2.8l8-5" />,
    edit: <><path d="m4 20 4.2-.8L19 8.4l-3.4-3.4L4.8 15.8 4 20ZM14.5 6.1l3.4 3.4" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></>,
    image: <><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="8.5" cy="9" r="1.4" /><path d="m4 17 5-5 3.5 3 2.5-2 5 4" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

type Draft = {
  name: string
  category: Category | ''
  color: string
  material: string
  brand: string
  season: string
  style: string
  notes: string
  image: string
  imageBack: string
}

const emptyDraft = (): Draft => ({ name: '', category: '', color: '', material: '', brand: '', season: '', style: '', notes: '', image: '', imageBack: '' })
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim()
const MAX_SOURCE_BYTES = 15 * 1024 * 1024
// A conservative per-photo ceiling for browser storage; the application's total quota may be lower.
const MAX_DATA_URL_LENGTH = 750_000

export default function Wardrobe({ data, update, notify }: SharedProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'Toutes'>('Toutes')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [imageError, setImageError] = useState('')
  const [formError, setFormError] = useState('')
  const [readingImage, setReadingImage] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const backGalleryRef = useRef<HTMLInputElement>(null)
  const backCameraRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraRequestRef = useRef(0)
  const readToken = useRef(0)

  const filtered = useMemo(() => {
    const needle = normalize(query)
    return data.items.filter(item => {
      const matchesCategory = category === 'Toutes' || item.category === category
      const matchesFavorite = !onlyFavorites || item.favorite
      const searchable = [item.name, item.color, item.brand, item.material, item.style].join(' ')
      return matchesCategory && matchesFavorite && (!needle || normalize(searchable).includes(needle))
    })
  }, [data.items, category, onlyFavorites, query])

  const favoriteCount = data.items.filter(item => item.favorite).length
  const hasFilters = Boolean(query.trim()) || category !== 'Toutes' || onlyFavorites

  function closeModal() {
    readToken.current += 1
    stopCamera()
    setModalOpen(false)
    setReadingImage(false)
    setImageError('')
    setFormError('')
  }

  function stopCamera() {
    cameraRequestRef.current += 1
    cameraStreamRef.current?.getTracks().forEach(track => track.stop())
    cameraStreamRef.current = null
    setCameraOpen(false)
    setCameraError('')
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setCameraError('La caméra directe n’est pas disponible dans ce contexte. Utilisez le bouton « Choisir une photo ».')
      setCameraOpen(true)
      return
    }
    setCameraError('')
    const request = ++cameraRequestRef.current
    setCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1600 }, height: { ideal: 1600 } },
        audio: false,
      })
      if (cameraRequestRef.current !== request) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      cameraStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      cameraStreamRef.current?.getTracks().forEach(track => track.stop())
      cameraStreamRef.current = null
      setCameraError('Autorisez l’accès à la caméra puis réessayez, ou utilisez une photo déjà présente sur votre appareil.')
    }
  }

  async function captureCameraPhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('La caméra n’est pas encore prête. Patientez une seconde puis réessayez.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Impossible de préparer la capture sur cet appareil.')
      return
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) {
      setCameraError('Impossible d’enregistrer cette photo. Essayez à nouveau.')
      return
    }
    stopCamera()
    readPhoto(new File([blob], `ars-vestis-${Date.now()}.jpg`, { type: 'image/jpeg' }))
  }

  useEffect(() => {
    if (!modalOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const firstField = dialogRef.current?.querySelector<HTMLInputElement>('[name="wd-name"]')
    firstField?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        readToken.current += 1
        setModalOpen(false)
        setReadingImage(false)
        setImageError('')
        setFormError('')
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]')).filter(element => element.tabIndex >= 0 && element.offsetParent !== null)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [modalOpen])

  useEffect(() => () => { readToken.current += 1; stopCamera() }, [])

  function openNew() {
    readToken.current += 1
    stopCamera()
    setEditingId(null)
    setDraft(emptyDraft())
    setImageError('')
    setFormError('')
    setReadingImage(false)
    setModalOpen(true)
  }

  function openEdit(item: Item) {
    readToken.current += 1
    stopCamera()
    setEditingId(item.id)
    setDraft({ name: item.name, category: item.category, color: item.color, material: item.material, brand: item.brand, season: item.season, style: item.style, notes: item.notes, image: item.image || '', imageBack: item.imageBack || '' })
    setImageError('')
    setFormError('')
    setReadingImage(false)
    setModalOpen(true)
  }

  function readPhoto(file: File, side: 'front' | 'back' = 'front') {
    const token = ++readToken.current
    setImageError('')
    if (!file.type.startsWith('image/')) {
      setReadingImage(false)
      setImageError('Choisissez un fichier image compatible.')
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setReadingImage(false)
      setImageError('Cette photo dépasse 15 Mo. Choisissez un fichier plus léger.')
      return
    }
    setReadingImage(true)
    const fail = (message: string) => {
      if (readToken.current !== token) return
      setReadingImage(false)
      setImageError(message)
    }
    const reader = new FileReader()
    reader.onerror = () => fail('Impossible de lire cette photo. Essayez un autre fichier.')
    reader.onabort = () => fail('La lecture de la photo a été interrompue.')
    reader.onload = () => {
      if (readToken.current !== token) return
      if (typeof reader.result !== 'string') return fail('Impossible de lire cette photo.')
      const photo = new Image()
      photo.onerror = () => fail('Ce format d’image ne peut pas être ouvert sur cet appareil.')
      photo.onload = () => {
        if (readToken.current !== token) return
        try {
          if (!photo.naturalWidth || !photo.naturalHeight) throw new Error('Image vide')
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Canvas indisponible')
          let scale = Math.min(1, 1600 / Math.max(photo.naturalWidth, photo.naturalHeight))
          let result = ''
          for (let attempt = 0; attempt < 8; attempt += 1) {
            canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale))
            canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale))
            context.fillStyle = '#ffffff'
            context.fillRect(0, 0, canvas.width, canvas.height)
            context.drawImage(photo, 0, 0, canvas.width, canvas.height)
            const quality = Math.max(0.56, 0.82 - (attempt % 3) * 0.12)
            result = canvas.toDataURL('image/jpeg', quality)
            if (result.length <= MAX_DATA_URL_LENGTH) break
            if (attempt % 3 === 2) scale *= 0.75
          }
          if (!result.startsWith('data:image/') || result.length > MAX_DATA_URL_LENGTH) throw new Error('Photo trop volumineuse')
          setDraft(current => ({ ...current, [side === 'front' ? 'image' : 'imageBack']: result }))
          setReadingImage(false)
        } catch {
          fail('Impossible de préparer cette photo. Essayez une autre image.')
        }
      }
      photo.src = reader.result
    }
    try { reader.readAsDataURL(file) } catch { fail('Impossible de lire cette photo. Essayez un autre fichier.') }
  }

  function importFromHeader(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    openNew()
    readPhoto(file)
  }

  function importInForm(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) {
      stopCamera()
      readPhoto(file)
    }
  }


  function importBackPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) readPhoto(file, 'back')
  }

  function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.name.trim()) {
      setFormError('Indiquez le nom de la pièce.')
      return
    }
    if (!draft.category || readingImage) return
    setFormError('')
    const values = {
      name: draft.name.trim(), category: draft.category, color: draft.color.trim(), material: draft.material.trim(),
      brand: draft.brand.trim(), season: draft.season.trim(), style: draft.style.trim(), notes: draft.notes.trim(),
      image: draft.image || undefined, imageBack: draft.imageBack || undefined,
    }
    if (editingId) {
      update(current => ({ ...current, items: current.items.map(item => item.id === editingId ? { ...item, ...values } : item) }))
      notify('Pièce mise à jour.')
    } else {
      const item: Item = { ...values, id: makeId(), favorite: false, createdAt: new Date().toISOString() }
      update(current => ({ ...current, items: [item, ...current.items] }))
      notify('Pièce ajoutée au dressing.')
    }
    closeModal()
  }

  function toggleFavorite(item: Item) {
    update(current => ({ ...current, items: current.items.map(piece => piece.id === item.id ? { ...piece, favorite: !piece.favorite } : piece) }))
    notify(item.favorite ? 'Pièce retirée des favoris.' : 'Pièce ajoutée aux favoris.')
  }

  function removeItem(item: Item) {
    if (!window.confirm(`Supprimer « ${item.name} » de votre dressing ? Dans vos tenues, vous pourrez ensuite la remplacer par une autre pièce.`)) return
    update(current => ({
      ...current,
      items: current.items.filter(piece => piece.id !== item.id),
    }))
    notify('Pièce supprimée. Vous pouvez la remplacer dans vos tenues.')
  }

  function resetFilters() {
    setQuery('')
    setCategory('Toutes')
    setOnlyFavorites(false)
  }

  return <div className="wd-page">
    <header className="wd-heading">
      <div>
        <div className="wd-eyebrow"><span /> VOTRE COLLECTION</div>
        <h1>Mon <em>dressing</em></h1>
        <p>Les pièces que vous aimez, réunies au même endroit.</p>
        <div className="wd-summary"><strong>{data.items.length}</strong> {data.items.length === 1 ? 'pièce' : 'pièces'} <span>·</span> <strong>{favoriteCount}</strong> {favoriteCount === 1 ? 'favori' : 'favoris'}</div>
      </div>
      <div className="wd-heading-actions">
        <input ref={importRef} className="wd-visually-hidden" type="file" accept="image/*" onChange={importFromHeader} tabIndex={-1} aria-label="Importer une photo" />
        <button type="button" className="wd-button wd-button-light" onClick={() => importRef.current?.click()}><Icon name="camera" /> Importer une photo</button>
        <button type="button" className="wd-button wd-button-dark" onClick={openNew}><Icon name="plus" /> Ajouter une pièce</button>
      </div>
    </header>

    <section className="wd-collection" aria-label="Votre collection de vêtements">
      <div className="wd-toolbar">
        <label className="wd-search"><Icon name="search" /><span className="wd-visually-hidden">Rechercher par nom, couleur, marque, matière ou style</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une pièce, une marque…" /></label>
        <button type="button" className={`wd-favorite-filter${onlyFavorites ? ' wd-is-active' : ''}`} aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(value => !value)}><Icon name="heart" /> Favoris <span>{favoriteCount}</span></button>
      </div>
      <div className="wd-category-wrap" aria-label="Filtrer par catégorie">
        <div className="wd-categories">
          <button type="button" className={`wd-category${category === 'Toutes' ? ' wd-is-active' : ''}`} aria-pressed={category === 'Toutes'} onClick={() => setCategory('Toutes')}>Toutes les pièces</button>
          {CATEGORIES.map(option => <button type="button" key={option} className={`wd-category${category === option ? ' wd-is-active' : ''}`} aria-pressed={category === option} onClick={() => setCategory(option)}>{option}</button>)}
        </div>
      </div>
      <div className="wd-results-head"><span>{hasFilters ? 'RÉSULTATS' : 'TOUTES VOS PIÈCES'}</span><span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'pièce' : 'pièces'}</span></div>
      {filtered.length > 0 ? <div className="wd-grid">
        {filtered.map(item => <article className="wd-card" key={item.id}>
          <div className="wd-card-media">
            <button type="button" className="wd-card-image-button" aria-label={`Modifier ${item.name}`} onClick={() => openEdit(item)}>
              {item.image ? <img src={item.image} alt={item.name} /> : <span className="wd-image-placeholder"><Icon name="hanger" /><small>PHOTO NON AJOUTÉE</small></span>}
            </button>
            <button type="button" className={`wd-card-heart${item.favorite ? ' wd-is-active' : ''}`} aria-label={item.favorite ? `Retirer ${item.name} des favoris` : `Ajouter ${item.name} aux favoris`} aria-pressed={item.favorite} onClick={() => toggleFavorite(item)}><Icon name="heart" /></button>
          </div>
          <div className="wd-card-info">
            <div className="wd-card-category">{item.category}</div>
            <h2>{item.name}</h2>
            <p>{[item.brand, item.color].filter(Boolean).join(' · ') || 'Détails à compléter'}</p>
            <div className="wd-card-actions">
              <button type="button" onClick={() => openEdit(item)}><Icon name="edit" /> Modifier</button>
              <button type="button" onClick={() => removeItem(item)} aria-label={`Supprimer ${item.name}`}><Icon name="trash" /> <span>Supprimer</span></button>
            </div>
          </div>
        </article>)}
      </div> : <div className="wd-empty">
        <div className="wd-empty-icon"><Icon name={hasFilters ? 'search' : 'hanger'} /></div>
        <h2>{hasFilters ? 'Aucune pièce trouvée' : 'Votre dressing commence ici'}</h2>
        <p>{hasFilters ? 'Essayez une autre recherche ou modifiez vos filtres.' : 'Ajoutez les vêtements que vous possédez pour retrouver votre collection ici.'}</p>
        {hasFilters ? <button type="button" className="wd-button wd-button-light" onClick={resetFilters}>Effacer les filtres</button> : <button type="button" className="wd-button wd-button-dark" onClick={openNew}><Icon name="plus" /> Ajouter ma première pièce</button>}
      </div>}
    </section>

    {modalOpen && <div className="wd-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeModal() }}>
      <div className="wd-dialog" role="dialog" aria-modal="true" aria-labelledby="wd-dialog-title" ref={dialogRef}>
        <div className="wd-dialog-heading"><div><div className="wd-eyebrow"><span /> {editingId ? 'VOTRE PIÈCE' : 'NOUVELLE PIÈCE'}</div><h2 id="wd-dialog-title">{editingId ? 'Modifier la pièce' : 'Ajouter au dressing'}</h2><p>{editingId ? 'Affinez les détails de votre pièce.' : 'Renseignez votre pièce, avec ou sans photo.'}</p></div><button className="wd-close" type="button" onClick={closeModal} aria-label="Fermer"><Icon name="close" /></button></div>
        <form onSubmit={saveItem}>
          <div className="wd-form-body">
            <div className="wd-photo-field wd-photo-duo">
              <div className="wd-photo-slot"><div className="wd-photo-preview">{draft.image ? <img src={draft.image} alt="Vue de face" /> : <div><Icon name="image" /><span>Vue de face</span></div>}</div><strong>01 · Face</strong><div className="wd-photo-actions"><input ref={galleryRef} className="wd-visually-hidden" type="file" accept="image/*" onChange={importInForm} tabIndex={-1} aria-label="Choisir la photo de face" /><input ref={cameraRef} className="wd-visually-hidden" type="file" accept="image/*" capture="environment" onChange={importInForm} tabIndex={-1} aria-label="Prendre la photo de face" /><button type="button" onClick={() => galleryRef.current?.click()}><Icon name="upload" /> Choisir</button><button type="button" onClick={openCamera}><Icon name="camera" /> Photo</button>{draft.image && <button type="button" onClick={() => setDraft(current => ({ ...current, image: '' }))}>Retirer</button>}</div></div>
              <div className="wd-photo-slot"><div className="wd-photo-preview">{draft.imageBack ? <img src={draft.imageBack} alt="Vue de dos ou détail" /> : <div><Icon name="image" /><span>Dos / détail</span></div>}</div><strong>02 · Dos ou détail <small>(facultatif)</small></strong><div className="wd-photo-actions"><input ref={backGalleryRef} className="wd-visually-hidden" type="file" accept="image/*" onChange={importBackPhoto} tabIndex={-1} aria-label="Choisir une seconde photo" /><input ref={backCameraRef} className="wd-visually-hidden" type="file" accept="image/*" capture="environment" onChange={importBackPhoto} tabIndex={-1} aria-label="Prendre une seconde photo" /><button type="button" onClick={() => backGalleryRef.current?.click()}><Icon name="upload" /> Choisir</button><button type="button" onClick={() => backCameraRef.current?.click()}><Icon name="camera" /> Photo</button>{draft.imageBack && <button type="button" onClick={() => setDraft(current => ({ ...current, imageBack: '' }))}>Retirer</button>}</div></div>
              <div className="wd-photo-copy wd-photo-hint"><p>La seconde vue aide à conserver les détails du vêtement. Les photos restent stockées sur votre appareil.</p>{readingImage && <div className="wd-form-status" role="status">Préparation de la photo…</div>}{imageError && <div className="wd-form-error" role="alert">{imageError}</div>}</div>
            </div>
            <div className="wd-form-grid wd-form-essential">
              <label className="wd-field">Nom de la pièce <span>*</span><input name="wd-name" required maxLength={120} value={draft.name} aria-invalid={Boolean(formError)} aria-describedby={formError ? 'wd-name-error' : undefined} onChange={event => { setDraft({ ...draft, name: event.target.value }); setFormError('') }} placeholder="Ex. Veste en laine" />{formError && <div id="wd-name-error" className="wd-form-error" role="alert">{formError}</div>}</label>
              <label className="wd-field">Catégorie <span>*</span><select required value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as Category | '' })}><option value="" disabled>Choisir une catégorie</option>{CATEGORIES.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
            </div>
            <details className="wd-advanced"><summary>Ajouter des détails facultatifs <span>Couleur, marque, matière, style…</span></summary><div className="wd-form-grid">
              <label className="wd-field">Couleur<input maxLength={100} value={draft.color} onChange={event => setDraft({ ...draft, color: event.target.value })} placeholder="Ex. Beige" /></label>
              <label className="wd-field">Marque<input maxLength={120} value={draft.brand} onChange={event => setDraft({ ...draft, brand: event.target.value })} placeholder="Ex. Nom de la marque" /></label>
              <label className="wd-field">Matière<input maxLength={120} value={draft.material} onChange={event => setDraft({ ...draft, material: event.target.value })} placeholder="Ex. Laine" /></label>
              <label className="wd-field">Saison<input list="wd-season-options" maxLength={120} value={draft.season} onChange={event => setDraft({ ...draft, season: event.target.value })} placeholder="Ex. Toutes saisons" /><datalist id="wd-season-options">{SEASONS.map(option => <option key={option} value={option} />)}</datalist></label>
              <label className="wd-field">Style<input list="wd-style-options" maxLength={120} value={draft.style} onChange={event => setDraft({ ...draft, style: event.target.value })} placeholder="Ex. Classique" /><datalist id="wd-style-options">{STYLES.map(option => <option key={option} value={option} />)}</datalist></label>
              <label className="wd-field wd-field-wide">Notes<textarea rows={3} maxLength={2000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} placeholder="Une coupe, un souvenir, un détail…" /></label>
            </div></details>
          </div>
          <div className="wd-dialog-footer"><span>* Champs obligatoires</span><div><button type="button" className="wd-button wd-button-light" onClick={closeModal}>Annuler</button><button type="submit" className="wd-button wd-button-dark" disabled={readingImage}>{editingId ? 'Enregistrer' : 'Ajouter la pièce'} <Icon name="arrow" /></button></div></div>
        </form>
        {cameraOpen && <div className="wd-camera-overlay" role="dialog" aria-modal="true" aria-labelledby="wd-camera-title"><div className="wd-camera-dialog"><div className="wd-camera-heading"><div><div className="wd-eyebrow"><span /> CAPTURE DIRECTE</div><h2 id="wd-camera-title">Photographier la pièce</h2><p>Placez le vêtement entièrement dans le cadre.</p></div><button className="wd-close" type="button" onClick={stopCamera} aria-label="Fermer la caméra"><Icon name="close" /></button></div><div className="wd-camera-view">{cameraError ? <div className="wd-camera-error"><Icon name="camera" /><strong>Caméra indisponible</strong><p>{cameraError}</p><button type="button" className="wd-button wd-button-light" onClick={() => galleryRef.current?.click()}>Choisir une photo</button></div> : <><video ref={videoRef} playsInline muted aria-label="Aperçu de la caméra" /><div className="wd-camera-frame" aria-hidden="true" /></>}</div><div className="wd-camera-footer"><button type="button" className="wd-button wd-button-light" onClick={stopCamera}>Annuler</button>{!cameraError && <button type="button" className="wd-button wd-button-dark" onClick={captureCameraPhoto}><Icon name="camera" /> Capturer</button>}</div></div></div>}
      </div>
    </div>}
  </div>
}
