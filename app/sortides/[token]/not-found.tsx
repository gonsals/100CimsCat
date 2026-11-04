'use client'
import Link from 'next/link'
import { usePreferences } from '@/lib/use-preferences'
import { SiteHeader, SiteFooter, SkipLink } from '@/components/SiteChrome'
import { mountainText } from '@/lib/mountain-i18n'
export default function UnavailableTrip() {
  const { language } = usePreferences()
  return (
    <div className="shell">
      <SkipLink language={language} />
      <SiteHeader language={language} />
      <main id="main-content" className="mountain-panel">
        <h1>{mountainText(language, 'shared')}</h1>
        <p>{mountainText(language, 'unavailable')}</p>
        <Link href="/">100CimsCat</Link>
      </main>
      <SiteFooter language={language} />
    </div>
  )
}
