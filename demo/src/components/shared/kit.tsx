import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from 'react'
import { cn } from 'cn'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function Panel({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  testId,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
  contentClassName?: string
  testId?: string
}) {
  const hasHeader = title != null || description != null || action != null
  return (
    <Card className={cn('gap-0 py-0', className)} data-testid={testId}>
      {hasHeader ? (
        <CardHeader className="border-b py-4">
          {title != null ? <CardTitle className="text-[15px]">{title}</CardTitle> : null}
          {description != null ? <CardDescription>{description}</CardDescription> : null}
          {action != null ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn('py-4', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

export function PageStack({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-col gap-4', className)} {...props}>
      {children}
    </div>
  )
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

export function Split({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 lg:grid-cols-2', className)}>{children}</div>
}

export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>
}

export function FormStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-3', className)}>{children}</div>
}

export function FormField({
  label,
  children,
  className,
  span2,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
  span2?: boolean
}) {
  const generatedId = useId()
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id: (children.props as { id?: string }).id ?? generatedId })
    : children
  const controlId = isValidElement(control) ? (control.props as { id?: string }).id : undefined
  return (
    <Field className={cn(span2 && 'sm:col-span-2', className)}>
      <FieldLabel htmlFor={controlId} className="text-muted-foreground font-normal">{label}</FieldLabel>
      {control}
    </Field>
  )
}

export function FilterField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {children}
    </label>
  )
}

export function DescriptionList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-[minmax(6.5rem,8.5rem)_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm', className)}>
      {children}
    </dl>
  )
}

export function Dt({ children }: { children: ReactNode }) {
  return <dt className="text-muted-foreground pt-0.5">{children}</dt>
}

export function Dd({ children, className, ...props }: ComponentProps<'dd'>) {
  return (
    <dd className={cn('min-w-0', className)} {...props}>
      {children}
    </dd>
  )
}

export function Muted({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-muted-foreground text-xs leading-relaxed', className)}>{children}</p>
}

export function CheckRow({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={cn('flex items-center gap-2 text-sm', className)}>{children}</label>
}

export function NativeCheck({ className, ...props }: ComponentProps<'input'>) {
  return <input type="checkbox" className={cn('accent-primary size-4 shrink-0', className)} {...props} />
}

export function FullSelect({ className, ...props }: ComponentProps<typeof NativeSelect>) {
  return <NativeSelect className={cn('w-full min-w-0', className)} {...props} />
}

type StatusTone = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

export function statusTone(text: string): StatusTone {
  if (/待确认|尚未|草稿/.test(text)) return 'warning'
  if (/不可用|停用|失败|到期|暂停|已删除|已移除|零保留/.test(text)) return 'destructive'
  if (/已发布|已启用|可用|保留|已确认|开 ·|已授权|已授予/.test(text)) return 'success'
  if (/历史|只读|关$/.test(text)) return 'secondary'
  return 'outline'
}

export function StatusText({ children, className }: { children: ReactNode; className?: string }) {
  const text = typeof children === 'string' ? children : ''
  const tone = text ? statusTone(text) : 'outline'
  return (
    <Badge
      variant={tone === 'success' || tone === 'warning' || tone === 'destructive' ? 'outline' : tone}
      className={cn(
        'max-w-full font-normal whitespace-nowrap',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800',
        tone === 'destructive' && 'border-red-200 bg-red-50 text-red-700',
        className,
      )}
    >
      {children}
    </Badge>
  )
}

export function Notice({
  children,
  tone = 'info',
  className,
  ...props
}: ComponentProps<'div'> & { tone?: 'info' | 'warn' | 'ok' | 'error'; children: ReactNode }) {
  return (
    <Alert
      variant={tone === 'error' ? 'destructive' : 'default'}
      className={cn(
        tone === 'warn' && 'border-[color-mix(in_oklch,var(--warning)_40%,white)] bg-[var(--warning-surface)]',
        tone === 'ok' && 'border-primary/20 bg-[var(--success-surface)]',
        tone === 'error' && 'bg-[var(--danger-surface)]',
        tone === 'info' && 'border-primary/15 bg-primary/5',
        className,
      )}
      {...props}
    >
      <AlertDescription className={cn(tone === 'error' ? 'text-destructive' : 'text-foreground')}>{children}</AlertDescription>
    </Alert>
  )
}

export function EmptyHint({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Empty className="border-0 p-6">
      <EmptyHeader>
        {title ? <EmptyTitle>{title}</EmptyTitle> : null}
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  )
}

export {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
}
