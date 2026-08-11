import { createClient } from "@supabase/supabase-js"

const SB_URL  = import.meta.env.VITE_SUPABASE_URL
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

// Single shared client — auth state managed via AuthContext
export const supabase = createClient(SB_URL, SB_ANON, {
  auth: {
    persistSession: false,   // We manage session manually (JWT + localStorage) to match existing behaviour
    autoRefreshToken: false,
  },
})

// ─── Raw REST helpers (preserve existing RLS / token behaviour) ───────────────
// We keep the manual fetch layer from the original supabase.js so that RLS,
// user_id injection, and 401 handling all work identically.

// Tables that are global / shared and have no per-row user_id column.
// Writes to these must NOT have user_id injected.
const NO_USER_ID_TABLES = new Set(["app_settings"])

export function makeSbApi(getToken, getUserId, onExpired, tryRefresh) {
  // Attempt a one-time token refresh. Returns a fresh access token or null.
  // `tryRefresh` is supplied by AuthContext; if absent we behave as before.
  async function refreshOnce() {
    if (typeof tryRefresh !== "function") return null
    try { return await tryRefresh() } catch { return null }
  }

  async function sbQ(table, opts = {}) {
    const method  = opts.method || "GET"
    const params  = ["select=*"]
    if (opts.query)  params.push(opts.query)
    if (opts.order)  params.push("order=" + opts.order)
    if (opts.limit)  params.push("limit=" + opts.limit)
    if (opts.offset != null && opts.offset > 0) params.push("offset=" + opts.offset)

    const url = SB_URL + "/rest/v1/" + table + "?" + params.join("&")

    // Inject user_id on write ops so RLS WITH CHECK passes.
    // Some tables (e.g. app_settings) are global and have no user_id column —
    // injecting it there triggers a PostgREST "column not found" error, so we
    // skip injection for those. Callers can also opt out via opts.noUserId.
    let body = opts.body
    if (body && (method === "POST" || method === "PATCH")) {
      const userId = getUserId()
      if (userId && !opts.noUserId && !NO_USER_ID_TABLES.has(table)) {
        body = Array.isArray(body)
          ? body.map(r => ({ ...r, user_id: userId }))
          : { ...body, user_id: userId }
      }
    }

    const doFetch = (tkn) => fetch(url, {
      method,
      headers: {
        apikey:         SB_ANON,
        Authorization:  "Bearer " + (tkn || SB_ANON),
        "Content-Type": "application/json",
        Prefer:         "return=representation",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    })

    let res = await doFetch(getToken())

    // On 401, try a one-time silent token refresh and replay the request.
    // Only if the refresh fails do we treat the session as truly expired.
    if (res.status === 401) {
      const fresh = await refreshOnce()
      if (fresh) res = await doFetch(fresh)
    }
    if (res.status === 401) {
      onExpired()
      return { data: null, error: { message: "Session expired" }, status: 401 }
    }
    if (res.status === 204) return { data: null, error: null, status: 204 }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: { message: data.message || data.hint || data.error || "HTTP " + res.status }, status: res.status }
    return { data, error: null, status: res.status }
  }

  // Normalize a Pakistani mobile number to +92 format; returns null if not a phone
  function normalizePkPhone(raw) {
    let p = String(raw || "").replace(/[\s\-()]/g, "")
    if (/^03\d{9}$/.test(p)) p = "+92" + p.slice(1)
    else if (/^923\d{9}$/.test(p)) p = "+" + p
    return /^\+923\d{9}$/.test(p) ? p : null
  }

  // Auth helpers — identifier may be an email OR a Pakistani mobile number
  async function sbSignIn(identifier, password) {
    const phone = normalizePkPhone(identifier)
    const creds = phone ? { phone, password } : { email: identifier, password }
    const r = await fetch(SB_URL + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_ANON },
      body: JSON.stringify(creds),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error_description || d.message || "Login failed")
    return d
  }

  // Exchange a refresh token for a fresh session (access + refresh tokens).
  // Returns the GoTrue token payload, or throws on failure.
  async function sbRefreshSession(refreshToken) {
    const r = await fetch(SB_URL + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_ANON },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d.access_token) throw new Error(d.error_description || d.message || "Refresh failed")
    return d
  }

  // Edge Function caller (signup OTP flow, admin account creation)
  async function fn(name, body = {}) {
    const token = getToken()
    const res = await fetch(SB_URL + "/functions/v1/" + name, {
      method: "POST",
      headers: {
        apikey:         SB_ANON,
        Authorization:  "Bearer " + (token || SB_ANON),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: { message: d.error || "Request failed (" + res.status + ")" }, status: res.status }
    return { data: d, error: null, status: res.status }
  }

  // Verify a magic-link OTP token_hash (used by admin impersonation) and
  // return a session { access_token, user, ... }. Works for any account type.
  async function sbVerifyOtp(tokenHash, type = "magiclink") {
    const r = await fetch(SB_URL + "/auth/v1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_ANON },
      body: JSON.stringify({ type, token_hash: tokenHash }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error_description || d.msg || d.message || "Verification failed")
    return d
  }

  async function sbReset(email) {
    const r = await fetch(SB_URL + "/auth/v1/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_ANON },
      body: JSON.stringify({ email, gotrue_meta_security: {} }),
    })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error_description || d.msg || "Reset failed")
  }

  async function sbOut() {
    const token = getToken()
    if (token) {
      await fetch(SB_URL + "/auth/v1/logout", {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: "Bearer " + token },
      }).catch(() => {})
    }
  }

  // RPC — call a Postgres function (security-definer logic lives server-side).
  // tokenOverride lets callers (e.g. login) pass a freshly-issued token before
  // it has been committed to React state.
  async function rpc(fn, args = {}, tokenOverride) {
    const doFetch = (tkn) => fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: {
        apikey:         SB_ANON,
        Authorization:  "Bearer " + (tkn || SB_ANON),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    })

    let res = await doFetch(tokenOverride || getToken())

    // On 401, try a one-time silent refresh and replay — but never when the
    // caller passed an explicit token (e.g. login's fresh token).
    if (res.status === 401 && !tokenOverride) {
      const fresh = await refreshOnce()
      if (fresh) res = await doFetch(fresh)
    }
    if (res.status === 401) { onExpired(); return { data: null, error: { message: "Session expired" }, status: 401 } }
    const data = await res.json().catch(() => null)
    if (!res.ok) return { data: null, error: { message: (data && (data.message || data.hint)) || "HTTP " + res.status }, status: res.status }
    return { data, error: null, status: res.status }
  }

  // Storage — upload to a private bucket, get a short-lived signed URL
  async function uploadReceipt(path, file) {
    const token = getToken()
    const res = await fetch(SB_URL + "/storage/v1/object/receipts/" + path, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: "Bearer " + (token || SB_ANON) },
      body: file,
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return { error: { message: d.message || d.error || "Upload failed" } }
    return { data: { path }, error: null }
  }

  async function signedReceiptUrl(path, expiresIn = 120) {
    const token = getToken()
    const res = await fetch(SB_URL + "/storage/v1/object/sign/receipts/" + path, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: "Bearer " + (token || SB_ANON), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return { error: { message: d.message || "Sign failed" } }
    return { data: { url: SB_URL + "/storage/v1" + d.signedURL }, error: null }
  }

  // DB ping
  async function pingDB() {
    const r = await sbQ("customers", { query: "limit=1" })
    return !r.error
  }

  return { sbQ, rpc, fn, uploadReceipt, signedReceiptUrl, sbSignIn, sbRefreshSession, sbVerifyOtp, sbReset, sbOut, pingDB, normalizePkPhone }
}
