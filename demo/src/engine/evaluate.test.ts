import { describe, expect, it } from 'vitest'
import { createRuleSamples } from '../data/ruleSamples'
import { createInitialState } from '../data/seed'
import { shanghaiIso } from '../demo/clock'
import {
  BATCH_INITIAL_ID,
  DEMO_OPERATOR_ID,
  MET_DEPT_ID,
  MET_EYE_SCORE_ID,
  MET_SYMPTOM_ID,
  ORG_INFO_ID,
  TAG_EYE_HIGH_ID,
  TAG_EYE_OP_ID,
} from '../domain/ids'
import { summarizeLogic } from '../domain/logicSummary'
import type { AppState, ConditionNode, Metric, RuleLogic, Tag } from '../domain/types'
import { hitsOfBatch } from '../store/selectors'
import {
  disableMetric,
  disableTag,
  loadRuleSamples,
  restoreMetric,
  restoreTag,
  setClock,
  setSimulateFailure,
  updateRuleSampleWorkingCopy,
  upsertTag,
} from '../store/store'
import { evaluateArithmetic, metricValue } from './derived'
import { evaluateNode, evaluateTag, isBlocked, trialCompute } from './evaluate'
import { buildEvalContext } from './types'

function baseTag(id: string, logic: RuleLogic, extra?: Partial<Tag>): Tag {
  return {
    id,
    name: id,
    type: 'basic',
    category: '评估结果',
    status: 'published',
    responsibleOrgId: ORG_INFO_ID,
    autoRecognitionEnabled: false,
    logic,
    createdBy: DEMO_OPERATOR_ID,
    createdAt: shanghaiIso('2026-09-01', '09:00:00'),
    updatedBy: DEMO_OPERATOR_ID,
    updatedAt: shanghaiIso('2026-09-01', '09:00:00'),
    ...extra,
  }
}

function scoreCondition(judgment: ConditionNode['judgment']): ConditionNode {
  return { kind: 'condition', id: 'cond-score', metricId: MET_EYE_SCORE_ID, judgment }
}

function sampleState(computeAt: string): AppState {
  return setClock(loadRuleSamples(createInitialState()), computeAt)
}

function evalPatient(state: AppState, logic: RuleLogic, patientId: string) {
  const tag = baseTag('TAG-CASE', logic)
  const withTag = upsertTag(state, tag)
  return evaluateTag(withTag, tag, withTag.clock, patientId)
}

describe('7.2 规则样例', () => {
  it('最近 N 次：命中、改 7 不命中、N=4 不足次数', () => {
    const computeAt = shanghaiIso('2026-09-05', '11:00:00')
    const logic = scoreCondition({
      type: 'recent_n',
      window: { kind: 'relative_days', days: 90 },
      n: 3,
      op: 'gte',
      value: 10,
    })
    const state = sampleState(computeAt)
    expect(evalPatient(state, logic, 'RULE-NLAST')).toBe('satisfy')

    const changed = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      observations: partition.observations.map((item) =>
        item.observationId === 'O-RULE-NLAST-20260903-1' ? { ...item, score: 7 } : item,
      ),
    }))
    expect(evalPatient(changed, logic, 'RULE-NLAST')).toBe('not_satisfy')

    const n4 = scoreCondition({
      type: 'recent_n',
      window: { kind: 'relative_days', days: 90 },
      n: 4,
      op: 'gte',
      value: 10,
    })
    expect(evalPatient(state, n4, 'RULE-NLAST')).toBe('not_satisfy')

    const count3 = scoreCondition({
      type: 'count',
      window: { kind: 'relative_days', days: 90 },
      op: 'eq',
      value: 3,
    })
    const count4 = scoreCondition({
      type: 'count',
      window: { kind: 'relative_days', days: 90 },
      op: 'eq',
      value: 4,
    })
    expect(evalPatient(state, count3, 'RULE-NLAST')).toBe('satisfy')
    expect(evalPatient(state, count4, 'RULE-NLAST')).toBe('not_satisfy')
  })

  it('连续日期：存在一次命中；全部有效观察不命中；缺日两种均不命中', () => {
    const computeAt = shanghaiIso('2026-09-04', '11:00:00')
    const window = { kind: 'fixed' as const, start: '2026-09-01T00:00:00+08:00', end: '2026-09-03T23:59:59+08:00' }
    const anyLogic = scoreCondition({
      type: 'consecutive_dates',
      window,
      n: 3,
      daily: 'any_satisfy',
      op: 'gte',
      value: 10,
    })
    const allLogic = scoreCondition({
      type: 'consecutive_dates',
      window,
      n: 3,
      daily: 'all_valid_satisfy',
      op: 'gte',
      value: 10,
    })
    const state = sampleState(computeAt)
    expect(evalPatient(state, anyLogic, 'RULE-CONSEC')).toBe('satisfy')
    expect(evalPatient(state, allLogic, 'RULE-CONSEC')).toBe('not_satisfy')

    const removed = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      observations: partition.observations.filter((item) => !item.observationId.startsWith('O-RULE-CONSEC-20260902')),
    }))
    expect(evalPatient(removed, anyLogic, 'RULE-CONSEC')).toBe('not_satisfy')
    expect(evalPatient(removed, allLogic, 'RULE-CONSEC')).toBe('not_satisfy')

    const unjudgeable = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      observations: partition.observations.map((item) =>
        item.observationId.startsWith('O-RULE-CONSEC-20260902')
          ? { ...item, unjudgeable: true, score: null }
          : item,
      ),
    }))
    expect(evalPatient(unjudgeable, anyLogic, 'RULE-CONSEC')).toBe('not_satisfy')
    expect(evalPatient(unjudgeable, allLogic, 'RULE-CONSEC')).toBe('not_satisfy')
  })

  it('首次异常：9 月窗口含 7 月史不命中，去掉 7 月后命中', () => {
    const computeAt = shanghaiIso('2026-09-07', '11:00:00')
    const logic = scoreCondition({
      type: 'first_abnormal',
      window: { kind: 'fixed', start: '2026-09-01T00:00:00+08:00', end: '2026-09-07T23:59:59+08:00' },
      op: 'gte',
      value: 10,
    })
    const state = sampleState(computeAt)
    expect(evalPatient(state, logic, 'RULE-FIRST')).toBe('not_satisfy')

    const removed = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      observations: partition.observations.filter((item) => item.observationId !== 'O-RULE-FIRST-20260701-1'),
    }))
    expect(evalPatient(removed, logic, 'RULE-FIRST')).toBe('satisfy')
  })

  it('较前变化：绝对 +5、变化率 50%；前次为 0 则变化率 unknown', () => {
    const computeAt = shanghaiIso('2026-09-02', '09:01:00')
    const abs = scoreCondition({ type: 'change', mode: 'absolute', op: 'eq', value: 5 })
    const rate = scoreCondition({ type: 'change', mode: 'rate', op: 'eq', value: 50 })
    const state = sampleState(computeAt)
    expect(evalPatient(state, abs, 'RULE-CHANGE')).toBe('satisfy')
    expect(evalPatient(state, rate, 'RULE-CHANGE')).toBe('satisfy')

    const zeroPrev = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      observations: partition.observations.map((item) =>
        item.observationId === 'O-RULE-CHANGE-20260901-1' ? { ...item, score: 0 } : item,
      ),
    }))
    expect(evalPatient(zeroPrev, scoreCondition({ type: 'change', mode: 'absolute', op: 'eq', value: 15 }), 'RULE-CHANGE')).toBe(
      'satisfy',
    )
    expect(evalPatient(zeroPrev, rate, 'RULE-CHANGE')).toBe('unknown')
  })

  it('观察组合：跨次不能拼接；同次均满足才命中', () => {
    const computeAt = shanghaiIso('2026-09-03', '11:00:00')
    const logic: RuleLogic = {
      kind: 'record_group',
      id: 'rg-combo',
      grain: '采集',
      operator: 'and',
      children: [
        {
          kind: 'condition',
          id: 'c-score',
          metricId: MET_EYE_SCORE_ID,
          judgment: { type: 'latest', window: { kind: 'relative_days', days: 90 }, op: 'gte', value: 10 },
        },
        {
          kind: 'condition',
          id: 'c-symptom',
          metricId: MET_SYMPTOM_ID,
          judgment: { type: 'latest', window: { kind: 'relative_days', days: 90 }, op: 'eq', value: true },
        },
      ],
      outer: { type: 'exists', window: { kind: 'relative_days', days: 90 } },
    }
    const state = sampleState(computeAt)
    expect(evalPatient(state, logic, 'RULE-COMBO')).toBe('not_satisfy')

    const changed = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      observations: partition.observations.map((item) =>
        item.observationId === 'O-RULE-COMBO-B-1' ? { ...item, score: 12 } : item,
      ),
    }))
    expect(evalPatient(changed, logic, 'RULE-COMBO')).toBe('satisfy')
  })

  it('事件窗口：首次／任一次命中，最近一次不命中；无锚点不命中', () => {
    const computeAt = shanghaiIso('2026-09-07', '11:00:00')
    const eventWindow = (occurrence: 'first' | 'latest' | 'any') =>
      scoreCondition({
        type: 'latest',
        window: {
          kind: 'event',
          eventType: '出院',
          occurrence,
          offsetBeforeDays: 0,
          offsetAfterDays: 30,
        },
        op: 'gte',
        value: 10,
      })
    const state = sampleState(computeAt)
    expect(evalPatient(state, eventWindow('first'), 'RULE-EVENT')).toBe('satisfy')
    expect(evalPatient(state, eventWindow('any'), 'RULE-EVENT')).toBe('satisfy')
    expect(evalPatient(state, eventWindow('latest'), 'RULE-EVENT')).toBe('not_satisfy')

    const noEvent = updateRuleSampleWorkingCopy(state, (partition) => ({ ...partition, events: [] }))
    expect(evalPatient(noEvent, eventWindow('first'), 'RULE-EVENT')).toBe('not_satisfy')
    expect(evalPatient(noEvent, eventWindow('any'), 'RULE-EVENT')).toBe('not_satisfy')
    expect(evalPatient(noEvent, eventWindow('latest'), 'RULE-EVENT')).toBe('not_satisfy')
  })

  it('固定窗口计数 2，删一条则 1；simulateFailure 不等于 0', () => {
    const computeAt = shanghaiIso('2026-09-08', '11:00:00')
    const countEq = (value: number): RuleLogic =>
      scoreCondition({
        type: 'count',
        window: { kind: 'fixed', start: '2026-09-01T00:00:00+08:00', end: '2026-09-07T23:59:59+08:00' },
        op: 'eq',
        value,
      })
    const state = sampleState(computeAt)
    expect(evalPatient(state, countEq(2), 'RULE-WINDOW')).toBe('satisfy')

    const deleted = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      observations: partition.observations.filter((item) => item.observationId !== 'O-RULE-WINDOW-20260907-1'),
    }))
    expect(evalPatient(deleted, countEq(2), 'RULE-WINDOW')).toBe('not_satisfy')
    expect(evalPatient(deleted, countEq(1), 'RULE-WINDOW')).toBe('satisfy')

    const failed = setSimulateFailure(state, true)
    const tag = baseTag('TAG-WINDOW-COUNT', countEq(0))
    const withTag = upsertTag(failed, tag)
    const trial = trialCompute(withTag, tag.id)
    expect('unavailableReason' in trial).toBe(true)
    if ('unavailableReason' in trial) {
      expect(trial.unavailableReason).toMatch(/失败/)
    }
    expect('hitPatientIds' in trial).toBe(false)
    const node = evaluateNode(buildEvalContext(withTag), 'RULE-WINDOW', countEq(0))
    expect(isBlocked(node)).toBe(true)
  })
})

describe('连续日期 vs 最近 N 次', () => {
  it('缺日打断连续日期，但最近 N 次跳过无法判断观察', () => {
    const computeAt = shanghaiIso('2026-09-05', '11:00:00')
    const state = sampleState(computeAt)
    const recent = scoreCondition({
      type: 'recent_n',
      window: { kind: 'relative_days', days: 90 },
      n: 3,
      op: 'gte',
      value: 10,
    })
    const consecutive = scoreCondition({
      type: 'consecutive_dates',
      window: { kind: 'relative_days', days: 90 },
      n: 3,
      daily: 'any_satisfy',
      op: 'gte',
      value: 10,
    })
    expect(evalPatient(state, recent, 'RULE-NLAST')).toBe('satisfy')
    expect(evalPatient(state, consecutive, 'RULE-NLAST')).toBe('not_satisfy')
  })
})

describe('主故事试算', () => {
  it('11:00 试算 5 人且样例不含李强；阈值 13 为 3 人；旧批次仍 6 且李强槽 18', () => {
    const state = createInitialState()
    expect(state.clock).toBe('2026-09-07T11:00:00+08:00')
    const beforeLogic = structuredClone(state.batches[0]?.ruleExplanation.expandedLogic)
    const initialHits = hitsOfBatch(state, BATCH_INITIAL_ID)
    expect(initialHits).toHaveLength(6)

    const trial = trialCompute(state, TAG_EYE_OP_ID)
    expect('hitPatientIds' in trial).toBe(true)
    if (!('hitPatientIds' in trial)) return
    expect(trial.hitPatientIds).toHaveLength(5)
    expect(trial.hitPatientIds).not.toContain('P-DEMO-002')
    expect(trial.samples.map((item) => item.maskedName)).not.toContain('李*')
    expect(trial.samples.some((item) => item.maskedName === '张*')).toBe(true)

    const high = state.tags.find((item) => item.id === TAG_EYE_HIGH_ID)
    expect(high?.logic.kind).toBe('condition')
    if (high?.logic.kind !== 'condition') return
    expect(high.logic.judgment.type).toBe('latest')
    if (high.logic.judgment.type !== 'latest') return
    const raised: Tag = {
      ...high,
      logic: {
        ...high.logic,
        judgment: { ...high.logic.judgment, value: 13 },
      },
    }
    const updated = upsertTag(state, raised)
    const trial13 = trialCompute(updated, TAG_EYE_OP_ID)
    expect('hitPatientIds' in trial13).toBe(true)
    if (!('hitPatientIds' in trial13)) return
    expect(trial13.hitPatientIds.sort()).toEqual(['P-DEMO-001', 'P-DEMO-003', 'P-DEMO-006'])
    expect(hitsOfBatch(updated, BATCH_INITIAL_ID)).toHaveLength(6)
    const li = hitsOfBatch(updated, BATCH_INITIAL_ID).find((item) => item.patientId === 'P-DEMO-002')
    expect(li?.slots.find((slot) => slot.role === 'latest_eye_score')?.value).toBe(18)
    expect(updated.batches[0]?.ruleExplanation.expandedLogic).toEqual(beforeLogic)

    const restored = upsertTag(updated, high)
    const trial10 = trialCompute(restored, TAG_EYE_OP_ID)
    expect('hitPatientIds' in trial10).toBe(true)
    if ('hitPatientIds' in trial10) expect(trial10.hitPatientIds).toHaveLength(5)
  })

  it('最新值 18→7 且阈值 ≥10 不命中，不能先筛异常', () => {
    const state = createInitialState()
    const high = state.tags.find((item) => item.id === TAG_EYE_HIGH_ID)
    expect(high).toBeDefined()
    if (!high) return
    expect(evaluateTag(state, high, state.clock, 'P-DEMO-002')).toBe('not_satisfy')
  })

  it('停用基础标签或指标后复合试算不可用，不是 0 人；恢复依赖后自动恢复；人工停用保持', () => {
    const state = createInitialState()
    const disabledBasic = disableTag(state, TAG_EYE_HIGH_ID)
    const trial = trialCompute(disabledBasic, TAG_EYE_OP_ID)
    expect('unavailableReason' in trial).toBe(true)
    if ('unavailableReason' in trial) {
      expect(trial.unavailableReason).toMatch(/眼表评分偏高/)
      expect(trial.unavailableReason).not.toMatch(/^0/)
    }
    expect('hitPatientIds' in trial).toBe(false)

    const restoredBasic = restoreTag(disabledBasic, TAG_EYE_HIGH_ID)
    const ok = trialCompute(restoredBasic, TAG_EYE_OP_ID)
    expect('hitPatientIds' in ok).toBe(true)
    if ('hitPatientIds' in ok) expect(ok.hitPatientIds).toHaveLength(5)

    const disabledMetric = disableMetric(state, MET_EYE_SCORE_ID)
    const trialMetric = trialCompute(disabledMetric, TAG_EYE_OP_ID)
    expect('unavailableReason' in trialMetric).toBe(true)
    if ('unavailableReason' in trialMetric) expect(trialMetric.unavailableReason).toMatch(/眼表评分/)

    const restoredMetric = restoreMetric(disabledMetric, MET_EYE_SCORE_ID)
    const okMetric = trialCompute(restoredMetric, TAG_EYE_OP_ID)
    expect('hitPatientIds' in okMetric && okMetric.hitPatientIds).toHaveLength(5)

    const manual = disableTag(state, TAG_EYE_OP_ID)
    const stillManual = restoreMetric(manual, MET_EYE_SCORE_ID)
    const blockedTrial = trialCompute(stillManual, TAG_EYE_OP_ID)
    expect('unavailableReason' in blockedTrial).toBe(true)
    if ('unavailableReason' in blockedTrial) expect(blockedTrial.unavailableReason).toMatch(/人工停用/)
  })

  it('科室不能用 ≥，空值无法判断', () => {
    const state = createInitialState()
    const logic: RuleLogic = {
      kind: 'condition',
      id: 'dept-gte',
      metricId: MET_DEPT_ID,
      judgment: {
        type: 'latest',
        window: { kind: 'relative_days', days: 90 },
        op: 'gte',
        value: '眼科',
      },
    }
    expect(evalPatient(state, logic, 'P-DEMO-001')).toBe('unknown')
  })
})

function measureMetrics(): Metric[] {
  return [
    {
      id: 'MET-WEIGHT',
      name: '体重',
      catalog: '衍生指标',
      kind: 'field_binding',
      status: 'active',
      binding: { datasetId: 'DS-MEASURE', tableName: 'sample_measure', field: 'weight_kg' },
      valueType: 'number',
      unit: 'kg',
      grain: '采集',
      patientKey: 'patient_id',
      observationKey: 'observation_id',
      comparable: true,
      applicableJudgments: ['latest', 'direct_compare'],
      validityNote: '',
      dedupeNote: '',
    },
    {
      id: 'MET-HEIGHT',
      name: '身高',
      catalog: '衍生指标',
      kind: 'field_binding',
      status: 'active',
      binding: { datasetId: 'DS-MEASURE', tableName: 'sample_measure', field: 'height_m' },
      valueType: 'number',
      unit: 'm',
      grain: '采集',
      patientKey: 'patient_id',
      observationKey: 'observation_id',
      comparable: true,
      applicableJudgments: ['latest', 'direct_compare'],
      validityNote: '',
      dedupeNote: '',
    },
    {
      id: 'MET-BMI',
      name: 'BMI',
      catalog: '衍生指标',
      kind: 'derived',
      status: 'active',
      derived: {
        function: 'arithmetic',
        inputMetricIds: ['MET-WEIGHT', 'MET-HEIGHT'],
        formula: '$0 / ($1 * $1)',
        resultUnit: 'kg/m²',
      },
      valueType: 'number',
      unit: 'kg/m²',
      grain: '患者',
      patientKey: 'patient_id',
      comparable: true,
      applicableJudgments: ['direct_compare'],
      validityNote: '',
      dedupeNote: '',
    },
    {
      id: 'MET-DT-START',
      name: '起点',
      catalog: '衍生指标',
      kind: 'field_binding',
      status: 'active',
      binding: { datasetId: 'DS-MEASURE', tableName: 'sample_measure', field: 'datetime_start' },
      valueType: 'datetime',
      grain: '采集',
      patientKey: 'patient_id',
      comparable: true,
      applicableJudgments: ['latest'],
      validityNote: '',
      dedupeNote: '',
    },
    {
      id: 'MET-DT-END',
      name: '终点',
      catalog: '衍生指标',
      kind: 'field_binding',
      status: 'active',
      binding: { datasetId: 'DS-MEASURE', tableName: 'sample_measure', field: 'datetime_end' },
      valueType: 'datetime',
      grain: '采集',
      patientKey: 'patient_id',
      comparable: true,
      applicableJudgments: ['latest'],
      validityNote: '',
      dedupeNote: '',
    },
    {
      id: 'MET-DATE-DIFF',
      name: '日期差',
      catalog: '衍生指标',
      kind: 'derived',
      status: 'active',
      derived: { function: 'date_diff', inputMetricIds: ['MET-DT-START', 'MET-DT-END'], dateDiffUnit: 'days' },
      valueType: 'number',
      grain: '患者',
      patientKey: 'patient_id',
      comparable: true,
      applicableJudgments: ['direct_compare'],
      validityNote: '',
      dedupeNote: '',
    },
    ...(['count', 'sum', 'avg', 'max', 'min'] as const).map((fn) => ({
      id: `MET-STAT-${fn.toUpperCase()}`,
      name: fn,
      catalog: '衍生指标' as const,
      kind: 'derived' as const,
      status: 'active' as const,
      derived: { function: fn, inputMetricIds: [MET_EYE_SCORE_ID], windowDays: 30 },
      valueType: 'number' as const,
      grain: '患者' as const,
      patientKey: 'patient_id',
      comparable: true,
      applicableJudgments: ['direct_compare' as const],
      validityNote: '',
      dedupeNote: '',
    })),
  ]
}

describe('衍生算术／日期差／窗口统计', () => {
  it('BMI 60/(1.5²)=26.67；身高缺失或 0 为 unknown；除 0 为 unknown', () => {
    const state = {
      ...sampleState(shanghaiIso('2026-09-03', '11:00:00')),
      metrics: [...createInitialState().metrics, ...measureMetrics()],
    }
    const bmi = metricValue(state, 'MET-BMI', 'RULE-BMI', state.clock)
    expect(bmi.status).toBe('value')
    if (bmi.status === 'value') expect(bmi.value).toBeCloseTo(26.67, 2)
    expect(evaluateArithmetic('$0 / ($1 * $1)', [60, 1.5])).toBeCloseTo(26.67, 2)

    const noHeight = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      measures: partition.measures.filter((item) => item.id !== 'M-RULE-BMI-H'),
    }))
    expect(metricValue(noHeight, 'MET-BMI', 'RULE-BMI', noHeight.clock).status).toBe('unknown')

    const zeroHeight = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      measures: partition.measures.map((item) => (item.id === 'M-RULE-BMI-H' ? { ...item, value: 0 } : item)),
    }))
    expect(metricValue(zeroHeight, 'MET-BMI', 'RULE-BMI', zeroHeight.clock).status).toBe('unknown')
  })

  it('日期差 2 天，交换为 -2，缺一端 unknown', () => {
    const state = {
      ...sampleState(shanghaiIso('2026-09-03', '11:00:00')),
      metrics: [...createInitialState().metrics, ...measureMetrics()],
    }
    const diff = metricValue(state, 'MET-DATE-DIFF', 'RULE-DATE', state.clock)
    expect(diff.status).toBe('value')
    if (diff.status === 'value') expect(diff.value).toBe(2)

    const swapped: AppState = {
      ...state,
      metrics: state.metrics.map((item) =>
        item.id === 'MET-DATE-DIFF'
          ? { ...item, derived: { function: 'date_diff', inputMetricIds: ['MET-DT-END', 'MET-DT-START'] } }
          : item,
      ),
    }
    const reversed = metricValue(swapped, 'MET-DATE-DIFF', 'RULE-DATE', swapped.clock)
    expect(reversed.status).toBe('value')
    if (reversed.status === 'value') expect(reversed.value).toBe(-2)

    const missing = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      measures: partition.measures.filter((item) => item.measureType !== 'datetime_end'),
    }))
    expect(metricValue(missing, 'MET-DATE-DIFF', 'RULE-DATE', missing.clock).status).toBe('unknown')
  })

  it('窗口统计计数 2、和 30、均值 15、最大 20、最小 10；清空后计数 0 其余 unknown', () => {
    const state = {
      ...sampleState(shanghaiIso('2026-09-03', '11:00:00')),
      metrics: [...createInitialState().metrics, ...measureMetrics()],
    }
    const expectValue = (id: string, value: number) => {
      const result = metricValue(state, id, 'RULE-STAT', state.clock)
      expect(result.status).toBe('value')
      if (result.status === 'value') expect(result.value).toBe(value)
    }
    expectValue('MET-STAT-COUNT', 2)
    expectValue('MET-STAT-SUM', 30)
    expectValue('MET-STAT-AVG', 15)
    expectValue('MET-STAT-MAX', 20)
    expectValue('MET-STAT-MIN', 10)

    const emptied = updateRuleSampleWorkingCopy(state, (partition) => ({
      ...partition,
      observations: partition.observations.filter((item) => item.patientId !== 'RULE-STAT'),
    }))
    const count = metricValue(emptied, 'MET-STAT-COUNT', 'RULE-STAT', emptied.clock)
    expect(count.status).toBe('value')
    if (count.status === 'value') expect(count.value).toBe(0)
    expect(metricValue(emptied, 'MET-STAT-AVG', 'RULE-STAT', emptied.clock).status).toBe('unknown')
    expect(metricValue(emptied, 'MET-STAT-SUM', 'RULE-STAT', emptied.clock).status).toBe('unknown')
    expect(metricValue(emptied, 'MET-STAT-MAX', 'RULE-STAT', emptied.clock).status).toBe('unknown')
    expect(metricValue(emptied, 'MET-STAT-MIN', 'RULE-STAT', emptied.clock).status).toBe('unknown')
  })
})

describe('摘要与保存值一致', () => {
  it('保存后 summarizeLogic 含时间／次数且与控件值一致', () => {
    const state = createInitialState()
    const logic = scoreCondition({
      type: 'recent_n',
      window: { kind: 'relative_days', days: 90 },
      n: 3,
      op: 'gte',
      value: 10,
    })
    const saved = structuredClone(logic)
    const summary = summarizeLogic(state, saved)
    expect(summary).toContain('近 90 天')
    expect(summary).toContain('最近 3 次')
    expect(summary).toContain('≥')
    expect(summary).toContain('10')
    expect(saved).toEqual(logic)
    expect(summarizeLogic(state, logic)).toBe(summary)

    const consecutive = scoreCondition({
      type: 'consecutive_dates',
      window: { kind: 'fixed', start: '2026-09-01T00:00:00+08:00', end: '2026-09-03T23:59:59+08:00' },
      n: 3,
      daily: 'any_satisfy',
      op: 'gte',
      value: 10,
    })
    const consecSummary = summarizeLogic(state, consecutive)
    expect(consecSummary).toContain('连续 3 天')
    expect(consecSummary).toContain('当天存在一次满足')
  })
})

describe('规则样例分区', () => {
  it('样例观察不混入主故事', () => {
    const samples = createRuleSamples()
    const state = createInitialState()
    expect(state.observations.every((item) => !item.patientId.startsWith('RULE-'))).toBe(true)
    expect(samples.patients.every((item) => item.id.startsWith('RULE-'))).toBe(true)
  })
})
