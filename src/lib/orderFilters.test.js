import test from "node:test"
import assert from "node:assert/strict"
import { bookingBounds, orderFilterQuery } from "./orderFilters.js"

test("booking presets use local calendar days across month boundaries", () => {
  const now = new Date(2026, 2, 2, 0, 15)
  assert.deepEqual(bookingBounds("today", null, now), ["2026-03-02", "2026-03-02"])
  assert.deepEqual(bookingBounds("week", null, now), ["2026-02-24", "2026-03-02"])
  assert.deepEqual(bookingBounds("month", null, now), ["2026-03-01", "2026-03-31"])
})

test("custom dates keep both endpoints, including a single day", () => {
  const day = new Date(2026, 9, 3)
  assert.equal(bookingBounds("custom", { from: day }), null)
  assert.deepEqual(bookingBounds("custom", { from: day, to: day }), ["2026-10-03", "2026-10-03"])
})

test("assignment, date, and status filters combine before pagination", () => {
  const now = new Date(2026, 9, 3)
  assert.deepEqual(orderFilterQuery({ status: "ready", karigar: "worker-id", date: "week", now }), {
    select: "*,assignments:karigar_order_assignments!inner()",
    filters: ["status=eq.ready", "booking_date=gte.2026-09-27", "booking_date=lte.2026-10-03", "assignments.karigar_id=eq.worker-id"],
  })
  assert.deepEqual(orderFilterQuery({ status: "", karigar: "unassigned", date: "all" }), {
    select: "*,assignments:karigar_order_assignments()",
    filters: ["assignments=is.null"],
  })
})
