const required = value => { if (typeof value !== 'string' || !value.trim()) throw Error('return_required'); return value.trim() }
const quantity = value => { if (value === null || value === undefined || value === '' || typeof value === 'boolean' || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 10000000) throw Error('return_quantity'); return Number(value) }
export const returnOpen = row => row?.workflow === 'JAVA_RETURN_V1' && !['CLOSED', 'CANCELLED'].includes(row.status)
export function newReturnPayload(form, requestId) { return { requestId, order: required(form.order), product: required(form.product), reference: required(form.reference), reason: required(form.reason), quantity: quantity(form.quantity) } }
export function returnActionPayload(detail, action, form, requestId) {
  if (!returnOpen(detail)) throw Error('return_closed')
  const out = { requestId, action, _version: detail._version }
  if (action === 'receive') {
    const source = detail.sources.find(row => row.id === form.allocation), count = quantity(form.quantity)
    if (!source || count > source.remaining || count > detail.quantity - detail.received) throw Error('return_source')
    return { ...out, allocation: source.id, location: required(form.location), quantity: count }
  }
  if (['inspect', 'restock', 'scrap'].includes(action)) {
    const receipt = detail.receipts.find(row => row.id === form.receipt)
    if (!receipt || !receipt.remaining) throw Error('return_receipt')
    out.receipt = receipt.id; out.reason = required(form.reason)
    if (action === 'inspect') {
      if (!['PASS', 'FAIL'].includes(form.result) || receipt.disposed > 0) throw Error('return_inspection')
      out.result = form.result
    } else {
      out.quantity = quantity(form.quantity)
      if (out.quantity > receipt.remaining || receipt.inspection !== (action === 'restock' ? 'PASS' : 'FAIL')) throw Error('return_inspection')
      if (action === 'restock') out.location = required(form.location)
    }
    return out
  }
  if (!['close', 'cancel'].includes(action)) throw Error('return_action')
  if (action === 'cancel' && detail.received || action === 'close' && (!detail.received || detail.held)) throw Error('return_held')
  out.reason = required(form.reason)
  if (action === 'close' && detail.received < detail.quantity) { if (form.approveShortfall !== true) throw Error('return_shortfall'); out.approveShortfall = true }
  return out
}
export const returnPendingKey = actor => { if (actor === undefined || actor === null || String(actor) === '') throw Error('missing_actor'); return 'warehouse.returns.pending.' + actor }
export function readPendingReturn(storage, actor) {
  const raw = storage.getItem(returnPendingKey(actor)); if (!raw) return null
  const row = JSON.parse(raw)
  if (!['create', 'action'].includes(row?.type) || typeof row.payload?.requestId !== 'string' || !row.payload.requestId || row.type === 'action' && (!row.id || !Number.isSafeInteger(row.payload._version) || !['receive', 'inspect', 'restock', 'scrap', 'close', 'cancel'].includes(row.payload.action))) throw Error('invalid_pending')
  return row
}
