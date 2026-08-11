import { useState, useEffect } from "react"
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

function karigarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/>
      <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
      <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/>
      <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
      <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/>
      <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
      <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/>
      <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
    </svg>
  )
}

// ── Simple recharts bar for earnings tab ──────────────────────────────────────
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

export default function KarigarPage() {
  const { api } = useAuth()
  const { maxKarigars, karigarsUsed, atKarigarLimit } = useSubscription()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [karigars, setKarigars] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

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
  const [detailLoading, setDetailLoading] = useState(false)
  const [assignments, setAssignments] = useState([])
  const [payments, setPayments] = useState([])
  const [earningsFilter, setEarningsFilter] = useState(() => {
    const now = new Date()
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
    }
  })
  const [earningsData, setEarningsData] = useState(null)
  const [monthlyChart, setMonthlyChart] = useState([])

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteName, setDeleteName] = useState("")

  useEffect(() => { loadKarigars() }, [])

  // Pre-open from Reports page with ?karigar=id
  useEffect(() => {
    const kid = searchParams.get("karigar")
    if (kid && karigars.length) {
      const k = karigars.find(x => x.id === kid)
      if (k) openDetail(k)
    }
  }, [searchParams, karigars])

  async function loadKarigars() {
    setLoading(true)
    const r = await api.sbQ("karigar", { order: "name.asc" })
    setKarigars(r.data || [])
    setLoading(false)
  }

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

    toast.success(editId ? "Karigar updated" : "Karigar added")
    setFormSaving(false); setFormOpen(false)
    loadKarigars()
  }

  async function confirmDelete() {
    const r = await api.sbQ("karigar", { method: "DELETE", query: "id=eq." + deleteId })
    if (r.error && r.status !== 204) { toast.error(r.error.message); return }
    toast.success(deleteName + " deleted")
    setDeleteOpen(false); loadKarigars()
  }

  // ── Detail dialog ─────────────────────────────────────────────────────────
  async function openDetail(k) {
    setDetailKarigar(k); setDetailTab("profile"); setDetailOpen(true)
    setDetailLoading(true)
    await loadEarnings(k.id, earningsFilter)
    await loadPayments(k.id)
    setDetailLoading(false)
  }

  async function loadEarnings(kId, filter) {
    const [rA] = await Promise.all([
      api.sbQ("karigar_order_assignments", {
        query: "karigar_id=eq." + kId,
        order: "created_at.desc"
      })
    ])
    const all = rA.data || []
    // Filter by date range using order created_at isn't perfect; we filter on assignment created_at
    const filtered = all.filter(a => {
      const d = a.created_at ? a.created_at.slice(0, 10) : ""
      return (!filter.from || d >= filter.from) && (!filter.to || d <= filter.to)
    })
    const totalOrders = filtered.length
    const totalEarnings = filtered.reduce((s, a) => s + (parseFloat(a.agreed_rate) || 0), 0)
    setAssignments(filtered)
    setEarningsData({ totalOrders, totalEarnings })

    // Build 6-month chart
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toISOString().slice(0, 7)
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" })
      const amt = all
        .filter(a => a.created_at && a.created_at.slice(0, 7) === key)
        .reduce((s, a) => s + (parseFloat(a.agreed_rate) || 0), 0)
      months.push({ month: label, earnings: amt })
    }
    setMonthlyChart(months)
  }

  async function loadPayments(kId) {
    const r = await api.sbQ("karigar_payments", { query: "karigar_id=eq." + kId, order: "period_start.desc" })
    setPayments(r.data || [])
  }

  async function markPaid(paymentId) {
    const r = await api.sbQ("karigar_payments", {
      method: "PATCH",
      query: "id=eq." + paymentId,
      body: { status: "paid", date_paid: new Date().toISOString().slice(0, 10) }
    })
    if (r.error) { toast.error(r.error.message); return }
    toast.success("Marked as paid")
    if (detailKarigar) await loadPayments(detailKarigar.id)
  }

  const filtered = karigars.filter(k =>
    !query || k.name.toLowerCase().includes(query.toLowerCase()) || (k.phone || "").includes(query)
  )

  return (
    <div className="space-y-4">
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(k => (
                  <tr key={k.id}>
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
                    <td>
                      <div className="flex items-center gap-2">
                        {/* <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate("/reports?type=karigar-payment&karigar=" + k.id)}
                          className="text-xs"
                        >
                          Payment Slip
                        </Button> */}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(k)}>Edit</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { setDeleteId(k.id); setDeleteName(k.name); setDeleteOpen(true) }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map(k => (
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
                <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                  {/* <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => navigate("/reports?type=karigar-payment&karigar=" + k.id)}
                  >
                    Payment Slip
                  </Button> */}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(k)}>Edit</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive w-full"
                    onClick={() => { setDeleteId(k.id); setDeleteName(k.name); setDeleteOpen(true) }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
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
        <DialogContent className="sm:max-w-2xl">
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

          {detailLoading ? (
            <div className="ld"><div className="spin" /></div>
          ) : detailKarigar ? (
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList className="w-full">
                <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
                <TabsTrigger value="earnings" className="flex-1">Earnings</TabsTrigger>
                {/* <TabsTrigger value="payments" className="flex-1">Payments</TabsTrigger> */}
              </TabsList>

              {/* ── Tab 1: Profile ── */}
              <TabsContent value="profile" className="space-y-3 p-3 border border-border rounded-xl mt-4">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); openEdit(detailKarigar) }}>
                    Edit
                  </Button>
                </div>
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
                <div className="flex gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs whitespace-nowrap">From</Label>
                    <Input type="date" value={earningsFilter.from}
                      onChange={e => setEarningsFilter(p => ({ ...p, from: e.target.value }))}
                      className="h-8 text-xs w-36" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs whitespace-nowrap">To</Label>
                    <Input type="date" value={earningsFilter.to}
                      onChange={e => setEarningsFilter(p => ({ ...p, to: e.target.value }))}
                      className="h-8 text-xs w-36" />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => loadEarnings(detailKarigar.id, earningsFilter)}>
                    Apply
                  </Button>
                </div>

                {earningsData && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Orders Assigned", earningsData.totalOrders],
                      ["Total Earnings", "Rs " + (earningsData.totalEarnings || 0)],
                      ["Pieces", assignments.length],
                    ].map(([l, v]) => (
                      <div key={l} className="bg-muted/50 rounded-md p-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{l}</p>
                        <p className="text-lg font-bold text-foreground">{v}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Earnings — Last 6 Months</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthlyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={v => ["Rs " + v, "Earnings"]} contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>

              {/* ── Tab 3: Payments ── */}
              <TabsContent value="payments" className="pt-3">
                {payments.length === 0 ? (
                  <div className="empty"><h3>No payment records</h3></div>
                ) : (
                  <div className="tc rounded-lg border border-border overflow-hidden">
                    <table>
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Orders</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date Paid</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(p => (
                          <tr key={p.id}>
                            <td className="text-xs whitespace-nowrap">
                              {p.period_start} → {p.period_end}
                            </td>
                            <td>{p.total_orders || "—"}</td>
                            <td className="font-semibold">Rs {p.total_payable}</td>
                            <td>
                              <span className={"bdg " + (p.status === "paid" ? "ba" : "bg")}>
                                {p.status === "paid" ? "Paid" : "Pending"}
                              </span>
                            </td>
                            <td className="text-muted-foreground text-xs">{p.date_paid || "—"}</td>
                            <td>
                              {p.status === "pending" && (
                                <Button size="sm" variant="outline" onClick={() => markPaid(p.id)}>
                                  Mark Paid
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : null}

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
