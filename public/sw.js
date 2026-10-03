self.addEventListener("push", event => {
  if (!event.data) return
  let data
  try { data = event.data.json() } catch { return }
  event.waitUntil(self.registration.showNotification(data.title || "Karigar payment due", {
    body: data.body || "Open Karigar to review the amount due.",
    icon: "/Frame 1.svg",
    badge: "/Frame 1.svg",
    tag: data.tag,
    data: { url: "/karigar" },
  }))
})

self.addEventListener("notificationclick", event => {
  event.notification.close()
  event.waitUntil((async () => {
    const url = new URL("/karigar", self.location.origin).href
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const client = clients.find(item => item.url.startsWith(self.location.origin))
    if (client) { await client.navigate(url); return client.focus() }
    return self.clients.openWindow(url)
  })())
})
