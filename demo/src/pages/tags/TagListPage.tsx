import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { tagDetailPath, tagNewPath } from '../../app/routes'
import { tagAvailability } from '../../engine/availability'
import { useDemoStore } from '../../store/DemoStoreContext'
import { organizationName } from '../../store/selectors'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  Button,
  EmptyHint,
  FilterField,
  FullSelect,
  Panel,
  StatusText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Toolbar,
} from '@/components/shared/kit'
import { NativeSelectOption } from '@/components/ui/native-select'
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
            <Toolbar className="mb-0">
              <Button type="button" onClick={() => navigate(tagNewPath('basic'))}>
                新建基础标签
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(tagNewPath('composite'))}>
                新建复合标签
              </Button>
            </Toolbar>
          ) : null
        }
      />
      <Panel>
        <Toolbar className="mb-3">
          <FilterField label="类型">
            <FullSelect value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
              <NativeSelectOption value="all">全部</NativeSelectOption>
              <NativeSelectOption value="basic">基础</NativeSelectOption>
              <NativeSelectOption value="composite">复合</NativeSelectOption>
            </FullSelect>
          </FilterField>
          <FilterField label="状态">
            <FullSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <NativeSelectOption value="active">默认（不含已删除）</NativeSelectOption>
              <NativeSelectOption value="all">全部</NativeSelectOption>
              <NativeSelectOption value="draft">草稿</NativeSelectOption>
              <NativeSelectOption value="published">已发布</NativeSelectOption>
              <NativeSelectOption value="manually_disabled">人工停用</NativeSelectOption>
              <NativeSelectOption value="deleted">已删除</NativeSelectOption>
            </FullSelect>
          </FilterField>
          <FilterField label="可用性">
            <FullSelect
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value as typeof availabilityFilter)}
            >
              <NativeSelectOption value="all">全部</NativeSelectOption>
              <NativeSelectOption value="available">可用</NativeSelectOption>
              <NativeSelectOption value="unavailable">不可用</NativeSelectOption>
            </FullSelect>
          </FilterField>
        </Toolbar>
        {rows.length === 0 ? (
          <EmptyHint
            action={
              emptyAll && canCreate ? (
                <Button type="button" onClick={() => navigate(tagNewPath('basic'))}>
                  新建基础标签
                </Button>
              ) : null
            }
          >
            {emptyAll ? '暂无标签。' : '没有符合筛选的标签。'}
          </EmptyHint>
        ) : (
          <Table className="[&_td]:whitespace-normal">
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>稳定标识</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>可用性</TableHead>
                <TableHead>自动识别</TableHead>
                <TableHead>责任组织</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tag) => {
                const availability = tagAvailability(state, tag)
                return (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <Link className="text-primary font-medium hover:underline" to={tagDetailPath(tag.id)}>
                        {tag.name || '（未命名）'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tag.id}</TableCell>
                    <TableCell>{tag.type === 'basic' ? '基础' : '复合'}</TableCell>
                    <TableCell>{tag.category}</TableCell>
                    <TableCell>
                      <StatusText>{tagStatusLabel(tag.status)}</StatusText>
                    </TableCell>
                    <TableCell>
                      {availability.available ? (
                        <StatusText>可用</StatusText>
                      ) : (
                        <StatusText className="whitespace-normal text-left">不可用：{availability.reasons.join('；')}</StatusText>
                      )}
                    </TableCell>
                    <TableCell>
                      {tag.autoRecognitionEnabled ? `开 · 每 ${tag.autoRecognitionIntervalDays ?? '—'} 天` : '关'}
                    </TableCell>
                    <TableCell>{organizationName(state, tag.responsibleOrgId)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
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
