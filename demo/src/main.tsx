import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { DemoStoreProvider } from './store/DemoStoreContext'

const root = document.getElementById('root')
if (!root) {
  throw new Error('缺少 #root')
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DemoStoreProvider>
        <App />
      </DemoStoreProvider>
    </BrowserRouter>
  </StrictMode>,
)
