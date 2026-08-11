import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "ts_theme" // "light" | "dark" | "system"

function systemPrefersDark() {
  return typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(prefers-color-scheme: dark)").matches
}

// Resolve a preference ("system" | "light" | "dark") to the concrete mode.
function resolve(pref) {
  if (pref === "dark")  return "dark"
  if (pref === "light") return "light"
  return systemPrefersDark() ? "dark" : "light"
}

// Apply the resolved mode to <html>. Called as early as possible (see
// applyThemeEarly below) to avoid a flash of the wrong theme.
function applyMode(mode) {
  const root = document.documentElement
  if (mode === "dark") root.classList.add("dark")
  else root.classList.remove("dark")
}

// Run once, synchronously, before React mounts — prevents a light flash.
export function applyThemeEarly() {
  try {
    const pref = localStorage.getItem(STORAGE_KEY) || "system"
    applyMode(resolve(pref))
  } catch {
    applyMode(systemPrefersDark() ? "dark" : "light")
  }
}

export function useTheme() {
  const [pref, setPref] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || "system" }
    catch { return "system" }
  })
  // Bumped whenever the OS theme changes (only relevant while pref === "system").
  const [sysTick, setSysTick] = useState(0)

  // `mode` is derived, not stored — avoids a setState-in-effect cascade.
  const mode = resolve(pref)

  // Persist + apply the preference to <html> whenever it (or the OS) changes.
  useEffect(() => {
    applyMode(resolve(pref))
    try { localStorage.setItem(STORAGE_KEY, pref) } catch { /* noop */ }
  }, [pref, sysTick])

  // When following the system, react live to OS theme changes.
  useEffect(() => {
    if (pref !== "system" || !window.matchMedia) return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setSysTick(t => t + 1)
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange)
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange)
    }
  }, [pref])

  // Toggle: smoothly flip between light and dark (becomes an explicit override).
  const toggle = useCallback(() => {
    const root = document.documentElement
    root.classList.add("theme-anim")
    window.setTimeout(() => root.classList.remove("theme-anim"), 350)
    setPref(prev => (resolve(prev) === "dark" ? "light" : "dark"))
  }, [])

  const setTheme = useCallback((p) => setPref(p), [])

  return { pref, mode, isDark: mode === "dark", toggle, setTheme }
}
