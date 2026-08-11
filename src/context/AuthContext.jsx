import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { makeSbApi } from "@/lib/supabase"
import { decodeJwtExp, getDeviceInfo } from "@/lib/utils"
import { toast } from "sonner"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null)
  const [token,        setToken]        = useState(null)
  const [initializing, setInitializing] = useState(true)
  const jwtTimerRef    = useRef(null)
  const refreshTokenRef = useRef(null)   // latest refresh token (kept in a ref so the api closure always sees it)
  const userRef         = useRef(null)   // latest user (for storage keys during refresh)
  const apiRef          = useRef(null)   // set below; lets tryRefresh reach sbRefreshSession
  const refreshingRef   = useRef(null)   // in-flight refresh promise (dedupe concurrent 401s)

  // ── session keys ──────────────────────────────────────────────────────────
  function getUserKey(u) {
    return "ts_session_" + ((u && (u.id || u.email)) || "default")
  }

  // ── expiry handling ─────────────────────────────────────────────────────
  // Truly end the session (refresh impossible / failed). Clears state AND the
  // persisted localStorage so a fresh sign-in starts clean.
  const handleExpired = useCallback(() => {
    const u = userRef.current
    clearSessionState()
    clearSessionStorage(u)
    toast.error("Session expired — please sign in again")
  }, [])

  // Silently exchange the refresh token for a new access token. Returns the
  // fresh access token, or null if no refresh token / refresh failed.
  // Concurrent callers share one in-flight refresh.
  const tryRefresh = useCallback(async () => {
    const rt = refreshTokenRef.current
    if (!rt || !apiRef.current) return null
    if (refreshingRef.current) return refreshingRef.current
    refreshingRef.current = (async () => {
      try {
        const s = await apiRef.current.sbRefreshSession(rt)
        // Persist the rotated tokens against the current user.
        persistSession(s.access_token, s.user || userRef.current, s.refresh_token)
        return s.access_token
      } catch {
        handleExpired()
        return null
      } finally {
        refreshingRef.current = null
      }
    })()
    return refreshingRef.current
  }, [handleExpired])

  // Schedule a silent refresh shortly before the access token expires, so the
  // session stays alive instead of dying. Falls back to handleExpired only if
  // there's no refresh token.
  function scheduleExpiry(tkn) {
    if (jwtTimerRef.current) clearTimeout(jwtTimerRef.current)
    const exp = decodeJwtExp(tkn)
    if (!exp) return
    const msLeft = exp * 1000 - Date.now()
    const fire = () => { if (refreshTokenRef.current) tryRefresh(); else handleExpired() }
    if (msLeft <= 0) { fire(); return }
    jwtTimerRef.current = setTimeout(fire, Math.max(msLeft - 30000, 1000))
  }

  // ── internal helpers ──────────────────────────────────────────────────────
  function persistSession(tkn, u, refreshToken) {
    const key = getUserKey(u)
    // Preserve an existing refresh token if a caller didn't pass a new one.
    const rt = refreshToken !== undefined ? refreshToken : refreshTokenRef.current
    localStorage.setItem(key, JSON.stringify({ token: tkn, refreshToken: rt, user: u }))
    localStorage.setItem("ts_active_user_key", key)
    refreshTokenRef.current = rt
    userRef.current = u
    setToken(tkn)
    setUser(u)
    scheduleExpiry(tkn)
  }

  function clearSessionState() {
    if (jwtTimerRef.current) { clearTimeout(jwtTimerRef.current); jwtTimerRef.current = null }
    refreshTokenRef.current = null
    userRef.current = null
    setToken(null)
    setUser(null)
  }

  function clearSessionStorage(u) {
    const key = getUserKey(u)
    localStorage.removeItem(key)
    localStorage.removeItem("ts_active_user_key")
  }

  // ── restore on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    const key = localStorage.getItem("ts_active_user_key")
    if (key) {
      const raw = localStorage.getItem(key)
      if (raw) {
        try {
          const s = JSON.parse(raw)
          if (s.token && s.user) {
            // Make the refresh token available before any restore decision.
            refreshTokenRef.current = s.refreshToken || null
            userRef.current = s.user
            const exp = decodeJwtExp(s.token)
            if (!exp || Date.now() / 1000 < exp) {
              // Token still valid — restore as-is.
              setToken(s.token)
              setUser(s.user)
              scheduleExpiry(s.token)
            } else if (s.refreshToken) {
              // Token expired but we have a refresh token — silently refresh.
              // tryRefresh() sets both token + user on success (or clears on
              // failure), so we don't set a half-session here.
              tryRefresh()
            } else {
              localStorage.removeItem(key)
              localStorage.removeItem("ts_active_user_key")
            }
          }
        } catch {}
      }
    }
    setInitializing(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── supabase API (token-aware) ────────────────────────────────────────────
  const api = makeSbApi(
    () => token,
    () => user?.id,
    handleExpired,
    tryRefresh,
  )
  apiRef.current = api

  // ── public actions ────────────────────────────────────────────────────────
  async function login(email, password) {
    const s = await api.sbSignIn(email, password)
    persistSession(s.access_token, s.user, s.refresh_token)
    // Record the device/login session (best-effort; never blocks login).
    // Uses the log-session edge function so the server can capture the real
    // client IP + approximate geo, plus the richer device fields we collect.
    try {
      const d = getDeviceInfo()
      fetch(import.meta.env.VITE_SUPABASE_URL + "/functions/v1/log-session", {
        method: "POST",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: "Bearer " + s.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(d),
      }).catch(() => {})
    } catch {}
    return s.user
  }

  // Admin impersonation: exchange a magic-link token_hash for a real session
  // and sign in as the target tailor (used on the /impersonate route).
  async function impersonateWithToken(tokenHash) {
    const s = await api.sbVerifyOtp(tokenHash, "magiclink")
    if (!s.access_token || !s.user) throw new Error("Could not start session")
    persistSession(s.access_token, s.user, s.refresh_token)
    return s.user
  }

  async function logout() {
    await api.sbOut()
    clearSessionStorage(user)
    clearSessionState()
  }

  async function resetPassword(email) {
    await api.sbReset(email)
  }

  function getUserDisplayName() {
    if (!user) return "User"
    const n = (user.user_metadata && user.user_metadata.name)
      || (user.email ? user.email.split("@")[0] : null)
      || (user.phone ? "0" + String(user.phone).replace(/^\+?92/, "") : null)
    return n || "User"
  }

  function getUserInitials() {
    const n = getUserDisplayName()
    return n.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  }

  function getShopName() {
    const m = user?.user_metadata || {}
    return m.shop_name || m.name || getUserDisplayName()
  }

  function getLogoUrl() {
    return user?.user_metadata?.logo_url || null
  }

  // Refresh the in-memory user metadata after a profile edit, without re-login.
  function applyMetadata(patch) {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, user_metadata: { ...(prev.user_metadata || {}), ...patch } }
      // keep localStorage session in sync
      try {
        const key = localStorage.getItem("ts_active_user_key")
        if (key) {
          const raw = localStorage.getItem(key)
          if (raw) {
            const s = JSON.parse(raw)
            s.user = next
            localStorage.setItem(key, JSON.stringify(s))
          }
        }
      } catch { /* noop */ }
      return next
    })
  }

  return (
    <AuthContext.Provider value={{
      user, token, initializing,
      api,
      login, logout, resetPassword, impersonateWithToken,
      getUserDisplayName, getUserInitials, getShopName, getLogoUrl, applyMetadata,
      isAuthenticated: !!user && !!token,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
