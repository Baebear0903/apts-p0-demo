# 阶段 1 交接记录

实施代理自检提交。主会话负责验收状态；本文不宣布阶段通过。

## 修改范围

新增工程 `/Users/yangyinglin/AI playground/APTS演示demo/demo`（Vite + React 18 + TypeScript + React Router）。

未修改 SPEC、CONTEXT、分阶段实施提示词、acceptance.md。

可运行页面：

- 完整：WB-01、WB-05、WB-06、WB-07、ADM-01、ADM-08、ADM-09、ANL-01
- 其余模块：统一布局 + 导航 + 列表／详情返回；未实现操作标明「本页将在后续阶段提供完整操作」，无伪功能按钮

共享数据已进 store：主故事 8 名患者、就诊与观察（含业务时间／入库时间）、3 张只读数据集、6 个指标对象、3 个已发布标签及逻辑树、初始批次 B-20260907-0800 与 6 条命中及触发证据槽位、2 个已对接系统、空的人群／快照／开放配置、演示字典、独立 `ruleSamples` 分区。

## 共享接口

| 路径 | 作用 |
|---|---|
| `src/domain/types.ts` | `AppState` 及标签／批次／命中／证据／指标／人群／开放等类型 |
| `src/domain/ids.ts` | 稳定标识常量 |
| `src/data/seed.ts` | `createInitialState()` |
| `src/data/ruleSamples.ts` | RULE-* 样例分区 |
| `src/demo/clock.ts` | Asia/Shanghai 格式化、`addMinutes`、默认 `2026-09-07 11:00` |
| `src/store/store.ts` | `resetState` / `setClock` / `advanceClock` / `loadRuleSamples` / `unloadRuleSamples` / 权限与模拟失败开关 |
| `src/store/selectors.ts` | `workbenchStats`、`pendingRecognitionBatches`、`hitsOfBatch`、`uniquePatientIds` 等纯函数 |
| `src/store/DemoStoreContext.tsx` | React 会话状态；刷新等同重新 `createInitialState()` |

工作台数字只从上述对象推导，页面不预写人数。规则样例默认不覆盖业务数据；演示控制载入后仅切换会话副本并提示「规则能力样例，不覆盖业务数据」。

## 运行与检查命令

```bash
cd "/Users/yangyinglin/AI playground/APTS演示demo/demo"
npm install
npm test
npm run build
npm run dev
```

本机若 `~/.npm` 权限导致 `npm install` EPERM，可用：

```bash
npm install --cache "/Users/yangyinglin/AI playground/APTS演示demo/demo/.npm-cache"
```

访问地址以 `npm run dev` 为准（预期 `http://localhost:5173/`）。

## 结果

| 检查 | 结果 |
|---|---|
| `npm install` | 成功（使用项目内 cache 避开本机 `~/.npm` EPERM） |
| `npm test` | 6 files / 36 tests passed。seed 8 名主故事患者、3 个已发布标签、1 个批次命中数组长度=命中患者集合；`workbenchStats` 与 pending hits／标签／空开放／空人群对象一致；reset 恢复初始；规则样例不计入主故事规模；工作台 DOM 展示 selector 数字、主区无复核／启停／导出按钮、运营分析入口存在；Vite 对 `/` `/tags` `/recognition` `/cohorts` `/open` `/analytics` `/admin/datasets` `/admin/auth` `/admin/scopes` `/admin/metrics` `/admin/systems` 返回 200 |
| `npm run build` | `tsc --noEmit` + `vite build` 通过 |

## 遗留问题

- 阶段 2+：指标编辑、规则计算／试算、识别复核、人群与开放完整操作、患者画像证据链均未做；批次命中为预置对象，不是规则引擎现算。
- WB-02／WB-03／WB-04 未列入本阶段完整范围；工作台有待办／开放摘要布局与空态，无首页处理按钮。
- 演示控制可折叠且默认关闭；推进时间目前只改时钟，不触发计算或到期。
- 验收状态由主会话填写 `acceptance.md`。
