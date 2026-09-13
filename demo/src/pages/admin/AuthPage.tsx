import { isTagAuthorized } from '../../engine/includeExclude'
import { useDemoStore } from '../../store/DemoStoreContext'
import { organizationName } from '../../store/selectors'
import { PageHeader, StatusText } from '@/components/shared/PageHeader'
import { Muted, PageStack, Panel, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shared/kit'

const DEMO_ROLES = [
  { name: '标签维护', scope: '标签定义、试算、发布与自动识别配置' },
  { name: '运营处理', scope: '识别复核、人群圈选与快照确认' },
  { name: '数据开放配置', scope: '数据集交付与标签订阅的新建、启停与导出' },
  { name: '管理查看', scope: '数据集、指标库、已对接系统与患者范围' },
]

export function AuthPage() {
  const { state } = useDemoStore()
  const tags = state.tags.filter((tag) => tag.status !== 'deleted')

  return (
    <section>
      <PageHeader
        title="标签使用授权"
        description="统一门户按角色配置标签白名单。本 Demo 不提供授权编辑，只展示演示账号当前可见范围。"
      />
      <PageStack>
        <Panel title="演示账号">
          <dl className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">账号</dt>
            <dd>演示经办人</dd>
            <dt className="text-muted-foreground">患者范围</dt>
            <dd>{state.patientScope.name}</dd>
            <dt className="text-muted-foreground">授权方式</dt>
            <dd>演示账号默认全部授权；新建标签自动进入白名单。此约定不推导为生产政策。</dd>
          </dl>
          <Muted className="mt-4">授权某复合标签不等于授权其引用的基础标签，白名单不沿引用关系扩大。</Muted>
        </Panel>

        <Panel title="职责模板（参考分工）" description="医院可将其组合为统一门户角色。APTS 不把岗位名称写死为系统角色。">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>职责</TableHead>
                <TableHead>本 Demo 可见范围</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_ROLES.map((role) => (
                <TableRow key={role.name}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.scope}</TableCell>
                  <TableCell>
                    <StatusText>已授予</StatusText>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="标签白名单" testId="auth-whitelist">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标签</TableHead>
                <TableHead>稳定标识</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>责任组织</TableHead>
                <TableHead>使用授权</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="font-medium">{tag.name}</TableCell>
                  <TableCell className="text-muted-foreground">{tag.id}</TableCell>
                  <TableCell>
                    <StatusText>{tagStatusLabel(tag.status)}</StatusText>
                  </TableCell>
                  <TableCell>{organizationName(state, tag.responsibleOrgId)}</TableCell>
                  <TableCell>
                    <StatusText>{isTagAuthorized(state, tag.id) ? '已授权' : '未授权'}</StatusText>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </PageStack>
    </section>
  )
}

function tagStatusLabel(status: string): string {
  if (status === 'published') return '已发布'
  if (status === 'draft') return '草稿'
  if (status === 'manually_disabled') return '人工停用'
  if (status === 'deleted') return '已删除'
  return status
}
