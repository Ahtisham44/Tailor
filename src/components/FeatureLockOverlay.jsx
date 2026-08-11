import { useNavigate } from "react-router-dom"
import { Sparkles, Lock, Crown, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

// Per-feature presentation. Swap `gif` in later with a real hosted GIF/screenshot
// URL and it will render instead of the animated placeholder.
const FEATURE_META = {
  karigar: {
    title: "Karigar Management",
    blurb: "Track your craftsmen, assign orders, and run per-piece or salary payouts — all in one place.",
    bullets: ["Assign orders to karigars", "Automatic earnings & payslips", "Monthly payment tracking"],
    gif: null,
    accent: "#2B5740",
  },
  reports: {
    title: "Reports & Analytics",
    blurb: "See your business at a glance — revenue, orders, top customers and trends over time.",
    bullets: ["Revenue & order trends", "Customer insights", "Exportable summaries"],
    gif: null,
    accent: "#375FA0",
  },
}

// Animated placeholder shown when no real GIF is provided.
function PreviewPlaceholder({ accent }) {
  return (
    <div className="relative h-44 w-full overflow-hidden rounded-xl border"
      style={{ background: `linear-gradient(135deg, ${accent}14, ${accent}05)` }}>
      <div className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, " + accent + "33 0, transparent 40%)," +
            "radial-gradient(circle at 80% 70%, " + accent + "22 0, transparent 40%)",
        }} />
      {/* shimmering skeleton rows */}
      <div className="absolute inset-0 flex flex-col justify-center gap-3 p-6">
        {[90, 70, 80, 55].map((w, i) => (
          <div key={i} className="h-3 animate-pulse rounded-full bg-foreground/10"
            style={{ width: w + "%", animationDelay: i * 150 + "ms" }} />
        ))}
      </div>
      <div className="absolute right-4 top-4 rounded-full p-2 shadow-sm"
        style={{ background: accent }}>
        <Sparkles className="h-4 w-4 text-white" />
      </div>
    </div>
  )
}

export default function FeatureLockOverlay({ feature, limit }) {
  const navigate = useNavigate()
  const meta = FEATURE_META[feature] || {
    title: "Premium feature", blurb: "Upgrade your plan to unlock this feature.",
    bullets: [], gif: null, accent: "#6B4FA0",
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 py-10 text-center">
      <div className="w-full overflow-hidden rounded-2xl border bg-card shadow-sm">
        {/* Preview */}
        <div className="p-5 pb-0">
          {meta.gif
            ? <img src={meta.gif} alt={meta.title} className="h-44 w-full rounded-xl border object-cover" />
            : <PreviewPlaceholder accent={meta.accent} />}
        </div>

        <div className="p-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: meta.accent + "1a" }}>
            <Lock className="h-5 w-5" style={{ color: meta.accent }} />
          </div>

          <h2 className="text-xl font-bold tracking-tight">{meta.title} is locked</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {limit > 0
              ? <>You’ve used all <strong>{limit}</strong> of your free preview{limit === 1 ? "" : "s"} of this feature.</>
              : <>This feature isn’t included in your current plan.</>}
            {" "}Upgrade once to unlock it for life.
          </p>

          <p className="mt-3 text-sm text-foreground/80">{meta.blurb}</p>

          {meta.bullets.length > 0 && (
            <ul className="mx-auto mt-4 max-w-xs space-y-1.5 text-left">
              {meta.bullets.map(b => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: meta.accent }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <Button size="lg" className="mt-6 w-full gap-2" onClick={() => navigate("/billing")}>
            <Crown className="h-4 w-4" /> Upgrade to unlock
            <ArrowRight className="h-4 w-4" />
          </Button>
          <button onClick={() => navigate("/dashboard")}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground">
            Go back to dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
