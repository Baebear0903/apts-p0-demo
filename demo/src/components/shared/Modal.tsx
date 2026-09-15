import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Notice } from '@/components/shared/kit'

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" aria-labelledby="modal-title">
        <DialogHeader>
          <DialogTitle id="modal-title">{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

export function Toast({ message, tone = 'error' }: { message: string; tone?: 'error' | 'ok' }) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[70] w-[min(28rem,calc(100vw-2rem))]" aria-live="polite">
      <Notice tone={tone === 'ok' ? 'ok' : 'error'} role="status" className="bg-card pointer-events-auto shadow-lg">
        {message}
      </Notice>
    </div>
  )
}
