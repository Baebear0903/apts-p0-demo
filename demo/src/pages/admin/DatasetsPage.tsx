import { useMemo, useState } from 'react'
import { formatDateTime } from '../../demo/clock'
import { DS_ENCOUNTER_ID, DS_EYE_ASSESSMENT_ID, DS_PATIENT_ID } from '../../domain/ids'
import type { Dataset } from '../../domain/types'
import { useDemoStore } from '../../store/DemoStoreContext'
import { PageHeader, PhoneNote } from '@/components/shared/PageHeader'
import { Dd, DescriptionList, Dt, Muted, PageStack, Panel, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/shared/kit'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
      {state.datasets.length > 0 ? (
        <Tabs value={dataset?.id} onValueChange={setSelectedId} className="gap-4">
          <TabsList aria-label="预置数据集">
            {state.datasets.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {state.datasets.map((item) => (
            <TabsContent key={item.id} value={item.id}>
              <DatasetPanel dataset={item} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p>无预置数据集。</p>
      )}
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
    <PageStack>
      <Panel>
        <DescriptionList>
          <Dt>名称</Dt>
          <Dd>{dataset.name}</Dd>
          <Dt>来源</Dt>
          <Dd>{dataset.source}</Dd>
          <Dt>表名</Dt>
          <Dd>{dataset.tableName}</Dd>
          <Dt>粒度</Dt>
          <Dd>{dataset.grain}</Dd>
          <Dt>患者关联</Dt>
          <Dd>{dataset.associations.patient}</Dd>
          <Dt>就诊关联</Dt>
          <Dd>{dataset.associations.encounter ?? '无'}</Dd>
          <Dt>记录关联</Dt>
          <Dd>{dataset.associations.record}</Dd>
          <Dt>时间关联</Dt>
          <Dd>{dataset.associations.time ?? '无（患者主数据）'}</Dd>
        </DescriptionList>
      </Panel>
      <Panel title="字段">
        <Table className="[&_td]:whitespace-normal">
          <TableHeader>
            <TableRow>
              <TableHead>字段</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>说明</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataset.fields.map((field) => (
              <TableRow key={field.name}>
                <TableCell>{field.name}</TableCell>
                <TableCell>{field.label}</TableCell>
                <TableCell>{field.valueType}</TableCell>
                <TableCell>{field.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      <Panel title="样例">
        <Table>
          <TableHeader>
            <TableRow>
              {samples.columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {samples.rows.map((row, index) => (
              <TableRow key={`${dataset.id}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <TableCell key={`${dataset.id}-${index}-${cellIndex}`}>{cell === '' ? '空' : cell}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {dataset.id === DS_PATIENT_ID ? <PhoneNote /> : null}
        {dataset.id === DS_EYE_ASSESSMENT_ID ? (
          <Muted className="mt-2">symptom 属于 ts_eye_assessment，与 observation_id 关联。</Muted>
        ) : null}
      </Panel>
    </PageStack>
  )
}
