import { PageHeader } from '../../ui/PageHeader'

export function AuthPage() {
  return (
    <section>
      <PageHeader title="标签使用授权" />
      <div className="panel">
        <p>标签使用授权配置暂不演示</p>
        <p>
          评审演示账号默认全院患者范围；样例标签及演示中新建标签均在演示账号白名单。可维护标签、复核、圈选、配置及启停开放、查看系统管理。此新建自动授权仅为
          Demo 便利约定，不推导为生产授权政策。
        </p>
        <p className="muted">授权某复合标签不等于授权其引用的基础标签，白名单不沿引用关系扩大。</p>
      </div>
    </section>
  )
}
