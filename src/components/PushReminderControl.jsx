import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function keyBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0))
}

export default function PushReminderControl() {
  const { api } = useAuth()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [permission, setPermission] = useState(() => typeof Notification === "undefined" ? "unsupported" : Notification.permission)
  const [guidance, setGuidance] = useState("")
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone

  useEffect(() => {
    if (!supported) return
    const refreshPermission = () => setPermission(Notification.permission)
    window.addEventListener("focus", refreshPermission)
    return () => window.removeEventListener("focus", refreshPermission)
  }, [supported])

  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.getRegistration("/").then(reg => reg?.pushManager.getSubscription()).then(async sub => {
      if (!sub) return
      const result = await api.sbQ("karigar_push_subscriptions", {
        query: "endpoint=eq." + encodeURIComponent(sub.endpoint),
      })
      if (result.data?.length) setEnabled(true)
    }).catch(() => {})
  }, [supported, api])

  async function toggle() {
    if (busy) return
    setGuidance("")
    if (!enabled) {
      if (ios && !standalone) {
        setGuidance("On iPhone or iPad, use your browser's Share menu to add this app to your Home Screen. Open it from the new icon, then tap Enable reminders.")
        return
      }
      if (!window.isSecureContext) {
        setGuidance("Push reminders need a secure connection. Open this app over HTTPS, then try again.")
        return
      }
      if (!supported) {
        setGuidance("This browser does not support push reminders. Open the app in a browser that supports web push, then try again.")
        return
      }
      if (!PUBLIC_KEY) {
        setGuidance("Push reminders have not been configured for this app yet. Contact the app administrator.")
        return
      }
      if (Notification.permission === "denied") {
        setPermission("denied")
        setGuidance("Notifications are blocked. Allow them for this app in your browser or device settings, then return here and try again.")
        return
      }
    }
    setBusy(true)
    try {
      if (!enabled && Notification.permission !== "granted") {
        const result = await Notification.requestPermission()
        setPermission(result)
        if (result !== "granted") {
          setGuidance(result === "denied"
            ? "Notifications were blocked. Allow them for this app in your browser or device settings, then try again."
            : "Notification permission was not granted. Tap Enable reminders when you're ready to try again.")
          return
        }
      }
      const registration = await navigator.serviceWorker.register("/sw.js")
      let subscription = await registration.pushManager.getSubscription()
      if (enabled) {
        if (subscription) {
          const result = await api.sbQ("karigar_push_subscriptions", {
            method: "DELETE", query: "endpoint=eq." + encodeURIComponent(subscription.endpoint),
          })
          if (result.error) throw new Error(result.error.message)
          await subscription.unsubscribe()
        }
        setEnabled(false)
        toast.success("Payment reminders turned off on this browser")
      } else {
        if (subscription) {
          const previous = await api.sbQ("karigar_push_subscriptions", {
            query: "endpoint=eq." + encodeURIComponent(subscription.endpoint),
          })
          if (previous.error) throw new Error(previous.error.message)
          // A browser shared with another account needs a fresh endpoint.
          if (!previous.data?.length) {
            await subscription.unsubscribe()
            subscription = null
          }
        }
        if (!subscription) subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY),
        })
        const json = subscription.toJSON()
        const existing = await api.sbQ("karigar_push_subscriptions", {
          query: "endpoint=eq." + encodeURIComponent(subscription.endpoint),
        })
        if (existing.error) throw new Error(existing.error.message)
        if (!existing.data?.length) {
          const result = await api.sbQ("karigar_push_subscriptions", { method: "POST", body: [{
            endpoint: subscription.endpoint, p256dh: json.keys.p256dh, auth_key: json.keys.auth,
          }] })
          if (result.error) throw new Error(result.error.message)
        }
        setEnabled(true)
        toast.success("Monthly payment reminders enabled")
      }
    } catch (error) {
      toast.error(error.message)
      setGuidance(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
    <div>
      <p className="font-medium">Monthly payment reminders</p>
      <p className="text-muted-foreground">Get one browser notification per payable karigar on the 1st at 11:00 AM Pakistan time.</p>
      {guidance && <p role="status" className="mt-1 text-muted-foreground">{guidance}</p>}
    </div>
    <button type="button" className="rounded-md border border-border px-3 py-2 font-medium disabled:opacity-50"
      disabled={busy} onClick={toggle}>
      {busy ? "Working…" : enabled ? "Turn off" : ios && !standalone || !window.isSecureContext || !supported || !PUBLIC_KEY
        ? "How to enable" : permission === "denied" ? "Check settings" : "Enable reminders"}
    </button>
  </div>
}
