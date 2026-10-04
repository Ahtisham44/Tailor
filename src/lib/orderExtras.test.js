import test from "node:test"
import assert from "node:assert/strict"
import {
  EXTRA_PRESETS, defaultExtras, extraRow, extraName, encodeExtraType,
  restoreExtras, extrasTotal,
} from "./orderExtras.js"

test("new categories charge all seven presets at quantity one", () => {
  const rows = defaultExtras()
  assert.equal(rows.length, 7)
  assert.deepEqual(rows.map(row => [row.name, row.price, row.qty]), EXTRA_PRESETS.map(p => [p.en, p.price, 1]))
  assert.equal(extrasTotal(rows), 2750)
  assert.deepEqual(rows.map(row => extraName(row.name, "ur")), EXTRA_PRESETS.map(p => p.ur))
})

test("switching languages changes all preset labels without changing saved names or prices", () => {
  const rows = [...defaultExtras(), extraRow("Customer's own item", 125, 2)]
  const before = rows.map(row => ({ ...row }))
  assert.deepEqual(rows.map(row => extraName(row.name, "ur")), [
    ...EXTRA_PRESETS.map(preset => preset.ur), "Customer's own item",
  ])
  assert.deepEqual(rows.map(row => extraName(row.name, "en")), [
    ...EXTRA_PRESETS.map(preset => preset.en), "Customer's own item",
  ])
  assert.deepEqual(rows, before)

  const saved = rows.map((row, index) => ({
    item_type: encodeExtraType("Shalwar Qameez", index, row.name),
    price: row.price, quantity: row.qty,
  }))
  const restored = restoreExtras(saved, "Shalwar Qameez")
  assert.deepEqual(restored.map(row => [row.name, row.price, row.qty]), rows.map(row => [row.name, row.price, row.qty]))
  assert.deepEqual(restored.map(row => extraName(row.name, "ur")), rows.map(row => extraName(row.name, "ur")))
  assert.equal(extrasTotal(restored), extrasTotal(rows))
})

test("edits, removal, re-adding a preset, and custom rows change the total", () => {
  const rows = defaultExtras()
  rows[0] = { ...rows[0], name: "New hook", price: 300, qty: 2 }
  rows.splice(1, 1)
  rows.push(extraRow(EXTRA_PRESETS[1].en, EXTRA_PRESETS[1].price))
  rows.push(extraRow("Custom", 75, 3))
  assert.equal(extrasTotal(rows), 3375)
})

test("saved rows beyond index three restore in order with their category", () => {
  const rows = defaultExtras()
  rows.push(extraRow("Custom", 75, 2))
  const saved = rows.map((row, index) => ({
    item_type: encodeExtraType("Shalwar Qameez", index, row.name),
    price: row.price, quantity: row.qty,
  }))
  saved.reverse()
  const restored = restoreExtras(saved, "Shalwar Qameez")
  assert.deepEqual(restored.map(row => [row.name, row.price, row.qty]), rows.map(row => [row.name, row.price, row.qty]))
  assert.equal(extrasTotal(restored), 2900)
  assert.deepEqual(restoreExtras(saved, "Waistcoat"), [])
})

test("older orders restore only their saved extra rows", () => {
  assert.deepEqual(restoreExtras([], "Shalwar Qameez"), [])
  const oldRows = [0, 1, 2, 3].map(index => ({
    item_type: encodeExtraType("Shalwar Qameez", index, EXTRA_PRESETS[index].en),
    price: EXTRA_PRESETS[index].price,
    quantity: 1,
  }))
  assert.equal(restoreExtras(oldRows, "Shalwar Qameez").length, 4)
  assert.equal(extrasTotal(restoreExtras(oldRows, "Shalwar Qameez")), 1000)
})
