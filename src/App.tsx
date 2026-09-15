import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import RegisterScreen from './screens/RegisterScreen'
import VerifyCodeScreen from './screens/VerifyCodeScreen'
import DashboardScreen from './screens/DashboardScreen'

function Gate({ children, requireAuth }: { children: React.ReactNode; requireAuth: boolean }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="jat-page-center">Loading…</div>
  if (requireAuth && !user) return <Navigate to="/register" replace />
  if (!requireAuth && user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/register"
        element={
          <Gate requireAuth={false}>
            <RegisterScreen />
          </Gate>
        }
      />
      <Route path="/verify" element={<VerifyCodeScreen />} />
      <Route
        path="/dashboard"
        element={
          <Gate requireAuth>
            <DashboardScreen />
          </Gate>
        }
      />
      <Route path="*" element={<Navigate to="/register" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}

export default App
