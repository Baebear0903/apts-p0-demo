import { useEffect, useRef, type ReactNode } from 'react'

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const lastFocus = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      lastFocus.current?.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="modal-title">{title}</h3>
          <button ref={closeRef} type="button" className="btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toast({ message, tone = 'error' }: { message: string; tone?: 'error' | 'ok' }) {
  return (
    <div className={tone === 'ok' ? 'toast toast-ok' : 'toast'} role="status">
      {message}
    </div>
  )
}
