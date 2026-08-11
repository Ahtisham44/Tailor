import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useSubscription } from "@/hooks/useSubscription"
import { toast } from "sonner"
import {
  Landmark, Smartphone, Wallet, Upload, Hourglass, BadgeCheck, Infinity as InfinityIcon,
  Check, Clock, Lock, Users, FileText, Scissors, BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent } from "@/components/ui/card"

// Update these to your real receiving accounts.
const PAY_TO = {
  bank:      { label: "Bank Transfer", detail: "Meezan Bank · Ahtisham Jilani · ACC 02700104068764", icon: Landmark },  
  easypaisa: { label: "EasyPaisa",     detail: "03226247462 (Ehtisham Jilani)",              icon: Wallet },
  jazzcash:  { label: "Nayapay",      detail: "03226247462 (Ahtisham Jilani)",              icon: Smartphone },
}

// Feature display config. `features` from a plan may be a legacy boolean or an
// object { enabled, trial_visits }. These helpers read both forms.
const FEATURE_META = [
  // { key: "karigar", label: "Karigar management", icon: Scissors },
  { key: "reports", label: "Reports & analytics", icon: BarChart3 },
]
function readFeat(features, key) {
  const node = features?.[key]
  if (node == null) return { enabled: false, trial: null }
  if (typeof node === "boolean") return { enabled: node, trial: null }
  const t = (node.trial_visits == null || node.trial_visits === "") ? null : Number(node.trial_visits)
  return { enabled: node.enabled === true, trial: t }
}

export default function BillingPage() {
  const { api, user } = useAuth()
  const {
    plan, sub, isAdmin, loading: subLoading, expired: subExpired,
    slotsUsed, maxCust, ordersUsed, maxOrders, refresh,
  } = useSubscription()

  const [plans,      setPlans]      = useState([])
  const [pending,    setPending]    = useState(null)
  const [method,     setMethod]     = useState("bank")
  const [reference,  setReference]  = useState("")
  const [file,       setFile]       = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [targetPlan, setTargetPlan] = useState("")   // plan id the user wants to buy

  useEffect(() => {
    api.sbQ("plans", { query: "select=*&is_active=eq.true", order: "price_pkr.asc.nullsfirst" })
      .then(r => setPlans(Array.isArray(r.data) ? r.data : []))
    api.sbQ("payment_requests", { query: "select=*&status=eq.pending", limit: 1 })
      .then(r => setPending((r.data && r.data[0]) || null))
  }, [api])

  const curId    = plan?.id || "free"
  const curPrice = plan?.price_pkr ? Number(plan.price_pkr) : 0
  // Plans the user can move to: priced higher than their current plan.
  const upgradePlans = plans.filter(p => Number(p.price_pkr || 0) > curPrice)
  // Default the selected target to the cheapest upgrade (or current plan if renewing).
  useEffect(() => {
    if (targetPlan) return
    if (upgradePlans.length) setTargetPlan(upgradePlans[0].id)
    else if (curId !== "free") setTargetPlan(curId)
  }, [upgradePlans, curId, targetPlan])

  const chosen   = plans.find(p => p.id === targetPlan)
  const isPaidNow = curId !== "free" && !subExpired
  const expired  = curId !== "free" && subExpired
  // Lifetime = active paid plan with no expiry (null) OR a far-future sentinel date.
  const isLifetime = isPaidNow && sub?.status !== "canceled" && (
    sub?.current_period_end == null ||
    new Date(sub.current_period_end).getFullYear() >= 2900
  )

  async function submit(e) {
    e.preventDefault()
    if (!chosen) return toast.error("Choose a plan")
    if (!reference.trim()) return toast.error("Enter the transaction reference / ID")
    setSubmitting(true)

    let path = null
    if (file) {
      const ext = file.name.split(".").pop()
      path = `${user.id}/${Date.now()}.${ext}`
      const up = await api.uploadReceipt(path, file)
      if (up.error) { setSubmitting(false); return toast.error(up.error.message) }
    }

    const r = await api.sbQ("payment_requests", {
      method: "POST",
      body: [{
        plan_id: chosen.id,
        amount_pkr: chosen.price_pkr ?? null,
        method,
        reference_no: reference.trim(),
        receipt_path: path,
        status: "pending",
      }],
    })
    setSubmitting(false)
    if (r.error) return toast.error(r.error.message)
    toast.success(`Payment submitted — we'll verify and activate ${chosen.name} shortly.`)
    setReference(""); setFile(null)
    api.sbQ("payment_requests", { query: "select=*&status=eq.pending", limit: 1 })
      .then(rr => setPending((rr.data && rr.data[0]) || null))
    refresh()
  }

  // Limit rows for the current plan
  const limitRows = [
    { icon: Users,    label: "Customers", used: slotsUsed,  max: maxCust },
    { icon: FileText, label: "Orders",    used: ordersUsed, max: maxOrders },
  ]

  return (
    <div className="mx-auto max-w-2xl px-2 py-2">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Your current plan</h1>        
      </header>

      {/* ── Current plan ───────────────────────────────────────────────── */}
      {subLoading ? (
        <div className="space-y-3 rounded-lg border p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-regular">{plan?.name || "Free"} plan</span>
                {isLifetime ? (
                  <Badge variant="secondary" className="gap-1 rounded-full border-transparent shadow-none bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-900/40 dark:text-violet-300">
                    <BadgeCheck className="h-3 w-3" /> lifetime
                  </Badge>
                ) : isPaidNow ? (
                  <Badge variant="secondary" className="gap-1 rounded-full border-transparent shadow-none bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <BadgeCheck className="h-3 w-3" /> active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-full shadow-none">current</Badge>
                )}
              </div>
              {plan?.price_pkr
                ? <span className="text-xs text-muted-foreground">PKR {Number(plan.price_pkr).toLocaleString()}/mo</span>
                : <span className="text-xs text-muted-foreground">Free</span>}
            </div>

            {/* What's included — features + limits, straight from the plan */}
            <div className="mt-4 space-y-2">              
              <div className="flex gap-2 flex-col">
                {limitRows.map(r => (
                  <div key={r.label} className="flex items-center gap-2 border-b px-3 py-2 text-sm">
                    <r.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{r.label}:</span>
                    <span className="ml-auto font-medium">
                      {r.max == null ? <span className="inline-flex items-center gap-1"><InfinityIcon className="h-3.5 w-3.5" /></span> : `${r.used} / ${r.max}`}
                    </span>
                  </div>
                ))}
                {FEATURE_META.map(f => {
                  const { enabled, trial } = readFeat(plan?.features, f.key)
                  const Icon = f.icon
                  let tag, tone
                  if (isAdmin || enabled) { tag = <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Included</span>; tone = "text-emerald-700" }
                  else if (trial && trial > 0) { tag = <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {trial} free visit{trial === 1 ? "" : "s"}</span>; tone = "text-amber-700" }
                  else { tag = <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Locked</span>; tone = "text-muted-foreground" }
                  return (
                    <div key={f.key} className="flex items-center gap-2 border-b px-3 py-2 text-sm">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className={"ml-auto font-medium " + tone}>{tag}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {isLifetime && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 dark:border-violet-900/50 dark:bg-violet-900/20 dark:text-violet-300">
                <InfinityIcon className="h-4 w-4" />
                Lifetime access — your plan never expires.
              </div>
            )}

            {isPaidNow && !isLifetime && sub?.current_period_end && <PlanTimer sub={sub} />}

            {expired && (
              <p className="mt-3 text-sm font-medium text-destructive">
                Your {plan?.name} plan expired on {fmtDate(sub.current_period_end)}. Renew below to get it back.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Renew / upgrade ────────────────────────────────────────────── */}
      {!subLoading && (isPaidNow || upgradePlans.length > 0) && (
      <section className="mt-8">
        <h2 className="text-2xl font-semibold">
          {isPaidNow ? "Renew or change your plan" : "Upgrade your plan"}
        </h2>        

        {pending ? (
          <Card className="mt-4 border-amber-200 bg-amber-50/60">
            <CardContent className="flex items-start gap-3 pt-5">
              <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Payment under review</p>
                <p className="mt-1 text-sm text-amber-800">
                  We've received your payment{pending.reference_no ? <> (ref {pending.reference_no})</> : null} for
                  the <span className="font-medium uppercase">{pending.plan_id}</span> plan and will activate it after
                  verification — usually within a few hours.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-6">
            {/* plan picker */}
            <div className="space-y-2">
              <Label>Choose a plan</Label>
              <RadioGroup value={targetPlan} onValueChange={setTargetPlan} className="gap-2">
                {(() => {
                  const list = [...upgradePlans]
                  // allow renewing the current paid plan too
                  if (isPaidNow && !list.some(p => p.id === curId)) {
                    const cur = plans.find(p => p.id === curId)
                    if (cur) list.unshift(cur)
                  }
                  return list
                })().map(p => (
                    <Label key={p.id} htmlFor={"plan-" + p.id}
                      className={"flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal transition-colors " +
                        (targetPlan === p.id ? "border-primary bg-muted/50" : "hover:bg-muted/30")}>
                      <RadioGroupItem value={p.id} id={"plan-" + p.id} />
                      <span className="text-sm">
                        <span className="font-medium">{p.name}{p.id === curId ? " (renew)" : ""}</span>
                        <span className="text-muted-foreground"> — {featureBlurb(p)}</span>
                      </span>
                      <span className="ml-auto whitespace-nowrap text-sm font-semibold">
                        {p.price_pkr ? `PKR ${Number(p.price_pkr).toLocaleString()}/mo` : "Free"}
                      </span>
                    </Label>
                  ))}
              </RadioGroup>
            </div>

            {/* payment method */}
            <div className="space-y-2">
              <Label>Pay using</Label>
              <RadioGroup value={method} onValueChange={setMethod} className="gap-2">
                {Object.entries(PAY_TO).map(([k, v]) => {
                  const Icon = v.icon
                  return (
                    <Label key={k} htmlFor={"pay-" + k}
                      className={
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal transition-colors " +
                        (method === k ? "border-primary bg-muted/50" : "hover:bg-muted/30")
                      }>
                      <RadioGroupItem value={k} id={"pay-" + k} />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <span className="font-medium">{v.label}</span>
                        <span className="text-muted-foreground"> — {v.detail}</span>
                      </span>
                    </Label>
                  )
                })}
              </RadioGroup>
            </div>

            {/* reference */}
            <div className="space-y-2">
              <Label htmlFor="ref">Transaction reference / ID</Label>
              <Input id="ref" value={reference} onChange={e => setReference(e.target.value)}
                placeholder="e.g. TXN-839201" />
            </div>

            {/* receipt */}
            <div className="space-y-2">
              <Label htmlFor="receipt">Payment receipt <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <label htmlFor="receipt"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/30">
                <Upload className="h-4 w-4" />
                {file ? <span className="font-medium text-foreground">{file.name}</span> : "Tap to attach a screenshot or PDF"}
              </label>
              <input id="receipt" type="file" accept="image/*,application/pdf" className="sr-only"
                onChange={e => setFile(e.target.files[0])} />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={submitting || !chosen}>
              {submitting ? "Submitting…" : chosen ? `I've paid for ${chosen.name} — submit` : "I've paid — submit"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Your plan activates once we confirm the payment, usually within a few hours.
            </p>
          </form>
        )}
      </section>
      )}
    </div>
  )
}

// Short "what you get" blurb for a plan in the picker.
function featureBlurb(p) {
  const bits = []
  bits.push(p.max_customers == null ? "Unlimited customers" : `${p.max_customers} customers`)
  if (p.max_orders != null) bits.push(`${p.max_orders} orders`)
  for (const f of FEATURE_META) {
    const { enabled } = readFeat(p.features, f.key)
    if (enabled) bits.push(f.label)
  }
  return bits.join(" · ")
}

// ── Live countdown + progress for the current period ──────────────────────
function PlanTimer({ sub }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)  // tick every minute
    return () => clearInterval(t)
  }, [])

  const start = new Date(sub.created_at).getTime()
  const end   = new Date(sub.current_period_end).getTime()
  const msLeft = Math.max(0, end - now)
  const days  = Math.floor(msLeft / 86400000)
  const hours = Math.floor((msLeft % 86400000) / 3600000)
  const pct   = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  const warn  = days <= 7

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <span className={"text-2xl font-bold tabular-nums " + (warn ? "text-amber-600" : "text-emerald-600")}>
          {days}d {hours}h
        </span>
        <span className="text-xs text-muted-foreground">remaining</span>
      </div>
      <Progress value={pct} className="mt-2"
        indicatorClassName={warn ? "bg-amber-500" : "bg-emerald-500"} />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>Started {fmtDate(sub.created_at)}</span>
        <span>Renews by {fmtDate(sub.current_period_end)}</span>
      </div>
    </div>
  )
}

function fmtDate(d) {
  const dt = new Date(d)
  // Urdu: numeric DD MM YYYY, matching the same format used elsewhere in the app.
  if (typeof document !== "undefined" && document.documentElement.lang === "ur") {
    const dd = String(dt.getDate()).padStart(2, "0")
    const mm = String(dt.getMonth() + 1).padStart(2, "0")
    return `${dd} ${mm} ${dt.getFullYear()}`
  }
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}
