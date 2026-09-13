import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { addMinutes, formatDateTime } from '@/demo/clock'
import type { ButtonPermissionKey, ModuleKey } from '@/domain/types'
import { useDemoStore } from '@/store/DemoStoreContext'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FieldSet, FieldLegend } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckRow, NativeCheck } from '@/components/shared/kit'

const MODULE_LABELS: Array<{ key: ModuleKey; label: string }> = [
  { key: 'tags', label: '标签中心' },
  { key: 'recognition', label: '识别中心' },
  { key: 'cohorts', label: '人群管理' },
  { key: 'open', label: '数据开放' },
  { key: 'analytics', label: '运营分析' },
  { key: 'admin', label: '系统管理' },
]

const BUTTON_LABELS: Array<{ key: ButtonPermissionKey; label: string }> = [
  { key: 'tagCreate', label: '标签新建' },
  { key: 'tagEdit', label: '标签编辑' },
  { key: 'tagTrial', label: '标签试算' },
  { key: 'tagPublish', label: '标签发布' },
  { key: 'tagDisable', label: '标签启停' },
  { key: 'tagDelete', label: '标签删除' },
  { key: 'tagAutoRecognition', label: '自动识别配置' },
  { key: 'metricMaintain', label: '指标维护' },
  { key: 'recognitionConfirm', label: '识别复核确认' },
  { key: 'cohortCreate', label: '人群新建' },
  { key: 'cohortEdit', label: '人群编辑' },
  { key: 'cohortRefresh', label: '人群刷新' },
  { key: 'cohortSnapshot', label: '人群快照' },
  { key: 'openCreate', label: '开放新建' },
  { key: 'openEdit', label: '开放编辑' },
  { key: 'openEnable', label: '开放启用' },
  { key: 'openPause', label: '开放暂停' },
  { key: 'openResume', label: '开放恢复' },
  { key: 'openExport', label: '开放导出' },
  { key: 'systemMaintain', label: '系统维护' },
]

export function DemoControls() {
  const store = useDemoStore()
  const [open, setOpen] = useState(false)
  const { state } = store
  const inRuleSample = state.session.mode === 'ruleSamples'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className="border-input hover:bg-sidebar-accent flex h-8 w-full items-center justify-between rounded-lg border border-dashed px-2.5 text-left text-xs"
        aria-expanded={open}
      >
        演示控制
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="mt-2 h-72 rounded-lg bg-background/70 p-2">
          <div className="text-muted-foreground space-y-3 text-xs" data-testid="demo-controls">
            <p>当前时钟 {formatDateTime(state.clock)}</p>
            <div className="flex flex-col gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={() => store.reset()}>
                重置数据
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => store.advanceClock(60)}>
                推进 1 小时
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => store.advanceClock(24 * 60)}>
                推进 1 天
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => store.setClock(addMinutes(state.clock, -60))}>
                回退 1 小时
              </Button>
              {inRuleSample ? (
                <Button type="button" size="sm" onClick={() => store.unloadRuleSamples()}>
                  退出规则能力样例
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => store.loadRuleSamples()}>
                  载入规则能力样例
                </Button>
              )}
            </div>
            <FieldSet className="border-border gap-1 rounded-lg border p-2">
              <FieldLegend variant="label">模拟失败</FieldLegend>
              <CheckRow>
                <NativeCheck
                  checked={state.session.simulateFailure}
                  onChange={(event) => store.setSimulateFailure(event.target.checked)}
                />
                下一次计算失败
              </CheckRow>
            </FieldSet>
            <FieldSet className="border-border gap-1 rounded-lg border p-2">
              <FieldLegend variant="label">模块可见</FieldLegend>
              {MODULE_LABELS.map((item) => (
                <CheckRow key={item.key}>
                  <NativeCheck
                    checked={state.session.permissions.modules[item.key]}
                    onChange={(event) => store.setModulePermission(item.key, event.target.checked)}
                  />
                  {item.label}
                </CheckRow>
              ))}
            </FieldSet>
            <FieldSet className="border-border gap-1 rounded-lg border p-2">
              <FieldLegend variant="label">按钮权限</FieldLegend>
              {BUTTON_LABELS.map((item) => (
                <CheckRow key={item.key}>
                  <NativeCheck
                    checked={state.session.permissions.buttons[item.key]}
                    onChange={(event) => store.setButtonPermission(item.key, event.target.checked)}
                  />
                  {item.label}
                </CheckRow>
              ))}
            </FieldSet>
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  )
}
