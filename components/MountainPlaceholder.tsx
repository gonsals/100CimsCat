type MountainPlaceholderProps = {
  name: string
  height: number
  region: string
}

const palettes = [
  { sky: ['#e9e8d7', '#c6d6ca'], glow: '#f0cf91', far: '#a0b6a9', mid: '#748f7b', front: '#365849', snow: '#f0efe4' },
  { sky: ['#e8e2d6', '#c5d5d1'], glow: '#f4c890', far: '#a1b5ad', mid: '#718a81', front: '#344e48', snow: '#f2eee5' },
  { sky: ['#e7e9df', '#c6d6c7'], glow: '#efd19c', far: '#a8b9a5', mid: '#7d9277', front: '#3c5745', snow: '#f3f0e6' },
  { sky: ['#dfe8e4', '#c3d3ca'], glow: '#e9c58f', far: '#9aad9e', mid: '#718779', front: '#344d41', snow: '#f3f1e8' },
  { sky: ['#e8e1d9', '#c8d4ce'], glow: '#efc999', far: '#a9b6a6', mid: '#778878', front: '#3c5144', snow: '#f2eee4' },
] as const

function randomFrom(seed: number) {
  let state = seed || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function ridgePath(random: () => number, base: number, spread: number, count: number) {
  const points = Array.from({ length: count }, (_, index) => {
    const x = (index / (count - 1)) * 720
    const peak = base - random() * spread
    const shoulder = index > 0 && index < count - 1 ? 0 : 36
    return [x, peak + shoulder] as const
  })

  return `M${points.map(([x, y]) => `${x} ${y}`).join(' L')} L720 420 H0Z`
}

export default function MountainPlaceholder({ name, height, region }: MountainPlaceholderProps) {
  const key = `${name}|${region}`
  const hash = Array.from(key).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7)
  const random = randomFrom(hash)
  const palette = palettes[hash % palettes.length]
  const ids = `summit-scene-${hash.toString(36)}`
  const sunX = 120 + random() * 480
  const sunY = 76 + random() * 88
  const peakCount = 7 + Math.floor(random() * 5)
  const farRidge = ridgePath(random, 282 + random() * 30, 102, peakCount + 2)
  const mainRidge = ridgePath(random, 343, 226, peakCount)
  const snowY = 120 + Math.max(0, 2900 - height) / 22
  const ridgeCenter = 260 + Math.floor(random() * 220)
  const cliff = random() > 0.52

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
      <circle cx={sunX} cy={sunY} r="146" fill={`url(#${ids}-glow)`} />
      <circle cx={sunX} cy={sunY} r="30" fill={palette.glow} opacity=".82" />
      <path d="M0 309c115-26 190-12 289 1s222 18 431-9v119H0z" fill={palette.far} opacity=".58" />
      <path d={farRidge} fill={palette.far} />
      <path d="M0 348c91-25 161-16 241-4s170 14 246-8 147-24 233-8v102H0z" fill={palette.mid} opacity=".55" />
      <path d={mainRidge} fill={`url(#${ids}-slope)`} />

      {height > 1550 && <path
        d={`M${ridgeCenter - 125} 255 l${cliff ? 72 : 48} -${Math.max(24, 260 - snowY)} ${cliff ? 42 : 55} ${Math.max(16, 276 - snowY - 26)} ${cliff ? 28 : 43} -${Math.max(18, 258 - snowY - 12)} ${cliff ? 66 : 59} ${Math.max(25, 275 - snowY)} -42 58 -40 15 -23 29 -4 -33Z`}
        fill={`url(#${ids}-snow)`}
        opacity={Math.min(0.95, 0.5 + (height - 1550) / 2800)}
      />}
      <path d={`M${ridgeCenter - 165} 420c55-57 92-93 139-124 43-28 72-52 108-88`} fill="none" stroke="#d8d7bd" strokeWidth="3" strokeLinecap="round" opacity=".48" />
      <path d={`M${ridgeCenter - 138} 420c43-42 70-65 111-86`} fill="none" stroke="#f0eddb" strokeWidth="1.5" strokeLinecap="round" opacity=".38" />

      <g fill="none" stroke="#e4e8d8" strokeWidth="1.4" opacity=".2">
        <path d="M-22 355c92-44 166-45 246-20s139 25 201-7 151-40 328 11" />
        <path d="M-22 372c92-44 166-45 246-20s139 25 201-7 151-40 328 11" />
        <path d="M-22 389c92-44 166-45 246-20s139 25 201-7 151-40 328 11" />
      </g>

      <path d="M0 393c86-29 156-23 241-5s152 18 229-7 159-31 250-9v48H0z" fill={palette.front} />
      <path d={`M${420 + random() * 170} 420c42-28 93-42 202-40v40z`} fill="#263f37" opacity=".44" />
      <path d={`M0 0h720v420H0z`} fill={`url(#${ids}-sky)`} opacity=".08" />
    </svg>
  )
}
