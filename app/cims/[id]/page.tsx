import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import catalog from '@/data/summits.json'
import type { Summit } from '@/lib/tracker'
import SummitPageContent from '@/components/SummitPageContent'

const summits = catalog as Summit[]
export const dynamicParams = false
export function generateStaticParams() { return summits.map(({ id }) => ({ id })) }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const summit = summits.find(item => item.id === id)
  if (!summit) return {}
  const title = `${summit.name} · 100CimsCat`
  const description = `${summit.name}, ${summit.height.toLocaleString('ca-ES')} m, ${summit.region}. ${summit.essential ? 'Cim essencial del repte dels 100 Cims.' : 'Cim del catàleg dels 100 Cims.'} Consulta la fitxa, desa-la sense cobertura i registra les teves ascensions.`
  return { title, description, alternates: { canonical: `/cims/${id}` }, openGraph: { title, description, url: `/cims/${id}`, type: 'website', locale: 'ca_ES' }, twitter: { card: 'summary_large_image', title, description } }
}

export default async function SummitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const summit = summits.find(item => item.id === id)
  if (!summit) notFound()
  const related = summits.filter(item => item.id !== id && item.region.split(',').some(region => summit.region.split(',').map(value => value.trim()).includes(region.trim()))).slice(0, 4)
  return <SummitPageContent summit={summit} related={related} />
}
