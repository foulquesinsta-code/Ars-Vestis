import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Les variables Vite sont publiques : ne jamais y placer une clé service_role ou sb_secret_.
// Ces valeurs sont publiques par conception ; les politiques RLS protègent les données.
const url = import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://vnqfspdqxpvuzduqirvo.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || 'sb_publishable_J4bfnnEyJpt83k__RlVgFQ_xZ1d_mNg'

function legacyJwtRole(value: string): string | undefined {
  try {
    const part = value.split('.')[1]
    if (!part) return undefined
    const decoded = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof decoded.role === 'string' ? decoded.role : undefined
  } catch {
    return undefined
  }
}

function configurationError(): string | null {
  if (!url || !key) return 'Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY pour activer le compte cloud.'
  if (key.startsWith('sb_secret_') || legacyJwtRole(key) === 'service_role') {
    return 'Une clé privilégiée a été détectée. Utilisez uniquement une clé publiable ou anon, jamais une clé secrète ou service_role.'
  }
  try {
    const parsed = new URL(url)
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
      return 'L’URL Supabase doit utiliser HTTPS, sauf pour un serveur local.'
    }
  } catch {
    return 'L’URL Supabase n’est pas valide.'
  }
  return null
}

export const supabaseConfigError = configurationError()
export const supabase: SupabaseClient | null = supabaseConfigError ? null : createClient(url, key)
