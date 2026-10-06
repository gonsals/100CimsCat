type MountainPlaceholderProps = {
  seed: string
}

const palettes = [
  { sky: ['#e9e8d7', '#c6d6ca'], glow: '#f0cf91', far: '#a0b6a9', mid: '#748f7b', front: '#365849', snow: '#f0efe4' },
  { sky: ['#e8e2d6', '#c5d5d1'], glow: '#f4c890', far: '#a1b5ad', mid: '#718a81', front: '#344e48', snow: '#f2eee5' },
  { sky: ['#e7e9df', '#c6d6c7'], glow: '#efd19c', far: '#a8b9a5', mid: '#7d9277', front: '#3c5745', snow: '#f3f0e6' },
] as const

const ridges = [
  'M0 308 88 236 149 270 251 142 315 225 402 119 494 253 573 171 720 282V420H0Z',
  'M0 286 103 204 183 273 290 126 365 232 465 151 558 271 628 195 720 254V420H0Z',
  'M0 297 91 244 177 282 281 159 348 228 453 115 542 263 635 174 720 267V420H0Z',
] as const

const mainPeaks = [
  'M102 420 213 302 270 229 332 279 424 112 503 226 567 293 655 420Z',
  'M66 420 170 313 247 247 310 287 404 137 464 211 542 288 649 342 711 420Z',
  'M84 420 168 323 244 257 320 295 421 106 482 207 548 286 651 330 720 420Z',
] as const

export default function MountainPlaceholder({ seed }: MountainPlaceholderProps) {
  const hash = Array.from(seed).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7)
  const variant = hash % palettes.length
  const palette = palettes[variant]
  const ids = `summit-scene-${hash.toString(36)}`
  const sunX = 470 + (hash % 110)

  return (
    <svg
      className="mountain-placeholder"
      viewBox="0 0 720 420"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`${ids}-sky`} x2="0" y2="1">
          <stop stopColor={palette.sky[0]} />
          <stop offset="1" stopColor={palette.sky[1]} />
        </linearGradient>
        <radialGradient id={`${ids}-glow`}>
          <stop stopColor={palette.glow} stopOpacity=".58" />
          <stop offset="1" stopColor={palette.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${ids}-slope`} x1=".15" y1="0" x2=".85" y2="1">
          <stop stopColor={palette.mid} />
          <stop offset="1" stopColor={palette.front} />
        </linearGradient>
        <linearGradient id={`${ids}-snow`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fffdf3" />
          <stop offset="1" stopColor={palette.snow} />
        </linearGradient>
      </defs>

      <path fill={`url(#${ids}-sky)`} d="M0 0h720v420H0z" />
      <circle cx={sunX} cy="126" r="146" fill={`url(#${ids}-glow)`} />
      <circle cx={sunX} cy="126" r="35" fill={palette.glow} opacity=".82" />
      <path d="M0 309c115-26 190-12 289 1s222 18 431-9v119H0z" fill={palette.far} opacity=".68" />
      <path d={ridges[variant]} fill={palette.far} />
      <path d="M0 348c91-25 161-16 241-4s170 14 246-8 147-24 233-8v102H0z" fill={palette.mid} opacity=".63" />
      <path d={mainPeaks[variant]} fill={`url(#${ids}-slope)`} />

      <path d={variant === 1 ? 'm404 137 25 39-27-12-20 22 8-25Z' : 'm421 106 31 48-29-18-22 25 10-33Z'} fill={`url(#${ids}-snow)`} />
      <path d="m434 127 18 27-22-13-13 18 9-25Z" fill="#d9e1d4" opacity=".9" />
      <path d="M108 420c60-56 91-86 143-110 48-22 81-40 112-69" fill="none" stroke="#d8d7bd" strokeWidth="3" strokeLinecap="round" opacity=".56" />
      <path d="M133 420c56-52 94-74 137-93" fill="none" stroke="#f0eddb" strokeWidth="1.5" strokeLinecap="round" opacity=".42" />

      <g fill="none" stroke="#e4e8d8" strokeWidth="1.4" opacity=".24">
        <path d="M-22 355c92-44 166-45 246-20s139 25 201-7 151-40 328 11" />
        <path d="M-22 372c92-44 166-45 246-20s139 25 201-7 151-40 328 11" />
        <path d="M-22 389c92-44 166-45 246-20s139 25 201-7 151-40 328 11" />
      </g>

      <path d="M0 393c86-29 156-23 241-5s152 18 229-7 159-31 250-9v48H0z" fill={palette.front} />
      <path d="M518 420c42-28 93-42 202-40v40z" fill="#263f37" opacity=".44" />
      <path d="M0 0h720v420H0z" fill="url(#${ids}-sky)" opacity=".08" />
    </svg>
  )
}
