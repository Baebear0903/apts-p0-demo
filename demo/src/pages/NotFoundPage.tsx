import { Link } from 'react-router-dom'
import { ROUTES } from '../app/routes'
import { PageHeader } from '../ui/PageHeader'

export function NotFoundPage() {
  return (
    <section>
      <PageHeader title="未找到页面" />
      <div className="panel">
        <p>没有对应路由。</p>
        <Link to={ROUTES.workbench}>返回工作台</Link>
      </div>
    </section>
  )
}
