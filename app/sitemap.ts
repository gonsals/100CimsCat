import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'
import catalog from '@/data/summits.json'
import { projectSections } from '@/lib/project-pages'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl }, ...catalog.map(summit => ({ url: `${siteUrl}/cims/${summit.id}` })), ...projectSections.map(section => ({ url: `${siteUrl}/${section}` }))]
}
