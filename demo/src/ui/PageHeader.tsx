import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '../demo/clock'
import { useDemoStore } from '../store/DemoStoreContext'

export function PageHeader({
  title,
  description,
  backTo,
  backLabel = '返回列表',
  extra,
}: {
  title: string
  description?: ReactNode
  backTo?: string
  backLabel?: string
  extra?: ReactNode
}) {
  const { state } = useDemoStore()
  return (
    <header className="page-header">
      <div>
        {backTo ? (
          <Link className="back-link" to={backTo}>
            ← {backLabel}
          </Link>
        ) : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {extra}
      </div>
      <div className="clock-chip" data-testid="demo-clock">
        演示时间 {formatDateTime(state.clock)}
      </div>
    </header>
  )
}

export function LaterStageNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="notice" role="note">
      <strong>本页将在后续阶段提供完整操作。</strong>
      {children ? <div>{children}</div> : null}
    </div>
  )
}

export function PhoneNote() {
  return <p className="phone-note">联系电话为虚构演示号码，非真实号码。</p>
}

export function StatusText({ children }: { children: ReactNode }) {
  return <span className="status">{children}</span>
}
