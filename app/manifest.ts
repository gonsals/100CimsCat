import type { MetadataRoute } from 'next'
import { siteDescription } from '@/lib/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '100CimsCat',
    short_name: '100CimsCat',
    description: siteDescription,
    lang: 'ca',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f4ef',
    theme_color: '#263d30',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
