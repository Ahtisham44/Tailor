export const EXTRA_PRESETS = [
  { en: "Hook", ur: "کانٹا", price: 200 },
  { en: "Fancy Button", ur: "فینسی بٹن", price: 200 },
  { en: "Fancy Snap Button", ur: "ٹچ فینسی بٹن", price: 400 },
  { en: "Plain Snap Button", ur: "سادہ ٹچ بٹن", price: 200 },
  { en: "Embroidery", ur: "کڑھائی", price: 500 },
  { en: "Design", ur: "ڈیزائن", price: 1000 },
  { en: "Pocket", ur: "پاکٹ", price: 250 },
]

const EXTRA_PREFIX = "__order_extra__|"
let nextRowId = 0

export function extraRow(name = "", price = 0, qty = 1) {
  return { id: ++nextRowId, name, price, qty }
}

export function defaultExtras() {
  return EXTRA_PRESETS.map(preset => extraRow(preset.en, preset.price))
}

export function extraName(name, lang) {
  const preset = EXTRA_PRESETS.find(p => p.en === name || p.ur === name)
  return preset ? preset[lang === "ur" ? "ur" : "en"] : name
}

export function presetForName(name) {
  return EXTRA_PRESETS.find(p => p.en.toLowerCase() === name.trim().toLowerCase() || p.ur === name.trim())
}

export function encodeExtraType(category, index, name) {
  return `${EXTRA_PREFIX}${encodeURIComponent(category)}|${index}|${encodeURIComponent(name)}`
}

export function decodeExtraType(type) {
  if (typeof type !== "string" || !type.startsWith(EXTRA_PREFIX)) return null
  const parts = type.slice(EXTRA_PREFIX.length).split("|")
  if (parts.length !== 3) return null
  const index = Number(parts[1])
  if (!Number.isSafeInteger(index) || index < 0) return null
  try {
    return { category: decodeURIComponent(parts[0]), index, name: decodeURIComponent(parts[2]) }
  } catch {
    return null
  }
}

export function restoreExtras(orderItems, category) {
  return orderItems.flatMap(item => {
    const decoded = decodeExtraType(item.item_type)
    return decoded?.category === category
      ? [{ name: decoded.name, price: item.price ?? 0, qty: item.quantity ?? 1, savedIndex: decoded.index }]
      : []
  }).sort((a, b) => a.savedIndex - b.savedIndex).map(row => extraRow(row.name, row.price, row.qty))
}

export function extrasTotal(extras) {
  return extras.reduce((total, extra) => total + (String(extra.name || "").trim()
    ? (Number(extra.price) || 0) * (Number(extra.qty) || 0) : 0), 0)
}
