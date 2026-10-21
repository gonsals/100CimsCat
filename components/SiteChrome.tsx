'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { trackerText } from '@/lib/tracker-i18n'
import type { Language } from '@/lib/tracker'
import { usePreferences } from '@/lib/use-preferences'
import Icon, { BrandMark } from '@/components/Icon'

function PublicPreferences() {
  const { language, theme, update } = usePreferences()
  const t = (value: string) => trackerText(language, value)
  return <div className="public-preferences"><label className="sr-only" htmlFor="site-language">{t('Idioma')}</label><select id="site-language" aria-label={t('Idioma')} value={language} onChange={event => update(event.target.value as Language, theme)}><option value="ca">CA</option><option value="es">ES</option><option value="en">EN</option></select><button type="button" className="icon-button" aria-label={t(theme === 'light' ? 'Activar tema fosc' : 'Activar tema clar')} onClick={() => update(language, theme === 'light' ? 'dark' : 'light')}><Icon name={theme === 'light' ? 'moon' : 'sun'} /></button></div>
}

export function SiteHeader({ language, children, onJournal }: { language: Language; children?: ReactNode; onJournal?: () => void }) {
  const t = (value: string) => trackerText(language, value)
  const pathname = usePathname()
  return <header className="topbar site-header"><Link className="brand" href="/" aria-label={t('100 Cims, inici')}><BrandMark /><span>100<span className="brand-light">CIMS</span><small>CAT</small></span></Link><nav aria-label={t('Navegació principal')}><Link href="/#cims" aria-current={pathname === '/' ? 'page' : undefined}>{t('Explorar')}</Link>{onJournal ? <button type="button" onClick={onJournal}><Icon name="book" size={16} />{t('El meu quadern')}</button> : <Link href="/?quadern=1#quadern"><Icon name="book" size={16} />{t('El meu quadern')}</Link>}<a href="/offline.html"><Icon name="down" size={16} />{t('Descàrregues')}</a></nav>{children ?? <PublicPreferences />}</header>
}

export function SiteFooter({ language }: { language: Language }) {
  const t = (value: string) => trackerText(language, value)
  return <footer className="site-footer"><div><Link className="footer-brand" href="/"><BrandMark /><span>100CimsCat</span></Link><p>{t('Fet per recordar els camins, no només els cims.')}</p><small>{t('Projecte independent. No és una aplicació oficial de la FEEC.')}</small></div><nav aria-label={t('Informació del projecte')}><Link href="/projecte">{t('Sobre el projecte')}</Link><Link href="/ajuda">{t('Ajuda')}</Link><Link href="/fonts">{t('Fonts i crèdits')}</Link><Link href="/privacitat">{t('Privacitat')}</Link><Link href="/contacte">{t('Contacte')}</Link></nav></footer>
}

export function SkipLink({ language }: { language: Language }) { return <a href="#main-content" className="skip-link">{trackerText(language, 'Saltar al contingut')}</a> }
