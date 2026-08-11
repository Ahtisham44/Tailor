import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// shadcn utility
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// ===== Gradient avatars (soft glossy single-hue orb) =====
// Deterministic: the same seed always maps to the same hue, so a given
// person/customer keeps a stable avatar across the app. One hue per person —
// a gentle light highlight (top-left) eases into a muted deeper shade of the
// same colour. Returns a CSS `background` value.
export function gradientAvatar(seed) {
  const s = String(seed == null || seed === "" ? "?" : seed)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  const hue = h % 360
  return `radial-gradient(circle at 32% 28%, ` +
    `hsl(${hue} 70% 86%) 0%, ` +
    `hsl(${hue} 58% 72%) 38%, ` +
    `hsl(${hue} 50% 60%) 72%, ` +
    `hsl(${hue} 46% 54%) 100%)`
}

// ===== Original utils (ported from utils.js) =====

export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""
}

export function fmtDate(d) {
  if (!d) return ""
  var dt = new Date(d)
  // Urdu: numeric DD MM YYYY (e.g. "01 07 2026"). English: "01 Jul 2026".
  // document.documentElement.lang is set synchronously by useLang() on every
  // language change, so it's a reliable signal even from this plain util.
  var isUrdu = typeof document !== "undefined" && document.documentElement.lang === "ur"
  if (isUrdu) {
    var dd = String(dt.getDate()).padStart(2, "0")
    var mm = String(dt.getMonth() + 1).padStart(2, "0")
    return dd + " " + mm + " " + dt.getFullYear()
  }
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

export function fmtMoney(n) {
  if (n == null || n === "") return ""
  return "Rs " + Number(n).toLocaleString("en-PK")
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function slugify(s) {
  return (s || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
}

export function debounce(fn, ms) {
  var t
  return function (...args) {
    clearTimeout(t)
    t = setTimeout(() => fn.apply(this, args), ms)
  }
}

export function generateOrderNum() {
  var now = new Date()
  var y = now.getFullYear().toString().slice(2)
  var m = String(now.getMonth() + 1).padStart(2, "0")
  var r = Math.floor(Math.random() * 9000 + 1000)
  return "ORD-" + y + m + "-" + r
}

// ===== Device / user-agent parsing (for login session logging) =====
// Best-effort parse of navigator data into friendly device fields.
export function getDeviceInfo() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || ""
  const uaData = (typeof navigator !== "undefined" && navigator.userAgentData) || null

  // OS / platform
  let platform = "Unknown"
  if (/Windows NT 10/.test(ua)) platform = "Windows 10/11"
  else if (/Windows/.test(ua)) platform = "Windows"
  else if (/Android\s([\d.]+)/.test(ua)) platform = "Android " + RegExp.$1
  else if (/iPhone OS ([\d_]+)/.test(ua)) platform = "iOS " + RegExp.$1.replace(/_/g, ".")
  else if (/iPad.*OS ([\d_]+)/.test(ua)) platform = "iPadOS " + RegExp.$1.replace(/_/g, ".")
  else if (/Mac OS X ([\d_]+)/.test(ua)) platform = "macOS " + RegExp.$1.replace(/_/g, ".")
  else if (/Linux/.test(ua)) platform = "Linux"

  // Browser
  let browser = "Unknown"
  if (/Edg\/([\d.]+)/.test(ua)) browser = "Edge " + RegExp.$1
  else if (/OPR\/([\d.]+)/.test(ua)) browser = "Opera " + RegExp.$1
  else if (/Chrome\/([\d.]+)/.test(ua) && !/Edg|OPR/.test(ua)) browser = "Chrome " + RegExp.$1
  else if (/Version\/([\d.]+).*Safari/.test(ua)) browser = "Safari " + RegExp.$1
  else if (/Firefox\/([\d.]+)/.test(ua)) browser = "Firefox " + RegExp.$1

  // Device type
  let deviceType = "desktop"
  if (/Tablet|iPad/.test(ua)) deviceType = "tablet"
  else if (/Mobi|Android|iPhone/.test(ua)) deviceType = "mobile"

  // Make / model — only reliably present on some Android UAs
  let make = ""
  let model = ""
  if (/iPhone/.test(ua)) { make = "Apple"; model = "iPhone" }
  else if (/iPad/.test(ua)) { make = "Apple"; model = "iPad" }
  else if (/Macintosh/.test(ua)) { make = "Apple"; model = "Mac" }
  else {
    // Android pattern: "...; <model> Build/..." or "...; <model>)"
    const m = ua.match(/;\s?([^;)]+)\sBuild\//) || ua.match(/Android[^;]*;\s?([^;)]+)\)/)
    if (m && m[1]) {
      model = m[1].trim()
      const known = ["Samsung","SM-","Redmi","Mi ","POCO","OPPO","Vivo","OnePlus","Realme","Huawei","Honor","Tecno","Infinix","Nokia","Motorola","Moto","Pixel"]
      const hit = known.find(k => model.toLowerCase().includes(k.toLowerCase()))
      if (hit) make = hit.replace("SM-", "Samsung").replace("Mi ", "Xiaomi").trim()
      if (/SM-/.test(model)) make = "Samsung"
      if (/Pixel/.test(model)) make = "Google"
    }
  }

  const deviceName = browser !== "Unknown" && platform !== "Unknown"
    ? browser.split(" ")[0] + " on " + platform
    : (model || browser || "Unknown device")

  // ── Richer signals ────────────────────────────────────────────────────────
  const scr = (typeof screen !== "undefined" && screen) || {}
  const screenStr   = scr.width ? `${scr.width}×${scr.height}` : ""
  const viewportStr = (typeof window !== "undefined" && window.innerWidth)
    ? `${window.innerWidth}×${window.innerHeight}` : ""
  let timezone = ""
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "" } catch { /* noop */ }
  const languages = (typeof navigator !== "undefined")
    ? (Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages.join(", ")
        : navigator.language || "")
    : ""
  const cpuCores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || null
  const deviceMemory = (typeof navigator !== "undefined" && navigator.deviceMemory) || null
  const touch = (typeof navigator !== "undefined")
    ? (navigator.maxTouchPoints > 0 || "ontouchstart" in window)
    : false
  const gpu = getGpuRenderer()
  const colorDepth = scr.colorDepth || null

  const info = {
    device_name: deviceName,
    platform,
    make: make || (uaData?.platform || ""),
    model,
    browser,
    device_type: deviceType,
    user_agent: ua,
    screen: screenStr,
    viewport: viewportStr,
    timezone,
    languages,
    cpu_cores: cpuCores,
    device_memory: deviceMemory,
    gpu,
    touch,
  }
  info.fingerprint = fingerprintHash([
    ua, platform, screenStr, timezone, languages, gpu, cpuCores, deviceMemory, colorDepth,
  ].join("|"))
  return info
}

// Read the GPU renderer string via WebGL (best-effort; may be blocked).
function getGpuRenderer() {
  try {
    const canvas = document.createElement("canvas")
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    if (!gl) return ""
    const dbg = gl.getExtension("WEBGL_debug_renderer_info")
    if (!dbg) return ""
    return String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "").slice(0, 200)
  } catch { return "" }
}

// Tiny stable hash (FNV-1a) → hex. Not cryptographic; just a device signature.
function fingerprintHash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return ("00000000" + h.toString(16)).slice(-8)
}

// Decode JWT payload (no verification — client only)
export function decodeJwtExp(token) {
  try {
    var payload = token.split(".")[1]
    var b64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    var json = JSON.parse(atob(b64))
    return json.exp || null
  } catch {
    return null
  }
}
