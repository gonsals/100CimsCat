import type { CSSProperties } from 'react'

const paths = {
  share: 'M12 16V3m-4 4 4-4 4 4M5 13v8h14v-8',
  arrow: 'M7 17 17 7M7 7h10v10', back: 'm14 6-6 6 6 6', next: 'm10 6 6 6-6 6', down: 'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4',
  close: 'm6 6 12 12M18 6 6 18', check: 'm5 12 4 4L19 6', plus: 'M12 5v14M5 12h14',
  settings: 'M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
  grid: 'M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z',
  map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3ZM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7',
  image: 'M3 3h18v18H3ZM3 17l6-6 4 4 3-3 5 5M16 7h.01',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15M16 16l5 5',
  logout: 'M9 4H4v16h5m4-13 5 5-5 5m-5-5h13',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
  moon: 'M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z',
  alert: 'm12 3 10 18H2ZM12 9v5m0 3h.01', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v6m0-10h.01',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  book: 'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3ZM12 6v16',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
} as const

export type IconName = keyof typeof paths
export default function Icon({ name, size = 18, className = '', style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`ui-icon ${className}`} style={style} aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}

export function BrandMark() {
  return <svg width="34" height="34" viewBox="0 0 64 64" className="brand-symbol" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="14" fill="#263d30" /><circle cx="47" cy="17" r="6" fill="#e3d49f" /><path d="M6 49 25 17 44 49Z" fill="#fffefa" /><path d="m25 17 8 14-8-4-7 4Z" fill="#9eae95" /><path d="m29 49 13-22 16 22Z" fill="#9eae95" /></svg>
}
