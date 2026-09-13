import { Link } from 'react-router-dom'
import { ROUTES } from '../app/routes'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button, Panel } from '@/components/shared/kit'

export function NotFoundPage() {
  return (
    <section>
      <PageHeader title="未找到页面" />
      <Panel>
        <p className="mb-3">没有对应路由。</p>
        <Button nativeButton={false} render={<Link to={ROUTES.workbench} />}>返回工作台</Button>
      </Panel>
    </section>
  )
}
