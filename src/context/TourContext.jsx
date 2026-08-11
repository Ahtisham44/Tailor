import { createContext, useContext, useRef, useCallback } from "react"

/*
  TourController — a tiny imperative bridge so the central product tour can
  drive UI that lives inside page components (open dialogs, focus inputs,
  create/delete demo records) without those pages exposing their private state.

  Pages call `register(name, fn)` for each action they expose. The tour calls
  `call(name, ...args)` to invoke them. Everything is ref-based so registering
  an action never causes a re-render.
*/

const TourContext = createContext(null)

export function TourProvider({ children }) {
  const actions = useRef({})

  // A page registers an imperative action; returns an unregister cleanup.
  const register = useCallback((name, fn) => {
    actions.current[name] = fn
    return () => { if (actions.current[name] === fn) delete actions.current[name] }
  }, [])

  const has = useCallback((name) => typeof actions.current[name] === "function", [])

  // Call a registered action. Returns its result (may be a promise) or
  // undefined if the page hasn't mounted/registered it yet.
  const call = useCallback(async (name, ...args) => {
    const fn = actions.current[name]
    if (typeof fn !== "function") return undefined
    return await fn(...args)
  }, [])

  return (
    <TourContext.Provider value={{ register, call, has }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTourController() {
  const ctx = useContext(TourContext)
  // Safe no-op fallback if used outside the provider (keeps pages resilient).
  if (!ctx) {
    return {
      register: () => () => {},
      call: async () => undefined,
      has: () => false,
    }
  }
  return ctx
}
