import { createClient } from "npm:@supabase/supabase-js@2.57.0"
import webpush from "npm:web-push@3.6.7"

type Payable = { karigar_id: string; user_id: string; name: string; period_start: string; balance: number }
type Subscription = { id: number; user_id: string; endpoint: string; p256dh: string; auth_key: string }

function pakistanClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

Deno.serve(async request => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const secret = Deno.env.get("CRON_SECRET")
  if (!secret || request.headers.get("x-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 })

  const clock = pakistanClock()
  if (clock.day !== "01" || clock.hour !== "11") return Response.json({ skipped: "Outside monthly send window" })

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")!
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")!
  const subject = Deno.env.get("VAPID_SUBJECT")!
  if (!publicKey || !privateKey || !subject) return Response.json({ error: "Missing VAPID secrets" }, { status: 500 })
  webpush.setVapidDetails(subject, publicKey, privateKey)
  const db = createClient(url, serviceKey, { auth: { persistSession: false } })

  async function allRows<T>(table: string, order: string): Promise<T[]> {
    const rows: T[] = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from(table).select("*").order(order).range(offset, offset + 999)
      if (error) throw error
      rows.push(...(data || []) as T[])
      if ((data || []).length < 1000) return rows
    }
  }

  try {
    const [payables, subscriptions] = await Promise.all([
      allRows<Payable>("karigar_completed_payables", "karigar_id"),
      allRows<Subscription>("karigar_push_subscriptions", "id"),
    ])
    const byUser = new Map<string, Subscription[]>()
    for (const subscription of subscriptions) {
      const list = byUser.get(subscription.user_id) || []
      list.push(subscription)
      byUser.set(subscription.user_id, list)
    }
    let sent = 0, skipped = 0, failed = 0
    for (const payable of payables) {
      for (const subscription of byUser.get(payable.user_id) || []) {
        const delivery = {
          period_start: payable.period_start,
          karigar_id: payable.karigar_id,
          subscription_id: subscription.id,
        }
        const { data: claim, error: claimError } = await db.from("karigar_push_deliveries")
          .insert(delivery).select("id").single()
        if (claimError?.code === "23505") { skipped++; continue }
        if (claimError || !claim) throw claimError || new Error("Could not claim delivery")
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
          }, JSON.stringify({
            title: `${payable.name} payment due`,
            body: `Rs ${Number(payable.balance).toLocaleString("en-PK", { maximumFractionDigits: 2 })} outstanding through last month.`,
            tag: `karigar-${payable.period_start}-${payable.karigar_id}`,
          }))
          const { error } = await db.from("karigar_push_deliveries")
            .update({ sent_at: new Date().toISOString() }).eq("id", claim.id)
          // Keep the claim if the push succeeded, even if recording sent_at
          // fails. A retry must never send a second notification.
          if (error) console.error("Could not stamp delivered push", claim.id, error)
          sent++
        } catch (error) {
          failed++
          // Failed sends can be retried by a later job run.
          await db.from("karigar_push_deliveries").delete().eq("id", claim.id)
          const status = (error as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            await db.from("karigar_push_subscriptions").delete().eq("id", subscription.id)
          }
          console.error("Karigar push failed", subscription.id, payable.karigar_id, error)
        }
      }
    }
    return Response.json({ sent, skipped, failed })
  } catch (error) {
    console.error("Karigar reminder job failed", error)
    return Response.json({ error: "Reminder job failed" }, { status: 500 })
  }
})
