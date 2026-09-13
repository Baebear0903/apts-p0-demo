# APTS P0 需求评审 Demo

APTS 患者标签画像与运营编排原型。使用共享虚拟数据，无真实医院接口或后端；刷新页面会重置本次演示状态。

## 获取与运行

本仓库为私有仓库。第三方需先由仓库管理员授予访问权限，再使用自己的 GitHub 账号克隆：

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
