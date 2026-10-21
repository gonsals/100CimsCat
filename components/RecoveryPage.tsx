'use client'

import Link from 'next/link'
import { usePreferences } from '@/lib/use-preferences'
import { trackerText } from '@/lib/tracker-i18n'
import { SiteHeader, SiteFooter, SkipLink } from '@/components/SiteChrome'
import { BrandMark } from '@/components/Icon'

export default function RecoveryPage({ kind, retry }: { kind: 'not-found' | 'error'; retry?: () => void }) {
  const { language } = usePreferences()
  const t = (value: string) => trackerText(language, value)
  return <div className="shell recovery-page"><SkipLink language={language} /><SiteHeader language={language} /><main id="main-content" tabIndex={-1}><div className="recovery-art"><BrandMark /></div><p className="eyebrow">{kind === 'not-found' ? '404 · 100CIMSCAT' : '100CIMSCAT'}</p><h1>{t(kind === 'not-found' ? 'Aquest camí no porta enlloc' : 'Fem una pausa i tornem-ho a provar')}</h1><p>{t(kind === 'not-found' ? 'No hem trobat aquesta pàgina. Pots tornar al catàleg i trobar el pròxim cim.' : 'No hem pogut carregar aquesta pàgina. Torna-ho a provar o continua des del catàleg.')}</p><div className="recovery-actions">{retry && <button type="button" className="primary-button" onClick={retry}>{t('Tornar-ho a provar')}</button>}<Link href="/#cims" className={retry ? 'secondary-button' : 'primary-button'}>{t('Tornar al catàleg')}</Link><Link href="/contacte" className="text-link">{t('Necessites ajuda?')}</Link></div></main><SiteFooter language={language} /></div>
}
