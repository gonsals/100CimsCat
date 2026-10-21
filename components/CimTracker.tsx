'use client'

import Image from 'next/image'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import catalogSeed from '@/data/summits.json'
import MountainPlaceholder from '@/components/MountainPlaceholder'
import SummitDetailsModal from '@/components/SummitDetailsModal'
import CatalogFilters from '@/components/CatalogFilters'
import AscentEditor from '@/components/AscentEditor'
import Journal from '@/components/Journal'
import { SiteHeader, SiteFooter, SkipLink } from '@/components/SiteChrome'
import Icon from '@/components/Icon'
import { preferenceEvent } from '@/lib/use-preferences'
import { ascentKey, latestAscents, coordinates, defaultFilters, distanceKm, filterCatalog, friendlyDate, validAscentDate, type Ascent, type CatalogFilter, type Coordinate, type Language, type SortBy, type Summit } from '@/lib/tracker'
import { catalogSignature, catalogStateKey, parseCatalogState } from '@/lib/catalog-state'
import { trackerText } from '@/lib/tracker-i18n'
import { useModalAccessibility } from '@/lib/use-modal-accessibility'

const SummitMap = dynamic(() => import('@/components/SummitMap'), {
  ssr: false,
  loading: () => <div className="summit-map-loading" aria-hidden="true" />,
})

function getAuthCallbackUrl() {
  return `${window.location.origin}/auth/callback`
}

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
class PhotoUploadError extends Error {}
const imageLimit = 512 * 1024
const rawImageLimit = 24 * 1024 * 1024
const preferredImageSize = imageLimit
async function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No s’ha pogut processar la imatge.')), type, quality)
  })
}

async function optimizePhoto(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    const maxDimension = 1440
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Aquest navegador no pot processar la imatge.')
    context.fillStyle = '#f5f4ef'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    let output = await encodeCanvas(canvas, 'image/webp', 0.78)
    if (output.type !== 'image/webp') output = await encodeCanvas(canvas, 'image/jpeg', 0.78)
    for (const quality of [0.68, 0.58, 0.48]) {
      if (output.size <= preferredImageSize) break
      output = await encodeCanvas(canvas, output.type, quality)
    }
    if (output.size > preferredImageSize) throw new Error('La imatge no es pot comprimir prou.')

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

export default function CimTracker() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  const supabase = useMemo(() => configured ? createClient() : null, [configured])
  const [summits, setSummits] = useState<Summit[]>(catalogSeed as Summit[])
  const [visits, setVisits] = useState<Ascent[]>([])
  const ascents = useMemo(() => latestAscents(visits), [visits])
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [ready, setReady] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<CatalogFilter>(defaultFilters)
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [origin, setOrigin] = useState<Coordinate | null>(null)
  const [originLabel, setOriginLabel] = useState('')
  const [editingSummit, setEditingSummit] = useState<Summit | null>(null)
  const [editingVisitKey, setEditingVisitKey] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const userIdRef = useRef<string | null>(null)
  userIdRef.current = user?.id ?? null
  const editingAscent = visits.find(visit => ascentKey(visit) === editingVisitKey)
  const [journalReady, setJournalReady] = useState(false)
  const [journalError, setJournalError] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)
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
  const [selectedSummit, setSelectedSummit] = useState<Summit | null>(null)
  const [catalogView, setCatalogView] = useState<'list' | 'map'>('list')
  const [pagination, setPagination] = useState({ key: '', limit: 48 })
  const pendingScroll = useRef<number | null>(null)
  const [storageBytes, setStorageBytes] = useState<number | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const headerActionsRef = useRef<HTMLDivElement>(null)
  const handledIntent = useRef(false)
  const t = (value: string) => translations[language][value] ?? trackerText(language, value)
  const closeAccountDialog = useCallback(() => { setAuthOpen(false); setDeleteOpen(false) }, [])
  useModalAccessibility(authOpen || deleteOpen, !deletingAccount && !sendingLink && !signingInWithGoogle, closeAccountDialog)

  useEffect(() => {
    try {
      const savedLanguage = localStorage.getItem('100cimscat-language')
      const savedTheme = localStorage.getItem('100cimscat-theme')
      if (savedLanguage === 'ca' || savedLanguage === 'es' || savedLanguage === 'en') setLanguage(savedLanguage)
      if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme)
      const saved = parseCatalogState(sessionStorage.getItem(catalogStateKey))
      const selectedId = new URLSearchParams(window.location.search).get('cim')
      const selected = catalogSeed.find(summit => summit.id === selectedId)
      if (selected) {
        setSearch(selected.name)
        setFilters(defaultFilters)
      } else if (saved) {
        setSearch(saved.search); setFilters(saved.filters); setSortBy(saved.sortBy)
        setCatalogView(saved.view); setOrigin(saved.origin); setOriginLabel(saved.originLabel)
        setPagination({ key: catalogSignature(saved.filters, saved.search, saved.sortBy, saved.origin), limit: saved.limit })
        pendingScroll.current = saved.scrollY
      }
    } catch { /* Use defaults when browser storage is unavailable. */ }
    finally { setPreferencesReady(true) }
  }, [])

  useEffect(() => {
    if (!preferencesReady) return
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = language
    window.dispatchEvent(new Event(preferenceEvent))
    try {
      localStorage.setItem('100cimscat-theme', theme)
      localStorage.setItem('100cimscat-language', language)
    } catch { /* Preferences still work if browser storage is unavailable. */ }
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
      setAuthReady(true)
      return
    }

    supabase.from('summits').select('id,name,height,region,essential,url').order('name').then(({ data, error }) => {
      if (!active) return
      setSummits(data?.length ? data as Summit[] : catalogSeed as Summit[])
      if (error) setNotice('No hem pogut llegir el catàleg de Supabase. Comprovarem la connexió aviat.')
      setReady(true)
    })

    supabase.auth.getUser().then(({ data }) => {
      if (active) { setUser(data.user ? { id: data.user.id, email: data.user.email } : null); setAuthReady(true) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
      if (!session) { setVisits([]); setFavorites(new Set()); setJournalReady(false); setEditingSummit(null) }
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
    setJournalReady(false)
    setJournalError(false)
    setVisits([])
    setFavorites(new Set())
    async function loadAscents() {
      async function loadAllVisits() {
        const rows: Ascent[] = []
        for (let from = 0; ; from += 500) {
          const result = await currentSupabase.from('ascent_visits').select('id,summit_id,completed_at,photo_path,notes,created_at').eq('user_id', currentUser.id).order('completed_at', { ascending: false }).order('id').range(from, from + 499)
          if (!active || result.error) return { data: rows, error: result.error }
          rows.push(...result.data as Ascent[])
          if (result.data.length < 500) return { data: rows, error: null }
        }
      }
      const [{ data, error }, favoriteResult, repeatedResult] = await Promise.all([
        currentSupabase.from('ascent_records').select('summit_id,completed_at,photo_path,notes,created_at').eq('user_id', currentUser.id),
        currentSupabase.from('summit_favorites').select('summit_id').eq('user_id', currentUser.id),
        loadAllVisits(),
      ])
      if (!active) return
      if (error || favoriteResult.error || repeatedResult.error) {
        setJournalError(true)
        return
      }
      setFavorites(new Set((favoriteResult.data ?? []).map(row => row.summit_id)))
      const rows = [...(data ?? []), ...(repeatedResult.data ?? [])] as Ascent[]
      const paths = rows.flatMap(row => row.photo_path ? [row.photo_path] : [])
      const signed = paths.length
        ? await currentSupabase.storage.from('summit-photos').createSignedUrls(paths, 60 * 60 * 24)
        : { data: [], error: null }
      const urls = new Map((signed.data ?? []).map(item => [item.path, item.signedUrl]))
      if (active) {
        setVisits(rows.map(row => ({ ...row, photoUrl: row.photo_path ? urls.get(row.photo_path) ?? undefined : undefined })))
        setJournalReady(true)
      }
    }
    void loadAscents().catch(() => { if (active) setJournalError(true) })
    return () => { active = false }
  }, [supabase, user?.id, loadVersion])

  const visible = useMemo(() => filterCatalog(summits, ascents, favorites, filters, search, sortBy, origin), [summits, ascents, favorites, filters, search, sortBy, origin])
  const catalogKey = catalogSignature(filters, search, sortBy, origin)
  const catalogLimit = pagination.key === catalogKey ? pagination.limit : 48
  const catalogSnapshot = useRef({ search, filters, sortBy, view: catalogView, limit: catalogLimit, origin, originLabel })
  catalogSnapshot.current = { search, filters, sortBy, view: catalogView, limit: catalogLimit, origin, originLabel }

  useEffect(() => {
    if (!ready || !authReady || !preferencesReady || (user && !journalReady) || pendingScroll.current === null) return
    let active = true
    void document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (active && pendingScroll.current !== null) { window.scrollTo(0, pendingScroll.current); pendingScroll.current = null }
    })))
    return () => { active = false }
  }, [ready, authReady, preferencesReady, user, journalReady])

  useEffect(() => {
    if (!preferencesReady) return
    const pathname = window.location.pathname
    const persist = () => {
      // Next can reset scroll before the outgoing catalogue has unmounted.
      if (pendingScroll.current !== null || window.location.pathname !== pathname) return
      try { sessionStorage.setItem(catalogStateKey, JSON.stringify({ version: 1, ...catalogSnapshot.current, scrollY: window.scrollY })) } catch { /* Browsing works without storage. */ }
    }
    persist()
    window.addEventListener('scroll', persist, { passive: true })
    window.addEventListener('pagehide', persist)
    return () => { window.removeEventListener('scroll', persist); window.removeEventListener('pagehide', persist) }
  }, [preferencesReady, search, filters, sortBy, catalogView, catalogLimit, origin, originLabel])

  const completed = [...ascents.values()]
  const essentialDone = completed.filter(ascent => summits.find(summit => summit.id === ascent.summit_id)?.essential).length
  const photoCount = visits.filter(ascent => ascent.photo_path).length
  const essentialTotal = summits.filter(summit => summit.essential).length
  const progress = Math.min(100, Math.round(essentialDone / target * 100))

  useEffect(() => {
    if (!settingsOpen || !supabase || !user) return
    let active = true
    supabase.rpc('get_my_photo_storage_bytes').then(({ data }) => {
      if (active) setStorageBytes(data == null ? null : Number(data))
    })
    return () => { active = false }
  }, [settingsOpen, supabase, user])

  async function shareProgress() {
    setSharing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1080; canvas.height = 1350
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      ctx.fillStyle = '#f1f0e8'; ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#234334'; ctx.fillRect(0, 0, canvas.width, 20)
      ctx.fillStyle = '#70816f'; ctx.font = '600 30px sans-serif'; ctx.fillText('100CIMS CAT', 90, 130)
      ctx.fillStyle = '#263d30'; ctx.font = '700 62px sans-serif'; ctx.fillText(language === 'es' ? 'MI CAMINO' : language === 'en' ? 'MY JOURNEY' : 'EL MEU CAMÍ', 90, 235)
      ctx.fillStyle = '#49694c'; ctx.font = '600 205px sans-serif'; ctx.fillText(String(essentialDone), 82, 520)
      ctx.fillStyle = '#718170'; ctx.font = '500 48px sans-serif'; ctx.fillText('/ 100', 400, 510)
      ctx.fillStyle = '#536452'; ctx.font = '500 34px sans-serif'; ctx.fillText(language === 'es' ? 'cimas esenciales completadas' : language === 'en' ? 'essential summits completed' : 'cims essencials fets', 95, 590)
      ctx.fillStyle = '#d4dfd0'; ctx.beginPath(); ctx.moveTo(0,1050); ctx.lineTo(360,690); ctx.lineTo(610,940); ctx.lineTo(820,720); ctx.lineTo(1080,1020); ctx.lineTo(1080,1350); ctx.lineTo(0,1350); ctx.fill()
      ctx.fillStyle = '#a8bea4'; ctx.beginPath(); ctx.moveTo(0,1180); ctx.lineTo(250,930); ctx.lineTo(470,1120); ctx.lineTo(760,860); ctx.lineTo(1080,1170); ctx.lineTo(1080,1350); ctx.lineTo(0,1350); ctx.fill()
      ctx.fillStyle = '#263d30'; ctx.font = '600 38px sans-serif'; ctx.fillText(`${completed.length} ${language === 'es' ? 'cimas en mi cuaderno' : language === 'en' ? 'summits in my journal' : 'cims al meu quadern'}`,95,1240)
      ctx.fillStyle = '#718170'; ctx.font = '500 25px sans-serif'; ctx.fillText('100-cims-cat.vercel.app',95,1300)
      const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('png')),'image/png'))
      const file = new File([blob],'el-meu-progres-100-cims.png',{type:'image/png'})
      if (navigator.canShare?.({files:[file]})) await navigator.share({files:[file],title:'100 Cims',text:t('El meu progrés als 100 Cims')})
      else { const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=file.name; link.click(); URL.revokeObjectURL(url) }
    } catch { setNotice(language==='es'?'No se pudo crear la imagen de progreso.':language==='en'?'Could not create the progress image.':'No s’ha pogut crear la imatge de progrés.') }
    finally { setSharing(false) }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== 'ELIMINAR') return
    setDeletingAccount(true)
    try {
      const response = await fetch('/api/account',{method:'DELETE'})
      if (!response.ok) throw new Error(response.status===503?'config':'delete')
      await supabase?.auth.signOut({scope:'local'})
      setUser(null); setVisits([]); setDeleteOpen(false); setSettingsOpen(false); setProfileOpen(false)
      setNotice(language==='es'?'Cuenta y fotos eliminadas.':language==='en'?'Account and photos deleted.':'Compte i fotos eliminats.')
    } catch(error) {
      setNotice(error instanceof Error && error.message==='config'?'Falta SUPABASE_SERVICE_ROLE_KEY al servidor per activar el borrat de compte.':language==='es'?'No se pudo borrar la cuenta. Inténtalo de nuevo.':language==='en'?'Could not delete the account. Try again.':'No s’ha pogut esborrar el compte. Torna-ho a provar.')
    } finally { setDeletingAccount(false) }
  }

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

  function editAscent(summit: Summit, visit: Ascent | null | undefined = ascents.get(summit.id)) {
    if (!user || !supabase) { setSelectedSummit(null); setAuthOpen(true); return }
    if (!journalReady || busyId) return
    setSelectedSummit(null)
    setNotice('')
    setEditingVisitKey(visit ? ascentKey(visit) : null)
    setEditorKey(previous => previous + 1)
    setEditingSummit(summit)
  }

  async function saveAscent(date: string, notes: string, file?: File) {
    if (!user || !supabase || !editingSummit || busyId) return
    if (!validAscentDate(date) || notes.length > 4000) { setNotice('Tria una data vàlida que no sigui futura.'); return }
    const summit = editingSummit
    const accountId = user.id
    if (file) { const validation = validatePhoto(file); if (validation) { setNotice(validation); return } }
    setBusyId(summit.id)
    setBusyLabel('Desant…')
    setNotice('')
    let saved: Ascent | undefined
    try {
      const existing = editingAscent
      const table = existing?.id || (!existing && visits.some(visit => visit.summit_id === summit.id)) ? 'ascent_visits' : 'ascent_records'
      const result = existing
        ? supabase.from(table).update({ completed_at: date, notes }).eq('user_id', user.id).eq(existing.id ? 'id' : 'summit_id', existing.id ?? summit.id)
        : supabase.from(table).insert({ user_id: user.id, summit_id: summit.id, completed_at: date, notes })
      const { data, error } = await result.select(table === 'ascent_visits' ? 'id,summit_id,completed_at,photo_path,notes,created_at' : 'summit_id,completed_at,photo_path,notes,created_at').single()
      if (error) throw error
      saved = { ...existing, ...(data as unknown as Ascent) }
      if (userIdRef.current !== accountId) return
      const savedRecord = saved
      setVisits(previous => [...previous.filter(visit => !existing || ascentKey(visit) !== ascentKey(existing)), savedRecord])
      setEditingVisitKey(ascentKey(savedRecord))
      if (file) {
        const withPhoto = await persistPhoto(summit, file, savedRecord, accountId)
        if (userIdRef.current !== accountId) return
        setVisits(previous => previous.map(visit => ascentKey(visit) === ascentKey(savedRecord) ? withPhoto : visit))
      }
      setEditingSummit(null)
      setNotice(file ? 'Ascensió i foto guardades.' : 'Ascensió guardada.')
    } catch (error) {
      if (userIdRef.current !== accountId) return
      setNotice(saved ? `${t('L’ascensió està guardada, però falta la foto. Torna a prémer Desar per pujar-la.')} ${t(error instanceof PhotoUploadError ? error.message : 'No s’ha pogut pujar la foto. Torna-ho a provar.')}` : 'No s’ha pogut desar l’ascensió. Torna-ho a provar.')
    }
    finally { setBusyId(null) }
  }

  async function deleteAscent() {
    if (!user || !supabase || !editingSummit || busyId) return
    const summit = editingSummit
    const current = editingAscent
    if (!current) return
    setBusyId(summit.id)
    setNotice('')
    try {
      if (current.photo_path) {
        const { error } = await supabase.storage.from('summit-photos').remove([current.photo_path])
        if (error) { setNotice('No s’ha pogut eliminar la foto. L’ascensió es conserva; torna-ho a provar.'); return }
        // Reflect successful photo removal even if deleting the record fails afterwards.
        setVisits(previous => previous.map(visit => ascentKey(visit) === ascentKey(current) ? { ...visit, photo_path: null, photoUrl: undefined } : visit))
      }
      const { data, error } = await supabase.from(current.id ? 'ascent_visits' : 'ascent_records').delete().eq('user_id', user.id).eq(current.id ? 'id' : 'summit_id', current.id ?? summit.id).select('summit_id')
      if (error || !data?.length) throw error ?? new Error('No ascent deleted')
      setVisits(previous => previous.filter(visit => ascentKey(visit) !== ascentKey(current)))
      setEditingSummit(null)
      setNotice('Ascensió eliminada.')
    } catch { setNotice('No s’ha pogut desmarcar aquest cim. Torna-ho a provar.') }
    finally { setBusyId(null) }
  }

  async function toggleFavorite(summit: Summit) {
    if (!user || !supabase) { setSelectedSummit(null); setAuthOpen(true); return }
    if (!journalReady || busyId) return
    const remove = favorites.has(summit.id)
    setBusyId(summit.id)
    try {
      const result = remove
        ? await supabase.from('summit_favorites').delete().eq('user_id', user.id).eq('summit_id', summit.id).select('summit_id')
        : await supabase.from('summit_favorites').insert({ user_id: user.id, summit_id: summit.id }).select('summit_id')
      if (result.error || !result.data?.length) throw result.error ?? new Error('No favorite saved')
      setFavorites(previous => { const next = new Set(previous); if (remove) next.delete(summit.id); else next.add(summit.id); return next })
    } catch { setNotice('No s’ha pogut desar el preferit. Torna-ho a provar.') }
    finally { setBusyId(null) }
  }

  function changeOrigin(point: Coordinate | null, label: string) {
    setOrigin(point)
    setOriginLabel(label)
    setSortBy(point ? 'distance' : 'name')
  }

  function clearFilters() {
    setFilters(defaultFilters)
    setSearch('')
    setOrigin(null)
    setOriginLabel('')
    setSortBy('name')
  }

  function validatePhoto(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) return 'Fes servir una imatge JPEG, PNG, WebP o AVIF.'
    if (file.size > rawImageLimit) return 'La imatge original ha de pesar menys de 24 MB per poder optimitzar-la amb seguretat.'
    return ''
  }

  async function persistPhoto(summit: Summit, file: File, current: Ascent, accountId: string): Promise<Ascent> {
    if (!supabase) throw new PhotoUploadError('No s’ha pogut pujar la foto. Torna-ho a provar.')
    const validation = validatePhoto(file)
    if (validation) throw new PhotoUploadError(validation)
    setBusyLabel('Optimitzant…')
    let optimized: File
    try { optimized = await optimizePhoto(file) }
    catch { throw new PhotoUploadError('No hem pogut llegir aquesta imatge. Prova amb un JPEG, PNG o WebP.') }
    if (optimized.size > imageLimit) throw new PhotoUploadError('La foto encara pesa massa després d’optimitzar-la. Tria una imatge més petita.')
    if (userIdRef.current !== accountId) throw new PhotoUploadError('No s’ha pogut pujar la foto. Torna-ho a provar.')
    setBusyLabel('Pujant foto…')
    const nextPath = `${accountId}/${summit.id}/${crypto.randomUUID()}.${optimized.type === 'image/webp' ? 'webp' : 'jpg'}`
    const oldPath = current.photo_path
    const { data: allowed, error: quotaError } = await supabase.rpc('can_upload_summit_photo', { p_file_size: optimized.size, p_replace_path: oldPath })
    if (quotaError) throw new PhotoUploadError('Actualitza la migració de Supabase abans de pujar fotos.')
    if (allowed !== true) throw new PhotoUploadError('Has arribat al límit de 280 MB de fotos del teu compte. Esborra fotos per continuar.')
    const { error: uploadError } = await supabase.storage.from('summit-photos').upload(nextPath, optimized, { contentType: optimized.type, upsert: false, metadata: oldPath ? { replace_path: oldPath } : {} })
    if (uploadError) throw new PhotoUploadError('No s’ha pogut pujar la foto. Torna-ho a provar.')
    const { data, error } = await supabase.from(current.id ? 'ascent_visits' : 'ascent_records').update({ photo_path: nextPath }).eq('user_id', accountId).eq(current.id ? 'id' : 'summit_id', current.id ?? summit.id).select('summit_id').single()
    if (error || !data) {
      await supabase.storage.from('summit-photos').remove([nextPath])
      throw new PhotoUploadError('La foto s’ha pujat, però no hem pogut desar el registre. Torna-ho a provar.')
    }
    const { data: signed } = await supabase.storage.from('summit-photos').createSignedUrl(nextPath, 60 * 60 * 24)
    if (oldPath) await supabase.storage.from('summit-photos').remove([oldPath])
    return { ...current, photo_path: nextPath, photoUrl: signed?.signedUrl }
  }

  async function uploadPhoto(summit: Summit, file?: File, selectedVisit?: Ascent) {
    if (!file || busyId) return
    if (!user || !supabase) { setAuthOpen(true); return }
    if (!journalReady) return
    const current = selectedVisit ?? ascents.get(summit.id)
    if (!current) { editAscent(summit); return }
    const accountId = user.id
    setBusyId(summit.id); setNotice('')
    try {
      const saved = await persistPhoto(summit, file, current, accountId)
      if (userIdRef.current !== accountId) return
      setVisits(previous => previous.map(visit => ascentKey(visit) === ascentKey(current) ? saved : visit))
      setNotice('Foto optimitzada i guardada.')
    } catch (error) { if (userIdRef.current === accountId) setNotice(error instanceof PhotoUploadError ? error.message : 'No s’ha pogut pujar la foto. Torna-ho a provar.') }
    finally { setBusyId(null) }
  }

  async function refreshPhoto(visit: Ascent) {
    if (!supabase || !user || !visit.photo_path) throw new Error('Photo unavailable')
    const accountId = user.id
    const { data, error } = await supabase.storage.from('summit-photos').createSignedUrl(visit.photo_path, 60 * 60 * 24)
    if (error || !data?.signedUrl || userIdRef.current !== accountId) throw new Error('Photo unavailable')
    setVisits(previous => previous.map(item => ascentKey(item) === ascentKey(visit) ? { ...item, photoUrl: data.signedUrl } : item))
  }

  useEffect(() => {
    if (handledIntent.current || !authReady || !ready || (user && !journalReady)) return
    const query = new URLSearchParams(window.location.search)
    if (query.get('registrar') === '1') {
      const summit = summits.find(item => item.id === query.get('cim'))
      if (summit) { handledIntent.current = true; editAscent(summit) }
    } else if (query.get('quadern') === '1') {
      handledIntent.current = true
      if (!user) setAuthOpen(true)
      else requestAnimationFrame(() => document.getElementById('quadern')?.scrollIntoView())
    }
  }, [authReady, ready, user?.id, journalReady])

  async function signOut() {
    if (!supabase) return
    setSigningOut(true)
    const { error } = await supabase.auth.signOut()
    setSigningOut(false)
    setProfileOpen(false)
    setNotice(error ? t('No s’ha pogut tancar la sessió. Torna-ho a provar.') : 'Has tancat la sessió.')
  }

  return (
    <div className="shell"><SkipLink language={language} />
      <SiteHeader language={language} onJournal={() => { if (!user) setAuthOpen(true); else document.getElementById('quadern')?.scrollIntoView() }}>
        <div className="header-actions" ref={headerActionsRef}>
          <button className="settings-trigger icon-button" type="button" aria-label={t('Configuració')} aria-expanded={settingsOpen} aria-controls="settings-panel" onClick={() => { setSettingsOpen(open => !open); setProfileOpen(false) }}><Icon name="settings" /></button>
          {user ? <div className="profile-menu-wrap">
            <button className="profile-trigger" type="button" aria-label={`${t('El teu compte')}: ${user.email ?? ''}`} aria-haspopup="dialog" aria-expanded={profileOpen} aria-controls="account-menu" onClick={() => { setProfileOpen(open => !open); setSettingsOpen(false) }}>
              <span className="profile-avatar" aria-hidden="true">{user.email?.[0]?.toLocaleUpperCase() ?? 'G'}</span>
              <span className="profile-email">{user.email}</span>
              <span className="profile-chevron" aria-hidden="true" />
            </button>
            {profileOpen && <section className="account-menu" id="account-menu" role="dialog" aria-label={t('El teu compte')}>
              <div className="account-menu-user" role="presentation"><span className="profile-avatar" aria-hidden="true">{user.email?.[0]?.toLocaleUpperCase() ?? 'G'}</span><span><strong>{t('El teu compte')}</strong><small>{user.email}</small></span></div>
              <div className="account-menu-divider" />
              <button className="signout-button" type="button" onClick={() => void signOut()} disabled={signingOut || Boolean(busyId)}><Icon name="logout" />{signingOut ? t('Tancant sessió…') : t('Tancar sessió')}</button>
            </section>}
          </div> : <button className="signin-link" onClick={() => setAuthOpen(true)}>{t('Inicia sessió')}</button>}
          {settingsOpen && <section className="settings-panel" id="settings-panel" role="dialog" aria-label={t('Configuració')}>
            <div className="settings-heading"><div><span className="menu-eyebrow">100CIMS</span><strong>{t('Configuració')}</strong></div><button type="button" className="icon-button" onClick={() => setSettingsOpen(false)} aria-label={t('Tancar')}><Icon name="close" /></button></div>
            <label><span>{t('Tema')}</span><span className="select-wrap"><select aria-label={t('Tema')} value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="light">{t('Clar')}</option><option value="dark">{t('Fosc')}</option></select></span></label>
            <label><span>{t('Idioma')}</span><span className="select-wrap"><select aria-label={t('Idioma')} value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="ca">Català</option><option value="es">Español</option><option value="en">English</option></select></span></label>
            {user && <div className="account-storage"><span>{language==='es'?'Fotos privadas usadas':language==='en'?'Private photo storage':'Espai de fotos privat'}</span><strong>{storageBytes==null?'—':`${(storageBytes/1024/1024).toFixed(1)} / 280 MB`}</strong><button className="delete-account-trigger" type="button" onClick={()=>{setDeleteConfirmation('');setDeleteOpen(true)}}>{language==='es'?'Borrar cuenta':language==='en'?'Delete account':'Esborrar compte'}</button></div>}
          </section>}
        </div>
      </SiteHeader><main id="main-content" tabIndex={-1}>

      <section className="hero" id="inici">
        <div className="hero-copy"><p className="eyebrow">{t('EL TEU QUADERN DE MUNTANYA')}</p><h1>{t('Cada cim, una')}<br /><em>{t('història.')}</em></h1><p className="intro">{t('Guarda els teus records i descobreix fins on t’ha portat el camí.')}</p><div className="hero-actions"><a className="primary-button" href="#cims">{t('Explorar els cims')}<Icon name="down" /></a><a className="offline-reader-link" href="/offline.html">{t('Fitxes descarregades')}</a></div></div>
        <figure className="hero-art"><MountainPlaceholder summitId="pollego-superior-pedraforca" eager /><figcaption className="art-label">PEDRAFORCA<br /><span>2.506 m · Berguedà</span></figcaption></figure>
      </section>

      {!user && <section className="account-hint"><Icon name="book" size={23} /><span><strong>{t('El teu progrés t’acompanya.')}</strong> {t('Inicia sessió per desar cims i fotos al teu compte.')}</span><button onClick={() => setAuthOpen(true)}>{t('Accedir amb el correu')}<Icon name="arrow" size={15} /></button></section>}

      <section className={`progress-panel ${user ? '' : 'is-guest'}`} aria-label={t('Progrés del repte')}>
        <div className="progress-heading"><div><p className="eyebrow">{t('EL REPTE DELS 100 CIMS')}</p><h2>{t('El teu camí fins als 100')}</h2></div><div className="progress-numbers"><strong>{essentialDone}</strong><span> / 100</span></div></div>
        <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>
        <div className="progress-footer"><span>{completed.length ? (language === 'es' ? `Ya tienes ${completed.length} ${completed.length === 1 ? 'cima' : 'cimas'} en tu cuaderno, ${essentialDone} esenciales.` : language === 'en' ? `${completed.length} ${completed.length === 1 ? 'summit' : 'summits'} in your journal, ${essentialDone} essential.` : `Ja tens ${completed.length} ${completed.length === 1 ? 'cim' : 'cims'} al teu quadern, ${essentialDone} d’essencials.`) : t('Encara no has registrat cap ascensió. Tot comença amb el primer pas.')}</span><span>{progress}%</span></div>
        <div className="stats"><div><strong>{completed.length}</strong><span>{language === 'es' ? 'cimas hechas' : language === 'en' ? 'summits done' : 'cims fets'}</span></div><div><strong>{essentialDone}<span className="stat-total"> / {essentialTotal}</span></strong><span>{language === 'es' ? 'esenciales hechas' : language === 'en' ? 'essential done' : 'essencials fets'}</span></div><div><strong>{photoCount}</strong><span>{language === 'es' ? 'recuerdos guardados' : language === 'en' ? 'memories saved' : 'records guardats'}</span></div></div>
        <div className="share-progress"><div><strong>{language==='es'?'Tu camino también merece compartirse':language==='en'?'Your journey is worth sharing':'El teu camí també es pot compartir'}</strong><span>{language==='es'?'La tarjeta se crea aquí. Tus fotos y datos no se publican.':language==='en'?'The card is created here. Your photos and data stay private.':'La targeta es crea aquí. Les fotos i les dades no es publiquen.'}</span></div><button onClick={()=>void shareProgress()} disabled={sharing}>{sharing?'…':language==='es'?'Compartir progreso':language==='en'?'Share progress':'Compartir progrés'}</button></div>
      </section>

      {user && !journalReady && <div className="journal-loading" role="status">{t(journalError ? 'No s’ha pogut carregar el quadern. Torna-ho a provar.' : 'Carregant el quadern…')}{journalError && <button type="button" className="secondary-button" onClick={() => setLoadVersion(previous => previous + 1)}>{t('Tornar-ho a provar')}</button>}</div>}
      {user && journalReady && <Journal summits={summits} ascents={ascents} visits={visits} favorites={favorites} language={language} t={t} onEdit={editAscent} onRefreshPhoto={refreshPhoto} />}

      <section className="catalog" id="cims">
        <div className="section-heading"><div><p className="eyebrow">{t('EL TEU CATÀLEG')}</p><h2>{t('Tria el pròxim cim')}</h2></div><div className="catalog-heading-actions"><span className="catalog-count"><b>{visible.length}</b> {language === 'es' ? 'montañas' : language === 'en' ? 'summits' : 'muntanyes'}</span><div className="catalog-view-toggle" role="group" aria-label={language === 'es' ? 'Vista del catálogo' : language === 'en' ? 'Catalogue view' : 'Vista del catàleg'}><button type="button" className={catalogView === 'list' ? 'active' : ''} aria-pressed={catalogView === 'list'} onClick={() => setCatalogView('list')}><Icon name="grid" size={16} />{language === 'es' ? 'Lista' : language === 'en' ? 'List' : 'Llista'}</button><button type="button" className={catalogView === 'map' ? 'active' : ''} aria-pressed={catalogView === 'map'} onClick={() => setCatalogView('map')}><Icon name="map" size={16} />{language === 'es' ? 'Mapa' : language === 'en' ? 'Map' : 'Mapa'}</button></div></div></div>
        <CatalogFilters summits={summits} filters={filters} onChange={setFilters} search={search} onSearch={setSearch} t={t} origin={origin} originLabel={originLabel} onOrigin={changeOrigin} onNotice={setNotice} />
        <div className="sort-row"><button className="clear-filters" type="button" onClick={clearFilters}>{t('Netejar filtres')}</button><label>{t('Ordena per')} <span className="select-wrap sort-select"><select value={sortBy} onChange={event => setSortBy(event.target.value as SortBy)}><option value="name">{t('Nom A–Z')}</option><option value="height">{t('Altitud: de més a menys')}</option><option value="height-asc">{t('Altitud: de menys a més')}</option><option value="distance" disabled={!origin}>{t('Distància')}</option></select></span></label></div>
        {catalogView === 'map' ? <SummitMap summits={visible} ascents={ascents} language={language} onSelectSummit={id => {
          const summit = summits.find(item => item.id === id)
          if (summit) { setNotice(''); setSelectedSummit(summit) }
        }} /> : <div className="grid" aria-live="polite">{visible.slice(0, catalogLimit).map(summit => {
          const ascent = ascents.get(summit.id)
          const busy = Boolean(busyId) || Boolean(user && !journalReady)
          return <article className="card" key={summit.id}>
            <div className={`thumb ${ascent?.photoUrl ? 'has-summit-photo' : 'has-placeholder'}`}>
              {ascent?.photoUrl ? <Image src={ascent.photoUrl} alt={`${t('Foto de')} ${summit.name}`} fill sizes="(max-width: 560px) 50vw, (max-width: 820px) 50vw, 33vw" unoptimized /> : <MountainPlaceholder summitId={summit.id} />}
              {!ascent?.photoUrl && <span className="thumb-badge">{t('Il·lustració de referència')}</span>}
            </div>
            <div className="card-body">
              <div className="card-meta">{summit.essential && <span className="essential-tag"><Icon name="star" size={12} />{language === 'es' ? 'Esencial' : language === 'en' ? 'Essential' : 'Essencial'}</span>}{ascent && <span className="done-tag"><Icon name="check" size={12} />{t('Fets')}</span>}<button type="button" className={`favorite-button ${favorites.has(summit.id) ? 'is-favorite' : ''}`} aria-label={`${t(favorites.has(summit.id) ? 'Treure de preferits' : 'Afegir a preferits')}: ${summit.name}`} aria-pressed={favorites.has(summit.id)} disabled={busy} onClick={() => void toggleFavorite(summit)}><Icon name="star" size={19} style={favorites.has(summit.id) ? { fill: 'currentColor' } : undefined} /></button></div>
              <h3 title={summit.name}>{summit.name}</h3><div className="card-detail">{summit.height.toLocaleString('ca-ES')} m · {summit.region.replace(/\s*,\s*/g, ' · ')}</div>
              {origin && <div className="card-distance"><Icon name="pin" size={13} /> {coordinates[summit.id] ? `${distanceKm(origin, coordinates[summit.id]).toLocaleString(language, { maximumFractionDigits: 1 })} km` : t('Sense coordenades')}</div>}
              <div className="card-actions"><button className={`mark-button ${ascent ? 'is-done' : ''}`} onClick={() => editAscent(summit)} aria-label={`${t(ascent ? 'Editar ascensió' : 'Registrar ascensió')}: ${summit.name}`} disabled={busy}>{busyId === summit.id ? t(busyLabel) : <><Icon name={ascent ? 'check' : 'plus'} size={15} />{ascent ? friendlyDate(ascent.completed_at, language) : t('+ Marcar fet').replace('+ ', '')}</>}</button>{ascent ? <label className={`photo-button ${ascent.photo_path ? 'has-photo' : ''}`}><Icon name="camera" size={15} />{t(ascent.photo_path ? 'Canviar foto' : 'Foto')}<input type="file" aria-label={`${t('Pujar una foto de')} ${summit.name}`} accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { void uploadPhoto(summit, event.target.files?.[0]); event.currentTarget.value = '' }} disabled={busy} /></label> : <button type="button" className="photo-button" disabled={busy} onClick={() => editAscent(summit)}><Icon name="camera" size={15} />{t('Foto')}</button>}</div>
              <Link className="summit-explore" href={`/cims/${summit.id}`} prefetch={false}>{language==='es'?'Explorar cima':language==='en'?'Explore summit':'Explorar cim'}<Icon name="arrow" size={16} /></Link>
            </div>
          </article>
        })}{ready && visible.length === 0 && <div className="empty">{t('No hem trobat cap cim amb aquests filtres.')}<button type="button" className="secondary-button" onClick={clearFilters}>{t('Netejar filtres')}</button></div>}</div>}
        {catalogView === 'list' && visible.length > 0 && <div className="catalog-pagination"><p role="status">{t('Cims mostrats')}: {Math.min(catalogLimit, visible.length)} / {visible.length}</p>{catalogLimit < visible.length && <button className="secondary-button" type="button" onClick={() => setPagination({ key: catalogKey, limit: catalogLimit + 48 })}>{t('Carregar més cims')}</button>}</div>}
        <p className="source-note">{language === 'es' ? 'Catálogo oficial de los 100 Cims de la' : language === 'en' ? 'Official 100 Cims catalogue by' : 'Catàleg oficial dels 100 Cims de la'} <a href="https://www.feec.cat/activitats/100-cims/" target="_blank" rel="noreferrer">FEEC ↗</a> · {language === 'es' ? '522 montañas, 150 esenciales. El reto se completa con 100 de esas 150.' : language === 'en' ? '522 summits, 150 essential. Complete 100 of those 150.' : '522 cims, 150 essencials. El repte es completa amb 100 d’aquests 150.'} · <Link href="/fonts#relleu">{t('Il·lustracions basades en el relleu real: ICGC i Mapzen.')}</Link></p>
      </section>

      {notice && !editingSummit && <div className="toast show" role="status">{t(notice)}<button onClick={() => setNotice('')} aria-label={t('Tancar avís')}><Icon name="close" /></button></div>}
      {editingSummit && <AscentEditor key={editorKey} summit={editingSummit} ascent={editingAscent} busy={Boolean(busyId)} busyLabel={busyLabel} feedback={notice ? t(notice) : ''} t={t} onClose={() => setEditingSummit(null)} onSave={saveAscent} onDelete={deleteAscent} onNew={() => editAscent(editingSummit, null)} />}
      {selectedSummit && <SummitDetailsModal summit={selectedSummit} language={language} favorite={favorites.has(selectedSummit.id)} completedAt={ascents.get(selectedSummit.id)?.completed_at} busy={Boolean(busyId) || Boolean(user && !journalReady)} feedback={notice ? t(notice) : ''} onFavorite={() => void toggleFavorite(selectedSummit)} onEdit={() => editAscent(selectedSummit)} onClose={()=>setSelectedSummit(null)} />}
      </main><SiteFooter language={language} />

      {deleteOpen && <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!deletingAccount)setDeleteOpen(false)}}><section className="auth-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><button className="modal-close" disabled={deletingAccount} onClick={()=>setDeleteOpen(false)} aria-label={t('Tancar')}>×</button><p className="eyebrow">100CIMS CAT</p><h2 id="delete-title">{language==='es'?'Borrar cuenta para siempre':language==='en'?'Permanently delete account':'Esborrar el compte definitivament'}</h2><p>{language==='es'?'Se eliminarán tu cuenta, ascensiones y todas tus fotos privadas. Esta acción no se puede deshacer.':language==='en'?'Your account, ascents and all private photos will be deleted. This cannot be undone.':'S’eliminaran el compte, les ascensions i totes les fotos privades. Aquesta acció no es pot desfer.'}</p><label className="confirm-delete-label" htmlFor="delete-confirm">{language==='es'?'Escribe ELIMINAR para confirmar':language==='en'?'Type ELIMINAR to confirm':'Escriu ELIMINAR per confirmar'}</label><input id="delete-confirm" value={deleteConfirmation} onChange={event=>setDeleteConfirmation(event.target.value)} autoComplete="off" /><button className="delete-confirm-button" disabled={deleteConfirmation!=='ELIMINAR'||deletingAccount} onClick={()=>void deleteAccount()}>{deletingAccount?'…':language==='es'?'Borrar cuenta y fotos':language==='en'?'Delete account and photos':'Esborrar compte i fotos'}</button></section></div>}
      {authOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false) }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label={t('Tancar')}>×</button><p className="eyebrow">{t('El teu quadern, sempre amb tu.')}</p><h2 id="auth-title">{t('Entra al teu camí')}</h2><p>{t('T’enviarem un enllaç segur al correu per guardar les ascensions i les fotos al teu compte.')}</p><button type="button" className="google-signin" onClick={() => void signInWithGoogle()} disabled={signingInWithGoogle}>{signingInWithGoogle ? '…' : <><span className="google-mark" aria-hidden="true">G</span>{t('Continua amb Google')}</>}</button>{googleError && <p className="google-error" role="alert">{googleError}</p>}<div className="auth-divider"><span>{t('o bé')}</span></div><form onSubmit={sendMagicLink}><label htmlFor="email">{t('Correu electrònic')}</label><input id="email" type="email" required autoComplete="email" placeholder="tu@exemple.cat" value={email} onChange={event => setEmail(event.target.value)} /><button className="mark-button" disabled={sendingLink}>{sendingLink ? t('Enviant…') : t('Envia’m l’enllaç d’accés')}</button></form><small>{t('Les teves fotos són privades i només les pot veure el teu compte.')}</small></section></div>}
    </div>
  )
}
