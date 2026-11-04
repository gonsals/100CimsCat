'use client'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import FeatureDialog from '@/components/FeatureDialog'
import ShareTrip from '@/components/ShareTrip'
import Icon from '@/components/Icon'
import { planningText } from '@/lib/planning-i18n'
import { loadTripLists, saveTripList, type TripList } from '@/lib/trip-planning'
import { friendlyDate, normalizeSearch, type Ascent, type Language, type Summit } from '@/lib/tracker'

const SummitMap = dynamic(() => import('@/components/SummitMap'), { ssr: false, loading: () => <div className="summit-map-loading" aria-hidden="true" /> })
type Props = { supabase: SupabaseClient; userId: string; summits: Summit[]; ascents: Map<string, Ascent>; language: Language; onSummit: (id: string) => void }

function TripEditor({ initial, summits, language, onSave, onClose }: { initial: TripList; summits: Summit[]; language: Language; onSave: (draft: TripList) => Promise<void>; onClose: () => void }) {
  const [draft, setDraft] = useState(initial)
  const [search, setSearch] = useState('')
  const [addId, setAddId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [discard, setDiscard] = useState(false)
  const t = (value: string) => planningText(language, value)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const byId = useMemo(() => new Map(summits.map(summit => [summit.id, summit])), [summits])
  const available = useMemo(() => summits.filter(summit => !draft.summitIds.includes(summit.id) && normalizeSearch(`${summit.name} ${summit.region}`).includes(normalizeSearch(search))).slice(0, 50), [summits, draft.summitIds, search])
  const leave = () => { if (!busy) { if (dirty) setDiscard(true); else onClose() } }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!draft.name.trim() || draft.name.trim().length > 80) { setError('Tria un nom de fins a 80 caràcters i una data vàlida.'); return }
    setBusy(true); setError('')
    try { await onSave(draft); onClose() }
    catch { setError('No s’ha pogut desar la llista. Els canvis es conserven per reintentar-ho.') }
    finally { setBusy(false) }
  }
  function move(index: number, delta: number) {
    setDraft(previous => { const summitIds = [...previous.summitIds]; [summitIds[index], summitIds[index + delta]] = [summitIds[index + delta], summitIds[index]]; return { ...previous, summitIds } })
  }
  return <FeatureDialog title={t(initial.name ? 'Editar llista' : 'Nova llista')} closeLabel={t('Tancar')} busy={busy} onClose={leave}>
    {discard ? <div><h3>{t('Descartar canvis pendents?')}</h3><div className="feature-actions"><button className="secondary-button" type="button" onClick={() => setDiscard(false)}>{t('Continuar editant')}</button><button className="danger-button" type="button" onClick={onClose}>{t('Descartar canvis')}</button></div></div> : <form onSubmit={submit}>
      <fieldset disabled={busy} className="feature-fields">
        <label className="feature-field">{t('Nom de la llista')}<input aria-label={t('Nom de la llista')} required maxLength={80} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="feature-field">{t('Data prevista (opcional)')}<input aria-label={t('Data prevista (opcional)')} type="date" value={draft.planned_on ?? ''} onChange={event => setDraft({ ...draft, planned_on: event.target.value || null })} /></label>
        <label className="feature-field">{t('Notes de la sortida')}<textarea aria-label={t('Notes de la sortida')} rows={3} maxLength={2000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
        <div className="trip-add"><label className="feature-field">{t('Cercar cims per afegir')}<input aria-label={t('Cercar cims per afegir')} type="search" value={search} onChange={event => { setSearch(event.target.value); setAddId('') }} /></label>
          <label className="feature-field">{t('Cim per afegir')}<select aria-label={t('Cim per afegir')} value={addId} onChange={event => setAddId(event.target.value)}><option value="">{t('Tria un cim')}</option>{available.map(summit => <option key={summit.id} value={summit.id}>{summit.name} · {summit.region}</option>)}</select></label>
          <button type="button" className="secondary-button" disabled={!addId} onClick={() => { setDraft({ ...draft, summitIds: [...draft.summitIds, addId] }); setAddId('') }}><Icon name="plus" />{t('Afegir cim')}</button>
        </div><p className="field-hint">{t('Canvia la cerca per veure altres cims.')}</p>
        <ol className="trip-summits">{draft.summitIds.map((id, index) => <li key={id}><span>{byId.get(id)?.name ?? id}</span><div className="trip-order-actions">
          <button type="button" className="icon-button" disabled={index === 0} aria-label={`${t('Pujar posició')}: ${byId.get(id)?.name}`} onClick={() => move(index, -1)}>↑</button>
          <button type="button" className="icon-button" disabled={index === draft.summitIds.length - 1} aria-label={`${t('Baixar posició')}: ${byId.get(id)?.name}`} onClick={() => move(index, 1)}>↓</button>
          <button type="button" className="icon-button" aria-label={`${t('Treure de la llista')}: ${byId.get(id)?.name}`} onClick={() => setDraft({ ...draft, summitIds: draft.summitIds.filter(summitId => summitId !== id) })}><Icon name="close" /></button>
        </div></li>)}</ol>
        {!draft.summitIds.length && <p className="field-hint">{t('La llista encara no té cims.')}</p>}
      </fieldset>
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="feature-actions"><button type="button" className="secondary-button" disabled={busy} onClick={leave}>{t('Cancel·lar')}</button><button type="submit" className="primary-button" disabled={busy}>{busy ? '…' : t('Desar')}</button></div>
    </form>}
  </FeatureDialog>
}

export default function TripPlanner({ supabase, userId, summits, ascents, language, onSummit }: Props) {
  const [lists, setLists] = useState<TripList[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [editing, setEditing] = useState<TripList | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const t = (value: string) => planningText(language, value)
  useEffect(() => { const reload = () => setVersion(value => value + 1); window.addEventListener('journal-restored', reload); return () => window.removeEventListener('journal-restored', reload) }, [])
  useEffect(() => {
    let active = true
    setReady(false); setError(''); setLists([]); setSelectedId(''); setEditing(null)
    void loadTripLists(supabase, userId, () => active).then(data => { if (active) { setLists(data); setSelectedId(data[0]?.id ?? ''); setReady(true) } })
      .catch(() => { if (active) setError('No s’han pogut carregar les llistes.') })
    return () => { active = false }
  }, [supabase, userId, version])
  const selected = lists.find(list => list.id === selectedId)
  const byId = useMemo(() => new Map(summits.map(summit => [summit.id, summit])), [summits])
  const listSummits = (selected?.summitIds ?? []).flatMap(id => { const summit = byId.get(id); return summit ? [summit] : [] })
  async function save(draft: TripList) {
    const saved = await saveTripList(supabase, draft, userId)
    setLists(previous => previous.some(list => list.id === saved.id) ? previous.map(list => list.id === saved.id ? saved : list) : [...previous, saved])
    setSelectedId(saved.id); setMapOpen(false); setError('')
  }
  async function remove() {
    if (!selected || busy) return
    setBusy(true); setError('')
    try {
      const { data, error } = await supabase.from('trip_lists').delete().eq('id', selected.id).eq('user_id', userId).select('id')
      if (error || !data?.length) throw error ?? new Error('List unavailable')
      const remaining = lists.filter(list => list.id !== selected.id)
      setLists(remaining); setSelectedId(remaining[0]?.id ?? ''); setDeleting(false); setMapOpen(false)
    } catch { setError('No s’ha pogut eliminar la llista.') }
    finally { setBusy(false) }
  }
  return <section className="trip-planner" aria-labelledby="trip-title">
    <div className="journal-heading"><div><p className="eyebrow">{t('Les meves llistes')}</p><h2 id="trip-title">{t('Pròximes sortides')}</h2></div>{ready && <button className="secondary-button" type="button" disabled={busy} onClick={() => setEditing({ id: crypto.randomUUID(), name: '', planned_on: null, notes: '', summitIds: [] })}><Icon name="plus" />{t('Nova llista')}</button>}</div>
    <p className="field-hint">{t('Organitza cims per a les pròximes sortides. Les llistes i les notes són privades.')}</p>
    {error && <p className="form-error" role="alert">{t(error)} {!ready && <button className="secondary-button" type="button" onClick={() => setVersion(previous => previous + 1)}>{t('Tornar-ho a provar')}</button>}</p>}
    {!ready && !error && <p role="status">{t('Carregant les llistes…')}</p>}
    {ready && !lists.length && <p className="field-hint">{t('Encara no tens cap llista.')}</p>}
    {ready && lists.length > 0 && <label className="feature-field trip-picker">{t('Les meves llistes')}<select aria-label={t('Les meves llistes')} value={selectedId} disabled={busy} onChange={event => { setSelectedId(event.target.value); setMapOpen(false); setDeleting(false); setError('') }}>{lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>}
    {selected && <article className="trip-detail"><h3>{selected.name}</h3><p className="field-hint">{selected.planned_on ? friendlyDate(selected.planned_on, language) : t('Sense data prevista')} · {listSummits.length} {t('cims')}</p>{selected.notes && <p className="trip-notes">{selected.notes}</p>}
      <ol className="trip-summits">{listSummits.map(summit => <li key={summit.id}><button className="trip-summit-link" type="button" onClick={() => onSummit(summit.id)}>{summit.name}</button><span>{ascents.has(summit.id) ? `✓ ${t('Fets')}` : `${summit.height} m`}</span></li>)}</ol>
      {!listSummits.length && <p>{t('La llista encara no té cims.')}</p>}
      <div className="feature-actions"><ShareTrip client={supabase} userId={userId} list={selected} summits={summits} language={language}/><button className="secondary-button" type="button" disabled={busy} onClick={() => setEditing({ ...selected, summitIds: [...selected.summitIds] })}>{t('Editar llista')}</button><button className="secondary-button" type="button" disabled={!listSummits.length || busy} aria-expanded={mapOpen} onClick={() => setMapOpen(previous => !previous)}>{t(mapOpen ? 'Amagar mapa' : 'Veure mapa de la llista')}</button><button className="danger-button" type="button" disabled={busy} onClick={() => setDeleting(true)}>{t('Eliminar llista')}</button></div>
      {deleting && <div className="trip-delete" role="alert"><p>{t('Eliminar aquesta llista? Les ascensions i les fotos es conservaran.')}</p><div className="feature-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setDeleting(false)}>{t('Cancel·lar')}</button><button type="button" className="danger-button" disabled={busy} onClick={() => void remove()}>{busy ? '…' : t('Sí, eliminar llista')}</button></div></div>}
      {mapOpen && <SummitMap summits={listSummits} ascents={ascents} language={language} onSelectSummit={onSummit} rememberPosition={false} />}
    </article>}
    {editing && <TripEditor key={editing.id} initial={editing} summits={summits} language={language} onSave={save} onClose={() => setEditing(null)} />}
  </section>
}
