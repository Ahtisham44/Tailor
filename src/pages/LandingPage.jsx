import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight, Check, Users, Printer, ClipboardCheck, BarChart3, TrendingUp,
  ListOrdered, Clock, ShieldCheck, Star, Smartphone, CreditCard, Camera,
  Plus, HelpCircle, Sparkles, MapPin, Phone, ScrollText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { gradientAvatar } from "@/lib/utils"
import "@/styles/landing.css"
import dashL from "@/assets/dash L.png"
import reportS from "@/assets/Report S.png"
import measS from "@/assets/meas S.png"
import createOrderS from "@/assets/createOrder S.png"
import viewOrderS from "@/assets/View order S.png"

/* -------------------------------------------------------------------------
   TODO — replace these before going live:
     • SIGNUP_URL   → where "Create Free Account" / "Start Free" should point
     • WA_LINK      → your shop's WhatsApp link (wa.me/<country><number>)
     • WA_DISPLAY   → the number shown in the footer
   ------------------------------------------------------------------------- */
const SIGNUP_URL = "/login"
const WA_LINK = "https://wa.me/923226247462"
const WA_DISPLAY = "0322 6247462"

/* Brand WhatsApp glyph (lucide has no brand icons) */
function WhatsAppIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.518 5.26l-.999 3.648 3.97-1.042zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  )
}

/* Small pill "eyebrow" label above section headings */
function Eyebrow({ icon: Icon, dot, tone = "light", children }) {
  const dark = tone === "dark"
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.8rem] font-semibold tracking-tight " +
        (dark
          ? "border-white/15 bg-white/[0.06] text-zinc-300"
          : "border-[#e6e9ee] bg-[#f7f8fa] text-[#5b636e]")
      }
    >
      {dot && <span className="h-[7px] w-[7px] rounded-full bg-[#16a34a]" />}
      {Icon && <Icon className={"h-[15px] w-[15px] " + (dark ? "text-[#7d92ff]" : "text-[#3b5bff]")} />}
      {children}
    </span>
  )
}

/* Green check chip used in feature checklists */
function CheckItem({ children }) {
  return (
    <li className="flex items-start gap-3 text-[1rem] text-[#1a1f27]">
      <span className="mt-[2px] grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] bg-[#e7f6ec]">
        <Check className="h-[13px] w-[13px] text-[#16a34a]" strokeWidth={3} />
      </span>
      {children}
    </li>
  )
}

/* The signature hero-block pill button (dark, with a circular arrow) */
function PillPrimary({ to, href, children, className = "" }) {
  const inner = (
    <>
      {children}
      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-white text-[#0e1116]">
        <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
      </span>
    </>
  )
  return (
    <Button
      asChild
      className={"h-12 gap-3 rounded-full bg-[#0e1116] pl-6 pr-2 text-[0.98rem] font-semibold text-white shadow-sm hover:bg-[#0e1116]/90 " + className}
    >
      {to ? <Link to={to}>{inner}</Link> : <a href={href}>{inner}</a>}
    </Button>
  )
}

function ShotPlaceholder({ icon: Icon, title, note }) {
  return (
    <div className="px-6">
      <Icon className="mx-auto mb-3 h-11 w-11 opacity-50" strokeWidth={1.6} />
      <b className="mb-1 block font-semibold text-[#5b636e]">{title}</b>
      <span className="text-[0.84rem] italic">{note}</span>
    </div>
  )
}

/* Browser-chrome frame wrapping a screenshot slot */
function BrowserFrame({ addr, ratio43, children }) {
  return (
    <div className="landing-frame">
      <div className="landing-frame-top">
        <i /><i /><i />
        <span className="landing-frame-addr">          
          {addr}
        </span>
      </div>
      <div className={"landing-shot" + (ratio43 ? " r43" : "")}>{children}</div>
    </div>
  )
}

/* Reusable feature row (copy + visual, optionally flipped) */
function FeatureRow({ flip, eyebrow, icon, title, lead, checks, cta, visual, caption }) {
  return (
    <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 md:grid-cols-2 md:gap-16">
      <div className={"reveal " + (flip ? "md:order-2" : "")}>
        <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
        <h3 className="mt-5 text-[clamp(1.7rem,3vw,2.3rem)] font-bold leading-[1.08] tracking-[-0.035em]">{title}</h3>
        <p className="mt-4 max-w-[44ch] text-[1.1rem] text-[#5b636e]">{lead}</p>
        <ul className="mb-7 mt-6 flex flex-col gap-3.5">
          {checks.map((c, i) => <CheckItem key={i}>{c}</CheckItem>)}
        </ul>
        {cta}
      </div>
      <div className={"reveal " + (flip ? "md:order-1" : "")}>
        {visual}
        {caption && (
          <p className="mt-3.5 flex items-center justify-center gap-2 text-center text-[0.85rem] text-[#5b636e]">
            <Camera className="h-4 w-4 flex-none" />
            {caption}
          </p>
        )}
      </div>
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={"overflow-hidden rounded-2xl border bg-white transition-shadow " + (open ? "border-[#d7dce3] shadow-sm" : "border-[#e6e9ee]")}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-[1.06rem] font-semibold tracking-tight"
        aria-expanded={open}
      >
        {q}
        <span className={"grid h-[26px] w-[26px] flex-none place-items-center rounded-lg transition-all " + (open ? "rotate-45 bg-[#0e1116] text-white" : "bg-[#f1f3f6] text-[#0e1116]")}>
          <Plus className="h-[14px] w-[14px]" strokeWidth={2.6} />
        </span>
      </button>
      {open && <div className="max-w-[64ch] px-5 pb-5 text-[0.98rem] text-[#5b636e]">{a}</div>}
    </div>
  )
}

/* Scroll-reveal: fades `.reveal` children up as they enter the viewport */
function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const els = root.querySelectorAll(".reveal")
    if (!("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("in"))
      return
    }
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target) }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
  return ref
}

const STATS = [
  { v: "2 sec", cls: "", l: "To find any customer" },
  { v: "100%", cls: "text-[#3b5bff]", l: "Measurements saved with history" },
  { v: "1 tap", cls: "text-[#16a34a]", l: "To print the Urdu slip" },
  { v: "Rs 0", cls: "", l: "To get started" },
]

const SEGMENTS = ["Gents stitching", "Ladies stitching", "Boutiques", "Karigar teams", "Master tailors", "Bespoke suiting"]

const DARK_CARDS = [
  { icon: BarChart3, bg: "rgba(59,91,255,.18)", h: "Revenue vs expenses", p: "See revenue, pending and expenses side by side, so you always know what's coming in and going out." },
  { icon: TrendingUp, bg: "rgba(22,163,74,.20)", h: "Monthly revenue trend", p: "Watch your shop grow month by month with a simple, clear trend you can read at a glance." },
  { icon: ListOrdered, bg: "rgba(217,119,6,.20)", h: "Orders ledger", p: "Every order, booking date, status and amount in one tidy ledger you can filter by period." },
]

const BENEFITS = [
  { icon: Clock, tone: "blue", h: "Save hours every week", p: "Find any customer's measurements in 2 seconds. No more flipping through registers." },
  { icon: ShieldCheck, tone: "green", h: "Never lose a measurement", p: "Every measurement is saved with full history. Old numbers stay safe forever." },
  { icon: Star, tone: "amber", h: "Look more professional", p: "Printed Urdu slips and clean invoices make your shop stand out from the rest." },
  { icon: Smartphone, tone: "ink", h: "Works on your phone", p: "Phone or desktop, it just works. Log in with your phone number, no setup." },
  { icon: Users, tone: "red", h: "Manage your karigars", p: "Keep track of your workers and what you owe them, all in one place." },
  { icon: CreditCard, tone: "blue", h: "Free to start", p: "No card, no risk. Create your account and start adding customers today." },
]

const TONE = {
  blue: "bg-[#eef1ff] text-[#3b5bff]",
  green: "bg-[#e7f6ec] text-[#16a34a]",
  amber: "bg-[#fbf0de] text-[#d97706]",
  ink: "bg-[#f1f3f6] text-[#0e1116]",
  red: "bg-[#fdecec] text-[#ef4444]",
}

const TESTIMONIALS = [
  { seed: "Rashid Ahmed", initials: "RA", name: "Rashid Ahmed", role: "Gents Tailor, Lahore",
    quote: "Pehle register kho jata tha to bohat pareshani hoti thi. Ab har customer ka naap phone mein mehfooz hai. The Urdu slip is the best part." },
  { seed: "Saima Bibi", initials: "SB", name: "Saima Bibi", role: "Ladies Boutique, Karachi",
    quote: "When a regular comes back, I open their number and the order is ready in one minute. No re-measuring. My karigars love the printed slips." },
  { seed: "Muhammad Tariq", initials: "MT", name: "Muhammad Tariq", role: "Master Tailor, Faisalabad",
    quote: "I run my whole shop from my phone now. Orders, payments, delivery dates, all clear. And it was free to start, so there was nothing to lose." },
]

const PRICE_FEATS = [
  "Customer database with measurement history",
  "Urdu measurement slips & printable invoices",
  "Orders, rates, discounts & status tracking",
  "Karigar management & reports",
  "Works on phone & desktop",
]

const FAQS = [
  { q: "Is my customer data safe?", a: "Yes. Your customers and measurements are saved securely in your account, not on a register that can be lost or torn. Only you can see your shop's data." },
  { q: "Do I need internet to use it?", a: "You need internet to log in and save your work — the same connection you already use for WhatsApp." },
  { q: "Can I use it on my phone?", a: "Yes. Tailor 24/7 works on both phone and desktop. Most tailors run the whole shop from their phone. You log in with your phone number." },
  { q: "How do I add my old customers?", a: "Add them as they come in, or enter your regulars from your register one by one. Each gets a customer number automatically, so they're easy to find next time." },
  { q: "Can I print the slip in Urdu?", a: "Yes. Tailor 24/7 prints a clean measurement slip in Urdu (right-to-left), ready for the counter and easy for your karigar to read." },
  { q: "Is it really free?", a: "It's free to start, no card needed. You can begin adding customers today with nothing to lose." },
]

export default function LandingPage() {
  const rootRef = useReveal()

  return (
    <div ref={rootRef} className="landing-page scroll-smooth [&_section]:scroll-mt-24">
      {/* ===== NAV ===== */}
      <header className="sticky top-0 z-[60] border-b border-[#e6e9ee] bg-white/[0.82] backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-4 px-6">
          <a href="#top" className="flex items-center gap-2.5 text-[1.14rem] font-bold tracking-[-0.02em]">
            <img src="/Logo letters.png" alt="Tailor 24/7" className="h-9 w-auto rounded-[10px]" />
          </a>
          <nav className="ml-3 hidden gap-7 text-[0.95rem] text-[#5b636e] md:flex">
            <a href="#features" className="hover:text-[#0e1116]">Features</a>
            <a href="#why" className="hover:text-[#0e1116]">Why Tailor 24/7</a>
            <a href="#pricing" className="hover:text-[#0e1116]">Pricing</a>
            <a href="#faq" className="hover:text-[#0e1116]">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link to={SIGNUP_URL} className="hidden text-[0.95rem] font-semibold text-[#5b636e] hover:text-[#0e1116] sm:block">Log in</Link>
            <Button asChild className="h-10 rounded-full bg-[#3b5bff] px-5 font-semibold text-white hover:bg-[#2e49d6]">
              <Link to={SIGNUP_URL}>Start Free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section id="top" className="relative overflow-hidden pb-10 pt-[72px]">
        <div className="landing-hero-wash" />
        <div className="relative z-[1] mx-auto max-w-[1440px] px-6 text-center">
          <div className="reveal flex justify-center">
            <Eyebrow dot>The CRM built for tailor shops</Eyebrow>
          </div>
          <h1 className="reveal mx-auto mt-5 max-w-[17ch] text-[clamp(2.6rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-[-0.045em]">
            Run your whole tailor shop <span className="landing-serif font-normal text-[#5b636e]">from one screen.</span>
          </h1>
          <p className="reveal mx-auto mt-6 max-w-[52ch] text-[1.2rem] text-[#5b636e]">
            Tailor 24/7 keeps every customer, measurement, order and rupee in one place. Find any customer in 2 seconds, print their slip in Urdu, and see exactly how your shop is doing.
          </p>
          <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <PillPrimary to={SIGNUP_URL}>Create Free Account</PillPrimary>
            <Button asChild variant="outline" className="h-12 gap-2 rounded-full border-[#d7dce3] bg-white px-6 text-[0.98rem] font-semibold hover:bg-[#f7f8fa]">
              <a href={WA_LINK} target="_blank" rel="noreferrer">
                <WhatsAppIcon className="h-5 w-5 text-[#25d366]" /> Ask on WhatsApp
              </a>
            </Button>
          </div>

          {/* social proof: avatar stack + stars */}
          <div className="reveal mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
            <div className="flex -space-x-3">
              {TESTIMONIALS.concat({ seed: "Bilal", initials: "BK" }).map((t, i) => (
                <span
                  key={i}
                  className="grid h-10 w-10 place-items-center rounded-full text-[0.8rem] font-bold text-white ring-2 ring-white"
                  style={{ background: gradientAvatar(t.seed) }}
                >
                  {t.initials}
                </span>
              ))}
            </div>
            <div className="text-left">
              <div className="flex gap-0.5 text-[#d97706]">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="text-[0.9rem] text-[#5b636e]">Trusted by tailors across Pakistan</p>
            </div>
          </div>

          {/* product shot */}
          <div className="reveal mt-14 w-full justify-left max-w-[1280px]">
            <BrowserFrame addr="tailor-24-7.app / reports">
              <img src={dashL} alt="Tailor 24/7 reports screenshot" className="w-full" />
            </BrowserFrame>
            <div>
              <img src={reportS} alt="Tailor 24/7 reports screenshot" className="absolute -right-4 -bottom-8 w-auto h-1/2 border border-slate-300 rounded-3xl box-shadow shadow-2xl" />              
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST STRIP ===== */}
      <div className="border-y border-[#e6e9ee] py-8">
        <p className="mb-5 text-center text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-[#8a929c]">
          Made for Pakistani tailoring shops
        </p>
        <div className="landing-marquee">
          {[0, 1].map(dup => (
            <div className="landing-marquee-track" key={dup} aria-hidden={dup === 1}>
              {SEGMENTS.map((s, i) => (
                <span key={i} className="flex items-center gap-8 whitespace-nowrap font-semibold text-[#5b636e]">
                  {s}<span className="h-[5px] w-[5px] rounded-full bg-[#d7dce3]" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ===== STATS ===== */}
      <section className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-6 py-16 text-center md:grid-cols-4">
        {STATS.map((s, i) => (
          <div key={i} className="reveal">
            <div className={"text-[clamp(2.2rem,3.6vw,2.9rem)] font-bold leading-none tracking-[-0.03em] " + s.cls}>{s.v}</div>
            <div className="mt-2 text-[0.96rem] text-[#5b636e]">{s.l}</div>
          </div>
        ))}
      </section>

      {/* ===== FEATURE 1 — customers & measurements ===== */}
      <section id="features" className="py-14">
        <FeatureRow
          eyebrow="Customers & measurements"
          icon={Users}
          title="Every customer and measurement, never lost again."
          lead="Save body measurements per garment — Shalwar Qameez, Waistcoat, Pent Coat, Sherwani — with full version history. When a regular comes back, their numbers are ready in seconds."
          checks={[
            "Auto customer numbers, no two mixed up",
            "Versioned history — old measurements stay safe",
            "Search by name or phone in one tap",
          ]}
          cta={<PillPrimary to={SIGNUP_URL}>Try Tailor 24/7 Free</PillPrimary>}
          caption="Find any customer's measurements in 2 seconds"
          visual={
            <div className="flex justify-center">
              <img src={measS} alt="Tailor 24/7 measurements screenshot" className="w-8/12 h-auto border border-slate-300 rounded-3xl box-shadow shadow-2xl" />
            </div>
          }
        />
      </section>

      {/* ===== FEATURE 2 — Urdu receipt ===== */}
      <section className="py-14">
        <FeatureRow
          flip
          eyebrow="Printed in Urdu"
          icon={Printer}
          title="Print the measurement slip in Urdu, ready for the counter."
          lead="Hand your karigar a clean, printed slip in Urdu — exactly how they read it. No more guessing handwriting, no more mistakes on the cloth."
          checks={[
            "Real Urdu (right-to-left), printed neat every time",
            "Shop name, customer number and order on one slip",
            "Looks professional, builds trust with every customer",
          ]}
          caption="Print measurement slips in Urdu"
          visual={
            <div className="flex justify-center py-2">
              <div className="landing-receipt">
                <span className="landing-receipt-tag urdu">اردو پرچی</span>
                <div className="landing-rc-brand">
                  <span className="urdu">ٹیلرز</span>
                  <span className="en"><b>Tailors 24/7</b>Gents &amp; Ladies</span>
                </div>
                <div className="landing-rc-meta">
                  <span className="urdu">گاہک: آصف خان</span>
                  <span>#0248 · 19/06</span>
                </div>
                <div className="landing-rc-title"><span className="urdu">ناپ — شلوار قمیض</span></div>
                <div className="landing-rc-measure">
                  {[["لمبائی", 42], ["تیرا", 18], ["آستین", 24], ["گلا", 16], ["چھاتی", 44], ["کمر", 40], ["شلوار", 40], ["پائنچہ", 14]].map(([u, n], i) => (
                    <div className="m" key={i}><span className="urdu">{u}</span><b>{n}</b></div>
                  ))}
                </div>
                <div className="landing-rc-foot">
                  <span className="urdu">ڈیلیوری: ۲۸ جون</span>
                  <span className="landing-rc-stamp">Tailor 24/7</span>
                </div>
              </div>
            </div>
          }
        />
      </section>

      {/* ===== FEATURE 3 — orders & rates ===== */}
      <section className="py-14">
        <FeatureRow
          eyebrow="Orders & rates"
          icon={ClipboardCheck}
          title="Every order tracked. Every rupee accounted for."
          lead="Add garments at your set rates, apply discounts and advances, pick a delivery date, and follow each order from received to delivered. Print a clean invoice at the end."
          checks={[
            "Items, prices, discounts and advance payments",
            "Clear status: received, in progress, delivered",
            "Printable invoices with your shop name on top",
          ]}
          cta={<PillPrimary to={SIGNUP_URL}>Start Free</PillPrimary>}
          caption="See every order, price and payment at a glance"
          visual={
            <div className="flex justify-center gap-2 -skew-x-6 skew-y-2">
              <img src={createOrderS} alt="Tailor 24/7 measurements screenshot" className="z-0 -mr-12 w-8/12 h-auto mt-12 h-auto border border-slate-300 rounded-3xl box-shadow shadow-2xl" />
              <img src={viewOrderS} alt="Tailor 24/7 measurements screenshot" className="w-8/12 h-auto border border-slate-300 rounded-3xl box-shadow shadow-2xl" />
            </div>
          }
        />
      </section>

      {/* ===== DARK REPORTS SECTION ===== */}
      <section className="mx-4 my-10 md:mx-6">
        <div className="landing-dots relative overflow-hidden rounded-[32px] bg-[#0e1116] px-6 py-20 text-white md:py-24">
          <div className="relative mx-auto max-w-[1140px]">
            <div className="reveal mx-auto max-w-[680px] text-center">
              <Eyebrow icon={BarChart3} tone="dark">Reports &amp; money</Eyebrow>
              <h2 className="mt-5 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.04] tracking-[-0.04em]">
                Know exactly how your shop is <span className="landing-serif font-normal text-zinc-400">doing.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-[54ch] text-[1.12rem] text-white/[0.66]">
                Total invoiced, revenue, expenses and income — your real business numbers, updated as you work. No accountant, no guesswork.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {DARK_CARDS.map((c, i) => (
                <div key={i} className="reveal rounded-[18px] border border-white/10 bg-white/[0.05] p-7">
                  <span className="mb-4 grid h-[46px] w-[46px] place-items-center rounded-xl" style={{ background: c.bg }}>
                    <c.icon className="h-[23px] w-[23px] text-white" />
                  </span>
                  <h4 className="mb-2 text-[1.12rem] font-bold tracking-[-0.02em]">{c.h}</h4>
                  <p className="text-[0.95rem] text-white/[0.66]">{c.p}</p>
                </div>
              ))}
            </div>
            <div className="reveal mt-10 text-center">
              <Button asChild className="h-12 gap-2 rounded-full bg-[#3b5bff] px-7 text-[0.98rem] font-semibold text-white hover:bg-[#2e49d6]">
                <Link to={SIGNUP_URL}>See your numbers free <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHY / BENEFITS ===== */}
      <section id="why" className="mx-auto max-w-[1200px] px-6 py-20">
        <div className="reveal mx-auto mb-12 max-w-[680px] text-center">
          <Eyebrow icon={Sparkles}>Why tailors love it</Eyebrow>
          <h2 className="mt-5 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.04] tracking-[-0.04em]">
            Built for the shop counter, <span className="landing-serif font-normal text-[#5b636e]">not for an office.</span>
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Card key={i} className="reveal rounded-[18px] border-[#e6e9ee] p-7 shadow-none transition-all hover:-translate-y-1 hover:border-[#d7dce3] hover:shadow-md">
              <span className={"mb-4 grid h-12 w-12 place-items-center rounded-[13px] " + TONE[b.tone]}>
                <b.icon className="h-6 w-6" strokeWidth={2.1} />
              </span>
              <h4 className="mb-2 text-[1.14rem] font-bold tracking-[-0.02em]">{b.h}</h4>
              <p className="text-[0.96rem] text-[#5b636e]">{b.p}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="reveal mx-auto mb-12 max-w-[680px] text-center">
          <Eyebrow icon={Star}>Loved by shop owners</Eyebrow>
          <h2 className="mt-5 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.04] tracking-[-0.04em]">
            Tailors are leaving the <span className="landing-serif font-normal text-[#5b636e]">register behind.</span>
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Card key={i} className="reveal flex flex-col rounded-[18px] border-[#e6e9ee] p-7 shadow-sm">
              <span className="mb-3.5 self-start rounded-md bg-[#f1f3f6] px-2.5 py-1 text-[0.64rem] font-bold uppercase tracking-[0.04em] text-[#5b636e]">
                Sample testimonial — replace with real
              </span>
              <div className="mb-3 flex gap-0.5 text-[#d97706]">
                {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="h-[17px] w-[17px] fill-current" />)}
              </div>
              <blockquote className="mb-5 flex-1 text-[1rem] leading-[1.55]">“{t.quote}”</blockquote>
              <div className="flex items-center gap-3">
                <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[11px] text-[0.9rem] font-bold text-white" style={{ background: gradientAvatar(t.seed) }}>
                  {t.initials}
                </span>
                <span className="text-[0.95rem] font-bold leading-tight">
                  {t.name}
                  <small className="block text-[0.82rem] font-medium text-[#5b636e]">{t.role}</small>
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="reveal mx-auto mb-12 max-w-[680px] text-center">
          <Eyebrow icon={CreditCard}>Pricing</Eyebrow>
          <h2 className="mt-5 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.04] tracking-[-0.04em]">
            Start free. No card. <span className="landing-serif font-normal text-[#5b636e]">No risk.</span>
          </h2>
        </div>
        <Card className="reveal mx-auto max-w-[560px] overflow-hidden rounded-[22px] border-[#d7dce3] p-0 shadow-[0_4px_14px_rgba(14,17,22,.06),0_24px_56px_rgba(14,17,22,.10)]">
          <div className="border-b border-[#e6e9ee] bg-[#f7f8fa] p-8 text-center">
            <span className="inline-flex items-center gap-1.5 text-[0.95rem] font-semibold text-[#3b5bff]">
              <Star className="h-4 w-4 fill-current" /> Free Plan
            </span>
            <div className="mt-2 text-[clamp(2.6rem,5vw,3.4rem)] font-bold leading-none tracking-[-0.04em]">
              Free to start
              <small className="mt-2 block text-[0.95rem] font-medium text-[#5b636e]">Add your customers and start today — no card needed</small>
            </div>
          </div>
          <div className="p-8">
            <ul className="mb-7 flex flex-col gap-3.5">
              {PRICE_FEATS.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-[1rem] font-medium">
                  <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] bg-[#e7f6ec]">
                    <Check className="h-[13px] w-[13px] text-[#16a34a]" strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild className="h-12 w-full rounded-full bg-[#3b5bff] text-[0.98rem] font-semibold text-white hover:bg-[#2e49d6]">
              <Link to={SIGNUP_URL}>Create Free Account</Link>
            </Button>
            <p className="mt-3.5 text-center text-[0.86rem] text-[#5b636e]">No credit card. Log in with your phone number and start in minutes.</p>
          </div>
        </Card>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="reveal mx-auto mb-12 max-w-[680px] text-center">
          <Eyebrow icon={HelpCircle}>Questions</Eyebrow>
          <h2 className="mt-5 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.04] tracking-[-0.04em]">
            Everything a tailor asks <span className="landing-serif font-normal text-[#5b636e]">before starting.</span>
          </h2>
        </div>
        <div className="reveal mx-auto flex max-w-[760px] flex-col gap-3">
          {FAQS.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="landing-dots reveal relative overflow-hidden rounded-[28px] bg-[#0e1116] px-6 py-16 text-center text-white md:px-12 md:py-20">
          <div className="relative mx-auto max-w-[640px]">
            <h2 className="mx-auto max-w-[20ch] text-[clamp(2.1rem,4vw,3.1rem)] font-bold leading-[1.04] tracking-[-0.045em]">
              Your registers are one spill away from <span className="landing-serif font-normal text-zinc-400">disappearing.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-[1.14rem] text-white/70">
              Move your customers and measurements to Tailor 24/7 today. Free to start, ready in minutes.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3.5">
              <Button asChild className="h-12 gap-3 rounded-full bg-white pl-6 pr-2 text-[0.98rem] font-semibold text-[#0e1116] hover:bg-white/90">
                <Link to={SIGNUP_URL}>
                  Create Free Account
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0e1116] text-white"><ArrowRight className="h-4 w-4" strokeWidth={2.4} /></span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 gap-2 rounded-full border-white/25 bg-transparent px-6 text-[0.98rem] font-semibold text-white hover:bg-white/10 hover:text-white">
                <a href={WA_LINK} target="_blank" rel="noreferrer"><WhatsAppIcon className="h-5 w-5" /> Chat on WhatsApp</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-[#e6e9ee] bg-[#f7f8fa] pb-8 pt-14 text-[#5b636e]">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid gap-9 md:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1.2fr]">
            <div>
              <a href="#top" className="mb-3.5 flex items-center gap-2.5 text-[1.14rem] font-bold tracking-[-0.02em] text-[#0e1116]">
                <img src="/Logo letters.png" alt="Tailor 24/7" className="h-9 w-auto rounded-[10px]" />
              </a>
              <p className="mb-5 max-w-[32ch] text-[0.95rem]">The CRM built for tailor shops. Customers, measurements, orders and reports — in one place.</p>
              <a href={WA_LINK} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2.5 rounded-xl bg-[#25d366] px-4 py-2.5 text-[0.95rem] font-semibold text-white">
                <WhatsAppIcon className="h-5 w-5" /> WhatsApp: {WA_DISPLAY}
              </a>
            </div>
            <FooterCol title="Product" links={[["Features", "#features"], ["Why Tailor 24/7", "#why"], ["Pricing", "#pricing"], ["FAQ", "#faq"]]} />
            <FooterCol title="Get started" links={[["Create free account", SIGNUP_URL], ["Log in", SIGNUP_URL], ["Talk to us", WA_LINK]]} />
            <div>
              <h5 className="mb-4 text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#0e1116]">Contact</h5>
              <a href={WA_LINK} target="_blank" rel="noreferrer" className="mb-2.5 flex items-center gap-2 text-[0.94rem] hover:text-[#0e1116]"><WhatsAppIcon className="h-4 w-4" /> WhatsApp {WA_DISPLAY}</a>
              <a href="tel:+920000000000" className="mb-2.5 flex items-center gap-2 text-[0.94rem] hover:text-[#0e1116]"><Phone className="h-4 w-4" /> Call {WA_DISPLAY}</a>
              <span className="flex items-center gap-2 text-[0.94rem]"><MapPin className="h-4 w-4" /> Pakistan</span>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap justify-between gap-3.5 border-t border-[#e6e9ee] pt-6 text-[0.86rem]">
            <span>© {new Date().getFullYear()} Tailor 24/7.</span>
            <span className="flex items-center gap-1.5"><ScrollText className="h-4 w-4" /> Privacy · Terms</span>
          </div>
        </div>
      </footer>

      {/* ===== FLOATING WHATSAPP ===== */}
      <a href={WA_LINK} target="_blank" rel="noreferrer" className="landing-wa-float" aria-label="Chat on WhatsApp">
        <span className="landing-wa-ic"><WhatsAppIcon className="h-8 w-8" /></span>
        <span className="landing-wa-txt">Chat on WhatsApp<small>We reply fast</small></span>
      </a>
    </div>
  )
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h5 className="mb-4 text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#0e1116]">{title}</h5>
      {links.map(([label, href], i) => {
        const isInternal = href.startsWith("/")
        return isInternal ? (
          <Link key={i} to={href} className="mb-2.5 block text-[0.94rem] hover:text-[#0e1116]">{label}</Link>
        ) : (
          <a key={i} href={href} className="mb-2.5 block text-[0.94rem] hover:text-[#0e1116]">{label}</a>
        )
      })}
    </div>
  )
}
