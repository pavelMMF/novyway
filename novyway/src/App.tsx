import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './ui/layout/AppShell'
import { GovernanceAdminGate } from './ui/components/GovernanceAdminGate'

const Overview = lazy(() => import('./screens/Overview'))
const Elections = lazy(() => import('./screens/Elections'))
const ElectionDetail = lazy(() => import('./screens/ElectionDetail'))
const Documents = lazy(() => import('./screens/Documents'))
const DocumentDetail = lazy(() => import('./screens/DocumentDetail'))
const Profile = lazy(() => import('./screens/Profile'))
const Exams = lazy(() => import('./screens/Exams'))
const ExamDetail = lazy(() => import('./screens/ExamDetail'))
const Audit = lazy(() => import('./screens/Audit'))
const Settings = lazy(() => import('./screens/Settings'))
const NetworkStatus = lazy(() => import('./screens/NetworkStatus'))
const WeightExplainer = lazy(() => import('./screens/WeightExplainer'))
const SignalGame = lazy(() => import('./screens/SignalGame'))
const Auth = lazy(() => import('./screens/Auth'))
const Admin = lazy(() => import('./screens/Admin'))

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<div className="route-loading" role="status" aria-label="Loading"><span /></div>}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/elections" element={<Elections />} />
          <Route path="/elections/:id" element={<ElectionDetail />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/:id" element={<DocumentDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/exams/:id" element={<ExamDetail />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/graph" element={<Navigate to="/documents?view=graph" replace />} />
          <Route path="/network" element={<NetworkStatus />} />
          <Route path="/weights" element={<WeightExplainer />} />
          <Route path="/signal-game" element={<SignalGame />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<GovernanceAdminGate><Admin /></GovernanceAdminGate>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Overview />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}
