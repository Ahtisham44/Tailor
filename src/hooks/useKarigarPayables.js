import { useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

export const KARIGAR_PAYABLES_CHANGED = "karigar-payables-changed"

export function useKarigarPayables(enabled = true) {
  const { api, user } = useAuth()
  const location = useLocation()
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const refresh = useCallback(async () => {
    if (!enabled || !user) { setRows([]); return }
    const result = await api.sbQ("karigar_completed_payables", { order: "name.asc" })
    if (result.error) { setError(result.error.message); return }
    setRows(result.data || [])
    setError(null)
  }, [api, enabled, user])

  useEffect(() => {
    // A route visit, app return, or payment change can alter the balance.
    queueMicrotask(refresh)
    const onReturn = () => { if (document.visibilityState === "visible") refresh() }
    window.addEventListener(KARIGAR_PAYABLES_CHANGED, refresh)
    document.addEventListener("visibilitychange", onReturn)
    return () => {
      window.removeEventListener(KARIGAR_PAYABLES_CHANGED, refresh)
      document.removeEventListener("visibilitychange", onReturn)
    }
  }, [refresh, location.pathname])
  return { rows, count: rows.length, error, refresh }
}
