'use client'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/components/Icon'

export default function FeatureDialog({
  title,
  closeLabel,
  busy,
  onClose,
  children,
}: {
  title: string
  closeLabel: string
  busy: boolean
  onClose: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!mounted) return
    const element = dialog.current
    const previousFocus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = overflow
      previousFocus?.focus()
    }
  }, [mounted])
  return mounted
    ? createPortal(
        <dialog
          ref={dialog}
          className="feature-dialog"
          aria-labelledby={titleId}
          aria-busy={busy}
          onCancel={(event) => {
            event.preventDefault()
            if (!busy) onClose()
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget || busy) return
            const rect = event.currentTarget.getBoundingClientRect()
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              onClose()
          }}
        >
          <button
            className="modal-close icon-button"
            type="button"
            aria-label={closeLabel}
            disabled={busy}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
          <h2 id={titleId}>{title}</h2>
          {children}
        </dialog>,
        document.body,
      )
    : null
}
