import type { SupabaseClient } from '@supabase/supabase-js'
import type { Ascent } from '@/lib/tracker'

export class PhotoUploadError extends Error {}
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

export function validatePhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) return 'Fes servir una imatge JPEG, PNG, WebP o AVIF.'
  if (file.size > rawImageLimit) return 'La imatge original ha de pesar menys de 24 MB per poder optimitzar-la amb seguretat.'
  return ''
}

type PhotoUpload = { summitId: string; file: File; current: Ascent; accountId: string; isCurrentAccount: () => boolean; onStage: (label: string) => void }

export async function persistAscentPhoto(supabase: SupabaseClient, { summitId, file, current, accountId, isCurrentAccount, onStage }: PhotoUpload): Promise<Ascent> {
  const validation = validatePhoto(file)
  if (validation) throw new PhotoUploadError(validation)
  onStage('Optimitzant…')
  let optimized: File
  try { optimized = await optimizePhoto(file) }
  catch { throw new PhotoUploadError('No hem pogut llegir aquesta imatge. Prova amb un JPEG, PNG o WebP.') }
  if (optimized.size > imageLimit) throw new PhotoUploadError('La foto encara pesa massa després d’optimitzar-la. Tria una imatge més petita.')
  if (!isCurrentAccount()) throw new PhotoUploadError('No s’ha pogut pujar la foto. Torna-ho a provar.')
  onStage('Pujant foto…')
  const nextPath = `${accountId}/${summitId}/${crypto.randomUUID()}.${optimized.type === 'image/webp' ? 'webp' : 'jpg'}`
  const oldPath = current.photo_path
  const { data: allowed, error: quotaError } = await supabase.rpc('can_upload_summit_photo', { p_file_size: optimized.size, p_replace_path: oldPath })
  if (quotaError) throw new PhotoUploadError('Actualitza la migració de Supabase abans de pujar fotos.')
  if (allowed !== true) throw new PhotoUploadError('Has arribat al límit de 280 MB de fotos del teu compte. Esborra fotos per continuar.')
  const { error: uploadError } = await supabase.storage.from('summit-photos').upload(nextPath, optimized, { contentType: optimized.type, upsert: false, metadata: oldPath ? { replace_path: oldPath } : {} })
  if (uploadError) throw new PhotoUploadError('No s’ha pogut pujar la foto. Torna-ho a provar.')
  const { data, error } = await supabase.from(current.id ? 'ascent_visits' : 'ascent_records').update({ photo_path: nextPath }).eq('user_id', accountId).eq(current.id ? 'id' : 'summit_id', current.id ?? summitId).select('summit_id').single()
  if (error || !data) {
    await supabase.storage.from('summit-photos').remove([nextPath])
    throw new PhotoUploadError('La foto s’ha pujat, però no hem pogut desar el registre. Torna-ho a provar.')
  }
  const { data: signed } = await supabase.storage.from('summit-photos').createSignedUrl(nextPath, 60 * 60 * 24)
  if (oldPath) await supabase.storage.from('summit-photos').remove([oldPath])
  return { ...current, photo_path: nextPath, photoUrl: signed?.signedUrl }
}
