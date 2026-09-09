import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime } from '../../demo/clock'
import type { AppState, EvidenceSlot, Hit, RemoveReasonCode, Tag } from '../../domain/types'
import { latestEyeScoreSlot } from '../../engine/evidence'
import { evaluateTag, isBlocked } from '../../engine/evaluate'
import { isTagAuthorized, tagDisplayName } from '../../engine/includeExclude'
import { walkTagRefs } from '../../engine/availability'
import {
  currentTagEvalStatus,
  latestEncounter,
  patientById,
  showsCurrentNotSatisfy,
  tagById,
} from '../../store/selectors'
import { PhoneNote, StatusText } from '../../ui/PageHeader'
import {
  Button,
  Dd,
  DescriptionList,
  Dt,
  EmptyHint,
  FormField,
  FormStack,
  FullSelect,
  Muted,
  Notice,
  PageStack,
  Panel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/kit'
import { Input } from '@/components/ui/input'
import { NativeSelectOption } from '@/components/ui/native-select'

const REMOVE_REASONS: Array<{ code: RemoveReasonCode; label: string }> = [
  { code: 'not_satisfy', label: '当前已不满足' },
  { code: 'not_for_this_operation', label: '不应纳入本次运营人群' },
  { code: 'other', label: '其他' },
]

export function PatientEvidencePanel({
  state,
  patientId,
  hit,
  sourceTag,
  showNotSatisfy,
  reviewable,
  onRemove,
  hideReviewActions,
  sourceLabel,
}: {
  state: AppState
  patientId: string
  hit?: Hit
  sourceTag?: Tag
  showNotSatisfy: boolean
  reviewable: boolean
  onRemove?: (reason: RemoveReasonCode, note?: string) => void
  hideReviewActions?: boolean
  sourceLabel?: ReactNode
}) {
  const patient = patientById(state, patientId)
  const encounter = latestEncounter(state, patientId)
  const currentScore = latestEyeScoreSlot(state, patientId, state.clock)
  const triggerScore = hit?.slots.find((slot) => slot.role === 'latest_eye_score')
  const status = sourceTag ? currentTagEvalStatus(state, sourceTag, patientId) : undefined
  const [reasonCode, setReasonCode] = useState<RemoveReasonCode>('not_for_this_operation')
  const [note, setNote] = useState('')
  const [expanded, setExpanded] = useState(false)
  const authorizedOthers = otherAuthorizedHits(state, patientId, sourceTag?.id)

  if (!patient) {
    return <p>未找到患者 {patientId}。</p>
  }

  const timeline = buildTimeline(hit?.slots ?? [], currentScore)

  return (
    <PageStack data-testid="patient-evidence">
      {sourceLabel}
      <Panel title="身份与就诊">
        <DescriptionList>
          <Dt>姓名</Dt>
          <Dd>{patient.name}</Dd>
          <Dt>主患者标识</Dt>
          <Dd>{patient.id}</Dd>
          <Dt>性别</Dt>
          <Dd>{patient.sex}</Dd>
          <Dt>年龄</Dt>
          <Dd>{patient.age}</Dd>
          <Dt>就诊标识</Dt>
          <Dd>{encounter?.id ?? '—'}</Dd>
          <Dt>就诊科室</Dt>
          <Dd>{encounter?.department ?? '—'}</Dd>
          <Dt>联系电话</Dt>
          <Dd>{patient.phone ?? '空'}</Dd>
        </DescriptionList>
        <PhoneNote />
      </Panel>

      {showNotSatisfy && status && showsCurrentNotSatisfy(status) ? (
        <Notice tone="warn" role="status" data-testid="current-not-satisfy">
          当前已不满足。仅作提示，不自动移除，也不阻止确认。触发时证据仍保留。
        </Notice>
      ) : null}
      {showNotSatisfy ? (
        <Muted>未提示「当前已不满足」不表示已验证仍满足。失败或无法判断不会提示为不满足。</Muted>
      ) : null}

      {sourceTag ? (
        <Panel title="来源条件">
          <p>{sourceTag.status === 'deleted' ? `${sourceTag.name}（已删除标签）` : sourceTag.name}</p>
          <Muted className="mt-1">稳定标识 {sourceTag.id}</Muted>
        </Panel>
      ) : null}

      <Panel title="触发时证据">
        {triggerScore ? (
          <p>
            触发时眼表评分 <strong data-testid="trigger-score">{String(triggerScore.value)}</strong>
            <span className="text-muted-foreground text-xs"> · 业务时间 {formatDateTime(triggerScore.businessTime)}</span>
          </p>
        ) : null}
        {currentScore ? (
          <p>
            当前眼表评分 <strong data-testid="current-score">{String(currentScore.value)}</strong>
            <span className="text-muted-foreground text-xs"> · 业务时间 {formatDateTime(currentScore.businessTime)}</span>
          </p>
        ) : (
          <Muted>当前无可用眼表评分。</Muted>
        )}
        {hit?.slots.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {hit.slots.map((slot) => (
              <li key={`${slot.role}-${slot.observationId ?? slot.encounterId ?? slot.metricId}`}>
                {slot.role}：{String(slot.value)} · {formatDateTime(slot.businessTime)}
                {slot.observationId ? ` · ${slot.observationId}` : ''}
                {slot.encounterId ? ` · ${slot.encounterId}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <Muted>无保存的触发时证据槽位。</Muted>
        )}
      </Panel>

      <Panel title="证据时间轴" description="按业务时间，不展示全量病历。">
        {timeline.length === 0 ? (
          <EmptyHint>无相关证据。</EmptyHint>
        ) : (
          <ol className="relative ml-2 space-y-3 border-l pl-4">
            {timeline.map((item) => (
              <li key={item.key} className="text-sm">
                <span className="bg-primary absolute -left-[5px] mt-1.5 size-2.5 rounded-full" />
                {formatDateTime(item.businessTime)} · {item.label}：{String(item.value)}
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {sourceTag?.type === 'composite' ? (
        <Panel title="复合证据">
          <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((value) => !value)}>
            {expanded ? '收起基础逻辑贡献' : '展开基础逻辑贡献'}
          </Button>
          {expanded ? (
            <ul className="mt-3 space-y-1 text-sm" data-testid="composite-contributions">
              {referencedBasicTags(state, sourceTag).map((basic) => {
                const result = evaluateTag(state, basic, hit?.computedAt ?? state.clock, patientId)
                const authorized = isTagAuthorized(state, basic.id)
                return (
                  <li key={basic.id}>
                    {basic.name}：{isBlocked(result) ? result.reason : result}
                    {authorized ? null : <span className="text-muted-foreground">（未授权，不能跳转独立命中清单）</span>}
                  </li>
                )
              })}
            </ul>
          ) : null}
          <Muted className="mt-2">复合授权不沿引用扩大白名单，此处不提供基础标签命中清单入口。</Muted>
        </Panel>
      ) : null}

      <Panel title="其他获授权标签">
        {authorizedOthers.length === 0 ? (
          <EmptyHint>无其他获授权且当前命中的标签。</EmptyHint>
        ) : (
          <ul className="space-y-1 text-sm">
            {authorizedOthers.map((tag) => (
              <li key={tag.id}>{tag.name}</li>
            ))}
          </ul>
        )}
      </Panel>

      {reviewable && !hideReviewActions && onRemove ? (
        <Panel title="复核">
          <FormStack>
            <FormField label="移除原因">
              <FullSelect value={reasonCode} onChange={(event) => setReasonCode(event.target.value as RemoveReasonCode)}>
                {REMOVE_REASONS.map((item) => (
                  <NativeSelectOption key={item.code} value={item.code}>
                    {item.label}
                  </NativeSelectOption>
                ))}
              </FullSelect>
            </FormField>
            {reasonCode === 'other' ? (
              <FormField label="说明">
                <Input value={note} onChange={(event) => setNote(event.target.value)} />
              </FormField>
            ) : null}
            <Button type="button" variant="destructive" data-testid="remove-patient" onClick={() => onRemove(reasonCode, note)}>
              移除该患者
            </Button>
          </FormStack>
          <Muted className="mt-2">不能添加患者。原始命中说明保留。</Muted>
        </Panel>
      ) : null}
    </PageStack>
  )
}

export function MemberTable({
  state,
  patientIds,
  selectedId,
  onSelect,
  removedIds,
  trailing,
}: {
  state: AppState
  patientIds: string[]
  selectedId?: string
  onSelect: (patientId: string) => void
  removedIds?: string[]
  trailing?: (patientId: string) => ReactNode
}) {
  const removed = new Set(removedIds ?? [])
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>患者</TableHead>
          <TableHead>标识</TableHead>
          <TableHead>性别</TableHead>
          <TableHead>年龄</TableHead>
          <TableHead>状态</TableHead>
          {trailing ? <TableHead></TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {patientIds.map((patientId) => {
          const patient = patientById(state, patientId)
          return (
            <TableRow
              key={patientId}
              data-state={selectedId === patientId ? 'selected' : undefined}
              className="member-row"
              data-testid={`member-${patientId}`}
            >
              <TableCell>
                <Button type="button" variant="link" className="h-auto px-0" onClick={() => onSelect(patientId)}>
                  {patient?.name ?? patientId}
                </Button>
              </TableCell>
              <TableCell>{patientId}</TableCell>
              <TableCell>{patient?.sex ?? '—'}</TableCell>
              <TableCell>{patient?.age ?? '—'}</TableCell>
              <TableCell>
                {removed.has(patientId) ? <StatusText>已移除</StatusText> : <StatusText>保留</StatusText>}
              </TableCell>
              {trailing ? <TableCell>{trailing(patientId)}</TableCell> : null}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function buildTimeline(slots: EvidenceSlot[], current?: EvidenceSlot) {
  const items = [
    ...slots.map((slot) => ({
      key: `hit-${slot.role}-${slot.businessTime}-${slot.observationId ?? ''}`,
      businessTime: slot.businessTime,
      label: `触发 ${slot.role}`,
      value: slot.value,
    })),
  ]
  if (current) {
    items.push({
      key: `current-${current.businessTime}-${current.observationId ?? ''}`,
      businessTime: current.businessTime,
      label: '当前眼表评分',
      value: current.value,
    })
  }
  return items.sort((a, b) => (a.businessTime < b.businessTime ? -1 : 1))
}

function referencedBasicTags(state: AppState, tag: Tag): Tag[] {
  const ids = new Set<string>()
  walkTagRefs(tag.logic, ids)
  return [...ids]
    .map((id) => tagById(state, id))
    .filter((item): item is Tag => Boolean(item))
}

function otherAuthorizedHits(state: AppState, patientId: string, excludeTagId?: string): Tag[] {
  return state.tags.filter((tag) => {
    if (tag.id === excludeTagId) return false
    if (tag.status !== 'published') return false
    if (!isTagAuthorized(state, tag.id)) return false
    const result = evaluateTag(state, tag, state.clock, patientId)
    return result === 'satisfy'
  })
}

export function cohortConditionText(state: AppState, includeTagIds: string[], excludeTagIds: string[]): string {
  const include = includeTagIds.map((id) => tagDisplayName(state, id)).join(' 且 ') || '无'
  const exclude = excludeTagIds.map((id) => tagDisplayName(state, id)).join('、')
  return exclude ? `纳入 ${include}；排除命中任一 ${exclude}` : `纳入 ${include}`
}

export function PatientLink({
  patientId,
  name,
  from,
}: {
  patientId: string
  name: string
  from: string
}) {
  return <Link to={`/patients/${encodeURIComponent(patientId)}?from=${encodeURIComponent(from)}`}>{name}</Link>
}