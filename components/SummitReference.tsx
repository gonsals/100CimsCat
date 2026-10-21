'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import MountainPlaceholder from '@/components/MountainPlaceholder'
import Icon from '@/components/Icon'
import { mountainArtwork, mountainView } from '@/lib/mountain-art'
import { trackerText } from '@/lib/tracker-i18n'
import type { Summit, Language } from '@/lib/tracker'
import type { SummitContext } from '@/lib/summit-context'

type Context = { data: SummitContext | null; loading: boolean; error: boolean; retry: () => void }

export default function SummitReference({ summit, language, context }: { summit: Summit; language: Language; context: Context }) {
  const t = (value: string) => trackerText(language, value)
  const [illustration, setIllustration] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => { setIllustration(false); setImageFailed(false) }, [summit.id])
  const photo = !illustration && !imageFailed ? context.data?.photo : null
  const art = mountainArtwork(summit.id)
  return <figure className="summit-reference">
    <div className="summit-page-art">{photo ? <Image src={photo.url} alt={summit.name} width={1280} height={853} unoptimized loading="eager" onError={() => setImageFailed(true)} /> : <><MountainPlaceholder summitId={summit.id} eager /><span>{t('Relleu il·lustrat')}</span></>}</div>
    {context.data?.photo && !imageFailed && <div className="reference-view-toggle" role="group" aria-label={t('Imatge del cim')}><button type="button" aria-pressed={illustration} onClick={() => setIllustration(true)}>{t('Il·lustració')}</button><button type="button" aria-pressed={!illustration} onClick={() => setIllustration(false)}>{t('Fotografia')}</button></div>}
    <figcaption>{photo ? <><span>{photo.author}</span> · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a> · <a href={photo.sourceUrl} target="_blank" rel="noreferrer">Wikimedia Commons<Icon name="arrow" size={12} /></a><small>{t('Imatge vinculada a la cima per nom i coordenades a Wikidata.')}</small></> : <>
      {art && <><span>{t('Perfil generat amb elevacions reals.')} {t('Vista des de')} {mountainView(art.bearing, language)} ({art.bearing}°).</span> <Link href="/fonts#relleu">{art.sources.includes('icgc') ? 'ICGC · CC BY 4.0' : 'Mapzen · EU-DEM / USGS'}{art.sources.length > 1 && ' · Mapzen'}</Link><small>{t('Interpretació artística amb escala vertical adaptada.')}</small></>}
      {context.loading ? <small role="status">{t('Comprovant imatges i fonts…')}</small> : (context.error || imageFailed) && <small>{t('La imatge no està disponible ara.')} <button type="button" className="text-button" onClick={() => { setImageFailed(false); context.retry() }}>{t('Tornar-ho a provar')}</button></small>}
    </>}</figcaption>
  </figure>
}
