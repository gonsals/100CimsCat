'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import catalogSeed from '@/data/summits.json'
import MountainPlaceholder from '@/components/MountainPlaceholder'

function getAuthCallbackUrl() {
  return `${window.location.origin}/auth/callback`
}

type Summit = {
  id: string
  name: string
  height: number
  region: string
  essential: boolean
  url: string
}

type Ascent = {
  summit_id: string
  completed_at: string
  photo_path: string | null
  photoUrl?: string
}

type Filter = 'all' | 'pending' | 'done' | 'essential'
type Language = 'ca' | 'es' | 'en'
type Theme = 'light' | 'dark'

const translations: Record<Language, Record<string, string>> = {
  ca: {},
  es: {
    'El meu repte': 'Mi reto', 'Catàleg FEEC ↗': 'Catálogo FEEC ↗', 'Inicia sessió': 'Iniciar sesión',
    'EL TEU QUADERN DE MUNTANYA': 'TU CUADERNO DE MONTAÑA', 'Cada cim, una': 'Cada cima, una',
    'història.': 'historia.', 'Guarda els teus records i descobreix fins on t’ha portat el camí.': 'Guarda tus recuerdos y descubre hasta dónde te ha llevado el camino.',
    'El teu progrés t’acompanya.': 'Tu progreso te acompaña.', 'Inicia sessió per desar cims i fotos al teu compte.': 'Inicia sesión para guardar cimas y fotos en tu cuenta.',
    'Accedir amb el correu': 'Acceder con el correo', 'EL REPTE DELS 100 CIMS': 'EL RETO DE LAS 100 CIMAS', 'El teu camí fins als 100': 'Tu camino hasta las 100',
    'cims fets': 'cimas hechas', 'essencials fets': 'esenciales hechas', 'records guardats': 'recuerdos guardados',
    'EL TEU CATÀLEG': 'TU CATÁLOGO', 'Tria el pròxim cim': 'Elige la próxima cima', 'Cerca un cim o una comarca...': 'Busca una cima o una comarca...',
    'Cerca per cim o comarca': 'Buscar por cima o comarca', 'Tots': 'Todas', 'Pendents': 'Pendientes', 'Fets': 'Hechas', '✦ Essencials': '✦ Esenciales',
    'Ordena per': 'Ordenar por', 'Nom A–Z': 'Nombre A–Z', 'Altitud': 'Altitud', 'No hem trobat cap cim amb aquests filtres.': 'No hemos encontrado ninguna cima con estos filtros.',
    '＋ Foto': '＋ Foto', 'Canviar foto': 'Cambiar foto', '+ Marcar fet': '+ Marcar hecha', 'Pujar una foto de': 'Subir una foto de',
    'El teu quadern, sempre amb tu.': 'Tu cuaderno, siempre contigo.', 'Entra al teu camí': 'Entra en tu camino',
    'T’enviarem un enllaç segur al correu per guardar les ascensions i les fotos al teu compte.': 'Te enviaremos un enlace seguro al correo para guardar ascensiones y fotos en tu cuenta.',
    'Correu electrònic': 'Correo electrónico', 'Envia’m l’enllaç d’accés': 'Envíame el enlace de acceso', 'Enviant…': 'Enviando…',
    'Les teves fotos són privades i només les pot veure el teu compte.': 'Tus fotos son privadas y solo puede verlas tu cuenta.', 'Configuració': 'Ajustes', 'Tema': 'Tema', 'Clar': 'Claro', 'Fosc': 'Oscuro', 'Idioma': 'Idioma',
    'Fet per recordar els camins, no només els cims.': 'Hecho para recordar los caminos, no solo las cimas.',
    'Filtrar cims': 'Filtrar cimas', 'Encara no has registrat cap ascensió. Tot comença amb el primer pas.': 'Aún no has registrado ninguna ascensión. Todo empieza con el primer paso.',
    'cim': 'cima', 'cims': 'cimas', 'd’essencials.': 'esenciales.',
    'Continua amb Google': 'Continuar con Google', 'o bé': 'o también', 'No s’ha pogut iniciar sessió amb Google. Revisa que el proveïdor estigui activat a Supabase i torna-ho a provar.': 'No se ha podido iniciar sesión con Google. Comprueba que el proveedor esté activado en Supabase y vuelve a intentarlo.',
    'El teu compte': 'Tu cuenta', 'Tancar sessió': 'Cerrar sesión', 'Tancant sessió…': 'Cerrando sesión…', 'No s’ha pogut tancar la sessió. Torna-ho a provar.': 'No se ha podido cerrar la sesión. Inténtalo de nuevo.',
    'Il·lustració de referència': 'Ilustración de referencia', 'Tancar': 'Cerrar',
  },
  en: {
    'El meu repte': 'My challenge', 'Catàleg FEEC ↗': 'FEEC catalogue ↗', 'Inicia sessió': 'Sign in',
    'EL TEU QUADERN DE MUNTANYA': 'YOUR MOUNTAIN JOURNAL', 'Cada cim, una': 'Every summit, a', 'història.': 'story.',
    'Guarda els teus records i descobreix fins on t’ha portat el camí.': 'Save your memories and see how far the trail has taken you.',
    'El teu progrés t’acompanya.': 'Your progress goes with you.', 'Inicia sessió per desar cims i fotos al teu compte.': 'Sign in to save summits and photos to your account.',
    'Accedir amb el correu': 'Continue with email', 'EL REPTE DELS 100 CIMS': 'THE 100 SUMMITS CHALLENGE', 'El teu camí fins als 100': 'Your path to 100',
    'cims fets': 'summits completed', 'essencials fets': 'essential summits', 'records guardats': 'memories saved',
    'EL TEU CATÀLEG': 'YOUR CATALOGUE', 'Tria el pròxim cim': 'Choose your next summit', 'Cerca un cim o una comarca...': 'Search a summit or region...',
    'Cerca per cim o comarca': 'Search by summit or region', 'Tots': 'All', 'Pendents': 'To do', 'Fets': 'Done', '✦ Essencials': '✦ Essential',
    'Ordena per': 'Sort by', 'Nom A–Z': 'Name A–Z', 'Altitud': 'Elevation', 'No hem trobat cap cim amb aquests filtres.': 'No summits match these filters.',
    '＋ Foto': '＋ Photo', 'Canviar foto': 'Change photo', '+ Marcar fet': '+ Mark done', 'Pujar una foto de': 'Upload a photo of',
    'El teu quadern, sempre amb tu.': 'Your journal, always with you.', 'Entra al teu camí': 'Sign in to your journal',
    'T’enviarem un enllaç segur al correu per guardar les ascensions i les fotos al teu compte.': 'We’ll email you a secure link to save your ascents and photos to your account.',
    'Correu electrònic': 'Email address', 'Envia’m l’enllaç d’accés': 'Send me a sign-in link', 'Enviant…': 'Sending…',
    'Les teves fotos són privades i només les pot veure el teu compte.': 'Your photos are private and only visible to your account.', 'Configuració': 'Settings', 'Tema': 'Theme', 'Clar': 'Light', 'Fosc': 'Dark', 'Idioma': 'Language',
    'Fet per recordar els camins, no només els cims.': 'Made to remember the trails, not just the summits.',
    'Filtrar cims': 'Filter summits', 'Encara no has registrat cap ascensió. Tot comença amb el primer pas.': 'You have not recorded an ascent yet. Every journey starts with the first step.',
    'cim': 'summit', 'cims': 'summits', 'd’essencials.': 'essential.',
    'Continua amb Google': 'Continue with Google', 'o bé': 'or', 'No s’ha pogut iniciar sessió amb Google. Revisa que el proveïdor estigui activat a Supabase i torna-ho a provar.': 'Could not start Google sign-in. Check that the provider is enabled in Supabase and try again.',
    'El teu compte': 'Your account', 'Tancar sessió': 'Sign out', 'Tancant sessió…': 'Signing out…', 'No s’ha pogut tancar la sessió. Torna-ho a provar.': 'Could not sign out. Please try again.',
    'Il·lustració de referència': 'Reference illustration', 'Tancar': 'Close',
  },
}

const target = 100
const imageLimit = 6 * 1024 * 1024
const rawImageLimit = 24 * 1024 * 1024
const preferredImageSize = 1.5 * 1024 * 1024
async function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No s’ha pogut processar la imatge.')), type, quality)
  })
}

async function optimizePhoto(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    const maxDimension = 1800
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Aquest navegador no pot processar la imatge.')
    context.fillStyle = '#f5f4ef'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    let output = await encodeCanvas(canvas, 'image/webp', 0.82)
    if (output.type !== 'image/webp') output = await encodeCanvas(canvas, 'image/jpeg', 0.82)
    if (output.size > preferredImageSize) {
      output = await encodeCanvas(canvas, output.type, 0.72)
    }
    if (output.size > preferredImageSize) {
      output = await encodeCanvas(canvas, output.type, 0.62)
    }

    const extension = output.type === 'image/webp' ? 'webp' : 'jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto-cim'
    return new File([output], `${baseName}.${extension}`, {
      type: output.type,
      lastModified: Date.now(),
    })
  } finally {
    bitmap.close()
  }
}

function localDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function friendlyDate(value: string, language: Language) {
  const locale = language === 'es' ? 'es-ES' : language === 'en' ? 'en-GB' : 'ca-ES'
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CimTracker() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  const supabase = useMemo(() => configured ? createClient() : null, [configured])
  const [summits, setSummits] = useState<Summit[]>([])
  const [ascents, setAscents] = useState<Map<string, Ascent>>(new Map())
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [ready, setReady] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sortBy, setSortBy] = useState<'name' | 'height'>('name')
  const [authOpen, setAuthOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sendingLink, setSendingLink] = useState(false)
  const [signingInWithGoogle, setSigningInWithGoogle] = useState(false)
  const [googleError, setGoogleError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyLabel, setBusyLabel] = useState('Desant…')
  const [language, setLanguage] = useState<Language>('ca')
  const [theme, setTheme] = useState<Theme>('light')
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const headerActionsRef = useRef<HTMLDivElement>(null)
  const t = (value: string) => translations[language][value] ?? value

  useEffect(() => {
    const savedLanguage = localStorage.getItem('100cimscat-language')
    const savedTheme = localStorage.getItem('100cimscat-theme')
    if (savedLanguage === 'ca' || savedLanguage === 'es' || savedLanguage === 'en') setLanguage(savedLanguage)
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme)
    setPreferencesReady(true)
  }, [])

  useEffect(() => {
    if (!preferencesReady) return
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = language
    localStorage.setItem('100cimscat-theme', theme)
    localStorage.setItem('100cimscat-language', language)
  }, [theme, language, preferencesReady])

  useEffect(() => {
    if (!settingsOpen && !profileOpen) return

    function closeOnOutside(event: PointerEvent) {
      if (!headerActionsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false)
        setProfileOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
        setProfileOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [settingsOpen, profileOpen])

  useEffect(() => {
    let active = true
    if (!supabase) {
      setSummits(catalogSeed as Summit[])
      setReady(true)
      return
    }

    supabase.from('summits').select('id,name,height,region,essential,url').order('name').then(({ data, error }) => {
      if (!active) return
      setSummits(data?.length ? data as Summit[] : catalogSeed as Summit[])
      if (error) setNotice('No hem pogut llegir el catàleg de Supabase. Comprovarem la connexió aviat.')
      setReady(true)
    })

    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ? { id: data.user.id, email: data.user.email } : null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
      if (!session) setAscents(new Map())
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    if (!supabase || !user) return
    const currentSupabase = supabase
    const currentUser = user
    let active = true
    async function loadAscents() {
      const { data, error } = await currentSupabase
        .from('ascent_records')
        .select('summit_id,completed_at,photo_path')
        .eq('user_id', currentUser.id)
      if (!active) return
      if (error) {
        setNotice('No hem pogut carregar els teus cims. Torna-ho a provar d’aquí a un moment.')
        return
      }
      const rows = (data ?? []) as Ascent[]
      const paths = rows.flatMap(row => row.photo_path ? [row.photo_path] : [])
      const signed = paths.length
        ? await currentSupabase.storage.from('summit-photos').createSignedUrls(paths, 60 * 60 * 24)
        : { data: [], error: null }
      const urls = new Map((signed.data ?? []).map(item => [item.path, item.signedUrl]))
      if (active) setAscents(new Map(rows.map(row => [row.summit_id, { ...row, photoUrl: row.photo_path ? urls.get(row.photo_path) ?? undefined : undefined }])))
    }
    void loadAscents()
    return () => { active = false }
  }, [supabase, user])

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ca')
    return summits.filter(summit => {
      const done = ascents.has(summit.id)
      if (filter === 'pending' && done) return false
      if (filter === 'done' && !done) return false
      if (filter === 'essential' && !summit.essential) return false
      return !term || `${summit.name} ${summit.region}`.toLocaleLowerCase('ca').includes(term)
    }).sort((a, b) => sortBy === 'height'
      ? b.height - a.height || a.name.localeCompare(b.name, 'ca')
      : a.name.localeCompare(b.name, 'ca'))
  }, [summits, ascents, filter, search, sortBy])

  const completed = [...ascents.values()]
  const essentialDone = completed.filter(ascent => summits.find(summit => summit.id === ascent.summit_id)?.essential).length
  const photoCount = completed.filter(ascent => ascent.photo_path).length
  const essentialTotal = summits.filter(summit => summit.essential).length
  const progress = Math.min(100, Math.round(essentialDone / target * 100))

  async function sendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setNotice('Falta configurar Supabase. Revisa les variables del fitxer .env.local.')
      return
    }
    setSendingLink(true)
    setNotice('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: getAuthCallbackUrl() },
    })
    setSendingLink(false)
    setNotice(error ? 'No s’ha pogut enviar l’enllaç. Revisa el correu i torna-ho a provar.' : 'T’hem enviat un enllaç d’accés al correu. Obre’l per continuar.')
    if (!error) setAuthOpen(false)
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setNotice('Falta configurar Supabase. Revisa les variables del fitxer .env.local.')
      return
    }
    setSigningInWithGoogle(true)
    setGoogleError('')
    setNotice('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthCallbackUrl() },
    })
    if (error) {
      setGoogleError(t('No s’ha pogut iniciar sessió amb Google. Revisa que el proveïdor estigui activat a Supabase i torna-ho a provar.'))
      setSigningInWithGoogle(false)
    }
  }

  async function toggleDone(summit: Summit) {
    if (!user || !supabase) { setAuthOpen(true); return }
    setBusyId(summit.id)
    setBusyLabel('Desant…')
    setNotice('')
    const current = ascents.get(summit.id)
    if (!current) {
      const { error } = await supabase.from('ascent_records').insert({ user_id: user.id, summit_id: summit.id, completed_at: localDate() })
      if (error) setNotice('No s’ha pogut desar l’ascensió. Torna-ho a provar.')
      else setAscents(previous => new Map(previous).set(summit.id, { summit_id: summit.id, completed_at: localDate(), photo_path: null }))
    } else {
      const { error } = await supabase.from('ascent_records').delete().eq('user_id', user.id).eq('summit_id', summit.id)
      if (error) setNotice('No s’ha pogut desmarcar aquest cim. Torna-ho a provar.')
      else {
        if (current.photo_path) await supabase.storage.from('summit-photos').remove([current.photo_path])
        setAscents(previous => { const next = new Map(previous); next.delete(summit.id); return next })
      }
    }
    setBusyId(null)
  }

  async function uploadPhoto(summit: Summit, file?: File) {
    if (!file) return
    if (!user || !supabase) { setAuthOpen(true); return }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      setNotice('Fes servir una imatge JPEG, PNG, WebP o AVIF.')
      return
    }
    if (file.size > rawImageLimit) {
      setNotice('La imatge original ha de pesar menys de 24 MB per poder optimitzar-la amb seguretat.')
      return
    }
    setBusyId(summit.id)
    setBusyLabel('Optimitzant…')
    setNotice('')
    let optimized: File
    try {
      optimized = await optimizePhoto(file)
    } catch {
      setNotice('No hem pogut llegir aquesta imatge. Prova amb un JPEG, PNG o WebP.')
      setBusyId(null)
      return
    }
    if (optimized.size > imageLimit) {
      setNotice('La foto encara pesa massa després d’optimitzar-la. Tria una imatge més petita.')
      setBusyId(null)
      return
    }
    setBusyLabel('Pujant foto…')
    const extension = optimized.type === 'image/webp' ? 'webp' : 'jpg'
    const nextPath = `${user.id}/${summit.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('summit-photos').upload(nextPath, optimized, { contentType: optimized.type, upsert: false })
    if (uploadError) {
      setNotice('No s’ha pogut pujar la foto. Torna-ho a provar.')
      setBusyId(null)
      return
    }
    const { error: saveError } = await supabase.from('ascent_records').upsert({ user_id: user.id, summit_id: summit.id, completed_at: ascents.get(summit.id)?.completed_at ?? localDate(), photo_path: nextPath }, { onConflict: 'user_id,summit_id' })
    if (saveError) {
      await supabase.storage.from('summit-photos').remove([nextPath])
      setNotice('La foto s’ha pujat, però no hem pogut desar el registre. Torna-ho a provar.')
      setBusyId(null)
      return
    }
    const { data: signed } = await supabase.storage.from('summit-photos').createSignedUrl(nextPath, 60 * 60 * 24)
    const oldPath = ascents.get(summit.id)?.photo_path
    if (oldPath) await supabase.storage.from('summit-photos').remove([oldPath])
    setAscents(previous => new Map(previous).set(summit.id, {
      summit_id: summit.id,
      completed_at: previous.get(summit.id)?.completed_at ?? localDate(),
      photo_path: nextPath,
      photoUrl: signed?.signedUrl,
    }))
    setBusyId(null)
    const savedKilobytes = Math.round(optimized.size / 1024)
    setNotice(`Foto optimitzada (${savedKilobytes} KB) i guardada per a ${summit.name}.`)
  }

  async function signOut() {
    if (!supabase) return
    setSigningOut(true)
    const { error } = await supabase.auth.signOut()
    setSigningOut(false)
    setProfileOpen(false)
    setNotice(error ? t('No s’ha pogut tancar la sessió. Torna-ho a provar.') : 'Has tancat la sessió.')
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#inici" aria-label="100 Cims, inici"><span className="brand-mark">▲</span><span>100<span className="brand-light">CIMS</span></span></a>
        <nav><a className="active" href="#cims">{t('El meu repte')}</a><a href="https://www.feec.cat/activitats/100-cims/" target="_blank" rel="noreferrer">{t('Catàleg FEEC ↗')}</a></nav>
        <div className="header-actions" ref={headerActionsRef}>
          <button className="settings-trigger" type="button" aria-label={t('Configuració')} aria-expanded={settingsOpen} aria-controls="settings-panel" onClick={() => { setSettingsOpen(open => !open); setProfileOpen(false) }}><span aria-hidden="true">⚙</span></button>
          {user ? <div className="profile-menu-wrap">
            <button className="profile-trigger" type="button" aria-label={`${t('El teu compte')}: ${user.email ?? ''}`} aria-haspopup="dialog" aria-expanded={profileOpen} aria-controls="account-menu" onClick={() => { setProfileOpen(open => !open); setSettingsOpen(false) }}>
              <span className="profile-avatar" aria-hidden="true">{user.email?.[0]?.toLocaleUpperCase() ?? 'G'}</span>
              <span className="profile-email">{user.email}</span>
              <span className="profile-chevron" aria-hidden="true" />
            </button>
            {profileOpen && <section className="account-menu" id="account-menu" role="dialog" aria-label={t('El teu compte')}>
              <div className="account-menu-user" role="presentation"><span className="profile-avatar" aria-hidden="true">{user.email?.[0]?.toLocaleUpperCase() ?? 'G'}</span><span><strong>{t('El teu compte')}</strong><small>{user.email}</small></span></div>
              <div className="account-menu-divider" />
              <button className="signout-button" type="button" onClick={() => void signOut()} disabled={signingOut}><span className="signout-icon" aria-hidden="true">↪</span>{signingOut ? t('Tancant sessió…') : t('Tancar sessió')}</button>
            </section>}
          </div> : <button className="signin-link" onClick={() => setAuthOpen(true)}>{t('Inicia sessió')}</button>}
          {settingsOpen && <section className="settings-panel" id="settings-panel" role="dialog" aria-label={t('Configuració')}>
            <div className="settings-heading"><div><span className="menu-eyebrow">100CIMS</span><strong>{t('Configuració')}</strong></div><button type="button" onClick={() => setSettingsOpen(false)} aria-label={t('Tancar')}>×</button></div>
            <label><span>{t('Tema')}</span><span className="select-wrap"><select value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="light">☀ {t('Clar')}</option><option value="dark">☾ {t('Fosc')}</option></select></span></label>
            <label><span>{t('Idioma')}</span><span className="select-wrap"><select value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="ca">Català</option><option value="es">Español</option><option value="en">English</option></select></span></label>
          </section>}
        </div>
      </header>

      <section className="hero" id="inici">
        <div className="hero-copy"><p className="eyebrow">{t('EL TEU QUADERN DE MUNTANYA')}</p><h1>{t('Cada cim, una')}<br /><em>{t('història.')}</em></h1><p className="intro">{t('Guarda els teus records i descobreix fins on t’ha portat el camí.')}</p></div>
        <div className="hero-art" aria-hidden="true"><div className="sun" /><div className="ridge ridge-back" /><div className="ridge ridge-front" /><div className="art-label">PIRINEU<br /><span>42° 32′ N · 1° 36′ E</span></div></div>
      </section>

      {!user && <section className="account-hint"><span className="hint-icon">↗</span><span><strong>{t('El teu progrés t’acompanya.')}</strong> {t('Inicia sessió per desar cims i fotos al teu compte.')}</span><button onClick={() => setAuthOpen(true)}>{t('Accedir amb el correu')}</button></section>}

      <section className="progress-panel" aria-label="Progrés del repte">
        <div className="progress-heading"><div><p className="eyebrow">{t('EL REPTE DELS 100 CIMS')}</p><h2>{t('El teu camí fins als 100')}</h2></div><div className="progress-numbers"><strong>{essentialDone}</strong><span> / 100</span></div></div>
        <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>
        <div className="progress-footer"><span>{completed.length ? (language === 'es' ? `Ya tienes ${completed.length} ${completed.length === 1 ? 'cima' : 'cimas'} en tu cuaderno, ${essentialDone} esenciales.` : language === 'en' ? `${completed.length} ${completed.length === 1 ? 'summit' : 'summits'} in your journal, ${essentialDone} essential.` : `Ja tens ${completed.length} ${completed.length === 1 ? 'cim' : 'cims'} al teu quadern, ${essentialDone} d’essencials.`) : t('Encara no has registrat cap ascensió. Tot comença amb el primer pas.')}</span><span>{progress}%</span></div>
        <div className="stats"><div><strong>{completed.length}</strong><span>{language === 'es' ? 'cimas hechas' : language === 'en' ? 'summits done' : 'cims fets'}</span></div><div><strong>{essentialDone}<span className="stat-total"> / {essentialTotal}</span></strong><span>{language === 'es' ? 'esenciales hechas' : language === 'en' ? 'essential done' : 'essencials fets'}</span></div><div><strong>{photoCount}</strong><span>{language === 'es' ? 'recuerdos guardados' : language === 'en' ? 'memories saved' : 'records guardats'}</span></div></div>
      </section>

      <section className="catalog" id="cims">
        <div className="section-heading"><div><p className="eyebrow">{t('EL TEU CATÀLEG')}</p><h2>{t('Tria el pròxim cim')}</h2></div><span className="catalog-count"><b>{visible.length}</b> {language === 'es' ? 'montañas' : language === 'en' ? 'summits' : 'muntanyes'}</span></div>
        <div className="toolbar"><label className="search"><span>⌕</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Cerca un cim o una comarca...')} aria-label={t('Cerca per cim o comarca')} /></label><div className="filters" role="group" aria-label={t('Filtrar cims')}>
          {([['all', 'Tots'], ['pending', 'Pendents'], ['done', 'Fets'], ['essential', '✦ Essencials']] as const).map(([value, label]) => <button key={value} className={`filter ${filter === value ? 'active' : ''} ${value === 'essential' ? 'essential-filter' : ''}`} onClick={() => setFilter(value)}>{t(label)}{value === 'all' && <span>{summits.length}</span>}</button>)}
        </div></div>
        <div className="sort-row"><span>{ready ? `${visible.length} ${visible.length === 1 ? (language === 'es' ? 'montaña' : language === 'en' ? 'summit' : 'muntanya') : (language === 'es' ? 'montañas' : language === 'en' ? 'summits' : 'muntanyes')} ${language === 'es' ? 'en el catálogo' : language === 'en' ? 'in catalogue' : 'al catàleg'}` : (language === 'es' ? 'Cargando catálogo…' : language === 'en' ? 'Loading catalogue…' : 'Carregant el catàleg…')}</span><label>{t('Ordena per')} <span className="select-wrap sort-select"><select value={sortBy} onChange={event => setSortBy(event.target.value as 'name' | 'height')}><option value="name">{t('Nom A–Z')}</option><option value="height">{t('Altitud')}</option></select></span></label></div>
        <div className="grid" aria-live="polite">{visible.map(summit => {
          const ascent = ascents.get(summit.id)
          const busy = busyId === summit.id
          return <article className="card" key={summit.id}>
            <div className={`thumb ${ascent?.photoUrl ? 'has-summit-photo' : 'has-placeholder'}`}>
              {ascent?.photoUrl ? <Image src={ascent.photoUrl} alt={`Foto de ${summit.name}`} fill sizes="(max-width: 560px) 50vw, (max-width: 820px) 50vw, 33vw" /> : <MountainPlaceholder name={summit.name} height={summit.height} region={summit.region} />}
              {!ascent?.photoUrl && <span className="thumb-badge">{t('Il·lustració de referència')}</span>}
            </div>
            <div className="card-body">
              <div className="card-meta">{summit.essential && <span className="essential-tag">{language === 'es' ? '✦ Esencial' : language === 'en' ? '✦ Essential' : '✦ Essencial'}</span>}{ascent && <span className="done-tag">✓ {t('Fets')}</span>}</div>
              <h3 title={summit.name}>{summit.name}</h3><div className="card-detail">{summit.height.toLocaleString('ca-ES')} m · {summit.region.replace(/\s*,\s*/g, ' · ')}</div>
              <div className="card-actions"><button className={`mark-button ${ascent ? 'is-done' : ''}`} onClick={() => void toggleDone(summit)} disabled={busy}>{busy ? busyLabel : ascent ? `✓ ${friendlyDate(ascent.completed_at, language)}` : t('+ Marcar fet')}</button><label className={`photo-button ${ascent?.photo_path ? 'has-photo' : ''}`} aria-label={`${t('Pujar una foto de')} ${summit.name}`}>{ascent?.photo_path ? `▣ ${t('Canviar foto')}` : t('＋ Foto')}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { void uploadPhoto(summit, event.target.files?.[0]); event.currentTarget.value = '' }} disabled={busy} /></label></div>
            </div>
          </article>
        })}{ready && visible.length === 0 && <div className="empty">No hem trobat cap cim amb aquests filtres.</div>}</div>
        <p className="source-note">{language === 'es' ? 'Catálogo oficial de los 100 Cims de la' : language === 'en' ? 'Official 100 Cims catalogue by' : 'Catàleg oficial dels 100 Cims de la'} <a href="https://www.feec.cat/activitats/100-cims/" target="_blank" rel="noreferrer">FEEC ↗</a> · {language === 'es' ? '522 montañas, 150 esenciales. El reto se completa con 100 de esas 150.' : language === 'en' ? '522 summits, 150 essential. Complete 100 of those 150.' : '522 cims, 150 essencials. El repte es completa amb 100 d’aquests 150.'} · {language === 'es' ? 'Ilustración de referencia: ilustración original de 100CimsCat.' : language === 'en' ? 'Reference illustration: original artwork by 100CimsCat.' : 'Il·lustració de referència: il·lustració pròpia de 100CimsCat.'}</p>
      </section>

      {notice && <div className="toast show" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tancar avís">×</button></div>}
      <footer>{t('Fet per recordar els camins, no només els cims.')} <span>100CIMS · 2026</span></footer>

      {authOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false) }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Tancar">×</button><p className="eyebrow">{t('El teu quadern, sempre amb tu.')}</p><h2 id="auth-title">{t('Entra al teu camí')}</h2><p>{t('T’enviarem un enllaç segur al correu per guardar les ascensions i les fotos al teu compte.')}</p><button type="button" className="google-signin" onClick={() => void signInWithGoogle()} disabled={signingInWithGoogle}>{signingInWithGoogle ? '…' : <><span className="google-mark" aria-hidden="true">G</span>{t('Continua amb Google')}</>}</button>{googleError && <p className="google-error" role="alert">{googleError}</p>}<div className="auth-divider"><span>{t('o bé')}</span></div><form onSubmit={sendMagicLink}><label htmlFor="email">{t('Correu electrònic')}</label><input id="email" type="email" required autoComplete="email" placeholder="tu@exemple.cat" value={email} onChange={event => setEmail(event.target.value)} /><button className="mark-button" disabled={sendingLink}>{sendingLink ? t('Enviant…') : t('Envia’m l’enllaç d’accés')}</button></form><small>{t('Les teves fotos són privades i només les pot veure el teu compte.')}</small></section></div>}
    </main>
  )
}
