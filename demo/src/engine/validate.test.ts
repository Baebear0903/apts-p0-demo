import { describe, expect, it } from 'vitest'
import { createInitialState } from '../data/seed'
import type { Metric, RecordGroupNode } from '../domain/types'
import { createCondition, createRecordGroup } from './logicTree'
import { validateLogic, validateMetricDraft } from './validate'

function derivedMetric(partial: Partial<NonNullable<Metric['derived']>>): Metric {
  const state = createInitialState()
  return {
    ...state.metrics[0]!,
    id: 'MET-TEST-DERIVED',
    name: '校验样例',
    kind: 'derived',
    binding: undefined,
    grain: '患者',
    valueType: 'number',
    applicableJudgments: ['direct_compare'],
    derived: {
      function: 'arithmetic',
      inputMetricIds: state.metrics.slice(0, 2).map((item) => item.id),
      formula: '$0 + $1',
      ...partial,
    },
  }
}

describe('配置严格校验', () => {
  it('拒绝缺少关联方式、日期差单位和窗口观察粒度的衍生指标', () => {
    const state = createInitialState()
    expect(validateMetricDraft(derivedMetric({}), state)).toContain('算术衍生须声明多输入取值与关联方式')

    const datetimes = state.metrics.filter((item) => item.valueType === 'datetime').slice(0, 2)
    const dateDiff = derivedMetric({
      function: 'date_diff',
      inputMetricIds: datetimes.map((item) => item.id),
      dateStartMetricId: datetimes[0]?.id,
      dateEndMetricId: datetimes[1]?.id,
      formula: undefined,
      association: 'same_patient_latest',
    })
    expect(validateMetricDraft(dateDiff, state)).toContain('日期差须指定结果单位')

    const windowMetric = derivedMetric({
      function: 'avg',
      inputMetricIds: [state.metrics.find((item) => item.valueType === 'number')!.id],
      formula: undefined,
      windowDays: 30,
      association: undefined,
    })
    expect(validateMetricDraft(windowMetric, state)).toContain('窗口统计须指定观察粒度')
  })

  it('拒绝记录条件组非法的 N 和窗口', () => {
    const state = createInitialState()
    const metric = state.metrics.find((item) => item.applicableJudgments.includes('latest'))!
    const group = createRecordGroup()
    const invalid: RecordGroupNode = {
      ...group,
      children: [createCondition(metric)],
      outer: {
        type: 'recent_n',
        n: 0,
        window: { kind: 'fixed', start: '2026-09-02T00:00:00+08:00', end: '2026-09-01T00:00:00+08:00' },
        op: 'gte',
        value: 1,
      },
    }
    const errors = validateLogic(state, invalid, 'basic')
    expect(errors).toContain('记录条件组的 N 须为正整数')
    expect(errors).toContain('记录条件组的固定窗口起点不得晚于终点')
  })
})
