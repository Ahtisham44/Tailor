import { useEffect, useSyncExternalStore } from "react"
import { startUrduObserver, stopUrduObserver, translateTree, applyRtlStyles } from "@/lib/i18n"

const readLang = () => (typeof localStorage === "undefined" ? "en" : localStorage.getItem("ts_lang") || "en")
let currentLang = readLang()
const listeners = new Set()

function notifyLang() {
  listeners.forEach(listener => listener())
}

function subscribeLang(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setLang(l) {
  const prev = currentLang
  localStorage.setItem("ts_lang", l)
  currentLang = l
  notifyLang()
  // The Urdu observer mutates live text nodes. Reload to restore English text.
  if (prev === "ur" && l !== "ur") window.location.reload()
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", event => {
    if (event.key !== "ts_lang") return
    const prev = currentLang
    currentLang = readLang()
    notifyLang()
    if (prev === "ur" && currentLang !== "ur") window.location.reload()
  })
}

function applyLang(l) {
  const isRtl = l === "ur"
  document.documentElement.lang = l
  document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr")

  if (isRtl) {
    if (!document.getElementById("urdu-font-link")) {
      const link = document.createElement("link")
      link.id   = "urdu-font-link"
      link.rel  = "stylesheet"
      link.href = "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap"
      document.head.appendChild(link)
    }
    document.body.style.fontFamily = "'Noto Nastaliq Urdu', serif"
    document.body.style.fontSize   = "15px"
    document.body.style.lineHeight = "2"

    // Force right-to-left layout everywhere (inline-styled snippets included).
    applyRtlStyles(true)

    // Start the runtime translator: it converts any English text that wasn't
    // routed through tr() into Urdu, and keeps translating new DOM as it
    // renders (modals, toasts, charts, etc.).
    startUrduObserver()
    // Translate whatever is already on screen right now.
    translateTree(document.body)
  } else {
    document.body.style.fontFamily = "var(--fb)"
    document.body.style.fontSize   = ""
    document.body.style.lineHeight = ""
    applyRtlStyles(false)
    stopUrduObserver()
  }
}

export function useLang() {
  const lang = useSyncExternalStore(subscribeLang, () => currentLang, () => "en")

  useEffect(() => {
    applyLang(lang)
  }, [lang])

  return { lang, setLang, isRtl: lang === "ur" }
}
