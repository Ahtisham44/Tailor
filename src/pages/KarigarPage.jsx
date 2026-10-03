import { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import { useSubscription } from "@/hooks/useSubscription"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { completedMonthPayable, money, monthBounds, monthKey, paymentMonths, previousMonth, undoSecondsRemaining } from "@/lib/karigarPayments"
import { urText } from "@/lib/i18n"
import { KARIGAR_PAYABLES_CHANGED } from "@/hooks/useKarigarPayables"
import PushReminderControl from "@/components/PushReminderControl"

// ── Simple recharts bar for earnings tab ──────────────────────────────────────
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

function paymentText(value) {
  return localStorage.getItem("ts_lang") === "ur" ? urText(value) : value
}

function monthLabel(month, short = false) {
  const date = new Date(`${month}-01T12:00:00Z`)
  const urdu = localStorage.getItem("ts_lang") === "ur"
  const monthName = date.toLocaleString(urdu ? "ur-PK" : "en-US", {
    month: urdu ? "long" : short ? "short" : "long", timeZone: "UTC",
  })
  return `${monthName} ${short ? month.slice(2, 4) : month.slice(0, 4)}`
}

export default function KarigarPage() {
  const { api } = useAuth()
  const { maxKarigars, karigarsUsed, atKarigarLimit } = useSubscription()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [karigars, setKarigars] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [allAssignments, setAllAssignments] = useState([])
  const [allPayouts, setAllPayouts] = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [ledgerError, setLedgerError] = useState(null)
  const [payingKey, setPayingKey] = useState(null)
  const [undoingId, setUndoingId] = useState(null)
  const [now, setNow] = useState(Date.now())
  const currentMonth = monthKey()
  const payableMonth = previousMonth(currentMonth)

  // Add/Edit dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [formName, setFormName] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formStatus, setFormStatus] = useState(true)
  const [formJoiningDate, setFormJoiningDate] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formSaving, setFormSaving] = useState(false)

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailKarigar, setDetailKarigar] = useState(null)
  const [detailTab, setDetailTab] = useState("profile")

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteName, setDeleteName] = useState("")

  const monthlyByKarigar = useMemo(() => {
    const groupedAssignments = new Map()
    const groupedPayouts = new Map()
    for (const assignment of allAssignments) {
      const key = String(assignment.karigar_id)
      if (!groupedAssignments.has(key)) groupedAssignments.set(key, [])
      groupedAssignments.get(key).push(assignment)
    }
    for (const payout of allPayouts) {
      const key = String(payout.karigar_id)
      if (!groupedPayouts.has(key)) groupedPayouts.set(key, [])
      groupedPayouts.get(key).push(payout)
    }
    return Object.fromEntries(karigars.map(k => [
      String(k.id), paymentMonths(groupedAssignments.get(String(k.id)) || [], groupedPayouts.get(String(k.id)) || [], currentMonth),
    ]))
  }, [karigars, allAssignments, allPayouts, currentMonth])

  const detailRows = useMemo(
    () => detailKarigar ? monthlyByKarigar[String(detailKarigar.id)] || [] : [],
    [detailKarigar, monthlyByKarigar]
  )
  const payableByKarigar = useMemo(() => Object.fromEntries(karigars.map(k => {
    const id = String(k.id)
    const payouts = allPayouts.filter(p => String(p.karigar_id) === id)
    return [id, completedMonthPayable(monthlyByKarigar[id] || [], payouts, payableMonth)]
  })), [karigars, allPayouts, monthlyByKarigar, payableMonth])
  const payableRow = detailKarigar ? payableByKarigar[String(detailKarigar.id)] : null
  const detailPayouts = detailKarigar
    ? allPayouts.filter(p => String(p.karigar_id) === String(detailKarigar.id))
      .sort((a, b) => (b.paid_at || "").localeCompare(a.paid_at || "") || Number(b.id) - Number(a.id))
    : []
  const undoablePayoutByKarigar = useMemo(() => {
    const payouts = new Map()
    for (const payout of allPayouts) {
      const key = String(payout.karigar_id)
      if (!payout.legacy_payment_id && undoSecondsRemaining(payout.created_at, now) > 0 && !payouts.has(key)) {
        payouts.set(key, payout)
      }
    }
    return payouts
  }, [allPayouts, now])
  const chartData = useMemo(() => {
    const now = currentMonth.split("-").map(Number)
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(now[0], now[1] - 6 + i, 1))
      const key = d.toISOString().slice(0, 7)
      const row = detailRows.find(item => item.month === key)
      return { month: monthLabel(key, true), earnings: row?.earned || 0 }
    })
  }, [detailRows, currentMonth])

  // Pre-open from Reports page with ?karigar=id
  useEffect(() => {
    const kid = searchParams.get("karigar")
    if (kid && karigars.length) {
      const k = karigars.find(x => x.id === kid)
      if (k) openDetail(k)
    }
  }, [searchParams, karigars])

  const loadKarigars = useCallback(async () => {
    const r = await api.sbQ("karigar", { order: "name.asc" })
    setKarigars(r.data || [])
    setLoading(false)
  }, [api])

  const fetchAll = useCallback(async (table, order) => {
    const rows = []
    for (let offset = 0; ; offset += 1000) {
      const result = await api.sbQ(table, { order, limit: 1000, offset })
      if (result.error) throw new Error(result.error.message)
      rows.push(...(result.data || []))
      if ((result.data || []).length < 1000) return rows
    }
  }, [api])

  const loadLedger = useCallback(async () => {
    try {
      const [assignments, payouts] = await Promise.all([
        fetchAll("karigar_order_assignments", "created_at.desc"),
        fetchAll("karigar_payouts", "period_start.desc,id.desc"),
      ])
      setAllAssignments(assignments)
      setAllPayouts(payouts)
      setLedgerError(null)
    } catch (error) {
      setLedgerError(error.message)
      toast.error(paymentText("Could not load karigar payments: " + error.message))
    } finally {
      setLedgerLoading(false)
    }
  }, [fetchAll])

  // Initial reads populate the page from the remote store.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadKarigars(); loadLedger() }, [loadKarigars, loadLedger])

  useEffect(() => {
    if (!allPayouts.some(p => !p.legacy_payment_id && undoSecondsRemaining(p.created_at, now) > 0)) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [allPayouts, now])

  // ── Form helpers ──────────────────────────────────────────────────────────
  function resetForm() {
    setEditId(null)
    setFormName(""); setFormPhone("")
    setFormStatus(true); setFormJoiningDate(""); setFormNotes("")
  }

  function openAdd() {
    if (atKarigarLimit) {
      toast.error(
        maxKarigars != null
          ? `You've reached your plan's limit of ${maxKarigars} karigar${maxKarigars === 1 ? "" : "s"}. Upgrade to add more.`
          : "Upgrade to add more karigars."
      )
      navigate("/billing")
      return
    }
    resetForm(); setFormOpen(true)
  }

  function openEdit(k) {
    setEditId(k.id)
    setFormName(k.name || ""); setFormPhone(k.phone || "")
    setFormStatus(k.status === "active")
    setFormJoiningDate(k.joining_date ? k.joining_date.slice(0, 10) : "")
    setFormNotes(k.notes || "")
    setFormOpen(true)
  }

  async function saveForm() {
    if (!formName.trim()) { toast.error("Name is required"); return }

    setFormSaving(true)
    const body = {
      name: formName.trim(),
      phone: formPhone.trim() || null,
      // payment_type column is NOT NULL in DB; money fields removed from UI,
      // so we send a constant valid value to satisfy the constraint.
      payment_type: "fixed",
      status: formStatus ? "active" : "inactive",
      joining_date: formJoiningDate || null,
      notes: formNotes.trim() || null,
    }

    if (editId) {
      const r = await api.sbQ("karigar", { method: "PATCH", query: "id=eq." + editId, body })
      if (r.error) { toast.error(r.error.message); setFormSaving(false); return }
    } else {
      const r = await api.sbQ("karigar", { method: "POST", body: [body] })
      if (r.error) { toast.error(r.error.message); setFormSaving(false); return }
    }

    toast.success(paymentText(editId ? "Karigar updated" : "Karigar added"))
    setFormSaving(false); setFormOpen(false)
    loadKarigars()
    window.dispatchEvent(new Event(KARIGAR_PAYABLES_CHANGED))
  }

  async function confirmDelete() {
    const r = await api.sbQ("karigar", { method: "DELETE", query: "id=eq." + deleteId })
    if (r.error && r.status !== 204) { toast.error(r.error.message); return }
    toast.success(paymentText(deleteName + " deleted"))
    setDeleteOpen(false); loadKarigars()
    window.dispatchEvent(new Event(KARIGAR_PAYABLES_CHANGED))
  }

  // ── Detail dialog ─────────────────────────────────────────────────────────
  function openDetail(k) {
    setDetailKarigar(k); setDetailTab("profile"); setDetailOpen(true)
  }

  async function markPaid(karigarId, month) {
    const key = `${karigarId}:${month}`
    if (payingKey) return
    const bounds = monthBounds(month)
    if (!bounds || month !== previousMonth()) return
    setPayingKey(key)
    try {
      const result = await api.rpc("record_karigar_completed_month_payment", {
        p_karigar_id: String(karigarId), p_period_start: bounds.start,
      })
      if (result.error) throw new Error(result.error.message)
      toast.success(paymentText(Number(result.data) > 0 ? `${money(result.data)} marked as paid. Undo is available for 5 minutes.` : "Completed work is already paid"))
      await loadLedger()
      window.dispatchEvent(new Event(KARIGAR_PAYABLES_CHANGED))
      setNow(Date.now())
    } catch (error) {
      toast.error(paymentText(error.message))
    } finally {
      setPayingKey(null)
    }
  }

  async function undoPayment(payout) {
    if (undoingId || payingKey || undoSecondsRemaining(payout.created_at) <= 0) return
    setUndoingId(payout.id)
    try {
      const result = await api.rpc("undo_karigar_monthly_payment", { p_payout_id: payout.id })
      if (result.error) throw new Error(result.error.message)
      toast.success(paymentText(`${money(result.data)} payment undone`))
      await loadLedger()
      window.dispatchEvent(new Event(KARIGAR_PAYABLES_CHANGED))
      setNow(Date.now())
    } catch (error) {
      toast.error(paymentText(error.message))
      await loadLedger()
    } finally {
      setUndoingId(null)
    }
  }

  function undoLabel(payout) {
    const seconds = undoSecondsRemaining(payout.created_at, now)
    return paymentText(`Undo (${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")})`)
  }

  const filtered = karigars.filter(k =>
    !query || k.name.toLowerCase().includes(query.toLowerCase()) || (k.phone || "").includes(query)
  )

  return (
    <div className="space-y-4">
      <PushReminderControl />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">        
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <Button onClick={openAdd} className="w-full sm:w-auto"
            title={atKarigarLimit ? "Upgrade to add more karigars" : undefined}>
            {atKarigarLimit ? "Upgrade to add Karigar" : "+ Add Karigar"}
          </Button>
          {maxKarigars != null && (
            <span>
              {karigarsUsed}/{maxKarigars} karigars used
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <input
        className="srch w-full sm:w-56"
        placeholder="Search by name or phone..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {ledgerError && (
        <div role="alert" className="rounded-lg border border-destructive p-3 text-sm text-destructive">
          {paymentText(`Could not load karigar payments: ${ledgerError}`)}
        </div>
      )}

      {/* Table (desktop) / Cards (mobile) */}
      {loading ? (
        <div className="ld"><div className="spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty"><h3>No karigars found</h3><p className="text-sm mt-1">Add your first karigar to get started</p></div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block tc rounded-lg border border-border overflow-hidden">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Paid</th>
                  <th>{paymentText(`Outstanding through ${monthLabel(payableMonth)}`)}</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(k => {
                  const rows = monthlyByKarigar[String(k.id)] || []
                  const due = payableByKarigar[String(k.id)]
                  const paid = rows.reduce((sum, row) => sum + row.paid, 0)
                  const balance = Math.max(due?.balance || 0, 0)
                  const undoablePayout = undoablePayoutByKarigar.get(String(k.id))
                  return <tr key={k.id}>
                    <td>
                      <Button                        
                        onClick={() => openDetail(k)}
                      >
                        {k.name}
                      </Button>
                    </td>
                    <td className="text-muted-foreground">{k.phone || "—"}</td>
                    <td>
                      <span className={"bdg " + (k.status === "active" ? "ba" : "bdf")}>
                        {k.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{ledgerLoading || ledgerError ? "—" : money(paid)}</td>
                    <td>{ledgerLoading || ledgerError ? "—" : money(balance)}</td>
                    <td>
                      {ledgerLoading || ledgerError ? <span className="text-muted-foreground text-xs">—</span> : (
                        <div className="flex flex-wrap gap-2">
                          {due?.balance > 0 ? (
                            <Button size="sm" variant="outline" disabled={!!payingKey || !!undoingId}
                              onClick={() => markPaid(k.id, due.month)}>
                              {payingKey === `${k.id}:${due.month}` ? "Saving…" : paymentText(`Mark ${money(due.balance)} as paid · ${monthLabel(due.month)}`)}
                            </Button>
                          ) : <span className="text-muted-foreground text-xs">No balance</span>}
                          {undoablePayout && (
                            <Button size="sm" variant="outline" disabled={!!payingKey || !!undoingId}
                              onClick={() => undoPayment(undoablePayout)}>
                              {undoingId === undoablePayout.id ? "Undoing…" : undoLabel(undoablePayout)}
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map(k => {
              const rows = monthlyByKarigar[String(k.id)] || []
              const due = payableByKarigar[String(k.id)]
              const paid = rows.reduce((sum, row) => sum + row.paid, 0)
              const balance = Math.max(due?.balance || 0, 0)
              const undoablePayout = undoablePayoutByKarigar.get(String(k.id))
              return (
              <div
                key={k.id}
                className="bg-card border border-border rounded-lg p-4 cursor-pointer"
                onClick={() => openDetail(k)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-foreground">{k.name}</p>
                    {k.phone && <p className="text-xs text-muted-foreground mt-0.5">{k.phone}</p>}
                  </div>
                  <span className={"bdg " + (k.status === "active" ? "ba" : "bdf")}>
                    {k.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-3">
                  <span>{paymentText(`Paid: ${ledgerLoading || ledgerError ? "—" : money(paid)}`)}</span>
                  <span>{paymentText(`Through ${monthLabel(payableMonth)}: ${ledgerLoading || ledgerError ? "—" : money(balance)}`)}</span>
                </div>
                {due?.balance > 0 && !ledgerLoading && !ledgerError && (
                  <Button size="sm" variant="outline" className="w-full mt-3"
                    disabled={!!payingKey || !!undoingId}
                    onClick={event => { event.stopPropagation(); markPaid(k.id, due.month) }}>
                    {payingKey === `${k.id}:${due.month}` ? "Saving…" : paymentText(`Mark ${money(due.balance)} as paid · ${monthLabel(due.month)}`)}
                  </Button>
                )}
                {undoablePayout && !ledgerLoading && !ledgerError && (
                  <Button size="sm" variant="outline" className="w-full mt-2"
                    disabled={!!payingKey || !!undoingId}
                    onClick={event => { event.stopPropagation(); undoPayment(undoablePayout) }}>
                    {undoingId === undoablePayout.id ? "Undoing…" : undoLabel(undoablePayout)}
                  </Button>
                )}
              </div>
            )})}
          </div>
        </>
      )}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Karigar" : "Add Karigar"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="fld">
              <Label htmlFor="k-name">Full Name *</Label>
              <Input id="k-name" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Ahmad Raza" className="mt-1" />
            </div>

            {/* Phone */}
            <div className="fld">
              <Label htmlFor="k-phone">Phone</Label>
              <Input id="k-phone" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="03xx-xxxxxxx" className="mt-1" />
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <Label htmlFor="k-status">Active</Label>
              <Switch id="k-status" checked={formStatus} onCheckedChange={setFormStatus} />
            </div>

            {/* Joining Date */}
            <div className="fld">
              <Label htmlFor="k-join">Joining Date</Label>
              <Input id="k-join" type="date" value={formJoiningDate} onChange={e => setFormJoiningDate(e.target.value)} className="mt-1" />
            </div>

            {/* Notes */}
            <div className="fld">
              <Label htmlFor="k-notes">Notes (internal)</Label>
              <Textarea id="k-notes" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Internal notes..." className="mt-1 resize-y" rows={3} />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={saveForm} disabled={formSaving} className="w-full sm:w-auto">
              {formSaving ? "Saving…" : editId ? "Update Karigar" : "Save Karigar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{detailKarigar?.name}</span>
              {detailKarigar && (
                <span className={"bdg " + (detailKarigar.status === "active" ? "ba" : "bdf")}>
                  {detailKarigar.status === "active" ? "Active" : "Inactive"}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailKarigar ? (
            <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1">
              <TabsList className="w-full">
                <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
                <TabsTrigger value="earnings" className="flex-1">Earnings</TabsTrigger>
              </TabsList>

              {/* ── Tab 1: Profile ── */}
              <TabsContent value="profile" className="space-y-3 p-3 border border-border rounded-xl mt-4">
                <div className="grid grid-cols-1 ">
                  {[
                    ["Name", detailKarigar.name],
                    ["Phone", detailKarigar.phone || "—"],
                    ["Joined", detailKarigar.joining_date ? new Date(detailKarigar.joining_date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"],
                    ["Status", detailKarigar.status === "active" ? "Active" : "Inactive"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-row justify-between border-b border-border rounded-md p-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{k}</p>
                      <p className="text-sm font-semibold text-foreground">{v}</p>
                    </div>
                  ))}
                </div>
                {detailKarigar.notes && (
                  <div className="flex flex-row justify-between  p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-foreground">{detailKarigar.notes}</p>
                  </div>
                )}
              </TabsContent>

              {/* ── Tab 2: Earnings ── */}
              <TabsContent value="earnings" className="space-y-4 pt-3">
                <p className="font-semibold">{paymentText(`Payable through ${monthLabel(payableMonth)}`)}</p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Earlier unpaid", money(payableRow?.carried)],
                    [paymentText(`Earned in ${monthLabel(payableMonth)}`), money(payableRow?.earned)],
                    ["Paid all time", money(payableRow?.paidAllTime)],
                    [payableRow?.balance < 0 ? "Overpaid" : "Total payable", money(Math.abs(payableRow?.balance || 0))],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-muted/50 rounded-md p-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                      <p className="text-lg font-bold text-foreground">{ledgerLoading || ledgerError ? "—" : value}</p>
                    </div>
                  ))}
                </div>

                <div className="border border-border rounded-lg p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{paymentText(`${monthLabel(payableMonth)} · ${payableRow?.orders || 0} orders assigned`)}</p>
                    <p className="text-sm text-muted-foreground">
                      {paymentText(`${monthBounds(payableMonth)?.start} to ${monthBounds(payableMonth)?.end} · Includes earlier unpaid work`)}
                    </p>
                  </div>
                  <Button disabled={ledgerLoading || !!ledgerError || !!payingKey || !!undoingId || !payableRow || payableRow.balance <= 0}
                    onClick={() => markPaid(detailKarigar.id, payableMonth)}>
                    {payingKey === `${detailKarigar.id}:${payableMonth}` ? "Saving…" : paymentText(`Mark ${money(payableRow?.balance)} as paid`)}
                  </Button>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Payment history</p>
                  {detailPayouts.length ? (
                    <div className="tc rounded-lg border border-border overflow-hidden">
                      <table>
                        <thead><tr><th>Date paid</th><th>Period recorded</th><th>Amount</th><th>Action</th></tr></thead>
                        <tbody>{detailPayouts.map(p => (
                          <tr key={p.id}>
                            <td>{p.paid_at}</td><td>{monthLabel(p.period_start.slice(0, 7))}</td><td className="font-semibold">{money(p.amount)}</td>
                            <td>{!p.legacy_payment_id && undoSecondsRemaining(p.created_at, now) > 0 && (
                              <Button size="sm" variant="outline" disabled={!!payingKey || !!undoingId}
                                onClick={() => undoPayment(p)}>
                                {undoingId === p.id ? "Undoing…" : undoLabel(p)}
                              </Button>
                            )}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No payment records yet</p>}
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Earnings — Last 6 Months</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={v => ["Rs " + v, "Earnings"]} contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          ) : null}

          {detailKarigar && detailTab === "profile" && (
            <DialogFooter>
              <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => { setDetailOpen(false); openEdit(detailKarigar) }}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive w-full sm:w-auto"
                onClick={() => {
                  setDeleteId(detailKarigar.id)
                  setDeleteName(detailKarigar.name)
                  setDetailOpen(false)
                  setDeleteOpen(true)
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          )}

        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Karigar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteName}</strong>? This cannot be undone.
          </p>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} className="w-full sm:w-auto">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
