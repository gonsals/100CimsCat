'use client'

import { useEffect, useRef, useState } from 'react'
import catalog from '@/data/summits.json'
import MountainPlaceholder from '@/components/MountainPlaceholder'
import { mountainArtwork } from '@/lib/mountain-art'
import type { Language } from '@/lib/tracker'

const summits = ['pollego-superior-pedraforca', 'puigmal', 'sant-jeroni', 'canigo', 'matagalls', 'puigsacalm'].map(id => catalog.find(summit => summit.id === id)!)
const copy = {
  ca: 'Cims destacats',
  es: 'Cimas destacadas',
  en: 'Featured summits',
}

export default function HeroMountains({ language }: { language: Language }) {
  const [slide, setSlide] = useState<{ current: number; previous: number | null }>({ current: 0, previous: null })
  const [requested, setRequested] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [visible, setVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const figure = useRef<HTMLElement>(null)
  const summit = summits[slide.current]

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReducedMotion(media.matches)
    const visibility = () => setPageVisible(!document.hidden)
    motion(); visibility()
    media.addEventListener('change', motion)
    document.addEventListener('visibilitychange', visibility)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    if (figure.current) observer.observe(figure.current)
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); observer.disconnect() }
  }, [])

  useEffect(() => {
    if (reducedMotion || !visible || !pageVisible) return
    const timer = window.setTimeout(() => setRequested(index => (index + 1) % summits.length), 30000)
    return () => window.clearTimeout(timer)
  }, [reducedMotion, visible, pageVisible, requested])

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

  return <figure ref={figure} className="hero-art hero-rotator" aria-label={copy[language]}>
    {[slide.previous, slide.current].filter((index): index is number => index !== null).map(index => <div key={summits[index].id} className={`hero-mountain-slide ${index === slide.current ? 'is-current' : ''} ${slide.previous !== null && index === slide.current ? 'is-entering' : ''}`} aria-hidden="true"><MountainPlaceholder summitId={summits[index].id} eager /></div>)}
    <figcaption className="art-label" aria-live="off">{slide.current === 0 ? 'PEDRAFORCA' : summit.name.toUpperCase()}<br /><span>{summit.height.toLocaleString(language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'ca-ES')} m · {summit.region}</span></figcaption>
  </figure>
}
