export const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

export function bookingBounds(filter, range, now = new Date()) {
  if (filter === "all") return null
  if (filter === "custom") return range?.from && range?.to ? [localDate(range.from), localDate(range.to)] : null
  const end = localDate(now)
  if (filter === "today") return [end, end]
  if (filter === "week") return [localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), end]
  return [localDate(new Date(now.getFullYear(), now.getMonth(), 1)), localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))]
}

export function orderFilterQuery({ status, karigar, date, range, now }) {
  const filters = []
  if (status) filters.push("status=eq." + status)
  const bounds = bookingBounds(date, range, now)
  if (bounds) {
    filters.push("booking_date=gte." + bounds[0])
    filters.push("booking_date=lte." + bounds[1])
  }
  if (karigar === "unassigned") filters.push("assignments=is.null")
  else if (karigar) filters.push("assignments.karigar_id=eq." + encodeURIComponent(karigar))
  const select = karigar
    ? "*,assignments:karigar_order_assignments" + (karigar === "unassigned" ? "()" : "!inner()")
    : "*"
  return { select, filters }
}
