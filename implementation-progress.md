# APTS P0 Demo 实施进度

## 路径

| 项 | 绝对路径 |
|---|---|
| 工程根（产品文档，勿改） | `/Users/yangyinglin/AI playground/APTS演示demo` |
| SPEC | `/Users/yangyinglin/AI playground/APTS演示demo/患者标签画像服务-产品规格.md` |
| CONTEXT | `/Users/yangyinglin/AI playground/APTS演示demo/CONTEXT.md` |
| 分阶段提示词 | `/Users/yangyinglin/AI playground/APTS演示demo/分阶段实施提示词.md` |
| Demo 工程 | `/Users/yangyinglin/AI playground/APTS演示demo/demo` |
| 验收清单 | `/Users/yangyinglin/AI playground/APTS演示demo/acceptance.md` |
| 阶段交接 | `/Users/yangyinglin/AI playground/APTS演示demo/progress/` |

## 技术栈

- React 18 + TypeScript + Vite 5
- React Router 6
- 共享内存状态（无真实后端、无持久化）
- Vitest + Testing Library；选择器测试驱动真实 seed／selector

## 运行命令

```bash
cd "/Users/yangyinglin/AI playground/APTS演示demo/demo"
npm install
npm run dev
npm test
npm run build
```

若本机 `~/.npm` 出现 EPERM：

```bash
npm install --cache "/Users/yangyinglin/AI playground/APTS演示demo/demo/.npm-cache"
```

访问地址：以 `npm run dev` 输出为准（预期 `http://localhost:5173/`）。

## 当前阶段

**本轮缺陷与视觉整改已完成，并已于 2026-09-15 从无应用存储的首次打开状态完成最终复验。**

## 实际基线

可运行工程：`/Users/yangyinglin/AI playground/APTS演示demo/demo`

交接：`progress/phase-1.md` … `phase-4.md`。

本轮复验证据：工作台首次打开 `1/6/2/2/3/3`；李强触发 18／当前 7；复核确认生成五人 `SNAP-004`；健康活动三人；开放配置 `OPEN-006`／`OPEN-007`；浏览器下载处理生成的 CSV Blob 与 `SNAP-004` 五人一致。

## 覆盖状态

第 14 章完整／占位／只读项、第 7 章规则能力和附录关键场景均已恢复为“已验证”。WB-06／ANL-01 按修订规格提供完整只读分析。见 `acceptance.md`。

## 阻塞项

当前无已确认阻塞。构建仅有既有的单包超过 500 kB 警告；本轮未把 CSV Blob 验收表述为系统“下载”目录文件落盘验收。

## 下一步

等待用户决定是否按工程约定拆分提交；本轮未提交或推送。
