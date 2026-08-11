import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import { useLang } from "@/hooks/useLang"
import { tr, CATS, FIELD_CATALOGUE } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export default function CategoriesPage() {
  const { api } = useAuth()
  const { lang } = useLang()

  const [catsCache, setCatsCache] = useState([])
  const [loading,   setLoading]   = useState(false)

  // Custom categories state
  const [catFormOpen, setCatFormOpen] = useState(false)
  const [catEditId,   setCatEditId]   = useState(null)
  const [catName,     setCatName]     = useState("")
  const [catFields,   setCatFields]   = useState([])   // selected field keys
  const [catSaving,   setCatSaving]   = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const rC = await api.sbQ("item_categories", { order: "id.asc" })
    setCatsCache(rC.data || [])
    setLoading(false)
  }

  function openCatForm(cat = null) {
    if (cat) {
      setCatEditId(cat.id)
      setCatName(cat.name || "")
      setCatFields(Array.isArray(cat.meas_fields) ? cat.meas_fields : [])
    } else {
      setCatEditId(null); setCatName(""); setCatFields([])
    }
    setCatFormOpen(true)
  }

  function toggleCatField(key) {
    setCatFields(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  async function saveCategory() {
    if (!catName.trim()) { toast.error("Category name required"); return }
    if (CATS[catName.trim()]) { toast.error("That name is a built-in category"); return }
    setCatSaving(true)
    const body = { name: catName.trim(), is_custom: true, meas_fields: catFields }
    const r = catEditId
      ? await api.sbQ("item_categories", { method: "PATCH", query: "id=eq." + catEditId, body })
      : await api.sbQ("item_categories", { method: "POST", body: [body] })
    if (r.error) { toast.error(r.error.message); setCatSaving(false); return }
    toast.success("Category saved")
    setCatSaving(false); setCatFormOpen(false); loadAll()
  }

  async function delCategory(id) {
    if (!confirm("Delete this custom category? Rates/expenses linked to it remain but it won't be selectable in new orders.")) return
    const r = await api.sbQ("item_categories", { method: "DELETE", query: "id=eq." + id })
    if (r.error && r.status !== 204) { toast.error(r.error.message); return }
    toast.success("Category deleted"); loadAll()
  }

  const fieldsCountLabel = (cat) => {
    const n = (cat.meas_fields && cat.meas_fields.length) || 0
    if (!n) return tr("no_fields_selected", lang)
    // tr() resolves "{n} fields" via the Urdu phrase patterns when lang === ur
    return tr("fields_count", lang).replace("{n}", n)
  }

  return (
    <div id="s-categories">
      <div className="toolbar" style={{ marginBottom: 16 }}>       
        <Button variant="default" size="default" className="w-full" onClick={() => openCatForm()}>{tr("add_category", lang)}</Button>
      </div>

      <div className="rates-grid">
        {loading && <div className="ld" style={{ gridColumn: "1/-1" }}><div className="spin" /></div>}

        {/* Built-in categories (read-only) */}
        {!loading && Object.keys(CATS).map(name => (
          <div key={"b" + name} className="rate-card">
            <div className="rate-cat" style={{ color: CATS[name].color, display: "flex", alignItems: "center", gap: 6 }}>
              {name}
              <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>{tr("built_in", lang)}</span>
            </div>
            <div className="rate-ds" style={{ color: "hsl(var(--muted-foreground))" }}>{tr("standard_measurements", lang)}</div>
          </div>
        ))}

        {/* Custom categories */}
        {!loading && catsCache.filter(c => c.is_custom || !CATS[c.name]).map(cat => (
          <div key={cat.id} className="rate-card">
            <div className="rate-cat" style={{ color: "#888", display: "flex", alignItems: "center", gap: 6 }}>
              {cat.name}
              <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>{tr("custom", lang)}</span>
            </div>
            <div className="rate-ds" style={{ color: "hsl(var(--muted-foreground))" }}>
              {fieldsCountLabel(cat)}
            </div>
            <div className="rate-actions">
              <Button variant="outline" size="sm" style={{ flex: 1 }} onClick={() => openCatForm(cat)}>Edit</Button>
              <Button variant="outline" className="text-destructive" size="sm" style={{ flex: 1 }} onClick={() => delCategory(cat.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Custom Category Form Dialog ── */}
      <Dialog open={catFormOpen} onOpenChange={setCatFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{catEditId ? tr("edit_category", lang) : tr("add_category_dlg", lang)}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="fld">
              <Label>{tr("category_name", lang)}</Label>
              <Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="e.g. Coat" />
            </div>
            <div className="fld">
              <Label className="mb-8">{tr("measurement_fields", lang)}</Label>              
              <div className="flex flex-col gap-4 overflow-y-auto border border-solid hsl(var(--border)) bg-card rounded-xl p-4">
                {FIELD_CATALOGUE.map(grp => (
                  <div key={grp.group} className="flex flex-col gap-2 border-b border-solid border-hsl(var(--border)) last:border-b-0 pb-2">
                    <Label className="text-secondary-foreground text-sm">{grp.groupLabel}</Label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {grp.fields.map(f => (
                        <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer", userSelect: "none" }}>
                          <input type="checkbox" checked={catFields.includes(f.key)} onChange={() => toggleCatField(f.key)} />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatFormOpen(false)}>{tr("cancel", lang)}</Button>
            <Button onClick={saveCategory} disabled={catSaving}>
              {catSaving ? "Saving..." : tr("save_category", lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
