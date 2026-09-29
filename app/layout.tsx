import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import './overrides.css'

const preferenceBootstrap = `try {
  const root = document.documentElement;
  const theme = localStorage.getItem('100cimscat-theme');
  const language = localStorage.getItem('100cimscat-language');
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  if (language === 'ca' || language === 'es' || language === 'en') root.lang = language;
} catch {}`

export const metadata: Metadata = {
  title: '100CimsCat · El teu quadern de muntanya',
  description: 'Segueix els teus 100 Cims FEEC i guarda una foto per cada ascensió.',
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
