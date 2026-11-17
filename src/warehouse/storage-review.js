import { decimalInput } from './decimal.js'
export const storageFactKeys = mode => ({ StorageUnits: ['unitStoragePrice'], Volumetric: ['volume'], VolumetricCarton: ['unitsPerCarton', 'cartonHeight', 'cartonLength', 'cartonDepth'], PerPalletUnit: ['unitsPerPallet', 'unitStoragePrice'] })[mode] || []
export function storageReviewInput(period, form) {
  const required = value => { if (typeof value !== 'string' || !value.trim()) throw Error('required'); return value.trim() }
  const allocations = form.allocations.map(row => {
    const quantity = Number(row.quantity)
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000000) throw Error('quantity')
    return { arrival: required(row.arrival), product: required(row.product), quantity }
  })
  const totals = new Map(), seen = new Set()
  for (const row of allocations) { const key = row.arrival + ':' + row.product; if (seen.has(key)) throw Error('duplicate'); seen.add(key); totals.set(row.arrival, (totals.get(row.arrival) || 0) + row.quantity) }
  const unknown = period.context.unidentifiedStock || []
  if (!unknown.length || totals.size !== unknown.length || unknown.some(row => totals.get(row.id) !== Number(row.onhand))) throw Error('allocation_quantity')
  const historical = new Set(period.historicalProducts.map(row => row.id)), keys = storageFactKeys(period.context.client.storageType || 'Volumetric')
  if (!keys.length) throw Error('mode')
  const productFacts = [...new Set(allocations.map(row => row.product))].filter(id => !historical.has(id)).sort().map(product => {
    const result = { product }
    for (const key of keys) { const value = form.facts?.[product]?.[key]; if (value === '' || value === undefined || value === null) throw Error('missing_facts'); result[key] = decimalInput(value); if (key !== 'unitStoragePrice' && !/[1-9]/.test(result[key])) throw Error('positive_facts') }
    return result
  })
  allocations.sort((a, b) => a.arrival.localeCompare(b.arrival) || a.product.localeCompare(b.product))
  return { allocations, productFacts, reason: required(form.reason), evidenceReference: required(form.evidenceReference) }
}
