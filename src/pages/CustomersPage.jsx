import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import { useSubscription } from "@/hooks/useSubscription"
import { useNavigate } from "react-router-dom"
import { useLang } from "@/hooks/useLang"
import { useTourController } from "@/context/TourContext"
import { tr, CATS, MEAS_GROUPS, SQ_STYLE_SELECTORS, COLORS, BOOK_SIZE,
  resolveCategoryFields, printUrLabel, printUrCat, printUrValue } from "@/lib/config"
import { fmtDate, debounce, gradientAvatar } from "@/lib/utils"
import { Button }  from "@/components/ui/button"
import { Input }   from "@/components/ui/input"
import { Label }   from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

// ── helpers ────────────────────────────────────────────────────────────────
function nm(c)  { return (c.first_name || c.fname || c.name || "--").trim() }
function ini(c) { return nm(c).split(" ").map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() }
function labelize(k) { return k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) }
// Escape free-text (e.g. customer notes) before injecting into receipt HTML.
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ))
}

function calcCustNum(seq) {
  const book = Math.floor((seq - 1) / BOOK_SIZE) + 1
  const num  = ((seq - 1) % BOOK_SIZE) + 1
  return String(num).padStart(4, "0") + "-B" + book
}

// Measurement fractional value formatting
const FRACS = [
  { label: "¼", stored: "1/4", num: 0.25 },
  { label: "½", stored: "1/2", num: 0.5  },
  { label: "⅓", stored: "1/3", num: 0.33 },
]

function fmtMeasVal(v) {
  if (!v && v !== 0) return "--"
  // Open text: echo the stored value exactly as the user typed it. No parsing.
  return String(v)
}

// ── Measurement input component ────────────────────────────────────────────
// Open text field: accepts anything the user types (numbers, decimals,
// fractions, ranges, notes) and saves it verbatim — no parsing or coercion.
function MeasInput({ fieldKey, fieldDef, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <input
        className="mv-inp"
        type="text"
        placeholder="--"
        value={value == null ? "" : String(value)}
        onChange={e => onChange(fieldKey, e.target.value)}        
      />
    </div>
  )
}

// ── SQ Style selectors (Baazu/Gala/Ghera) for Shalwar Qameez ──────────────
function SQStyleSelect({ values, onChange }) {
  return (
    <div className="mgrp">
      <div className="mgrp-hd open">
        <div className="mgrp-dot" style={{ background: "#375FA0" }} />
        <div className="mgrp-title">Style Details</div>
      </div>
      <div className="mgrp-body open" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {SQ_STYLE_SELECTORS.map(sel => {
          const current = values[sel.key] || ""
          return (
            <div key={sel.key}>
              <div className="mv-lbl">{sel.label}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {sel.options.map(opt => {
                  const active = current === opt
                  return (
                    <Button
                      key={opt}
                      type="button"
                      onClick={() => onChange(sel.key, active ? "" : opt)}
                      variant={active ? "default" : "outline"}
                      size="sm"                      
                    >
                      {opt}
                    </Button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Gala style single-select for Waistcoat
const GALA_OPTIONS = [
  { key: "gol_gala",  label: "Gol Gala" },
  { key: "v_gala",    label: "V Gala" },
  { key: "ban",       label: "Ban" },
]

function GalaSelect({ value, onChange }) {
  return (
    <div className="mgrp">
      <div className="mgrp-hd open">
        <div className="mgrp-dot" style={{ background: "#6B4FA0" }} />
        <div className="mgrp-title">Gala Style</div>
      </div>
      <div className="mgrp-body open">
        {GALA_OPTIONS.map(opt => {
          const active = value === opt.key
          return (
            <Button
              key={opt.key}
              variant={active ? "default" : "outline"}
              size="sm"
              className="mr-2"
              onClick={() => onChange("gala_style", active ? "" : opt.key)}              
            >
              {opt.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

// ── Measurement groups for a category ────────────────────────────────────
function MeasGroups({ catName, catRow, values, onChange }) {
  const cat = CATS[catName]

  // Custom (tailor-defined) category: render its chosen measurement fields,
  // grouped by the field's standard group label for a familiar layout.
  if (!cat) {
    const fields = resolveCategoryFields(catName, catRow)
    if (!fields.length) {
      return <p style={{ fontSize: 12.5, color: "hsl(var(--muted-foreground))", padding: "8px 0" }}>No measurement fields configured for this category. Add some in Rates → Categories.</p>
    }
    const groups = []
    const byLabel = {}
    fields.forEach(f => {
      const gl = f.groupLabel || "Measurements"
      if (!byLabel[gl]) { byLabel[gl] = { label: gl, fields: [] }; groups.push(byLabel[gl]) }
      byLabel[gl].fields.push(f)
    })
    return (
      <>
        {groups.map((grp, gi) => (
          <div key={gi} className="mgrp">
            <div className="mgrp-hd open">
              <div className="mgrp-dot" style={{ background: "#888" }} />
              <div className="mgrp-title">{grp.label}</div>
            </div>
            <div className="mgrp-body open">
              {grp.fields.map(f => (
                <div key={f.key} className="mv-card">
                  <div className="mv-info">
                    <div className="mv-lbl">{f.label}</div>
                    <MeasInput
                      fieldKey={f.key}
                      fieldDef={f}
                      value={values[f.key] || ""}
                      onChange={onChange}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </>
    )
  }

  const excluded = cat.excludeFields || []

  return (
    <>
      {cat.groups.map(gk => {
        if (gk === "gGala") {
          return (
            <GalaSelect
              key="gGala"
              value={values["gala_style"] || ""}
              onChange={onChange}
            />
          )
        }
        if (gk === "gSQStyle") {
          return (
            <SQStyleSelect
              key="gSQStyle"
              values={values}
              onChange={onChange}
            />
          )
        }
        const grp = MEAS_GROUPS[gk]
        if (!grp) return null
        const fields = grp.fields.filter(f => !excluded.includes(f.key))
        if (!fields.length) return null
        return (
          <div key={gk} className="mgrp">
            <div className="mgrp-hd open">
              <div className="mgrp-dot" style={{ background: grp.color }} />
              <div className="mgrp-title">{grp.label}</div>
            </div>
            <div className="mgrp-body open">
              {fields.map(f => (
                <div key={f.key} className="mv-card">
                  <div className="mv-info">
                    <div className="mv-lbl">{f.label}</div>
                    <MeasInput
                      fieldKey={f.key}
                      fieldDef={f}
                      value={values[f.key] || ""}
                      onChange={onChange}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── CustomerCard ────────────────────────────────────────────────────────────
function CustomerCard({ customer, onView }) {
  const { api } = useAuth()
  const { lang } = useLang()
  const [items, setItems] = useState(null)

  useEffect(() => {
    api.sbQ("customer_items", { query: "customer_id=eq." + customer.id, order: "created_at.asc", limit: 6 })
      .then(r => setItems(r.data || []))
  }, [customer.id])

  return (
    <div className="cc2" onClick={() => onView(customer.id)} style={{ cursor: "pointer" }}>
      <div className="cct">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <div className="cav" style={{ background: gradientAvatar(customer.id || nm(customer)), textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>{ini(customer)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="cn">{nm(customer)}</div>
            <div className="ce" style={{ fontWeight: 600, color: "hsl(var(--primary))" }}>{customer.customer_number || "--"}</div>
            <div style={{ fontSize: 10.5, color: "hsl(var(--muted-foreground))", marginTop: 1 }}>{customer.phone || ""}</div>
          </div>
        </div>
        {customer.phone && (
          <a href={"tel:" + customer.phone} onClick={e => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 7, background: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))", textDecoration: "none", flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </a>
        )}
      </div>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid hsl(var(--border))" }}>
        {items === null ? <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>Loading...</span> :
         items.length === 0 ? <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{tr("no_measurements", lang)}</span> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {items.map(item => {
              const col = CATS[item.category_name] ? CATS[item.category_name].color : "#888"
              return (
                <span key={item.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, background: col + "18", color: col, border: "1px solid " + col + "33" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: col, display: "inline-block" }} />
                  {item.category_name}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Print a single version receipt ──────────────────────────────────────────

// function buildVersionReceiptHtml(custData, item, ver) {
//   const col = CATS[item.category_name] ? CATS[item.category_name].color : "#555"
//   const galaLabel = { gol_gala: "Gol Gala", v_gala: "V Gala", ban: "Ban" }
//   const rows = (ver.vals || []).map(v => {
//     let display
//     if (v.measurement_key === "gala_style") {
//       display = galaLabel[v.value] || v.value || "--"
//     } else {
//       const raw   = String(v.value || "")
//       const parts = raw.split(" ")
//       const whole = parseInt(parts[0]) || 0
//       const fracPart = parts[1] ? FRACS.find(f => f.stored === parts[1]) : null
//       display = whole + (fracPart ? " " + fracPart.label : "")
//     }
//     return `<tr>
//       <td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;font-weight:500">${labelize(v.measurement_key)}</td>
//       <td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:700;color:#111;text-align:right">${display}</td>
//     </tr>`
//   }).join("")

//   return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Measurement Receipt</title>
//     <style>*{box-sizing:border-box;margin:auto;padding:0}body{font-family:sans-serif;color:#111;background:#fff;padding:20px}@media print{body{padding:0}@page{size:A4 portrait;margin:10mm 12mm}}</style>
//     </head><body>
//     <div style="font-size:20px;font-weight:700;color:#111;margin-bottom:4px;padding-bottom:10px;border-bottom:2px solid #2B5740">${nm(custData)}</div>
//     <div style="font-size:12px;color:#999;margin-bottom:16px">${item.category_name} &nbsp;•&nbsp; v${ver.version} &nbsp;•&nbsp; ${ver.taken_at ? fmtDate(ver.taken_at) : "--"}</div>
//     <div style="margin-bottom:14px">
//       <div style="background:${col};color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:5px 10px;border-radius:4px 4px 0 0">${item.category_name}</div>
//       <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #eee;border-top:none;border-radius:0 0 4px 4px"><tbody>${rows || '<tr><td colspan="2" style="padding:10px;text-align:center;color:#999;font-size:12px">No measurements</td></tr>'}</tbody></table>
//     </div>
//     <script>window.onload=function(){window.print();}<\/script></body></html>`
// }

// function printVersion(custData, item, ver) {
//   const win = window.open("", "_blank", "width=680,height=900")
//   if (!win) { alert("Please allow popups to print."); return }
//   win.document.write(buildVersionReceiptHtml(custData, item, ver))
//   win.document.close()
// }

// ── Print a single version receipt ──────────────────────────────────────────
// Supports layout: "single" | "2up" | "4up"
// function buildVersionReceiptHtml(custData, item, ver, layout = "single") {
//   const col = CATS[item.category_name] ? CATS[item.category_name].color : "#555"
//   const galaLabel = { gol_gala: "Gol Gala", v_gala: "V Gala", ban: "Ban" }
//   const rows = (ver.vals || []).map(v => {
//     let display
//     if (v.measurement_key === "gala_style") {
//       display = galaLabel[v.value] || v.value || "--"
//     } else {
//       const raw   = String(v.value || "")
//       const parts = raw.split(" ")
//       const whole = parseInt(parts[0]) || 0
//       const fracPart = parts[1] ? FRACS.find(f => f.stored === parts[1]) : null
//       display = whole + (fracPart ? " " + fracPart.label : "")
//     }
//     return `<tr>
//       <td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;font-weight:500">${labelize(v.measurement_key)}</td>
//       <td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:700;color:#111;text-align:right">${display}</td>
//     </tr>`
//   }).join("")

//   // ── Receipt card HTML (unchanged from original) ──────────────────────────
//   const receiptCard = `
//     <div class="receipt-card">
//       <div style="font-size:20px;font-weight:700;color:#111;margin-bottom:4px;padding-bottom:10px;border-bottom:2px solid #2B5740">${nm(custData)}</div>
//       <div style="font-size:12px;color:#999;margin-bottom:16px">${item.category_name} &nbsp;•&nbsp; v${ver.version} &nbsp;•&nbsp; ${ver.taken_at ? fmtDate(ver.taken_at) : "--"}</div>
//       <div style="margin-bottom:14px">
//         <div style="background:${col};color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:5px 10px;border-radius:4px 4px 0 0">${item.category_name}</div>
//         <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #eee;border-top:none;border-radius:0 0 4px 4px"><tbody>${rows || '<tr><td colspan="2" style="padding:10px;text-align:center;color:#999;font-size:12px">No measurements</td></tr>'}</tbody></table>
//       </div>
//     </div>`

//   // ── Layout config ────────────────────────────────────────────────────────
//   //  A4 printable area ≈ 186mm × 267mm (with 10/12mm margins)
//   //  single: full width, no scaling
//   //  2up:    2 columns × 1 row  → each cell ~93mm wide
//   //  4up:    2 columns × 2 rows → each cell ~93mm × 133mm
//   const layoutStyles = {
//     single: `
//       .receipt-grid { display: block; }
//       .receipt-card { width: 100%; padding: 20px; }
//     `,
//     "2up": `
//       .receipt-grid {
//         display: grid;
//         grid-template-columns: 1fr 1fr;
//         gap: 0;
//         width: 186mm;
//       }
//       .receipt-card {
//         padding: 10px 12px;
//         border: 1px dashed #ddd; /* dashed cut line */
//         font-size: 90%;
//       }
//       /* Scale down table font sizes inside grid */
//       .receipt-card td { font-size: 11px !important; padding: 4px 8px !important; }
//       .receipt-card [style*="font-size:20px"] { font-size: 16px !important; }
//       .receipt-card [style*="font-size:12px"] { font-size: 10px !important; }
//       .receipt-card [style*="font-size:13px"] { font-size: 11px !important; }
//       .receipt-card [style*="font-size:11px"] { font-size: 9px !important; }
//     `,
//     "4up": `
//       .receipt-grid {
//         display: grid;
//         grid-template-columns: 1fr 1fr;
//         grid-template-rows: 1fr 1fr;
//         gap: 0;
//         width: 186mm;
//         height: 267mm;
//       }
//       .receipt-card {
//         padding: 8px 10px;
//         border: 1px dashed #ddd;
//         overflow: hidden;
//       }
//       .receipt-card td { font-size: 10px !important; padding: 3px 6px !important; }
//       .receipt-card [style*="font-size:20px"] { font-size: 13px !important; }
//       .receipt-card [style*="font-size:12px"] { font-size: 9px !important; }
//       .receipt-card [style*="font-size:13px"] { font-size: 10px !important; }
//       .receipt-card [style*="font-size:11px"] { font-size: 8px !important; }
//     `
//   }

//   // Repeat the same receipt card to fill the grid slots
//   const slots = layout === "single" ? 1 : layout === "2up" ? 2 : 4
//   const cards = Array(slots).fill(receiptCard).join("")

//   return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Measurement Receipt</title>
//     <style>
//       * { box-sizing: border-box; margin: 0; padding: 0; }
//       body { font-family: sans-serif; color: #111; background: #fff; }
//       @media print {
//         body { padding: 0; }
//         @page { size: A4 portrait; margin: 10mm 12mm; }
//         .receipt-card { border-color: #ccc; }
//       }
//       ${layoutStyles[layout] || layoutStyles["single"]}
//     </style>
//     </head><body>
//     <div class="receipt-grid">${cards}</div>
//     <script>window.onload=function(){window.print();}<\/script>
//     </body></html>`
// }

// // ── Print helpers ────────────────────────────────────────────────────────────
// // layout: "single" | "2up" | "4up"
// function printVersion(custData, item, ver, layout = "4up") {
//   const win = window.open("", "_blank", "width=680,height=900")
//   if (!win) { alert("Please allow popups to print."); return }
//   win.document.write(buildVersionReceiptHtml(custData, item, ver, layout))
//   win.document.close()
// }

// ── Usage examples ───────────────────────────────────────────────────────────
// printVersion(custData, item, ver)           → same as before (single)
// printVersion(custData, item, ver, "2up")    → 2 receipts side-by-side on A4
// printVersion(custData, item, ver, "4up")    → 4 receipts in 2×2 grid on A4



// Printed receipt is fully in Urdu (RTL). On-screen view is unchanged.
function buildVersionReceiptHtml(custData, item, ver, layout = "single", shop = null) {
  const shopName = (shop && shop.name && shop.name !== "User") ? shop.name : "سیفی ٹیلرز"
  const shopLogo = (shop && shop.logo) ? shop.logo : null
  const col = CATS[item.category_name] ? CATS[item.category_name].color : "#555"
  const selectorKeys = new Set(["gala_style","sq_baazu_style","sq_gala_style","sq_ghera_style"])

  // Build flat list of {label, display} pairs — all in Urdu
  const pairs = (ver.vals || []).map(v => {
    let display
    if (selectorKeys.has(v.measurement_key)) {
      display = v.value ? printUrValue(v.value) : "--"
    } else {
      // Open text: print the stored value exactly as entered.
      const raw = String(v.value || "")
      // Double salai prints blank (not "--") when empty; others keep "--".
      display = raw || (v.measurement_key === "double_salai" ? "" : "--")
    }
    return { label: printUrLabel(v.measurement_key), display }
  })

  // Group into rows of 2 pairs → 4 columns per row (RTL ordering)
  const tdLabel = `padding:1px 8px;border-bottom:1px solid #000;font-size:13px;font-weight:600;color:#000;white-space:nowrap`
  const tdVal   = `padding:1px 8px;border-bottom:1px solid #000;font-size:15px;font-weight:700;color:#000;border-right:1px solid #000;min-width:48px;direction:ltr`
  const tdSep   = `padding:0;border-bottom:1px solid #000;width:1px;border-right:1px solid #000`

  let rows = ""
  for (let i = 0; i < pairs.length; i += 2) {
    const a = pairs[i]
    const b = pairs[i + 1]
    rows += `<tr>
      <td style="${tdLabel}">${a.label}</td>
      <td style="${tdVal}">${a.display}</td>
      <td style="${tdSep}"></td>
      <td style="${tdLabel}">${b ? b.label : ""}</td>
      <td style="${tdVal}">${b ? b.display : ""}</td>
    </tr>`
  }

  const catUr   = printUrCat(item.category_name)
  const dateStr = ver.taken_at ? fmtDate(ver.taken_at) : "--"

  // Customer notes — shown right after the measurements table, before the
  // shop tagline/phone block. Only rendered when a note exists.
  const noteRaw = (custData && custData.notes) ? String(custData.notes).trim() : ""
  const notesBlock = noteRaw
    ? `<div style="margin-top:6px;border:0.5px solid #000;padding:6px 8px;font-size:12px;line-height:1.6;text-align:right;white-space:pre-wrap">${escapeHtml(noteRaw)}</div>`
    : ""

  const receiptCard = `
    <div dir="rtl" style="padding:10px 12px;border:1px dashed #bbb;width:93mm;min-height:133mm;text-align:right;">
      <div style="display:flex;flex-direction:row;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="display:flex;flex-direction:row;align-items:center;gap:6px;font-size:16px;font-weight:700">${nm(custData)}
          &nbsp;•&nbsp;
          ${shopLogo ? `<img src="${shopLogo}" style="height:22px;width:22px;object-fit:contain;border-radius:4px" onerror="this.style.display='none'"/>` : ""}
          <div style="font-size:16px;font-weight:700">${shopName}</div>
        </div>
        <div>${custData.customer_number}</div>
      </div>
      <div>
        <div style="background:#fff;color:#000;font-size:13px;font-weight:700;padding:8px;border:0.5px solid #000">${catUr} &nbsp;•&nbsp; v${ver.version} &nbsp;•&nbsp; ${dateStr}</div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:0.5px solid #000"><tbody>${rows || '<tr><td colspan="5" style="padding:8px;text-align:center;color:#999;font-size:12px">کوئی پیمائش درج نہیں</td></tr>'}</tbody></table>
      </div>
      ${notesBlock}
      <div style="margin-top:8px;text-align:center;font-size:15px;line-height:1.7">
        لیڈیز جنٹس واسکوٹ پینٹ کوٹ کی سلائی کا بہترین مرکز<br/>
        نیز ہر قسم کی ڈیزائننگ کی سہولت موجود ہے<br/>
        ریلوے گلی نمبر 2 سانگلہ، ہل
        <p style="font-weight:700;font-size:16px;margin-top:2px">0301-6058028</p>
      </div>
    </div>`

  // "quarter" layout — receipt rotated 90° filling the TOP HALF of the A4
  // sheet; the bottom half is left empty so the tailor can print a second
  // customer's receipt on the same sheet (cut in half along the middle).
  // The card is laid out in portrait, then rotate(90deg) lays it landscape
  // across the page width. Pre-rotation width≈height after rotation, so the
  // card is sized 128mm wide × 188mm tall → ~188mm × 128mm once rotated,
  // which fills the upper half (≈210mm × 138mm printable area).
  const rotatedCard = receiptCard.replace(
    'width:93mm;min-height:133mm;',
    'width:128mm;min-height:188mm;'
  )
  const quarterGrid = `
    <div style="width:186mm;height:271mm;position:relative;">
      <div style="position:absolute;top:0;left:0;width:186mm;height:135mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <div style="transform:rotate(-90deg);transform-origin:center center;">
          ${rotatedCard}
        </div>
      </div>
    </div>`

  const singleFull = `
    <div style="padding:20px;">
      ${receiptCard.replace('width:93mm;min-height:133mm;', 'width:100%;')}
    </div>`

  return `<!DOCTYPE html><html dir="rtl" lang="ur"><head><meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>پیمائش رسید</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <style>
      /* Stop iOS/Android from auto-inflating text so print matches desktop */
      html{-webkit-text-size-adjust:100%;text-size-adjust:100%;}
      *{box-sizing:border-box;margin:0;padding:0}
      /* Embedded web font → identical glyph metrics on every device.
         (System fonts like Jameel Noori differ per-OS and changed the size.) */
      body{font-family:'Noto Nastaliq Urdu','Segoe UI',Tahoma,sans-serif;color:#111;background:#fff;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
      @media print{
        body{padding:0;}
        @page{size:A4 portrait;margin:10mm 12mm;}
      }
    </style>
    </head><body>
    ${layout === "quarter" ? quarterGrid : singleFull}
    <script>
      // Wait for the web font to actually load before printing, otherwise mobile
      // browsers print with the fallback font (wrong metrics → wrong size).
      function doPrint(){ try { window.focus(); } catch(e){} window.print(); }
      window.onload = function(){
        if (document.fonts && document.fonts.ready) {
          var done = false;
          var go = function(){ if (done) return; done = true; doPrint(); };
          document.fonts.ready.then(go);
          // safety: never hang if fonts stall
          setTimeout(go, 2500);
        } else {
          setTimeout(doPrint, 400);
        }
      };
    <\/script>
    </body></html>`
}

// How to call it
// layout = "singleFull" - fills page with 1 receipt
// layout = "quarter" - 1 receipt in top-left quarter, rest of A4 empty

function printVersion(custData, item, ver, layout = "quarter", shop = null) {
  const win = window.open("", "_blank", "width=680,height=900")
  if (!win) { alert("Please allow popups to print."); return }
  win.document.write(buildVersionReceiptHtml(custData, item, ver, layout, shop))
  win.document.close()
}




// ── Main Page ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { api, user, getShopName, getLogoUrl } = useAuth()
  const { lang } = useLang()
  const sub = useSubscription()
  const navigate = useNavigate()
  const tourCtl = useTourController()

  const [customers,  setCustomers]  = useState([])
  const [loading,    setLoading]    = useState(false)
  const [hasMore,    setHasMore]    = useState(true)
  const [query,      setQuery]      = useState("")
  const [sortOrder,  setSortOrder]  = useState("created_at")
  const offsetRef    = useRef(0)
  const loadingRef   = useRef(false)
  const observerRef  = useRef(null)
  const sentinelRef  = useRef(null)
  const PAGE = 10

  // Customer form state
  const [formOpen,  setFormOpen]  = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [formName,  setFormName]  = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formNum,   setFormNum]   = useState("")
  const [formNumSeq,setFormNumSeq]= useState(null)
  const [custItems, setCustItems] = useState([])
  const [customCats, setCustomCats] = useState([])
  const [saving,    setSaving]    = useState(false)

  // View modal
  const [viewOpen,  setViewOpen]  = useState(false)
  const [viewData,  setViewData]  = useState(null)
  const [viewItems, setViewItems] = useState([])
  const [viewLoading, setViewLoading] = useState(false)

  // Delete confirm
  const [delOpen,   setDelOpen]   = useState(false)
  const [delId,     setDelId]     = useState(null)
  const [delName,   setDelName]   = useState("")
  const [deleting,  setDeleting]  = useState(false)

  // Load tailor-defined custom categories so they are selectable here too.
  // Scoped to the current tailor (defense-in-depth on top of RLS) so one
  // tailor never sees another tailor's custom categories.
  useEffect(() => {
    if (!user?.id) return
    api.sbQ("item_categories", { query: "is_custom=eq.true&user_id=eq." + user.id, order: "id.asc" })
      .then(r => setCustomCats((r.data || []).filter(c => c.is_custom && !CATS[c.name])))
  }, [api, user?.id])

  // Lookups for custom categories: row by name + a fallback color per category.
  const catRowByName = {}
  const customCatColor = {}
  customCats.forEach((c, i) => { catRowByName[c.name] = c; customCatColor[c.name] = COLORS[i % COLORS.length] })
  const catColor = (name) => (CATS[name] ? CATS[name].color : (customCatColor[name] || "#888"))

  // ── load ──────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (append = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    const filters = ["deleted_at=is.null"]
    if (query) {
      const q = query.replace(/%/g, "%25").replace(/&/g, "%26")
      filters.push("or=(first_name.ilike.*" + q + "*,phone.ilike.*" + q + "*,customer_number.ilike.*" + q + "*)")
    }
    const order = sortOrder + "." + (sortOrder === "first_name" || sortOrder === "customer_number" ? "asc" : "desc") + ".nullslast"
    const r = await api.sbQ("customers", { query: filters.join("&"), order, limit: PAGE, offset: offsetRef.current })
    loadingRef.current = false
    setLoading(false)
    if (r.status === 401 || r.error) return
    const batch = r.data || []
    if (!append) setCustomers(batch)
    else setCustomers(prev => [...prev, ...batch])
    setHasMore(batch.length === PAGE)
    offsetRef.current += batch.length
  }, [query, sortOrder, api])

  useEffect(() => {
    offsetRef.current = 0
    setHasMore(true)
    fetchPage(false)
  }, [query, sortOrder])

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
    // Also check immediately in case content is short enough
    onScroll()
    return () => scroller.removeEventListener("scroll", onScroll)
  }, [hasMore, fetchPage])

  const debouncedSearch = useCallback(debounce(v => setQuery(v), 280), [])

  // ── Customer number ────────────────────────────────────────────────────
  async function getNextSeq() {
    // Next number is based on ACTIVE customers only. Deleted rows are soft-deleted
    // (deleted_at set) but keep their customer_seq; excluding them here means the
    // next number drops back down after you delete the most recent customer(s).
    const r = await api.sbQ("customers", { query: "deleted_at=is.null", order: "customer_seq.desc,created_at.desc", limit: 1 })
    if (r.data && r.data[0] && r.data[0].customer_seq) return r.data[0].customer_seq + 1
    const r2 = await api.sbQ("customers", { query: "deleted_at=is.null&select=id", limit: 5000 })
    return ((r2.data && r2.data.length) || 0) + 1
  }

  // ── Open form ────────────────────────────────────────────────────────
  async function openForm(id = null) {
    setEditId(id)
    setFormName(""); setFormPhone(""); setFormNotes(""); setFormNum("")
    setCustItems([])

    if (!id) {
      const seq = await getNextSeq()
      setFormNum(calcCustNum(seq))
      setFormNumSeq(seq)
    } else {
      const c = customers.find(x => String(x.id) === String(id))
      if (c) {
        setFormName(nm(c)); setFormPhone(c.phone || ""); setFormNotes(c.notes || ""); setFormNum(c.customer_number || "")
      }
      const rItems = await api.sbQ("customer_items", { query: "customer_id=eq." + id, order: "created_at.asc" })
      const items = rItems.data || []
      const loaded = []
      for (let i = 0; i < items.length; i++) {
        const dbItem = items[i]
        const entry = { catName: dbItem.category_name, active: i === 0, dbId: dbItem.id, _measVals: {} }
        const rM = await api.sbQ("customer_measurements", { query: "customer_item_id=eq." + dbItem.id + "&is_current=eq.true", limit: 1 })
        if (rM.data && rM.data[0]) {
          const rV = await api.sbQ("customer_measurement_values", { query: "measurement_id=eq." + rM.data[0].id })
          ;(rV.data || []).forEach(v => { entry._measVals[v.measurement_key] = v.value })
          entry._measId = rM.data[0].id
        }
        loaded.push(entry)
      }
      setCustItems(loaded)
    }
    setFormOpen(true)
  }

  function toggleItem(catName) {
    setCustItems(prev => {
      const idx = prev.findIndex(i => i.catName === catName)
      let next
      if (idx >= 0) next = prev.filter((_, j) => j !== idx)
      else          next = [...prev, { catName, active: false, _measVals: {} }]
      return next.map((it, j) => ({ ...it, active: j === 0 }))
    })
  }

  function setActiveTab(catName) {
    setCustItems(prev => prev.map(i => ({ ...i, active: i.catName === catName })))
  }

  function removeItem(catName) {
    setCustItems(prev => {
      const next = prev.filter(i => i.catName !== catName)
      if (next.length) next[0].active = true
      return next
    })
  }

  function updateMeas(catName, fieldKey, value) {
    setCustItems(prev => prev.map(i =>
      i.catName === catName ? { ...i, _measVals: { ...i._measVals, [fieldKey]: value } } : i
    ))
  }

  // ── Save customer ────────────────────────────────────────────────────
  async function saveCust() {
    if (!formName.trim()) { toast.error("Full name is required"); return }
    setSaving(true)
    const body = { first_name: formName.trim() }
    if (formPhone.trim()) body.phone = formPhone.trim()
    if (formNotes.trim()) body.notes = formNotes.trim()

    let custId = editId
    if (!editId) {
      const seq = formNumSeq || await getNextSeq()
      body.customer_number = formNum || calcCustNum(seq)
      body.customer_seq    = seq
      const r = await api.sbQ("customers", { method: "POST", body: [body] })
      if (r.error) {
        const msg = /row-level security/i.test(r.error.message)
          ? "You've reached your plan's customer limit. Upgrade to add more."
          : r.error.message
        toast.error(msg); setSaving(false); return
      }
      custId = r.data && r.data[0] && r.data[0].id
      sub.refresh()
    } else {
      if (formNum) body.customer_number = formNum
      const r = await api.sbQ("customers", { method: "PATCH", query: "id=eq." + editId, body })
      if (r.error) { toast.error(r.error.message); setSaving(false); return }
    }

    for (const item of custItems) {
      const vals = item._measVals || {}
      if (Object.keys(vals).length === 0) continue
      let itemDbId = item.dbId
      if (!itemDbId) {
        const rItem = await api.sbQ("customer_items", { method: "POST", body: [{ customer_id: custId, category_name: item.catName }] })
        if (rItem.error || !rItem.data) continue
        itemDbId = rItem.data[0].id
      }
      const rCurr = await api.sbQ("customer_measurements", { query: "customer_item_id=eq." + itemDbId + "&is_current=eq.true", order: "version.desc", limit: 1 })
      const currMeas = rCurr.data && rCurr.data[0]
      const oldMap = {}
      if (currMeas) {
        const rOld = await api.sbQ("customer_measurement_values", { query: "measurement_id=eq." + currMeas.id })
        ;(rOld.data || []).forEach(v => { oldMap[v.measurement_key] = v.value })
      }
      const merged  = { ...oldMap, ...vals }
      const changed  = JSON.stringify(merged) !== JSON.stringify(oldMap)
      if (changed) {
        if (currMeas) await api.sbQ("customer_measurements", { method: "PATCH", query: "id=eq." + currMeas.id, body: { is_current: false } })
        const newVer = currMeas ? currMeas.version + 1 : 1
        const rMeas  = await api.sbQ("customer_measurements", { method: "POST", body: [{ customer_item_id: itemDbId, version: newVer, is_current: true, taken_at: new Date().toISOString() }] })
        if (rMeas.error || !rMeas.data) continue
        const measId  = rMeas.data[0].id
        const valRows = Object.keys(merged).map(k => ({ measurement_id: measId, measurement_key: k, value: merged[k] }))
        if (valRows.length) await api.sbQ("customer_measurement_values", { method: "POST", body: valRows })
      }
    }

    toast.success("Customer saved")
    setSaving(false)
    setFormOpen(false)
    offsetRef.current = 0
    setHasMore(true)
    fetchPage(false)
  }

  // ── Product-tour demo actions (registered for the guided tour) ─────────
  // These let the central tour open the real Add-Customer dialog with sample
  // data and create/clean a real demo customer, without exposing page state.
  const DEMO_NAME = "Demo Customer (tour)"

  useEffect(() => {
    const unregs = [
      // Open the real Add Customer dialog, pre-filled with demo values.
      tourCtl.register("openAddCustomer", async () => {
        await openForm()
        setFormName(DEMO_NAME)
        setFormPhone("0300 0000000")
      }),
      // Select Shalwar Qameez, seed one measurement, and focus its first input.
      tourCtl.register("addDemoMeasurement", async () => {
        setCustItems([{ catName: "Shalwar Qameez", active: true,
          _measVals: { lambai_qamees: "42", baazu: "24", chaati: "44" } }])
        // Focus the first measurement input once it renders.
        await new Promise(r => setTimeout(r, 250))
        const el = document.querySelector('#cust-meas-panels .mv-inp')
        if (el) { el.focus(); el.select && el.select() }
      }),
      // Create a REAL demo customer + one Shalwar Qameez measurement set.
      // Returns { id, name } so the order step can use it. Self-contained so
      // it doesn't depend on dialog state.
      tourCtl.register("createDemoCustomer", async () => {
        const seq = await getNextSeq()
        const body = {
          first_name: DEMO_NAME, phone: "0300 0000000",
          notes: "Created by the product tour — safe to delete.",
          customer_number: calcCustNum(seq), customer_seq: seq,
        }
        const r = await api.sbQ("customers", { method: "POST", body: [body] })
        if (r.error || !r.data) return null
        const custId = r.data[0].id
        // one item + current measurements
        const rItem = await api.sbQ("customer_items", { method: "POST", body: [{ customer_id: custId, category_name: "Shalwar Qameez" }] })
        if (rItem.data && rItem.data[0]) {
          const rMeas = await api.sbQ("customer_measurements", { method: "POST",
            body: [{ customer_item_id: rItem.data[0].id, version: 1, is_current: true, taken_at: new Date().toISOString() }] })
          if (rMeas.data && rMeas.data[0]) {
            const vals = { lambai_qamees: "42", baazu: "24", teera: "16", gala: "15", chaati: "44", kamar: "40", gehra: "9" }
            const rows = Object.keys(vals).map(k => ({ measurement_id: rMeas.data[0].id, measurement_key: k, value: vals[k] }))
            await api.sbQ("customer_measurement_values", { method: "POST", body: rows })
          }
        }
        sub.refresh && sub.refresh()
        offsetRef.current = 0; setHasMore(true); fetchPage(false)
        return { id: custId, name: DEMO_NAME }
      }),
      // Soft-delete a demo customer (matches the app's normal delete).
      tourCtl.register("deleteDemoCustomer", async (custId) => {
        if (!custId) return
        await api.sbQ("customers", { method: "PATCH", query: "id=eq." + custId, body: { deleted_at: new Date().toISOString() } })
        sub.refresh && sub.refresh()
        offsetRef.current = 0; setHasMore(true); fetchPage(false)
      }),
      // Close the add-customer dialog (used when advancing past the dialog steps).
      tourCtl.register("closeCustomerDialog", () => setFormOpen(false)),
    ]
    return () => unregs.forEach(u => u && u())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── View customer ────────────────────────────────────────────────────
  async function viewCust(id) {
    setViewOpen(true); setViewData(null); setViewItems([])
    setViewLoading(true)
    const r = await api.sbQ("customers", { query: "id=eq." + id })
    const c = r.data && r.data[0]
    if (!c) { setViewLoading(false); return }
    setViewData(c)

    const rItems = await api.sbQ("customer_items", { query: "customer_id=eq." + id, order: "created_at.asc" })
    const items  = rItems.data || []
    const loaded = []
    for (const item of items) {
      const rVers = await api.sbQ("customer_measurements", { query: "customer_item_id=eq." + item.id, order: "version.desc" })
      const versions = []
      for (const ver of (rVers.data || [])) {
        const rVals = await api.sbQ("customer_measurement_values", { query: "measurement_id=eq." + ver.id })
        versions.push({ ...ver, vals: rVals.data || [] })
      }
      loaded.push({ ...item, versions })
    }
    setViewItems(loaded)
    setViewLoading(false)
  }

  // ── Delete customer ────────────────────────────────────────────────
  async function confirmDelete() {
    setDeleting(true)
    // Soft delete: hard DELETE is blocked by RLS. Deleted customers keep
    // their plan slot (anti-abuse) unless removed within 24h of creation.
    const r = await api.sbQ("customers", { method: "PATCH", query: "id=eq." + delId, body: { deleted_at: new Date().toISOString() } })
    if (r.error && r.status !== 204) { toast.error(r.error.message); setDeleting(false); return }
    toast.success("Customer deleted")
    setDeleting(false); setDelOpen(false)
    offsetRef.current = 0; setHasMore(true); fetchPage(false)
  }

  const activeItem = custItems.find(i => i.active)

  // ── Receipt for a single version ─────────────────────────────────────
  function handlePrintVersion(item, ver) {
    if (!viewData) return
    printVersion(viewData, item, ver, "quarter", {
      name: getShopName(),
      logo: getLogoUrl(),
    })
  }

  return (
    <div id="s-customers">
      {/* Toolbar */}
      <div className="toolbar">
        <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
          <input
            className="srch"
            id="cs-q"
            placeholder={tr("search_customers", lang)}
            onChange={e => debouncedSearch(e.target.value)}
          />
          <select id="cs-so" className="sel-sm" value={sortOrder} onChange={e => setSortOrder(e.target.value)}>
            <option value="created_at">Newest</option>
            <option value="first_name">Name A-Z</option>
            <option value="customer_number">Customer #</option>
          </select>
        </div>
        {sub.atLimit ? (
          <Button id="lbl-add-cust" data-tour="add-customer" onClick={() => navigate("/billing")}>Upgrade to add more</Button>
        ) : (
          <Button id="lbl-add-cust" data-tour="add-customer" onClick={() => openForm()}>{tr("add_customer", lang)}</Button>
        )}
      </div>
      <div id="csub" style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
        {customers.length} customers
        {!sub.isPro && sub.maxCust != null && (
          <span style={{ marginLeft: 8, color: sub.atLimit ? "#dc2626" : "hsl(var(--muted-foreground))" }}>
            · {sub.slotsUsed} of {sub.maxCust} slots used
            {sub.atLimit && " — limit reached"}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="cgrid" id="cgrid">
        {!loading && customers.length === 0 && (
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <h3>No customers found</h3><p>Add your first customer</p>
          </div>
        )}
        {customers.map((c) => (
          <CustomerCard key={c.id} customer={c} onView={viewCust} />
        ))}
        {loading && <div className="ld" style={{ gridColumn: "1/-1" }}><div className="spin" /></div>}
        {hasMore && !loading && <div ref={sentinelRef} style={{ gridColumn: "1/-1", height: 40 }} />}
      </div>

      {/* ── Customer Form Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle id="cust-form-t">{editId ? tr("edit_customer", lang) : tr("add_customer", lang)}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="fld">
              <Label>{tr("full_name", lang)}</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="fld">
              <Label>{tr("phone", lang)}</Label>
              <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="Phone number" />
            </div>
            <div className="fld">
              <Label>Customer #</Label>
              <Input value={formNum} onChange={e => setFormNum(e.target.value)} placeholder="Auto-generated" />
            </div>
            <div className="fld">
              <Label>{tr("notes", lang)}</Label>
              <Textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Notes..."
                className="resize-y min-h-[60px]"
              />
            </div>

            {/* Item selector */}
            <div data-tour="measurements">
              <Label style={{ marginBottom: 8 }}>Measurements</Label>
              <div id="cust-item-sel" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {[...Object.keys(CATS), ...customCats.map(c => c.name)].map(cat => {
                  const sel = custItems.some(i => i.catName === cat)
                  const col = catColor(cat)
                  return (
                    <button key={cat} type="button"
                      className={"item-sel-btn" + (sel ? " selected" : "")}
                      style={sel ? { borderColor: col, color: col, background: col + "18" } : {}}
                      onClick={() => toggleItem(cat)}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, margin: "0 auto 4px" }} />
                      {cat}
                    </button>
                  )
                })}
              </div>

              {/* Category tabs */}
              {custItems.length > 0 && (
                <div id="cust-item-tabs" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {custItems.map(item => {
                    const col = catColor(item.catName)
                    return (
                      <div key={item.catName}
                        className={"item-tab" + (item.active ? " on" : "")}
                        style={item.active ? { borderColor: col, background: col + "18", color: col } : {}}
                        onClick={() => setActiveTab(item.catName)}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: col }} />
                        {item.catName}
                        <span className="item-tab-del" onClick={e => { e.stopPropagation(); removeItem(item.catName) }}>×</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Measurement panels */}
              <div id="cust-meas-panels">
                {activeItem ? (
                  <MeasGroups
                    catName={activeItem.catName}
                    catRow={catRowByName[activeItem.catName]}
                    values={activeItem._measVals || {}}
                    onChange={(fieldKey, value) => updateMeas(activeItem.catName, fieldKey, value)}
                  />
                ) : custItems.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "hsl(var(--muted-foreground))", padding: "8px 0" }}>Select an item above to add measurements</p>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tr("cancel", lang)}</Button>
            <Button id="cust-save-btn" onClick={saveCust} disabled={saving}>
              {saving ? "Saving..." : tr("save_customer", lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Customer Dialog ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle id="vc-title">{viewData ? nm(viewData) : "Customer"}</DialogTitle>
          </DialogHeader>
          <div id="vc-body">
            {viewLoading ? (
              <div className="ld"><div className="spin" /></div>
            ) : viewData ? (
              <div className="dg">
                <div>
                  <div className="dblk">
                    <div className="dbt">Profile</div>
                    <div className="dr"><span className="dk">Customer #</span><span className="dv" style={{ color: "hsl(var(--primary))", fontFamily: "system-ui, sans-serif" }}>{viewData.customer_number || "--"}</span></div>
                    <div className="dr"><span className="dk">Full Name</span><span className="dv">{nm(viewData)}</span></div>
                    <div className="dr"><span className="dk">Phone</span><span className="dv">{viewData.phone ? <a href={"tel:" + viewData.phone} style={{ color: "hsl(var(--primary))", textDecoration: "none" }}>{viewData.phone}</a> : "--"}</span></div>
                    <div className="dr"><span className="dk">Added</span><span className="dv">{viewData.created_at ? fmtDate(viewData.created_at) : "--"}</span></div>
                  </div>
                  {viewData.notes && <div className="dblk"><div className="dbt">Notes</div><p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>{viewData.notes}</p></div>}
                </div>
                <div>
                  {viewItems.length === 0 ? (
                    <div className="dblk"><div className="dbt">Measurements</div><p style={{ fontSize: 12.5, color: "hsl(var(--muted-foreground))" }}>No items added yet</p></div>
                  ) : viewItems.map(item => {
                    const col = CATS[item.category_name] ? CATS[item.category_name].color : "#888"
                    return (
                      <div key={item.id} className="dblk" style={{ borderLeft: "3px solid " + col }}>
                        <div className="dbt" style={{ color: col }}>{item.category_name}</div>
                        {item.versions.length === 0 ? <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>No measurements yet</p> : (
                          <div className="vh-list">
                            {item.versions.map((ver, j) => (
                              <div key={ver.id} className="vh-item">
                                <div className="vh-hd" style={{ display: "flex", alignItems: "center", gap: 8 }}
                                  onClick={e => e.currentTarget.nextElementSibling.classList.toggle("open")}>
                                  <span className="vh-ver">v{ver.version}</span>
                                  <span className="vh-date">{ver.taken_at ? fmtDate(ver.taken_at) : "--"}</span>
                                  {ver.is_current && <span className="vh-cur">Current</span>}
                                  {/* Per-version print button */}
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={e => { e.stopPropagation(); handlePrintVersion(item, ver) }}
                                    title="Print this version"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
                                    Print
                                  </Button>
                                </div>
                                <div className={"vh-body" + (j === 0 ? " open" : "")}>
                                  {/* Side-by-side receipt layout */}
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background:"hsl(var(--border))" }}>
                                    {ver.vals.map(v => {
                                      const isGala   = v.measurement_key === "gala_style"
                                      const isSQStyle = ["sq_baazu_style","sq_gala_style","sq_ghera_style"].includes(v.measurement_key)
                                      const isSelector = isGala || isSQStyle
                                      const galaLabel = { gol_gala: "Gol Gala", v_gala: "V Gala", ban: "Ban" }
                                      const dv = isGala
                                        ? (galaLabel[v.value] || v.value || "--")
                                        : isSQStyle
                                          ? (v.value || "--")
                                          : fmtMeasVal(v.value)
                                      return (
                                        <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "hsl(var(--card))", borderRadius: 1 }}>
                                          <div style={{ fontSize: 10.5, color: "hsl(var(--muted-foreground))", fontWeight: 600 }}>{labelize(v.measurement_key)}</div>
                                          <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))" }}>
                                            {dv}{!isSelector}                                            
                                          </div>                                          
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : <p style={{ color: "hsl(var(--destructive))" }}>Not found</p>}
          </div>
          <DialogFooter style={{ display: "flex", flexDirection: "row", gap: 10 }}>            
            <Button size="lg" variant="outline" style={{ marginLeft: "auto", color: "hsl(var(--destructive))" }}
             onClick={() => {
              setViewOpen(false)
              if (viewData) {
                setDelId(viewData.id)
                setDelName(nm(viewData))
                setDelOpen(true)
              }
            }}>{tr("delete", lang)}</Button>
            <Button size="lg" onClick={() => { setViewOpen(false); if (viewData) openForm(viewData.id) }}>{tr("edit_customer", lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Customer</DialogTitle></DialogHeader>
          <p style={{ fontSize: 14 }}>Delete <strong id="del-n">{delName}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>{tr("cancel", lang)}</Button>
            <Button variant="destructive" id="del-btn" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : tr("delete", lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
