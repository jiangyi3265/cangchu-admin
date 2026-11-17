const required = value => { if (typeof value !== 'string' || !value.trim()) throw Error('count_required'); return value.trim() }
const counted = value => { if (value === null || value === undefined || value === '' || !Number.isSafeInteger(Number(value)) || Number(value) < 0) throw Error('count_quantity'); return Number(value) }
export const countOpen = row => row?.workflow === 'JAVA_STOCKTAKE_V1' && ['COUNTING', 'REVIEW'].includes(row.status)
export function startCountPayload(form, requestId) {
  if (!Array.isArray(form.locations) || !form.locations.length || form.locations.length > 100 || new Set(form.locations).size !== form.locations.length) throw Error('count_locations')
  return { requestId, client: required(form.client), warehouse: required(form.warehouse), reference: required(form.reference), notes: String(form.notes || ''), locations: form.locations.map(required) }
}
export function countPayload(detail, lines, requestId) {
  if (detail?.status !== 'COUNTING' || !lines.length || lines.length > 200) throw Error('count_lines')
  return { requestId, _version: detail._version, action: 'count', lines: lines.map(row => {
    const value = counted(row.counted), reason = String(row.reason || '').trim()
    if (value !== row.expected && !reason) throw Error('count_reason')
    if (row.serial && value > 1) throw Error('count_serial')
    return { id: row.id, counted: value, reason }
  }) }
}
export function foundPayload(detail, form, requestId) {
  const value = counted(form.counted)
  if (detail?.status !== 'COUNTING' || !value || !detail.locations.includes(form.location)) throw Error('count_found')
  if (form.serial && value !== 1) throw Error('count_serial')
  return { requestId, _version: detail._version, action: 'found', product: required(form.product), location: required(form.location), counted: value, reason: required(form.reason), batch: String(form.batch || '').trim(), serial: String(form.serial || '').trim(), expiry: form.expiry || '' }
}
export const countPendingKey = actor => { if (actor === undefined || actor === null || String(actor) === '') throw Error('missing_actor'); return 'warehouse.stocktakes.pending.' + actor }
export function readPendingCount(storage, actor) {
  const raw = storage.getItem(countPendingKey(actor)); if (!raw) return null
  const value = JSON.parse(raw)
  if (!['create', 'action'].includes(value?.type) || !value.payload?.requestId || value.type === 'action' && (!value.id || !Number.isSafeInteger(value.payload._version) || !['count', 'found', 'submit', 'reopen', 'approve', 'cancel'].includes(value.payload.action))) throw Error('invalid_pending')
  return value
}
