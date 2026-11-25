let deferredPrompt: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }) | null = null
export function captureInstallPrompt(event: Event) { event.preventDefault(); deferredPrompt = event as NonNullable<typeof deferredPrompt> }
export function getInstallPrompt() { return deferredPrompt }
export function clearInstallPrompt() { deferredPrompt = null }
