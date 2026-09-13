import { Navigate, Route, Routes } from 'react-router-dom'
import { ROUTES } from './app/routes'
import { AuthPage } from './pages/admin/AuthPage'
import { DatasetsPage } from './pages/admin/DatasetsPage'
import { MetricsPage } from './pages/admin/MetricsPage'
import { ScopesPage } from './pages/admin/ScopesPage'
import { SystemsPage } from './pages/admin/SystemsPage'
import { AnalyticsPage } from './pages/analytics/AnalyticsPage'
import { CohortDetailPage } from './pages/cohorts/CohortDetailPage'
import { CohortListPage } from './pages/cohorts/CohortListPage'
import { CohortNewPage } from './pages/cohorts/CohortNewPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OpenDetailPage } from './pages/open/OpenDetailPage'
import { OpenListPage } from './pages/open/OpenListPage'
import { OpenNewPage } from './pages/open/OpenNewPage'
import { PatientProfilePage } from './pages/patients/PatientProfilePage'
import { RecognitionBatchPage } from './pages/recognition/RecognitionBatchPage'
import { RecognitionOverviewPage } from './pages/recognition/RecognitionOverviewPage'
import { TagDetailPage } from './pages/tags/TagDetailPage'
import { TagListPage } from './pages/tags/TagListPage'
import { WorkbenchPage } from './pages/WorkbenchPage'
import { AppLayout } from '@/components/app/AppLayout'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path={ROUTES.workbench} element={<WorkbenchPage />} />
        <Route path={ROUTES.tags} element={<TagListPage />} />
        <Route path={ROUTES.tagNew} element={<TagDetailPage />} />
        <Route path={ROUTES.tagDetail} element={<TagDetailPage />} />
        <Route path={ROUTES.recognition} element={<RecognitionOverviewPage />} />
        <Route path={ROUTES.recognitionBatch} element={<RecognitionBatchPage />} />
        <Route path={ROUTES.cohorts} element={<CohortListPage />} />
        <Route path={ROUTES.cohortNew} element={<CohortNewPage />} />
        <Route path={ROUTES.cohortDetail} element={<CohortDetailPage />} />
        <Route path={ROUTES.open} element={<OpenListPage />} />
        <Route path={ROUTES.openNew} element={<OpenNewPage />} />
        <Route path={ROUTES.openDetail} element={<OpenDetailPage />} />
        <Route path={ROUTES.analytics} element={<AnalyticsPage />} />
        <Route path={ROUTES.admin} element={<Navigate to={ROUTES.adminDatasets} replace />} />
        <Route path={ROUTES.adminDatasets} element={<DatasetsPage />} />
        <Route path={ROUTES.adminMetrics} element={<MetricsPage />} />
        <Route path={ROUTES.adminSystems} element={<SystemsPage />} />
        <Route path={ROUTES.adminAuth} element={<AuthPage />} />
        <Route path={ROUTES.adminScopes} element={<ScopesPage />} />
        <Route path={ROUTES.patient} element={<PatientProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
