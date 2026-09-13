# APTS P0 需求评审 Demo

APTS 患者标签画像与运营编排原型。使用共享虚拟数据，无真实医院接口或后端；刷新页面会重置本次演示状态。

## 获取与运行

本仓库公开，第三方可直接克隆：

```bash
git clone https://github.com/Baebear0903/apts-p0-demo.git
cd apts-p0-demo/demo
npm ci
npm run dev
```

使用 Node.js 22 LTS。打开终端显示的地址。完整演示路径见 [Demo 说明](demo/README.md)。

## 文档入口

- [产品规格](患者标签画像服务-产品规格.md)：产品行为与范围。
- [CONTEXT](CONTEXT.md)：业务术语。
- [代码地图](code-map.md)：代码职责、修改入口与检查方法。
- [验收清单](acceptance.md)：原始 P0 验收证据及未验证项。
- [实施进度](implementation-progress.md)、[阶段记录](progress/)、[实施提示词](分阶段实施提示词.md)：首次搭建过程，保留历史上下文。

工程内规格是实现基线；产品设计主目录更新后，应明确同步规格并实施相应变更。演示副本作为固定版本归档，持续开发以本仓库为准。

## 检查

在 `demo/` 下运行 `npm test` 和 `npm run build`。自动化检查与实际浏览器验收分别记录，不用历史结论代替当前验证。

## GitHub Pages

- 源码仓库：https://github.com/Baebear0903/apts-p0-demo
- 演示地址：https://baebear0903.github.io/apts-p0-demo/

源码、产品文档、历史记录和演示网站均公开。演示使用虚拟数据。

`.github/workflows/pages.yml` 在 main 推送或 PR 时使用 Node.js 22 全新安装依赖、测试、构建；main 检查通过后自动发布 `demo/dist/` 到 Pages。PR 只验证并归档产物，不发布。管理员在 Settings → Pages 选择 GitHub Actions；发布通过短期 GITHUB_TOKEN/OIDC 授权，无需额外长期令牌。

更新线上版本：提交并推送 main，等待 Actions 的 build、deploy 作业成功。Actions 支持手动重新运行，部署记录可对应源码提交。回退时对目标改动使用 `git revert` 并推送，让同一流程发布回退结果。

使用相对资源路径和 Hash 路由，支持仓库子路径部署。分享详情页时保留 `#/...` 部分；刷新重置演示会话，但保留路由。跳转主内容按钮直接移动焦点，避免覆盖 Hash 路由。

本地检查生产构建：在 `demo/` 执行 `npm run build`、`npm run preview`，打开输出地址并验证导航、详情页刷新及下载。
