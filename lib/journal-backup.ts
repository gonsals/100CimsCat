import {
  Zip,
  ZipPassThrough,
  Unzip,
  UnzipInflate,
  strFromU8,
  strToU8,
} from 'fflate'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ascentKey, validAscentDate, type Ascent } from '@/lib/tracker'
import { loadJournal } from '@/lib/journal-data'
import { loadTripLists, type TripList } from '@/lib/trip-planning'
import { loadTracks, saveTrack } from '@/lib/journal-resources'
import { parseGpx, toGpx } from '@/lib/gpx'
import type { AnnualGoal } from '@/lib/journal-metrics'

const MiB = 1024 * 1024
const archiveLimit = 350 * MiB
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const imageTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
}
type BackupPhoto = { entry: string; size: number; sha256: string; type: string }
type BackupVisit = {
  source_key: string
  summit_id: string
  completed_at: string
  notes: string
  photo?: BackupPhoto
  track?: { entry: string; filename: string }
}
export type BackupManifest = {
  format: '100cimscat-backup'
  version: 1
  backup_id: string
  created_at: string
  visits: BackupVisit[]
  favorites: string[]
  lists: TripList[]
  goals: AnnualGoal[]
}
export type BackupPreview = {
  manifest: BackupManifest
  photos: number
  tracks: number
}
const invalid = () => new Error('BACKUP_INVALID')
const buffer = (bytes: Uint8Array) => bytes.slice().buffer as ArrayBuffer
const digest = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', buffer(bytes))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('')
const entryLimit = (name: string) =>
  name === 'manifest.json'
    ? 48 * MiB
    : /^photos\/[0-9]+\.(png|jpg|webp|avif)$/.test(name)
      ? MiB / 2
      : /^tracks\/[0-9]+\.gpx$/.test(name)
        ? 2 * MiB
        : 0

function imageMatches(bytes: Uint8Array, type: string) {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end))
  if (type === 'image/png')
    return bytes.length > 8 && ascii(1, 4) === 'PNG' && bytes[0] === 137
  if (type === 'image/jpeg')
    return (
      bytes.length > 3 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255
    )
  if (type === 'image/webp')
    return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
  return (
    type === 'image/avif' &&
    ascii(4, 8) === 'ftyp' &&
    /avif|avis/.test(ascii(8, 32))
  )
}

// Feed small chunks and finish each file before reading further. Photos are
// checked and discarded during preview instead of retaining the entire ZIP.
export async function readBackupArchive(
  file: Blob,
  onFile: (name: string, bytes: Uint8Array) => Promise<void>,
) {
  if (!file.size || file.size > archiveLimit) throw invalid()
  const entries = new Map<string, number>()
  const completed = new Set<string>()
  let expanded = 0,
    failure: Error | null = null
  let pending: (() => Promise<void>)[] = []
  const unzip = new Unzip((entry) => {
    const limit = entryLimit(entry.name)
    if (
      !limit ||
      entries.has(entry.name) ||
      entries.size >= 20001 ||
      ![0, 8].includes(entry.compression) ||
      (entry.originalSize ?? 0) > limit
    )
      throw invalid()
    entries.set(entry.name, 0)
    let size = 0
    const chunks: Uint8Array[] = []
    entry.ondata = (error, bytes, final) => {
      if (failure) return
      if (error) {
        failure = error
        return
      }
      size += bytes.length
      expanded += bytes.length
      if (size > limit || expanded > archiveLimit) {
        failure = invalid()
        entry.terminate()
        return
      }
      chunks.push(bytes.slice())
      if (final) {
        const content = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) {
          content.set(chunk, offset)
          offset += chunk.length
        }
        chunks.length = 0
        entries.set(entry.name, size)
        completed.add(entry.name)
        pending.push(() => onFile(entry.name, content))
      }
    }
    entry.start()
  })
  unzip.register(UnzipInflate)
  for (let offset = 0; offset < file.size; offset += 16384) {
    unzip.push(
      new Uint8Array(await file.slice(offset, offset + 16384).arrayBuffer()),
      offset + 16384 >= file.size,
    )
    if (failure) throw failure
    for (const task of pending) await task()
    pending = []
  }
  if (
    failure ||
    completed.size !== entries.size ||
    !completed.has('manifest.json')
  )
    throw invalid()
  return entries
}

export function validateManifest(
  value: unknown,
  summits: Set<string>,
): BackupManifest {
  const m = value as BackupManifest
  const short = (text: unknown, max: number): text is string =>
    typeof text === 'string' && [...text].length <= max
  const date = (text: unknown) =>
    typeof text === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(text) &&
    new Date(`${text}T12:00:00Z`).toISOString().slice(0, 10) === text
  if (
    !m ||
    m.format !== '100cimscat-backup' ||
    m.version !== 1 ||
    !uuid.test(m.backup_id) ||
    typeof m.created_at !== 'string' ||
    !Number.isFinite(Date.parse(m.created_at)) ||
    !Array.isArray(m.visits) ||
    m.visits.length > 10000 ||
    !Array.isArray(m.favorites) ||
    m.favorites.length > 522 ||
    !Array.isArray(m.lists) ||
    m.lists.length > 1000 ||
    !Array.isArray(m.goals) ||
    m.goals.length > 101
  )
    throw invalid()
  const keys = new Set<string>(),
    files = new Set<string>(),
    lists = new Set<string>(),
    years = new Set<number>()
  for (const v of m.visits) {
    if (
      !v ||
      !summits.has(v.summit_id) ||
      !validAscentDate(v.completed_at) ||
      !short(v.notes, 4000) ||
      !(v.source_key === `first:${v.summit_id}` || uuid.test(v.source_key)) ||
      keys.has(v.source_key)
    )
      throw invalid()
    keys.add(v.source_key)
    if (v.photo) {
      const p = v.photo,
        ext = p.entry?.split('.').pop() ?? ''
      if (
        !/^photos\/[0-9]+\.(png|jpg|webp|avif)$/.test(p.entry) ||
        p.type !== imageTypes[ext] ||
        !Number.isInteger(p.size) ||
        p.size < 1 ||
        p.size > MiB / 2 ||
        !/^[a-f0-9]{64}$/.test(p.sha256) ||
        files.has(p.entry)
      )
        throw invalid()
      files.add(p.entry)
    }
    if (v.track) {
      if (
        !/^tracks\/[0-9]+\.gpx$/.test(v.track.entry) ||
        !short(v.track.filename, 120) ||
        !v.track.filename ||
        files.has(v.track.entry)
      )
        throw invalid()
      files.add(v.track.entry)
    }
  }
  if (
    new Set(m.favorites).size !== m.favorites.length ||
    m.favorites.some((id) => !summits.has(id))
  )
    throw invalid()
  for (const list of m.lists) {
    if (
      !list ||
      !uuid.test(list.id) ||
      lists.has(list.id) ||
      !short(list.name, 80) ||
      !list.name.trim() ||
      !short(list.notes, 2000) ||
      (list.planned_on !== null && !date(list.planned_on)) ||
      !Array.isArray(list.summitIds) ||
      list.summitIds.length > 522 ||
      new Set(list.summitIds).size !== list.summitIds.length ||
      list.summitIds.some((id) => !summits.has(id))
    )
      throw invalid()
    lists.add(list.id)
  }
  for (const goal of m.goals) {
    if (
      !goal ||
      !Number.isInteger(goal.year) ||
      goal.year < 2000 ||
      goal.year > 2100 ||
      years.has(goal.year) ||
      !['essential', 'unique', 'visits'].includes(goal.metric) ||
      !Number.isInteger(goal.target) ||
      goal.target < 1 ||
      goal.target > 1000
    )
      throw invalid()
    years.add(goal.year)
  }
  return m
}

export async function inspectBackup(
  file: Blob,
  summitIds: Set<string>,
): Promise<BackupPreview> {
  let raw: unknown
  const photos = new Map<string, { size: number; hash: string; type: string }>()
  const entries = await readBackupArchive(file, async (name, bytes) => {
    if (name === 'manifest.json') raw = JSON.parse(strFromU8(bytes))
    else if (name.startsWith('tracks/')) parseGpx(strFromU8(bytes))
    else {
      const type = imageTypes[name.split('.').pop()!]
      if (!imageMatches(bytes, type)) throw invalid()
      photos.set(name, { size: bytes.length, hash: await digest(bytes), type })
    }
  })
  const manifest = validateManifest(raw, summitIds),
    referenced = new Set(['manifest.json'])
  let tracks = 0
  for (const v of manifest.visits) {
    if (v.photo) {
      const p = photos.get(v.photo.entry)
      if (
        !p ||
        p.size !== v.photo.size ||
        p.hash !== v.photo.sha256 ||
        p.type !== v.photo.type
      )
        throw invalid()
      referenced.add(v.photo.entry)
    }
    if (v.track) {
      if (!entries.has(v.track.entry)) throw invalid()
      referenced.add(v.track.entry)
      tracks++
    }
  }
  if (referenced.size !== entries.size) throw invalid()
  return { manifest, photos: photos.size, tracks }
}

export async function exportBackup(
  client: SupabaseClient,
  userId: string,
  progress: (count: number) => void,
) {
  const [journal, lists, tracks, goals] = await Promise.all([
    loadJournal(client, userId, () => true, false),
    loadTripLists(client, userId, () => true),
    loadTracks(client, userId),
    client
      .from('journal_goals')
      .select('year,metric,target')
      .eq('user_id', userId)
      .order('year'),
  ])
  if (
    !journal ||
    goals.error ||
    journal.visits.length > 10000 ||
    lists.length > 1000
  )
    throw invalid()
  const manifest: BackupManifest = {
    format: '100cimscat-backup',
    version: 1,
    backup_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    visits: [],
    favorites: [...journal.favorites],
    lists,
    goals: goals.data as AnnualGoal[],
  }
  const chunks: ArrayBuffer[] = []
  let total = 0,
    zipFailure: Error | null = null
  let finish!: () => void
  const finished = new Promise<void>((resolve) => {
    finish = resolve
  })
  const zip = new Zip((error, chunk, final) => {
    if (error) zipFailure = error
    else {
      total += chunk.length
      if (total > archiveLimit) zipFailure = invalid()
      else chunks.push(buffer(chunk))
    }
    if (final || error) finish()
  })
  const add = (name: string, bytes: Uint8Array) => {
    if (zipFailure || bytes.length > entryLimit(name))
      throw zipFailure ?? invalid()
    const entry = new ZipPassThrough(name)
    zip.add(entry)
    entry.push(bytes, true)
    if (zipFailure) throw zipFailure
  }
  try {
    const byVisit = new Map(tracks.map((t) => [t.visit_key, t]))
    for (const [index, visit] of journal.visits.entries()) {
      const row: BackupVisit = {
        source_key: ascentKey(visit),
        summit_id: visit.summit_id,
        completed_at: visit.completed_at,
        notes: visit.notes ?? '',
      }
      if (visit.photo_path) {
        const { data, error } = await client.storage
          .from('summit-photos')
          .download(visit.photo_path)
        if (error || !data || data.size > MiB / 2) throw error ?? invalid()
        const bytes = new Uint8Array(await data.arrayBuffer())
        const ext = Object.keys(imageTypes).find((e) =>
          imageMatches(bytes, imageTypes[e]),
        )
        if (!ext) throw invalid()
        const entry = `photos/${index}.${ext}`
        row.photo = {
          entry,
          size: bytes.length,
          sha256: await digest(bytes),
          type: imageTypes[ext],
        }
        add(entry, bytes)
      }
      const track = byVisit.get(row.source_key)
      if (track) {
        const entry = `tracks/${index}.gpx`
        row.track = { entry, filename: track.filename }
        add(entry, strToU8(toGpx(track.data)))
      }
      manifest.visits.push(row)
      progress(index + 1)
    }
    add('manifest.json', strToU8(JSON.stringify(manifest)))
    zip.end()
    await finished
    if (zipFailure) throw zipFailure
    return new Blob(chunks, { type: 'application/zip' })
  } catch (error) {
    zip.terminate()
    throw error
  }
}

// A deterministic destination ID makes list restoration safe across retries,
// while preserving an original list already owned by the destination account.
async function restoredListId(owner: string, backup: string, source: string) {
  const hex = await digest(strToU8(`${owner}:${backup}:${source}`))
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

type RestoredVisit = { source_key: string; visit: Ascent; created: boolean }
export async function restoreBackup(
  client: SupabaseClient,
  userId: string,
  file: Blob,
  preview: BackupPreview,
  progress: (count: number) => void,
) {
  const m = preview.manifest,
    targets = new Map<string, Ascent>()
  let created = 0,
    kept = 0,
    pending = 0,
    done = 0
  for (let offset = 0; offset < m.visits.length; offset += 500) {
    const { data, error } = await client.rpc('restore_backup_visits', {
      p_backup: m.backup_id,
      p_expected_user: userId,
      p_rows: m.visits
        .slice(offset, offset + 500)
        .map((v) => ({
          source_key: v.source_key,
          summit_id: v.summit_id,
          completed_at: v.completed_at,
          notes: v.notes,
        })),
    })
    if (
      error ||
      !Array.isArray(data) ||
      data.length !== m.visits.slice(offset, offset + 500).length
    )
      throw error ?? invalid()
    for (const row of data as RestoredVisit[]) {
      targets.set(row.source_key, row.visit)
      if (row.created) created++
      else kept++
    }
    done += data.length
    progress(done)
  }
  const lists = await Promise.all(
    m.lists.map(async (list) => ({
      ...list,
      source_id: list.id,
      id: await restoredListId(userId, m.backup_id, list.id),
    })),
  )
  const { error } = await client.rpc('restore_backup_extras', {
    p_favorites: m.favorites,
    p_lists: lists,
    p_goals: m.goals,
    p_expected_user: userId,
  })
  if (error) throw error
  const existingTracks = new Set(
    (await loadTracks(client, userId)).map((t) => t.visit_key),
  )
  const attachments = new Map<string, { row: BackupVisit; target: Ascent }>()
  for (const row of m.visits) {
    const target = targets.get(row.source_key)
    if (!target) throw invalid()
    if (row.photo) attachments.set(row.photo.entry, { row, target })
    if (row.track) attachments.set(row.track.entry, { row, target })
  }
  await readBackupArchive(file, async (name, bytes) => {
    const attachment = attachments.get(name)
    if (!attachment) return
    const { row, target } = attachment
    try {
      if (name.startsWith('tracks/')) {
        if (!existingTracks.has(ascentKey(target))) {
          await saveTrack(
            client,
            userId,
            target,
            row.track!.filename,
            parseGpx(strFromU8(bytes)),
            true,
          )
          existingTracks.add(ascentKey(target))
        }
      } else if (!target.photo_path) {
        const photo = row.photo!
        if (
          bytes.length !== photo.size ||
          (await digest(bytes)) !== photo.sha256 ||
          !imageMatches(bytes, photo.type)
        )
          throw invalid()
        const identity = (await digest(strToU8(ascentKey(target)))).slice(0, 24)
        const path = `${userId}/${target.summit_id}/restore-${m.backup_id}-${identity}.${name.split('.').pop()}`
        const bucket = client.storage.from('summit-photos')
        // A prior request may have uploaded successfully before its response was
        // lost. Reuse only this backup's exact bytes, never replace an object.
        const previous = await bucket.download(path)
        if (previous.data) {
          if (
            (await digest(
              new Uint8Array(await previous.data.arrayBuffer()),
            )) !== photo.sha256
          )
            throw invalid()
        } else {
          const { data: allowed, error: quotaError } = await client.rpc(
            'can_upload_summit_photo',
            { p_file_size: bytes.length, p_replace_path: null },
          )
          if (quotaError || allowed !== true) throw quotaError ?? invalid()
          const upload = await bucket.upload(
            path,
            new Blob([buffer(bytes)], { type: photo.type }),
            { contentType: photo.type, upsert: false },
          )
          if (upload.error) throw upload.error
        }
        const saved = await client
          .from(target.id ? 'ascent_visits' : 'ascent_records')
          .update({ photo_path: path })
          .eq('user_id', userId)
          .eq(target.id ? 'id' : 'summit_id', target.id ?? target.summit_id)
          .is('photo_path', null)
          .select('summit_id')
        if (saved.error) throw saved.error
      }
    } catch {
      pending++
    }
    done++
    progress(done)
  })
  return { created, kept, pending }
}
