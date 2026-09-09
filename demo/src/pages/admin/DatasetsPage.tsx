import { useMemo, useState } from 'react'
import { formatDateTime } from '../../demo/clock'
import { DS_ENCOUNTER_ID, DS_EYE_ASSESSMENT_ID, DS_PATIENT_ID } from '../../domain/ids'
import type { Dataset } from '../../domain/types'
import { useDemoStore } from '../../store/DemoStoreContext'
import { PageHeader, PhoneNote } from '../../ui/PageHeader'

export function DatasetsPage() {
  const { state } = useDemoStore()
  const [selectedId, setSelectedId] = useState(state.datasets[0]?.id ?? '')
  const dataset = state.datasets.find((item) => item.id === selectedId) ?? state.datasets[0]

  return (
    <section>
      <PageHeader
        title="数据集"
        description="后台导入的预置数据对象，只供查看和选择，不提供新增、修改、删除或停用。"
      />
      <div className="tabs" role="tablist" aria-label="预置数据集">
        {state.datasets.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === dataset?.id}
            className={item.id === dataset?.id ? 'tab is-active' : 'tab'}
            onClick={() => setSelectedId(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      {dataset ? <DatasetPanel dataset={dataset} /> : <p>无预置数据集。</p>}
    </section>
  )
}

function DatasetPanel({ dataset }: { dataset: Dataset }) {
  const { state } = useDemoStore()
  const samples = useMemo(() => {
    if (dataset.id === DS_PATIENT_ID) {
      return {
        columns: ['patient_id', 'name', 'age', 'sex', 'phone'],
        rows: state.patients.map((patient) => [
          patient.id,
          patient.name,
          String(patient.age),
          patient.sex,
          patient.phone ?? '',
        ]),
      }
    }
    if (dataset.id === DS_ENCOUNTER_ID) {
      return {
        columns: ['patient_id', 'encounter_id', 'department', 'visit_time', 'diagnosis'],
        rows: state.encounters.map((encounter) => [
          encounter.patientId,
          encounter.id,
          encounter.department,
          formatDateTime(encounter.visitTime),
          encounter.diagnosis,
        ]),
      }
    }
    if (dataset.id === DS_EYE_ASSESSMENT_ID) {
      return {
        columns: ['patient_id', 'encounter_id', 'observation_id', 'observed_at', 'score', 'symptom'],
        rows: state.observations.map((obs) => [
          obs.patientId,
          obs.encounterId ?? '',
          obs.observationId,
          formatDateTime(obs.observedAt),
          obs.score === null ? '' : String(obs.score),
          obs.symptom === null ? '' : obs.symptom ? '是' : '否',
        ]),
      }
    }
    return { columns: [] as string[], rows: [] as string[][] }
  }, [dataset.id, state])

  return (
    <div className="stack">
      <div className="panel">
        <dl className="dl">
          <dt>名称</dt>
          <dd>{dataset.name}</dd>
          <dt>来源</dt>
          <dd>{dataset.source}</dd>
          <dt>表名</dt>
          <dd>{dataset.tableName}</dd>
          <dt>粒度</dt>
          <dd>{dataset.grain}</dd>
          <dt>患者关联</dt>
          <dd>{dataset.associations.patient}</dd>
          <dt>就诊关联</dt>
          <dd>{dataset.associations.encounter ?? '无'}</dd>
          <dt>记录关联</dt>
          <dd>{dataset.associations.record}</dd>
          <dt>时间关联</dt>
          <dd>{dataset.associations.time ?? '无（患者主数据）'}</dd>
        </dl>
      </div>
      <div className="panel">
        <h3>字段</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>字段</th>
                <th>名称</th>
                <th>类型</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {dataset.fields.map((field) => (
                <tr key={field.name}>
                  <td>{field.name}</td>
                  <td>{field.label}</td>
                  <td>{field.valueType}</td>
                  <td>{field.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel">
        <h3>样例</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {samples.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {samples.rows.map((row, index) => (
                <tr key={`${dataset.id}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${dataset.id}-${index}-${cellIndex}`}>{cell === '' ? '空' : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dataset.id === DS_PATIENT_ID ? <PhoneNote /> : null}
        {dataset.id === DS_EYE_ASSESSMENT_ID ? (
          <p className="phone-note">symptom 属于 ts_eye_assessment，与 observation_id 关联。</p>
        ) : null}
      </div>
    </div>
  )
}
