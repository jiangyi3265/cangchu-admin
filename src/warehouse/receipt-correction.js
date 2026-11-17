export const correctionActions = ['approveCorrection', 'executeCorrection', 'cancelCorrection']
export function correctionInput(asn, context, form) {
  const text = (value, max) => { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw Error('correction_text'); return value.trim() }
  const allocations = []
  for (const layer of context.layers) {
    const raw = form.quantities?.[layer.id]
    if (raw === undefined || raw === null || raw === '') continue
    const quantity = Number(raw)
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 10000000 || quantity > layer.remaining - layer.reserved) throw Error('correction_quantity')
    if (quantity) allocations.push({ layer: layer.id, quantity })
  }
  const total = allocations.reduce((sum, row) => sum + row.quantity, 0)
  if (!total || total > context.uncorrected || total > 10000000 || allocations.length > 200) throw Error('correction_quantity')
  return { _version: asn._version, receiptLine: context.receipt.id, allocations, reason: text(form.reason, 500), evidenceReference: text(form.evidenceReference, 200) }
}
export function correctionDecision(row, action, form, requestId) {
  if (!['executeCorrection', 'cancelCorrection'].includes(action) || row.status !== 'APPROVED' || !form.reason?.trim()) throw Error('correction_decision')
  const result = { correction: row.id, _version: row._version, requestId, reason: form.reason.trim() }
  if (action === 'executeCorrection') { if (form.confirmRecordedError !== true) throw Error('correction_confirmation'); result.confirmRecordedError = true }
  return result
}
