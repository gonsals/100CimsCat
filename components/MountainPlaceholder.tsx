import Image from 'next/image'
import { mountainArtwork } from '@/lib/mountain-art'

export default function MountainPlaceholder({ summitId, eager = false }: { summitId: string; eager?: boolean }) {
  const art = mountainArtwork(summitId)
  if (!art) return null
  return <Image className="mountain-placeholder" src={`/mountains/${art.file}`} width={720} height={420} alt="" aria-hidden="true" unoptimized loading={eager ? 'eager' : 'lazy'} draggable={false} />
}
