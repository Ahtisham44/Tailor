// =============================================================================
// Edge Function: create-tailor
// =============================================================================
// Admin-only. Creates a tailor auth account (phone + password), writes the
// profile (shop name + logo), and — if a paid plan is chosen — creates the
// matching subscription so the tailor starts on that plan.
//
// Request body (JSON):
//   {
//     phone:    "03001234567",     // required, PK mobile
//     password: "min8chars",       // required, >= 8 chars
//     shop_name?: "Ahmed Tailors", // optional
//     name?:      "Ahmed",         // optional (back-compat alias for shop_name)
//     logo_url?:  "https://...",   // optional hosted logo
//     plan_id?:   "free|pro|max"   // optional, defaults to "free"
//   }
//
// Response: { phone, user_id, plan_id }
//
// Deploy:  supabase functions deploy create-tailor
// Secrets needed: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (set automatically
//                 in the Supabase platform; provided here for clarity).
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

// 03xxxxxxxxx -> +923xxxxxxxxx ; returns null if not a valid PK mobile
function normalizePkPhone(raw: string): string | null {
  let p = String(raw || "").replace(/[\s\-()]/g, "")
  if (/^03\d{9}$/.test(p)) p = "+92" + p.slice(1)
  else if (/^923\d{9}$/.test(p)) p = "+" + p
  return /^\+923\d{9}$/.test(p) ? p : null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  const SB_URL  = Deno.env.get("SUPABASE_URL")!
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const ANON    = Deno.env.get("SUPABASE_ANON_KEY")!

  // --- 1. authenticate the caller and confirm they are an admin ------------
  const authHeader = req.headers.get("Authorization") || ""
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing token" }, 401)

  // client bound to the caller's JWT — used only to check admin status via RLS
  const asCaller = createClient(SB_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: isAdmin, error: adminErr } = await asCaller.rpc("is_current_user_admin")
  if (adminErr) return json({ error: adminErr.message }, 400)
  if (isAdmin !== true) return json({ error: "Admin only" }, 403)

  // --- 2. parse + validate input -------------------------------------------
  let body: any = {}
  try { body = await req.json() } catch { /* empty */ }

  const phone = normalizePkPhone(body.phone)
  if (!phone) return json({ error: "Enter a valid mobile number (03xx-xxxxxxx)" }, 400)

  const password = String(body.password || "")
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400)

  const shopName = String(body.shop_name || body.name || "").trim() || null
  const logoUrl  = String(body.logo_url || "").trim() || null
  const planId   = String(body.plan_id || "free").trim().toLowerCase() || "free"

  // --- 3. service-role client to perform privileged writes -----------------
  const admin = createClient(SB_URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // validate the plan exists
  const { data: plan, error: planErr } = await admin
    .from("plans").select("id").eq("id", planId).maybeSingle()
  if (planErr) return json({ error: planErr.message }, 400)
  if (!plan) return json({ error: `Unknown plan: ${planId}` }, 400)

  // --- 4. create the auth user (phone-confirmed, no verification needed) ----
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
    user_metadata: shopName ? { name: shopName } : {},
  })
  if (createErr) return json({ error: createErr.message }, 400)
  const userId = created.user?.id
  if (!userId) return json({ error: "Could not create user" }, 500)

  // --- 5. profile (shop name + logo) ---------------------------------------
  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId,
    shop_name: shopName,
    display_name: shopName,
    logo_url: logoUrl,
  }, { onConflict: "id" })
  if (profErr) {
    // non-fatal for the account itself, but surface it
    return json({ error: "Account created but profile failed: " + profErr.message }, 207)
  }

  // --- 6. subscription for paid plans --------------------------------------
  // Free = no subscription row needed (effective_plan() falls back to free).
  if (planId !== "free") {
    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1) // 1-month starter period
    const { error: subErr } = await admin.from("subscriptions").insert({
      user_id: userId,
      plan_id: planId,
      status: "active",
      current_period_end: periodEnd.toISOString(),
    })
    if (subErr) {
      return json({ error: "Account created but plan assignment failed: " + subErr.message }, 207)
    }
  }

  // --- 7. audit -------------------------------------------------------------
  await admin.from("admin_audit").insert({
    action: "create_tailor",
    detail: { user_id: userId, phone, plan_id: planId, shop_name: shopName },
  })

  // display the login back the way the UI shows it (0xxxxxxxxxx)
  const displayPhone = "0" + phone.replace(/^\+92/, "")
  return json({ phone: displayPhone, user_id: userId, plan_id: planId })
})
