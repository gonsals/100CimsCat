'use client'
import Link from 'next/link'
import { usePreferences } from '@/lib/use-preferences'
import { SiteHeader, SiteFooter, SkipLink } from '@/components/SiteChrome'
import { mountainText } from '@/lib/mountain-i18n'
import type { Summit } from '@/lib/tracker'
export default function SharedTripContent({
  title,
  date,
  summits,
}: {
  title: string
  date: string | null
  summits: Summit[]
}) {
  const { language } = usePreferences()
  return (
    <div className="shell">
      <SkipLink language={language} />
      <SiteHeader language={language} />
      <main id="main-content" className="mountain-panel">
        <p className="eyebrow">{mountainText(language, 'shared')}</p>
        <h1>{title}</h1>
        {date && <time dateTime={date}>{date}</time>}
        <ul>
          {summits.map((s) => (
            <li key={s.id}>
              <Link href={`/cims/${s.id}`}>{s.name}</Link> · {s.height} m
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter language={language} />
    </div>
  )
}
