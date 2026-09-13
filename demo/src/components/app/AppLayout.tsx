import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Database,
  LayoutDashboard,
  MapPinned,
  ScanSearch,
  Server,
  Share2,
  ShieldCheck,
  Tags,
  Users,
  Variable,
} from 'lucide-react'
import { ROUTES } from '@/app/routes'
import { DEMO_OPERATOR_NAME } from '@/domain/ids'
import type { ModuleKey } from '@/domain/types'
import { useDemoStore } from '@/store/DemoStoreContext'
import { Notice } from '@/components/shared/kit'
import { DemoControls } from '@/components/app/DemoControls'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  sidebarMenuButtonVariants,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from 'cn'

type NavItem = { to: string; label: string; module: ModuleKey; icon: typeof LayoutDashboard }

const PRIMARY_NAV: NavItem[] = [
  { to: ROUTES.workbench, label: '工作台', module: 'workbench', icon: LayoutDashboard },
  { to: ROUTES.tags, label: '标签中心', module: 'tags', icon: Tags },
  { to: ROUTES.recognition, label: '识别中心', module: 'recognition', icon: ScanSearch },
  { to: ROUTES.cohorts, label: '人群管理', module: 'cohorts', icon: Users },
  { to: ROUTES.open, label: '数据开放', module: 'open', icon: Share2 },
  { to: ROUTES.analytics, label: '运营分析', module: 'analytics', icon: BarChart3 },
]

const ADMIN_NAV = [
  { to: ROUTES.adminDatasets, label: '数据集', icon: Database },
  { to: ROUTES.adminMetrics, label: '指标库', icon: Variable },
  { to: ROUTES.adminSystems, label: '已对接系统', icon: Server },
  { to: ROUTES.adminAuth, label: '标签使用授权', icon: ShieldCheck },
  { to: ROUTES.adminScopes, label: '患者范围', icon: MapPinned },
]

function currentPageLabel(pathname: string): string {
  const exact = [...PRIMARY_NAV, ...ADMIN_NAV].find((item) => item.to === pathname)
  if (exact) return exact.label
  if (pathname.startsWith('/tags')) return '标签中心'
  if (pathname.startsWith('/recognition')) return '识别中心'
  if (pathname.startsWith('/cohorts')) return '人群管理'
  if (pathname.startsWith('/open')) return '数据开放'
  if (pathname.startsWith('/patients')) return '患者画像'
  if (pathname.startsWith('/admin')) return '系统管理'
  return '工作台'
}

export function AppLayout() {
  const { state } = useDemoStore()
  const location = useLocation()
  const visiblePrimary = PRIMARY_NAV.filter((item) => state.session.permissions.modules[item.module])
  const adminVisible = state.session.permissions.modules.admin
  const inRuleSample = state.session.mode === 'ruleSamples'
  const pageLabel = currentPageLabel(location.pathname)

  return (
    <TooltipProvider>
      <SidebarProvider>
        <button type="button" className="skip-link bg-card text-foreground absolute top-[-40px] left-3 z-30 rounded-lg px-3 py-2 focus:top-3" onClick={() => document.getElementById('main-content')?.focus()}>
          跳到主内容
        </button>
        <Sidebar className="border-sidebar-border border-r bg-sidebar">
          <SidebarHeader className="border-b px-3 py-3">
            <div className="px-1">
              <p className="text-[15px] font-semibold tracking-tight">APTS</p>
              <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">重点患者识别与连续性管理</p>
            </div>
          </SidebarHeader>
          <SidebarContent className="py-2">
            <SidebarGroup>
              <SidebarGroupLabel>业务模块</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visiblePrimary.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === ROUTES.workbench}
                        className={({ isActive }) =>
                          cn(
                            sidebarMenuButtonVariants(),
                            'h-10 text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                            isActive && 'border-primary/20 bg-primary/8 font-medium text-primary',
                          )
                        }
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            {adminVisible ? (
              <SidebarGroup>
                <SidebarGroupLabel>系统管理</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {ADMIN_NAV.map((item) => (
                      <SidebarMenuItem key={item.to}>
                        <NavLink
                          to={item.to}
                          className={({ isActive }) =>
                            cn(
                              sidebarMenuButtonVariants(),
                              'h-10 text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                              isActive && 'border-primary/20 bg-primary/8 font-medium text-primary',
                            )
                          }
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : null}
          </SidebarContent>
          <SidebarFooter className="border-t p-2">
            <DemoControls />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset id="main-content" tabIndex={-1} className="bg-background">
          <header className="bg-card flex h-14 items-center justify-between border-b px-6">
            <div className="flex min-w-0 items-center gap-3 text-sm">
              <SidebarTrigger className="text-muted-foreground" />
              <Separator orientation="vertical" className="h-4" />
              <span className="text-muted-foreground">APTS</span>
              <span className="text-border">/</span>
              <span className="truncate font-medium">{pageLabel}</span>
            </div>
            <div className="text-muted-foreground truncate text-xs">{DEMO_OPERATOR_NAME} · 全院</div>
          </header>
          <div className="px-6 py-5">
            {inRuleSample ? (
              <Notice tone="warn" className="mb-4" role="status" data-testid="rule-sample-banner">
                规则能力样例，不覆盖业务数据。退出后回到主故事对象。当前路径 {location.pathname}
              </Notice>
            ) : null}
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
