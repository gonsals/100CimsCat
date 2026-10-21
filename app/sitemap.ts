import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'
import catalog from '@/data/summits.json'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl }, ...catalog.map(summit => ({ url: `${siteUrl}/cims/${summit.id}` }))]
}
