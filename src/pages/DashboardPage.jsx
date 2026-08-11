import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { CATS, tr } from "@/lib/config"
import { cap } from "@/lib/utils"
import { useLang } from "@/hooks/useLang"
import CustomersPage from "./CustomersPage"

export default function DashboardPage() {
  const { api } = useAuth()
  const { lang } = useLang()
  const t = (k) => tr(k, lang)
  const navigate = useNavigate()
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  const [customers,   setCustomers]   = useState([])
  const [orders,      setOrders]      = useState([])
  const [dbStatus,    setDbStatus]    = useState("loading")
  const [loading,     setLoading]     = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [rC, rO] = await Promise.all([
      api.sbQ("customers", { query: "deleted_at=is.null", order: "created_at.desc", limit: 200 }),
      api.sbQ("orders",    { order: "created_at.desc", limit: 500 }),
    ])
    setCustomers(rC.data || [])
    setOrders(rO.data    || [])
    const ping = await api.sbQ("customers", { limit: 1 })
    setDbStatus(ping.error ? "err" : "ok")
    setLoading(false)
  }

  // Build Chart.js customer-growth bar chart when data arrives
  useEffect(() => {
    if (loading || !chartRef.current) return

    const now = new Date()
    const labels = []
    const counts = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      labels.push(d.toLocaleString("en-US", { month: "short", year: "2-digit" }))
      counts.push(
        customers.filter(c => {
          const cd = new Date(c.created_at || 0)
          return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth()
        }).length
      )
    }

    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null }

    const Chart = window.Chart
    if (!Chart) return

    chartInstance.current = new Chart(chartRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: t("new_customers"),
          data: counts,
          backgroundColor: "hsl(142 76% 36% / .7)",
          borderColor: "hsl(142 76% 28%)",
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: "#e5e7eb" }, ticks: { font: { size: 11 }, stepSize: 1, precision: 0 } },
        },
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, customers, lang])

  useEffect(() => () => { if (chartInstance.current) chartInstance.current.destroy() }, [])

  const now = new Date()
  const thisMonth = customers.filter(c => {
    const d = new Date(c.created_at || 0)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const pendingOrders = orders.filter(o => o.status === "pending").length

  // Item category counts (parsed from order items JSON if stored inline)
  const catCounts = {}
  Object.keys(CATS).forEach(k => { catCounts[k] = 0 })
  orders.forEach(o => {
    try {
      const items = JSON.parse(o.items || "[]")
      items.forEach(it => { if (it.item_type && catCounts[it.item_type] !== undefined) catCounts[it.item_type]++ })
    } catch {}
  })

  return (
    <div id="s-dashboard">

      {/* ── KPI Cards ── */}
      <div className="krow">
        <div className="kpi" data-tour="kpi-customers" onClick={() => navigate("/customers")} style={{ cursor: "pointer" }}>
          <div className="kl">{t("total_customers")}</div>
          {loading ? <div className="spin" style={{ marginTop: 8 }} /> : <div className="kv">{customers.length}</div>}
        </div>
        <div className="kpi" onClick={() => navigate("/orders")} style={{ cursor: "pointer" }}>
          <div className="kl">{t("total_orders")}</div>
          {loading ? <div className="spin" style={{ marginTop: 8 }} /> : <div className="kv">{orders.length}</div>}
        </div>
        <div className="kpi">
          <div className="kl">{t("new_this_month")}</div>
          {loading ? <div className="spin" style={{ marginTop: 8 }} /> : <div className="kv">{thisMonth}</div>}
        </div>
        <div className="kpi">
          <div className="kl">{t("pending_orders")}</div>
          {loading ? <div className="spin" style={{ marginTop: 8 }} /> : <div className="kv">{pendingOrders}</div>}
        </div>
      </div>

      {/* ── DB status ── */}
      {/* <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <div className={"cdot " + (dbStatus === "ok" ? "ok" : dbStatus === "err" ? "err" : "")} />
        <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
          {dbStatus === "ok" ? "Server connected" : dbStatus === "err" ? "DB error" : "Connecting..."}
        </span>
      </div> */}

      {/* ── Customer Growth Chart (Chart.js) ── */}
      <div className="dblk" data-tour="dash-chart" style={{ marginBottom: 20 }}>
        <div className="dbt">{t("customer_growth")}</div>
        <div style={{ height: 200, position: "relative" }}>
          {loading
            ? <div className="ld" style={{ height: "100%" }}><div className="spin" /></div>
            : <canvas ref={chartRef} />
          }
        </div>
      </div>

      {/* ── Tables ── */}
      <div className="dg">
        <div className="dblk">
          <div className="dbt">{t("recent_customers")}</div>
          <div className="tc">
            <table>
              <thead><tr><th>#</th><th>{t("name")}</th><th>{t("phone")}</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3}><div className="spin" style={{ margin: "12px auto" }} /></td></tr>
                ) : customers.slice(0, 6).length ? customers.slice(0, 6).map(c => (
                  <tr key={c.id}>
                    <td style={{ color: "hsl(var(--primary))", fontWeight: 700, fontSize: 11 }}>{c.customer_number || "--"}</td>
                    <td style={{ fontWeight: 500 }}>{(c.first_name || c.fname || c.name || "--").trim()}</td>
                    <td>{c.phone || "--"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", padding: 16 }}>{t("no_customers_yet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dblk">
          <div className="dbt">{t("recent_orders")}</div>
          <div className="tc">
            <table>
              <thead><tr><th>{t("order_hash")}</th><th>{t("status")}</th><th>{t("total")}</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3}><div className="spin" style={{ margin: "12px auto" }} /></td></tr>
                ) : orders.slice(0, 6).length ? orders.slice(0, 6).map(o => (
                  <tr key={o.id} onClick={() => navigate("/orders")} style={{ cursor: "pointer" }}>
                    <td style={{ color: "hsl(var(--primary))", fontWeight: 600 }}>{o.order_number || "--"}</td>
                    <td><span className={"bdg " + (({ pending:"bdf", in_progress:"bp", ready:"ba", delivered:"bg", paid:"bg" })[o.status] || "bdf")}>{cap(o.status || "pending")}</span></td>
                    <td style={{ fontWeight: 600 }}>Rs {o.total_amount || 0}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={3} style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", padding: 16 }}>{t("no_orders_yet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Item Breakdown ── */}
      {!loading && Object.values(catCounts).some(v => v > 0) && (
        <div className="dblk" style={{ marginTop: 20 }}>
          <div className="dbt">{t("item_breakdown")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
            {Object.entries(CATS).map(([cat, cfg]) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13 }}>{cat}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{catCounts[cat] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
