import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ROUTES } from '../app/routes'
import type { ModuleKey } from '../domain/types'
import { useDemoStore } from '../store/DemoStoreContext'
import { DemoControls } from './DemoControls'

type NavItem = { to: string; label: string; module: ModuleKey }

const PRIMARY_NAV: NavItem[] = [
  { to: ROUTES.workbench, label: '工作台', module: 'workbench' },
  { to: ROUTES.tags, label: '标签中心', module: 'tags' },
  { to: ROUTES.recognition, label: '识别中心', module: 'recognition' },
  { to: ROUTES.cohorts, label: '人群管理', module: 'cohorts' },
  { to: ROUTES.open, label: '数据开放', module: 'open' },
  { to: ROUTES.analytics, label: '运营分析', module: 'analytics' },
]

const ADMIN_NAV = [
  { to: ROUTES.adminDatasets, label: '数据集' },
  { to: ROUTES.adminMetrics, label: '指标库' },
  { to: ROUTES.adminSystems, label: '已对接系统' },
  { to: ROUTES.adminAuth, label: '标签使用授权' },
  { to: ROUTES.adminScopes, label: '患者范围' },
]

export function AppLayout() {
  const { state } = useDemoStore()
  const location = useLocation()
  const visiblePrimary = PRIMARY_NAV.filter((item) => state.session.permissions.modules[item.module])
  const adminVisible = state.session.permissions.modules.admin
  const inRuleSample = state.session.mode === 'ruleSamples'

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主内容
      </a>
      <aside className="side-nav">
        <div className="brand">
          <h1>APTS</h1>
          <p>重点患者识别与连续性管理</p>
        </div>
        <nav aria-label="业务模块">
          <ul className="nav-list">
            {visiblePrimary.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
                  end={item.to === ROUTES.workbench}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          {adminVisible ? (
            <>
              <span className="nav-section-label">系统管理</span>
              <ul className="sub-nav">
                {ADMIN_NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </nav>
        <DemoControls />
      </aside>
      <main className="app-main" id="main-content">
        {inRuleSample ? (
          <div className="banner" role="status" data-testid="rule-sample-banner">
            规则能力样例，不覆盖业务数据。退出后回到主故事对象。当前路径 {location.pathname}
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  )
}
