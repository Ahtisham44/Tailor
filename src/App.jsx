import { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import { TourProvider } from "@/context/TourContext"
import { SubscriptionProvider, useSubscription } from "@/hooks/useSubscription"
import FeatureLockOverlay from "@/components/FeatureLockOverlay"
import { Toaster } from "sonner"
import Layout from "@/components/Layout"
import LoginPage     from "@/pages/LoginPage"
import DashboardPage from "@/pages/DashboardPage"
import CustomersPage from "@/pages/CustomersPage"
import OrdersPage    from "@/pages/OrdersPage"
import RatesPage     from "@/pages/RatesPage"
import ExpensesPage  from "@/pages/ExpensesPage"
import CategoriesPage from "@/pages/CategoriesPage"
import KarigarPage   from "@/pages/KarigarPage"
import ReportsPage   from "@/pages/ReportsPage"
import BillingPage   from "@/pages/BillingPage"
import ProfilePage   from "@/pages/ProfilePage"
import BackstagePage from "@/pages/BackstagePage"
import ImpersonatePage from "@/pages/ImpersonatePage"
import LandingPage    from "@/pages/LandingPage"

function AuthGuard({ children }) {
  const { isAuthenticated, initializing } = useAuth()
  if (initializing) return <div className="ld" style={{ height: "100vh" }}><div className="spin" /></div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

// Gates a route by plan feature. If the feature is fully included (or admin),
// renders immediately. Otherwise it records a trial "visit" via RPC; while the
// tailor still has free previews left the page renders, and once they're used
// up it shows the upgrade overlay. Counting is permanent until they upgrade.
function FeatureGuard({ feature, children }) {
  const { api } = useAuth()
  const sub = useSubscription()
  const [state, setState] = useState({ phase: "checking", used: 0, limit: 0 })

  // Per-tailor custom-limit OFF → hard-hide: bounce to dashboard rather than
  // showing the upsell lock overlay (plan-level OFF still shows locked).
  const hardHidden = (feature === "karigar" && sub.karigarHidden)
    || (feature === "reports" && sub.reportsHidden)

  // Fully included (no counting). Trial-only features fall through to the
  // record_feature_visit RPC, which allows the first N visits then locks.
  const included = sub.isAdmin
    || (feature === "karigar" && sub.hasKarigar)
    || (feature === "reports" && sub.hasReports)

  useEffect(() => {
    if (sub.loading) return
    if (hardHidden) { setState({ phase: "hidden", used: 0, limit: 0 }); return }
    if (included) { setState({ phase: "allowed", used: 0, limit: 0 }); return }
    let alive = true
    api.rpc("record_feature_visit", { p_feature: feature }).then(r => {
      if (!alive) return
      const row = Array.isArray(r.data) ? r.data[0] : r.data
      if (!row) { setState({ phase: "locked", used: 0, limit: 0 }); return }
      setState({
        phase: row.allowed ? "allowed" : "locked",
        used:  row.count ?? 0,
        limit: row.limit ?? 0,
      })
    })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub.loading, included, hardHidden, feature])

  if (sub.loading || state.phase === "checking")
    return <div className="ld" style={{ height: "60vh" }}><div className="spin" /></div>
  if (state.phase === "hidden")
    return <Navigate to="/dashboard" replace />
  if (state.phase === "locked")
    return <Layout><FeatureLockOverlay feature={feature} used={state.used} limit={state.limit} /></Layout>
  return children
}

function AppRoutes() {
  const { isAuthenticated, initializing } = useAuth()
  if (initializing) return <div className="ld" style={{ height: "100vh" }}><div className="spin" /></div>

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/impersonate" element={<ImpersonatePage />} />
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/dashboard" element={<AuthGuard><Layout><DashboardPage /></Layout></AuthGuard>} />
      <Route path="/customers" element={<AuthGuard><Layout><CustomersPage /></Layout></AuthGuard>} />
      <Route path="/orders"    element={<AuthGuard><Layout><OrdersPage /></Layout></AuthGuard>} />
      <Route path="/rates"     element={<AuthGuard><Layout><RatesPage /></Layout></AuthGuard>} />
      <Route path="/expenses"  element={<AuthGuard><Layout><ExpensesPage /></Layout></AuthGuard>} />
      <Route path="/categories" element={<AuthGuard><Layout><CategoriesPage /></Layout></AuthGuard>} />
      <Route path="/karigar"   element={<AuthGuard><FeatureGuard feature="karigar"><Layout><KarigarPage /></Layout></FeatureGuard></AuthGuard>} />
      <Route path="/reports"   element={<AuthGuard><FeatureGuard feature="reports"><Layout><ReportsPage /></Layout></FeatureGuard></AuthGuard>} />
      <Route path="/billing"   element={<AuthGuard><Layout><BillingPage /></Layout></AuthGuard>} />
      <Route path="/profile"   element={<AuthGuard><Layout><ProfilePage /></Layout></AuthGuard>} />
      <Route path="/backstage" element={<AuthGuard><Layout><BackstagePage /></Layout></AuthGuard>} />
      <Route path="*"          element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionProvider>
          <TourProvider>
            <AppRoutes />
            <Toaster position="bottom-right" richColors />
          </TourProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
