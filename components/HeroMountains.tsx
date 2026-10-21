'use client'

import { useEffect, useRef, useState } from 'react'
import catalog from '@/data/summits.json'
import MountainPlaceholder from '@/components/MountainPlaceholder'
import Icon from '@/components/Icon'
import { mountainArtwork } from '@/lib/mountain-art'
import type { Language } from '@/lib/tracker'

const summits = ['pollego-superior-pedraforca', 'puigmal', 'sant-jeroni', 'canigo', 'matagalls', 'puigsacalm'].map(id => catalog.find(summit => summit.id === id)!)
const copy = {
  ca: { label: 'Cims destacats', previous: 'Cim anterior', next: 'Cim següent', pause: 'Pausar les imatges', play: 'Reprendre les imatges' },
  es: { label: 'Cimas destacadas', previous: 'Cima anterior', next: 'Cima siguiente', pause: 'Pausar las imágenes', play: 'Reanudar las imágenes' },
  en: { label: 'Featured summits', previous: 'Previous summit', next: 'Next summit', pause: 'Pause images', play: 'Resume images' },
}

export default function HeroMountains({ language }: { language: Language }) {
  const [slide, setSlide] = useState<{ current: number; previous: number | null }>({ current: 0, previous: null })
  const [requested, setRequested] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const figure = useRef<HTMLElement>(null)
  const playButton = useRef<HTMLButtonElement>(null)
  const t = copy[language]
  const summit = summits[slide.current]

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => { if (media.matches) setPlaying(false) }
    const visibility = () => setPageVisible(!document.hidden)
    motion(); visibility()
    media.addEventListener('change', motion)
    document.addEventListener('visibilitychange', visibility)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (figure.current) observer.observe(figure.current)
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); observer.disconnect() }
  }, [])

  useEffect(() => {
    if (!playing || hovered || !visible || !pageVisible) return
    const timer = window.setTimeout(() => setRequested(index => (index + 1) % summits.length), 8000)
    return () => window.clearTimeout(timer)
  }, [playing, hovered, visible, pageVisible, requested])

  useEffect(() => {
    if (requested === slide.current) return
    let active = true
    const image = new window.Image()
    image.src = `/mountains/${mountainArtwork(summits[requested].id)!.file}`
    // Keep the previous landscape visible until the incoming SVG is decoded.
    void image.decode().then(() => {
      if (active) setSlide(previous => ({ current: requested, previous: previous.current }))
    }).catch(() => { /* A failed image leaves the current landscape in place. */ })
    return () => { active = false }
  }, [requested, slide.current])

  useEffect(() => {
    if (slide.previous === null) return
    const timer = window.setTimeout(() => setSlide(current => ({ ...current, previous: null })), 1000)
    return () => window.clearTimeout(timer)
  }, [slide.current, slide.previous])

  function move(direction: number) {
    setPlaying(false)
    setRequested(index => (index + direction + summits.length) % summits.length)
  }

  return <figure ref={figure} className="hero-art hero-rotator" aria-label={t.label}
    onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true) }} onPointerLeave={() => setHovered(false)}
    onFocusCapture={event => { if (event.target !== playButton.current) setPlaying(false) }}>
    {[slide.previous, slide.current].filter((index): index is number => index !== null).map(index => <div key={summits[index].id} className={`hero-mountain-slide ${index === slide.current ? 'is-current' : ''} ${slide.previous !== null && index === slide.current ? 'is-entering' : ''}`} aria-hidden="true"><MountainPlaceholder summitId={summits[index].id} eager /></div>)}
    <figcaption className="art-label" aria-live={playing ? 'off' : 'polite'} aria-atomic="true">{slide.current === 0 ? 'PEDRAFORCA' : summit.name.toUpperCase()}<br /><span>{summit.height.toLocaleString(language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'ca-ES')} m<span className="hero-mountain-region"> · {summit.region}</span></span></figcaption>
    <div className="hero-mountain-controls"><button type="button" aria-label={t.previous} title={t.previous} onClick={() => move(-1)}><Icon name="back" size={16} /></button><button ref={playButton} type="button" aria-label={playing ? t.pause : t.play} title={playing ? t.pause : t.play} onClick={() => setPlaying(value => !value)}><Icon name={playing ? 'pause' : 'play'} size={16} /></button><button type="button" aria-label={t.next} title={t.next} onClick={() => move(1)}><Icon name="next" size={16} /></button></div>
  </figure>
}
