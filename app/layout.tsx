import type { Metadata } from 'next'
import './globals.css'
import './overrides.css'

export const metadata: Metadata = {
  title: '100CimsCat · El teu quadern de muntanya',
  description: 'Segueix els teus 100 Cims FEEC i guarda una foto per cada ascensió.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  )
}

