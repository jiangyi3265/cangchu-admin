const actions = new Set(['add', 'remove', 'transfer'])
export function movementPayload(form, requestId) {
  if (!actions.has(form.action)) throw new Error('invalid_action')
  if (!requestId || typeof requestId !== 'string') throw new Error('missing_request_id')
  const payload = { requestId, action: form.action }
  for (const key of ['product', 'warehouse', 'location', 'batch', 'serial', 'expiry', 'reason']) {
    if (form[key] !== undefined && form[key] !== null && form[key] !== '') payload[key] = String(form[key])
  }
  payload.quantity = Number(form.quantity)
  if (!Number.isSafeInteger(payload.quantity) || payload.quantity <= 0 || payload.quantity > 10000000) throw new Error('invalid_quantity')
  if (form.action === 'transfer') {
    if (form.toWarehouse) payload.toWarehouse = String(form.toWarehouse)
    if (form.toLocation) payload.toLocation = String(form.toLocation)
  }
  return payload
}
export function rowMovement(row, action) {
  const form = { action, quantity: 1, reason: '', toWarehouse: '', toLocation: '', client: row?.client || '' }
  for (const key of ['product', 'warehouse', 'location', 'batch', 'serial', 'expiry']) form[key] = row?.[key] ?? ''
  return form
}
export function pendingStorageKey(userId) {
  if (userId === undefined || userId === null || String(userId) === '') throw new Error('missing_actor')
  return 'warehouse.inventory.pending.' + String(userId)
}
export function readPendingMovement(storage, userId) {
  const value = storage.getItem(pendingStorageKey(userId))
  if (!value) return null
  const pending = JSON.parse(value)
  if (!pending?.payload?.requestId || !actions.has(pending.payload.action) || !Number.isFinite(pending.payload.quantity) || pending.payload.quantity <= 0) throw new Error('invalid_pending')
  return pending
}
export function rejectedBeforeCommit(error) {
  const response = error?.response?.data
  return [400, 403, 404, 409, 422].includes(Number(response?.code)) && response?.data?.committed === false
}
