import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import { useLang } from "@/hooks/useLang"
import { tr, CATS } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export default function RatesPage() {
  const { api } = useAuth()
  const { lang } = useLang()

  const [rates,      setRates]      = useState([])
  const [catsCache,  setCatsCache]  = useState([])
  const [loading,    setLoading]    = useState(false)

  // Rate form state
  const [formOpen,   setFormOpen]   = useState(false)
  const [dialogCats, setDialogCats] = useState([])   // always-fresh list for the open dialog
  const [editId,     setEditId]     = useState(null)
  const [label,      setLabel]      = useState("")
  const [catId,      setCatId]      = useState("")
  const [price,      setPrice]      = useState("")
  const [dsReshmi,   setDsReshmi]   = useState(300)
  const [dsJaali,    setDsJaali]    = useState(500)
  const [dsSada,     setDsSada]     = useState(200)
  const [showDs,     setShowDs]     = useState(false)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [rC, rR] = await Promise.all([
      api.sbQ("item_categories", { order: "id.asc" }),
      api.sbQ("rates", { order: "category_id.asc,label.asc" }),
    ])
    setCatsCache(rC.data || [])
    setRates(rR.data || [])
    setLoading(false)
  }

  // Always fetch fresh categories on dialog open — never rely on possibly-stale catsCache
  async function fetchCats() {
    const r = await api.sbQ("item_categories", { order: "id.asc" })
    const cats = r.data || []
    setCatsCache(cats)
    return cats
  }

  async function openForm(id = null) {
    setEditId(id)
    const cats = await fetchCats()
    setDialogCats(cats)
    if (id) {
      const r = rates.find(x => x.id === id) || {}
      setLabel(r.label || ""); setCatId(r.category_id || "")
      setPrice(r.price || ""); setDsReshmi(r.ds_reshmi_price || 300); setDsJaali(r.ds_jaali_price || 500); setDsSada(r.ds_sada_price || 200)
      const cat = cats.find(c => String(c.id) === String(r.category_id))
      setShowDs(!!(cat && cat.name === "Shalwar Qameez"))
    } else {
      setLabel(""); setCatId(""); setPrice(""); setDsReshmi(300); setDsJaali(500); setDsSada(200); setShowDs(false)
    }
    setFormOpen(true)
  }

  function onCatChange(val) {
    setCatId(val)
    const cat = dialogCats.find(c => String(c.id) === String(val))
    setShowDs(!!(cat && cat.name === "Shalwar Qameez"))
  }

  async function saveRate() {
    if (!label.trim()) { toast.error("Rate label required"); return }
    setSaving(true)
    const body = {
      label: label.trim(),
      category_id: catId || null,
      price: parseFloat(price) || 0,
      ds_reshmi_price: showDs ? (parseFloat(dsReshmi) || 300) : null,
      ds_jaali_price:  showDs ? (parseFloat(dsJaali)  || 500) : null,
      ds_sada_price:   showDs ? (parseFloat(dsSada)   || 200) : null,
    }
    const r = editId
      ? await api.sbQ("rates", { method: "PATCH", query: "id=eq." + editId, body })
      : await api.sbQ("rates", { method: "POST",  body: [body] })
    if (r.error) { toast.error(r.error.message); setSaving(false); return }
    toast.success("Rate saved")
    setSaving(false); setFormOpen(false); loadAll()
  }

  async function delRate(id) {
    if (!confirm("Delete this rate?")) return
    const r = await api.sbQ("rates", { method: "DELETE", query: "id=eq." + id })
    if (r.error && r.status !== 204) { toast.error(r.error.message); return }
    toast.success("Rate deleted"); loadAll()
  }

  const catMap = {}
  catsCache.forEach(c => { catMap[c.id] = c })

  return (
    <div id="s-rates">
      {/* Toolbar */}
      <div className="toolbar">
        <div />
        <Button id="lbl-add-rate" className="w-full" onClick={() => openForm()}>{tr("add_rate", lang)}</Button>
      </div>

      {/* Rates Grid */}
      <div className="rates-grid" id="rates-grid">
        {loading && <div className="ld" style={{ gridColumn: "1/-1" }}><div className="spin" /></div>}
        {!loading && rates.length === 0 && (
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <h3>No rates yet</h3><p>Add your first rate</p>
          </div>
        )}
        {rates.map(rate => {
          const cat = catMap[rate.category_id] || {}
          const col = CATS[cat.name] ? CATS[cat.name].color : "#888"
          return (
            <div key={rate.id} className="rate-card">
              <div className="rate-cat" style={{ color: col }}>{cat.name || "General"}</div>
              <div className="rate-label">{rate.label}</div>
              <div className="rate-price">Rs {rate.price}</div>
              {rate.ds_reshmi_price && <div className="rate-ds">DS Reshmi: +Rs {rate.ds_reshmi_price}</div>}
              {rate.ds_jaali_price  && <div className="rate-ds">DS Jaali Pancha: +Rs {rate.ds_jaali_price}</div>}
              {rate.ds_sada_price   && <div className="rate-ds">DS Sada: +Rs {rate.ds_sada_price}</div>}
              <div className="rate-actions">
                <Button variant="outline" size="sm" onClick={() => openForm(rate.id)}>Edit</Button>
                <Button variant="outline" className="text-destructive" size="sm"
                  onClick={() => delRate(rate.id)}>Delete</Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Rate Form Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle id="rate-form-t">{editId ? "Edit Rate" : "Add Rate"}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="fld">
              <Label>Label</Label>
              <Input id="rf-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Shalwar Qameez Basic" />
            </div>
            <div className="fld">
              <Label>Category</Label>
              <select id="rf-cat" className="sel-sm" style={{ width: "100%" }} value={catId} onChange={e => onCatChange(e.target.value)}>
                <option value="">-- Select Category --</option>
                {dialogCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="fld">
              <Label>Price (Rs)</Label>
              <Input id="rf-price" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
            </div>
            {showDs && (
              <div id="rf-ds-row" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="fld">
                  <Label>DS Reshmi Price (Rs)</Label>
                  <Input id="rf-ds-reshmi" type="number" value={dsReshmi} onChange={e => setDsReshmi(e.target.value)} />
                </div>
                <div className="fld">
                  <Label>DS Jaali Pancha Price (Rs)</Label>
                  <Input id="rf-ds-jaali" type="number" value={dsJaali} onChange={e => setDsJaali(e.target.value)} />
                </div>
                <div className="fld">
                  <Label>DS Sada Price (Rs)</Label>
                  <Input id="rf-ds-sada" type="number" value={dsSada} onChange={e => setDsSada(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{tr("cancel", lang)}</Button>
            <Button id="rate-save-btn" onClick={saveRate} disabled={saving}>
              {saving ? "Saving..." : tr("save_rate", lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
