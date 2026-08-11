import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import { Store, Image as ImageIcon, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useLang } from "@/hooks/useLang"
import { useTourController } from "@/context/TourContext"
import { tr } from "@/lib/config"
import { startTour, resetTour } from "@/lib/tour"

// Lets a tailor view and edit their own shop name + logo (URL).
export default function ProfilePage() {
  const { api, user, getShopName, getLogoUrl, applyMetadata, logout } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  const { call } = useTourController()
  const t = (k) => tr(k, lang)

  const [shopName, setShopName] = useState(getShopName() === "User" ? "" : getShopName())
  const [logoUrl,  setLogoUrl]  = useState(getLogoUrl() || "")
  const [saving,   setSaving]   = useState(false)

  const login = user?.phone
    ? "0" + String(user.phone).replace(/^92/, "")
    : (user?.email && !user.email.endsWith("@tailor.local") ? user.email : "")

  const validLogo = logoUrl.trim() && /^https?:\/\//i.test(logoUrl.trim())

  async function save(e) {
    e.preventDefault()
    if (!shopName.trim()) return toast.error("Shop name is required")
    if (logoUrl.trim() && !validLogo) return toast.error("Logo URL must start with http:// or https://")
    setSaving(true)
    const r = await api.rpc("update_my_profile", {
      p_shop_name: shopName.trim(),
      p_logo_url:  logoUrl.trim(),
    })
    setSaving(false)
    if (r.error) return toast.error(r.error.message)
    // reflect immediately in the sidebar/header without re-login
    applyMetadata({ name: shopName.trim(), shop_name: shopName.trim(), logo_url: logoUrl.trim() || null })
    toast.success(t("profile_updated"))
  }

  async function handleLogout() {
    await logout()
    navigate("/login")
  }

  return (
    <div className="mx-auto max-w-2xl px-2 py-2">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("profile")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your shop name and logo appear in the app and on printed receipts.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
          <CardDescription>{login ? <>Signed in as <span className="font-medium">{login}</span></> : "Your account"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="pf-shop">{t("shop_name")} <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="pf-shop" value={shopName} onChange={e => setShopName(e.target.value)}
                  placeholder="e.g. Saifi Tailors" className="pl-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pf-logo">Logo URL</Label>
              <div className="relative">
                <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="pf-logo" value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://…/logo.png" type="url" className="pl-9" />
              </div>
              <p className="text-xs text-muted-foreground">Paste a hosted image link (PNG/JPG/SVG).</p>
            </div>

            {/* Live preview */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              {validLogo
                ? <img src={logoUrl.trim()} alt="" className="h-12 w-12 rounded-md border object-contain bg-background"
                    onError={e => { e.currentTarget.style.display = "none" }} />
                : <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-background text-lg font-bold text-muted-foreground">
                    {(shopName.trim()[0] || "T").toUpperCase()}
                  </div>}
              <div>
                <div className="text-sm font-semibold">{shopName.trim() || "Your shop name"}</div>
                <div className="text-xs text-muted-foreground">Preview</div>
              </div>
            </div>

            <Button type="submit" disabled={saving}>{saving ? t("loading") : t("save_profile")}</Button>
          </form>
        </CardContent>
      </Card>

      {/* Replay the first-run product tour */}
      <Card className="mt-4">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div>
            <div className="text-sm font-semibold">{lang === "ur" ? "ایپ کا دورہ" : "App tour"}</div>
            <div className="text-xs text-muted-foreground">
              {lang === "ur" ? "خصوصیات کا فوری گائیڈڈ دورہ دوبارہ چلائیں۔" : "Replay the quick guided tour of the main features."}
            </div>
          </div>
          <Button type="button" variant="outline"
            onClick={() => { resetTour(user?.id || user?.email); navigate("/dashboard"); setTimeout(() => startTour({ lang, navigate, call }), 300) }}>
            {lang === "ur" ? "دورہ چلائیں" : "Start tour"}
          </Button>
        </CardContent>
      </Card>

      {/* Sign out — only place to log out on mobile, where the sidebar is hidden */}
      <Card className="mt-4">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div>
            <div className="text-sm font-semibold">{t("sign_out")}</div>
            <div className="text-xs text-muted-foreground">
              {lang === "ur" ? "اپنے اکاؤنٹ سے سائن آؤٹ کریں۔" : "Sign out of your account on this device."}
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={handleLogout}
            className="text-destructive hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            {t("logout")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
