import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import { useLang } from "@/hooks/useLang"
import { useSubscription } from "@/hooks/useSubscription"
import { useTourController } from "@/context/TourContext"
import { tr, CATS } from "@/lib/config"
import { fmtDate, cap, debounce, gradientAvatar, urduFold } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { Badge }  from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/Card"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

// ── Karigar Assignment Section ────────────────────────────────────────────────
// Two modes:
//  • Persisted mode (orderId set) — used in the View Order dialog. Loads/saves
//    karigar_order_assignments directly to the DB.
//  • Draft mode (orderId null, draftRows + onDraftChange set) — used in the
//    New Order flow before the order row exists. The parent holds the rows in
//    state and persists them right after the order is created.
// `locked` (the plan's karigar limit is reached) keeps the control visible but
// shows an upgrade prompt instead of opening the assignment dialog.
function KarigarAssignmentSection({ orderId, api, draftRows, onDraftChange, locked = false }) {
  const draft = !orderId
  const [assignments, setAssignments] = useState([])
  const [allKarigars, setAllKarigars] = useState([])
  const [assignOpen, setAssignOpen]   = useState(false)
  const [rows, setRows]               = useState([{ karigar_id: "", agreed_rate: "", notes: "" }])
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    // Karigars are needed in both modes (to render names + the picker).
    loadKarigars()
    if (orderId) loadAssignments()
  }, [orderId])

  // In draft mode the committed assignments come from the parent's draftRows.
  const draftAssignments = (draftRows || [])
    .filter(r => r.karigar_id && parseFloat(r.agreed_rate) > 0)
    .map((r, i) => ({ id: "draft-" + i, karigar_id: r.karigar_id, agreed_rate: r.agreed_rate, notes: r.notes || "" }))
  const committed = draft ? draftAssignments : assignments

  async function loadAssignments() {
    const r = await api.sbQ("karigar_order_assignments", { query: "order_id=eq." + orderId, order: "created_at.asc" })
    setAssignments(r.data || [])
  }

  async function loadKarigars() {
    const r = await api.sbQ("karigar", { query: "status=eq.active", order: "name.asc" })
    setAllKarigars(r.data || [])
  }

  function openAssignDialog() {
    if (locked) {
      toast.error("Upgrade to assign karigar")
      return
    }
    if (committed.length) {
      setRows(committed.map(a => ({ id: a.id, karigar_id: a.karigar_id, agreed_rate: a.agreed_rate, notes: a.notes || "" })))
    } else {
      setRows([{ karigar_id: "", agreed_rate: "", notes: "" }])
    }
    setAssignOpen(true)
  }

  function updateRow(i, field, val) {
    setRows(prev => prev.map((r, j) => j === i ? { ...r, [field]: val } : r))
    // Pre-fill rate from karigar's piece rates when karigar is selected
    if (field === "karigar_id" && val) {
      const k = allKarigars.find(x => x.id === val)
      if (k && k.monthly_base_salary) {
        setRows(prev => prev.map((r, j) => j === i ? { ...r, karigar_id: val, agreed_rate: k.monthly_base_salary } : r))
      }
    }
  }

  async function saveAssignments() {
    const valid = rows.filter(r => r.karigar_id && parseFloat(r.agreed_rate) > 0)
    if (!valid.length) { toast.error("Add at least one karigar with a rate"); return }

    // Draft mode — hand the rows back to the parent; nothing hits the DB yet.
    if (draft) {
      onDraftChange?.(valid.map(r => ({ karigar_id: r.karigar_id, agreed_rate: parseFloat(r.agreed_rate), notes: r.notes || null })))
      toast.success("Karigar assignments added")
      setAssignOpen(false)
      return
    }

    setSaving(true)
    await api.sbQ("karigar_order_assignments", { method: "DELETE", query: "order_id=eq." + orderId })
    for (const r of valid) {
      await api.sbQ("karigar_order_assignments", {
        method: "POST",
        body: [{ karigar_id: r.karigar_id, order_id: orderId, agreed_rate: parseFloat(r.agreed_rate), notes: r.notes || null }]
      })
    }
    toast.success("Karigar assignments saved")
    setSaving(false); setAssignOpen(false)
    await loadAssignments()
  }

  const totalLabour = committed.reduce((s, a) => s + (parseFloat(a.agreed_rate) || 0), 0)
  const liveTotal   = rows.reduce((s, r) => s + (parseFloat(r.agreed_rate) || 0), 0)
  const selectedIds = rows.map(r => r.karigar_id).filter(Boolean)

  function karigarName(id) {
    const k = allKarigars.find(x => x.id === id)
    return k ? k.name : id
  }

  return (
    <>
      <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 14, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "hsl(var(--muted-foreground))" }}>
            Karigar Assignment
          </span>
          <Button size="sm" variant="outline" onClick={openAssignDialog}
            title={locked ? "Upgrade to assign karigar" : undefined}>
            {locked
              ? "Upgrade to assign karigar"
              : committed.length ? "Edit Assignments" : "Assign Karigar/s"}
          </Button>
        </div>

        {committed.length === 0 ? (
          <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", fontStyle: "italic" }}>
            {locked ? "Karigar assignment is locked on your plan." : "No karigars assigned yet"}
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {committed.map(a => (
                <span key={a.id} className="ord-chip" style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}>
                  {karigarName(a.karigar_id)} · Rs {a.agreed_rate}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              Total Labour Cost: <strong style={{ color: "hsl(var(--foreground))" }}>Rs {totalLabour}</strong>
            </p>
          </>
        )}
      </div>

      {/* Assignment Dialog */}
      
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Karigar/s</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {rows.map((row, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                {/* Mobile: stacked. Desktop: row */}
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
                  <div className="flex-1">
                    <Label className="text-xs mb-1 block">Karigar</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={row.karigar_id}
                      onChange={e => updateRow(i, "karigar_id", e.target.value)}
                    >
                      <option value="">-- Select Karigar --</option>
                      {allKarigars.map(k => (
                        <option key={k.id} value={k.id} disabled={selectedIds.includes(k.id) && row.karigar_id !== k.id}>
                          {k.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full md:w-28">
                    <Label className="text-xs mb-1 block">Agreed Rate (Rs)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={row.agreed_rate}
                      onChange={e => updateRow(i, "agreed_rate", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Notes (optional)</Label>
                  <Input
                    placeholder="e.g. rush job"
                    value={row.notes}
                    onChange={e => updateRow(i, "notes", e.target.value)}
                  />
                </div>
                {rows.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive w-full"
                    onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setRows(prev => [...prev, { karigar_id: "", agreed_rate: "", notes: "" }])}
            >
              + Add Another Karigar
            </Button>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-muted-foreground order-last sm:order-first">
              Total Labour: <strong className="text-foreground">Rs {liveTotal}</strong>
            </span>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setAssignOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button onClick={saveAssignments} disabled={saving} className="w-full sm:w-auto">
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function nm(c)  { return (c.first_name || c.fname || c.name || "--").trim() }
function ini(c) { return nm(c).split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() }
function fmtMeasVal(v) {
  if (!v && v !== 0) return "--"
  // Open text: echo the stored value exactly as entered. No parsing.
  return String(v)
}
function labelize(k) { return k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) }

const STATUS_CLS = { pending: "bdf", in_progress: "bp", ready: "ba", delivered: "bg", cancelled: "bdf" }

// Payment method options for the ledger (must match the DB check constraint).
const PAY_METHODS = [
  ["cash", "Cash"], ["jazzcash", "JazzCash"], ["easypaisa", "Easypaisa"], ["bank", "Bank"], ["other", "Other"],
]

// Derive paid / balance / status label + colour from an order total and paid sum.
function paymentInfo(total, paid) {
  const t = parseFloat(total) || 0
  const p = parseFloat(paid)  || 0
  const balance = Math.max(t - p, 0)
  let label = "Unpaid", color = "hsl(var(--destructive))"
  if (t > 0 && p >= t)      { label = "Paid";    color = "hsl(142 76% 36%)" }
  else if (p > 0)           { label = "Partial"; color = "hsl(var(--amber-accent))" }
  return { paid: p, balance, label, color, total: t }
}

async function getNextOrderSeq(api) {
  const r = await api.sbQ("orders", { order: "order_seq.desc,created_at.desc", limit: 1 })
  if (r.data && r.data[0] && r.data[0].order_seq) return r.data[0].order_seq + 1
  const r2 = await api.sbQ("orders", { query: "select=id", limit: 1000 })
  return ((r2.data && r2.data.length) || 0) + 1
}

export default function OrdersPage() {
  const { api } = useAuth()
  const { lang } = useLang()
  const { maxOrders, ordersUsed, atOrderLimit, atKarigarLimit, karigarHidden, refresh: refreshSub } = useSubscription()
  const tourCtl = useTourController()

  const [orders,      setOrders]      = useState([])
  const [paidByOrder, setPaidByOrder] = useState({})   // orderId -> total paid (for list + badges)
  const [customers,   setCustomers]   = useState([])
  const [catsCache,   setCatsCache]   = useState([])
  const [loading,     setLoading]     = useState(false)
  const [hasMore,     setHasMore]     = useState(true)
  const [query,       setQuery]       = useState("")
  const [statusFilter,setStatusFilter]= useState("")
  const offsetRef   = useRef(0)
  const loadingRef  = useRef(false)
  const observerRef = useRef(null)
  const sentinelRef = useRef(null)
  const PAGE = 10

  // New order state (2-step)
  const [newOpen,     setNewOpen]     = useState(false)
  const [step,        setStep]        = useState(1)
  const [selCusts,    setSelCusts]    = useState({})
  const [custSearch,  setCustSearch]  = useState("")
  const [custResults, setCustResults] = useState([])
  const [custSearching, setCustSearching] = useState(false)
  const [orderNum,    setOrderNum]    = useState("")
  const [orderNumSeq, setOrderNumSeq] = useState(null)
  const [orderStatus, setOrderStatus] = useState("pending")
  const [bookingDate, setBookingDate] = useState("")
  const [deliveryDate,setDeliveryDate]= useState("")
  const [discount,    setDiscount]    = useState("")
  const [advance,     setAdvance]     = useState("")       // optional advance received at booking
  const [orderNotes,  setOrderNotes]  = useState("")
  const [draftKarigars, setDraftKarigars] = useState([])   // karigar assignments collected before the order exists
  const [saving,      setSaving]      = useState(false)

  // Edit order state
  const [editOpen,    setEditOpen]    = useState(false)
  const [editId,      setEditId]      = useState(null)
  const [editNum,     setEditNum]     = useState("")
  const [editStatus,  setEditStatus]  = useState("pending")
  const [editBD,      setEditBD]      = useState("")
  const [editDD,      setEditDD]      = useState("")
  const [editDisc,    setEditDisc]    = useState("")
  const [editNotes,   setEditNotes]   = useState("")
  const [editSelCusts,setEditSelCusts]= useState({})
  const [editCustBar, setEditCustBar] = useState([])
  const [editSaving,  setEditSaving]  = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  // Per-customer "adding item" spinner (keyed by customer id) for the items panel
  const [addingItem,  setAddingItem]  = useState({})

  // View order state
  const [viewOpen,    setViewOpen]    = useState(false)
  const [viewOrder,   setViewOrder]   = useState(null)
  const [viewItems,   setViewItems]   = useState([])
  const [viewLoading, setViewLoading] = useState(false)
  const [viewPayments,setViewPayments]= useState([])       // payment history for the open order

  // Add-payment dialog state
  const [payOpen,     setPayOpen]     = useState(false)
  const [payAmount,   setPayAmount]   = useState("")
  const [payMethod,   setPayMethod]   = useState("cash")
  const [payDate,     setPayDate]     = useState("")
  const [payNote,     setPayNote]     = useState("")
  const [paySaving,   setPaySaving]   = useState(false)

  // Meas popup — controlled properly
  const [measOpen,    setMeasOpen]    = useState(false)
  const [measData,    setMeasData]    = useState({ cat: "", vals: {} })

  useEffect(() => { loadCustomers() }, [])

  async function loadCustomers() {
    const r = await api.sbQ("customers", { query: "deleted_at=is.null", order: "created_at.desc", limit: 500 })
    setCustomers(r.data || [])
    const r2 = await api.sbQ("item_categories", { order: "id.asc" })
    setCatsCache(r2.data || [])
  }

  // New Order customer search is server-side (over the full customer table),
  // matching the Customers module. Client-side filtering over the first 500
  // loaded rows silently hid every customer older than that window.
  async function runCustSearch(q) {
    if (!q.trim()) { setCustResults([]); return }
    setCustSearching(true)
    const escaped = urduFold(q.trim()).replace(/%/g, "%25").replace(/&/g, "%26")
    const r = await api.sbQ("customers", {
      query: "deleted_at=is.null&or=(first_name.ilike.*" + escaped + "*,phone.ilike.*" + escaped + "*,customer_number.ilike.*" + escaped + "*)",
      order: "created_at.desc",
      limit: 50,
    })
    setCustSearching(false)
    if (!r.error) setCustResults(r.data || [])
  }

  const debouncedCustSearch = useCallback(debounce(v => runCustSearch(v), 280), [])

  // Combined lookup: the newest-500 batch plus any server search results, so
  // selected/search result customers always resolve to a name in the picker,
  // the ItemsPanel and the chips even when they fall outside the 500-row load.
  const custAll = useMemo(() => {
    const m = new Map()
    customers.forEach(c => m.set(String(c.id), c))
    custResults.forEach(c => m.set(String(c.id), c))
    return [...m.values()]
  }, [customers, custResults])

  // ── Load orders ────────────────────────────────────────────────────
  const fetchPage = useCallback(async (append = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    const lookup = {}
    customers.forEach(c => { lookup[String(c.id)] = c })

    const filters = []
    if (query) {
      const escaped = urduFold(query.trim()).replace(/%/g, "%25").replace(/&/g, "%26")
      const rC = await api.sbQ("customers", {
        query: "deleted_at=is.null&or=(first_name.ilike.*" + escaped + "*,phone.ilike.*" + escaped + "*,customer_number.ilike.*" + escaped + "*)",
        order: "created_at.desc",
        limit: 100,
      })
      const matched = rC.data || []
      if (matched.length) {
        // Merge matches into custResults so order cards resolve names even for
        // customers that fall outside the newest-500 batch.
        setCustResults(prev => {
          const m = new Map(prev.map(c => [String(c.id), c]))
          matched.forEach(c => m.set(String(c.id), c))
          return [...m.values()]
        })
      }
      const matchedIds = matched.map(c => String(c.id))
      const orParts = []
      if (/^[a-z0-9 ]+$/i.test(query)) {
        orParts.push("order_number.ilike.*" + query.toLowerCase() + "*")
      }
      matchedIds.forEach(cid => orParts.push("customer_ids.ilike.*" + cid + "*"))
      if (orParts.length) filters.push("or=(" + orParts.join(",") + ")")
    }
    if (statusFilter) filters.push("status=eq." + statusFilter)

    const r = await api.sbQ("orders", { query: filters.join("&"), order: "order_seq.desc,created_at.desc", limit: PAGE, offset: offsetRef.current })
    loadingRef.current = false
    setLoading(false)
    if (r.status === 401 || r.error) return
    const batch = r.data || []
    if (!append) setOrders(batch)
    else setOrders(prev => [...prev, ...batch])
    setHasMore(batch.length === PAGE)
    offsetRef.current += batch.length
    loadPaidForOrders(batch)

    // Fetch any customers referenced by these orders that aren't in lookup yet.
    // This fixes the bug where orders reference customers outside the newest-500 batch.
    const allCustIds = [...new Set(batch.flatMap(o => {
      try { return JSON.parse(o.customer_ids || "[]") } catch { return [] }
    }))]
    const missingCustIds = allCustIds.filter(id => !lookup[id])
    if (missingCustIds.length) {
      const rMiss = await api.sbQ("customers", {
        query: "id=in.(" + missingCustIds.join(",") + ")",
        limit: missingCustIds.length,
      })
      if (rMiss.data) {
        setCustResults(prev => {
          const m = new Map(prev.map(c => [String(c.id), c]))
          rMiss.data.forEach(c => m.set(String(c.id), c))
          return [...m.values()]
        })
      }
    }
  }, [query, statusFilter, customers, api])

  useEffect(() => {
    if (!customers.length) return
    offsetRef.current = 0; setHasMore(true); fetchPage(false)
  }, [query, statusFilter, customers])

  useEffect(() => {
    if (!hasMore) return
    const scroller = document.querySelector(".content") || document.querySelector(".ct") || window
    function onScroll() {
      if (!hasMore || loadingRef.current) return
      const el = sentinelRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const viewH = scroller === window ? window.innerHeight : scroller.getBoundingClientRect().height
      if (rect.top <= viewH + 300) fetchPage(true)
    }
    scroller.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => scroller.removeEventListener("scroll", onScroll)
  }, [hasMore, fetchPage])

  const debouncedSearch = useCallback(debounce(v => setQuery(v), 280), [])

  function custMap() {
    const m = {}
    customers.forEach(c => { m[String(c.id)] = c })
    custResults.forEach(c => { m[String(c.id)] = c })
    return m
  }

  // ── Payments ────────────────────────────────────────────────────────
  // Fetch the total paid for a batch of orders (used by the list cards/badges).
  async function loadPaidForOrders(orderRows) {
    const ids = (orderRows || []).map(o => o.id).filter(v => v != null)
    if (!ids.length) return
    const r = await api.sbQ("order_payments", { query: "order_id=in.(" + ids.join(",") + ")" })
    if (r.error || !r.data) return
    const sums = {}
    r.data.forEach(p => { sums[p.order_id] = (sums[p.order_id] || 0) + (parseFloat(p.amount) || 0) })
    setPaidByOrder(prev => {
      const next = { ...prev }
      ids.forEach(id => { next[id] = sums[id] || 0 })
      return next
    })
  }

  // Load the full payment history for the currently-viewed order.
  async function loadViewPayments(orderId) {
    const r = await api.sbQ("order_payments", { query: "order_id=eq." + orderId, order: "paid_at.asc,id.asc" })
    const list = r.data || []
    setViewPayments(list)
    const sum = list.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    setPaidByOrder(prev => ({ ...prev, [orderId]: sum }))
    return list
  }

  // Insert one payment row and refresh the view + list caches.
  async function recordPayment(orderId, { amount, method, paid_at, note }) {
    const r = await api.sbQ("order_payments", {
      method: "POST",
      body: [{ order_id: orderId, amount, method, paid_at: paid_at || null, note: note || null }],
    })
    if (r.error) { toast.error(r.error.message); return false }
    await loadViewPayments(orderId)
    return true
  }

  async function savePayment() {
    if (!viewOrder) return
    const amt = parseFloat(payAmount)
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount"); return }
    setPaySaving(true)
    const ok = await recordPayment(viewOrder.id, { amount: amt, method: payMethod, paid_at: payDate, note: payNote.trim() })
    setPaySaving(false)
    if (ok) { toast.success("Payment recorded"); setPayOpen(false) }
  }

  async function deletePayment(paymentId) {
    if (!viewOrder) return
    const r = await api.sbQ("order_payments", { method: "DELETE", query: "id=eq." + paymentId })
    if (r.error && r.status !== 204) { toast.error(r.error.message); return }
    await loadViewPayments(viewOrder.id)
    toast.success("Payment removed")
  }

  function openPayDialog() {
    setPayAmount(""); setPayMethod("cash"); setPayNote("")
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayOpen(true)
  }

  // ── Load items for a customer — only categories that have data ──────
  async function loadItemsForCust(custId, state, setState) {
    const cats = catsCache.length ? catsCache : (await api.sbQ("item_categories", { order: "id.asc" })).data || []
    if (!catsCache.length) setCatsCache(cats)

    // Only load categories the customer actually has measurements for
    const rItems = await api.sbQ("customer_items", { query: "customer_id=eq." + custId })
    let items = rItems.data || []
    const seen = {}
    items = items.filter(it => { if (seen[it.category_name]) return false; seen[it.category_name] = true; return true })

    const loaded = []
    for (const it of items) {
      // Check if there are actual measurements
      const rM = await api.sbQ("customer_measurements", { query: "customer_item_id=eq." + it.id + "&is_current=eq.true", limit: 1 })
      const measVals = {}
      if (rM.data && rM.data[0]) {
        const rV = await api.sbQ("customer_measurement_values", { query: "measurement_id=eq." + rM.data[0].id })
        ;(rV.data || []).forEach(v => { measVals[v.measurement_key] = v.value })
      }
      // Skip categories with no measurement values
      if (Object.keys(measVals).length === 0) continue

      const catRow = cats.find(c => c.name === it.category_name || c.name.toLowerCase() === (it.category_name || "").toLowerCase())
      let rate = null
      if (catRow) {
        const rRate = await api.sbQ("rates", { query: "category_id=eq." + catRow.id, order: "price.desc", limit: 1 })
        rate = rRate.data && rRate.data[0]
      }
      loaded.push({
        category: it.category_name, measVals, qty: 1,
        price: rate ? (rate.price || 0) : 0,
        dsReshmi: false, dsJaali: false, dsSada: false,
        dsReshmiPrice: rate ? (rate.ds_reshmi_price || 300) : 300,
        dsJaaliPrice:  rate ? (rate.ds_jaali_price  || 500) : 500,
        dsSadaPrice:   rate ? (rate.ds_sada_price   || 200) : 200,
        rateLabel: rate ? rate.label : "",
      })
    }
    setState(prev => ({ ...prev, [custId]: { ...prev[custId], items: loaded } }))
  }

  // ── New order ────────────────────────────────────────────────────
  async function openNewOrder() {
    setSelCusts({}); setCustSearch(""); setStep(1)
    setOrderStatus("pending"); setBookingDate(new Date().toISOString().slice(0, 10))
    setDeliveryDate(""); setDiscount(""); setAdvance(""); setOrderNotes(""); setDraftKarigars([])
    const seq = await getNextOrderSeq(api)
    setOrderNum("#" + seq); setOrderNumSeq(seq)
    setNewOpen(true)
  }

  function toggleSelCust(custId) {
    setSelCusts(prev => {
      if (prev[custId]) { const n = { ...prev }; delete n[custId]; return n }
      return { [custId]: { items: [] } }
    })
  }

  async function goStep2() {
    const custIds = Object.keys(selCusts)
    if (!custIds.length) { toast.error("Select at least one customer first"); return }
    setSaving(true)
    const newState = { ...selCusts }
    for (const cid of custIds) {
      if (!newState[cid].items || !newState[cid].items.length) {
        await loadItemsForCust(cid, newState, s => Object.assign(newState, s))
      }
    }
    setSelCusts(newState)
    setSaving(false)
    setStep(2)
  }

  function updateItem(cid, idx, field, val, state, setState) {
    setState(prev => {
      const items = [...(prev[cid]?.items || [])]
      items[idx] = { ...items[idx], [field]: val }
      return { ...prev, [cid]: { ...prev[cid], items } }
    })
  }

  async function addItem(cid, catName, state, setState) {
    if (!catName) { toast.error("Pick a category first"); return }
    setAddingItem(p => ({ ...p, [cid]: true }))
    try {
      const cats = catsCache
      const catRow = cats.find(c => c.name === catName)
      let rate = null
      if (catRow) {
        const rR = await api.sbQ("rates", { query: "category_id=eq." + catRow.id, order: "price.desc", limit: 1 })
        rate = rR.data && rR.data[0]
      }
      const rCI = await api.sbQ("customer_items", { query: "customer_id=eq." + cid + "&category_name=eq." + encodeURIComponent(catName), limit: 1 })
      const measVals = {}
      // For a custom category, seed empty keys for its chosen fields so the
      // measurement editor shows them even before the customer has values.
      if (!CATS[catName] && catRow && Array.isArray(catRow.meas_fields)) {
        catRow.meas_fields.forEach(k => { measVals[k] = measVals[k] ?? "" })
      }
      if (rCI.data && rCI.data[0]) {
        const rM = await api.sbQ("customer_measurements", { query: "customer_item_id=eq." + rCI.data[0].id + "&is_current=eq.true", limit: 1 })
        if (rM.data && rM.data[0]) {
          const rV = await api.sbQ("customer_measurement_values", { query: "measurement_id=eq." + rM.data[0].id })
          ;(rV.data || []).forEach(v => { measVals[v.measurement_key] = v.value })
        }
      }
      setState(prev => {
        const items = [...(prev[cid]?.items || []), {
          category: catName, measVals, qty: 1,
          price: rate ? (rate.price || 0) : 0,
          dsReshmi: false, dsJaali: false, dsSada: false,
          dsReshmiPrice: rate ? (rate.ds_reshmi_price || 300) : 300,
          dsJaaliPrice:  rate ? (rate.ds_jaali_price  || 500) : 500,
          dsSadaPrice:   rate ? (rate.ds_sada_price   || 200) : 200,
          rateLabel: rate ? rate.label : catName,
        }]
        return { ...prev, [cid]: { ...prev[cid], items } }
      })
    } finally {
      setAddingItem(p => { const n = { ...p }; delete n[cid]; return n })
    }
  }

  function removeItem(cid, idx, state, setState) {
    setState(prev => {
      const items = (prev[cid]?.items || []).filter((_, i) => i !== idx)
      return { ...prev, [cid]: { ...prev[cid], items } }
    })
  }

  function calcTotal(sel, disc) {
    let total = 0
    Object.values(sel).forEach(s => {
      ;(s.items || []).forEach(it => {
        total += (it.price || 0) * (it.qty || 1)
        if (it.dsReshmi) total += (it.dsReshmiPrice || 300) * (it.qty || 1)
        if (it.dsJaali)  total += (it.dsJaaliPrice  || 500) * (it.qty || 1)
        if (it.dsSada)   total += (it.dsSadaPrice   || 200) * (it.qty || 1)
      })
    })
    return total - (parseFloat(disc) || 0)
  }

  async function saveNewOrder() {
    const custIds = Object.keys(selCusts)
    if (!orderNum) { toast.error("Order number required"); return }
    if (!custIds.length) { toast.error("Select at least one customer"); return }
    // Friendly client-side guard (the database also enforces this hard).
    if (maxOrders != null && ordersUsed >= maxOrders) {
      toast.error(`You've reached your plan's limit of ${maxOrders} orders. Upgrade to add more.`)
      return
    }
    setSaving(true)
    const grand = calcTotal(selCusts, discount)
    const body = {
      order_number: orderNum, order_seq: orderNumSeq,
      status: orderStatus, booking_date: bookingDate || null,
      delivery_date: deliveryDate || null,
      discount: parseFloat(discount) || 0,
      notes: orderNotes.trim() || null,
      total_amount: grand,
      customer_ids: JSON.stringify(custIds),
    }
    const rO = await api.sbQ("orders", { method: "POST", body: [body] })
    if (rO.error) {
      const msg = /ORDER_LIMIT_REACHED/.test(rO.error.message)
        ? `You've reached your plan's order limit${maxOrders != null ? ` of ${maxOrders}` : ""}. Upgrade to add more.`
        : rO.error.message
      toast.error(msg); setSaving(false); return
    }
    const orderId = rO.data && rO.data[0] && rO.data[0].id
    if (orderId) await saveOrderItems(orderId, custIds, selCusts)
    // Record the advance (if any) as the first payment against the new order.
    const adv = parseFloat(advance)
    if (orderId && Number.isFinite(adv) && adv > 0) {
      await api.sbQ("order_payments", {
        method: "POST",
        body: [{ order_id: orderId, amount: adv, method: "cash", paid_at: bookingDate || null, note: "Advance at booking" }],
      })
    }
    // Persist any karigar assignments collected during the create flow.
    if (orderId && draftKarigars.length) {
      await api.sbQ("karigar_order_assignments", {
        method: "POST",
        body: draftKarigars.map(r => ({
          karigar_id: r.karigar_id, order_id: orderId,
          agreed_rate: parseFloat(r.agreed_rate), notes: r.notes || null,
        })),
      })
    }
    toast.success("Order " + orderNum + " saved")
    setSaving(false); setNewOpen(false)
    offsetRef.current = 0; fetchPage(false)
    if (refreshSub) refreshSub()
  }

  async function saveOrderItems(orderId, custIds, sel) {
    for (const cid of custIds) {
      for (const it of (sel[cid]?.items || [])) {
        const dsT = (it.dsReshmi ? (it.dsReshmiPrice || 300) : 0) + (it.dsJaali ? (it.dsJaaliPrice || 500) : 0) + (it.dsSada ? (it.dsSadaPrice || 200) : 0)
        await api.sbQ("order_items", { method: "POST", body: [{
          order_id: orderId, customer_id: cid, item_type: it.category,
          quantity: it.qty || 1, price: it.price || 0,
          double_stitch: it.dsReshmi || it.dsJaali || it.dsSada,
          ds_reshmi: it.dsReshmi || false, ds_jaali: it.dsJaali || false, ds_sada: it.dsSada || false,
          ds_reshmi_price: it.dsReshmiPrice || 300, ds_jaali_price: it.dsJaaliPrice || 500, ds_sada_price: it.dsSadaPrice || 200,
          double_stitch_price: dsT,
          line_total: (it.price || 0) * (it.qty || 1) + dsT * (it.qty || 1),
        }] })
      }
    }
  }

  // ── Product-tour demo actions (registered for the guided tour) ─────────
  useEffect(() => {
    const unregs = [
      // Open the New Order dialog, select the demo customer and jump to step 2
      // so the items/details screen is visible.
      tourCtl.register("openNewOrderForDemo", async (custId) => {
        await openNewOrder()
        if (custId) {
          setSelCusts({ [String(custId)]: { items: [] } })
          // let state settle, then advance to the details step
          await new Promise(r => setTimeout(r, 200))
          await goStep2()
        }
      }),
      // Create a REAL order for the demo customer and open its view. Returns
      // the new order id, or null if the plan's order limit blocks it.
      tourCtl.register("createDemoOrder", async (custId) => {
        if (!custId) return null
        if (maxOrders != null && ordersUsed >= maxOrders) return null
        const seq = await getNextOrderSeq(api)
        const today = new Date().toISOString().slice(0, 10)
        const due = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)
        const body = {
          order_number: "#" + seq, order_seq: seq, status: "pending",
          booking_date: today, delivery_date: due, discount: 0,
          notes: "Created by the product tour — safe to delete.",
          total_amount: 2500, customer_ids: JSON.stringify([String(custId)]),
        }
        const rO = await api.sbQ("orders", { method: "POST", body: [body] })
        if (rO.error || !rO.data) return null
        const orderId = rO.data[0].id
        await api.sbQ("order_items", { method: "POST", body: [{
          order_id: orderId, customer_id: custId, item_type: "Shalwar Qameez",
          quantity: 1, price: 2500, double_stitch: false,
          ds_reshmi: false, ds_jaali: false, ds_sada: false,
          ds_reshmi_price: 300, ds_jaali_price: 500, ds_sada_price: 200,
          double_stitch_price: 0, line_total: 2500,
        }] })
        if (refreshSub) refreshSub()
        offsetRef.current = 0; fetchPage(false)
        await openViewOrder(orderId)
        return orderId
      }),
      // Delete a demo order (items first, then the order row).
      tourCtl.register("deleteDemoOrder", async (orderId) => {
        if (!orderId) return
        await api.sbQ("order_items", { method: "DELETE", query: "order_id=eq." + orderId })
        await api.sbQ("orders", { method: "DELETE", query: "id=eq." + orderId })
        if (refreshSub) refreshSub()
        offsetRef.current = 0; fetchPage(false)
      }),
      tourCtl.register("closeOrderDialogs", () => { setNewOpen(false); setViewOpen(false) }),
    ]
    return () => unregs.forEach(u => u && u())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxOrders, ordersUsed])

  // ── View order ────────────────────────────────────────────────────
  async function openViewOrder(id) {
    setViewOpen(true); setViewOrder(null); setViewItems([]); setViewPayments([]); setViewLoading(true)
    const r = await api.sbQ("orders", { query: "id=eq." + id })
    const o = r.data && r.data[0]; if (!o) { setViewLoading(false); return }
    setViewOrder(o)
    const rItems = await api.sbQ("order_items", { query: "order_id=eq." + id, order: "id.asc" })
    setViewItems(rItems.data || [])
    await loadViewPayments(id)

    // Fetch any customers referenced by this order that aren't in the in-memory cache,
    // so the invoice print always shows the customer number.
    const uniqueCids = [...new Set((rItems.data || []).map(i => String(i.customer_id)))]
    const cm = custMap()
    const missingCustIds = uniqueCids.filter(cid => !cm[cid])
    if (missingCustIds.length) {
      const rMiss = await api.sbQ("customers", {
        query: "id=in.(" + missingCustIds.join(",") + ")",
        limit: missingCustIds.length,
      })
      if (rMiss.data) {
        setCustResults(prev => {
          const m = new Map(prev.map(c => [String(c.id), c]))
          rMiss.data.forEach(c => m.set(String(c.id), c))
          return [...m.values()]
        })
      }
    }

    setViewLoading(false)
  }

  async function changeStatus(orderId, newStatus) {
    const r = await api.sbQ("orders", { method: "PATCH", query: "id=eq." + orderId, body: { status: newStatus } })
    if (r.error) { toast.error(r.error.message); return }
    setViewOrder(prev => prev ? { ...prev, status: newStatus } : prev)
    setOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, status: newStatus } : o))
    toast.success("Status updated to " + cap(newStatus))
  }

  // ── Edit order ─────────────────────────────────────────────────────
  async function openEditOrder(id) {
    setEditId(id); setEditSelCusts({}); setEditCustBar([])
    setViewOpen(false); setEditOpen(true); setEditLoading(true)
    const [rO, cats] = await Promise.all([
      api.sbQ("orders", { query: "id=eq." + id }),
      catsCache.length ? Promise.resolve(catsCache) : api.sbQ("item_categories", { order: "id.asc" }).then(r => r.data || []),
    ])
    if (!catsCache.length) setCatsCache(cats)
    const o = rO.data && rO.data[0]; if (!o) { setEditLoading(false); return }
    setEditNum(o.order_number || ""); setEditStatus(o.status || "pending")
    setEditBD(o.booking_date ? o.booking_date.slice(0, 10) : "")
    setEditDD(o.delivery_date ? o.delivery_date.slice(0, 10) : "")
    setEditDisc(o.discount || ""); setEditNotes(o.notes || "")

    const rItems = await api.sbQ("order_items", { query: "order_id=eq." + id, order: "id.asc" })
    const oItems = rItems.data || []
    const cm = custMap()

    let uniqueCids = [...new Set(oItems.map(i => String(i.customer_id)))]
    if (!uniqueCids.length) {
      try { uniqueCids = JSON.parse(o.customer_ids || "[]").map(String) } catch {}
    }

    const custMeasMap = {}
    const newEditSel = {}
    for (const cid of uniqueCids) {
      newEditSel[cid] = { items: [] }
      custMeasMap[cid] = {}
      const rCI = await api.sbQ("customer_items", { query: "customer_id=eq." + cid })
      for (const ci of (rCI.data || [])) {
        const rM = await api.sbQ("customer_measurements", { query: "customer_item_id=eq." + ci.id + "&is_current=eq.true", limit: 1 })
        const measVals = {}
        if (rM.data && rM.data[0]) {
          const rV = await api.sbQ("customer_measurement_values", { query: "measurement_id=eq." + rM.data[0].id })
          ;(rV.data || []).forEach(v => { measVals[v.measurement_key] = v.value })
        }
        custMeasMap[cid][ci.category_name] = measVals
      }
    }

    const seen = {}
    for (const oi of oItems) {
      const cid = String(oi.customer_id)
      const key = cid + ":" + oi.item_type
      if (seen[key]) continue; seen[key] = true
      const measVals = (custMeasMap[cid] && custMeasMap[cid][oi.item_type]) || {}
      const catRow = cats.find(c => c.name === oi.item_type)
      let rate = null
      if (catRow) { const rR = await api.sbQ("rates", { query: "category_id=eq." + catRow.id, limit: 1 }); rate = rR.data && rR.data[0] }
      newEditSel[cid].items.push({
        category: oi.item_type, measVals, qty: oi.quantity || 1, price: oi.price || 0,
        dsReshmi: oi.ds_reshmi || false, dsJaali: oi.ds_jaali || false, dsSada: oi.ds_sada || false,
        dsReshmiPrice: oi.ds_reshmi_price || (rate ? rate.ds_reshmi_price : 300) || 300,
        dsJaaliPrice:  oi.ds_jaali_price  || (rate ? rate.ds_jaali_price  : 500) || 500,
        dsSadaPrice:   oi.ds_sada_price   || (rate ? rate.ds_sada_price   : 200) || 200,
        rateLabel: rate ? rate.label : oi.item_type, orderItemId: oi.id,
      })
    }

    setEditSelCusts(newEditSel)
    setEditCustBar(uniqueCids.map(cid => cm[cid] || { id: cid, first_name: "Customer" }))
    setEditLoading(false)
  }

  async function saveEditOrder() {
    const custIds = Object.keys(editSelCusts)
    if (!editNum) { toast.error("Order number required"); return }
    setEditSaving(true)
    const grand = calcTotal(editSelCusts, editDisc)
    const body = {
      order_number: editNum, status: editStatus,
      booking_date: editBD || null, delivery_date: editDD || null,
      discount: parseFloat(editDisc) || 0,
      notes: editNotes.trim() || null,
      total_amount: grand, customer_ids: JSON.stringify(custIds),
    }
    const rO = await api.sbQ("orders", { method: "PATCH", query: "id=eq." + editId, body })
    if (rO.error) { toast.error(rO.error.message); setEditSaving(false); return }
    await api.sbQ("order_items", { method: "DELETE", query: "order_id=eq." + editId })
    await saveOrderItems(editId, custIds, editSelCusts)
    toast.success("Order " + editNum + " updated")
    setEditSaving(false); setEditOpen(false)
    offsetRef.current = 0; fetchPage(false)
  }

  // ── Print invoice ────────────────────────────────────────────────
  function printInvoice() {
    const el = document.getElementById("inv-print-area")
    if (!el || !el.innerHTML.trim()) { toast.error("Open an order first"); return }
    const win = window.open("", "_blank", "width=800,height=1000")
    if (!win) { alert("Please allow popups to print."); return }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <title>Invoice</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0 }
        html { -webkit-text-size-adjust: 100%; text-size-adjust: 100% }
        body { font-family: "DM Sans", sans-serif; font-size: 11px; color: #111; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact }
        .inv-2up { width: 186mm; height: 271mm; margin: 0 auto; position: relative }
        .inv-half { position: absolute; left: 0; width: 186mm; height: 135.5mm; display: flex; align-items: center; justify-content: center; overflow: hidden }
        .inv-half.half-top    { top: 0 }
        .inv-card { width: 135mm; height: 186mm; border: 1px dashed #bbb; padding: 10px 12px; transform: rotate(-90deg); transform-origin: center center; display: flex; flex-direction: column }
        table { width: 100%; border-collapse: collapse }
        th { background: #ffffff; color: #000000; padding: 4px 6px; font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; text-align: left; border-bottom: 1px solid #E4DED5 }
        td { padding: 4px 6px; border-bottom: 1px solid #E4DED5; font-size: 10.5px }

        .inv-name          { font-weight: 700; font-size: 13px }
        .inv-name-ds       { font-weight: 600; font-size: 13px }
        .inv-price         { font-weight: 700; font-size: 13px }
        .inv-qty           { text-align: center; font-size: 13px; font-weight: 700 }
        .inv-row-label     { font-weight: 600; font-size: 13px }
        .inv-invoice-label { font-size: 26px; font-weight: 700; color: #000000 }
        .inv-date          { font-size: 10.5px; color: #000000 }
        .inv-meta          { font-size: 10.5px; color: #000000 }
        .inv-cust-name     { padding: 4px 0; margin-bottom: 6px; font-size: 13px; font-weight: 600 }
        .inv-subtotal      { display: flex; gap: 24px; font-size: 13px; margin-bottom: 3px }
        .inv-discount      { display: flex; gap: 24px; font-size: 13px; margin-bottom: 3px }
        .inv-discount-label{ color: #000000 }
        .inv-discount-val  { color: #000000 }
        .inv-grand         { display: flex; gap: 24px; font-size: 13px; font-weight: 700; color: #000000; padding-top: 4px; border-top: 2px solid #000000; margin-top: 2px }
        .inv-footer        { margin-top: 40px; padding-top: 6px; text-align: center; font-size: 10.5px; line-height: 1.55 }
        .inv-phone         { font-weight: 700; font-size: 12px; margin-top: 2px }

        .inv-2up svg { width: 12px !important; height: 12px !important }
        .inv-card img[alt="Saifi Tailor Logo"] { width: 80px !important }
        .inv-card table { font-size: 10.5px !important }
        .inv-card [style*="margin-bottom:14px"] { margin-bottom: 6px !important; padding-bottom: 6px !important; gap: 6px !important }
        .inv-card [style*="padding:12px 0"] { padding: 4px 0 !important }
        .inv-card [style*="margin-top:8px"] { margin-top: 4px !important }

        @media print {
          body { padding: 0 }
          @page { size: A4 portrait; margin: 10mm 12mm }
          table, tr, th, td { break-inside: avoid; page-break-inside: avoid }
        }
      </style>
      </head><body>${el.innerHTML}
      <script>
      function fitCards(){
        var pxPerMm = 96/25.4;
        var maxHmm = 186;
        var halves = document.querySelectorAll('.inv-half');
        for (var i=0;i<halves.length;i++){
          var card = halves[i].firstElementChild;
          if(!card) continue;
          card.style.height = 'auto';
          var needHmm = card.scrollHeight/pxPerMm;
          card.style.height = '186mm';
          if(needHmm>maxHmm && needHmm>0){
            var s = maxHmm/needHmm;
            card.style.transform = 'rotate(-90deg) scale('+s+')';
          }
        }
      }
      window.onload=function(){fitCards();window.print();};
      <\/script></body></html>`)
    win.document.close()
  }

  // ── Order card ─────────────────────────────────────────────────────
  function OrderCard({ order }) {
    const cm = custMap()
    let custNames = ""
    try {
      const ids = JSON.parse(order.customer_ids || "[]")
      custNames = ids.map(cid => {
        const c = cm[String(cid)]
        if (!c) return ""
        const n = nm(c)
        return c.customer_number ? `${n} (#${c.customer_number})` : n
      }).filter(Boolean).join(", ")
    } catch {}
    const pay = paymentInfo(order.total_amount, paidByOrder[order.id])
    return (
      <div className="oc rounded-xl" onClick={() => openViewOrder(order.id)} style={{ cursor: "pointer" }}>
        <div className="oc-hd">
          <div>
            <div className="oc-num">{order.order_number || "--"}</div>
            {custNames && <div style={{ fontSize: 11.5, color: "hsl(var(--muted-foreground))", fontWeight: 500, marginTop: 2 }}>{custNames}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span className={"bdg " + (STATUS_CLS[order.status] || "bdf")}>{cap(order.status || "pending")}</span>
            {pay.total > 0 && <span className="bdg" style={{ background: "transparent", border: "1.5px solid " + pay.color, color: pay.color }}>{pay.label}</span>}
          </div>
        </div>
        <div className="oc-meta">
          <div><div className="cmil">Booking</div><div className="cmiv">{order.booking_date ? fmtDate(order.booking_date) : "--"}</div></div>
          <div><div className="cmil">Delivery</div><div className="cmiv">{order.delivery_date ? fmtDate(order.delivery_date) : "--"}</div></div>
          <div><div className="cmil">Total</div><div className="cmiv" style={{ color: "hsl(var(--primary))", fontWeight: 700 }}>Rs {order.total_amount || 0}</div></div>
          <div><div className="cmil">Discount</div><div className="cmiv" style={{ color: "hsl(var(--destructive))" }}>Rs {order.discount || 0}</div></div>
          <div><div className="cmil">Paid</div><div className="cmiv" style={{ color: "hsl(142 76% 36%)", fontWeight: 700 }}>Rs {pay.paid}</div></div>
          <div><div className="cmil">Balance</div><div className="cmiv" style={{ color: pay.balance > 0 ? "hsl(var(--destructive))" : "hsl(142 76% 36%)", fontWeight: 700 }}>Rs {pay.balance}</div></div>
        </div>
      </div>
    )
  }

  // ── Items panel (shared by new + edit) ─────────────────────────────
  function ItemsPanel({ sel, setSel, custIds }) {
    const [catSelects, setCatSelects] = useState({})
    return (
      <>
        {custIds.map((cid) => {
          const c   = custAll.find(x => String(x.id) === String(cid)) || {}
          const s   = sel[cid] || { items: [] }
          return (
            <div key={cid} style={{ border: "1.5px solid hsl(var(--border))", borderRadius: "var(--radius)", marginBottom: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "hsl(var(--muted))" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: gradientAvatar(cid || nm(c)), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>{ini(c)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{nm(c)}</div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{c.customer_number || "--"}</div>
                </div>
              </div>

              {!s.items || !s.items.length ? (
                <div style={{ padding: "12px 14px" }}>
                  <p style={{ fontSize: 12.5, color: "hsl(var(--muted-foreground))" }}>No measurements on file for this customer.</p>
                </div>
              ) : s.items.map((item, ii) => {
                const iCol = CATS[item.category] ? CATS[item.category].color : "#888"
                const hasMeas = Object.keys(item.measVals || {}).length > 0
                return (
                  <div key={ii} style={{ padding: "12px 14px", borderTop: "1px solid hsl(var(--border))" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: iCol }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: iCol }}>{item.category}</span>
                      {item.rateLabel && <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginLeft: 4 }}>{item.rateLabel}</span>}
                      <Button variant="ghost" size="sm" style={{ marginLeft: "auto", color: "hsl(var(--destructive))" }}
                        onClick={() => removeItem(cid, ii, sel, setSel)}>Remove</Button>
                    </div>

                    {hasMeas && (
                      <div style={{ marginBottom: 10 }}>
                        <Button variant="outline" size="sm"
                          onClick={() => { setMeasData({ cat: item.category, vals: item.measVals }); setMeasOpen(true) }}>
                          Open Measurements
                        </Button>
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      {/* Uncontrolled inputs: they hold their own value while typing and
                          only commit to state on blur. This prevents a parent re-render
                          per keystroke (which would remount this panel and steal focus).
                          The key ties the DOM input to this item so its defaultValue is
                          correct after add/remove. */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Qty</label>
                        <input
                          key={`qty-${cid}-${ii}`}
                          type="number"
                          min="1"
                          inputMode="numeric"
                          defaultValue={item.qty != null ? item.qty : 1}
                          onBlur={e => {
                            const parsed = parseInt(e.target.value, 10)
                            const val = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
                            e.target.value = val
                            updateItem(cid, ii, "qty", val, sel, setSel)
                          }}
                          style={{ width: 55, border: "1.5px solid hsl(var(--border))", borderRadius: 6, padding: "5px 8px", fontSize: 13, fontWeight: 600 }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Price Rs</label>
                        <input
                          key={`price-${cid}-${ii}`}
                          type="text"
                          inputMode="decimal"
                          defaultValue={String(item.price != null ? item.price : 0)}
                          onBlur={e => {
                            const parsed = parseFloat(e.target.value) || 0
                            e.target.value = parsed
                            updateItem(cid, ii, "price", parsed, sel, setSel)
                          }}
                          style={{ width: 80, border: "1.5px solid hsl(var(--border))", borderRadius: 6, padding: "5px 8px", fontSize: 13, fontWeight: 600 }} />
                      </div>
                    </div>

                    {/* DS Reshmi & DS Jaali — shadcn Switch */}
                    {item.category === "Shalwar Qameez" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                        <div className="ds-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Switch
                            id={`ds-reshmi-${cid}-${ii}`}
                            checked={item.dsReshmi}
                            onCheckedChange={v => updateItem(cid, ii, "dsReshmi", v, sel, setSel)}
                          />
                          <label htmlFor={`ds-reshmi-${cid}-${ii}`} style={{ fontSize: 12.5, cursor: "pointer", userSelect: "none" }}>
                            DS Reshmi
                            <span style={{ color: "hsl(var(--amber-accent))", fontWeight: 700, marginLeft: 6 }}>
                              +Rs {item.dsReshmiPrice || 300}
                            </span>
                          </label>
                        </div>
                        <div className="ds-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Switch
                            id={`ds-jaali-${cid}-${ii}`}
                            checked={item.dsJaali}
                            onCheckedChange={v => updateItem(cid, ii, "dsJaali", v, sel, setSel)}
                          />
                          <label htmlFor={`ds-jaali-${cid}-${ii}`} style={{ fontSize: 12.5, cursor: "pointer", userSelect: "none" }}>
                            DS Jaali Pancha
                            <span style={{ color: "hsl(var(--amber-accent))", fontWeight: 700, marginLeft: 6 }}>
                              +Rs {item.dsJaaliPrice || 500}
                            </span>
                          </label>
                        </div>
                        <div className="ds-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Switch
                            id={`ds-sada-${cid}-${ii}`}
                            checked={item.dsSada}
                            onCheckedChange={v => updateItem(cid, ii, "dsSada", v, sel, setSel)}
                          />
                          <label htmlFor={`ds-sada-${cid}-${ii}`} style={{ fontSize: 12.5, cursor: "pointer", userSelect: "none" }}>
                            DS Sada
                            <span style={{ color: "hsl(var(--amber-accent))", fontWeight: 700, marginLeft: 6 }}>
                              +Rs {item.dsSadaPrice || 200}
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Add item row */}
              <div style={{ padding: "10px 14px", borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--muted))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={catSelects[cid] || ""}
                    onChange={e => setCatSelects(p => ({ ...p, [cid]: e.target.value }))}
                    style={{ flex: 1, minWidth: 140, border: "1.5px solid hsl(var(--border))", borderRadius: 6, padding: "6px 10px", fontSize: 13, fontWeight: 600, background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}>
                    <option value="">-- Pick item to add --</option>
                    {(() => {
                      // Built-in categories first, then any custom ones from the DB
                      const builtin = Object.keys(CATS)
                      const custom  = catsCache.map(c => c.name).filter(n => !CATS[n])
                      return [...builtin, ...custom].map(n => <option key={n} value={n}>{n}</option>)
                    })()}
                  </select>
                  <Button size="sm" disabled={!!addingItem[cid]} onClick={async () => {
                    await addItem(cid, catSelects[cid], sel, setSel)
                    setCatSelects(p => ({ ...p, [cid]: "" }))
                  }}>
                    {addingItem[cid]
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span className="spin" style={{ width: 13, height: 13, borderWidth: 2, borderColor: "hsl(var(--primary-foreground) / 0.35)", borderTopColor: "hsl(var(--primary-foreground))" }} />
                          {lang === "ur" ? "شامل ہو رہا ہے…" : "Adding…"}
                        </span>
                      : "+ Add Item"}
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </>
    )
  }

  // ── View order invoice ────────────────────────────────────────────
  function buildInvoiceHtml(o, items, payments = []) {
    const cm = custMap()
    let uniqueCids = [...new Set(items.map(i => String(i.customer_id)))]
    if (!uniqueCids.length) { try { uniqueCids = JSON.parse(o.customer_ids || "[]").map(String) } catch {} }
    const custNames = uniqueCids.map(cid => {
      const c = cm[cid] || {}
      const n = nm(c)
      if (!n) return ""
      return c.customer_number ? `${n} (#${c.customer_number})` : n
    }).filter(Boolean).join(", ")
    const invToday = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

    let itemsHtml = "", computedSub = 0
    items.forEach(it => {
      const c = cm[String(it.customer_id)] || {}
      const qty = it.quantity || 1, basePrice = it.price || 0
      const dsRA = it.ds_reshmi ? (it.ds_reshmi_price || 300) * qty : 0
      const dsJA = it.ds_jaali  ? (it.ds_jaali_price  || 500) * qty : 0
      const dsSA = it.ds_sada   ? (it.ds_sada_price   || 200) * qty : 0
      computedSub += basePrice * qty + dsRA + dsJA + dsSA
      itemsHtml += `<tr>
        <td class="inv-name">${it.item_type}</td>
        <td class="inv-price">Rs ${basePrice}</td>
        <td class="inv-qty">${qty}</td>
        <td class="inv-price">Rs ${basePrice * qty}</td>
      </tr>`
      if (it.ds_reshmi) {
        itemsHtml += `<tr>
          <td class="inv-name-ds">↳ DS Reshmi</td>
          <td class="inv-price">Rs ${it.ds_reshmi_price || 300}</td>
          <td class="inv-qty">${qty}</td>
          <td class="inv-price">Rs ${dsRA}</td>
        </tr>`
      }
      if (it.ds_jaali) {
        itemsHtml += `<tr>
          <td class="inv-name-ds">↳ DS Jaali Pancha</td>
          <td class="inv-price">Rs ${it.ds_jaali_price || 500}</td>
          <td class="inv-qty">${qty}</td>
          <td class="inv-price">Rs ${dsJA}</td>
        </tr>`
      }
      if (it.ds_sada) {
        itemsHtml += `<tr>
          <td class="inv-name-ds">↳ DS Sada</td>
          <td class="inv-price">Rs ${it.ds_sada_price || 200}</td>
          <td class="inv-qty">${qty}</td>
          <td class="inv-price">Rs ${dsSA}</td>
        </tr>`
      }
    })

    const disc = o.discount || 0
    const grand = o.total_amount || 0
    const paidSum = (payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
    const balance = Math.max((parseFloat(grand) || 0) - paidSum, 0)

    const cardHtml = `
      <div class="inv-card">
        <div
          style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:12px;gap:10px">
          <div>
            <img src="https://i.imgur.com/2uvCI4m.png" alt="Saifi Tailor Logo" style="width:120px;margin-bottom:4px"/>            
          </div>
          <div style="text-align:right">
            <div class="inv-invoice-label">INVOICE</div>
            <div class="inv-meta" style="font-weight:700">#${o.order_number || "--"}</div>
            <div class="inv-date">${invToday}</div>
            ${o.booking_date ? `<div class="inv-meta">Booked: ${fmtDate(o.booking_date)}</div>` : ""}
            ${o.delivery_date ? `<div class="inv-meta">Delivery: ${fmtDate(o.delivery_date)}</div>` : ""}
            <div class="inv-contact" style="display:flex;align-items:center;justify-content:right;gap:8px;margin-top:8px">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
                <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
              </svg>
              <span class="inv-meta">0301-6058028</span>
            </div>
          </div>
        </div>

        <div class="inv-cust-name">
          ${custNames}
        </div>

        <div class="tc">
          <table style="min-width:0;font-size:15px">
            <thead>
              <tr>                
                <th>Item</th>
                <th>Price</th>
                <th style="text-align:center">Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml || '<tr><td colspan="5" style="text-align:center;color:#999;padding:16px">No items</td></tr>'}</tbody>
          </table>
        </div>

        <div style="display:flex;flex-direction:column;align-items:flex-end;padding:12px 0">
          <div class="inv-subtotal">
            <span>Subtotal</span>
            <span>Rs ${computedSub}</span>
          </div>
          ${disc > 0 ? `
            <div class="inv-discount">
              <span class="inv-discount-label">Discount</span>
              <span class="inv-discount-val"> Rs ${disc}</span>
            </div>
          ` : ""}
          <div class="inv-grand">
            <span>Grand Total</span>
            <span>Rs ${grand}</span>
          </div>
          ${paidSum > 0 ? `
            <div class="inv-subtotal" style="margin-top:8px">
              <span>Paid</span>
              <span>Rs ${paidSum}</span>
            </div>
            <div class="inv-grand">
              <span>Balance Due</span>
              <span>Rs ${balance}</span>
            </div>
          ` : ""}
        </div>

        <div class="inv-footer">
          <div class="inv-footer-text">
            لیڈیز جنٹس واسکوٹ پینٹ کوٹ کی سلائی کا بہترین مرکز<br/>
            نیز ہر قسم کی ڈیزائننگ کی سہولت موجود ہے<br/>
            ریلوے گلی نمبر 2 سانگلہ، ہل
          </div>
          <div class="inv-contact" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16">
              <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/>
            </svg>
            <span class="inv-phone">0301-6058028</span>
          </div>
        </div>
      </div>`
    return `
      <div class="inv-2up">
        <div class="inv-half half-top">${cardHtml}</div>
      </div>`
  }

  const shownCusts = custSearch.trim() ? custResults : customers.slice(0, 60)

  const STATUS_LABELS = { pending: "Pending", in_progress: "In Progress", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled" }

  return (
    <div id="s-orders">
      {/* Toolbar */}
      <div className="toolbar">
        <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
          <input className="srch" id="or-q" placeholder={tr("search_orders", lang)} onChange={e => debouncedSearch(e.target.value)} />
          <select id="or-st" className="sel-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <Button id="lbl-add-order" data-tour="add-order" onClick={openNewOrder}>{tr("add_order", lang)}</Button>
      </div>
      <div id="osub" style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
        {orders.length} orders
        {maxOrders != null && (
          <span style={{ marginLeft: 8, fontWeight: 600, color: atOrderLimit ? "hsl(var(--destructive))" : "inherit" }}>
            · {ordersUsed} / {maxOrders} used{atOrderLimit ? " — limit reached" : ""}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="ogrid" id="ogrid">
        {!loading && orders.length === 0 && <div className="empty" style={{ gridColumn: "1/-1" }}><h3>No orders found</h3></div>}
        {orders.map(o => <OrderCard key={o.id} order={o} />)}
        {loading && <div className="ld" style={{ gridColumn: "1/-1" }}><div className="spin" /></div>}
        {hasMore && !loading && <div ref={sentinelRef} style={{ gridColumn: "1/-1", height: 40 }} />}
      </div>

      {/* ── New Order Dialog ── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-2xl" id="m-order-new">
          <DialogHeader><DialogTitle>New Order</DialogTitle></DialogHeader>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {[1, 2].map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600,
                color: step === s ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }} id={"ord-si-" + s}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                  background: step >= s ? "hsl(var(--primary))" : "hsl(var(--border))", color: step >= s ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }}>{s}</div>
                {s === 1 ? "Select Customer" : "Order Details"}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div id="ord-panel-1">
              <Input placeholder="Search customers..." value={custSearch} onChange={e => { setCustSearch(e.target.value); debouncedCustSearch(e.target.value) }} style={{ marginBottom: 10 }} />
              <div id="of-cust-list" style={{ display: "flex", flexDirection: "column", maxHeight: 320, overflowY: "auto" }}>
                {custSearching ? <p style={{ padding: "20px 0", textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>Searching…</p> :
                shownCusts.length === 0 ? <p style={{ padding: "20px 0", textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>No customers found</p> :
                  shownCusts.map((c) => {
                    const sel = !!selCusts[c.id]
                    return (
                      <div key={c.id} className={"ord-cust-card" + (sel ? " selected" : "")} onClick={() => toggleSelCust(c.id)}
                        style={{ display: "flex", alignItems: "center", cursor: "pointer"}}>
                        <div className="check" style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (sel ? "hsl(var(--primary))" : "hsl(var(--border))"),
                          background: sel ? "hsl(var(--primary))" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {sel && <svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1,5 4,8 9,2" stroke="hsl(var(--primary-foreground))" strokeWidth="2" fill="none"/></svg>}
                        </div>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: gradientAvatar(c.id || nm(c)), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>{ini(c)}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{nm(c)}</div>
                          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{c.customer_number || "--"}</div>
                        </div>
                      </div>
                    )
                  })}
              </div>
              {Object.keys(selCusts).length > 0 && (
                <div id="ord-sel-preview" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {Object.keys(selCusts).map(cid => {
                    const c = custAll.find(x => String(x.id) === String(cid)) || {}
                    return <div key={cid} className="ord-chip">{nm(c)} <span onClick={() => toggleSelCust(cid)} style={{ cursor: "pointer", opacity: 0.7 }}>✕</span></div>
                  })}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div id="ord-panel-2">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {Object.keys(selCusts).map(cid => {
                  const c = custAll.find(x => String(x.id) === String(cid)) || {}
                  return <div key={cid} className="ord-chip">{nm(c)}</div>
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div className="fld"><Label>Order #</Label><Input id="of-num" value={orderNum} onChange={e => setOrderNum(e.target.value)} /></div>
                <div className="fld">
                  <Label>Status</Label>
                  <select id="of-st" className="sel-sm" style={{ width: "100%" }} value={orderStatus} onChange={e => setOrderStatus(e.target.value)}>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="fld"><Label>Booking Date</Label><Input id="of-bd" type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} /></div>
                <div className="fld"><Label>Delivery Date</Label><Input id="of-dd" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} /></div>
                <div className="fld"><Label>Discount (Rs)</Label><Input id="of-disc" type="number" value={discount} onChange={e => setDiscount(e.target.value)} /></div>
                <div className="fld"><Label>Advance Received (Rs)</Label><Input id="of-adv" type="number" min="0" placeholder="0" value={advance} onChange={e => setAdvance(e.target.value)} /></div>
                <div className="fld col-span-2">
                  <Label>Notes</Label>
                  <Textarea id="of-no" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Order notes..." className="resize-y" />
                </div>
              </div>
              <div id="of-selected-custs">
                <ItemsPanel sel={selCusts} setSel={setSelCusts} custIds={Object.keys(selCusts)} />
              </div>
              {/* {!karigarHidden && (
                <KarigarAssignmentSection
                  api={api}
                  draftRows={draftKarigars}
                  onDraftChange={setDraftKarigars}
                  locked={atKarigarLimit}
                />
              )} */}
            </div>
          )}

          <DialogFooter>
            {step === 1 ? (
              <>
                <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
                <Button id="ord-next-btn" onClick={goStep2} disabled={saving || !Object.keys(selCusts).length}>
                  {saving ? "Loading…" : "Next: Order Details →"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                <Button id="order-save-btn" onClick={saveNewOrder} disabled={saving}>
                  {saving ? "Saving…" : tr("save_order", lang)}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Order Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl" id="m-order-edit">
          <DialogHeader><DialogTitle>Edit Order</DialogTitle></DialogHeader>
          <div id="edit-ord-custs" style={{ marginBottom: 12 }}>
            {editCustBar.map(c => <div key={c.id} className="ord-chip" style={{ display: "inline-flex", marginRight: 6 }}>{nm(c)}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div className="fld"><Label>Order #</Label><Input id="eof-num" value={editNum} onChange={e => setEditNum(e.target.value)} /></div>
            <div className="fld">
              <Label>Status</Label>
              <select id="eof-st" className="sel-sm" style={{ width: "100%" }} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="fld"><Label>Booking Date</Label><Input id="eof-bd" type="date" value={editBD} onChange={e => setEditBD(e.target.value)} /></div>
            <div className="fld"><Label>Delivery Date</Label><Input id="eof-dd" type="date" value={editDD} onChange={e => setEditDD(e.target.value)} /></div>
            <div className="fld col-span-2"><Label>Discount (Rs)</Label><Input id="eof-disc" type="number" value={editDisc} onChange={e => setEditDisc(e.target.value)} /></div>
            <div className="fld col-span-2">
              <Label>Notes</Label>
              <Textarea id="eof-no" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Order notes..." className="resize-y" />
            </div>
          </div>
          <div id="eof-selected-custs">
            {editLoading ? (
              <div className="ld" style={{ padding: 32, flexDirection: "column", gap: 10 }}>
                <div className="spin" style={{ width: 22, height: 22 }} />
                <span style={{ fontSize: 13 }}>{lang === "ur" ? "اشیاء لوڈ ہو رہی ہیں…" : "Loading items…"}</span>
              </div>
            ) : (
              <ItemsPanel sel={editSelCusts} setSel={setEditSelCusts} custIds={Object.keys(editSelCusts)} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button id="edit-order-save-btn" onClick={saveEditOrder} disabled={editSaving}>
              {editSaving ? "Saving…" : tr("save_order", lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Order Dialog ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-2xl" id="m-order-view">
          <DialogHeader>
            <DialogTitle id="vo-title">
              {viewOrder ? (() => {
                const cm = custMap()
                let custNames = ""
                try {
                  const ids = JSON.parse(viewOrder.customer_ids || "[]")
                  custNames = ids.map(cid => { const c = cm[String(cid)]; return c ? nm(c) : "" }).filter(Boolean).join(", ")
                } catch {}
                return (viewOrder.order_number || "Order") + (custNames ? " — " + custNames : "")
              })() : "Order"}
            </DialogTitle>
          </DialogHeader>
          <div id="vo-body">
            {viewLoading ? <div className="ld"><div className="spin" /></div> : viewOrder ? (
              <div className="dg" style={{flex:1}}>                
                  <div className="dblk">
                    <div className="dbt">Order Info</div>
                    <div className="dr"><span className="dk">Order #</span><span className="dv" style={{ color: "hsl(var(--primary))" }}>{viewOrder.order_number || "--"}</span></div>
                    <div className="dr" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                      <span className="dk">Status</span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {Object.entries(STATUS_LABELS).map(([s, l]) => (
                          <button key={s} onClick={() => changeStatus(viewOrder.id, s)}
                            style={{ padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                              border: "2px solid " + (viewOrder.status === s ? "hsl(var(--primary))" : "hsl(var(--border))"),
                              background: viewOrder.status === s ? "hsl(var(--primary))" : "transparent",
                              color: viewOrder.status === s ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="dr"><span className="dk">Booking</span><span className="dv">{viewOrder.booking_date ? fmtDate(viewOrder.booking_date) : "--"}</span></div>
                    <div className="dr"><span className="dk">Delivery</span><span className="dv">{viewOrder.delivery_date ? fmtDate(viewOrder.delivery_date) : "--"}</span></div>
                    <div className="dr"><span className="dk">Notes</span><span className="dv">{viewOrder.notes || "--"}</span></div>
                  </div>                  
                  {!karigarHidden && (
                    <div className="dblk">
                      <KarigarAssignmentSection orderId={viewOrder.id} api={api} locked={atKarigarLimit} />
                    </div>
                  )}

                
                  <div className="dblk">
                    <div className="dbt">Pricing</div>
                    {/* Native pricing table for in-app display */}
                    {(() => {
                      const cm = custMap()
                      const dsArrow = lang === "ur" ? "↲" : "↳"
                      let computedSub = 0
                      // Each item's base row is immediately followed by its own DS addon
                      // rows (rather than collecting all DS rows into a separate list that
                      // gets appended after every item) so the pricing table stays grouped
                      // by item even when multiple items each have their own double salai.
                      const rows = viewItems.flatMap((it, idx) => {
                        const c = cm[String(it.customer_id)] || {}
                        const qty = it.quantity || 1
                        const base = it.price || 0
                        const dsRA = it.ds_reshmi ? (it.ds_reshmi_price || 300) * qty : 0
                        const dsJA = it.ds_jaali  ? (it.ds_jaali_price  || 500) * qty : 0
                        const dsSA = it.ds_sada   ? (it.ds_sada_price   || 200) * qty : 0
                        computedSub += base * qty + dsRA + dsJA + dsSA
                        const line = [
                          <tr key={idx}>
                            {/* <td style={{ fontWeight: 600 }}>{nm(c)}</td> */}
                            <td>{it.item_type}</td>
                            <td>Rs {base}</td>
                            <td style={{ textAlign: "center" }}>{qty}</td>
                            <td style={{ fontWeight: 700, color: "hsl(var(--primary))" }}>Rs {base * qty}</td>
                          </tr>
                        ]
                        if (it.ds_reshmi) line.push(
                          <tr key={"r"+idx} style={{ background: "hsl(var(--muted))" }}>
                            <td style={{fontWeight: 600 }}>{dsArrow} DS Reshmi</td>
                            <td>Rs {it.ds_reshmi_price || 300}</td>
                            <td style={{ textAlign: "center"}}>{qty}</td>
                            <td style={{ fontWeight: 700}}>Rs {(it.ds_reshmi_price || 300) * qty}</td>
                          </tr>
                        )
                        if (it.ds_jaali) line.push(
                          <tr key={"j"+idx} style={{ background: "hsl(var(--muted))" }}>
                            <td style={{fontWeight: 600 }}>{dsArrow} DS Jaali Pancha</td>
                            <td>Rs {it.ds_jaali_price || 500}</td>
                            <td style={{ textAlign: "center"}}>{qty}</td>
                            <td style={{ fontWeight: 700}}>Rs {(it.ds_jaali_price || 500) * qty}</td>
                          </tr>
                        )
                        if (it.ds_sada) line.push(
                          <tr key={"s"+idx} style={{ background: "hsl(var(--muted))" }}>
                            <td style={{fontWeight: 600 }}>{dsArrow} DS Sada</td>
                            <td>Rs {it.ds_sada_price || 200}</td>
                            <td style={{ textAlign: "center"}}>{qty}</td>
                            <td style={{ fontWeight: 700}}>Rs {(it.ds_sada_price || 200) * qty}</td>
                          </tr>
                        )
                        return line
                      })
                      const disc  = viewOrder.discount || 0
                      const grand = viewOrder.total_amount || 0
                      return (
                        <div>
                          <div className="tc">
                            <table>
                              <thead>
                                <tr><th>Item</th><th>Price</th><th style={{ textAlign: "center" }}>Qty</th><th>Total</th></tr>
                              </thead>
                              <tbody>
                                {rows}
                                {!viewItems.length && <tr><td colSpan={5} style={{ textAlign: "center", padding: 16, color: "hsl(var(--muted-foreground))" }}>No items</td></tr>}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, paddingTop: 10, marginTop: 4, borderTop: "1px solid hsl(var(--border))" }}>
                            <div style={{ display: "flex", gap: 32, fontSize: 15 }}>
                              <span style={{ color: "hsl(var(--muted-foreground))" }}>Subtotal</span>
                              <span>Rs {computedSub}</span>
                            </div>
                            {disc > 0 && (
                              <div style={{ display: "flex", gap: 32, fontSize: 12.5 }}>
                                <span style={{ color: "hsl(var(--muted-foreground))" }}>Discount</span>
                                <span style={{ color: "hsl(var(--destructive))" }}>− Rs {disc}</span>
                              </div>
                            )}
                            <div style={{ display: "flex", gap: 32, fontSize: 15, fontWeight: 700, color: "hsl(var(--primary))", paddingTop: 6, borderTop: "2px solid hsl(var(--border))", marginTop: 2 }}>
                              <span>Grand Total</span>
                              <span>Rs {grand}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Payments — advance + installments recorded against this order */}
                  <div className="dblk">
                    <div className="dbt" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Payments</span>
                      <Button size="sm" variant="outline" onClick={openPayDialog}>+ Add Payment</Button>
                    </div>
                    {(() => {
                      const paidSum = viewPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
                      const info = paymentInfo(viewOrder.total_amount, paidSum)
                      const stat = (label, val, color) => (
                        <div style={{ flex: 1, minWidth: 90 }}>
                          <div className="cmil">{label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: color || "hsl(var(--foreground))" }}>Rs {val}</div>
                        </div>
                      )
                      return (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <span className="bdg" style={{ background: "transparent", border: "1.5px solid " + info.color, color: info.color }}>{info.label}</span>
                          </div>
                          <div style={{ display: "flex", gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid hsl(var(--border))" }}>
                            {stat("Total", info.total, "hsl(var(--primary))")}
                            {stat("Paid", info.paid, "hsl(142 76% 36%)")}
                            {stat("Balance", info.balance, info.balance > 0 ? "hsl(var(--destructive))" : "hsl(142 76% 36%)")}
                          </div>
                          {viewPayments.length === 0 ? (
                            <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", fontStyle: "italic" }}>No payments recorded yet</p>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {viewPayments.map(p => {
                                const m = PAY_METHODS.find(x => x[0] === p.method)
                                return (
                                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                                    <span style={{ fontWeight: 700, minWidth: 80 }}>Rs {p.amount}</span>
                                    <span className="bdg bdf">{m ? m[1] : p.method}</span>
                                    <span style={{ color: "hsl(var(--muted-foreground))" }}>{p.paid_at ? fmtDate(p.paid_at) : "--"}</span>
                                    {p.note && <span style={{ color: "hsl(var(--muted-foreground))", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.note}</span>}
                                    <button onClick={() => deletePayment(p.id)} title="Remove payment"
                                      style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "hsl(var(--destructive))", fontSize: 12, fontWeight: 600 }}>✕</button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Hidden print area — used only by printInvoice() */}
                  <div id="inv-print-area" style={{ display: "none" }} dangerouslySetInnerHTML={{ __html: viewOrder && viewItems ? buildInvoiceHtml(viewOrder, viewItems, viewPayments) : "" }} />
                
              </div>
            ) : <p style={{ color: "hsl(var(--destructive))" }}>Not found</p>}
          </div>
          <DialogFooter>
            
            
            <Button variant="outline" style={{ marginLeft: "auto", color: "hsl(var(--destructive))" }}
             onClick={() => {
              if (viewOrder) {
                setViewOpen(false)
                if (window.confirm("Delete this order?")) {
                  api.sbQ("orders", { method: "DELETE", query: "id=eq." + viewOrder.id }).then(r => {
                    if (r.error && r.status !== 204) { toast.error(r.error.message); return }
                    toast.success("Order deleted"); offsetRef.current = 0; fetchPage(false)
                  })
                }
              }
            }}>{tr("delete", lang)}</Button>
            <Button variant="outline" onClick={() => { if (viewOrder) openEditOrder(viewOrder.id) }}>Edit</Button>
            <Button variant="default" onClick={printInvoice} id="lbl-receipt" data-tour="print-invoice">{tr("receipt", lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Payment Dialog ── */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Payment</DialogTitle></DialogHeader>
          {viewOrder && (() => {
            const paidSum = viewPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
            const info = paymentInfo(viewOrder.total_amount, paidSum)
            return (
              <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: -4 }}>
                Balance due: <strong style={{ color: info.balance > 0 ? "hsl(var(--destructive))" : "hsl(142 76% 36%)" }}>Rs {info.balance}</strong>
              </p>
            )
          })()}
          <div style={{ display: "grid", gap: 10, paddingTop: 4 }}>
            <div className="fld">
              <Label>Amount (Rs)</Label>
              <Input type="number" min="0" placeholder="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} autoFocus />
            </div>
            <div className="fld">
              <Label>Method</Label>
              <select className="sel-sm" style={{ width: "100%" }} value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                {PAY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="fld">
              <Label>Date</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="fld">
              <Label>Note (optional)</Label>
              <Input placeholder="e.g. advance, balance on delivery" value={payNote} onChange={e => setPayNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={savePayment} disabled={paySaving}>{paySaving ? "Saving…" : "Save Payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Measurements popup — properly controlled ── */}
      <Dialog open={measOpen} onOpenChange={setMeasOpen}>
        <DialogContent
          className="sm:max-w-md"
          onEscapeKeyDown={e => { e.stopPropagation(); setMeasOpen(false) }}
          onInteractOutside={e => { e.stopPropagation(); setMeasOpen(false) }}
        >
          <DialogHeader><DialogTitle>{measData.cat}</DialogTitle></DialogHeader>
          <div id="ord-meas-popup-body">
            {Object.keys(measData.vals || {}).length === 0 ? (
              <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>No measurements on file</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
                {Object.keys(measData.vals).map(k => {
                  const sqStyleKeys = new Set(["sq_baazu_style","sq_gala_style","sq_ghera_style","gala_style"])
                  const isSelector  = sqStyleKeys.has(k)
                  const mv = isSelector ? (measData.vals[k] || "--") : fmtMeasVal(measData.vals[k])
                  return (
                    <div key={k} style={{ background: "hsl(var(--transparent))", borderRadius: 7, padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid hsl(var(--border))" }}>
                      <div style={{ fontSize: 10.5, color: "hsl(var(--muted-foreground))", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".03em" }}>{labelize(k)}</div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>
                        {mv}
                        {!isSelector}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMeasOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
