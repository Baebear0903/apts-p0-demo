import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Notice } from './kit'

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
    <Notice tone={tone === 'ok' ? 'ok' : 'error'} role="status">
      {message}
    </Notice>
  )
}
