import { ImageResponse } from 'next/og'

export const alt = '100CimsCat · El teu quadern de muntanya'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#f5f4ef', color: '#263d30', padding: 72, flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 32, fontWeight: 700 }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="14" fill="#263d30" />
          <circle cx="47" cy="17" r="6" fill="#e3d49f" />
          <path d="M6 49 25 17 44 49Z" fill="#fffefa" />
          <path d="m25 17 8 14-8-4-7 4Z" fill="#9eae95" />
          <path d="m29 49 13-22 16 22Z" fill="#9eae95" />
        </svg>
        100CimsCat
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.1, maxWidth: 850 }}>El teu quadern de muntanya.</div>
        <div style={{ fontSize: 30, color: '#536d58' }}>Cada ascensió, un record. Segueix el teu repte dels 100 Cims.</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#536d58', fontSize: 23 }}>
        <span>Explora · Puja · Recorda</span>
        <svg width="235" height="88" viewBox="0 0 235 88">
          <path d="M0 88 58 8 118 88Z" fill="#9eae95" />
          <path d="m72 88 71-88 92 88Z" fill="#315c45" />
          <path d="m143 0 25 24-26-8-20 10Z" fill="#e3d49f" />
        </svg>
      </div>
    </div>,
    size,
  )
}
