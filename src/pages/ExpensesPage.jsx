import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import { useLang } from "@/hooks/useLang"
import { tr, CATS } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Label }  from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

// Sentinel dropdown value for a standalone "other" (non-category) expense.
const OTHER_VAL = "__other__"

export default function ExpensesPage() {
  const { api } = useAuth()
  const { lang } = useLang()

  const [catsCache, setCatsCache] = useState([])
  const [loading,   setLoading]   = useState(false)

  // Category expenses state
  const [expenses,     setExpenses]     = useState([])
  const [expFormOpen,  setExpFormOpen]  = useState(false)
  const [expDialogCats,setExpDialogCats]= useState([])  // always-fresh list for expense dialog
  const [expCatId,     setExpCatId]     = useState("")
  const [expLabel,     setExpLabel]     = useState("")   // name for an "other" expense
  const [expPrice,     setExpPrice]     = useState("")
  const [expNotes,     setExpNotes]     = useState("")
  const [expEditId,    setExpEditId]    = useState(null)
  const [expSaving,    setExpSaving]    = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [rC, rE] = await Promise.all([
      api.sbQ("item_categories", { order: "id.asc" }),
      api.sbQ("category_expenses", { order: "category_id.asc" }),
    ])
    setCatsCache(rC.data || [])
    setExpenses(rE.data || [])
    setLoading(false)
  }

  async function fetchCats() {
    const r = await api.sbQ("item_categories", { order: "id.asc" })
    const cats = r.data || []
    setCatsCache(cats)
    return cats
  }

  // Open form. Pass a category id to edit a category expense, or pass an
  // existing "other" expense ROW object to edit that standalone expense.
  async function openExpForm(arg = null) {
    const cats = await fetchCats()
    setExpDialogCats(cats)
    if (arg && typeof arg === "object" && arg.is_other) {
      // Editing an existing "other" expense row
      setExpEditId(arg.id)
      setExpCatId(OTHER_VAL)
      setExpLabel(arg.label || "")
      setExpPrice(String(arg.expense_price))
      setExpNotes(arg.notes || "")
    } else if (arg) {
      // Editing a category expense (arg = category id)
      const existing = expenses.find(e => !e.is_other && String(e.category_id) === String(arg))
      setExpEditId(existing ? existing.id : null)
      setExpCatId(String(arg))
      setExpLabel("")
      setExpPrice(existing ? String(existing.expense_price) : "")
      setExpNotes(existing ? (existing.notes || "") : "")
    } else {
      setExpEditId(null); setExpCatId(""); setExpLabel(""); setExpPrice(""); setExpNotes("")
    }
    setExpFormOpen(true)
  }

  async function saveExpense() {
    if (!expCatId) { toast.error("Select a category"); return }
    const isOther = expCatId === OTHER_VAL
    if (isOther && !expLabel.trim()) { toast.error("Enter an expense name"); return }
    setExpSaving(true)

    if (isOther) {
      // Standalone recurring expense — one row per entry, INSERT new (never upsert)
      const body = {
        is_other:      true,
        category_id:   null,
        label:         expLabel.trim(),
        expense_price: parseFloat(expPrice) || 0,
        notes:         expNotes.trim() || null,
      }
      const r = expEditId
        ? await api.sbQ("category_expenses", { method: "PATCH", query: "id=eq." + expEditId, body })
        : await api.sbQ("category_expenses", { method: "POST", body: [body] })
      if (r.error) { toast.error(r.error.message); setExpSaving(false); return }
    } else {
      // Category expense — upsert one row per category (existing behaviour)
      const body = {
        is_other:      false,
        category_id:   parseInt(expCatId),
        label:         null,
        expense_price: parseFloat(expPrice) || 0,
        notes:         expNotes.trim() || null,
      }
      const existing = expenses.find(e => !e.is_other && String(e.category_id) === String(expCatId))
      const r = existing
        ? await api.sbQ("category_expenses", { method: "PATCH", query: "id=eq." + existing.id, body })
        : await api.sbQ("category_expenses", { method: "POST", body: [body] })
      if (r.error) { toast.error(r.error.message); setExpSaving(false); return }
    }
    toast.success("Expense saved")
    setExpSaving(false); setExpFormOpen(false); loadAll()
  }

  async function delExpense(id) {
    if (!confirm("Remove this expense entry?")) return
    const r = await api.sbQ("category_expenses", { method: "DELETE", query: "id=eq." + id })
    if (r.error && r.status !== 204) { toast.error(r.error.message); return }
    toast.success("Expense removed"); loadAll()
  }

  const expMap = {}
  expenses.filter(e => !e.is_other).forEach(e => { expMap[e.category_id] = e })
  const otherExpenses = expenses.filter(e => e.is_other)

  return (
    <div id="s-expenses">
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, width: "100%", justifyContent: "flex-end" }}>
          <Button id="lbl-add-expense" variant="default" size="default" className="w-full" onClick={() => openExpForm()}>+ Add Expense</Button>
        </div>
      </div>

      <div className="rates-grid" id="expenses-grid">
        {/* Category expenses */}
        {!loading && catsCache.length > 0 && catsCache.map(cat => {
          const exp = expMap[cat.id]
          const col = CATS[cat.name] ? CATS[cat.name].color : "#888"
          if (!exp) return null
          return (
            <div key={cat.id} className="rate-card">
              <div className="rate-cat" style={{ color: col }}>{cat.name}</div>
              <div className="rate-price" style={{ color: "hsl(var(--destructive))" }}>Rs {exp.expense_price}</div>
              {exp.notes && <div className="rate-ds" style={{ color: "hsl(var(--muted-foreground))" }}>{exp.notes}</div>}
              <div className="rate-actions">
                <Button variant="outline" size="sm" style={{ flex: 1 }} onClick={() => openExpForm(cat.id)}>Edit</Button>
                <Button variant="outline" className="text-destructive" size="sm" style={{ flex: 1 }}
                  onClick={() => delExpense(exp.id)}>Delete</Button>
              </div>
            </div>
          )
        })}

        {/* Other (recurring) expenses — electricity, gas, rent, etc. */}
        {!loading && otherExpenses.map(exp => (
          <div key={"o" + exp.id} className="rate-card">
            <div className="rate-cat" style={{ color: "#888", display: "flex", alignItems: "center", gap: 6 }}>
              {exp.label || "Other"}
              <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>OTHER</span>
            </div>
            <div className="rate-price" style={{ color: "hsl(var(--destructive))" }}>Rs {exp.expense_price}</div>
            {exp.notes && <div className="rate-ds" style={{ color: "hsl(var(--muted-foreground))" }}>{exp.notes}</div>}
            <div className="rate-actions">
              <Button variant="outline" size="sm" style={{ flex: 1 }} onClick={() => openExpForm(exp)}>Edit</Button>
              <Button variant="outline" className="text-destructive" size="sm" style={{ flex: 1 }}
                onClick={() => delExpense(exp.id)}>Delete</Button>
            </div>
          </div>
        ))}

        {!loading && expenses.length === 0 && (
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>No expenses set. Add a category expense or an "Other Expense" (rent, electricity…) to track them in reports.</p>
          </div>
        )}
      </div>

      {/* ── Category Expense Form Dialog ── */}
      <Dialog open={expFormOpen} onOpenChange={setExpFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle id="exp-form-t">{expEditId ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="fld">
              <Label>Category</Label>
              <select
                id="ef-cat"
                className="sel-sm"
                style={{ width: "100%" }}
                value={expCatId}
                onChange={e => setExpCatId(e.target.value)}
              >
                <option value="">-- Select Category --</option>
                {expDialogCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value={OTHER_VAL}>Other Expense (rent, electricity…)</option>
              </select>
            </div>
            {expCatId === OTHER_VAL && (
              <div className="fld">
                <Label>Expense Name</Label>
                <Input
                  id="ef-label"
                  value={expLabel}
                  onChange={e => setExpLabel(e.target.value)}
                  placeholder="e.g. Electricity, Gas, Shop Rent"
                />
              </div>
            )}
            <div className="fld">
              <Label>{expCatId === OTHER_VAL ? "Monthly Amount (Rs)" : "Expense Price (Rs)"}</Label>
              <Input
                id="ef-price"
                type="number"
                value={expPrice}
                onChange={e => setExpPrice(e.target.value)}
                placeholder="e.g. 150"
              />
            </div>
            <div className="fld">
              <Label>Notes</Label>
              <Textarea
                id="ef-notes"
                value={expNotes}
                onChange={e => setExpNotes(e.target.value)}
                placeholder="e.g. Thread, buttons, lining..."
                className="resize-y min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpFormOpen(false)}>{tr("cancel", lang)}</Button>
            <Button id="exp-save-btn" onClick={saveExpense} disabled={expSaving}>
              {expSaving ? "Saving..." : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
