import { ORG_EYE_ID, ORG_INFO_ID } from '../domain/ids'
import type { Dictionaries } from '../domain/types'

export function createDictionaries(): Dictionaries {
  return {
    tagCategories: ['基本属性', '就诊特征', '评估结果', '组合筛选'],
    metricCatalogs: ['患者属性', '就诊记录', '眼表评估', '衍生指标'],
    organizations: [
      { id: ORG_INFO_ID, name: '信息管理部门' },
      { id: ORG_EYE_ID, name: '眼科' },
    ],
    consumers: ['眼科随访组', '随访管理组', '健康活动组织组'],
    eventTypes: ['门诊就诊', '出院'],
  }
}
