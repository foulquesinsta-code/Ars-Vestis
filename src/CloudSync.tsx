import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { CATEGORIES, type AppData, type SharedProps } from './types'
import { supabase, supabaseConfigError } from './supabaseClient'
import './cloud.css'

type Feedback = { kind: 'info' | 'success' | 'error'; text: string }
type StagedData = { data: AppData; json: string; updatedAt: string; accountId: string }
type ApplyCheck = { id: number; json: string }

const LARGE_PAYLOAD = 5 * 1024 * 1024
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === 'string')

// Les données distantes ne deviennent jamais l'état local sans validation complète.
function isAppData(value: unknown): value is AppData {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.outfits) || !Array.isArray(value.schedules) || !isRecord(value.preferences)) return false
  const preferences = value.preferences
  if (typeof preferences.name !== 'string' || !isStrings(preferences.styles) || !isStrings(preferences.colors) || typeof preferences.brands !== 'string' || typeof preferences.location !== 'string') return false
  return value.items.every(item => isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.category === 'string' && CATEGORIES.some(category => category === item.category) && typeof item.color === 'string' && typeof item.material === 'string' && typeof item.brand === 'string' && typeof item.season === 'string' && typeof item.style === 'string' && (item.image === undefined || typeof item.image === 'string') && typeof item.notes === 'string' && typeof item.favorite === 'boolean' && typeof item.createdAt === 'string') &&
    value.outfits.every(outfit => isRecord(outfit) && typeof outfit.id === 'string' && typeof outfit.title === 'string' && isStrings(outfit.itemIds) && typeof outfit.occasion === 'string' && typeof outfit.notes === 'string' && typeof outfit.favorite === 'boolean' && typeof outfit.createdAt === 'string') &&
    value.schedules.every(schedule => isRecord(schedule) && typeof schedule.id === 'string' && typeof schedule.date === 'string' && typeof schedule.outfitId === 'string' && typeof schedule.note === 'string' && typeof schedule.worn === 'boolean')
}

function serialize(value: unknown): { json: string; bytes: number; data: AppData } {
  const json = JSON.stringify(value)
  if (typeof json !== 'string') throw new Error('Les données ne peuvent pas être converties en JSON.')
  const parsed: unknown = JSON.parse(json)
  if (!isAppData(parsed)) throw new Error('Le format des données ne correspond pas à celui de cette application. Aucune donnée n’a été remplacée.')
  return { json, bytes: new Blob([json]).size, data: parsed }
}

function sizeLabel(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message.slice(0, 250)
  if (isRecord(error) && typeof error.message === 'string') return error.message.slice(0, 250)
  return 'Une erreur inattendue s’est produite.'
}

function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'date indisponible' : date.toLocaleString('fr-FR')
}

export default function CloudSync(props: SharedProps) {
  const { data, update, notify } = props
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(Boolean(supabase))
  const [busy, setBusy] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [staged, setStaged] = useState<StagedData | null>(null)
  const [applyCheck, setApplyCheck] = useState<ApplyCheck | null>(null)
  const dataRef = useRef(data)
  const userRef = useRef<User | null>(null)
  const busyRef = useRef(false)
  const mountedRef = useRef(false)
  const authEpoch = useRef(0)
  const applyId = useRef(0)
  const pendingApply = useRef<number | null>(null)

  useLayoutEffect(() => { dataRef.current = data }, [data])

  function startBusy(label: string): boolean {
    if (busyRef.current) return false
    busyRef.current = true
    setBusy(label)
    return true
  }

  function endBusy() {
    busyRef.current = false
    if (mountedRef.current) setBusy(null)
  }

  useEffect(() => {
    mountedRef.current = true
    if (!supabase) return () => { mountedRef.current = false }
    const client = supabase
    let active = true
    let verification = 0
    const timers: number[] = []

    const verifySession = async () => {
      const sequence = ++verification
      setChecking(true)
      try {
        const { data: sessionData, error: sessionError } = await client.auth.getSession()
        if (sessionError) throw sessionError
        let verifiedUser: User | null = null
        if (sessionData.session) {
          // getUser vérifie le jeton auprès du serveur, contrairement à la seule lecture du stockage local.
          const { data: userData, error: userError } = await client.auth.getUser()
          if (userError) throw userError
          verifiedUser = userData.user
        }
        if (!active || sequence !== verification) return
        userRef.current = verifiedUser
        setUser(verifiedUser)
      } catch (error) {
        if (!active || sequence !== verification) return
        userRef.current = null
        setUser(null)
        setFeedback({ kind: 'error', text: `Impossible de vérifier la session : ${errorMessage(error)} Vérifiez votre connexion ou la configuration du projet.` })
      } finally {
        if (active && sequence === verification) setChecking(false)
      }
    }

    const { data: { subscription } } = client.auth.onAuthStateChange(() => {
      // Ne pas appeler les méthodes Supabase dans ce callback : elles peuvent se bloquer entre elles.
      authEpoch.current += 1
      verification += 1
      userRef.current = null
      setUser(null)
      setChecking(true)
      setStaged(null)
      timers.push(window.setTimeout(() => { if (active) void verifySession() }, 0))
    })
    void verifySession()
    return () => {
      active = false
      mountedRef.current = false
      verification += 1
      subscription.unsubscribe()
      timers.forEach(window.clearTimeout)
    }
  }, [])

  // SharedProps.update ne renvoie pas d'accusé de réception : ne déclarer la
  // restauration appliquée que lorsque les nouvelles props sont observées.
  useEffect(() => {
    if (!applyCheck || pendingApply.current !== applyCheck.id) return
    try {
      if (JSON.stringify(data) === applyCheck.json) {
        pendingApply.current = null
        setApplyCheck(null)
        endBusy()
        setFeedback({ kind: 'success', text: 'Données du compte appliquées dans l’application. Vérifiez leur enregistrement local.' })
        notify('Données du compte appliquées dans l’application')
      }
    } catch {
      // Le délai ci-dessous signalera que le résultat n'a pas pu être confirmé.
    }
  }, [data, applyCheck, notify])

  useEffect(() => {
    if (!applyCheck) return
    const timer = window.setTimeout(() => {
      if (pendingApply.current !== applyCheck.id) return
      pendingApply.current = null
      setApplyCheck(null)
      endBusy()
      setFeedback({ kind: 'error', text: 'Impossible de confirmer le remplacement dans l’application. Vérifiez vos données locales avant de réessayer.' })
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [applyCheck])

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !startBusy(mode === 'login' ? 'Connexion…' : 'Création du compte…')) return
    setFeedback(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        setPassword('')
        setFeedback({ kind: 'info', text: 'Connexion acceptée. Vérification de la session en cours…' })
      } else {
        const { data: result, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        setPassword('')
        setFeedback({ kind: 'info', text: result.session ? 'Compte créé. Vérification de la session en cours…' : 'Demande de création reçue. Si la confirmation par e-mail est activée, confirmez votre adresse puis connectez-vous.' })
      }
    } catch (error) {
      setFeedback({ kind: 'error', text: `Authentification impossible : ${errorMessage(error)}` })
    } finally {
      endBusy()
    }
  }

  async function signOut() {
    if (!supabase || !startBusy('Déconnexion…')) return
    setFeedback(null)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      setStaged(null)
      setFeedback({ kind: 'info', text: 'Déconnexion demandée pour cet appareil. Vos données locales restent sur cet appareil.' })
    } catch (error) {
      setFeedback({ kind: 'error', text: `Déconnexion impossible : ${errorMessage(error)}` })
    } finally {
      endBusy()
    }
  }

  async function sendLocal() {
    if (!supabase || !userRef.current || busyRef.current || checking) return
    const accountId = userRef.current.id
    const accountLabel = userRef.current.email ?? 'utilisateur connecté'
    const epoch = authEpoch.current
    if (!startBusy('Vérification de la copie du compte…')) return
    setFeedback(null)
    let writeStarted = false
    const sessionUnchanged = () => mountedRef.current && epoch === authEpoch.current && userRef.current?.id === accountId
    const sessionChanged = () => {
      setFeedback({ kind: 'info', text: writeStarted
        ? 'La session a changé pendant l’envoi. Son résultat ne peut pas être confirmé ici : le serveur peut avoir reçu la copie. Vérifiez le compte initial avant de recommencer. Vos données locales n’ont pas été modifiées.'
        : 'La session a changé avant l’envoi. Aucune écriture n’a été tentée et vos données locales n’ont pas été modifiées. Recommencez avec le compte voulu.' })
    }
    try {
      // Lire uniquement la version courante : le contenu des anciennes copies reste inchangé.
      const { data: current, error: readError } = await supabase.from('app_data')
        .select('updated_at').eq('user_id', accountId).maybeSingle()
      if (!mountedRef.current) return
      if (!sessionUnchanged()) { sessionChanged(); return }
      if (readError) throw readError
      if (current && (typeof current.updated_at !== 'string' || !current.updated_at || Number.isNaN(new Date(current.updated_at).getTime()))) {
        throw new Error('La date de la copie du compte est indisponible ou invalide ; impossible de vérifier sa version.')
      }

      // Prendre la copie locale juste avant la confirmation, après la lecture réseau.
      const snapshot = serialize(dataRef.current)
      const largeWarning = snapshot.bytes >= LARGE_PAYLOAD ? '\n\nCe fichier est volumineux : la requête peut être refusée. Réduisez les images si nécessaire.' : ''
      const remoteDescription = current
        ? `Une copie existe déjà pour ce compte. Dernier enregistrement : ${dateLabel(current.updated_at)}. L’envoi tentera de la remplacer entièrement si cette date n’a pas changé.`
        : 'Aucune copie n’a été trouvée pour ce compte. L’envoi tentera d’en créer une.'
      if (!window.confirm(`Envoyer la copie locale (${sizeLabel(snapshot.bytes)}) vers le compte ${accountLabel} ?\n\n${remoteDescription}\n\nLes modifications locales ultérieures ne seront pas envoyées automatiquement.${largeWarning}`)) return
      if (!mountedRef.current) return
      if (!sessionUnchanged()) { sessionChanged(); return }

      setStaged(null)
      setBusy('Envoi de la copie…')
      writeStarted = true
      // Ne remplacer que la version lue. Sans ligne, l'insert doit échouer en cas de collision.
      const { data: saved, error } = current
        ? await supabase.from('app_data').update({ data: snapshot.data })
          .eq('user_id', accountId).eq('updated_at', current.updated_at).select('updated_at').maybeSingle()
        : await supabase.from('app_data').insert({ user_id: accountId, data: snapshot.data })
          .select('updated_at').maybeSingle()
      if (!mountedRef.current) return
      if (!sessionUnchanged()) { sessionChanged(); return }
      if (error?.code === '23505') {
        setFeedback({ kind: 'error', text: 'Conflit : une copie existe déjà ou a changé depuis la vérification. Vos données locales n’ont pas été modifiées. Vérifiez la copie du compte avant de recommencer.' })
        return
      }
      if (error) throw error
      if (!saved) {
        setFeedback({ kind: 'error', text: 'Conflit : aucune écriture n’a été confirmée ; la copie a pu changer, disparaître ou devenir inaccessible depuis la vérification. Vos données locales n’ont pas été modifiées. Vérifiez la copie du compte avant de recommencer.' })
        return
      }
      if (typeof saved.updated_at !== 'string') throw new Error('Le serveur n’a pas confirmé l’enregistrement.')
      setFeedback({ kind: 'success', text: `Copie locale envoyée au compte le ${dateLabel(saved.updated_at)}. Les changements locaux ultérieurs ne sont pas inclus.` })
      notify('Copie locale envoyée au compte')
    } catch (error) {
      if (!mountedRef.current) return
      if (!sessionUnchanged()) { sessionChanged(); return }
      setFeedback({ kind: 'error', text: writeStarted
        ? `Envoi non confirmé : ${errorMessage(error)} Vos données locales sont intactes. En cas d’interruption, le serveur peut toutefois avoir reçu la copie ; vérifiez avant de réessayer. Pour une requête trop volumineuse, réduisez les images.`
        : `Envoi annulé avant écriture : ${errorMessage(error)} Vos données locales n’ont pas été modifiées. Vérifiez votre connexion et réduisez la taille des images si nécessaire.` })
    } finally {
      endBusy()
    }
  }

  async function retrieveAccount() {
    if (!supabase || !userRef.current || busyRef.current || checking) return
    if (!window.confirm('Récupérer la copie de ce compte pour la prévisualiser ? Aucune donnée locale ne sera modifiée sans une seconde confirmation.')) return
    if (!startBusy('Lecture du compte…')) return
    const accountId = userRef.current.id
    const epoch = authEpoch.current
    setFeedback(null)
    setStaged(null)
    try {
      const { data: row, error } = await supabase.from('app_data').select('data, updated_at').eq('user_id', accountId).maybeSingle()
      if (error) throw error
      if (epoch !== authEpoch.current || userRef.current?.id !== accountId) throw new Error('La session a changé pendant la lecture. Recommencez avec le compte voulu.')
      if (!row) {
        setFeedback({ kind: 'info', text: 'Aucune copie n’existe encore pour ce compte. Vos données locales n’ont pas été modifiées.' })
        return
      }
      const checked = serialize(row.data)
      setStaged({ data: checked.data, json: checked.json, updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '', accountId })
      setFeedback({ kind: 'info', text: `Copie récupérée (${sizeLabel(checked.bytes)}). Elle n’a pas encore remplacé les données locales.` })
    } catch (error) {
      setFeedback({ kind: 'error', text: `Récupération impossible : ${errorMessage(error)} Vos données locales n’ont pas été modifiées. Vérifiez aussi la taille des images et le format des données.` })
    } finally {
      endBusy()
    }
  }

  function applyRetrieved() {
    if (!staged || !userRef.current || staged.accountId !== userRef.current.id || busyRef.current || checking) return
    if (!window.confirm('Remplacer TOUTES les données locales par cette copie du compte ?\n\nLes pièces, tenues, calendriers et préférences locaux seront remplacés, sans fusion. Faites une sauvegarde locale au préalable si nécessaire.')) return
    let localJson: string
    try {
      localJson = serialize(dataRef.current).json
    } catch (error) {
      setFeedback({ kind: 'error', text: `Remplacement annulé : impossible de vérifier les données locales. ${errorMessage(error)}` })
      return
    }
    if (localJson === staged.json) {
      setStaged(null)
      setFeedback({ kind: 'info', text: 'Les données locales affichées sont déjà identiques à cette copie. Aucun remplacement n’a été nécessaire.' })
      return
    }
    if (!startBusy('Application de la copie…')) return
    const expected = staged
    const epoch = authEpoch.current
    const id = ++applyId.current
    pendingApply.current = id
    setApplyCheck({ id, json: expected.json })
    setStaged(null)
    setFeedback(null)
    try {
      update(current => {
        // Ce contrôle au moment du calcul empêche d'écraser une modification
        // locale intervenue après la confirmation et avant l'application.
        let unchanged = false
        try { unchanged = JSON.stringify(current) === localJson } catch { /* conflit */ }
        if (unchanged && authEpoch.current === epoch && userRef.current?.id === expected.accountId) return expected.data
        queueMicrotask(() => {
          if (!mountedRef.current || pendingApply.current !== id) return
          pendingApply.current = null
          setApplyCheck(null)
          endBusy()
          setFeedback({ kind: 'error', text: 'Les données locales ou la session ont changé pendant l’opération. Aucun remplacement n’a été effectué ; recommencez si nécessaire.' })
        })
        return current
      })
    } catch (error) {
      pendingApply.current = null
      setApplyCheck(null)
      endBusy()
      setFeedback({ kind: 'error', text: `Remplacement non confirmé : ${errorMessage(error)} Vérifiez vos données locales.` })
    }
  }

  return <section className="cloud" aria-labelledby="cloud-title">
    <div className="cloud-heading">
      <div><span className="cloud-eyebrow">VOTRE ESPACE PRIVÉ</span><h2 id="cloud-title">Votre dressing, <em>à votre rythme.</em></h2><p>Conservez une copie sur votre compte, uniquement quand vous le choisissez.</p></div>
      <span className="cloud-mark" aria-hidden="true">AV</span>
    </div>

    {supabaseConfigError ? <div className="cloud-notice cloud-notice--info" role="status"><strong>Compte cloud non configuré</strong><span>{supabaseConfigError} Vos données locales restent disponibles.</span></div> : <>
      <div className="cloud-session" aria-live="polite">
        <span className={`cloud-dot ${user ? 'cloud-dot--connected' : ''}`} aria-hidden="true" />
        <span>{checking ? 'Vérification de la session…' : user ? `Compte vérifié : ${user.email ?? 'utilisateur connecté'}` : 'Aucune session vérifiée sur cet appareil'}</span>
      </div>
      {!user && !checking && <div className="cloud-auth">
        <div className="cloud-switch" aria-label="Choisir une action de compte">
          <button type="button" className={mode === 'login' ? 'is-active' : ''} onClick={() => { setMode('login'); setFeedback(null) }} disabled={Boolean(busy)}>Se connecter</button>
          <button type="button" className={mode === 'signup' ? 'is-active' : ''} onClick={() => { setMode('signup'); setFeedback(null) }} disabled={Boolean(busy)}>Créer un compte</button>
        </div>
        <form className="cloud-form" onSubmit={authenticate}>
          <label>Adresse e-mail<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={Boolean(busy)} /></label>
          <label>Mot de passe<input type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} disabled={Boolean(busy)} /></label>
          <button className="cloud-button cloud-button--dark" type="submit" disabled={Boolean(busy)}>{busy ?? (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}</button>
        </form>
        {mode === 'signup' && <p className="cloud-hint">Une confirmation par e-mail est nécessaire. Le service e-mail actuel de Supabase ne délivre les messages qu’aux adresses membres de l’organisation. L’inscription publique exige un service e-mail supplémentaire et une adresse de retour autorisée dans Supabase.</p>}
      </div>}
      {user && !checking && <div className="cloud-actions">
        <div className="cloud-action"><div><span className="cloud-action-number">01 / ENVOYER</span><h3>Envoyer mes données locales</h3><p>Remplace la copie du compte par les données actuellement sur cet appareil.</p></div><button type="button" className="cloud-button cloud-button--dark" onClick={() => void sendLocal()} disabled={Boolean(busy)}>Envoyer mes données locales</button></div>
        <div className="cloud-action"><div><span className="cloud-action-number">02 / RÉCUPÉRER</span><h3>Récupérer les données du compte</h3><p>Prévisualisez la copie, puis confirmez séparément si vous voulez remplacer les données locales.</p></div><button type="button" className="cloud-button cloud-button--outline" onClick={() => void retrieveAccount()} disabled={Boolean(busy)}>Récupérer les données du compte</button></div>
        {staged && <div className="cloud-preview"><span className="cloud-eyebrow">COPIE PRÊTE À APPLIQUER</span><p>{staged.data.items.length} pièces · {staged.data.outfits.length} tenues · {staged.data.schedules.length} dates<br />Dernier enregistrement : {dateLabel(staged.updatedAt)}</p><strong>Sans fusion : les données de cet appareil seront remplacées.</strong><div className="cloud-preview-actions"><button type="button" className="cloud-button cloud-button--dark" onClick={applyRetrieved} disabled={Boolean(busy)}>Confirmer le remplacement local</button><button type="button" className="cloud-button cloud-button--outline" onClick={() => { setStaged(null); setFeedback({ kind: 'info', text: 'Récupération annulée. Vos données locales n’ont pas été modifiées.' }) }} disabled={Boolean(busy)}>Annuler</button></div></div>}
        <div className="cloud-footer"><p>La synchronisation n’est pas automatique. Chaque appareil conserve ses propres données entre les transferts.</p><button type="button" className="cloud-link" onClick={() => void signOut()} disabled={Boolean(busy)}>Se déconnecter</button></div>
      </div>}
      {busy && <p className="cloud-progress" role="status">{busy}</p>}
      {feedback && <div className={`cloud-notice cloud-notice--${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}
    </>}
    <p className="cloud-storage-note">Les images incluses dans les données (data URLs) augmentent fortement leur taille ; les gros envois peuvent échouer. Réduisez-les ou prévoyez un stockage d’images dédié.</p>
  </section>
}
