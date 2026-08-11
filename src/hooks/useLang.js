import { useState, useEffect } from "react"
import { startUrduObserver, stopUrduObserver, translateTree, applyRtlStyles } from "@/lib/i18n"

export function useLang() {
  const [lang, setLangState] = useState(() => localStorage.getItem("ts_lang") || "en")

  useEffect(() => {
    applyLang(lang)
  }, [lang])

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

  function setLang(l) {
    const prev = localStorage.getItem("ts_lang") || "en"
    localStorage.setItem("ts_lang", l)
    // Switching from Urdu back to English: the observer already mutated the live
    // DOM text nodes, so the cleanest way to restore English is a fresh render.
    if (prev === "ur" && l !== "ur") {
      window.location.reload()
      return
    }
    setLangState(l)
  }

  return { lang, setLang, isRtl: lang === "ur" }
}
