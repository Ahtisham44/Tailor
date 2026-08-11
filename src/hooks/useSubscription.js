import { createContext, useContext, createElement, useState, useEffect, useCallback } from "react"
import { useAuth } from "@/context/AuthContext"

// Single source of truth for the current user's plan, admin status and slot usage.
// Everything here is advisory for the UI only — the database enforces the real rules.
//
// IMPORTANT: this state is computed ONCE per session and shared via React Context.
// Previously every page (and Layout) called the hook independently, so each
// navigation re-fired ~8 parallel requests per mounted instance (Layout + page =
// ~16 requests on every route change). The SubscriptionProvider below is mounted
// a single time at the app root, fetches once, persists across navigation, and
// re-fetches only when the user changes (login / logout / impersonation) or when
// a consumer explicitly calls refresh() (e.g. after a billing change).
const SubscriptionContext = createContext(null)

function useSubscriptionState() {
  const { api, user } = useAuth()
  const [plan,       setPlan]       = useState(null)   // effective_plan() row
  const [sub,        setSub]        = useState(null)   // subscriptions row (or null = free)
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [slotsUsed,  setSlotsUsed]  = useState(0)
  const [ordersUsed, setOrdersUsed] = useState(0)
  const [karigarsUsed, setKarigarsUsed] = useState(0)
  const [overrides,  setOverrides]  = useState({})     // per-tailor custom-limit feature overrides
  const [loading,    setLoading]    = useState(true)

  const [reminderDays, setReminderDays] = useState([7, 3, 1])

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // Single round-trip: the get_subscription_state() RPC bundles what used to be
    // 8 separate requests (effective_plan, is_current_user_admin,
    // customer_slots_used, order_count_used, active-karigar count,
    // effective_overrides, newest subscription row, billing_reminders setting).
    const { data } = await api.rpc("get_subscription_state")
    const d = data || {}

    const days = d.reminders?.days
    if (Array.isArray(days) && days.length) setReminderDays(days)
    setPlan(d.plan || null)
    setIsAdmin(d.is_admin === true)
    setSlotsUsed(typeof d.slots_used === "number" ? d.slots_used : 0)
    setOrdersUsed(typeof d.orders_used === "number" ? d.orders_used : 0)
    setKarigarsUsed(typeof d.karigars_used === "number" ? d.karigars_used : 0)
    setOverrides((d.overrides && typeof d.overrides === "object") ? d.overrides : {})
    setSub(d.subscription || null)
    setLoading(false)
  }, [api, user])

  useEffect(() => { refresh() }, [refresh])

  const isPro      = plan?.id === "pro"
  const isFree     = !plan || plan?.id === "free"
  const maxCust    = plan?.max_customers ?? null         // null = unlimited
  const slotsLeft  = maxCust == null ? Infinity : Math.max(0, maxCust - slotsUsed)
  const atLimit    = maxCust != null && slotsUsed >= maxCust

  // order limits
  const maxOrders     = plan?.max_orders ?? null         // null = unlimited
  const ordersLeft    = maxOrders == null ? Infinity : Math.max(0, maxOrders - ordersUsed)
  const atOrderLimit  = maxOrders != null && ordersUsed >= maxOrders

  // karigar limits
  const maxKarigars    = plan?.max_karigars ?? null      // null = unlimited
  const karigarsLeft   = maxKarigars == null ? Infinity : Math.max(0, maxKarigars - karigarsUsed)
  const atKarigarLimit = maxKarigars != null && karigarsUsed >= maxKarigars

  // Per-plan feature flags. features[key] may be a legacy boolean or an object
  // { enabled, trial_visits }.
  //   enabled    → fully included on the plan
  //   trialVisits → if not enabled, how many free preview visits before lock
  // "can*" = the feature should be VISIBLE/reachable (included OR has a trial).
  // The actual trial-visit counting + locking happens server-side in
  // record_feature_visit (enforced by FeatureGuard on the route).
  const features = plan?.features || {}
  function readFeat(key, defaultOn = false) {
    const node = features[key]
    if (node == null) return { enabled: defaultOn, trialVisits: 0 }
    if (typeof node === "boolean") return { enabled: node, trialVisits: 0 }
    const t = (node.trial_visits == null || node.trial_visits === "") ? 0 : Number(node.trial_visits)
    return { enabled: node.enabled === true, trialVisits: t }
  }
  const karigarFeat = readFeat("karigar", false)
  const reportsFeat = readFeat("reports", true)

  // ── Per-tailor custom-limit "OFF" → HARD HIDE ──────────────────────────────
  // The override layer is kept separate from the plan (effective_overrides RPC)
  // so we can tell a per-tailor OFF from a plan-level OFF. Per-tailor OFF means
  // the feature is hidden entirely (no nav, no route, no UI, no tab). Plan-level
  // OFF keeps the existing "show locked" upsell behavior. Admins never hide.
  function overriddenOff(key) {
    if (isAdmin) return false
    const node = overrides?.[key]
    if (node == null) return false                 // no override set for this key
    if (typeof node === "boolean") return node === false
    return node.enabled === false
  }
  const karigarHidden = overriddenOff("karigar")

  // visible if fully enabled OR still offered as a trial — UNLESS hidden by a
  // per-tailor override (which wins and hides completely).
  const canKarigar = !karigarHidden && (karigarFeat.enabled || karigarFeat.trialVisits > 0)
  const canReports = reportsFeat.enabled || reportsFeat.trialVisits > 0
  // fully included (no trial gating)
  const hasKarigar = karigarFeat.enabled
  const hasReports = reportsFeat.enabled

  // Per-tab report access. Keys: reports_revenue | reports_orders |
  // reports_customers | reports_karigar. When a per-tab key is absent we fall
  // back to the parent `reports` feature so existing plans keep working.
  // Admins always see every tab.
  const REPORT_TABS = ["revenue", "orders", "customers", "karigar"]
  function reportTabEnabled(tabId) {
    if (isAdmin) return true
    const key = "reports_" + tabId
    const node = features[key]
    if (node == null) return reportsFeat.enabled        // inherit parent flag
    if (typeof node === "boolean") return node
    return node.enabled === true
  }
  // A report tab hidden by a per-tailor override is removed entirely (not shown
  // locked). The karigar report tab is also hidden whenever the karigar feature
  // itself is overridden off.
  function reportTabHidden(tabId) {
    if (isAdmin) return false
    if (overriddenOff("reports_" + tabId)) return true
    if (tabId === "karigar" && karigarHidden) return true
    return false
  }
  // reportTabs[t] = should the tab be reachable (enabled). Hidden tabs are
  // reported as not-enabled too, but reportTabHidden distinguishes hide vs lock.
  const reportTabs = REPORT_TABS.reduce((acc, t) => {
    acc[t] = !reportTabHidden(t) && reportTabEnabled(t); return acc
  }, {})
  const reportTabsHidden = REPORT_TABS.reduce((acc, t) => {
    acc[t] = reportTabHidden(t); return acc
  }, {})
  // If every report tab is hidden by per-tailor overrides, hide Reports entirely
  // (nav + route), not just the tabs.
  const allReportTabsHidden = !isAdmin && REPORT_TABS.every(t => reportTabHidden(t))
  const canReportsVisible = canReports && !allReportTabsHidden

  // days remaining on a live subscription (null if free / none)
  let daysLeft = null
  if (sub?.current_period_end) {
    const ms = new Date(sub.current_period_end).getTime() - Date.now()
    daysLeft = Math.ceil(ms / 86400000)
  }
  const expired   = sub && daysLeft != null && daysLeft <= 0
  const maxReminder = Math.max(...reminderDays, 0)
  // show reminder when remaining days fall within the configured thresholds
  const expiringSoon = daysLeft != null && daysLeft > 0 && daysLeft <= maxReminder

  return {
    plan, sub, isPro, isFree, isAdmin, loading,
    maxCust, slotsUsed, slotsLeft, atLimit,
    maxOrders, ordersUsed, ordersLeft, atOrderLimit,
    maxKarigars, karigarsUsed, karigarsLeft, atKarigarLimit,
    features, overrides, canKarigar, hasKarigar, hasReports,
    canReports: canReportsVisible,
    karigarHidden, reportsHidden: allReportTabsHidden, reportTabsHidden,
    karigarFeat, reportsFeat, reportTabs, reportTabEnabled,
    daysLeft, expired, expiringSoon, reminderDays,
    refresh,
  }
}

// Provider — mount ONCE near the app root (inside AuthProvider). Runs the
// subscription fetch a single time per session and shares the result with every
// consumer, so navigating between pages no longer re-fires the request burst.
export function SubscriptionProvider({ children }) {
  const value = useSubscriptionState()
  return createElement(SubscriptionContext.Provider, { value }, children)
}

// Consumer hook — same return shape as before, so existing call sites are
// unchanged. Reads the shared context instead of fetching per-mount.
export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (ctx == null) {
    throw new Error("useSubscription must be used within a <SubscriptionProvider>")
  }
  return ctx
}
