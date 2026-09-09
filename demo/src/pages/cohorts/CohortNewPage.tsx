import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES, cohortDetailPath } from '../../app/routes'
import { useDemoStore } from '../../store/DemoStoreContext'
import { patientById, publishedSelectableTags } from '../../store/selectors'
import { queryIncludeExclude, saveActiveSnapshot, saveDynamicCohort } from '../../store/store'
import { PageHeader } from '../../ui/PageHeader'
import { Toast } from '../../ui/Modal'
import { includeExcludeAvailability } from '../../engine/includeExclude'

export function CohortNewPage() {
  const { state, patch } = useDemoStore()
  const navigate = useNavigate()
  const published = publishedSelectableTags(state)
  const [name, setName] = useState('健康活动圈选')
  const [includeTagIds, setIncludeTagIds] = useState<string[]>([])
  const [excludeTagIds, setExcludeTagIds] = useState<string[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const [toast, setToast] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null)
  const [query, setQuery] = useState<ReturnType<typeof queryIncludeExclude> | null>(null)

  const conditionsKey = `${includeTagIds.slice().sort().join(',')}|${excludeTagIds.slice().sort().join(',')}`
  const queryMatches =
    query &&
    query.ok &&
    query.ruleExplanation.includeTags?.map((item) => item.tagId).slice().sort().join(',') ===
      includeTagIds.slice().sort().join(',') &&
    (query.ruleExplanation.excludeTags?.map((item) => item.tagId).slice().sort().join(',') ?? '') ===
      excludeTagIds.slice().sort().join(',')

  const availability = includeExcludeAvailability(state, includeTagIds, excludeTagIds)
  const fullIds = query && query.ok && queryMatches ? query.hitPatientIds : []
  const retained = fullIds.filter((id) => !removed.includes(id))
  const canCreate = state.session.permissions.buttons.cohortCreate
  const canSnapshot = state.session.permissions.buttons.cohortSnapshot

  const hint = useMemo(() => {
    if (includeTagIds.length === 0) return '请选择纳入标签后检索'
    if (!availability.ok) return availability.reason
    return null
  }, [availability, includeTagIds.length])

  function toggle(list: string[], id: string, set: (next: string[]) => void) {
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id])
    setQuery(null)
    setRemoved([])
  }

  function search() {
    const result = queryIncludeExclude(state, includeTagIds, excludeTagIds)
    setQuery(result)
    setRemoved([])
    if (!result.ok) setToast({ text: result.reason, tone: 'error' })
    else setToast(null)
  }

  function saveDynamic() {
    const computed = query && query.ok && queryMatches
      ? { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation }
      : undefined
    const result = saveDynamicCohort(state, { name, includeTagIds, excludeTagIds, computed })
    if (!result.ok) {
      setToast({ text: result.reason, tone: 'error' })
      return
    }
    patch(() => result.state)
    navigate(cohortDetailPath(result.cohortId))
  }

  function saveSnapshot() {
    if (!query || !query.ok || !queryMatches) {
      setToast({ text: '请先检索得到有效结果', tone: 'error' })
      return
    }
    const result = saveActiveSnapshot(state, {
      name,
      includeTagIds,
      excludeTagIds,
      retainedPatientIds: retained,
      computed: { hitPatientIds: query.hitPatientIds, computedAt: query.computedAt, ruleExplanation: query.ruleExplanation },
    })
    if (!result.ok) {
      setToast({ text: result.reason, tone: 'error' })
      return
    }
    patch(() => result.state)
    navigate(cohortDetailPath(result.snapshotId))
  }

  return (
    <section>
      <PageHeader title="新建人群" backTo={ROUTES.cohorts} backLabel="返回人群列表" />
      {toast ? <Toast message={toast.text} tone={toast.tone} /> : null}
      <div className="panel">
        <div className="form-stack">
          <label>
            名称
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </div>
        <div className="split" style={{ marginTop: 12 }}>
          <TagPicker
            title="纳入（须同时命中全部）"
            group="include"
            tags={published}
            selected={includeTagIds}
            disabledIds={excludeTagIds}
            onToggle={(id) => toggle(includeTagIds, id, setIncludeTagIds)}
          />
          <TagPicker
            title="排除（命中任一即去掉）"
            group="exclude"
            tags={published}
            selected={excludeTagIds}
            disabledIds={includeTagIds}
            onToggle={(id) => toggle(excludeTagIds, id, setExcludeTagIds)}
          />
        </div>
        <p className="muted">无且／或开关。或关系请先做成复合标签再纳入。主动路径不出现「当前已不满足」。</p>
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn-primary"
            data-testid="cohort-search"
            disabled={!availability.ok}
            onClick={search}
          >
            检索
          </button>
          {hint ? <span className="muted">{hint}</span> : null}
        </div>
      </div>

      {query && !query.ok ? (
        <div className="notice notice-warn" role="status">
          不能检索：{query.reason}。这不是 0 命中。
        </div>
      ) : null}

      {query && query.ok && queryMatches ? (
        <div className="panel">
          <h3>检索结果</h3>
          <p>
            完整计算结果 {fullIds.length} 人；本次待保存名单 {retained.length} 人。
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>患者</th>
                  <th>标识</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {fullIds.map((patientId) => {
                  const patient = patientById(state, patientId)
                  const isRemoved = removed.includes(patientId)
                  return (
                    <tr key={patientId} data-testid={`search-member-${patientId}`}>
                      <td>{patient?.name ?? patientId}</td>
                      <td>{patientId}</td>
                      <td>
                        {isRemoved ? (
                          '已从本次名单移除'
                        ) : (
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => setRemoved((current) => [...current, patientId])}
                          >
                            移除
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <div className="toolbar-actions">
          {canCreate ? (
            <button type="button" className="btn-primary" data-testid="save-dynamic" onClick={saveDynamic}>
              保存动态人群
            </button>
          ) : null}
          <span className="muted">保存条件，不保留本次人工移除</span>
        </div>
        {canSnapshot ? (
          <div className="toolbar-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn-ghost"
              data-testid="save-snapshot"
              disabled={retained.length === 0}
              onClick={saveSnapshot}
            >
              保存快照
            </button>
            {retained.length === 0 ? <span className="muted">0 人不能保存快照</span> : null}
          </div>
        ) : null}
      </div>
      <span hidden>{conditionsKey}</span>
    </section>
  )
}

function TagPicker({
  title,
  group,
  tags,
  selected,
  disabledIds,
  onToggle,
}: {
  title: string
  group: 'include' | 'exclude'
  tags: Array<{ id: string; name: string }>
  selected: string[]
  disabledIds: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <h3>{title}</h3>
      {tags.map((tag) => (
        <label key={tag.id} className="check-row">
          <input
            type="checkbox"
            data-testid={`${group}-${tag.id}`}
            checked={selected.includes(tag.id)}
            disabled={disabledIds.includes(tag.id) && !selected.includes(tag.id)}
            onChange={() => onToggle(tag.id)}
          />
          {tag.name}
        </label>
      ))}
    </div>
  )
}