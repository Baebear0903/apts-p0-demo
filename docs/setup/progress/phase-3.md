# 阶段 3 交接记录

实施代理自检提交。主会话负责验收状态；本文不宣布阶段通过。

## 修改范围

工程 `/Users/yangyinglin/AI playground/APTS演示demo/demo`。未修改 SPEC、CONTEXT、分阶段提示词、acceptance.md。

未覆盖 seed 主故事八人事实，也未改写初始批次 `B-20260907-0800` 的 hits 与 `ruleExplanation`。新批次／圈选均经 `evaluateTag` / `computeIncludeExclude` 现算。

覆盖：REC-01..08、COH-01..11、PAT-01..07、WB-02。COH-08 仅入口与预填跳转（`/open/new?type=tag_subscription&cohortId=`），完整订阅留待阶段 4。

## 行为要点

- 识别概览：已开启自动识别标签 + 已停止／已删除历史入口；删除后只读历史标明原因，不计入当前自动识别标签数。无开启标签且无历史批次才空态。
- 批次页：左清单右同屏画像。复核可移除（三档原因）与确认。0 命中不出现待确认。历史批次只读。
- 当前已不满足：仅当前数据+当前规则明确 `not_satisfy` 时提示；`unknown`／失败／不可用不当作不满足。不自动移除、不阻止确认。不改写历史证据。主动圈选路径不出现该提示。
- 确认：剩余 >0 生成快照进入人群列表，本范围本批次立即只读。全移除不生成空快照，只留零人确认记录，工作台待办消失。
- 演示「产生新批次」：当前时钟 + 当前规则跑 `evaluateTag`；`simulateFailure` 时 Toast，不落新批次。
- 动态人群保存条件 + 未经人工移除的完整计算结果；0 人可存。快照须 >0。刷新失败 Toast，不显示 0 人名单。
- 人群计算说明为纳入／排除组合及当时展开逻辑（`includeTags` / `excludeTags` 冻结），不假设唯一来源标签。
- 工作台「识别结果已更新」进入对应标签最新批次。

## 共享接口增量

store：`generateAutoRecognitionBatch` / `removeFromReview` / `confirmRecognitionBatch` / `queryIncludeExclude` / `saveDynamicCohort` / `saveActiveSnapshot` / `refreshDynamicCohort` / `confirmSnapshotFromDynamic` / `adjustSnapshotMembers` / `updateDynamicCohortConditions` / `setAuthorizedTagIds`。

引擎：`computeIncludeExclude` / `evaluateIncludeExclude` / `collectEvidenceSlots` / `snapshotTagLogic` / `buildIncludeExcludeExplanation`。

## 运行与检查命令

```bash
cd "/Users/yangyinglin/AI playground/APTS演示demo/demo"
npm test
npm run build
```

## 结果

| 检查 | 结果 |
|---|---|
| `npm test` | 12 files / 71 tests passed。含 11:00 打开 08:00 批次李强触发 18／当前 7 且仍可确认；移除李强五人快照、保留六人、全移除零保留无空快照无待办；健康活动圈选现算命中后移除李强，动态仍完整结果、快照为移除后名单；改阈值后旧快照冻结纳入／排除展开逻辑；新批次人数等于 `trialCompute`/`evaluateTag` 命中数组且旧 hits 仍 6、李强槽 18；删除排除标签后刷新失败原因为删除／停用而非 0 命中，历史快照仍可读 |
| `npm run build` | `tsc --noEmit` + `vite build` 通过 |

## 未做（阶段 4）

CSV 下载、开放启停到期、已对接系统维护完整表单、订阅现算外发。COH-12 历史快照导出入口未做。COH-08 仅预填跳转。

验收状态由主会话填写 `acceptance.md`。
