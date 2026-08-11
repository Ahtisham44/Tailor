import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

// Admin impersonation landing page.
// Opened in a new tab as /impersonate#token_hash=...  (the token is in the URL
// hash so it is never sent to the server / logged). Verifies the one-time token,
// installs the tailor's session, and redirects into the app.
export default function ImpersonatePage() {
  const { impersonateWithToken } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    // token_hash may be in the hash (preferred) or query string
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const qs   = new URLSearchParams(window.location.search)
    const tokenHash = hash.get("token_hash") || qs.get("token_hash")

    if (!tokenHash) { setError("Missing impersonation token."); return }

    impersonateWithToken(tokenHash)
      .then(() => {
        // Clean the token out of the URL, then enter the app.
        window.history.replaceState({}, "", "/dashboard")
        navigate("/dashboard", { replace: true })
      })
      .catch(e => setError(e.message || "Could not start session."))
  }, [impersonateWithToken, navigate])

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
      {error ? (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "hsl(var(--destructive))" }}>Couldn’t open session</h2>
          <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", maxWidth: 360 }}>{error}</p>
          <button onClick={() => navigate("/login", { replace: true })}
            style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "transparent", cursor: "pointer" }}>
            Go to login
          </button>
        </>
      ) : (
        <>
          <div className="spin" />
          <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))" }}>Signing in as tailor…</p>
        </>
      )}
    </div>
  )
}
