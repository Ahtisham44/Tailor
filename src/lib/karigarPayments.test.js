import test from "node:test"
import assert from "node:assert/strict"
import { assignmentMonth, completedMonthPayable, monthBounds, monthKey, paymentMonths, previousMonth, undoSecondsRemaining } from "./karigarPayments.js"

test("previous completed month crosses year boundaries", () => {
  assert.equal(previousMonth("2026-10"), "2026-09")
  assert.equal(previousMonth("2027-01"), "2026-12")
})

test("Pakistan month boundary crosses December into January at 19:00 UTC", () => {
  assert.equal(monthKey(new Date("2026-12-31T18:59:59Z")), "2026-12")
  assert.equal(monthKey(new Date("2026-12-31T19:00:00Z")), "2027-01")
  assert.equal(previousMonth(monthKey(new Date("2026-12-31T19:00:00Z"))), "2026-12")
})

test("payment undo expires five minutes after creation", () => {
  const createdAt = "2026-10-02T10:00:00Z"
  assert.equal(undoSecondsRemaining(createdAt, Date.parse(createdAt)), 300)
  assert.equal(undoSecondsRemaining(createdAt, Date.parse(createdAt) + 299_001), 1)
  assert.equal(undoSecondsRemaining(createdAt, Date.parse(createdAt) + 300_000), 0)
  assert.equal(undoSecondsRemaining("invalid"), 0)
})

test("monthly periods cover full calendar months including leap February", () => {
  assert.deepEqual(monthBounds("2024-02"), { start: "2024-02-01", end: "2024-02-29" })
  assert.deepEqual(monthBounds("2025-02"), { start: "2025-02-01", end: "2025-02-28" })
  assert.deepEqual(monthBounds("2026-10"), { start: "2026-10-01", end: "2026-10-31" })
})

test("assignments follow Pakistan calendar dates near UTC midnight", () => {
  assert.equal(assignmentMonth("2026-09-30T20:00:00Z"), "2026-10")
  assert.equal(assignmentMonth("2026-10-31T18:59:59Z"), "2026-10")
  assert.equal(assignmentMonth("2026-10-31T19:00:00Z"), "2026-11")
})

test("payments remain recorded when earnings change later", () => {
  const assignments = [{ created_at: "2026-10-02T10:00:00Z", agreed_rate: 500 }]
  const payouts = [{ period_start: "2026-10-01", amount: 500 }]
  assert.equal(paymentMonths(assignments, payouts)[0].balance, 0)
  assignments[0].agreed_rate = 650
  assert.equal(paymentMonths(assignments, payouts)[0].balance, 150)
  assignments[0].agreed_rate = 400
  assert.equal(paymentMonths(assignments, payouts)[0].balance, -100)
})

test("unpaid months carry into the current payable amount and one payment clears them", () => {
  const assignments = [
    { created_at: "2026-07-10T10:00:00Z", agreed_rate: 400 },
    { created_at: "2026-08-10T10:00:00Z", agreed_rate: 600 },
  ]
  const before = paymentMonths(assignments, [], "2026-10")
  assert.deepEqual(before[0], {
    month: "2026-10", earned: 0, paid: 0, orders: 0, carried: 1000, balance: 1000,
  })

  const after = paymentMonths(assignments, [
    { period_start: "2026-10-01", amount: 1000 },
  ], "2026-10")
  assert.equal(after[0].balance, 0)
  assert.equal(after[0].paid, 1000)
})

test("a partially paid prior month contributes only its remaining amount", () => {
  const assignments = [
    { created_at: "2026-07-10T10:00:00Z", agreed_rate: 400 },
    { created_at: "2026-10-02T10:00:00Z", agreed_rate: 300 },
  ]
  const payouts = [{ period_start: "2026-07-01", amount: 150 }]
  const current = paymentMonths(assignments, payouts, "2026-10")[0]
  assert.equal(current.carried, 250)
  assert.equal(current.balance, 550)
})

test("completed payable excludes current work and counts payments recorded this month", () => {
  const assignments = [
    { created_at: "2026-08-10T10:00:00Z", agreed_rate: 400 },
    { created_at: "2026-09-10T10:00:00Z", agreed_rate: 600 },
    { created_at: "2026-10-02T10:00:00Z", agreed_rate: 300 },
  ]
  const payouts = [{ period_start: "2026-10-01", amount: 750 }]
  const rows = paymentMonths(assignments, payouts, "2026-10")
  assert.deepEqual(completedMonthPayable(rows, payouts, "2026-09"), {
    month: "2026-09", earned: 600, orders: 1, carried: 0,
    paidAllTime: 750, balance: 250,
  })
  assert.equal(completedMonthPayable(rows, [...payouts, { period_start: "2026-09-01", amount: 250 }], "2026-09").balance, 0)
  assert.equal(completedMonthPayable(rows, [], "2026-09").balance, 1000)
})
