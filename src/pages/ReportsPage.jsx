import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Lock } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useSubscription } from "@/hooks/useSubscription"
import { cap } from "@/lib/utils"
import { FIELD_BY_KEY, SQ_STYLE_SELECTORS } from "@/lib/config"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card }  from "@/components/ui/Card"
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  LineChart, Line,
} from "recharts"

// ── Helpers ───────────────────────────────────────────────────────────────────
// Local-date formatters — deliberately avoid Date#toISOString() here, which
// converts through UTC. For any timezone ahead of UTC (e.g. Pakistan, UTC+5),
// local midnight on the 1st of a month serializes to ~19:00 the day before in
// UTC, so .toISOString().slice(...) silently returns the PREVIOUS day/month.
// That off-by-one broke the "Export Previous Months" backfill: it made the
// freshly-ended month resolve to a month that was already snapshotted, so the
// loop kept skipping it and the real previous month never got frozen.
function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") }
function ym(d)  { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") }

// Default: first day of current year → today (wide range so data shows by default)
function yearStart() { return ymd(new Date(new Date().getFullYear(), 0, 1)) }
function today()     { return ymd(new Date()) }
function fmt(n)      { return "Rs " + Number(n || 0).toLocaleString() }

// ── Month helpers (Revenue tab uses single-month selection) ─────────────────
function currentMonth() { return ym(new Date()) }                                  // "YYYY-MM"
function monthStart(m)  { return m + "-01" }                                       // first day
function monthEnd(m) {                                                             // last day
  const [y, mo] = m.split("-").map(Number)
  return ymd(new Date(y, mo, 0))
}
function monthLabel(m) {
  const [y, mo] = m.split("-").map(Number)
  return new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" })
}

const CHART_COLORS  = ["hsl(142 76% 36%)", "hsl(0 84% 60%)", "hsl(221 83% 53%)", "hsl(38 92% 45%)", "hsl(262 83% 58%)", "hsl(186 100% 30%)"]
const STATUS_ORDER  = ["pending", "in_progress", "ready", "delivered", "paid"]
const STATUS_LABELS = { pending: "Received", in_progress: "In Progress", ready: "Ready", delivered: "Delivered", paid: "Paid" }
const STATUS_CLS    = { pending: "bdf", in_progress: "bp", ready: "ba", delivered: "bg", paid: "bg" }
const STATUS_COLORS = { pending: "#94a3b8", in_progress: "#a855f7", ready: "#f59e0b", delivered: "#3b82f6", paid: "#22c55e" }

// ── Date Range Row ─────────────────────────────────────────────────────────────
function DateRow({ from, to, onApply, label }) {
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--muted-foreground))" }}>{label}</span>}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <Input type="date" value={f} onChange={e => setF(e.target.value)} />
        <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>to</span>
        <Input type="date" value={t} onChange={e => setT(e.target.value)} />
      </div>
      <Button onClick={() => onApply(f, t)}
        variant="outline" size="default" className="bg-background">
        Apply
      </Button>
    </div>
  )
}

// ── Chart Card ─────────────────────────────────────────────────────────────────
function ChartCard({ title, filter, children, style }) {
  return (
    <div className="dblk" style={{ marginBottom: 16, ...style }}>
      <p className="cc-t" style={{ marginBottom: filter ? 4 : 12 }}>{title}</p>
      {filter}
      {children}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, valueColor }) {
  return (
    <div className="kpi">
      <div className="kl">{label}</div>
      <div className="kv" style={{ fontSize: "1.3rem", color: valueColor }}>{value}</div>
      {sub && <div className="ks">{sub}</div>}
    </div>
  )
}

function Spinner() { return <div className="ld" style={{ height: 160 }}><div className="spin" /></div> }

// ── PDF Export helpers ──────────────────────────────────────────────────────
// Everything here runs ONLY on an Export click (never on page load), so the
// tab's normal queries are untouched. Output is plain-text tables (no charts /
// screenshots) built with jsPDF + jspdf-autotable.

function labelize(k) { return String(k).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) }

// Readable label for a measurement key (standard field, style selector, or
// humanized fallback).
const SQ_LABEL = {}
SQ_STYLE_SELECTORS.forEach(s => { SQ_LABEL[s.key] = s.label + " Style" })
SQ_LABEL.gala_style   = "Gala Style"
SQ_LABEL.double_salai = "Double Salai"
function measLabel(key) {
  return (FIELD_BY_KEY[key] && FIELD_BY_KEY[key].label) || SQ_LABEL[key] || labelize(key)
}

// Pull EVERY row for a table/query, 1000 per page, so exports are complete no
// matter how big the shop's history grows.
async function fetchAllPaged(api, table, { query, order } = {}) {
  const PAGE = 1000
  let offset = 0
  const all = []
  for (;;) {
    const r = await api.sbQ(table, { query, order, limit: PAGE, offset })
    const rows = r.data || []
    all.push(...rows)
    if (rows.length < PAGE) break
    offset += PAGE
  }
  return all
}

// Chunked `col=in.(...)` fetch — keeps URLs short for large id lists.
async function fetchByIds(api, table, col, ids, extra = "") {
  const out = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const query = `${col}=in.(${chunk.join(",")})` + (extra ? "&" + extra : "")
    const r = await api.sbQ(table, { query, limit: 1000 })
    out.push(...(r.data || []))
  }
  return out
}

// Stamp "Page x of y" on every page after the document is fully built.
function stampPageNumbers(pdf) {
  const total = pdf.internal.getNumberOfPages()
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8); pdf.setTextColor(150)
    pdf.text(`Page ${i} of ${total}`, W - 14, H - 8, { align: "right" })
  }
  pdf.setTextColor(0)
}

// ── Orders → plain-text data table (order-level rows) ───────────────────────
async function buildOrdersPdf(api, from, to) {
  const { default: jsPDF }   = await import("jspdf")
  const { autoTable }        = await import("jspdf-autotable")

  const orders = await fetchAllPaged(api, "orders", {
    query: `booking_date=gte.${from}&booking_date=lte.${to}`,
    order: "booking_date.desc",
  })

  // Resolve customer name/phone (orders only store customer_id).
  const ids = [...new Set(orders.map(o => o.customer_id).filter(Boolean))]
  const custMap = {}
  if (ids.length) (await fetchByIds(api, "customers", "id", ids)).forEach(c => { custMap[c.id] = c })

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const L = 14
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(15)
  pdf.text("Orders Report", L, 15)
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(110)
  pdf.text(`Period ${from} to ${to}   |   ${orders.length} order(s)   |   Generated ${new Date().toLocaleDateString()}`, L, 21)
  pdf.setTextColor(0)

  const body = orders.map(o => {
    const c = custMap[o.customer_id] || {}
    return [
      o.order_number || "--",
      (c.first_name || "--").trim(),
      c.phone || "--",
      o.booking_date || "--",
      o.delivery_date || "--",
      STATUS_LABELS[o.status] || cap(o.status || "--"),
      fmt(o.total_amount),
      fmt(o.discount),
      String(o.notes || "").replace(/\s+/g, " ").trim(),
    ]
  })

  autoTable(pdf, {
    startY: 26,
    head: [["Order #", "Customer", "Phone", "Booking", "Delivery", "Status", "Total", "Discount", "Notes"]],
    body: body.length ? body : [["—", "No orders in this period", "", "", "", "", "", "", ""]],
    styles: { fontSize: 8, cellPadding: 1.8, overflow: "linebreak", lineWidth: 0.1, lineColor: [225, 225, 225] },
    headStyles: { fillColor: [238, 238, 238], textColor: 20, fontStyle: "bold" },
    columnStyles: { 6: { halign: "right" }, 7: { halign: "right" }, 8: { cellWidth: 55 } },
    margin: { left: L, right: L },
  })

  stampPageNumbers(pdf)
  pdf.save(`orders-report_${from}_to_${to}.pdf`)
  return orders.length
}

// ── Customers → per-customer sections with full measurement breakdown ───────
async function buildCustomersPdf(api, from, to) {
  const { default: jsPDF } = await import("jspdf")
  const { autoTable }      = await import("jspdf-autotable")

  // 1) Customers created in the chosen range.
  const customers = await fetchAllPaged(api, "customers", {
    query: `created_at=gte.${from}T00:00:00&created_at=lte.${to}T23:59:59`,
    order: "created_at.desc",
  })

  // 2) Bulk breakdown: items → current measurement set → values (few queries,
  //    joined in memory rather than per-customer round-trips).
  const custIds = customers.map(c => c.id)
  const items   = custIds.length ? await fetchByIds(api, "customer_items", "customer_id", custIds) : []
  const itemIds = items.map(i => i.id)
  const measRows = itemIds.length ? await fetchByIds(api, "customer_measurements", "customer_item_id", itemIds, "is_current=eq.true") : []
  const measIds  = measRows.map(m => m.id)
  const valRows  = measIds.length ? await fetchByIds(api, "customer_measurement_values", "measurement_id", measIds) : []

  const itemsByCust = {}
  items.forEach(it => { (itemsByCust[it.customer_id] = itemsByCust[it.customer_id] || []).push(it) })
  const measByItem = {}
  measRows.forEach(m => { measByItem[m.customer_item_id] = m })
  const valsByMeas = {}
  valRows.forEach(v => { (valsByMeas[v.measurement_id] = valsByMeas[v.measurement_id] || []).push(v) })

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const L = 14
  let y = 16

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(15)
  pdf.text("Customers Report", L, y); y += 6
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(110)
  pdf.text(`Period ${from} to ${to}   |   ${customers.length} customer(s)   |   Generated ${new Date().toLocaleDateString()}`, L, y)
  pdf.setTextColor(0); y += 6

  if (!customers.length) {
    pdf.setFontSize(11); pdf.text("No customers in this period.", L, y + 6)
    stampPageNumbers(pdf)
    pdf.save(`customers-report_${from}_to_${to}.pdf`)
    return 0
  }

  customers.forEach((c, idx) => {
    if (y > H - 45) { pdf.addPage(); y = 16 }

    // Section divider + header
    pdf.setDrawColor(210); pdf.line(L, y, W - L, y); y += 6
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12)
    pdf.text(`${idx + 1}. ${(c.first_name || "--").trim()}`, L, y)
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(110)
    pdf.text(`#${c.customer_number || "--"}`, W - L, y, { align: "right" })
    pdf.setTextColor(0); y += 6

    // Info line
    pdf.setFontSize(9.5)
    pdf.text(
      `Phone: ${c.phone || "--"}     Gender: ${c.gender || "--"}     Added: ${c.created_at ? c.created_at.slice(0, 10) : "--"}`,
      L, y
    ); y += 5
    if (c.notes) {
      const noteLines = pdf.splitTextToSize(`Notes: ${String(c.notes).replace(/\s+/g, " ").trim()}`, W - 2 * L)
      pdf.text(noteLines, L, y); y += noteLines.length * 4.5
    }
    y += 1

    const custItems = itemsByCust[c.id] || []
    if (!custItems.length) {
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(9); pdf.setTextColor(130)
      pdf.text("No measurements on file.", L + 2, y + 2)
      pdf.setFont("helvetica", "normal"); pdf.setTextColor(0); y += 8
      return
    }

    custItems.forEach(it => {
      const meas = measByItem[it.id]
      const vals = meas ? (valsByMeas[meas.id] || []) : []
      const rows = vals
        .filter(v => v.value != null && String(v.value).trim() !== "")
        .map(v => [measLabel(v.measurement_key), String(v.value) + (v.unit ? " " + v.unit : "")])

      autoTable(pdf, {
        startY: y,
        head: [[it.category_name || "Item", ""]],
        body: rows.length ? rows : [["No values recorded", ""]],
        theme: "grid",
        styles: { fontSize: 8.5, cellPadding: 1.5, lineWidth: 0.1, lineColor: [225, 225, 225] },
        headStyles: { fillColor: [245, 245, 245], textColor: 30, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: (W - 2 * L) * 0.6 }, 1: { cellWidth: (W - 2 * L) * 0.4 } },
        margin: { left: L, right: L },
      })
      y = pdf.lastAutoTable.finalY + 4
      if (y > H - 30) { pdf.addPage(); y = 16 }
    })
  })

  stampPageNumbers(pdf)
  pdf.save(`customers-report_${from}_to_${to}.pdf`)
  return customers.length
}

// ── Reusable date-range export dialog ───────────────────────────────────────
function ExportRangeDialog({ open, onOpenChange, title, busy, onExport }) {
  const [f, setF] = useState(yearStart())
  const [t, setT] = useState(today())
  return (
    <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>
          Choose the date range to export.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Input type="date" value={f} onChange={e => setF(e.target.value)} />
          <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>to</span>
          <Input type="date" value={t} onChange={e => setT(e.target.value)} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button variant="outline" className="bg-background" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy} onClick={() => onExport(f, t)}>{busy ? "Generating…" : "Generate PDF"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB: REVENUE ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function RevenueTab({ api }) {
  const month = currentMonth()                 // this tab always shows the current month
  const [kpi,     setKpi]     = useState(null)
  const [donut,   setDonut]   = useState(null)
  const [trend,   setTrend]   = useState([])
  const [barCat,  setBarCat]  = useState([])
  const [loading, setLoading] = useState(true)

  // "Export Previous" dialog
  const [prevOpen,    setPrevOpen]    = useState(false)
  const [prevList,    setPrevList]    = useState([])
  const [prevLoading, setPrevLoading] = useState(false)
  const [exportingId, setExportingId] = useState(null)
  const [curExporting, setCurExporting] = useState(false)

  useEffect(() => { (async () => { await backfillSnapshots(); await loadAll(monthStart(month), monthEnd(month), month) })() }, [])

  // ── Snapshot helpers ───────────────────────────────────────────────────────
  async function saveSnapshot(m, vals) {
    const body = { period: monthStart(m), ...vals }
    const r = await api.sbQ("monthly_report_snapshots", { method: "POST", body: [body] })
    if (!r.error) pruneOldSnapshots()
    return r
  }

  // Prune snapshots older than ~12 months (keeps storage bounded; D7).
  async function pruneOldSnapshots() {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 12)
    const cutoffStr = ymd(cutoff)
    await api.sbQ("monthly_report_snapshots", { method: "DELETE", query: `period=lt.${cutoffStr}` })
  }

  // Backfill: snapshot every past month (last 12) that has order data but no
  // snapshot yet — so editing a recurring expense later cannot alter history.
  async function backfillSnapshots() {
    try {
      const existing = await api.sbQ("monthly_report_snapshots", { limit: 200 })
      const have = new Set((existing.data || []).map(s => s.period))
      const now = new Date()
      for (let i = 1; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        // ym() (local getters), not toISOString — see the comment on ymd/ym
        // above. The previous .toISOString().slice(0,7) shifted this back a
        // whole month in UTC+ timezones, so the loop kept re-deriving a month
        // that was already snapshotted and "continue"-ing past it — the real
        // just-ended previous month was never reached.
        const m = ym(d)
        if (have.has(monthStart(m))) continue
        const computed = await computeMonthTotals(m)
        if (computed && (computed.total_revenue > 0 || computed.total_expenses > 0)) {
          await saveSnapshot(m, computed)
        }
      }
    } catch (e) { /* non-fatal: snapshots are best-effort */ }
  }

  // Open the "Export Previous" dialog and load the last 12 frozen months.
  async function openPrev() {
    setPrevOpen(true)
    setPrevLoading(true)
    await backfillSnapshots()   // make sure recently-closed months are frozen
    const r = await api.sbQ("monthly_report_snapshots", { order: "period.desc", limit: 12 })
    setPrevList((r.data || []).filter(s => s.period < monthStart(month)))   // past months only
    setPrevLoading(false)
  }

  // Shared one-page PDF builder — used for BOTH the current month and frozen
  // past months so the output is identical in layout.
  // `d` holds snapshot-shaped fields; `monthKey` is "YYYY-MM"; `frozen` only
  // changes the footer note.
  async function buildReportPdf(d, monthKey, frozen) {
    const { default: jsPDF } = await import("jspdf")
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const L = 18
    let y = 24
    pdf.setFontSize(18); pdf.setFont(undefined, "bold")
    pdf.text("Monthly Report", L, y)
    y += 9
    pdf.setFontSize(13); pdf.setFont(undefined, "normal")
    pdf.text(monthLabel(monthKey), L, y)
    y += 6
    pdf.setDrawColor(200); pdf.line(L, y, 192, y); y += 10

    const rows = [
      ["Total Revenue",     fmt(d.total_revenue)],
      ["Total Invoiced",    fmt(d.total_invoiced)],
      ["Delivered Orders",  String(d.delivered_count ?? 0)],
      ["—", ""],
      ["Karigar Expenses",  fmt(d.karigar_exp)],
      ["Category Expenses", fmt(d.category_exp)],
      ["Other Expenses",    fmt(d.other_exp)],
      ["Total Expenses",    fmt(d.total_expenses)],
      ["—", ""],
      ["Net Income",        fmt(d.total_income)],
    ]
    pdf.setFontSize(12)
    rows.forEach(([k, v]) => {
      if (k === "—") { pdf.setDrawColor(230); pdf.line(L, y - 2, 192, y - 2); return }
      const bold = (k === "Total Expenses" || k === "Net Income")
      pdf.setFont(undefined, bold ? "bold" : "normal")
      pdf.text(k, L, y)
      pdf.text(v, 192, y, { align: "right" })
      y += 8
    })
    y += 6
    pdf.setFontSize(9); pdf.setTextColor(150); pdf.setFont(undefined, "normal")
    pdf.text((frozen ? "Figures frozen at month-end." : "Live figures, current month in progress.")
             + " Generated " + new Date().toLocaleDateString(), L, y)
    pdf.save(`report-${monthKey}.pdf`)
  }

  // Past month — from frozen snapshot.
  async function exportSnapshotPdf(snap) {
    setExportingId(snap.id)
    try {
      await buildReportPdf(snap, (snap.period || "").slice(0, 7), true)
      toast.success("Exported " + monthLabel((snap.period || "").slice(0, 7)))
    } catch (e) {
      console.error(e); toast.error("Export failed")
    } finally {
      setExportingId(null)
    }
  }

  // Current month — same layout, computed live from the on-screen figures.
  async function exportCurrentPdf() {
    if (!kpi) return
    setCurExporting(true)
    try {
      await buildReportPdf({
        total_revenue:   kpi.totalRevenue,
        total_invoiced:  kpi.totalInvoiced,
        delivered_count: kpi.deliveredCount,
        karigar_exp:     kpi.karigarExp,
        category_exp:    kpi.categoryExp,
        other_exp:       kpi.otherExp,
        total_expenses:  kpi.totalExpenses,
        total_income:    kpi.totalIncome,
      }, month, false)
      toast.success("Exported " + monthLabel(month))
    } catch (e) {
      console.error(e); toast.error("Export failed")
    } finally {
      setCurExporting(false)
    }
  }

  // Pure computation of a month's totals (no state writes) — used by backfill.
  // Server-side aggregation (report_revenue_summary): one round-trip instead of
  // the old 4–5 whole-table fetches per month. Returns ONLY the snapshot columns.
  async function computeMonthTotals(m) {
    const { data } = await api.rpc("report_revenue_summary", { p_from: monthStart(m), p_to: monthEnd(m) })
    const d = data || {}
    return {
      total_revenue:   Number(d.total_revenue)   || 0,
      total_invoiced:  Number(d.total_invoiced)  || 0,
      karigar_exp:     Number(d.karigar_exp)     || 0,
      category_exp:    Number(d.category_exp)    || 0,
      other_exp:       Number(d.other_exp)       || 0,
      total_expenses:  Number(d.total_expenses)  || 0,
      total_income:    Number(d.total_income)    || 0,
      delivered_count: Number(d.delivered_count) || 0,
    }
  }

  async function loadAll(f, t, m = month) {
    setLoading(true)

    // All aggregation now happens server-side: one summary RPC + one trend RPC +
    // one category-breakdown RPC, in parallel. Replaces the previous whole-table
    // pulls (orders/karigar_order_assignments/order_items capped at 2000–5000)
    // and the 6-iteration month-by-month trend fetch loop. No row caps, so the
    // figures stay correct no matter how large the shop's history grows.
    const [rSum, rTrend, rCat] = await Promise.all([
      api.rpc("report_revenue_summary",     { p_from: f, p_to: t }),
      api.rpc("report_revenue_trend",       { p_months: 6 }),
      api.rpc("report_revenue_by_category", { p_from: f, p_to: t }),
    ])

    const d = rSum.data || {}
    setKpi({
      totalRevenue:   Number(d.total_revenue)   || 0,
      totalIncome:    Number(d.total_income)    || 0,
      totalExpenses:  Number(d.total_expenses)  || 0,
      totalInvoiced:  Number(d.total_invoiced)  || 0,
      karigarExp:     Number(d.karigar_exp)     || 0,
      categoryExp:    Number(d.category_exp)    || 0,
      otherExp:       Number(d.other_exp)       || 0,
      deliveredCount: Number(d.delivered_count) || 0,
      totalOrders:    Number(d.total_orders)    || 0,
      invoicedCount:  Number(d.invoiced_count)  || 0,
      expKarigars:    Number(d.exp_karigars)    || 0,
    })

    // Donut: revenue vs pending vs expenses
    setDonut([
      { name: "Revenue",  value: Number(d.total_revenue)  || 0 },
      { name: "Pending",  value: Number(d.pending_val)    || 0 },
      { name: "Expenses", value: Number(d.total_expenses) || 0 },
    ])

    setTrend(Array.isArray(rTrend.data) ? rTrend.data : [])
    setBarCat(Array.isArray(rCat.data) ? rCat.data : [])
    setLoading(false)
  }

  if (loading) return <Spinner />

  return (
    <div id="rev-tab-export">
      {/* Header: current month + export buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))" }}>
          {monthLabel(month)} <span style={{ fontWeight: 500, color: "hsl(var(--muted-foreground))" }}>(current month)</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }} data-html2canvas-ignore="true">
          <Button variant="default" size="default" disabled={curExporting} onClick={exportCurrentPdf}>{curExporting ? "Exporting…" : "Export"}</Button>
          <Button variant="outline" size="default" className="bg-background" onClick={openPrev}>Export Previous</Button>          
        </div>
      </div>

      {/* KPI Cards */}
      <div className="krow" style={{ marginBottom: 20 }}>
        <KpiCard label="Total Invoiced" value={fmt(kpi?.totalInvoiced)} sub={`${kpi?.invoicedCount} active orders`} />
        <KpiCard label="Revenue" value={fmt(kpi?.totalRevenue)} sub={`${kpi?.deliveredCount} delivered orders`} valueColor="hsl(142 76% 28%)" />
        <KpiCard label="Expenses" value={fmt(kpi?.totalExpenses)} 
        sub="All expenses"
        // sub={`Karigar ${fmt(kpi?.karigarExp)} + Category ${fmt(kpi?.categoryExp)}`} 
        valueColor="hsl(var(--destructive))" />
        <KpiCard label="Income" value={fmt(kpi?.totalIncome)} sub="Revenue − Expenses" valueColor={kpi?.totalIncome >= 0 ? "hsl(142 76% 28%)" : "hsl(var(--destructive))"} />
      </div>

      {/* Charts */}
      <div id="rev-charts" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <style>{`@media(min-width:768px){#rev-charts{grid-template-columns:1fr 1fr}}`}</style>

        <ChartCard title="Revenue vs Expenses vs Pending">
          {donut ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={donut} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                  {donut.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Spinner />}
        </ChartCard>

        <ChartCard title="Monthly Revenue Trend (Last 6 Months)">
          {trend.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={v => [fmt(v), "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4, fill: CHART_COLORS[0] }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <Spinner />}
        </ChartCard>

        <ChartCard title="Revenue by Item Category" style={{ gridColumn: "1 / -1" }}>
          {barCat.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barCat} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="cat" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={v => [fmt(v), "Revenue"]} />
                <Bar dataKey="rev" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: "24px 0", textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>No item data for this period</div>
          )}
        </ChartCard>
      </div>

      {/* Ledger table */}
      {/* <div className="dblk" style={{ marginTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="dbt" style={{ marginBottom: 0 }}>Orders Ledger</div>
          <Button variant="outline" size="sm" onClick={() => exportToPdf("rev-tab-export", "revenue-report.pdf")}>          
            Export PDF  
          </Button>
        </div>
        <div className="tc">
          <table>
            <thead><tr><th>Order #</th><th>Booking</th><th>Status</th><th>Amount</th></tr></thead>
            <tbody>
              {ledger.length ? ledger.map(o => (
                <tr key={o.id}>
                  <td style={{ color: "hsl(var(--primary))", fontWeight: 600 }}>{o.order_number || "--"}</td>
                  <td>{o.booking_date || "--"}</td>
                  <td><span className={"bdg " + (STATUS_CLS[o.status] || "bdf")}>{STATUS_LABELS[o.status] || cap(o.status)}</span></td>
                  <td style={{ fontWeight: 600 }}>{fmt(o.total_amount)}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 16, color: "hsl(var(--muted-foreground))" }}>No orders in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div> */}

      {/* ── Export Previous Months ── */}
      <Dialog open={prevOpen} onOpenChange={setPrevOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Previous Months</DialogTitle>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>
            Past months are frozen at month-end. Editing expenses now won't change them.
          </div>
          </DialogHeader>          
          <div className="flex flex-col gap-2 mb-10">
            {prevLoading && <Spinner />}
            {!prevLoading && prevList.length === 0 && (
              <div style={{ padding: "20px 0", textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
                No previous months yet.
              </div>
            )}
            {!prevLoading && prevList.map(snap => (
              <Card key={snap.id} className="p-3 flex justify-between items-center shadow-none">
                <div>
                  <div className="text-sm">{monthLabel((snap.period || "").slice(0, 7))}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Revenue {fmt(snap.total_revenue)} · Income {fmt(snap.total_income)}
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled={exportingId === snap.id} onClick={() => exportSnapshotPdf(snap)}>
                  {exportingId === snap.id ? "Exporting…" : "Export"}
                </Button>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB: ORDERS ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function OrdersTab({ api }) {
  const [from,    setFrom]    = useState(yearStart())
  const [to,      setTo]      = useState(today())
  const [funnel,  setFunnel]  = useState([])
  const [ledger,  setLedger]  = useState([])
  const [loading, setLoading] = useState(true)
  const [expOpen,   setExpOpen]   = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExport(f, t) {
    setExporting(true)
    try {
      const n = await buildOrdersPdf(api, f, t)
      toast.success(`Exported ${n} order(s)`)
      setExpOpen(false)
    } catch (e) { console.error(e); toast.error("Export failed") }
    finally { setExporting(false) }
  }

  useEffect(() => { loadOrders(from, to) }, [])

  async function loadOrders(f, t) {
    setLoading(true)
    const [rAll, rRange] = await Promise.all([
      api.sbQ("orders", { limit: 5000 }),
      api.sbQ("orders", { query: `booking_date=gte.${f}&booking_date=lte.${t}`, limit: 1000, order: "booking_date.desc" }),
    ])
    const all = rAll.data || []
    const counts = {}
    STATUS_ORDER.forEach(s => { counts[s] = 0 })
    all.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++ })
    setFunnel(STATUS_ORDER.map(s => ({ status: s, label: STATUS_LABELS[s], count: counts[s] || 0 })))
    setLedger(rRange.data || [])
    setLoading(false)
  }

  if (loading) return <Spinner />

  const paid    = ledger.filter(o => o.status === "paid")
  const pending = ledger.filter(o => o.status === "pending")

  return (
    <div id="orders-tab-export">
      <DateRow from={from} to={to} label="Period:" onApply={(f, t) => { setFrom(f); setTo(t); loadOrders(f, t) }} />

      <div className="krow" style={{ marginBottom: 20 }}>
        <KpiCard label="Total Orders" value={ledger.length} sub="in selected period" />
        <KpiCard label="Paid" value={paid.length} sub={fmt(paid.reduce((s,o) => s+(parseFloat(o.total_amount)||0),0))} valueColor="hsl(142 76% 28%)" />
        <KpiCard label="Pending" value={pending.length} sub={fmt(pending.reduce((s,o) => s+(parseFloat(o.total_amount)||0),0))} />
        <KpiCard label="Total Value" value={fmt(ledger.reduce((s,o) => s+(parseFloat(o.total_amount)||0),0))} sub="all statuses" />
      </div>

      <ChartCard title="Order Status Funnel (All Time)">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {funnel.map(f => {
            const max = Math.max(...funnel.map(d => d.count), 1)
            return (
              <div key={f.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={"bdg " + (STATUS_CLS[f.status] || "bdf")} style={{ minWidth: 100, textAlign: "center" }}>{f.label}</span>
                <div style={{ flex: 1, background: "hsl(var(--muted))", borderRadius: 4, height: 22, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4,
                    background: STATUS_COLORS[f.status] || "hsl(var(--primary))",
                    width: Math.max(f.count > 0 ? 4 : 0, (f.count / max) * 100) + "%",
                    transition: "width .4s ease",
                  }} />
                </div>
                <span style={{ minWidth: 28, textAlign: "right", fontWeight: 700, fontSize: 13 }}>{f.count}</span>
              </div>
            )
          })}
        </div>
      </ChartCard>

      <div className="dblk" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 0 }}>
          <div className="dbt" style={{ marginBottom: 0 }}>Order Ledger</div>
          <button onClick={() => setExpOpen(true)}
            style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "none", background: "hsl(var(--primary))", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Export PDF
          </button>
        </div>
      </div>

      <ExportRangeDialog open={expOpen} onOpenChange={setExpOpen} title="Export Orders" busy={exporting} onExport={handleExport} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB: CUSTOMERS ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function CustomersTab({ api }) {
  const [from,     setFrom]     = useState(yearStart())
  const [to,       setTo]       = useState(today())
  const [top5,     setTop5]     = useState([])
  const [newCount, setNewCount] = useState(0)
  const [custList, setCustList] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expOpen,   setExpOpen]   = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExport(f, t) {
    setExporting(true)
    try {
      const n = await buildCustomersPdf(api, f, t)
      toast.success(`Exported ${n} customer(s)`)
      setExpOpen(false)
    } catch (e) { console.error(e); toast.error("Export failed") }
    finally { setExporting(false) }
  }

  useEffect(() => { loadData(from, to) }, [])

  async function loadData(f, t) {
    setLoading(true)
    const [rOrders, rCusts] = await Promise.all([
      // All orders (not just paid) in range for top-customer revenue
      api.sbQ("orders", { query: `booking_date=gte.${f}&booking_date=lte.${t}&status=neq.cancelled`, limit: 1000 }),
      api.sbQ("customers", { limit: 500, order: "created_at.desc" }),
    ])

    const allCustomers = rCusts.data || []
    setCustList(allCustomers)

    // New customers in range
    const newInRange = allCustomers.filter(c => {
      if (!c.created_at) return false
      const d = c.created_at.slice(0, 10)
      return d >= f && d <= t
    })
    setNewCount(newInRange.length)

    // Top 5 by order total — use customer_id FK directly
    const custRevMap = {}
    ;(rOrders.data || []).forEach(o => {
      if (!o.customer_id) return
      custRevMap[o.customer_id] = (custRevMap[o.customer_id] || 0) + (parseFloat(o.total_amount) || 0)
    })
    const nameMap = {}
    allCustomers.forEach(c => { nameMap[c.id] = c.first_name || c.fname || c.name || "—" })
    const sorted = Object.entries(custRevMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
    setTop5(sorted.map(([id, rev]) => ({ name: nameMap[id] || "Customer", rev })))
    setLoading(false)
  }

  if (loading) return <Spinner />

  return (
    <div id="customers-tab-export">
      <DateRow from={from} to={to} label="Period:" onApply={(f, t) => { setFrom(f); setTo(t); loadData(f, t) }} />

      <div className="krow" style={{ marginBottom: 20 }}>
        <KpiCard label="Total Customers" value={custList.length} sub="all time" />
        <KpiCard label="New This Period" value={newCount} sub="joined in range" valueColor="hsl(142 76% 28%)" />
      </div>

      <ChartCard title="Top 5 Customers by Order Value">
        {top5.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart layout="vertical" data={top5} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip formatter={v => [fmt(v), "Order Value"]} />
              <Bar dataKey="rev" fill={CHART_COLORS[3]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ padding: "24px 0", textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>No order data in this period</div>
        )}
      </ChartCard>

      <div className="dblk" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 0 }}>
          <div className="dbt" style={{ marginBottom: 0 }}>All Customers</div>
          <button onClick={() => setExpOpen(true)}
            style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "none", background: "hsl(var(--primary))", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Export PDF
          </button>
        </div>
      </div>

      <ExportRangeDialog open={expOpen} onOpenChange={setExpOpen} title="Export Customers" busy={exporting} onExport={handleExport} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB: KARIGAR ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function KarigarTab({ api }) {
  const [from,     setFrom]     = useState(yearStart())
  const [to,       setTo]       = useState(today())
  const [perfData, setPerfData] = useState([])
  const [payments, setPayments] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { loadData(from, to) }, [])

  async function loadData(f, t) {
    setLoading(true)
    const [rK, rA] = await Promise.all([
      api.sbQ("karigar", { order: "name.asc" }),
      api.sbQ("karigar_order_assignments", {
        query: `created_at=gte.${f}T00:00:00&created_at=lte.${t}T23:59:59`,
      }),
    ])
    const karigars = rK.data || []
    const asgs     = rA.data || []

    const perf = karigars.map(k => {
      const kAsgs   = asgs.filter(a => a.karigar_id === k.id)
      const earned  = kAsgs.reduce((s, a) => s + (parseFloat(a.agreed_rate) || 0), 0)
      return { name: k.name, orders: kAsgs.length, earned }
    }).filter(d => d.orders > 0)

    setPerfData(perf)

    // Payment summary per karigar (no payment_status column — show earned vs separate payments table)
    const rows = karigars.map(k => {
      const kAsgs  = asgs.filter(a => a.karigar_id === k.id)
      const earned = kAsgs.reduce((s, a) => s + (parseFloat(a.agreed_rate) || 0), 0)
      return { ...k, earned, orderCount: kAsgs.length }
    }).filter(k => k.orderCount > 0)

    setPayments(rows)
    setLoading(false)
  }

  if (loading) return <Spinner />

  const totalEarned = payments.reduce((s, k) => s + k.earned, 0)

  return (
    <div id="karigar-tab-export">
      <DateRow from={from} to={to} label="Period:" onApply={(f, t) => { setFrom(f); setTo(t); loadData(f, t) }} />

      <div className="krow" style={{ marginBottom: 20 }}>
        <KpiCard label="Active Karigars" value={payments.length} sub="with assignments" />
        <KpiCard label="Total Payable" value={fmt(totalEarned)} sub="based on agreed rates" valueColor="hsl(var(--destructive))" />
      </div>

      <ChartCard title="Karigar Performance">
        {perfData.length ? (
          <ResponsiveContainer width="100%" height={Math.max(200, perfData.length * 54)}>
            <BarChart layout="vertical" data={perfData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip formatter={(v, name) => [name === "earned" ? fmt(v) : v, name === "earned" ? "Earnings" : "Orders"]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="orders" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} name="Orders" />
              <Bar dataKey="earned" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Earnings" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ padding: "24px 0", textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>No karigar assignments in this period</div>
        )}
      </ChartCard>

      {/* <div className="dblk" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="dbt" style={{ marginBottom: 0 }}>Karigar Assignment Summary</div>
          <button onClick={() => exportToPdf("karigar-tab-export", "karigar-report.pdf")}
            style={{ height: 30, padding: "0 12px", borderRadius: 6, border: "none", background: "hsl(var(--primary))", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Export PDF
          </button>
        </div>
        <div className="tc">
          <table>
            <thead><tr><th>Karigar</th><th>Phone</th><th>Pay Type</th><th>Assignments</th><th>Total Payable</th></tr></thead>
            <tbody>
              {payments.length ? payments.map(k => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 600 }}>{k.name}</td>
                  <td>{k.phone || "--"}</td>
                  <td><span className="bdg bdf">{cap(k.payment_type || "—")}</span></td>
                  <td>{k.orderCount}</td>
                  <td style={{ fontWeight: 600, color: "hsl(var(--destructive))" }}>{fmt(k.earned)}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 16, color: "hsl(var(--muted-foreground))" }}>No karigar assignments in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div> */}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MAIN REPORTS PAGE ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "revenue",   label: "Revenue"   },
  { id: "orders",    label: "Orders"    },
  { id: "customers", label: "Customers" },
  { id: "karigar",   label: "Karigar"   },
]

export default function ReportsPage() {
  const { api } = useAuth()
  const navigate = useNavigate()
  const { reportTabs, reportTabsHidden, loading: subLoading } = useSubscription()

  // Tabs hidden by a per-tailor custom-limit are removed entirely (not shown
  // locked). Plan-level OFF tabs stay visible but locked.
  const visibleTabs = TABS.filter(t => !reportTabsHidden?.[t.id])

  // First visible tab the tailor is allowed to open.
  const firstAllowed = (visibleTabs.find(t => reportTabs?.[t.id]) || visibleTabs[0])?.id || "revenue"
  const [picked, setPicked] = useState(null)

  // Derive the active tab during render (no setState-in-effect): use the user's
  // pick if it's still allowed + visible, otherwise the first allowed tab.
  const pickedOk = picked && reportTabs?.[picked] && !reportTabsHidden?.[picked]
  const activeTab = (!subLoading && pickedOk) ? picked : firstAllowed

  function handleTabChange(next) {
    if (reportTabsHidden?.[next]) return            // hidden tab: ignore
    if (!reportTabs?.[next]) {
      toast.error("Upgrade to unlock this report")
      navigate("/billing")
      return
    }
    setPicked(next)
  }

  return (
    <div id="s-reports">
      {/* <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "hsl(var(--foreground))" }}>Reports &amp; Analytics</h2>
        <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 4, marginBottom: 0 }}>View insights and export reports for any date range</p>
      </div> */}

      {/* Tabs (shadcn) */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-5">
        <TabsList className="h-auto flex-wrap">
          {visibleTabs.map(tab => {
            const locked = !subLoading && !reportTabs?.[tab.id]
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5"
                title={locked ? "Upgrade to unlock this report" : undefined}>
                {locked && <Lock className="h-3 w-3" />}
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {!reportTabsHidden?.revenue   && <TabsContent value="revenue"   className="mt-5">{activeTab === "revenue"   && <RevenueTab   api={api} />}</TabsContent>}
        {!reportTabsHidden?.orders    && <TabsContent value="orders"    className="mt-5">{activeTab === "orders"    && <OrdersTab    api={api} />}</TabsContent>}
        {!reportTabsHidden?.customers && <TabsContent value="customers" className="mt-5">{activeTab === "customers" && <CustomersTab api={api} />}</TabsContent>}
        {!reportTabsHidden?.karigar   && <TabsContent value="karigar"   className="mt-5">{activeTab === "karigar"   && <KarigarTab   api={api} />}</TabsContent>}
      </Tabs>
    </div>
  )
}
