import { decimalInput } from './decimal.js'

export const orderStatuses = ['NEW', 'HOLDING', 'ALLOCATED', 'PICKED', 'DESPATCHED', 'CANCELLED']
export const nativeOrder = order => ['JAVA_MANUAL_V1','JAVA_WOO_V1'].includes(order?.workflow)
export const orderActions = order => nativeOrder(order) && !order?.carrierShipment?.id ? (({ NEW: ['allocate', 'hold', 'cancel'], HOLDING: ['release', 'cancel'], ALLOCATED: ['pick', 'cancel'], PICKED: ['despatch', 'cancel'] })[order?.status] || []).filter(action=>action!=='despatch'||order.workflow==='JAVA_MANUAL_V1') : []
export const orderEditable = order => !order?.carrierShipment?.id && order?.workflow === 'JAVA_MANUAL_V1' && order.status === 'NEW' && !(order.allocations?.length)
export function orderPayload(form, { requestId, version } = {}) {
  const result = {}
  for (const key of ['client', 'warehouse', 'reference', 'name', 'companyName', 'address1', 'address2', 'address3', 'town', 'county', 'postcode', 'country', 'email', 'phone', 'notes', 'channelId']) if (form[key] !== undefined && form[key] !== null) result[key] = String(form[key])
  result.lines = (form.lines || []).map(line => ({ product: String(line.product || ''), quantity: Number(line.quantity) }))
  if (!result.lines.length || result.lines.length > 200 || result.lines.some(line => !line.product || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || line.quantity > 10000000) || result.lines.reduce((sum, line) => sum + line.quantity, 0) > 10000000) throw new Error('invalid_lines')
  if (new Set(result.lines.map(line => line.product)).size !== result.lines.length) throw new Error('duplicate_product')
  if (form.orderValue !== undefined && form.orderValue !== null && form.orderValue !== '') { try { result.orderValue = decimalInput(form.orderValue) } catch { throw new Error('invalid_order_value') } }
  if (requestId) result.requestId = requestId
  if (version !== undefined) result._version = version
  return result
}
export function blankOrder() { return { client: '', warehouse: '', channelId: '', reference: '', name: '', companyName: '', address1: '', address2: '', address3: '', town: '', county: '', postcode: '', country: '', email: '', phone: '', notes: '', orderValue: undefined, lines: [{ product: '', quantity: 1 }] } }
export const orderPendingKey = actor => { if (actor === undefined || actor === null || String(actor) === '') throw Error('missing_actor'); return 'warehouse.orders.pending.' + actor }
export function readPendingOrder(storage, actor) {
  const value = storage.getItem(orderPendingKey(actor))
  if (!value) return null
  const pending = JSON.parse(value)
  if (!['create', 'update', 'action', 'work'].includes(pending?.type) || !pending?.payload?.requestId || pending.type !== 'create' && !pending.id) throw Error('invalid_pending')
  if (pending.type === 'work' && (!['scan', 'unscan', 'pack', 'unpack', 'reopenpick'].includes(pending.payload.action) || !Number.isSafeInteger(pending.payload._version) || pending.payload._version < 1)) throw Error('invalid_pending')
  return pending
}
