import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { tagDetailPath, tagNewPath } from '../../app/routes'
import { tagAvailability } from '../../engine/availability'
import { useDemoStore } from '../../store/DemoStoreContext'
import { organizationName } from '../../store/selectors'
import { PageHeader, StatusText } from '../../ui/PageHeader'
import type { TagStatus, TagType } from '../../domain/types'

export function TagListPage() {
  const { state } = useDemoStore()
  const navigate = useNavigate()
  const canCreate = state.session.permissions.buttons.tagCreate
  const [typeFilter, setTypeFilter] = useState<'all' | TagType>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | TagStatus | 'all'>('active')
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all')

  const rows = useMemo(() => {
    return state.tags.filter((tag) => {
      if (typeFilter !== 'all' && tag.type !== typeFilter) return false
      if (statusFilter === 'active' && tag.status === 'deleted') return false
      if (statusFilter !== 'all' && statusFilter !== 'active' && tag.status !== statusFilter) return false
      const available = tagAvailability(state, tag).available
      if (availabilityFilter === 'available' && !available) return false
      if (availabilityFilter === 'unavailable' && available) return false
      return true
    })
  }, [state, typeFilter, statusFilter, availabilityFilter])

  const emptyAll = state.tags.filter((tag) => tag.status !== 'deleted').length === 0

  return (
    <section>
      <PageHeader
        title="标签中心"
        description="维护标签定义、规则与试算。已发布保存即成为后续计算当前逻辑。"
        extra={
          canCreate ? (
            <div className="toolbar-actions">
              <button type="button" className="btn-primary" onClick={() => navigate(tagNewPath('basic'))}>
                新建基础标签
              </button>
              <button type="button" className="btn-ghost" onClick={() => navigate(tagNewPath('composite'))}>
                新建复合标签
              </button>
            </div>
          ) : null
        }
      />
      <div className="panel">
        <div className="filters">
          <label>
            类型
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
              <option value="all">全部</option>
              <option value="basic">基础</option>
              <option value="composite">复合</option>
            </select>
          </label>
          <label>
            状态
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="active">默认（不含已删除）</option>
              <option value="all">全部</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="manually_disabled">人工停用</option>
              <option value="deleted">已删除</option>
            </select>
          </label>
          <label>
            可用性
            <select
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value as typeof availabilityFilter)}
            >
              <option value="all">全部</option>
              <option value="available">可用</option>
              <option value="unavailable">不可用</option>
            </select>
          </label>
        </div>
        {rows.length === 0 ? (
          <p className="empty">
            {emptyAll ? (
              <>
                暂无标签。
                {canCreate ? (
                  <>
                    <button type="button" className="btn-primary" onClick={() => navigate(tagNewPath('basic'))}>
                      新建基础标签
                    </button>
                  </>
                ) : null}
              </>
            ) : (
              '没有符合筛选的标签。'
            )}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>稳定标识</th>
                  <th>类型</th>
                  <th>分类</th>
                  <th>状态</th>
                  <th>可用性</th>
                  <th>自动识别</th>
                  <th>责任组织</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tag) => {
                  const availability = tagAvailability(state, tag)
                  return (
                    <tr key={tag.id}>
                      <td>
                        <Link to={tagDetailPath(tag.id)}>{tag.name || '（未命名）'}</Link>
                      </td>
                      <td>{tag.id}</td>
                      <td>{tag.type === 'basic' ? '基础' : '复合'}</td>
                      <td>{tag.category}</td>
                      <td>
                        <StatusText>{tagStatusLabel(tag.status)}</StatusText>
                      </td>
                      <td>
                        {availability.available ? (
                          <StatusText>可用</StatusText>
                        ) : (
                          <StatusText>不可用：{availability.reasons.join('；')}</StatusText>
                        )}
                      </td>
                      <td>
                        {tag.autoRecognitionEnabled
                          ? `开 · 每 ${tag.autoRecognitionIntervalDays ?? '—'} 天`
                          : '关'}
                      </td>
                      <td>{organizationName(state, tag.responsibleOrgId)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
