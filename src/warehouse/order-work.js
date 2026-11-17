import { decimalInput } from './decimal.js'

export function workPayload(input, { requestId, version } = {}) {
  if (!requestId || !Number.isSafeInteger(version) || version < 1) throw Error('work_version')
  const result = { action: input.action, requestId, _version: version }
  const text = (key, max, required = true) => {
    const value = String(input[key] ?? '').trim()
    if ((required && !value) || value.length > max) throw Error('work_fields')
    result[key] = value
  }
  if (input.action === 'scan') {
    text('allocationId', 64); text('barcode', 191); text('serial', 191, false)
  } else if (input.action === 'pack') {
    text('packageCode', 100); text('notes', 500, false)
    for (const key of ['weightKg', 'lengthCm', 'widthCm', 'heightCm']) {
      try {
        const value = decimalInput(input[key], key === 'weightKg' ? 3 : 2)
        if (Number(value) <= 0 || Number(value) > (key === 'weightKg' ? 100000 : 1000)) throw Error()
        result[key] = value
      } catch { throw Error('work_measurements') }
    }
    result.lines = (input.lines || []).map(line => ({ allocationId: String(line.allocationId || ''), quantity: Number(line.quantity) }))
    if (!result.lines.length || result.lines.length > 200 || result.lines.some(line => !line.allocationId || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || line.quantity > 10000000) || new Set(result.lines.map(line => line.allocationId)).size !== result.lines.length) throw Error('work_lines')
  } else if (['unscan', 'unpack', 'reopenpick'].includes(input.action)) {
    text('reason', 500)
    if (input.action === 'unscan') text('scanId', 64)
    if (input.action === 'unpack') text('packageId', 64)
  } else throw Error('work_action')
  return result
}

export const workBlocksAction = (order, action) => !!order?.scanRequired && (action === 'pick' && !order.work?.scanningComplete || action === 'despatch' && !order.work?.packingComplete)
export function packageRemainder(order) {
  return (order?.work?.progress || []).filter(row => row.state === 'RESERVED' && row.packRemaining > 0).map(row => ({ ...row, allocationId: row.id, quantity: row.packRemaining }))
}
