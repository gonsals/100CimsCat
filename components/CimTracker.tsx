'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import catalogSeed from '@/data/summits.json'

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

function friendlyDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' })
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
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyLabel, setBusyLabel] = useState('Desant…')

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
    let active = true
    async function loadAscents() {
      const { data, error } = await supabase
        .from('ascent_records')
        .select('summit_id,completed_at,photo_path')
        .eq('user_id', user.id)
      if (!active) return
      if (error) {
        setNotice('No hem pogut carregar els teus cims. Torna-ho a provar d’aquí a un moment.')
        return
      }
      const rows = (data ?? []) as Ascent[]
      const paths = rows.flatMap(row => row.photo_path ? [row.photo_path] : [])
      const signed = paths.length
        ? await supabase.storage.from('summit-photos').createSignedUrls(paths, 60 * 60 * 24)
        : { data: [], error: null }
      const urls = new Map((signed.data ?? []).map(item => [item.path, item.signedUrl]))
      if (active) setAscents(new Map(rows.map(row => [row.summit_id, { ...row, photoUrl: row.photo_path ? urls.get(row.photo_path) : undefined }])))
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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setSendingLink(false)
    setNotice(error ? 'No s’ha pogut enviar l’enllaç. Revisa el correu i torna-ho a provar.' : 'T’hem enviat un enllaç d’accés al correu. Obre’l per continuar.')
    if (!error) setAuthOpen(false)
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
    await supabase.auth.signOut()
    setNotice('Has tancat la sessió.')
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#inici" aria-label="100 Cims, inici"><span className="brand-mark">▲</span><span>100<span className="brand-light">CIMS</span></span></a>
        <nav><a className="active" href="#cims">El meu repte</a><a href="https://www.feec.cat/activitats/100-cims/" target="_blank" rel="noreferrer">Catàleg FEEC ↗</a></nav>
        {user ? <button className="profile profile-button" onClick={signOut} title={`Tancar la sessió de ${user.email ?? ''}`}>{user.email?.[0]?.toLocaleUpperCase() ?? 'G'}</button> : <button className="signin-link" onClick={() => setAuthOpen(true)}>Inicia sessió</button>}
      </header>

      <section className="hero" id="inici">
        <div className="hero-copy"><p className="eyebrow">EL TEU QUADERN DE MUNTANYA</p><h1>Cada cim, una<br /><em>història.</em></h1><p className="intro">Guarda els teus records i descobreix fins on t’ha portat el camí.</p></div>
        <div className="hero-art" aria-hidden="true"><div className="sun" /><div className="ridge ridge-back" /><div className="ridge ridge-front" /><div className="art-label">PIRINEU<br /><span>42° 32′ N · 1° 36′ E</span></div></div>
      </section>

      {!user && <section className="account-hint"><span className="hint-icon">↗</span><span><strong>El teu progrés t’acompanya.</strong> Inicia sessió per desar cims i fotos al teu compte.</span><button onClick={() => setAuthOpen(true)}>Accedir amb el correu</button></section>}

      <section className="progress-panel" aria-label="Progrés del repte">
        <div className="progress-heading"><div><p className="eyebrow">EL REPTE DELS 100 CIMS</p><h2>El teu camí fins als 100</h2></div><div className="progress-numbers"><strong>{essentialDone}</strong><span> / 100</span></div></div>
        <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>
        <div className="progress-footer"><span>{completed.length ? `Ja tens ${completed.length} ${completed.length === 1 ? 'cim' : 'cims'} al teu quadern, ${essentialDone} d’essencials.` : 'Encara no has registrat cap ascensió. Tot comença amb el primer pas.'}</span><span>{progress}%</span></div>
        <div className="stats"><div><strong>{completed.length}</strong><span>cims fets</span></div><div><strong>{essentialDone}<span className="stat-total"> / {essentialTotal}</span></strong><span>essencials fets</span></div><div><strong>{photoCount}</strong><span>records guardats</span></div></div>
      </section>

      <section className="catalog" id="cims">
        <div className="section-heading"><div><p className="eyebrow">EL TEU CATÀLEG</p><h2>Tria el pròxim cim</h2></div><span className="catalog-count"><b>{visible.length}</b> muntanyes</span></div>
        <div className="toolbar"><label className="search"><span>⌕</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cerca un cim o una comarca..." aria-label="Cerca per cim o comarca" /></label><div className="filters" role="group" aria-label="Filtrar cims">
          {([['all', 'Tots'], ['pending', 'Pendents'], ['done', 'Fets'], ['essential', '✦ Essencials']] as const).map(([value, label]) => <button key={value} className={`filter ${filter === value ? 'active' : ''} ${value === 'essential' ? 'essential-filter' : ''}`} onClick={() => setFilter(value)}>{label}{value === 'all' && <span>{summits.length}</span>}</button>)}
        </div></div>
        <div className="sort-row"><span>{ready ? `${visible.length} ${visible.length === 1 ? 'muntanya' : 'muntanyes'} al catàleg` : 'Carregant el catàleg…'}</span><label>Ordena per <select value={sortBy} onChange={event => setSortBy(event.target.value as 'name' | 'height')}><option value="name">Nom A–Z</option><option value="height">Altitud</option></select></label></div>
        <div className="grid" aria-live="polite">{visible.map(summit => {
          const ascent = ascents.get(summit.id)
          const busy = busyId === summit.id
          return <article className="card" key={summit.id}>
            <div className="thumb">{ascent?.photoUrl ? <Image src={ascent.photoUrl} alt={`Foto de ${summit.name}`} fill sizes="(max-width: 560px) 76px, 95px" /> : <span className="mountain-icon" aria-hidden="true">⌃</span>}</div>
            <div className="card-body">
              <div className="card-meta">{summit.essential && <span className="essential-tag">✦ Essencial</span>}{ascent && <span className="done-tag">✓ Fet</span>}</div>
              <h3 title={summit.name}>{summit.name}</h3><div className="card-detail">{summit.height.toLocaleString('ca-ES')} m · {summit.region.replace(/\s*,\s*/g, ' · ')}</div>
              <div className="card-actions"><button className={`mark-button ${ascent ? 'is-done' : ''}`} onClick={() => void toggleDone(summit)} disabled={busy}>{busy ? busyLabel : ascent ? `✓ ${friendlyDate(ascent.completed_at)}` : '+ Marcar fet'}</button><label className={`photo-button ${ascent?.photo_path ? 'has-photo' : ''}`} aria-label={`Pujar una foto de ${summit.name}`}>{ascent?.photo_path ? '▣ Canviar foto' : '＋ Foto'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => { void uploadPhoto(summit, event.target.files?.[0]); event.currentTarget.value = '' }} disabled={busy} /></label></div>
            </div>
          </article>
        })}{ready && visible.length === 0 && <div className="empty">No hem trobat cap cim amb aquests filtres.</div>}</div>
        <p className="source-note">Catàleg oficial dels 100 Cims de la <a href="https://www.feec.cat/activitats/100-cims/" target="_blank" rel="noreferrer">FEEC ↗</a> · 522 cims, 150 essencials. El repte es completa amb 100 d’aquests 150.</p>
      </section>

      {notice && <div className="toast show" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Tancar avís">×</button></div>}
      <footer>Fet per recordar els camins, no només els cims. <span>100CIMS · 2026</span></footer>

      {authOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAuthOpen(false) }}><section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Tancar">×</button><p className="eyebrow">EL TEU QUADERN, SEMPRE AMB TU</p><h2 id="auth-title">Entra al teu camí</h2><p>T’enviarem un enllaç segur al correu per guardar les ascensions i les fotos al teu compte.</p><form onSubmit={sendMagicLink}><label htmlFor="email">Correu electrònic</label><input id="email" type="email" required autoComplete="email" placeholder="tu@exemple.cat" value={email} onChange={event => setEmail(event.target.value)} /><button className="mark-button" disabled={sendingLink}>{sendingLink ? 'Enviant…' : 'Envia’m l’enllaç d’accés'}</button></form><small>Les teves fotos són privades i només les pot veure el teu compte.</small></section></div>}
    </main>
  )
}

