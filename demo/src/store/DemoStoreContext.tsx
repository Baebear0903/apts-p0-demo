import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { createInitialState } from '../data/seed'
import type { AppState, ButtonPermissionKey, ModuleKey } from '../domain/types'
import {
  advanceClock,
  loadRuleSamples,
  resetState,
  setButtonPermission,
  setClock,
  setModulePermission,
  setSimulateFailure,
  unloadRuleSamples,
} from './store'

type DemoStoreValue = {
  state: AppState
  reset: () => void
  setClock: (iso: string) => void
  advanceClock: (minutes: number) => void
  setSimulateFailure: (value: boolean) => void
  setModulePermission: (key: ModuleKey, enabled: boolean) => void
  setButtonPermission: (key: ButtonPermissionKey, enabled: boolean) => void
  loadRuleSamples: () => void
  unloadRuleSamples: () => void
  patch: (updater: (state: AppState) => AppState) => void
}

const DemoStoreContext = createContext<DemoStoreValue | null>(null)

export function DemoStoreProvider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: AppState
}) {
  const [state, setState] = useState<AppState>(() => initialState ?? createInitialState())

  const value = useMemo<DemoStoreValue>(
    () => ({
      state,
      reset: () => setState(resetState()),
      setClock: (iso) => setState((current) => setClock(current, iso)),
      advanceClock: (minutes) => setState((current) => advanceClock(current, minutes)),
      setSimulateFailure: (simulateFailure) =>
        setState((current) => setSimulateFailure(current, simulateFailure)),
      setModulePermission: (key, enabled) =>
        setState((current) => setModulePermission(current, key, enabled)),
      setButtonPermission: (key, enabled) =>
        setState((current) => setButtonPermission(current, key, enabled)),
      loadRuleSamples: () => setState((current) => loadRuleSamples(current)),
      unloadRuleSamples: () => setState((current) => unloadRuleSamples(current)),
      patch: (updater) => setState((current) => updater(current)),
    }),
    [state],
  )

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>
}

export function useDemoStore(): DemoStoreValue {
  const value = useContext(DemoStoreContext)
  if (!value) {
    throw new Error('useDemoStore 必须在 DemoStoreProvider 内使用')
  }
  return value
}
