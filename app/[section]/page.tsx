import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import InformationPage from '@/components/InformationPage'
import { projectSections, projectPageTitles, type ProjectSection } from '@/lib/project-pages'

export function generateStaticParams() { return projectSections.map(section => ({ section })) }
function pageSection(value: string): ProjectSection {
  if (!(projectSections as readonly string[]).includes(value)) notFound()
  return value as ProjectSection
}
export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const section = pageSection((await params).section)
  return { title: `${projectPageTitles[section]} · 100CimsCat`, alternates: { canonical: `/${section}` } }
}
export default async function ProjectPage({ params }: { params: Promise<{ section: string }> }) {
  return <InformationPage section={pageSection((await params).section)} />
}
