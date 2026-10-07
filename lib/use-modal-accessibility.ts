'use client'

import { useEffect } from 'react'

// Existing account dialogs use a backdrop; keep focus and scrolling inside them.
export function useModalAccessibility(open: boolean, canClose: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const panel = document.querySelector<HTMLElement>('.modal-backdrop:last-of-type [role="dialog"]') ?? document.querySelector<HTMLElement>('.modal-backdrop [role="dialog"]')
    if (!panel) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], textarea:not(:disabled), [tabindex="0"]')]
    focusable()[0]?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape' && canClose) { event.preventDefault(); close() }
      if (event.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [open, canClose, close])
}
