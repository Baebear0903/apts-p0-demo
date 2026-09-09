import { useDemoStore } from '../../store/DemoStoreContext'
import { PageHeader, StatusText } from '../../ui/PageHeader'

export function ScopesPage() {
  const { state } = useDemoStore()
  const scope = state.patientScope
  return (
    <section>
      <PageHeader title="患者范围" description="P0 固定全院，无多院区编辑。" />
      <div className="panel">
        <dl className="dl">
          <dt>当前范围</dt>
          <dd>
            <StatusText>{scope.name}</StatusText>
          </dd>
          <dt>稳定标识</dt>
          <dd>{scope.id}</dd>
          <dt>无院区就诊的建档对象</dt>
          <dd>{scope.includesUnassignedArchives ? '包含' : '不含'}</dd>
          <dt>说明</dt>
          <dd>{scope.description}</dd>
        </dl>
        <p className="muted">
          全院范围是各院区就诊归属的并集，不是数据底座中的全部对象。P0 Demo 不提供范围切换或纳入开关。
        </p>
      </div>
    </section>
  )
}
