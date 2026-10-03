export const isCustomMeasurement = key => String(key).startsWith("custom_")

export function measurementLabel(row, standardLabel) {
  return row.custom_label ?? standardLabel(row.measurement_key)
}

export function sortMeasurementRows(rows) {
  return [...rows].sort((a, b) => {
    const aCustom = isCustomMeasurement(a.measurement_key)
    const bCustom = isCustomMeasurement(b.measurement_key)
    if (aCustom !== bCustom) return aCustom ? 1 : -1
    if (!aCustom) return 0
    return (a.display_order ?? 0) - (b.display_order ?? 0)
  })
}

export function hasMeasurementValue(rows) {
  return rows.some(row => String(row.value ?? "").trim() !== "")
}

export function reportMeasurementRows(rows, standardLabel) {
  return sortMeasurementRows(rows)
    .filter(row => isCustomMeasurement(row.measurement_key) || String(row.value ?? "").trim() !== "")
    .map(row => [
      measurementLabel(row, standardLabel),
      String(row.value ?? "") + (!isCustomMeasurement(row.measurement_key) && row.unit ? " " + row.unit : ""),
    ])
}
