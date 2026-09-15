import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../../data/seed'
import { BATCH_INITIAL_ID, TAG_EYE_OP_ID } from '../../domain/ids'
import { DemoStoreProvider } from '../../store/DemoStoreContext'
import { confirmRecognitionBatch, generateAutoRecognitionBatch, removeFromReview, undoRemoveFromReview } from '../../store/store'
import { hitsOfBatch, reviewRemovedIds, uniquePatientIds, workbenchStats } from '../../store/selectors'
import { RecognitionBatchPage } from './RecognitionBatchPage'
import { RecognitionOverviewPage } from './RecognitionOverviewPage'
import { WorkbenchPage } from '../WorkbenchPage'

const LI_QIANG = 'P-DEMO-002'

function renderPath(path: string, state = createInitialState()) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DemoStoreProvider initialState={state}>
        <Routes>
          <Route path="/" element={<WorkbenchPage />} />
          <Route path="/recognition" element={<RecognitionOverviewPage />} />
          <Route path="/recognition/:tagId/batches/:batchId" element={<RecognitionBatchPage />} />
        </Routes>
      </DemoStoreProvider>
    </MemoryRouter>,
  )
}

describe('识别批次 UI', () => {
  it('打开 08:00 批次点李强：触发 18、当前 7，时间可见，当前不满足不阻止确认', () => {
    renderPath(`/recognition/${TAG_EYE_OP_ID}/batches/${BATCH_INITIAL_ID}`)
    expect(screen.queryByTestId('current-not-satisfy')).toBeNull()
    act(() => {
      screen.getByTestId(`member-${LI_QIANG}`).querySelector('button')?.click()
    })
    expect(screen.getByTestId('trigger-score')).toHaveTextContent('18')
    expect(screen.getByTestId('current-score')).toHaveTextContent('7')
    expect(screen.getAllByText(/2026-08-20 09:30/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2026-09-07 10:00/).length).toBeGreaterThan(0)
    expect(screen.getByTestId('current-not-satisfy')).toHaveTextContent('当前已不满足')
    expect(screen.getByTestId('confirm-batch')).toBeEnabled()
  })

  it('工作台待办进入对应标签最新批次，确认后待办消失', () => {
    const { unmount } = renderPath('/')
    const link = screen.getByTestId('todo-recognition-link')
    expect(link).toHaveAttribute('href', `/recognition/${TAG_EYE_OP_ID}/batches/${BATCH_INITIAL_ID}`)
    unmount()

    const confirmed = confirmRecognitionBatch(createInitialState(), BATCH_INITIAL_ID)
    expect(confirmed.ok).toBe(true)
    if (!confirmed.ok) return
    renderPath('/', confirmed.state)
    expect(screen.queryByTestId('todo-recognition-link')).toBeNull()
    expect(workbenchStats(confirmed.state).pendingRecognitionBatches).toBe(0)
  })

  it('产生新批次后旧批次只读，新批次成员来自现算命中', () => {
    const generated = generateAutoRecognitionBatch(createInitialState(), TAG_EYE_OP_ID)
    expect(generated.ok).toBe(true)
    if (!generated.ok) return
    const newIds = uniquePatientIds(hitsOfBatch(generated.state, generated.batchId))
    const first = renderPath(`/recognition/${TAG_EYE_OP_ID}/batches/${BATCH_INITIAL_ID}`, generated.state)
    expect(screen.getByText('历史批次 · 只读')).toBeInTheDocument()
    expect(screen.queryByTestId('confirm-batch')).toBeNull()
    first.unmount()

    renderPath(`/recognition/${TAG_EYE_OP_ID}/batches/${generated.batchId}`, generated.state)
    expect(screen.getByTestId('confirm-batch')).toBeInTheDocument()
    for (const id of newIds) {
      expect(screen.getByTestId(`member-${id}`)).toBeInTheDocument()
    }
    expect(screen.queryByTestId(`member-${LI_QIANG}`)).toBeNull()
  })

  it('全移除确认不生成空快照', () => {
    const state = createInitialState()
    let next = state
    for (const hit of hitsOfBatch(state, BATCH_INITIAL_ID)) {
      const step = removeFromReview(next, BATCH_INITIAL_ID, hit.patientId, 'other', '演示')
      expect(step.ok).toBe(true)
      if (!step.ok) return
      next = step.state
    }
    const confirmed = confirmRecognitionBatch(next, BATCH_INITIAL_ID)
    expect(confirmed.ok).toBe(true)
    if (!confirmed.ok) return
    expect(confirmed.snapshotId).toBeNull()
    expect(confirmed.state.snapshots).toHaveLength(next.snapshots.length)
  })

  it('移除可撤销，确认前明确展示原始、移除和保留人数', () => {
    const removed = removeFromReview(createInitialState(), BATCH_INITIAL_ID, LI_QIANG, 'not_satisfy')
    expect(removed.ok).toBe(true)
    if (!removed.ok) return
    const undone = undoRemoveFromReview(removed.state, BATCH_INITIAL_ID, LI_QIANG)
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(reviewRemovedIds(undone.state, BATCH_INITIAL_ID)).not.toContain(LI_QIANG)

    renderPath(`/recognition/${TAG_EYE_OP_ID}/batches/${BATCH_INITIAL_ID}`, removed.state)
    expect(screen.getByLabelText('复核人数汇总')).toHaveTextContent('6原始命中1已移除5最终保留')
    fireEvent.click(screen.getByTestId('confirm-batch'))
    expect(screen.getByRole('dialog')).toHaveTextContent('6原始命中1已移除5最终保留')
    fireEvent.click(screen.getByRole('button', { name: '返回检查' }))
    fireEvent.click(screen.getByRole('button', { name: '撤销移除' }))
    expect(screen.getByTestId('retained-count')).toHaveTextContent('6')
  })
})
