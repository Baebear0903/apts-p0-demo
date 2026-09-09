import { useState } from 'react'
import { addMinutes, formatDateTime } from '../demo/clock'
import type { ButtonPermissionKey, ModuleKey } from '../domain/types'
import { useDemoStore } from '../store/DemoStoreContext'

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
    <div className="side-nav-footer">
      <button
        type="button"
        className="demo-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        演示控制{open ? ' ▾' : ' ▸'}
      </button>
      {open ? (
        <div className="demo-panel" data-testid="demo-controls">
          <p>当前时钟 {formatDateTime(state.clock)}</p>
          <div className="demo-actions">
            <button type="button" className="btn-ghost" onClick={() => store.reset()}>
              重置数据
            </button>
            <button type="button" className="btn-ghost" onClick={() => store.advanceClock(60)}>
              推进 1 小时
            </button>
            <button type="button" className="btn-ghost" onClick={() => store.advanceClock(24 * 60)}>
              推进 1 天
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => store.setClock(addMinutes(state.clock, -60))}
            >
              回退 1 小时
            </button>
            {inRuleSample ? (
              <button type="button" className="btn-primary" onClick={() => store.unloadRuleSamples()}>
                退出规则能力样例
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => store.loadRuleSamples()}>
                载入规则能力样例
              </button>
            )}
          </div>
          <fieldset>
            <legend>模拟失败</legend>
            <label>
              <input
                type="checkbox"
                checked={state.session.simulateFailure}
                onChange={(event) => store.setSimulateFailure(event.target.checked)}
              />
              下一次计算失败
            </label>
          </fieldset>
          <fieldset>
            <legend>模块可见</legend>
            {MODULE_LABELS.map((item) => (
              <label key={item.key}>
                <input
                  type="checkbox"
                  checked={state.session.permissions.modules[item.key]}
                  onChange={(event) => store.setModulePermission(item.key, event.target.checked)}
                />
                {item.label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>按钮权限</legend>
            {BUTTON_LABELS.map((item) => (
              <label key={item.key}>
                <input
                  type="checkbox"
                  checked={state.session.permissions.buttons[item.key]}
                  onChange={(event) => store.setButtonPermission(item.key, event.target.checked)}
                />
                {item.label}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
    </div>
  )
}
