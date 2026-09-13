import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@/demo/clock'
import { useDemoStore } from '@/store/DemoStoreContext'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from '@/components/ui/breadcrumb'
import { Clock3 } from 'lucide-react'
import { Muted, Notice, StatusText } from '@/components/shared/kit'

export { StatusText }

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
    <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-1">
        {backTo ? (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink className="text-xs" render={<Link to={backTo} />}>
                  {backLabel}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? <div className="text-muted-foreground text-sm">{description}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {extra}
        <Badge variant="outline" className="h-8 gap-1.5 px-2.5 font-normal" data-testid="demo-clock">
          <Clock3 className="size-3.5" />
          演示时间 {formatDateTime(state.clock)}
        </Badge>
      </div>
    </header>
  )
}

export function LaterStageNotice({ children }: { children?: ReactNode }) {
  return (
    <Notice tone="info" role="note">
      <strong>本页将在后续阶段提供完整操作。</strong>
      {children ? <div className="mt-1">{children}</div> : null}
    </Notice>
  )
}

export function PhoneNote() {
  return <Muted className="mt-2">联系电话为虚构演示号码，非真实号码。</Muted>
}
