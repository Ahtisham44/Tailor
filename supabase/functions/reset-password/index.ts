// =============================================================================
// Edge Function: reset-password
// =============================================================================
// Public (no auth) self-service password reset for tailors who are locked out.
//
// The tailor proves ownership with TWO factors:
//   1. their login phone number, and
//   2. their account UUID (auth user id) — issued to them at sign-up and
//      treated as a recovery secret.
// If both match the same auth user, the password is updated.
//
// Request body (JSON):
//   { phone: "03001234567", uuid: "<auth-user-id>", new_password: "min8chars" }
//
// Response: { ok: true } on success, { error } otherwise.
//
// Deploy:  supabase functions deploy reset-password --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (set by the platform).
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })
}

// 03xxxxxxxxx -> 923xxxxxxxxx (no leading +, to match auth.users.phone storage)
function normalizePkPhone(raw: string): string | null {
  let p = String(raw || "").replace(/[\s\-()+]/g, "")
  if (/^03\d{9}$/.test(p)) p = "92" + p.slice(1)
  else if (/^\+?923\d{9}$/.test(p)) p = p.replace(/^\+/, "")
  return /^923\d{9}$/.test(p) ? p : null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const SB_URL  = Deno.env.get("SUPABASE_URL")!
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  // --- parse + validate ----------------------------------------------------
  let body: any = {}
  try { body = await req.json() } catch { /* empty */ }

  const phone = normalizePkPhone(body.phone)
  if (!phone) return json({ error: "Enter a valid mobile number (03xx-xxxxxxx)" }, 400)

  const uuid = String(body.uuid || "").trim().toLowerCase()
  if (!UUID_RE.test(uuid)) return json({ error: "Enter a valid account UUID" }, 400)

  const newPassword = String(body.new_password || "")
  if (newPassword.length < 8) return json({ error: "New password must be at least 8 characters" }, 400)

  // --- service-role client -------------------------------------------------
  const admin = createClient(SB_URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Look up the account by UUID, then confirm the phone matches. We return the
  // SAME generic error whether the UUID is unknown or the phone mismatches, so
  // the endpoint can't be used to probe which UUIDs exist.
  const { data: got, error: getErr } = await admin.auth.admin.getUserById(uuid)
  if (getErr || !got?.user) {
    return json({ error: "Phone number and UUID do not match any account" }, 400)
  }

  const userPhone = String(got.user.phone || "").replace(/^\+/, "")
  if (userPhone !== phone) {
    return json({ error: "Phone number and UUID do not match any account" }, 400)
  }

  // --- update the password -------------------------------------------------
  const { error: updErr } = await admin.auth.admin.updateUserById(uuid, {
    password: newPassword,
  })
  if (updErr) return json({ error: updErr.message }, 400)

  // best-effort audit (non-fatal)
  try {
    await admin.from("admin_audit").insert({
      action: "self_reset_password",
      detail: { user_id: uuid, phone },
    })
  } catch { /* ignore */ }

  return json({ ok: true })
})
