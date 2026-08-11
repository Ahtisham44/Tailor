import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useSubscription } from "@/hooks/useSubscription"
import { toast } from "sonner"
import {
  ShieldCheck, Inbox, Users, ScrollText, BellRing,
  Receipt, ExternalLink, Copy, CheckCircle2, BookUser, Pencil, Trash2, Plus,
  BarChart3, MonitorSmartphone, LogIn, Smartphone, Tablet, Monitor,
  TrendingUp, DollarSign, UserCheck, UserX, Layers, SlidersHorizontal, ChevronRight,
  MoreHorizontal, Ban, KeyRound,
} from "lucide-react"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

// Radix gotcha: opening a Dialog directly from a DropdownMenu item races the
// menu's close cleanup against the dialog's open, which can leave a stuck
// `pointer-events: none` lock on <body> (page visible but unclickable). The
// maintainer-recommended fix is to defer opening the dialog until after the
// menu has fully closed — so use onSelect + this one-tick defer.
function afterMenuClose(fn) {
  setTimeout(fn, 0)
}

// Admin-only control panel. Visibility here is cosmetic; every query and action
// is independently enforced by RLS / security-definer functions in Postgres.
// This file contains NO secret keys.
// Section keys + labels — the sidebar sub-menu drives these via ?tab=.
const SECTION_LABELS = {
  pending: "Pending payments", subs: "Subscriptions", history: "History",
  reports: "Reports", tailors: "Tailors", plans: "Plans",
  sessions: "Login sessions", customers: "Customers", audit: "Audit log",
}
const SECTION_KEYS = Object.keys(SECTION_LABELS)

export default function BackstagePage() {
  const { api } = useAuth()
  const { isAdmin, loading: subLoading } = useSubscription()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get("tab")
  const activeTab = SECTION_KEYS.includes(rawTab) ? rawTab : "pending"
  const setTab = (v) => setSearchParams({ tab: v }, { replace: true })

  const [requests, setRequests] = useState([])
  const [subs,     setSubs]     = useState([])
  const [audit,    setAudit]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [busyId,   setBusyId]   = useState(null)
  const [reject,   setReject]   = useState(null)   // request being rejected
  const [rejectNote, setRejectNote] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    const [reqR, audR, subR] = await Promise.all([
      api.rpc("admin_list_payment_requests"),
      api.sbQ("admin_audit", { query: "select=*", order: "created_at.desc", limit: 100 }),
      api.rpc("admin_list_subscriptions"),
    ])
    setRequests(Array.isArray(reqR.data) ? reqR.data : [])
    setAudit(audR.data || [])
    setSubs(Array.isArray(subR.data) ? subR.data : [])
    setLoading(false)
  }, [api])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  async function viewReceipt(path) {
    if (!path) return toast.error("No receipt attached")
    const r = await api.signedReceiptUrl(path)
    if (r.error) return toast.error(r.error.message)
    window.open(r.data.url, "_blank", "noopener")
  }

  async function approve(id) {
    setBusyId(id)
    const r = await api.rpc("approve_payment", { request_id: id })
    setBusyId(null)
    if (r.error) return toast.error(r.error.message)
    toast.success("Payment approved, subscription extended")
    load()
  }

  async function confirmReject() {
    if (!reject) return
    setBusyId(reject.id)
    const r = await api.rpc("reject_payment", { request_id: reject.id, note: rejectNote })
    setBusyId(null)
    setReject(null); setRejectNote("")
    if (r.error) return toast.error(r.error.message)
    toast.success("Payment rejected")
    load()
  }

  if (subLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
        <h2 className="mt-4 text-lg font-semibold">Restricted</h2>
        <p className="mt-1 text-sm text-muted-foreground">This area is for administrators only.</p>
      </div>
    )
  }

  const pending = requests.filter(r => r.status === "pending")
  const handled = requests.filter(r => r.status !== "pending")

  return (
    <div className="mx-auto max-w-5xl px-2 py-2">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight">Backstage</h1>
          <Badge variant="secondary" className="gap-1 font-medium">
            <ShieldCheck className="h-3 w-3" /> Admin
          </Badge>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-lg font-semibold text-muted-foreground">{SECTION_LABELS[activeTab]}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve payments, manage subscriptions and accounts.
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setTab}>
        {/* ── Pending payments ─────────────────────────────────────────── */}
        <TabsContent value="pending" className="mt-5">
          {loading ? <TableSkeleton /> : pending.length === 0 ? (
            <EmptyState icon={Inbox} title="No pending payments"
              hint="New payment submissions from tailors will appear here." />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">
                          {r.plan_id?.toUpperCase()} · {r.amount_pkr ? `PKR ${Number(r.amount_pkr).toLocaleString()}` : "amount n/a"}
                        </div>
                        <div className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground" title={r.login}>
                          {r.display_name || r.login || r.user_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="capitalize">{r.method || "—"}</div>
                        <div className="text-xs text-muted-foreground">ref {r.reference_no || "—"}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {fmtDateTime(r.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" disabled={!r.receipt_path}
                          onClick={() => viewReceipt(r.receipt_path)} className="gap-1.5">
                          <Receipt className="h-3.5 w-3.5" /> View
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" disabled={busyId === r.id} onClick={() => approve(r.id)}>
                            {busyId === r.id ? "Working…" : "Approve"}
                          </Button>
                          <Button size="sm" variant="outline"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={busyId === r.id} onClick={() => setReject(r)}>
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Subscriptions ────────────────────────────────────────────── */}
        <TabsContent value="subs" className="mt-5 space-y-5">
          <ReminderSettings api={api} />
          {loading ? <TableSkeleton /> : subs.length === 0 ? (
            <EmptyState icon={Users} title="No subscriptions yet"
              hint="Approved payments create subscriptions automatically." />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tailor</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Valid until</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map(s => (
                    <TableRow key={s.user_id + s.started_at}>
                      <TableCell>
                        <div className="font-medium">{s.display_name || s.login}</div>
                        <div className="text-xs text-muted-foreground">{s.login}</div>
                      </TableCell>
                      <TableCell className="uppercase">{s.plan_id}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {fmtDate(s.current_period_end)}
                      </TableCell>
                      <TableCell className="text-right"><SubStatusBadge sub={s} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── History ──────────────────────────────────────────────────── */}
        <TabsContent value="history" className="mt-5">
          {loading ? <TableSkeleton /> : handled.length === 0 ? (
            <EmptyState icon={Inbox} title="Nothing here yet"
              hint="Approved and rejected payments are kept here." />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Tailor</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reviewed</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {handled.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">
                          {r.plan_id?.toUpperCase()} · {r.amount_pkr ? `PKR ${Number(r.amount_pkr).toLocaleString()}` : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">ref {r.reference_no || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.display_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.login}</div>
                      </TableCell>
                      <TableCell className="capitalize">{r.method || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.reviewed_at ? fmtDateTime(r.reviewed_at) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" disabled={!r.receipt_path}
                          onClick={() => viewReceipt(r.receipt_path)} className="gap-1.5">
                          <Receipt className="h-3.5 w-3.5" /> View
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground" title={r.admin_note || ""}>
                        {r.admin_note || "—"}
                      </TableCell>
                      <TableCell className="text-right"><RequestStatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Reports ──────────────────────────────────────────────────── */}
        <TabsContent value="reports" className="mt-5">
          <ReportsTab api={api} />
        </TabsContent>

        {/* ── Tailors ──────────────────────────────────────────────────── */}
        <TabsContent value="tailors" className="mt-5">
          <TailorsCRUD api={api} />
        </TabsContent>

        {/* ── Plans ────────────────────────────────────────────────────── */}
        <TabsContent value="plans" className="mt-5">
          <PlansCRUD api={api} />
        </TabsContent>

        {/* ── Login sessions ───────────────────────────────────────────── */}
        <TabsContent value="sessions" className="mt-5">
          <SessionsTab api={api} />
        </TabsContent>

        {/* ── Customers ────────────────────────────────────────────────── */}
        <TabsContent value="customers" className="mt-5">
          <CustomersCRUD api={api} />
        </TabsContent>

        {/* ── Audit log ────────────────────────────────────────────────── */}
        <TabsContent value="audit" className="mt-5">
          {loading ? <TableSkeleton /> : audit.length === 0 ? (
            <EmptyState icon={ScrollText} title="No actions logged yet"
              hint="Every admin action is recorded permanently." />
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.action.replaceAll("_", " ")}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground"
                        title={a.detail ? JSON.stringify(a.detail) : ""}>
                        {a.detail ? JSON.stringify(a.detail) : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                        {fmtDateTime(a.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject dialog (note is optional, stored in the audit trail) */}
      <Dialog open={!!reject} onOpenChange={open => { if (!open) { setReject(null); setRejectNote("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this payment?</DialogTitle>
            <DialogDescription>
              {reject && <>The tailor will see it as rejected{reject.reference_no ? <> (ref {reject.reference_no})</> : null}. They can submit a new payment afterwards.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Reason (optional, shown to the tailor)</Label>
            <Textarea id="reject-note" value={rejectNote} onChange={e => setRejectNote(e.target.value)}
              placeholder="e.g. Amount doesn't match the Pro plan price" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReject(null); setRejectNote("") }}>Cancel</Button>
            <Button variant="destructive" disabled={busyId === reject?.id} onClick={confirmReject}>
              {busyId === reject?.id ? "Rejecting…" : "Reject payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Reminder settings ─────────────────────────────────────────────────────
function ReminderSettings({ api }) {
  const [days,   setDays]   = useState("")
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.sbQ("app_settings", { query: "key=eq.billing_reminders", limit: 1 }).then(r => {
      const d = r.data?.[0]?.value?.days
      if (Array.isArray(d)) setDays(d.join(", "))
      setLoaded(true)
    })
  }, [api])

  async function save(e) {
    e.preventDefault()
    const parsed = days.split(",").map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n) && n > 0 && n <= 60)
    if (!parsed.length) return toast.error("Enter days like: 7, 3, 1")
    setSaving(true)
    const r = await api.sbQ("app_settings", {
      method: "PATCH", query: "key=eq.billing_reminders",
      body: { value: { days: parsed }, updated_at: new Date().toISOString() },
    })
    setSaving(false)
    if (r.error) return toast.error(r.error.message)
    toast.success("Saved. Tailors see renewal banners at " + parsed.join(", ") + " days left.")
  }

  return (
    <form onSubmit={save}
      className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <BellRing className="mb-2 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-[220px] flex-1 space-y-1">
        <Label htmlFor="reminder-days" className="text-xs">Renewal banner, days before expiry</Label>
        <Input id="reminder-days" value={days} onChange={e => setDays(e.target.value)}
          placeholder="7, 3, 1" disabled={!loaded} className="h-8 bg-background" />
      </div>
      <Button type="submit" size="sm" disabled={saving || !loaded}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </form>
  )
}

// ── Create account ────────────────────────────────────────────────────────
// inline=true → no Card wrapper (used inside a Dialog)
function CreateAccountForm({ api, onCreated, inline = false }) {
  const [phone,    setPhone]    = useState("")
  const [shopName, setShopName] = useState("")
  const [logoUrl,  setLogoUrl]  = useState("")
  const [planId,   setPlanId]   = useState("free")
  const [password, setPassword] = useState("")
  const [busy,     setBusy]     = useState(false)
  const [created,  setCreated]  = useState(null)
  const [copied,   setCopied]   = useState(false)
  const [plans,    setPlans]    = useState([])

  useEffect(() => {
    api.sbQ("plans", { query: "select=id,name,price_pkr&is_active=eq.true", order: "price_pkr.asc.nullsfirst" })
      .then(r => setPlans(Array.isArray(r.data) ? r.data : []))
  }, [api])

  async function submit(e) {
    e.preventDefault()
    if (!api.normalizePkPhone(phone)) return toast.error("Enter a valid mobile number (03xx-xxxxxxx)")
    if (!shopName.trim())             return toast.error("Shop name is required")
    if (!logoUrl.trim())              return toast.error("Logo URL is required")
    if (!/^https?:\/\//i.test(logoUrl.trim()))
      return toast.error("Logo URL must start with http:// or https://")
    if (!planId)                      return toast.error("Select a plan")
    if (password.length < 8)          return toast.error("Password must be at least 8 characters")
    setBusy(true)
    const r = await api.fn("create-tailor", {
      phone,
      shop_name: shopName,
      logo_url:  logoUrl.trim(),
      plan_id:   planId,
      password,
    })
    setBusy(false)
    if (r.error) return toast.error(r.error.message)
    toast.success("Account created")
    setCreated({ phone: r.data.phone, password })
    setCopied(false)
    setPhone(""); setShopName(""); setLogoUrl(""); setPlanId("free"); setPassword("")
    onCreated()
  }

  async function copyCreds() {
    try {
      await navigator.clipboard.writeText(`Login: ${created.phone}\nPassword: ${created.password}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error("Could not copy") }
  }

  const formBody = (
    <>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ca-phone">Mobile number <span className="text-destructive">*</span></Label>
          <Input id="ca-phone" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="0300 1234567" type="tel" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca-shop">Shop name <span className="text-destructive">*</span></Label>
          <Input id="ca-shop" value={shopName} onChange={e => setShopName(e.target.value)}
            placeholder="Ahmed Tailors" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca-logo">Logo URL <span className="text-destructive">*</span></Label>
          <Input id="ca-logo" value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
            placeholder="https://…/logo.png" type="url" />
          {logoUrl.trim() && /^https?:\/\//i.test(logoUrl.trim()) && (
            <img src={logoUrl.trim()} alt="" className="mt-1 h-10 w-10 rounded object-contain border"
              onError={e => { e.currentTarget.style.display = "none" }} />
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca-plan">Plan <span className="text-destructive">*</span></Label>
          <Select value={planId} onValueChange={setPlanId}>
            <SelectTrigger id="ca-plan"><SelectValue placeholder="Select a plan" /></SelectTrigger>
            <SelectContent>
              {(plans.length ? plans : [{ id: "free", name: "Free" }]).map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.price_pkr ? ` — PKR ${Number(p.price_pkr).toLocaleString()}/mo` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca-pass">Temporary password <span className="text-destructive">*</span></Label>
          <Input id="ca-pass" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="min 8 characters" />
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>

        {created && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-emerald-800">Share with the tailor</p>
              <Button type="button" variant="outline" size="sm" onClick={copyCreds} className="gap-1.5 bg-background">
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-2 font-mono text-sm text-emerald-900">
              Login: {created.phone}<br />Password: {created.password}
            </p>
          </div>
        )}
    </>
  )

  if (inline) return <div className="space-y-0">{formBody}</div>

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-base">New tailor account</CardTitle>
        <CardDescription>
          Created with their phone number, no verification needed. Share the
          credentials; they sign in with phone + password.
        </CardDescription>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  )
}

// ── Small pieces ──────────────────────────────────────────────────────────
// Shared status-pill styling: shadcn Badge, secondary base, fully rounded,
// no shadow, with semantic hardcoded colors (light + dark) per shadcn's
// "Custom Colors" pattern.
const TONE = {
  green:   "rounded-full border-transparent shadow-none bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300",
  amber:   "rounded-full border-transparent shadow-none bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300",
  red:     "rounded-full border-transparent shadow-none bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300",
  violet:  "rounded-full border-transparent shadow-none bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-900/40 dark:text-violet-300",
  neutral: "rounded-full shadow-none",
}

function ToneBadge({ tone = "neutral", className = "", children }) {
  return <Badge variant="secondary" className={`${TONE[tone] || TONE.neutral} ${className}`}>{children}</Badge>
}

function SubStatusBadge({ sub }) {
  // Lifetime: no end date or a far-future sentinel (year ≥ 2900) → never expires.
  const isLifetime = sub && sub.status !== "canceled" && (
    sub.is_lifetime || sub.current_period_end == null ||
    new Date(sub.current_period_end).getFullYear() >= 2900
  )
  if (isLifetime) return <ToneBadge tone="violet">lifetime</ToneBadge>
  const d = Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000)
  if (sub.status === "canceled")
    return <ToneBadge tone="neutral">canceled</ToneBadge>
  if (d <= 0)
    return <ToneBadge tone="red">expired</ToneBadge>
  if (d <= 7)
    return <ToneBadge tone="amber">{d}d left</ToneBadge>
  return <ToneBadge tone="green">{d}d left</ToneBadge>
}

function RequestStatusBadge({ status }) {
  if (status === "approved") return <ToneBadge tone="green">approved</ToneBadge>
  if (status === "rejected") return <ToneBadge tone="red">rejected</ToneBadge>
  return <ToneBadge tone="amber">pending</ToneBadge>
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40" />
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}
function fmtDateTime(d) {
  return new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

// ── Customers CRUD ────────────────────────────────────────────────────────
function CustomersCRUD({ api }) {
  const [customers, setCustomers]   = useState([])
  const [loading,   setLoading]     = useState(true)
  const [search,    setSearch]      = useState("")

  // Dialog state
  const [open,      setOpen]        = useState(false)
  const [editId,    setEditId]      = useState(null)
  const [name,      setName]        = useState("")
  const [phone,     setPhone]       = useState("")
  const [custNum,   setCustNum]     = useState("")
  const [notes,     setNotes]       = useState("")
  const [saving,    setSaving]      = useState(false)

  // Delete confirm
  const [delId,     setDelId]       = useState(null)
  const [delBusy,   setDelBusy]     = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const r = await api.sbQ("customers", {
      query: "select=id,first_name,phone,customer_number,customer_seq,notes,created_at,deleted_at",
      order: "customer_seq.asc.nullslast",
      limit: 1000,
    })
    setCustomers(r.data || [])
    setLoading(false)
  }

  const filtered = customers.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (c.first_name || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.customer_number || "").toLowerCase().includes(q)
    )
  })

  function openAdd() {
    setEditId(null); setName(""); setPhone(""); setCustNum(""); setNotes("")
    setOpen(true)
  }

  function openEdit(c) {
    setEditId(c.id)
    setName(c.first_name || "")
    setPhone(c.phone || "")
    setCustNum(c.customer_number || "")
    setNotes(c.notes || "")
    setOpen(true)
  }

  async function save() {
    if (!name.trim()) return toast.error("Name is required")
    setSaving(true)
    const body = { first_name: name.trim() }
    if (phone.trim())   body.phone           = phone.trim()
    if (custNum.trim()) body.customer_number = custNum.trim()
    if (notes.trim())   body.notes           = notes.trim()

    let r
    if (editId) {
      r = await api.sbQ("customers", { method: "PATCH", query: "id=eq." + editId, body })
    } else {
      // Get next seq number
      const seqR = await api.sbQ("customers", { query: "deleted_at=is.null", order: "customer_seq.desc", limit: 1 })
      const seq = ((seqR.data && seqR.data[0]?.customer_seq) || 0) + 1
      const book = Math.floor((seq - 1) / 100) + 1
      const num  = ((seq - 1) % 100) + 1
      body.customer_seq    = seq
      body.customer_number = custNum.trim() || (String(num).padStart(4, "0") + "-B" + book)
      r = await api.sbQ("customers", { method: "POST", body: [body] })
    }

    setSaving(false)
    if (r.error) return toast.error(r.error.message)
    toast.success(editId ? "Customer updated" : "Customer added")
    setOpen(false)
    load()
  }

  async function confirmDelete() {
    if (!delId) return
    setDelBusy(true)
    // Soft delete (mirrors what CustomersPage does)
    const r = await api.sbQ("customers", { method: "PATCH", query: "id=eq." + delId, body: { deleted_at: new Date().toISOString() } })
    setDelBusy(false)
    setDelId(null)
    if (r.error) return toast.error(r.error.message)
    toast.success("Customer removed")
    load()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name, phone or customer #…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button className="ml-auto gap-1.5" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add customer
        </Button>
      </div>

      {/* Table */}
      {loading ? <TableSkeleton /> : filtered.length === 0 ? (
        <EmptyState icon={BookUser} title="No customers found" hint="Add your first customer or adjust the search." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cust #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className={c.deleted_at ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">{c.customer_number || "—"}</TableCell>
                  <TableCell className="font-medium">{c.first_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(c.created_at)}</TableCell>
                  <TableCell>
                    {c.deleted_at
                      ? <ToneBadge tone="red">deleted</ToneBadge>
                      : <ToneBadge tone="green">active</ToneBadge>
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {!c.deleted_at && (
                        <Button size="sm" variant="outline"
                          className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDelId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={o => { if (!o) setOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit customer" : "Add customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-name">Name <span className="text-destructive">*</span></Label>
              <Input id="cc-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ahmed Ali" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-phone">Phone <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="cc-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0300 1234567" type="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-num">Customer # <span className="text-muted-foreground font-normal">(auto if blank)</span></Label>
              <Input id="cc-num" value={custNum} onChange={e => setCustNum(e.target.value)} placeholder="e.g. 0001-B1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="cc-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Any notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editId ? "Save changes" : "Add customer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!delId} onOpenChange={o => { if (!o) setDelId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this customer?</DialogTitle>
            <DialogDescription>The customer will be marked as deleted. Their data is retained.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={delBusy} onClick={confirmDelete}>
              {delBusy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Tailors CRUD ──────────────────────────────────────────────────────────
function TailorsCRUD({ api }) {
  const [tailors,    setTailors]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState("")
  const [planTab,    setPlanTab]    = useState("all")  // all | paid | free
  const [createOpen, setCreateOpen] = useState(false)
  const [pwdTarget,  setPwdTarget]  = useState(null)
  const [newPwd,     setNewPwd]     = useState("")
  const [pwdBusy,    setPwdBusy]    = useState(false)
  const [banTarget,  setBanTarget]  = useState(null)
  const [banBusy,    setBanBusy]    = useState(false)
  const [impTarget,  setImpTarget]  = useState(null)
  const [impBusy,    setImpBusy]    = useState(false)
  const [delTarget,  setDelTarget]  = useState(null)
  const [delBusy,    setDelBusy]    = useState(false)

  const [allPlans,   setAllPlans]   = useState([])

  // Per-user override dialog
  const [ovrTarget, setOvrTarget] = useState(null)   // the tailor row being edited
  const [ovrPlan,   setOvrPlan]   = useState("")
  const [ovrMax,    setOvrMax]    = useState("")
  const [ovrOrd,    setOvrOrd]    = useState("")
  const [ovrFeats,  setOvrFeats]  = useState({})
  const [ovrShop,   setOvrShop]   = useState("")
  const [ovrLogo,   setOvrLogo]   = useState("")
  const [ovrLifetime, setOvrLifetime] = useState(false)
  const [ovrBusy,   setOvrBusy]   = useState(false)

  useEffect(() => { load() }, [])
  useEffect(() => {
    api.sbQ("plans", { query: "select=id,name,price_pkr&is_active=eq.true", order: "price_pkr.asc.nullsfirst" })
      .then(r => setAllPlans(Array.isArray(r.data) ? r.data : []))
  }, [api])

  function openOverride(t) {
    setOvrTarget(t)
    setOvrPlan(t.plan_id || "free")
    setOvrMax(t.override_max_customers ?? "")
    setOvrOrd(t.override_max_orders ?? "")
    setOvrFeats(t.override_features || {})
    setOvrShop(t.shop_name || t.display_name || "")
    setOvrLogo(t.logo_url || "")
    setOvrLifetime(!!t.is_lifetime)
  }

  async function saveOverride() {
    if (!ovrTarget) return
    if (ovrLogo.trim() && !/^https?:\/\//i.test(ovrLogo.trim()))
      return toast.error("Logo URL must start with http:// or https://")
    setOvrBusy(true)
    // Save shop name + logo (branding) alongside the limit overrides.
    const pr = await api.rpc("admin_update_tailor_profile", {
      p_target_user_id: ovrTarget.id,
      p_shop_name:      ovrShop.trim(),
      p_logo_url:       ovrLogo.trim(),
    })
    if (pr.error) { setOvrBusy(false); return toast.error(pr.error.message) }
    // Only send feature keys that are explicitly set; empty object = no feature override.
    const featObj = ovrFeats && Object.keys(ovrFeats).length ? ovrFeats : null
    const r = await api.rpc("admin_set_user_overrides", {
      p_target_user_id:         ovrTarget.id,
      p_override_max_customers: ovrMax === "" ? null : parseInt(ovrMax, 10),
      p_override_max_orders:    ovrOrd === "" ? null : parseInt(ovrOrd, 10),
      p_override_features:      featObj,
      p_plan_id:                ovrPlan || null,
    })
    if (r.error) { setOvrBusy(false); return toast.error(r.error.message) }

    // Apply lifetime grant/revoke. Runs after the plan is set so the chosen
    // plan is what becomes lifetime. Only call when the state actually changed
    // OR lifetime is on (so plan changes propagate to the no-expiry sub).
    const wasLifetime = !!ovrTarget.is_lifetime
    if (ovrLifetime || ovrLifetime !== wasLifetime) {
      const lr = await api.rpc("admin_set_lifetime", {
        p_target_user_id: ovrTarget.id,
        p_plan_id:        ovrPlan || null,
        p_on:             ovrLifetime,
      })
      if (lr.error) { setOvrBusy(false); return toast.error(lr.error.message) }
    }

    setOvrBusy(false)
    toast.success("Plan & limits saved for " + (ovrTarget.display_name || "tailor"))
    setOvrTarget(null)
    load()
  }

  async function load() {
    setLoading(true)
    const r = await api.rpc("admin_list_users_with_plan")
    setTailors(Array.isArray(r.data) ? r.data : [])
    setLoading(false)
  }

  const searched = tailors.filter(t => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (t.display_name || "").toLowerCase().includes(q) ||
      (t.phone || "").includes(q) ||
      (t.email || "").toLowerCase().includes(q)
    )
  })

  const paidCount = tailors.filter(t => t.is_paid).length
  const freeCount = tailors.length - paidCount

  const filtered = searched.filter(t =>
    planTab === "all" ? true : planTab === "paid" ? t.is_paid : !t.is_paid
  )

  async function confirmImpersonate() {
    if (!impTarget) return
    setImpBusy(true)
    const r = await api.fn("admin-impersonate", { target_user_id: impTarget.id })
    setImpBusy(false)
    if (r.error) { toast.error(r.error.message); return }
    if (r.data?.token_hash) {
      // Token goes in the URL hash (not query) so it isn't sent to servers/logged.
      const url = `${window.location.origin}/impersonate#token_hash=${encodeURIComponent(r.data.token_hash)}`
      window.open(url, "_blank", "noopener")
      toast.success("Opening session as " + impTarget.display)
      setImpTarget(null)
    } else {
      toast.error(r.data?.error || "Could not start session for this tailor.")
    }
  }

  async function confirmDeleteTailor() {
    if (!delTarget) return
    setDelBusy(true)
    const r = await api.fn("delete-tailor", { target_user_id: delTarget.id })
    setDelBusy(false)
    setDelTarget(null)
    if (r.error) return toast.error(r.error.message)
    toast.success((delTarget.display || "Tailor") + " deleted")
    load()
  }

  async function savePassword() {
    if (!newPwd || newPwd.length < 8) return toast.error("Password must be at least 8 characters")
    setPwdBusy(true)
    const r = await api.rpc("admin_set_user_password", { target_user_id: pwdTarget.id, new_password: newPwd })
    setPwdBusy(false)
    if (r.error) return toast.error(r.error.message)
    toast.success("Password updated")
    setPwdTarget(null); setNewPwd("")
  }

  async function confirmBan() {
    if (!banTarget) return
    setBanBusy(true)
    const r = await api.rpc("admin_set_user_banned", { target_user_id: banTarget.id, banned: !banTarget.banned })
    setBanBusy(false)
    setBanTarget(null)
    if (r.error) return toast.error(r.error.message)
    toast.success(banTarget.banned ? "Account re-enabled" : "Account disabled")
    load()
  }

  function isBanned(t) {
    return !!(t.banned_until && new Date(t.banned_until) > new Date())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search by name, phone or email…" value={search}
          onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Button className="ml-auto gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New account
        </Button>
      </div>

      {/* Free / Paid sub-tabs (shadcn) */}
      <Tabs value={planTab} onValueChange={setPlanTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            All <span className="rounded-full bg-muted px-1.5 text-[11px] font-bold">{tailors.length}</span>
          </TabsTrigger>
          <TabsTrigger value="paid" className="gap-1.5">
            Paid <span className="rounded-full bg-emerald-100 px-1.5 text-[11px] font-bold text-emerald-800">{paidCount}</span>
          </TabsTrigger>
          <TabsTrigger value="free" className="gap-1.5">
            Free <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-800">{freeCount}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <TableSkeleton /> : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No tailor accounts" hint="No tailors match this filter." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last sign in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(t => {
                const banned = isBanned(t)
                const login  = t.phone
                  ? "0" + String(t.phone).replace(/^92/, "")
                  : (t.email || "—")
                return (
                  <TableRow key={t.id} className={banned ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{t.display_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{login}</TableCell>
                    <TableCell>
                      {t.is_lifetime
                        ? <ToneBadge tone="violet" className="uppercase">{(t.plan_id || "pro") + " · lifetime"}</ToneBadge>
                        : t.is_paid
                        ? <ToneBadge tone="green" className="uppercase">{t.plan_id || "paid"}</ToneBadge>
                        : <ToneBadge tone="amber">free</ToneBadge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {t.last_sign_in_at ? fmtDateTime(t.last_sign_in_at) : "—"}
                    </TableCell>
                    <TableCell>
                      {banned
                        ? <ToneBadge tone="red">disabled</ToneBadge>
                        : <ToneBadge tone="green">active</ToneBadge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1 px-2">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel className="truncate">{t.display_name || login}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => afterMenuClose(() => setImpTarget({ id: t.id, display: t.display_name || login }))}>
                            <LogIn className="h-3.5 w-3.5" /> Login as
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => afterMenuClose(() => { setPwdTarget({ id: t.id, display: t.display_name || login }); setNewPwd("") })}>
                            <KeyRound className="h-3.5 w-3.5" /> Change password
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => afterMenuClose(() => openOverride({ ...t, display_name: t.display_name || login }))}>
                            <SlidersHorizontal className="h-3.5 w-3.5" /> Custom limits
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className={banned ? "text-emerald-700 focus:text-emerald-700" : "text-amber-700 focus:text-amber-700"}
                            onSelect={() => afterMenuClose(() => setBanTarget({ id: t.id, display: t.display_name || login, banned }))}>
                            {banned ? <UserCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                            {banned ? "Enable account" : "Disable account"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => afterMenuClose(() => setDelTarget({ id: t.id, display: t.display_name || login }))}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete tailor
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create account dialog */}
      <Dialog open={createOpen} onOpenChange={o => { if (!o) setCreateOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New tailor account</DialogTitle>
            <DialogDescription>Created immediately, no verification needed. Share the credentials with the tailor.</DialogDescription>
          </DialogHeader>
          <CreateAccountForm api={api} onCreated={() => { setCreateOpen(false); load() }} inline />
        </DialogContent>
      </Dialog>

      {/* Change password dialog */}
      <Dialog open={!!pwdTarget} onOpenChange={o => { if (!o) { setPwdTarget(null); setNewPwd("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>{pwdTarget?.display}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="tp-pwd">New password</Label>
            <Input id="tp-pwd" value={newPwd} onChange={e => setNewPwd(e.target.value)}
              placeholder="min 8 characters" type="password" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwdTarget(null); setNewPwd("") }}>Cancel</Button>
            <Button disabled={pwdBusy} onClick={savePassword}>
              {pwdBusy ? "Saving…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login-as (impersonate) confirm */}
      <Dialog open={!!impTarget} onOpenChange={o => { if (!o) setImpTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Log in as this tailor?</DialogTitle>
            <DialogDescription>
              A new tab will open signed in as <strong>{impTarget?.display}</strong>. This action is recorded in the audit log. The tailor's own session is not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImpTarget(null)}>Cancel</Button>
            <Button disabled={impBusy} onClick={confirmImpersonate} className="gap-1.5">
              <LogIn className="h-3.5 w-3.5" />
              {impBusy ? "Starting…" : "Open session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable / enable confirm */}
      <Dialog open={!!banTarget} onOpenChange={o => { if (!o) setBanTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{banTarget?.banned ? "Re-enable account?" : "Disable account?"}</DialogTitle>
            <DialogDescription>
              {banTarget?.banned
                ? `${banTarget?.display} will be able to sign in again.`
                : `${banTarget?.display} will be blocked from signing in.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)}>Cancel</Button>
            <Button variant={banTarget?.banned ? "default" : "destructive"} disabled={banBusy} onClick={confirmBan}>
              {banBusy ? "Working…" : banTarget?.banned ? "Re-enable" : "Disable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete tailor confirm */}
      <Dialog open={!!delTarget} onOpenChange={o => { if (!o) setDelTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this tailor?</DialogTitle>
            <DialogDescription>
              <strong>{delTarget?.display}</strong> and all of their data (customers, orders,
              measurements, sessions) will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={delBusy} onClick={confirmDeleteTailor} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              {delBusy ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-user custom overrides */}
      <Dialog open={!!ovrTarget} onOpenChange={o => { if (!o) setOvrTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom limits</DialogTitle>
            <DialogDescription>
              Override the plan for <strong>{ovrTarget?.display_name}</strong>. These win over their
              plan’s defaults. Leave a field blank to fall back to the plan value.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Plan assignment — this is what unlocks features for the tailor */}
            <div className="space-y-1.5 rounded-lg border p-3">
              <Label htmlFor="ovr-plan" className="text-xs">Plan</Label>
              <select id="ovr-plan" value={ovrPlan} onChange={e => setOvrPlan(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                {allPlans.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.price_pkr ? ` — PKR ${Number(p.price_pkr).toLocaleString()}/mo` : " — Free"}
                  </option>
                ))}
              </select>
              {(() => {
                const p = allPlans.find(x => x.id === ovrPlan)
                const feats = PLAN_FEATURES.filter(f => featureSummary(p?.features, f.key))
                  .map(f => `${f.label} (${featureSummary(p?.features, f.key)})`)
                return (
                  <p className="text-xs text-muted-foreground">
                    {feats.length ? "Unlocks: " + feats.join(", ") : "No premium features on this plan."}
                  </p>
                )
              })()}
            </div>

            {/* Branding */}
            <div className="space-y-3 rounded-lg border p-3">
              <Label className="text-xs">Shop branding</Label>
              <div className="space-y-1.5">
                <Label htmlFor="ovr-shop" className="text-xs font-normal text-muted-foreground">Shop name</Label>
                <Input id="ovr-shop" value={ovrShop} onChange={e => setOvrShop(e.target.value)} placeholder="e.g. Saifi Tailors" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ovr-logo" className="text-xs font-normal text-muted-foreground">Logo URL</Label>
                <div className="flex items-center gap-2">
                  {ovrLogo.trim() && /^https?:\/\//i.test(ovrLogo.trim()) && (
                    <img src={ovrLogo.trim()} alt="" className="h-9 w-9 rounded border object-contain"
                      onError={e => { e.currentTarget.style.display = "none" }} />
                  )}
                  <Input id="ovr-logo" type="url" value={ovrLogo} onChange={e => setOvrLogo(e.target.value)} placeholder="https://…/logo.png" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ovr-max">Max customers</Label>
                <Input id="ovr-max" type="number" min="0" value={ovrMax}
                  onChange={e => setOvrMax(e.target.value)} placeholder="Use plan" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ovr-ord">Max orders</Label>
                <Input id="ovr-ord" type="number" min="0" value={ovrOrd}
                  onChange={e => setOvrOrd(e.target.value)} placeholder="Use plan" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">Blank = fall back to the plan value.</p>
            <div className="space-y-3 rounded-lg border p-3">
              <Label className="text-xs">Feature overrides</Label>
              {PLAN_FEATURES.map(f => {
                const set = Object.prototype.hasOwnProperty.call(ovrFeats, f.key)
                // current state: "plan" (no override) | "on" | "off"
                const state = !set ? "plan" : (ovrFeats[f.key] ? "on" : "off")
                function setState(next) {
                  setOvrFeats(prev => {
                    const obj = { ...prev }
                    if (next === "plan") delete obj[f.key]
                    else obj[f.key] = next === "on"
                    return obj
                  })
                }
                const opts = [
                  { v: "plan", label: "Use plan" },
                  { v: "on",   label: "On" },
                  { v: "off",  label: "Off" },
                ]
                return (
                  <div key={f.key} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{f.label}</div>
                      <div className="text-xs text-muted-foreground">{f.hint}</div>
                    </div>
                    <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                      {opts.map(o => (
                        <button key={o.v} type="button" onClick={() => setState(o.v)}
                          className={
                            "rounded px-2.5 py-1 text-xs font-medium transition-colors " +
                            (state === o.v
                              ? (o.v === "off"
                                  ? "bg-destructive text-destructive-foreground"
                                  : "bg-primary text-primary-foreground")
                              : "text-muted-foreground hover:text-foreground")
                          }>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Per-tailor report tab overrides — choose exactly which Report
                  tabs this tailor can see, regardless of their plan. */}
              <div className="space-y-2 border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground">Report tabs for this tailor</div>
                {REPORT_TAB_FEATURES.map(f => {
                  const set = Object.prototype.hasOwnProperty.call(ovrFeats, f.key)
                  const state = !set ? "plan" : (ovrFeats[f.key] ? "on" : "off")
                  function setState(next) {
                    setOvrFeats(prev => {
                      const obj = { ...prev }
                      if (next === "plan") delete obj[f.key]
                      else obj[f.key] = next === "on"
                      return obj
                    })
                  }
                  const opts = [
                    { v: "plan", label: "Use plan" },
                    { v: "on",   label: "On" },
                    { v: "off",  label: "Off" },
                  ]
                  return (
                    <div key={f.key} className="flex items-center justify-between gap-3 pl-1">
                      <span className="text-sm">{f.label}</span>
                      <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                        {opts.map(o => (
                          <button key={o.v} type="button" onClick={() => setState(o.v)}
                            className={
                              "rounded px-2.5 py-1 text-xs font-medium transition-colors " +
                              (state === o.v
                                ? (o.v === "off"
                                    ? "bg-destructive text-destructive-foreground"
                                    : "bg-primary text-primary-foreground")
                                : "text-muted-foreground hover:text-foreground")
                            }>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-muted-foreground">
                  “Use plan” follows the plan’s report-tab settings. On/Off overrides it for this tailor only.
                </p>
              </div>

              {/* Lifetime grant — never-expiring access to the selected plan */}
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    Lifetime access
                    {ovrLifetime && <ToneBadge tone="violet">on</ToneBadge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Grants the selected plan with no expiry. Shows as “Lifetime” on the tailor’s billing.
                  </div>
                </div>
                <Switch checked={ovrLifetime} onCheckedChange={setOvrLifetime} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOvrTarget(null)}>Cancel</Button>
            <Button disabled={ovrBusy} onClick={saveOverride}>
              {ovrBusy ? "Saving…" : "Save limits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Plans CRUD ────────────────────────────────────────────────────────────
// Feature keys offered as toggles in the plan editor. Add more here as the
// app grows; the value is stored in plans.features jsonb.
const PLAN_FEATURES = [
  { key: "karigar", label: "Karigar", hint: "Manage tailors/craftsmen & payments" },
  { key: "reports", label: "Reporting", hint: "Reports & analytics pages" },
]

// Report sub-tabs, stored in the same features jsonb as reports_<tab>.
// When a key is absent the tab inherits the parent `reports` flag, so existing
// plans keep working. Toggle these per-plan and per-tailor to control exactly
// which Report tabs a tailor can open.
const REPORT_TAB_FEATURES = [
  { key: "reports_revenue",   label: "Revenue tab"   },
  { key: "reports_orders",    label: "Orders tab"    },
  { key: "reports_customers", label: "Customers tab" },
  { key: "reports_karigar",   label: "Karigar tab"   },
]

// Features are stored per-plan as either a legacy boolean ({"karigar": true})
// or the richer object form ({"karigar": {"enabled": false, "trial_visits": 3}}).
// These helpers normalize both directions.
function readFeature(features, key) {
  const node = features?.[key]
  if (node == null) return { enabled: false, trial: "" }
  if (typeof node === "boolean") return { enabled: node, trial: "" }
  return {
    enabled: node.enabled === true,
    trial: (node.trial_visits == null || node.trial_visits === "") ? "" : node.trial_visits,
  }
}
function buildFeatures(state) {
  // state: { [key]: { enabled: bool, trial: "" | number } }
  const out = {}
  for (const f of PLAN_FEATURES) {
    const s = state[f.key] || { enabled: false, trial: "" }
    const node = { enabled: !!s.enabled }
    if (!s.enabled && s.trial !== "" && Number(s.trial) > 0) {
      node.trial_visits = parseInt(s.trial, 10)
    }
    out[f.key] = node
  }
  // Report sub-tabs — simple enabled flags.
  for (const f of REPORT_TAB_FEATURES) {
    const s = state[f.key] || { enabled: false }
    out[f.key] = { enabled: !!s.enabled }
  }
  return out
}
function featureSummary(features, key) {
  const { enabled, trial } = readFeature(features, key)
  if (enabled) return "on"
  if (trial !== "" && Number(trial) > 0) return `trial ${trial}`
  return null
}

function PlansCRUD({ api }) {
  const [plans,   setPlans]   = useState([])
  const [loading, setLoading] = useState(true)

  const [open,    setOpen]    = useState(false)
  const [editId,  setEditId]  = useState(null)   // null = new
  const [id,      setId]      = useState("")
  const [name,    setName]    = useState("")
  const [price,   setPrice]   = useState("")
  const [maxCust, setMaxCust] = useState("")     // blank = unlimited
  const [maxKar,  setMaxKar]  = useState("")     // blank = unlimited
  const [maxOrd,  setMaxOrd]  = useState("")     // blank = unlimited
  // feats: { [key]: { enabled, trial } }
  const [feats,   setFeats]   = useState({})
  const [saving,  setSaving]  = useState(false)

  const [delTarget, setDelTarget] = useState(null)
  const [delBusy,   setDelBusy]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const r = await api.rpc("admin_list_plans")
    setPlans(Array.isArray(r.data) ? r.data : [])
    setLoading(false)
  }

  function featStateFrom(features) {
    const st = {}
    for (const f of PLAN_FEATURES) st[f.key] = readFeature(features, f.key)
    // Report sub-tabs: if the key is absent, inherit the parent reports flag so
    // existing plans behave exactly as before (all tabs follow Reporting).
    const reportsOn = readFeature(features, "reports").enabled
    for (const f of REPORT_TAB_FEATURES) {
      const node = features?.[f.key]
      const enabled = node == null ? reportsOn
        : (typeof node === "boolean" ? node : node.enabled === true)
      st[f.key] = { enabled, trial: "" }
    }
    return st
  }
  function openAdd() {
    setEditId(null); setId(""); setName(""); setPrice(""); setMaxCust("")
    setMaxKar(""); setMaxOrd("")
    setFeats(featStateFrom({ karigar: { enabled: false, trial_visits: 3 }, reports: { enabled: true } }))
    setOpen(true)
  }
  function openEdit(p) {
    setEditId(p.id); setId(p.id); setName(p.name || "")
    setPrice(p.price_pkr ?? ""); setMaxCust(p.max_customers ?? "")
    setMaxKar(p.max_karigars ?? ""); setMaxOrd(p.max_orders ?? "")
    setFeats(featStateFrom(p.features || {})); setOpen(true)
  }

  async function save() {
    const pid = id.trim().toLowerCase()
    if (!pid)         return toast.error("Plan id is required (e.g. pro)")
    if (!name.trim()) return toast.error("Plan name is required")
    if (!/^[a-z0-9_]+$/.test(pid)) return toast.error("Plan id: lowercase letters, numbers, underscore only")
    setSaving(true)
    const r = await api.rpc("admin_upsert_plan", {
      p_id:            pid,
      p_name:          name.trim(),
      p_price_pkr:     price === "" ? null : Number(price),
      p_max_customers: maxCust === "" ? null : parseInt(maxCust, 10),
      p_max_karigars:  maxKar === "" ? null : parseInt(maxKar, 10),
      p_max_orders:    maxOrd === "" ? null : parseInt(maxOrd, 10),
      p_features:      buildFeatures(feats),
    })
    setSaving(false)
    if (r.error) return toast.error(r.error.message)
    toast.success(editId ? "Plan updated" : "Plan created")
    setOpen(false); load()
  }

  async function confirmDelete() {
    if (!delTarget) return
    setDelBusy(true)
    const r = await api.rpc("admin_delete_plan", { p_id: delTarget.id })
    setDelBusy(false); setDelTarget(null)
    if (r.error) return toast.error(r.error.message)
    toast.success("Plan deleted")
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Define the plans tailors can be on. Limits and features here apply to everyone on the plan;
          individual tailors can be given custom overrides from the Tailors tab.
        </p>
        <Button className="ml-auto gap-1.5 shrink-0" onClick={openAdd}>
          <Plus className="h-4 w-4" /> New plan
        </Button>
      </div>

      {loading ? <TableSkeleton /> : plans.length === 0 ? (
        <EmptyState icon={Layers} title="No plans yet" hint="Create your first plan to get started." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Max customers</TableHead>
                <TableHead>Max karigars</TableHead>
                <TableHead>Max orders</TableHead>
                <TableHead>Features</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.id}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.price_pkr ? `PKR ${Number(p.price_pkr).toLocaleString()}/mo` : "Free"}
                  </TableCell>
                  <TableCell>{p.max_customers == null ? "Unlimited" : p.max_customers}</TableCell>
                  <TableCell>{p.max_karigars == null ? "Unlimited" : p.max_karigars}</TableCell>
                  <TableCell>{p.max_orders == null ? "Unlimited" : p.max_orders}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {PLAN_FEATURES.map(f => {
                        const sum = featureSummary(p.features, f.key)
                        if (!sum) return null
                        return (
                          <Badge key={f.key} variant={sum === "on" ? "secondary" : "outline"}>
                            {f.label}{sum === "on" ? "" : ` · ${sum}`}
                          </Badge>
                        )
                      })}
                      {PLAN_FEATURES.every(f => !featureSummary(p.features, f.key)) && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {p.id !== "free" && (
                        <Button size="sm" variant="outline"
                          className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDelTarget(p)}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit plan dialog */}
      <Dialog open={open} onOpenChange={o => { if (!o) setOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit plan" : "New plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pl-id">Plan id <span className="text-destructive">*</span></Label>
                <Input id="pl-id" value={id} disabled={!!editId}
                  onChange={e => setId(e.target.value)} placeholder="pro" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-name">Name <span className="text-destructive">*</span></Label>
                <Input id="pl-name" value={name} onChange={e => setName(e.target.value)} placeholder="Pro" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pl-price">Price (PKR/mo)</Label>
                <Input id="pl-price" type="number" min="0" value={price}
                  onChange={e => setPrice(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-max">Max customers</Label>
                <Input id="pl-max" type="number" min="0" value={maxCust}
                  onChange={e => setMaxCust(e.target.value)} placeholder="∞" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-kar">Max karigars</Label>
                <Input id="pl-kar" type="number" min="0" value={maxKar}
                  onChange={e => setMaxKar(e.target.value)} placeholder="∞" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pl-ord">Max orders</Label>
                <Input id="pl-ord" type="number" min="0" value={maxOrd}
                  onChange={e => setMaxOrd(e.target.value)} placeholder="∞" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">Leave a limit blank for unlimited.</p>
            <div className="space-y-3 rounded-lg border p-3">
              <Label className="text-xs">Features &amp; trial access</Label>
              {PLAN_FEATURES.map(f => {
                const st = feats[f.key] || { enabled: false, trial: "" }
                const setField = patch => setFeats(prev => ({ ...prev, [f.key]: { ...st, ...patch } }))
                return (
                  <div key={f.key} className="rounded-md border p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{f.label}</div>
                        <div className="text-xs text-muted-foreground">{f.hint}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{st.enabled ? "Included" : "Locked"}</span>
                        <Switch checked={!!st.enabled} onCheckedChange={v => setField({ enabled: v })} />
                      </div>
                    </div>
                    {!st.enabled && (
                      <div className="mt-2 flex items-center gap-2 border-t pt-2">
                        <Label htmlFor={"tv-" + f.key} className="text-xs text-muted-foreground flex-1">
                          Free trial visits before lock
                        </Label>
                        <Input id={"tv-" + f.key} type="number" min="0" className="h-8 w-20"
                          value={st.trial} placeholder="0"
                          onChange={e => setField({ trial: e.target.value })} />
                      </div>
                    )}

                    {/* Report sub-tabs — only relevant for the Reporting feature */}
                    {f.key === "reports" && (
                      <div className="mt-2 space-y-2 border-t pt-2">
                        <div className="text-xs font-medium text-muted-foreground">Visible report tabs</div>
                        {REPORT_TAB_FEATURES.map(rt => {
                          const rst = feats[rt.key] || { enabled: false }
                          const setRt = v => setFeats(prev => ({ ...prev, [rt.key]: { enabled: v } }))
                          return (
                            <div key={rt.key} className="flex items-center justify-between gap-3 pl-1">
                              <span className="text-sm">{rt.label}</span>
                              <Switch checked={!!rst.enabled} onCheckedChange={setRt} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              <p className="text-xs text-muted-foreground">
                When a feature is locked, the tailor can open it a few times (trial visits) to preview it,
                then it locks permanently with an upgrade prompt. Set 0 to lock immediately.
                Use the report-tab switches to control exactly which Report tabs the plan can open.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editId ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!delTarget} onOpenChange={o => { if (!o) setDelTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{delTarget?.name}”?</DialogTitle>
            <DialogDescription>
              You can only delete a plan with no active subscribers. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={delBusy} onClick={confirmDelete}>
              {delBusy ? "Deleting…" : "Delete plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Reports ────────────────────────────────────────────────────────────────
function fmtPkr(n) {
  return "PKR " + Number(n || 0).toLocaleString()
}

function StatCard({ icon: Icon, label, value, sub, tone = "default" }) {
  const tones = {
    default: "text-foreground",
    green:   "text-emerald-700",
    amber:   "text-amber-700",
    red:     "text-red-700",
    blue:    "text-blue-700",
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {Icon && <Icon className="h-3.5 w-3.5" />} {label}
        </div>
        <div className={"mt-1.5 text-2xl font-bold tracking-tight " + (tones[tone] || tones.default)}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function ReportsTab({ api }) {
  const [m,       setM]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api.rpc("admin_report_metrics").then(r => {
      if (!alive) return
      setM(r.error ? null : (r.data || null))
      setLoading(false)
    })
    return () => { alive = false }
  }, [api])

  if (loading) return <TableSkeleton />
  if (!m) return <EmptyState icon={BarChart3} title="No report data" hint="Could not load metrics." />

  const signups = (m.signups_by_month || []).map(x => ({ name: x.month, count: Number(x.count) }))
  const revenue = (m.revenue_by_month || []).map(x => ({ name: x.month, amount: Number(x.amount) }))
  const plans   = (m.plan_breakdown || [])

  return (
    <div className="space-y-6">
      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={Users}      label="Tailors onboarded" value={m.onboarded_total}
          sub={`+${m.onboarded_30d} in 30 days`} />
        <StatCard icon={UserCheck}  label="Active (30d)"       value={m.active} tone="green" />
        <StatCard icon={UserX}      label="Inactive"           value={m.inactive} tone="amber" />
        <StatCard icon={ShieldCheck} label="Disabled"          value={m.banned} tone="red" />
        <StatCard icon={DollarSign} label="Revenue (total)"    value={fmtPkr(m.revenue_total)} tone="green"
          sub={`${fmtPkr(m.revenue_30d)} in 30 days`} />
        <StatCard icon={TrendingUp} label="MRR"                value={fmtPkr(m.mrr)} tone="blue" />
        <StatCard icon={CheckCircle2} label="Paid subscribers" value={m.paid_active} tone="green"
          sub={`${m.free} free`} />
        <StatCard icon={Inbox}      label="Pending payments"   value={m.pending_payments} tone="amber" />
        <StatCard icon={BookUser}   label="Customers"          value={m.total_customers} />
        <StatCard icon={Receipt}    label="Orders"             value={m.total_orders} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sign-ups · last 6 months</CardTitle>
          </CardHeader>
          <CardContent>
            {signups.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={signups}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2B5740" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue · last 6 months (PKR)</CardTitle>
          </CardHeader>
          <CardContent>
            {revenue.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={revenue}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={v => fmtPkr(v)} />
                  <Line type="monotone" dataKey="amount" stroke="#375FA0" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Active plan breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active subscriptions.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {plans.map(p => (
                <div key={p.plan_id} className="rounded-lg border px-4 py-2">
                  <div className="text-xs uppercase text-muted-foreground">{p.plan_id}</div>
                  <div className="text-xl font-bold">{p.count}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Login sessions ─────────────────────────────────────────────────────────
function DeviceIcon({ type }) {
  if (type === "mobile") return <Smartphone className="h-4 w-4 text-muted-foreground" />
  if (type === "tablet") return <Tablet className="h-4 w-4 text-muted-foreground" />
  return <Monitor className="h-4 w-4 text-muted-foreground" />
}

function SessionsTab({ api }) {
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState("")
  const [openId,   setOpenId]   = useState(null)
  const [del,      setDel]      = useState(null)   // { mode: "one"|"all", session }
  const [delBusy,  setDelBusy]  = useState(false)

  async function load() {
    setLoading(true)
    const r = await api.rpc("admin_list_login_sessions")
    setSessions(Array.isArray(r.data) ? r.data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDelete() {
    if (!del) return
    setDelBusy(true)
    const r = del.mode === "all"
      ? await api.rpc("admin_delete_user_sessions", { p_user_id: del.session.user_id })
      : await api.rpc("admin_delete_login_session", { p_id: del.session.id })
    setDelBusy(false); setDel(null)
    if (r.error) return toast.error(r.error.message)
    toast.success(del.mode === "all" ? "All sessions for this tailor deleted" : "Session deleted")
    load()
  }

  const filtered = sessions.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (s.display_name || "").toLowerCase().includes(q) ||
      (s.login || "").toLowerCase().includes(q) ||
      (s.device_name || "").toLowerCase().includes(q) ||
      (s.model || "").toLowerCase().includes(q) ||
      (s.make || "").toLowerCase().includes(q) ||
      (s.city || "").toLowerCase().includes(q) ||
      (s.country || "").toLowerCase().includes(q) ||
      (s.ip || "").toLowerCase().includes(q)
    )
  })

  function locStr(s) {
    return [s.city, s.region, s.country].filter(Boolean).join(", ")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search by tailor, device, location or IP…" value={search}
          onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} sessions</span>
      </div>

      {loading ? <TableSkeleton /> : filtered.length === 0 ? (
        <EmptyState icon={MonitorSmartphone} title="No login sessions yet"
          hint="Devices are recorded the next time a tailor signs in." />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Tailor</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Browser</TableHead>
                <TableHead className="text-right">Last seen</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                const open = openId === s.id
                return (
                  <>
                    <TableRow key={s.id} className="cursor-pointer"
                      onClick={() => setOpenId(open ? null : s.id)}>
                      <TableCell className="text-muted-foreground">
                        <ChevronRight className={"h-4 w-4 transition-transform " + (open ? "rotate-90" : "")} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{s.display_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{s.login}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <DeviceIcon type={s.device_type} />
                          <span>{s.device_name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {locStr(s) || <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.ip || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.browser || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-muted-foreground">{fmtDateTime(s.last_seen_at)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Session actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem className="text-destructive focus:text-destructive"
                              onSelect={() => afterMenuClose(() => setDel({ mode: "one", session: s }))}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete this session
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive"
                              onSelect={() => afterMenuClose(() => setDel({ mode: "all", session: s }))}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete all for this tailor
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow key={s.id + "-d"} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={8} className="py-3">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
                            <DetailField label="Make / Model" value={[s.make, s.model].filter(Boolean).join(" ")} />
                            <DetailField label="Platform / OS" value={s.platform} />
                            <DetailField label="Browser" value={s.browser} />
                            <DetailField label="Device type" value={s.device_type} />
                            <DetailField label="IP address" value={s.ip} mono />
                            <DetailField label="ISP / Org" value={s.isp} />
                            <DetailField label="City" value={s.city} />
                            <DetailField label="Region" value={s.region} />
                            <DetailField label="Country" value={s.country} />
                            <DetailField label="Timezone" value={s.timezone} />
                            <DetailField label="Languages" value={s.languages} />
                            <DetailField label="Screen" value={s.screen} />
                            <DetailField label="Viewport" value={s.viewport} />
                            <DetailField label="CPU cores" value={s.cpu_cores} />
                            <DetailField label="Memory (GB)" value={s.device_memory} />
                            <DetailField label="Touch" value={s.touch == null ? null : (s.touch ? "Yes" : "No")} />
                            <DetailField label="GPU" value={s.gpu} className="col-span-2" />
                            <DetailField label="Device fingerprint" value={s.fingerprint} mono />
                            <DetailField label="First seen" value={s.created_at ? fmtDateTime(s.created_at) : null} />
                            <DetailField label="User agent" value={s.user_agent} className="col-span-2 lg:col-span-4" mono small />
                          </div>
                          <div className="mt-3 flex justify-end border-t pt-3">
                            <Button size="sm" variant="outline"
                              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDel({ mode: "one", session: s })}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete this session
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete session confirm */}
      <Dialog open={!!del} onOpenChange={o => { if (!o) setDel(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{del?.mode === "all" ? "Delete all sessions?" : "Delete this session?"}</DialogTitle>
            <DialogDescription>
              {del?.mode === "all"
                ? <>Every recorded login session for <strong>{del?.session?.display_name || del?.session?.login}</strong> will be removed. This cannot be undone.</>
                : <>This login session record will be permanently removed. This cannot be undone.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)}>Cancel</Button>
            <Button variant="destructive" disabled={delBusy} onClick={confirmDelete} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              {delBusy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailField({ label, value, mono = false, small = false, className = "" }) {
  return (
    <div className={className}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={
        "mt-0.5 break-words " +
        (small ? "text-[11px] " : "text-sm ") +
        (mono ? "font-mono " : "") +
        (value == null || value === "" ? "text-muted-foreground/50" : "text-foreground")
      }>
        {value == null || value === "" ? "—" : String(value)}
      </div>
    </div>
  )
}
