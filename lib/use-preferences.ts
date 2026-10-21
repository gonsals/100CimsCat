'use client'

import { useEffect, useState } from 'react'
import type { Language } from '@/lib/tracker'

export const preferenceEvent = '100cimscat-preferences'
export function usePreferences() {
  const [language, setLanguage] = useState<Language>('ca')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    function read() {
      const root = document.documentElement
      const lang = root.lang
      if (lang === 'ca' || lang === 'es' || lang === 'en') setLanguage(lang)
      setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light')
    }
    const storage = () => {
      try {
        const root = document.documentElement
        const savedLanguage = localStorage.getItem('100cimscat-language')
        const savedTheme = localStorage.getItem('100cimscat-theme')
        if (savedLanguage === 'ca' || savedLanguage === 'es' || savedLanguage === 'en') root.lang = savedLanguage
        if (savedTheme === 'light' || savedTheme === 'dark') root.dataset.theme = savedTheme
      } catch { /* Keep the current preference. */ }
      read()
    }
    storage(); window.addEventListener(preferenceEvent, read)
    window.addEventListener('storage', storage)
    return () => { window.removeEventListener(preferenceEvent, read); window.removeEventListener('storage', storage) }
  }, [])
  function update(nextLanguage: Language, nextTheme: 'light' | 'dark') {
    document.documentElement.lang = nextLanguage; document.documentElement.dataset.theme = nextTheme
    try { localStorage.setItem('100cimscat-language', nextLanguage); localStorage.setItem('100cimscat-theme', nextTheme) } catch { /* Preferences work for this visit. */ }
    window.dispatchEvent(new Event(preferenceEvent))
  }
  return { language, theme, update }
}
