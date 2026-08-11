import { useState, useEffect } from "react"
import { NavLink, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useSubscription } from "@/hooks/useSubscription"
import { useLang } from "@/hooks/useLang"
import ThemeToggle from "@/components/ThemeToggle"
import ProductTour from "@/components/ProductTour"
import MoreTabBar from "@/components/MoreTabBar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ChevronRight, ChevronsUpDown, LogOut } from "lucide-react"
import { gradientAvatar } from "@/lib/utils"
import { tr } from "@/lib/config"

// Icon for each nav id.
const ICONS = {
  dashboard: dashIcon(), customers: custIcon(), orders: orderIcon(),
  rates: rateIcon(), expenses: expenseIcon(), categories: categoryIcon(),
  karigar: karigarIcon(), reports: reportsIcon(), billing: billingIcon(),
  profile: profileIcon(), backstage: backstageIcon(), more: moreIcon(),
}

// Backstage sub-sections — mirrors the tabs in BackstagePage. Each links to
// /backstage?tab=<key>, which the page reads to pick the active section.
const BACKSTAGE_SECTIONS = [
  { key: "pending",   label: "Pending" },
  { key: "subs",      label: "Subscriptions" },
  { key: "history",   label: "History" },
  { key: "reports",   label: "Reports" },
  { key: "tailors",   label: "Tailors" },
  { key: "plans",     label: "Plans" },
  { key: "sessions",  label: "Sessions" },
  { key: "customers", label: "Customers" },
  { key: "audit",     label: "Audit" },
]

export default function Layout({ children }) {
  const { getUserDisplayName, getUserInitials, getShopName, getLogoUrl, logout } = useAuth()
  const subState = useSubscription()
  const { isAdmin, canKarigar, canReports } = subState
  const { lang, setLang } = useLang()

  const hasReports = isAdmin || canReports
  const hasKarigar = isAdmin || canKarigar

  // ── "More" tab items (always include rates so the Rates/Expenses/Categories
  // group stays together). Order: Rates, Expenses, Categories, Karigar,
  // Subscription, Profile/Backstage. Logout is appended by MoreTabBar.
  const moreIds = ["rates", "expenses", "categories"]
  if (hasKarigar) moreIds.push("karigar")
  moreIds.push("billing")
  moreIds.push(isAdmin ? "backstage" : "profile")

  // ── Mobile bottom nav: 4 main items + More. The 4th slot is Reports when the
  // plan allows it, otherwise Rates is promoted into the bar.
  const bottomMain = ["dashboard", "customers", "orders", hasReports ? "reports" : "rates"]

  // ── Desktop sidebar: grouped like the shadcn sidebar-04 block.
  const overviewIds = ["dashboard", "customers", "orders"]
  if (hasReports) overviewIds.push("reports")
  const workshopIds = ["rates", "expenses", "categories"]
  if (hasKarigar) workshopIds.push("karigar")
  const accountIds = ["billing"]
  if (!isAdmin) accountIds.push("profile")

  const sidebarGroups = [
    { label: "Overview", ids: overviewIds },
    { label: "Workshop", ids: workshopIds },
    { label: "Account",  ids: accountIds },
  ]

  // Routes that render the More tab strip, and the "More" button's behaviour.
  const moreRouteSet = new Set(moreIds)
  const moreTarget = moreIds.find(id => !bottomMain.includes(id)) || moreIds[0]
  const moreActiveSet = new Set(moreIds.filter(id => !bottomMain.includes(id)))

  const [online, setOnline] = useState(navigator.onLine)
  const location = useLocation()
  const navigate = useNavigate()
  const current = location.pathname.replace("/", "") || "dashboard"
  const showMoreTabs = moreRouteSet.has(current)
  const moreActive = moreActiveSet.has(current)
  const moreItems = moreIds.map(id => ({ id }))

  // Backstage collapsible sub-menu (admins only). Active section comes from
  // the ?tab= query param so links deep-link and survive refresh.
  const onBackstage = isAdmin && current === "backstage"
  const activeTab = new URLSearchParams(location.search).get("tab") || "pending"
  // User can collapse/expand; landing on Backstage always shows it open.
  const [userToggledBackstage, setUserToggledBackstage] = useState(false)
  const backstageOpen = onBackstage || userToggledBackstage

  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online",  on)
    window.addEventListener("offline", off)
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off) }
  }, [])

  async function handleLogout() {
    await logout()
    navigate("/login")
  }

  return (
    <div id="pg-app" className="on" style={{ display: "flex", minHeight: "100vh" }}>
      <ProductTour />
      {!online && <div className="offline-bar on">{tr("offline_msg", lang)}</div>}

      {/* Sidebar — shadcn sidebar-04 style (fixed-width, desktop only) */}
      <nav className="sb">
        <div className="sb-top">
          {/* Header — admins see the product brand; tailors see their shop branding */}
          <div className="sb-logo">
            {!isAdmin && getLogoUrl() ? (
              <img src={getLogoUrl()} alt="" className="sb-mark"
                style={{ objectFit: "cover", padding: 0 }}
                onError={e => { e.currentTarget.style.display = "none" }} />
            ) : (
              <div className="sb-mark">{isAdmin ? "T" : (getShopName()[0] || "T").toUpperCase()}</div>
            )}
            {isAdmin
              ? <span className="sb-brand">Tailor<span>CRM</span></span>
              : <span className="sb-brand" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getShopName()}</span>}
          </div>

          {/* Grouped nav */}
          <div className="sb-content">
            {sidebarGroups.map(group => group.ids.length > 0 && (
              <div className="sb-group" key={group.label}>
                <div className="sb-group-label">{group.label}</div>
                <ul className="sb-menu">
                  {group.ids.map(id => (
                    <li key={id}>
                      <NavLink
                        to={"/" + id}
                        data-tour={"nav-" + id}
                        className={({ isActive }) => "ni" + (isActive ? " on" : "")}
                      >
                        {ICONS[id]}
                        <span>{tr(id, lang)}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Backstage — collapsible sub-menu group (admins only) */}
            {isAdmin && (
              <div className="sb-group">
                <div className="sb-group-label">Admin</div>
                <ul className="sb-menu">
                  <li>
                    <button
                      type="button"
                      data-tour="nav-backstage"
                      className={"ni ni-parent" + (onBackstage ? " on" : "")}
                      onClick={() => setUserToggledBackstage(o => !o)}
                      aria-expanded={backstageOpen}
                    >
                      {ICONS.backstage}
                      <span>{tr("backstage", lang)}</span>
                      <ChevronRight className={"sb-caret" + (backstageOpen ? " open" : "")} size={15} />
                    </button>
                    {backstageOpen && (
                      <ul className="sb-submenu">
                        {BACKSTAGE_SECTIONS.map(s => {
                          const active = onBackstage && activeTab === s.key
                          return (
                            <li key={s.key}>
                              <NavLink
                                to={"/backstage?tab=" + s.key}
                                className={"ni-sub" + (active ? " on" : "")}
                              >
                                <span>{s.label}</span>
                              </NavLink>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer — user dropdown (sidebar-04 style) */}
        <div className="sb-foot">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="sb-user">
                <div className="sb-av" style={{ background: gradientAvatar(getUserDisplayName()) }}>
                  {getUserInitials()}
                </div>
                <div className="sb-user-meta">
                  <span className="sb-nm">{getUserDisplayName()}</span>
                  {isAdmin && <span className="sb-role">Admin</span>}
                </div>
                <ChevronsUpDown className="sb-user-caret" size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
              <DropdownMenuLabel className="flex items-center gap-2 py-2">
                <div className="sb-av" style={{ background: gradientAvatar(getUserDisplayName()) }}>
                  {getUserInitials()}
                </div>
                <div className="grid text-left leading-tight">
                  <span className="truncate text-sm font-semibold">{getUserDisplayName()}</span>
                  <span className="truncate text-xs text-muted-foreground">{isAdmin ? "Administrator" : getShopName()}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate(isAdmin ? "/backstage" : "/profile")}>
                {isAdmin ? tr("backstage", lang) : tr("profile", lang)}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/billing")}>
                {tr("billing", lang)}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" /> {tr("sign_out", lang)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* Main content area */}
      <main className="main">
        <div className="topbar">
          <div className="pg-t">{tr(current, lang)}</div>
          <div className="tb-right">
            <span data-tour="theme-toggle"><ThemeToggle /></span>
            <Tabs value={lang} onValueChange={setLang}>
              <TabsList className="gap-1 rounded-full">
                <TabsTrigger className="rounded-full" value="en">EN</TabsTrigger>
                <TabsTrigger className="rounded-full" value="ur">اردو</TabsTrigger>
              </TabsList>
            </Tabs>            
          </div>
        </div>
        <SubscriptionBanner sub={subState} />
        <div className="content">
          {showMoreTabs && <MoreTabBar items={moreItems} />}
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — 4 main items + More */}
      <nav className="mobile-nav">
        {bottomMain.map(id => (
          <NavLink
            key={id}
            to={"/" + id}
            data-tour={"mnav-" + id}
            className={({ isActive }) => "mn-item" + (isActive ? " on" : "")}
          >
            {ICONS[id]}
            <span>{tr(id, lang)}</span>
          </NavLink>
        ))}
        <button
          className={"mn-item" + (moreActive ? " on" : "")}
          data-tour="mnav-more"
          onClick={() => navigate("/" + moreTarget)}
        >
          {ICONS.more}
          <span>{tr("more", lang)}</span>
        </button>
      </nav>
    </div>
  )
}

// ── Subscription reminder banner (auto, threshold-driven) ──────────────────
function SubscriptionBanner({ sub }) {
  const navigate = useNavigate()
  // Admins manage billing; don't nag them. Nothing to show while loading or on free with no history.
  if (sub.loading || sub.isAdmin || !sub.sub) return null

  const { daysLeft, expired, expiringSoon } = sub
  if (!expired && !expiringSoon) return null

  const style = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    padding: "8px 14px", fontSize: 13, fontWeight: 600,
    background: expired ? "hsl(var(--danger-bg))" : "hsl(var(--warning-bg))",
    color:      expired ? "hsl(var(--danger-fg))" : "hsl(var(--warning-fg))",
    borderBottom: "1px solid " + (expired ? "hsl(var(--danger-border))" : "hsl(var(--warning-border))"),
  }
  return (
    <div style={style} role="status">
      <span>
        {expired
          ? "Your Pro plan has expired — you're now on the Free plan."
          : `Your Pro plan expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`}
      </span>
      <button onClick={() => navigate("/billing")}
        style={{
          padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 700, color: "#fff",
          background: expired ? "#dc2626" : "#d97706",
        }}>
        Renew now
      </button>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────
function billingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  )
}
function backstageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/>
    </svg>
  )
}
function profileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18M5 21V7l8-4 8 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>
    </svg>
  )
}
function dashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
}
function custIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function orderIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function rateIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
}
function expenseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>
}
function categoryIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
}
function moreIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
}
function karigarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M18 14l2 2 4-4"/></svg>
}
function reportsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
}
