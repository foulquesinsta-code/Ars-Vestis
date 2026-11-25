import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, Layers2, Plus, Search, X } from 'lucide-react'
import { CATEGORIES, makeId } from './types'
import type { Category, Item, SharedProps } from './types'
import './catalog.css'

type CatalogProduct = {
  code: string
  name: string
  brand: string
  category_text: string
  category_tags: string[]
  source_url: string
}

type CatalogData = {
  metadata: { source_snapshot_last_modified_utc: string; product_count: number }
  products: CatalogProduct[]
}

const DATA_URL = `${import.meta.env.BASE_URL}data/open-products-fashion.json`
const PAGE_SIZE = 12
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim()
const sourceURL = (code: string) => `https://world.openproductsfacts.org/product/${code}`

// The published file is static, but reject a missing/incorrect file (including an
// SPA fallback) and validate the fields before using them or constructing links.
function readCatalog(value: unknown): CatalogData {
  if (!value || typeof value !== 'object') throw new Error('Format incorrect')
  const object = value as Record<string, unknown>
  const meta = object.metadata as Record<string, unknown> | undefined
  if (!meta || typeof meta.source_snapshot_last_modified_utc !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(meta.source_snapshot_last_modified_utc) || !Array.isArray(object.products) || object.products.length > 1000 || meta.product_count !== object.products.length) throw new Error('Format incorrect')
  const products = object.products as unknown[]
  const valid = products.every(value => {
    if (!value || typeof value !== 'object') return false
    const p = value as Record<string, unknown>
    return typeof p.code === 'string' && /^(?:\d{8}|\d{12,14})$/.test(p.code) && typeof p.name === 'string' && !!p.name.trim() && typeof p.brand === 'string' && typeof p.category_text === 'string' && Array.isArray(p.category_tags) && p.category_tags.every(tag => typeof tag === 'string') && p.source_url === sourceURL(p.code)
  })
  if (!valid) throw new Error('Fiches incorrectes')
  return { metadata: { source_snapshot_last_modified_utc: meta.source_snapshot_last_modified_utc, product_count: object.products.length }, products: products as CatalogProduct[] }
}

function categoryLabel(product: CatalogProduct) {
  return product.category_text || product.category_tags.join(', ')
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export default function Catalog({ data, update, notify }: SharedProps) {
  const [catalog, setCatalog] = useState<CatalogData | null>(null)
  const [error, setError] = useState(false)
  const [request, setRequest] = useState(0)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<CatalogProduct | null>(null)
  const [category, setCategory] = useState<Category | ''>('')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    fetch(DATA_URL, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Chargement impossible'); return response.json() })
      .then(readCatalog)
      .then(setCatalog)
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [request])

  useEffect(() => {
    if (!selected) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLSelectElement>('select')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelected(null); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), a[href]')).filter(element => element.offsetParent !== null)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [selected])

  const results = useMemo(() => {
    const needle = normalize(deferredQuery)
    if (!catalog) return []
    if (!needle) return catalog.products
    return catalog.products.filter(product => normalize([product.name, product.brand, product.category_text, ...product.category_tags, product.code].join(' ')).includes(needle))
  }, [catalog, deferredQuery])
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const visible = results.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  function beginAdd(product: CatalogProduct) {
    setCategory('')
    setSelected(product)
  }

  function addToDressing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !category || !CATEGORIES.includes(category)) return
    const item: Item = {
      id: makeId(), name: selected.name, category, brand: selected.brand,
      color: '', material: '', season: '', style: '', notes: '',
      favorite: false, createdAt: new Date().toISOString(),
    }
    update(current => ({ ...current, items: [item, ...current.items] }))
    setSelected(null)
    notify('Pièce ajoutée à votre dressing privé.')
  }

  return <div className="catalog-page">
    <header className="catalog-heading">
      <span className="catalog-kicker"><span /> EXPLORER LE RÉFÉRENTIEL</span>
      <h1>Le catalogue <em>ouvert.</em></h1>
      <p>Retrouvez une sélection de fiches de vêtements, puis ajoutez celles qui vous intéressent à votre dressing.</p>
    </header>

    <section className="catalog-notice" aria-label="À propos du référentiel">
      <Layers2 size={21} strokeWidth={1.4} aria-hidden="true" />
      <div><strong>Référentiel collaboratif non vérifié, prix et disponibilité inconnus</strong>
        <p>Contient des données d’<a href="https://world.openproductsfacts.org/" target="_blank" rel="noreferrer">Open Products Facts</a>, mises à disposition sous <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL 1.0</a> (base) et <a href="https://opendatacommons.org/licenses/dbcl/1-0/" target="_blank" rel="noreferrer">DbCL 1.0</a> (contenu). {catalog && <>Snapshot du {formatDate(catalog.metadata.source_snapshot_last_modified_utc)} (UTC). </>}<a href={DATA_URL} download>Télécharger le jeu dérivé JSON</a> · <a href={`${import.meta.env.BASE_URL}data/README.md`} target="_blank" rel="noreferrer">Notice et méthode</a></p>
      </div>
    </section>

    <section className="catalog-collection" aria-label="Catalogue de vêtements">
      <div className="catalog-toolbar">
        <label className="catalog-search"><Search size={19} strokeWidth={1.5} aria-hidden="true" /><span className="catalog-sr-only">Rechercher par libellé, marque, catégorie textuelle ou code EAN</span><input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} placeholder="Libellé, marque, catégorie, code EAN…" /></label>
        <span className="catalog-personal-count">{data.items.length} {data.items.length === 1 ? 'pièce' : 'pièces'} dans votre dressing</span>
      </div>
      <div className="catalog-results-head"><span>FICHES DU CATALOGUE</span><span aria-live="polite">{catalog && !error ? `${results.length} ${results.length === 1 ? 'résultat' : 'résultats'}` : ''}</span></div>
      {error ? <div className="catalog-empty" role="alert"><h2>Catalogue indisponible</h2><p>La copie locale n’a pas pu être chargée. Vérifiez votre connexion ou réessayez.</p><button className="catalog-button catalog-button-light" type="button" onClick={() => { setCatalog(null); setRequest(value => value + 1) }}>Réessayer</button></div>
        : !catalog ? <div className="catalog-empty" role="status"><p>Chargement du catalogue local…</p></div>
          : results.length === 0 ? <div className="catalog-empty"><Search size={26} strokeWidth={1.3} aria-hidden="true"/><h2>Aucune fiche trouvée</h2><p>Essayez une autre recherche. Cette sélection est limitée et ne couvre pas tous les produits.</p><button className="catalog-button catalog-button-light" type="button" onClick={() => { setQuery(''); setPage(0) }}>Effacer la recherche</button></div>
            : <><div className="catalog-grid">{visible.map(product => <article className="catalog-card" key={product.code}>
              <div className="catalog-card-art" aria-label="Aucune photographie de produit"><Layers2 size={34} strokeWidth={1.1} aria-hidden="true"/><span>SANS PHOTOGRAPHIE</span></div>
              <div className="catalog-card-body"><p className="catalog-source-category" title={categoryLabel(product)}>{categoryLabel(product)}</p><h2>{product.name}</h2><p className="catalog-brand">{product.brand || 'Marque non renseignée'}</p><p className="catalog-code">Code : {product.code}</p><div className="catalog-card-actions"><a href={product.source_url} target="_blank" rel="noreferrer">Fiche source <ExternalLink size={13} aria-hidden="true"/></a><button type="button" onClick={() => beginAdd(product)} aria-label={`Ajouter ${product.name} au dressing`}><Plus size={15} aria-hidden="true"/> Ajouter</button></div></div>
            </article>)}</div>
              <nav className="catalog-pagination" aria-label="Pagination des résultats"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={15} aria-hidden="true"/> Précédent</button><span>Page {currentPage + 1} sur {totalPages}</span><button type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>Suivant <ArrowRight size={15} aria-hidden="true"/></button></nav>
            </>}
    </section>

    <footer className="catalog-footer">Sélection dérivée d’<a href="https://world.openproductsfacts.org/data" target="_blank" rel="noreferrer">Open Products Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL 1.0</a> / <a href="https://opendatacommons.org/licenses/dbcl/1-0/" target="_blank" rel="noreferrer">DbCL 1.0</a> · <a href={DATA_URL} download>Télécharger les données</a></footer>

    {selected && <div className="catalog-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }}><div ref={dialogRef} className="catalog-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-dialog-title" aria-describedby="catalog-dialog-description">
      <div className="catalog-dialog-header"><div><span className="catalog-kicker"><span /> VOTRE DRESSING</span><h2 id="catalog-dialog-title">Ajouter cette pièce</h2></div><button type="button" className="catalog-close" aria-label="Fermer" onClick={() => setSelected(null)}><X size={18}/></button></div>
      <p id="catalog-dialog-description">Choisissez une catégorie pour votre dressing. Le nom et la marque proviennent de la fiche collaborative.</p>
      <div className="catalog-selection"><Layers2 size={24} strokeWidth={1.3} aria-hidden="true"/><div><strong>{selected.name}</strong><span>{selected.brand || 'Marque non renseignée'} · {selected.code}</span></div></div>
      <form onSubmit={addToDressing}><label className="catalog-field">Catégorie dans votre dressing <span>*</span><select required value={category} onChange={event => setCategory(event.target.value as Category | '')}><option value="" disabled>Choisir une catégorie</option>{CATEGORIES.map(option => <option value={option} key={option}>{option}</option>)}</select></label>
        <p className="catalog-private-note">L’ajout reste dans votre dressing privé et ne modifie pas Open Products Facts. Les autres détails restent vides.</p>
        <div className="catalog-dialog-actions"><button className="catalog-button catalog-button-light" type="button" onClick={() => setSelected(null)}>Annuler</button><button className="catalog-button catalog-button-dark" type="submit">Ajouter au dressing <ArrowRight size={16}/></button></div>
      </form>
    </div></div>}
  </div>
}
