import { correctionActions } from './receipt-correction.js'
import { decimalInput } from './decimal.js'

export const deliveryTypes = ['FCL Container 20', 'FCL Container 40', 'FCL Container 40 HC', 'FCL Container 45', 'FCL Container 45 HC', 'LCL Pallet', 'LCL Boxes']
export const custodyActions = ['stage', 'inspect', 'approveOverage', 'putaway', 'scrap', 'approveReturn', 'cancelReturnApproval', 'returnSupplier']
export const unknownActions = ['unknownArrive', 'unknownApprove', 'unknownExecute', 'unknownCancel']
export const inboundHeld = row => row?.custodyTasks?.some(task => task.remaining > 0) || row?.unidentifiedArrivals?.some(task => task.remaining > 0) || false
export const custodyOpen = row => row?.workflow === 'JAVA_ASN_V1' && ['NEW', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(row.status)
export const inboundOpen = row => row?.workflow === 'JAVA_ASN_V1' && ['NEW', 'PARTIALLY_RECEIVED'].includes(row.status) && !inboundHeld(row)
export const inboundCancellable = row => row?.workflow === 'JAVA_ASN_V1' && row.status === 'NEW' && !row.receipts?.length && !row.custodyCount && !row.custodyTasks?.length
export const inboundEditable = row => inboundCancellable(row) && !row.lateSupplement
export const inboundClosable = row => custodyOpen(row) && (row.status !== 'NEW' || (row.custodyCount > 0 || row.receipts?.length > 0)) && !inboundHeld(row)
const quantity = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1 || n > 10000000) throw Error('invalid_quantity'); return n }
const required = value => { if (typeof value !== 'string' || !value.trim()) throw Error('required_field'); return value.trim() }
export const blankInbound = () => ({ client: '', warehouse: '', supplierId: '', reference: '', expectedDate: '', deliveryType: 'LCL Boxes', notes: '', lines: [{ product: '', quantity: 1 }] })
export function forecastPayload(form, requestId, version) {
  const result = { requestId, client: required(form.client), warehouse: required(form.warehouse), reference: required(form.reference), expectedDate: form.expectedDate || '', deliveryType: form.deliveryType, notes: form.notes || '' }
  if (!deliveryTypes.includes(result.deliveryType)) throw Error('invalid_delivery_type')
  result.lines = form.lines.map(line => ({ product: required(line.product), quantity: quantity(line.quantity) }))
  if (!result.lines.length || result.lines.length > 200 || new Set(result.lines.map(line => line.product)).size !== result.lines.length || result.lines.reduce((n, row) => n + row.quantity, 0) > 10000000) throw Error('invalid_forecast')
  if (form.supplierId !== undefined) result.supplierId = String(form.supplierId || '')
  if (version !== undefined) result._version = version
  return result
}
export function receiptPayload(asn, lines, requestId) {
  if (!inboundOpen(asn) || !lines.length || lines.length > 200) throw Error('invalid_receipt')
  const totals = new Map()
  const payload = { requestId, _version: asn._version, lines: lines.map(line => {
    const product = required(line.product), location = required(line.location), count = quantity(line.quantity)
    const forecast = asn.lines.find(row => row.product === product)
    totals.set(product, (totals.get(product) || 0) + count)
    if (!forecast || totals.get(product) > forecast.remaining) throw Error('over_receipt')
    if (line.serial && count !== 1) throw Error('serial_quantity')
    return { product, location, quantity: count, batch: String(line.batch || '').trim(), serial: String(line.serial || '').trim(), expiry: line.expiry || '' }
  }) }
  return payload
}
export function closePayload(asn, form, requestId) {
  if (!inboundClosable(asn) || !deliveryTypes.includes(form.deliveryType)) throw Error('invalid_closure')
  const hours = decimalInput(form.hours)
  if (Number(hours) > 100000 || (hours.split('.')[1]?.length || 0) > 3) throw Error('invalid_hours')
  if (asn.lines.some(row => row.remaining > 0) && (!form.approveShortfall || !String(form.reason || '').trim())) throw Error('shortfall_approval')
  return { requestId, _version: asn._version, deliveryType: form.deliveryType, deliveryQuantity: quantity(form.deliveryQuantity), hours, approveShortfall: Boolean(form.approveShortfall), reason: String(form.reason || '').trim() }
}
export const inboundPendingKey = actor => { if (actor === undefined || actor === null || String(actor) === '') throw Error('missing_actor'); return 'warehouse.inbound.pending.' + actor }
export function supplementPayload(asn, form, requestId) {
  if (asn?.workflow !== 'JAVA_ASN_V1' || asn.status !== 'CLOSED' || asn.lateSupplement) throw Error('invalid_supplement')
  if (!['included', 'separate'].includes(form.adminPolicy) || !['group', 'separate'].includes(form.skuPolicy)) throw Error('supplement_policy')
  const forecast = forecastPayload({ ...form, client: asn.client, warehouse: asn.warehouse }, requestId)
  delete forecast.client; delete forecast.warehouse
  const reason = required(form.reason)
  if (reason.length > 500 || forecast.reference.length > 191) throw Error('invalid_supplement')
  for (const line of forecast.lines) {
    if (!asn.lines.some(row => row.product === line.product)) throw Error('invalid_supplement')
    if (line.quantity > (asn.lateRemaining?.[line.product] || 0) && form.approveAdditional !== true) throw Error('supplement_additional')
  }
  return { ...forecast, _version: asn._version, adminPolicy: form.adminPolicy, skuPolicy: form.skuPolicy, approveAdditional: form.approveAdditional === true, reason }
}
export function custodyPayload(asn, action, form, requestId) {
  if (!custodyOpen(asn) || !custodyActions.includes(action)) throw Error('invalid_custody')
  const result = { requestId, _version: asn._version, reason: required(form.reason) }
  if (result.reason.length > 500) throw Error('invalid_custody')
  if (action === 'stage') {
    result.product = required(form.product); result.location = required(form.location); result.quantity = quantity(form.quantity)
    if (!asn.lines.some(line => line.product === result.product)) throw Error('invalid_custody')
    for (const key of ['batch', 'serial', 'expiry']) result[key] = String(form[key] || '').trim()
    if (result.serial && result.quantity !== 1) throw Error('serial_quantity')
  } else {
    result.task = required(form.task)
    const task = asn.custodyTasks.find(row => row.id === result.task)
    if (!task || task.remaining <= 0) throw Error('invalid_custody')
    if (action === 'inspect') { if (task.remaining + (task.returned || 0) !== task.quantity || task.returnReserved > 0 || !['PASS', 'FAIL'].includes(form.result)) throw Error('invalid_custody'); result.result = form.result }
    if (action === 'approveOverage' && task.inspection !== 'PASS') throw Error('invalid_custody')
    if (action === 'approveReturn') {
      result.quantity = quantity(form.quantity)
      if (result.quantity > task.remaining - (task.returnReserved || 0)) throw Error('return_reserved')
      for (const key of ['recipient', 'destination', 'reference']) result[key] = required(form[key])
      if (result.recipient.length > 200 || result.destination.length > 1000 || result.reference.length > 200) throw Error('invalid_custody')
    }
    if (['returnSupplier', 'cancelReturnApproval'].includes(action)) {
      result.approval = required(form.approval)
      const approval = asn.supplierReturnApprovals?.find(row => row.id === result.approval && row.task === result.task)
      if (!approval || approval.remaining <= 0) throw Error('invalid_custody')
      if (action === 'returnSupplier') {
        result.quantity = quantity(form.quantity)
        if (result.quantity > Math.min(task.remaining, approval.remaining)) throw Error('invalid_quantity')
        result.handoverReference = required(form.handoverReference)
        if (result.handoverReference.length > 200 || form.confirmHandover !== true) throw Error('handover_confirmation')
        result.confirmHandover = true
      }
    }
    if (['putaway', 'scrap'].includes(action)) {
      result.quantity = quantity(form.quantity)
      if (result.quantity > task.remaining - (task.returnReserved || 0)) throw Error('return_reserved')
      if (result.quantity > task.remaining || task.inspection !== (action === 'putaway' ? 'PASS' : 'FAIL')) throw Error('invalid_custody')
      if (action === 'putaway') {
        result.location = required(form.location)
        const remaining = asn.lines.find(row => row.product === task.product)?.remaining || 0
        if (Math.max(0, result.quantity - remaining) > task.approvedExtra) throw Error('overage_approval')
      }
    }
  }
  return result
}
export function readPendingInbound(storage, actor) {
  const value = storage.getItem(inboundPendingKey(actor)); if (!value) return null
  const pending = JSON.parse(value)
  if (!['create', 'update', 'receive', 'close', 'cancel', 'lateSupplement', ...custodyActions, ...unknownActions, ...correctionActions].includes(pending?.type) || typeof pending?.payload?.requestId !== 'string' || !pending.payload.requestId || (pending.type !== 'create' && !pending.id)) throw Error('invalid_pending')
  if (['executeCorrection', 'cancelCorrection'].includes(pending.type) && (typeof pending.payload.correction !== 'string' || !pending.payload.correction.trim() || !Number.isSafeInteger(pending.payload._version) || pending.payload._version < 1)) throw Error('invalid_pending')
  return pending
}
export function unidentifiedPayload(asn, action, form, requestId) {
  if (!custodyOpen(asn) || !unknownActions.includes(action)) throw Error('invalid_unidentified')
  const text = (key, max, mandatory = true) => { const value = mandatory ? required(form[key]) : String(form[key] || '').trim(); if (value.length > max) throw Error('invalid_unidentified'); return value }
  const result = { requestId, _version: asn._version, reason: text('reason', 500) }
  const tracking = () => { for (const key of ['batch', 'serial', 'expiry']) result[key] = text(key, key === 'expiry' ? 10 : 191, false); if (result.serial && result.quantity !== 1) throw Error('serial_quantity') }
  if (action === 'unknownArrive') {
    result.quantity = quantity(form.quantity); result.location = required(form.location)
    result.barcode = text('barcode', 200, false); result.description = text('description', 500); result.evidenceReference = text('evidenceReference', 200); tracking()
  } else {
    result.arrival = required(form.arrival)
    const arrival = asn.unidentifiedArrivals?.find(row => row.id === result.arrival)
    if (!arrival || arrival.remaining <= 0) throw Error('invalid_unidentified')
    if (action === 'unknownApprove') {
      result.quantity = quantity(form.quantity)
      if (result.quantity > arrival.remaining - (arrival.reserved || 0)) throw Error('reserved_quantity')
      result.decision = form.decision; result.reference = text('reference', 200)
      if (result.decision === 'identify') {
        result.product = required(form.product); tracking()
        for (const key of ['batch', 'serial', 'expiry']) if (arrival[key] && arrival[key] !== result[key]) throw Error('observed_tracking')
      } else if (['returnSupplier', 'scrap'].includes(result.decision)) {
        result.recipient = text('recipient', 200); result.destination = text('destination', 1000)
      } else throw Error('invalid_unidentified')
    } else {
      result.approval = required(form.approval)
      const approval = asn.identificationApprovals?.find(row => row.id === result.approval && row.arrival === result.arrival)
      if (!approval || approval.remaining <= 0) throw Error('invalid_unidentified')
      if (action === 'unknownExecute') {
        result.quantity = quantity(form.quantity)
        if (result.quantity > Math.min(arrival.remaining, approval.remaining)) throw Error('invalid_quantity')
        if (approval.decision !== 'identify') {
          result.reference = text('reference', 200)
          if (form.confirmPhysical !== true) throw Error('physical_confirmation')
          result.confirmPhysical = true
        }
      }
    }
  }
  return result
}
