# 阶段 4 交接记录

实施代理自检提交。主会话负责验收状态；本文不宣布阶段通过，也不宣布最终 Goal 完成。

## 修改范围

工程 `/Users/yangyinglin/AI playground/APTS演示demo/demo`。未修改 SPEC、CONTEXT、分阶段提示词、acceptance.md。未重建工程。未改写初始批次 `B-20260907-0800` 的 hits 与 seed 主故事八人事实。

覆盖：OPEN-01..12、ADM-07、WB-03、WB-04、COH-12；完成 COH-08 订阅预填后的完整新建／启停／现算外发。已清除「本页将在后续阶段提供完整操作」类开发提示。保留规定占位：运营分析「模块开发中」、授权矩阵占位、患者范围只读。

## 行为要点

- 无审批。草稿可不完整保存，不能下载或计算。启用校验完整字段、权限、对象、系统、截止必须在当前之后，记录启用时间。「授权已启用」旁注不表示对方已收到。
- 数据集交付只能绑定已确认快照；动态人群不可选。直接导出填使用方、用途，不强制系统。通道交付须选支持该方式的系统；停用系统不可启用。
- 启用后类型、使用方／系统、绑定对象锁定。暂停立即停止下载／查询／推送；恢复须人工且全部条件通过。
- 时钟到达截止自动已到期；改期限后须点恢复。系统停用：关联已启用转已暂停原因「系统停用」；系统恢复后仍「系统已恢复，待人工恢复」。
- 标签依赖不可用另列原因并阻止开放，不改变配置自身状态。多原因全部显示。停用／删除／到期／撤权立即阻断，不能返回缓存。不能忽略排除条件扩大人群。
- 默认使用方：选择系统仅在使用方为空时带出；已有内容不覆盖；启用前可改；启用后锁定；改系统默认使用方不回写已有配置。
- CSV：仅授权已启用可下载。真实 UTF-8 CSV（下载带 BOM），固定列，CRLF，身份就诊取快照，电话首次交付从已接入数据获取。李强／吴平空，张敏 `DEMO-TEL-001`。首次导出冻结，重下载字节一致。草稿／暂停／到期不可下载，不用 Toast 冒充文件。来源标签删除后历史快照仍可新建交付并下载。
- 订阅绑定动态人群，按当前条件调用 `computeIncludeExclude` 现算，不使用人群页手动刷新名单，不落内部快照。外发仅三字段。成功零人合法。失败 Toast，不生成新结果。按需查询间隔内复用最近成功并显示原计算时间。定时推送首次时点 = 启用时点 + 周期。「推进至下一推送时点」走同一时钟。查询间隔、推送周期、有效期分开。
- 工作台开放摘要列出草稿／授权已启用／已暂停／已到期及依赖原因；点名称进详情，点状态进筛选列表。无配置空列表文案。首页无启停／导出。
- 快照详情「导出」进入预填当前快照的直接导出配置。动态人群「开放订阅」预填标签订阅并可完成启用与查询。
- 已对接系统可维护名称、编码、默认使用方、开放方式、状态、查询间隔／推送周期。无地址、密钥、日志。编码创建后不可改。预置 SYS-PATIENT 可用、SYS-LEGACY 停用。

## 共享接口增量

store：`saveOpenConfig` / `enableOpenConfig` / `pauseOpenConfig` / `resumeOpenConfig` / `downloadOpenCsv` / `simulateChannelDelivery` / `computeSubscriptionResult` / `queryOpenConfig` / `pushOpenConfig` / `advanceToNextPush` / `simulateOpenExpiry` / `saveConnectedSystem` / `disableConnectedSystem` / `restoreConnectedSystem`。

CSV：`buildSnapshotCsv` / `parseCsv` / `csvFileBytes`。测试解析真实 `buildSnapshotCsv` 输出，并走 `downloadOpenCsv` 与 `computeSubscriptionResult`／`queryOpenConfig`。

## 运行与检查命令

```bash
cd "/Users/yangyinglin/AI playground/APTS演示demo/demo"
npm test
npm run build
```

## 结果

| 检查 | 结果 |
|---|---|
| `npm test` | 14 files / 89 tests passed。含附录：无审批草稿不可下载、启用后 CSV 与快照成员一致且重下载字节一致；张敏 DEMO-TEL-001、李强／吴平电话空；默认使用方空时带出眼科随访组、已填不覆盖、启用后改系统默认不回写；到期后改期限不恢复须点恢复；人工暂停后停用再恢复标签仍暂停，系统恢复须配置上人工恢复；删除排除标签不能忽略排除、不能返回缓存；改条件已发出结果不改写、间隔后下次计算用新条件；失败不生成新结果、成功零人有版本和时间；来源标签删除后旧快照仍可新建交付并下载；定时推送首次时点=启用+周期 |
| `npm run build` | `tsc --noEmit` + `vite build` 通过 |
| 键盘／焦点 | 保留 `:focus-visible`；主按钮为原生 button／链接可到达；弹层关闭后焦点回到触发控件（Modal 记录并恢复 `document.activeElement`，Escape 关闭） |
| 200% 缩放 | 本环境未做真实浏览器 200% 人工缩放。viewport 无 `maximum-scale`／`user-scalable=no`；CSS 无阻止缩放规则；窄屏与表格 `overflow: auto`，不把布局锁死在固定视口 |

验收状态由主会话填写 `acceptance.md`。
