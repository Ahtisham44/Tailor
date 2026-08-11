import { useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useLang } from "@/hooks/useLang"
import { useTourController } from "@/context/TourContext"
import { startTour, hasSeenTour, markTourSeen } from "@/lib/tour"

// Auto-runs the first-time driven product tour once, after login, on the
// dashboard. Idempotent: guarded by a per-user localStorage flag.
export default function ProductTour() {
  const { user } = useAuth()
  const { lang } = useLang()
  const location = useLocation()
  const navigate = useNavigate()
  const { call } = useTourController()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    if (!user) return
    // Only kick off on the dashboard.
    if (location.pathname !== "/dashboard" && location.pathname !== "/") return
    const uid = user.id || user.email
    if (hasSeenTour(uid)) return

    // Wait for the dashboard to be in the DOM before starting.
    let tries = 0
    const tick = setInterval(() => {
      tries++
      const ready = document.querySelector('[data-tour="kpi-customers"]')
      if (ready) {
        clearInterval(tick)
        started.current = true
        markTourSeen(uid)
        setTimeout(() => startTour({ lang, navigate, call }), 400)
      } else if (tries > 40) {
        clearInterval(tick) // give up after ~6s
      }
    }, 150)

    return () => clearInterval(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname])

  return null
}
