'use client'

import { useEffect, useState } from 'react'
import { coordinates, type Language, type Summit } from '@/lib/tracker'
import { offlineStorageKey, prepareOffline, readOfflineSummits } from '@/lib/offline'

export default function OfflineButton({ summit, language = 'ca' }: { summit: Summit; language?: Language }) {
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const labels = language === 'es'
    ? { save: 'Guardar sin cobertura', remove: 'Quitar descarga', saved: 'Ficha guardada en este dispositivo.', error: 'No se ha podido guardar. Comprueba la conexión y el espacio del navegador.', reader: 'Ver fichas descargadas' }
    : language === 'en'
      ? { save: 'Save for offline', remove: 'Remove download', saved: 'Summit saved on this device.', error: 'Could not save. Check your connection and browser storage.', reader: 'View downloaded summits' }
      : { save: 'Desar sense cobertura', remove: 'Treure descàrrega', saved: 'Fitxa desada en aquest dispositiu.', error: 'No s’ha pogut desar. Comprova la connexió i l’espai del navegador.', reader: 'Veure fitxes descarregades' }

  useEffect(() => {
    const refresh = () => { try { setSaved(readOfflineSummits().some(item => item.id === summit.id)) } catch { setSaved(false) } }
    refresh()
    window.addEventListener('offline-summits-changed', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('offline-summits-changed', refresh); window.removeEventListener('storage', refresh); window.removeEventListener('pageshow', refresh); window.removeEventListener('focus', refresh) }
  }, [summit.id])

  async function toggle() {
    setBusy(true); setError('')
    try {
      if (!saved) await prepareOffline()
      const previous = readOfflineSummits().filter(item => item.id !== summit.id)
      const next = saved ? previous : [...previous, { ...summit, coordinate: coordinates[summit.id], savedAt: new Date().toISOString() }]
      localStorage.setItem(offlineStorageKey, JSON.stringify(next))
      window.dispatchEvent(new Event('offline-summits-changed'))
      setSaved(!saved)
    } catch { setError(labels.error) }
    finally { setBusy(false) }
  }

  return <div className="offline-save">
    <button type="button" className="secondary-button" aria-pressed={saved} disabled={busy} onClick={() => void toggle()}>{busy ? '…' : saved ? `✓ ${labels.remove}` : `↓ ${labels.save}`}</button>
    {saved && <p role="status">{labels.saved} <a href={`/offline.html?cim=${encodeURIComponent(summit.id)}`}>{labels.reader} →</a></p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>
}
