export function monthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date)
  const year = parts.find(part => part.type === "year").value
  const month = parts.find(part => part.type === "month").value
  return `${year}-${month}`
}

export function previousMonth(month = monthKey()) {
  if (!monthBounds(month)) return null
  const [year, number] = month.split("-").map(Number)
  return new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7)
}

export function assignmentMonth(createdAt) {
  if (!createdAt) return null
  return monthKey(new Date(createdAt))
}

export function monthBounds(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  const [year, number] = month.split("-").map(Number)
  return {
    start: `${month}-01`,
    end: `${month}-${String(new Date(Date.UTC(year, number, 0)).getUTCDate()).padStart(2, "0")}`,
  }
}

export function money(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
}

export function undoSecondsRemaining(createdAt, now = Date.now()) {
  const created = Date.parse(createdAt)
  if (!Number.isFinite(created) || created > now) return 0
  return Math.max(0, Math.ceil((created + 5 * 60 * 1000 - now) / 1000))
}

export function paymentMonths(assignments, payments, currentMonth = monthKey()) {
  const months = new Map()
  const ensure = key => {
    if (!months.has(key)) months.set(key, { month: key, earned: 0, paid: 0, orders: 0 })
    return months.get(key)
  }
  for (const assignment of assignments) {
    const key = assignmentMonth(assignment.created_at)
    if (!key) continue
    const item = ensure(key)
    item.earned += Number(assignment.agreed_rate) || 0
    item.orders += 1
  }
  for (const payment of payments) {
    const key = payment.period_start?.slice(0, 7)
    if (key && monthBounds(key)) ensure(key).paid += Number(payment.amount) || 0
  }
  ensure(currentMonth)
  let balance = 0
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map(item => {
    const earned = Math.round(item.earned * 100) / 100
    const paid = Math.round(item.paid * 100) / 100
    const carried = balance
    balance = Math.round((balance + earned - paid) * 100) / 100
    return { ...item, earned, paid, carried, balance }
  }).sort((a, b) => b.month.localeCompare(a.month))
}

// A payment made this month may already have settled older work. Count all
// recorded payouts when calculating what remains due through a closed month.
export function completedMonthPayable(rows, payments, month) {
  const period = rows.find(row => row.month === month)
  const earnedBefore = rows.reduce((sum, row) => sum + (row.month < month ? row.earned : 0), 0)
  const earned = period?.earned || 0
  const paidAllTime = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
  const balance = Math.round((earnedBefore + earned - paidAllTime) * 100) / 100
  return {
    month, earned, orders: period?.orders || 0,
    carried: Math.max(Math.round((earnedBefore - paidAllTime) * 100) / 100, 0),
    paidAllTime: Math.round(paidAllTime * 100) / 100,
    balance,
  }
}
