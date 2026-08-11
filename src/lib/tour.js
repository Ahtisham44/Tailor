import { driver } from "driver.js"
import "driver.js/dist/driver.css"

// Per-user "seen" flag so the tour runs once after the first login.
const seenKey = (uid) => "ts_tour_seen_" + (uid || "default")
export function hasSeenTour(uid) {
  try { return localStorage.getItem(seenKey(uid)) === "1" } catch { return true }
}
export function markTourSeen(uid) {
  try { localStorage.setItem(seenKey(uid), "1") } catch { /* noop */ }
}
export function resetTour(uid) {
  try { localStorage.removeItem(seenKey(uid)) } catch { /* noop */ }
}

const isMobile = () => window.matchMedia("(max-width: 640px)").matches

// Wait until a selector appears in the DOM (or time out).
function waitFor(selector, timeout = 4000) {
  return new Promise((resolve) => {
    const found = document.querySelector(selector)
    if (found) return resolve(found)
    const started = Date.now()
    const iv = setInterval(() => {
      const el = document.querySelector(selector)
      if (el) { clearInterval(iv); resolve(el) }
      else if (Date.now() - started > timeout) { clearInterval(iv); resolve(null) }
    }, 100)
  })
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Bilingual copy for the driven workflow.
const COPY = {
  welcome: {
    en: { title: "Welcome to TailorCRM 👋", desc: "Let's actually run your shop together — I'll create a sample customer and order so you can see each step live. The demo data is cleaned up at the end. Tap Next to begin." },
    ur: { title: "ٹیلر سی آر ایم میں خوش آمدید 👋", desc: "آئیے مل کر آپ کی دکان چلائیں — میں ایک نمونہ گاہک اور آرڈر بناؤں گا تاکہ آپ ہر مرحلہ لائیو دیکھیں۔ نمونہ ڈیٹا آخر میں صاف کر دیا جائے گا۔ شروع کرنے کے لیے اگلا دبائیں۔" },
  },
  customer: {
    en: { title: "1 · Add a customer", desc: "This is the Add Customer form. Every customer needs just a name and phone to start — everything else hangs off them." },
    ur: { title: "1 · گاہک شامل کریں", desc: "یہ گاہک شامل کرنے کا فارم ہے۔ ہر گاہک کے لیے صرف نام اور فون کافی ہے — باقی سب کچھ اسی سے جڑتا ہے۔" },
  },
  measurements: {
    en: { title: "2 · Save measurements", desc: "Pick an item like Shalwar Qameez and enter the sizes once. They're saved with version history and reused on every future order." },
    ur: { title: "2 · ناپ محفوظ کریں", desc: "شلوار قمیض جیسا آئٹم منتخب کریں اور ناپ ایک بار درج کریں۔ یہ ورژن ہسٹری کے ساتھ محفوظ ہوتے ہیں اور ہر اگلے آرڈر پر دوبارہ استعمال ہوتے ہیں۔" },
  },
  order: {
    en: { title: "3 · Create an order", desc: "Here's a new order for that customer. The saved measurements fill in automatically — you just set items, price and delivery date." },
    ur: { title: "3 · آرڈر بنائیں", desc: "یہ اسی گاہک کے لیے نیا آرڈر ہے۔ محفوظ ناپ خود بھر جاتے ہیں — آپ صرف اشیاء، قیمت اور ڈلیوری تاریخ مقرر کرتے ہیں۔" },
  },
  invoice: {
    en: { title: "4 · Print the receipt", desc: "This is the order view. Tap Receipt / PDF to hand your customer a clean, printable Urdu measurement slip in seconds." },
    ur: { title: "4 · رسید پرنٹ کریں", desc: "یہ آرڈر کا منظر ہے۔ رسید / PDF دبائیں تاکہ گاہک کو صاف، قابلِ پرنٹ اردو ناپ پرچی سیکنڈوں میں دیں۔" },
  },
  reports: {
    en: { title: "5 · Track in Reports", desc: "Reports show your daily sales, pending work and earnings in one place — so you always know how the shop is doing." },
    ur: { title: "5 · رپورٹس میں دیکھیں", desc: "رپورٹس آپ کی روزانہ فروخت، باقی کام اور آمدنی ایک جگہ دکھاتی ہیں — تاکہ آپ کو ہمیشہ معلوم ہو دکان کیسی چل رہی ہے۔" },
  },
  done: {
    en: { title: "You're all set! 🎉", desc: "That's the full flow: customer → measurements → order → receipt → reports. The sample data has been removed. Replay anytime from Shop Profile → Start tour." },
    ur: { title: "آپ تیار ہیں! 🎉", desc: "یہ مکمل طریقہ ہے: گاہک ← ناپ ← آرڈر ← رسید ← رپورٹس۔ نمونہ ڈیٹا ہٹا دیا گیا ہے۔ دکان پروفائل ← دورہ چلائیں سے کسی بھی وقت دوبارہ چلائیں۔" },
  },
}

const navSel = (id) => (isMobile() ? `[data-tour="mnav-${id}"]` : `[data-tour="nav-${id}"]`)

/*
  Drive the full guided tour.
  Params:
    lang      — "en" | "ur"
    navigate  — react-router navigate(path)
    call      — tourController.call(actionName, ...args)
    onDone    — optional callback when the tour ends
*/
export function startTour({ lang = "en", navigate, call, onDone } = {}) {
  const isUr = lang === "ur"
  const t = (k) => COPY[k][isUr ? "ur" : "en"]

  // Demo records created during the tour; cleaned up at the end.
  const demo = { custId: null, orderId: null }
  let cleanedUp = false

  async function cleanup() {
    if (cleanedUp) return
    cleanedUp = true
    try { if (demo.orderId && call) await call("deleteDemoOrder", demo.orderId) } catch { /* noop */ }
    try { if (demo.custId && call) await call("deleteDemoCustomer", demo.custId) } catch { /* noop */ }
    try { if (call) { await call("closeOrderDialogs"); await call("closeCustomerDialog") } } catch { /* noop */ }
  }

  const d = driver({
    showProgress: true,
    allowClose: true,
    disableActiveInteraction: true,   // demo is driven, so block stray clicks
    overlayOpacity: 0.65,
    stagePadding: 8,
    stageRadius: 12,
    popoverClass: "ts-tour-popover",
    nextBtnText:  isUr ? "اگلا" : "Next",
    prevBtnText:  isUr ? "پیچھے" : "Back",
    doneBtnText:  isUr ? "مکمل" : "Done",
    progressText: isUr ? "{{current}} / {{total}}" : "{{current}} of {{total}}",
    onDestroyed: () => { cleanup().finally(() => { if (onDone) onDone() }) },
    steps: [
      // 0 — Welcome (centered). Next → open the Add Customer dialog.
      {
        popover: {
          ...t("welcome"),
          onNextClick: async () => {
            navigate("/customers")
            await waitFor('[data-tour="add-customer"]')
            await call("openAddCustomer")
            await waitFor('#cust-form-t')
            await sleep(150)
            d.moveNext()
          },
        },
      },
      // 1 — Add customer (highlight the name field in the open dialog).
      {
        element: "#cust-form-t",
        popover: {
          ...t("customer"),
          side: "bottom", align: "start",
          onNextClick: async () => {
            await call("addDemoMeasurement")
            await waitFor('[data-tour="measurements"]')
            await sleep(200)
            d.moveNext()
          },
        },
      },
      // 2 — Measurements (highlight the item selector / focused input).
      {
        element: '[data-tour="measurements"]',
        popover: {
          ...t("measurements"),
          side: "top", align: "start",
          onNextClick: async () => {
            // Close the dialog, create the real demo customer, then open a new order.
            await call("closeCustomerDialog")
            const cust = await call("createDemoCustomer")
            demo.custId = cust && cust.id
            navigate("/orders")
            await waitFor('[data-tour="add-order"]')
            await call("openNewOrderForDemo", demo.custId)
            await waitFor("#m-order-new")
            await sleep(200)
            d.moveNext()
          },
        },
      },
      // 3 — Create order (the New Order dialog is open on step 2).
      {
        element: "#m-order-new",
        popover: {
          ...t("order"),
          side: "left", align: "start",
          onNextClick: async () => {
            // Create the real order and open its view (so the Receipt button shows).
            await call("closeOrderDialogs")
            const orderId = await call("createDemoOrder", demo.custId)
            demo.orderId = orderId
            const inv = await waitFor('[data-tour="print-invoice"]')
            await sleep(200)
            if (inv) d.moveNext()
            else d.moveNext()   // graceful: order view may differ; still advance
          },
        },
      },
      // 4 — Print receipt (highlight the Receipt/PDF button in the order view).
      {
        element: '[data-tour="print-invoice"]',
        popover: {
          ...t("invoice"),
          side: isMobile() ? "top" : "left", align: "start",
          onNextClick: async () => {
            await call("closeOrderDialogs")
            navigate("/reports")
            await waitFor(navSel("reports"), 2500)
            await sleep(200)
            d.moveNext()
          },
        },
      },
      // 5 — Reports (highlight the Reports nav item).
      {
        element: navSel("reports"),
        popover: { ...t("reports"), side: isMobile() ? "top" : "right" },
      },
      // 6 — Done (centered). Cleanup happens in onDestroyed.
      { popover: { ...t("done") } },
    ],
  })

  d.drive()
  return d
}
