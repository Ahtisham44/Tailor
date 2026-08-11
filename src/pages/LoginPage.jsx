import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useLang } from "@/hooks/useLang"
import { Input } from "@/components/ui/input"
import { Button }  from "@/components/ui/button"
import { SELF_SIGNUP_ENABLED } from "@/lib/config"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import "@/styles/login.css"
import "@/styles/globals.css"

/* ── Showcase slides: code-built product mockups on dark color backgrounds ── */
const SLIDES = [
  {
    bg: "linear-gradient(160deg, #14142b 0%, #20204a 100%)",
    accent: "#8b8bff",
    chip: "Orders",
    en: ["Track every order", "From booking to delivery — see status at a glance."],
    ur: ["ہر آرڈر پر نظر", "بکنگ سے ڈلیوری تک — ایک نظر میں حیثیت دیکھیں۔"],
    variant: "list",
  },
  {
    bg: "linear-gradient(160deg, #0f2027 0%, #16343b 100%)",
    accent: "#3fd0c9",
    chip: "Measurements",
    en: ["Digital measurement book", "Save every customer's sizes with version history."],
    ur: ["ڈیجیٹل ناپ کتاب", "ہر گاہک کے ناپ ورژن ہسٹری کے ساتھ محفوظ کریں۔"],
    variant: "cards",
  },
  {
    bg: "linear-gradient(160deg, #2a1530 0%, #3d1f47 100%)",
    accent: "#e08bff",
    chip: "Reports",
    en: ["Know your numbers", "Daily sales, pending work and earnings, all in one place."],
    ur: ["اپنے اعداد جانیں", "روزانہ فروخت، باقی کام اور آمدنی، سب ایک جگہ۔"],
    variant: "chart",
  },
  {
    bg: "linear-gradient(160deg, #1a1207 0%, #2e2410 100%)",
    accent: "#f0b357",
    chip: "Receipts",
    en: ["Print Urdu receipts", "Hand your customer a clean measurement slip in seconds."],
    ur: ["اردو رسید پرنٹ کریں", "گاہک کو صاف ناپ پرچی سیکنڈوں میں دیں۔"],
    variant: "receipt",
  },
]

function MockGraphic({ variant, accent }) {
  if (variant === "cards") {
    return (
      <div className="lg-mock-body">
        <span className="lg-chip" style={{ color: accent }}>Customer #1042</span>
        <div className="lg-mcards">
          {[0, 1, 2, 3].map(i => (
            <div className="lg-mcard" key={i}>
              <div className="lg-mbar" style={{ height: 22 + i * 8, background: accent }} />
              <div className="lg-mbar" style={{ height: 16 + i * 6 }} />
              <div className="lg-mbar" style={{ height: 30 - i * 4 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (variant === "chart") {
    return (
      <div className="lg-mock-body">
        <div className="lg-mrow w40" />
        <div className="lg-mcards" style={{ gridTemplateColumns: "1fr" }}>
          <div className="lg-mcard" style={{ height: 90, alignItems: "flex-end", gap: 6 }}>
            {[40, 65, 50, 80, 60, 95, 70].map((h, i) => (
              <div key={i} className="lg-mbar" style={{ height: h + "%", flex: 1, background: i === 5 ? accent : "rgba(255,255,255,0.45)" }} />
            ))}
          </div>
        </div>
      </div>
    )
  }
  if (variant === "receipt") {
    return (
      <div className="lg-mock-body" style={{ alignItems: "flex-end" }}>
        <span className="lg-chip" style={{ color: accent }}>رسید • v3</span>
        <div className="lg-mrow w80" />
        <div className="lg-mrow w60" />
        <div className="lg-mrow w80" />
        <div className="lg-mrow w40" />
      </div>
    )
  }
  // default: list (orders)
  return (
    <div className="lg-mock-body">
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="lg-dot" style={{ background: accent, opacity: 1 }} />
          <div className="lg-mrow" style={{ flex: 1 }} />
          <span className="lg-chip" style={{ fontSize: 10, padding: "2px 8px", color: accent }}>
            {["Ready", "Sewing", "Booked"][i]}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function LoginPage() {
  const { login, api } = useAuth()
  const { lang, setLang } = useLang()
  const navigate = useNavigate()

  // ── auth views (unchanged logic) ──
  const [view, setView] = useState("login")
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [suPhone, setSuPhone] = useState("")
  const [suCode, setSuCode] = useState("")
  const [suName, setSuName] = useState("")
  const [suPass, setSuPass] = useState("")
  // ── forgot-password (phone + account UUID → new password) ──
  const [rsPhone, setRsPhone] = useState("")
  const [rsUuid, setRsUuid] = useState("")
  const [rsPass, setRsPass] = useState("")

  function go(v) { setView(v); setError(""); setSuccess("") }

  async function handleLogin(e) {
    e.preventDefault()
    setError(""); setSuccess("")
    if (!identifier || !password) { setError("Enter your email/phone and password."); return }
    setLoading(true)
    try {
      await login(identifier.trim(), password)
      navigate("/dashboard", { replace: true })
    } catch (err) {
      let m = err.message || "This user is disabled. Contact your admin for assistance."
      if (m.toLowerCase().includes("invalid")) m = "Wrong credentials. Check and try again."
      setError(m)
    } finally { setLoading(false) }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError(""); setSuccess("")
    if (!api.normalizePkPhone(rsPhone)) { setError("Enter a valid mobile number, e.g. 0300 1234567"); return }
    if (!rsUuid.trim()) { setError(lang === "ur" ? "اپنا اکاؤنٹ UUID درج کریں۔" : "Enter your account UUID."); return }
    if (rsPass.length < 8) { setError(lang === "ur" ? "نیا پاس ورڈ کم از کم 8 حروف کا ہونا چاہیے۔" : "New password must be at least 8 characters."); return }
    setLoading(true)
    const r = await api.fn("reset-password", { phone: rsPhone.trim(), uuid: rsUuid.trim(), new_password: rsPass })
    setLoading(false)
    if (r.error) { setError(r.error.message); return }
    setRsPass("")
    go("login")
    setSuccess(lang === "ur" ? "پاس ورڈ تبدیل ہو گیا۔ نئے پاس ورڈ سے سائن ان کریں۔" : "Password updated. Sign in with your new password.")
  }

  async function handleSendOtp(e) {
    e.preventDefault()
    setError(""); setSuccess("")
    if (!api.normalizePkPhone(suPhone)) { setError("Enter a valid mobile number, e.g. 0300 1234567"); return }
    setLoading(true)
    const r = await api.fn("send-otp", { phone: suPhone })
    setLoading(false)
    if (r.error) { setError(r.error.message); return }
    setSuccess("Code sent on WhatsApp to " + r.data.phone)
    setView("signup-verify")
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError(""); setSuccess("")
    if (!/^\d{6}$/.test(suCode.trim())) { setError("Enter the 6-digit code from WhatsApp."); return }
    if (suPass.length < 8) { setError("Password must be at least 8 characters."); return }
    setLoading(true)
    const r = await api.fn("verify-otp", { phone: suPhone, code: suCode.trim(), password: suPass, name: suName })
    if (r.error) { setLoading(false); setError(r.error.message); return }
    try {
      await login(r.data.phone, suPass)
      navigate("/dashboard", { replace: true })
    } catch {
      setLoading(false)
      go("login")
      setSuccess("Account created! Sign in with your phone number.")
    }
  }

  // ── carousel ──
  const [slide, setSlide] = useState(0)
  const timerRef = useRef(null)
  useEffect(() => {
    timerRef.current = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 4500)
    return () => clearInterval(timerRef.current)
  }, [])
  function gotoSlide(i) {
    setSlide(i)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 4500)
  }

  // ── iOS-style bottom sheet (mobile only) ──
  // Detents: collapsed (peek) and expanded (full). Drag with momentum-ish snap.
  const panelRef = useRef(null)
  const [collapsed, setCollapsed] = useState(false)
  const drag = useRef({ active: false, startY: 0, baseY: 0, lastY: 0, lastT: 0, vy: 0 })

  const isMobile = () => window.matchMedia("(max-width: 820px)").matches

  // Compute the collapsed offset = sheet height minus a visible peek header.
  const collapsedOffset = useCallback(() => {
    const el = panelRef.current
    if (!el) return 0
    const peek = 132 // how much of the sheet stays visible when collapsed
    return Math.max(el.offsetHeight - peek, 0)
  }, [])

  const applyY = useCallback((y) => {
    const el = panelRef.current
    if (el) el.style.setProperty("--sheet-y", y + "px")
  }, [])

  // Snap to a detent.
  const snap = useCallback((toCollapsed) => {
    const el = panelRef.current
    if (!el) return
    el.classList.add("animate")
    applyY(toCollapsed ? collapsedOffset() : 0)
    setCollapsed(toCollapsed)
    window.setTimeout(() => el.classList.remove("animate"), 460)
  }, [applyY, collapsedOffset])

  // Reset sheet position whenever the view changes (content height changes).
  useEffect(() => {
    if (!isMobile()) return
    requestAnimationFrame(() => snap(collapsed))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const onDragStart = (clientY) => {
    if (!isMobile()) return
    const el = panelRef.current
    if (!el) return
    el.classList.remove("animate")
    const cur = parseFloat(getComputedStyle(el).getPropertyValue("--sheet-y")) || 0
    drag.current = { active: true, startY: clientY, baseY: cur, lastY: clientY, lastT: Date.now(), vy: 0 }
  }
  const onDragMove = (clientY) => {
    const d = drag.current
    if (!d.active) return
    const max = collapsedOffset()
    let next = d.baseY + (clientY - d.startY)
    next = Math.max(0, Math.min(next, max + 40)) // small rubber-band past collapsed
    applyY(next)
    const now = Date.now()
    d.vy = (clientY - d.lastY) / Math.max(now - d.lastT, 1)
    d.lastY = clientY; d.lastT = now
  }
  const onDragEnd = () => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    const el = panelRef.current
    const cur = parseFloat(getComputedStyle(el).getPropertyValue("--sheet-y")) || 0
    const mid = collapsedOffset() / 2
    // velocity-based decision, falling back to position
    if (d.vy > 0.6) snap(true)
    else if (d.vy < -0.6) snap(false)
    else snap(cur > mid)
  }

  // Pointer handlers for the grabber.
  const grabberHandlers = {
    onPointerDown: (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); onDragStart(e.clientY) },
    onPointerMove: (e) => onDragMove(e.clientY),
    onPointerUp: onDragEnd,
    onPointerCancel: onDragEnd,
  }

  // Tapping the grabber when collapsed expands the sheet.
  const onGrabberClick = () => { if (collapsed) snap(false) }

  const titles = {
    login: {
      en: ["Welcome back", "Sign in to your shop dashboard"],
      ur: ["خوش آمدید", "اپنے دکان ڈیش بورڈ میں سائن ان کریں"],
    },
    reset: {
      en: ["Reset password", "Verify your phone and account UUID to set a new password"],
      ur: ["پاس ورڈ ری سیٹ", "نیا پاس ورڈ سیٹ کرنے کے لیے اپنا فون اور اکاؤنٹ UUID درج کریں"],
    },
    "signup-phone": {
      en: ["Create your account", "We'll send a verification code on WhatsApp"],
      ur: ["اکاؤنٹ بنائیں", "ہم واٹس ایپ پر تصدیقی کوڈ بھیجیں گے"],
    },
    "signup-verify": {
      en: ["Check WhatsApp", "Enter the code and choose a password"],
      ur: ["واٹس ایپ دیکھیں", "کوڈ درج کریں اور پاس ورڈ منتخب کریں"],
    },
  }
  const tt = lang === "ur" ? titles[view].ur : titles[view].en

  return (
    <div className="lg-root">
      {/* LEFT / TOP — dark carousel */}
      <div className="lg-showcase">
        <div className="lg-brand">
          <span className="lg-brand-mark">T</span>
          <span>TailorCRM</span>
        </div>

        <div className="lg-slides">
          {SLIDES.map((s, i) => {
            const cap = lang === "ur" ? s.ur : s.en
            return (
              <div key={i} className={"lg-slide" + (i === slide ? " on" : "")} style={{ background: s.bg }}>
                <div className="lg-mock">
                  <div className="lg-mock-bar">
                    <span className="lg-dot" style={{ background: "#ff5f57" }} />
                    <span className="lg-dot" style={{ background: "#febc2e" }} />
                    <span className="lg-dot" style={{ background: "#28c840" }} />
                  </div>
                  <MockGraphic variant={s.variant} accent={s.accent} />
                </div>
                <div className="lg-cap">
                  <h3>{cap[0]}</h3>
                  <p>{cap[1]}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="lg-dots">
          {SLIDES.map((_, i) => (
            <Button key={i} className={i === slide ? "on" : ""} onClick={() => gotoSlide(i)} aria-label={"Slide " + (i + 1)} />
          ))}
        </div>
      </div>

      {/* RIGHT / BOTTOM-SHEET — login */}
      <div className={"lg-panel"} ref={panelRef}>
        <div className="lg-grabber" {...grabberHandlers} onClick={onGrabberClick} />

        <div className="lg-form-wrap p-6 pt-2 pb-12 h-fit">
          <div className="lg-top">
            <Tabs value={lang} onValueChange={setLang}>
              <TabsList className="gap-1">
                <TabsTrigger value="en">EN</TabsTrigger>
                <TabsTrigger value="ur" style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}>اردو</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <h1 className="lg-h1">{tt[0]}</h1>
          <p className="lg-sub">{tt[1]}</p>

          {error && <div className="lg-alert err">{error}</div>}
          {success && <div className="lg-alert ok">{success}</div>}

          {view === "login" && (
            <form onSubmit={handleLogin}>
              <div className="lg-field">
                <label className="lg-label" htmlFor="identifier">{lang === "ur" ? "ای میل یا موبائل نمبر" : "Email or mobile number"}</label>
                <Input id="identifier" type="text" dir="ltr"
                  placeholder="you@example.com or 0300 1234567"
                  value={identifier} onChange={e => setIdentifier(e.target.value)} required />
              </div>
              <div className="lg-field">
                <label className="lg-label" htmlFor="password">{lang === "ur" ? "پاس ورڈ" : "Password"}</label>
                <Input id="password" type="password" dir="ltr" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? (lang === "ur" ? "سائن ان ہو رہا ہے..." : "Signing in...") : (lang === "ur" ? "سائن ان" : "Sign in")}
              </Button>
              <div className="lg-row">
                <Button type="button" variant="link" size="sm" className="px-0" onClick={() => go("reset")}>
                  {lang === "ur" ? "پاس ورڈ بھول گئے؟" : "Forgot password?"}
                </Button>
                {SELF_SIGNUP_ENABLED && (
                  <Button type="button" variant="link" size="sm" className="px-0 font-semibold" onClick={() => go("signup-phone")}>
                    {lang === "ur" ? "اکاؤنٹ بنائیں" : "Create account"}
                  </Button>
                )}
              </div>
            </form>
          )}

          {view === "reset" && (
            <form onSubmit={handleReset}>
              <div className="lg-field">
                <label className="lg-label" htmlFor="reset-phone">{lang === "ur" ? "موبائل نمبر" : "Mobile number"}</label>
                <Input id="reset-phone" type="tel" dir="ltr" placeholder="0300 1234567"
                  value={rsPhone} onChange={e => setRsPhone(e.target.value)} required />
              </div>
              <div className="lg-field">
                <label className="lg-label" htmlFor="reset-uuid">{lang === "ur" ? "اکاؤنٹ UUID" : "Account UUID"}</label>
                <Input id="reset-uuid" type="text" dir="ltr" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={rsUuid} onChange={e => setRsUuid(e.target.value)} required />
                <p className="lg-help">{lang === "ur" ? "یہ آپ کے اکاؤنٹ کے ساتھ محفوظ کردہ UUID ہے۔" : "The UUID saved with your account. Contact your admin if you don't have it."}</p>
              </div>
              <div className="lg-field">
                <label className="lg-label" htmlFor="reset-pass">{lang === "ur" ? "نیا پاس ورڈ" : "New password"}</label>
                <Input id="reset-pass" type="password" dir="ltr" placeholder={lang === "ur" ? "کم از کم 8 حروف" : "min 8 characters"}
                  value={rsPass} onChange={e => setRsPass(e.target.value)} required />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? (lang === "ur" ? "تبدیل ہو رہا ہے..." : "Updating...") : (lang === "ur" ? "پاس ورڈ تبدیل کریں" : "Reset password")}
              </Button>
              <div className="lg-row" style={{ justifyContent: "center" }}>
                <Button type="button" variant="link" size="sm" className="px-0" onClick={() => go("login")}>
                  {lang === "ur" ? "← سائن ان پر واپس" : "← Back to sign in"}
                </Button>
              </div>
            </form>
          )}

          {view === "signup-phone" && (
            <form onSubmit={handleSendOtp}>
              <div className="lg-field">
                <label className="lg-label" htmlFor="su-phone">{lang === "ur" ? "واٹس ایپ موبائل نمبر" : "WhatsApp mobile number"}</label>
                <Input id="su-phone" type="tel" dir="ltr" placeholder="0300 1234567"
                  value={suPhone} onChange={e => setSuPhone(e.target.value)} required />
                <p className="lg-help">{lang === "ur" ? "ہم اس نمبر پر واٹس ایپ پر 6 ہندسوں کا کوڈ بھیجیں گے۔" : "We'll send a 6-digit code to this number on WhatsApp."}</p>
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? (lang === "ur" ? "کوڈ بھیجا جا رہا ہے..." : "Sending code...") : (lang === "ur" ? "واٹس ایپ کوڈ بھیجیں" : "Send WhatsApp code")}
              </Button>
              <div className="lg-row" style={{ justifyContent: "center" }}>
                <Button type="button" variant="link" size="sm" className="px-0" onClick={() => go("login")}>
                  {lang === "ur" ? "← سائن ان پر واپس" : "← Back to sign in"}
                </Button>
              </div>
            </form>
          )}

          {view === "signup-verify" && (
            <form onSubmit={handleVerifyOtp}>
              <div className="lg-field">
                <label className="lg-label" htmlFor="su-code">{lang === "ur" ? "6 ہندسوں کا کوڈ" : "6-digit code"}</label>
                <Input id="su-code" type="text" inputMode="numeric" maxLength={6} dir="ltr" placeholder="123456"
                  value={suCode} onChange={e => setSuCode(e.target.value)} required />
              </div>
              <div className="lg-field">
                <label className="lg-label" htmlFor="su-name">{lang === "ur" ? "آپ کا نام / دکان کا نام" : "Your name / shop name"}</label>
                <Input id="su-name" type="text" placeholder={lang === "ur" ? "مثلاً احمد ٹیلرز" : "e.g. Ahmed Tailors"}
                  value={suName} onChange={e => setSuName(e.target.value)} />
              </div>
              <div className="lg-field">
                <label className="lg-label" htmlFor="su-pass">{lang === "ur" ? "پاس ورڈ منتخب کریں" : "Choose a password"}</label>
                <Input id="su-pass" type="password" dir="ltr" placeholder={lang === "ur" ? "کم از کم 8 حروف" : "min 8 characters"}
                  value={suPass} onChange={e => setSuPass(e.target.value)} required />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? (lang === "ur" ? "اکاؤنٹ بن رہا ہے..." : "Creating account...") : (lang === "ur" ? "تصدیق کریں اور اکاؤنٹ بنائیں" : "Verify & create account")}
              </Button>
              <div className="lg-row">
                <Button type="button" variant="link" size="sm" className="px-0" onClick={() => go("signup-phone")}>
                  {lang === "ur" ? "← نمبر تبدیل کریں" : "← Change number"}
                </Button>
                <Button type="button" variant="link" size="sm" className="px-0" onClick={handleSendOtp} disabled={loading}>
                  {lang === "ur" ? "کوڈ دوبارہ بھیجیں" : "Resend code"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
