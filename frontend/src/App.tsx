import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { useAppDispatch, useAppSelector } from './hooks/redux'
import { restoreSession } from './store/slices/authSlice'
import { fetchExamHistory } from './store/slices/examSlice'
import Layout from './components/layout/Layout'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import PodcastPage from './pages/PodcastPage'
import TranslatePage from './pages/TranslatePage'
import PronouncePage from './pages/PronouncePage'
import CoachPage from './pages/CoachPage'
import VocabPage from './pages/VocabPage'
import GoetheCoursePage from './pages/GoetheCoursePage'
import ExamPage from './pages/ExamPage'
import StudyGuidePage from './pages/StudyGuidePage'
import ConversationPage from './pages/ConversationPage'
import MaterialsPage from './pages/MaterialsPage'
import ReadAlongPage from './pages/ReadAlongPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAppSelector(s => s.auth)
  if (!initialized) return (
    <div className="flex items-center justify-center min-h-screen bg-ink-950">
      <div className="spinner w-8 h-8" />
    </div>
  )
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector(s => s.auth)

  useEffect(() => { dispatch(restoreSession()) }, [dispatch])
  useEffect(() => { if (user) dispatch(fetchExamHistory()) }, [user, dispatch])

  return (
    <>
      <Routes>
        <Route path="/login"    element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index                                  element={<DashboardPage />} />
          <Route path="podcast"                         element={<PodcastPage />} />
          <Route path="translate"                       element={<TranslatePage />} />
          <Route path="pronounce"                       element={<PronouncePage />} />
          <Route path="coach"                           element={<CoachPage />} />
          <Route path="vocab"                           element={<VocabPage />} />
          <Route path="goethe"                          element={<GoetheCoursePage />} />
          <Route path="exam"                            element={<ExamPage />} />
          <Route path="study-guide/:examLevel/:section" element={<StudyGuidePage />} />
          <Route path="conversation"                    element={<ConversationPage />} />
          <Route path="materials"                       element={<MaterialsPage />} />
          <Route path="read/:id"                        element={<ReadAlongPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
        toastStyle={{ background: '#16161d', border: '1px solid rgba(255,255,255,0.07)' }}
      />
    </>
  )
}
