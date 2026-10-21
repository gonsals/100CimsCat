import { mountainArtwork } from '@/lib/mountain-art'
import type { Language } from '@/lib/tracker'

export type ProgressFigures = { essential: number; summits: number; visits: number }

const copy = {
  ca: { eyebrow: 'EL MEU REPTE DELS 100 CIMS', first: 'Cada cim,', second: 'una història.', essential: 'cims essencials completats', singleEssential: 'cim essencial completat', summits: 'cims al meu quadern', singleSummit: 'cim al meu quadern', visits: 'ascensions viscudes', singleVisit: 'ascensió viscuda', terrain: 'PEDRAFORCA · RELLEU IL·LUSTRAT' },
  es: { eyebrow: 'MI RETO DE LAS 100 CIMAS', first: 'Cada cima,', second: 'una historia.', essential: 'cimas esenciales completadas', singleEssential: 'cima esencial completada', summits: 'cimas en mi cuaderno', singleSummit: 'cima en mi cuaderno', visits: 'ascensiones vividas', singleVisit: 'ascensión vivida', terrain: 'PEDRAFORCA · RELIEVE ILUSTRADO' },
  en: { eyebrow: 'MY 100 SUMMITS CHALLENGE', first: 'Every summit,', second: 'a story.', essential: 'essential summits completed', singleEssential: 'essential summit completed', summits: 'summits in my journal', singleSummit: 'summit in my journal', visits: 'ascents to remember', singleVisit: 'ascent to remember', terrain: 'PEDRAFORCA · ILLUSTRATED TERRAIN' },
}

// Only aggregate figures enter this renderer. Photos, notes and account data do not.
export async function createProgressCard(figures: ProgressFigures, language: Language): Promise<File> {
  const t = copy[language]
  const style = getComputedStyle(document.documentElement)
  const heading = style.getPropertyValue('--font-heading').trim() || 'Georgia, serif'
  const body = style.getPropertyValue('--font-body').trim() || 'sans-serif'
  await Promise.allSettled([
    document.fonts.load(`600 82px ${heading}`, t.first),
    document.fonts.load(`italic 500 82px ${heading}`, t.second),
    document.fonts.load(`600 170px ${heading}`, '0123456789'),
    document.fonts.load(`500 28px ${body}`, t.essential),
    document.fonts.load(`600 36px ${body}`, '100CimsCat'),
  ])
  const image = new Image()
  image.src = `/mountains/${mountainArtwork('pollego-superior-pedraforca')!.file}`
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = 1080; canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  const essential = Math.max(0, Math.trunc(figures.essential))
  const summits = Math.max(0, Math.trunc(figures.summits))
  const visits = Math.max(0, Math.trunc(figures.visits))
  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'ca-ES'
  const number = (value: number) => value.toLocaleString(locale)
  function text(value: string, x: number, y: number, font: string, color = '#263d30') {
    ctx!.font = font; ctx!.fillStyle = color; ctx!.fillText(value, x, y)
  }

  ctx.fillStyle = '#f5f4ef'; ctx.fillRect(0, 0, 1080, 1350)
  ctx.fillStyle = '#263d30'; ctx.beginPath(); ctx.roundRect(72, 68, 60, 60, 14); ctx.fill()
  ctx.fillStyle = '#e3d49f'; ctx.beginPath(); ctx.arc(116, 84, 6, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fffefa'; ctx.beginPath(); ctx.moveTo(79, 115); ctx.lineTo(96, 80); ctx.lineTo(119, 115); ctx.fill()
  ctx.fillStyle = '#a9bea1'; ctx.beginPath(); ctx.moveTo(101, 115); ctx.lineTo(113, 96); ctx.lineTo(127, 115); ctx.fill()
  text('100CimsCat', 152, 110, `600 36px ${heading}`)
  ctx.fillStyle = '#d4dccf'; ctx.fillRect(72, 158, 936, 1)
  text(t.eyebrow, 72, 212, `600 21px ${body}`, '#536d58')
  text(t.first, 72, 316, `600 82px ${heading}`)
  text(t.second, 72, 406, `italic 500 82px ${heading}`, '#65805d')

  const count = number(essential)
  text(count, 68, 594, `600 170px ${heading}`, '#315c45')
  const countWidth = ctx.measureText(count).width
  text('/ 100', 92 + countWidth, 580, `500 54px ${body}`, '#536d58')
  text(essential === 1 ? t.singleEssential : t.essential, 78, 644, `500 28px ${body}`, '#536d58')
  ctx.fillStyle = '#dce3d7'; ctx.beginPath(); ctx.roundRect(72, 677, 936, 12, 6); ctx.fill()
  const progress = Math.min(1, essential / 100)
  if (progress > 0) { ctx.fillStyle = '#456b4b'; ctx.beginPath(); ctx.roundRect(72, 677, Math.max(12, 936 * progress), 12, 6); ctx.fill() }
  text(number(summits), 72, 754, `600 38px ${body}`)
  text(summits === 1 ? t.singleSummit : t.summits, 72, 790, `500 23px ${body}`, '#536d58')
  ctx.fillStyle = '#d4dccf'; ctx.fillRect(530, 720, 1, 80)
  text(number(visits), 578, 754, `600 38px ${body}`)
  text(visits === 1 ? t.singleVisit : t.visits, 578, 790, `500 23px ${body}`, '#536d58')

  // Fill the lower panel without distorting the real silhouette.
  const cropHeight = image.naturalWidth * 505 / 1080
  const cropY = (image.naturalHeight - cropHeight) * .35
  ctx.drawImage(image, 0, cropY, image.naturalWidth, cropHeight, 0, 845, 1080, 505)
  const shade = ctx.createLinearGradient(0, 1120, 0, 1350)
  shade.addColorStop(0, 'rgba(20,43,34,0)'); shade.addColorStop(1, 'rgba(20,43,34,.65)')
  ctx.fillStyle = shade; ctx.fillRect(0, 1120, 1080, 230)
  text(t.terrain, 72, 1240, `600 21px ${body}`, '#fffefa')
  text('100-cims-cat.vercel.app', 72, 1300, `500 25px ${body}`, '#fffefa')
  ctx.textAlign = 'right'
  text('ICGC · CC BY 4.0 · icgc.cat', 1008, 1300, `500 18px ${body}`, '#e0e8df')
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG unavailable')), 'image/png'))
  return new File([blob], '100cimscat-progress.png', { type: 'image/png' })
}
