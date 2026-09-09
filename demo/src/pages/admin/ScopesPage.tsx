import { useDemoStore } from '../../store/DemoStoreContext'
import { PageHeader, StatusText } from '../../ui/PageHeader'
import { Dd, DescriptionList, Dt, Muted, Panel } from '../../ui/kit'

export function ScopesPage() {
  const { state } = useDemoStore()
  const scope = state.patientScope
  return (
    <section>
      <PageHeader title="患者范围" description="P0 固定全院，无多院区编辑。" />
      <Panel>
        <DescriptionList>
          <Dt>当前范围</Dt>
          <Dd>
            <StatusText>{scope.name}</StatusText>
          </Dd>
          <Dt>稳定标识</Dt>
          <Dd>{scope.id}</Dd>
          <Dt>无院区就诊的建档对象</Dt>
          <Dd>{scope.includesUnassignedArchives ? '包含' : '不含'}</Dd>
          <Dt>说明</Dt>
          <Dd>{scope.description}</Dd>
        </DescriptionList>
        <Muted className="mt-4">
          全院范围是各院区就诊归属的并集，不是数据底座中的全部对象。P0 Demo 不提供范围切换或纳入开关。
        </Muted>
      </Panel>
    </section>
  )
}
