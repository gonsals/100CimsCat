import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { siteDescription, siteTitle, siteUrl } from '@/lib/site'
import 'leaflet/dist/leaflet.css'
import './globals.css'
import './overrides.css'
import './summit-map.css'
import './tracker.css'

const preferenceBootstrap = `try {
  const root = document.documentElement;
  const theme = localStorage.getItem('100cimscat-theme');
  const language = localStorage.getItem('100cimscat-language');
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  if (language === 'ca' || language === 'es' || language === 'en') root.lang = language;
} catch {}`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: '100CimsCat',
  title: siteTitle,
  description: siteDescription,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ca_ES',
    siteName: '100CimsCat',
    url: '/',
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
  },
}

export const viewport: Viewport = {
  themeColor: '#263d30',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ca" suppressHydrationWarning>
      <body>
        <Script id="preferences-before-paint" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: preferenceBootstrap }} />
        {children}
      </body>
    </html>
  )
}
