import test from 'node:test'
import assert from 'node:assert/strict'
import { blankInbound, forecastPayload, receiptPayload, closePayload, readPendingInbound, inboundPendingKey, inboundOpen, inboundEditable, inboundCancellable, custodyPayload, inboundClosable, supplementPayload, unidentifiedPayload, unknownActions } from '../src/warehouse/inbound.js'

const asn = () => ({ id: 'asn-1', workflow: 'JAVA_ASN_V1', status: 'PARTIALLY_RECEIVED', _version: 2, lines: [{ product: 'p1', quantity: 10, received: 4, remaining: 6 }] })
const row = quantity => ({ product: 'p1', location: 'a1', quantity })
const unknown = () => ({ ...asn(), custodyCount: 1, unidentifiedArrivals: [{ id: 'u1', quantity: 5, remaining: 5, reserved: 2, batch: 'B-1' }], identificationApprovals: [{ id: 'a1', arrival: 'u1', decision: 'identify', remaining: 2 }] })
test('unidentified physical custody blocks direct acceptance and closure', () => {
  assert.equal(inboundOpen(unknown()), false); assert.equal(inboundClosable(unknown()), false)
  assert.equal(inboundCancellable({ ...unknown(), status: 'NEW' }), false)
  assert.throws(() => unidentifiedPayload({ ...unknown(), status: 'CLOSED' }, 'unknownArrive', {}, 'r1'))
})
test('identification preserves observed tracking and cannot overbook held goods', () => {
  const form = { arrival: 'u1', decision: 'identify', quantity: 3, product: 'p1', batch: 'B-1', reference: 'Confirmation', reason: 'Verified', approved: true }
  assert.equal(unidentifiedPayload(unknown(), 'unknownApprove', form, 'r1').approved, undefined)
  assert.throws(() => unidentifiedPayload(unknown(), 'unknownApprove', { ...form, quantity: 4 }, 'r1'), /reserved_quantity/)
  assert.throws(() => unidentifiedPayload(unknown(), 'unknownApprove', { ...form, batch: 'B-2' }, 'r1'), /observed_tracking/)
})
test('physical disposal requires evidence and strict confirmation while identification does not send physical proof', () => {
  const value = unknown(), form = { arrival: 'u1', approval: 'a1', quantity: 2, reference: 'Signed evidence', confirmPhysical: true, reason: 'Handled' }
  const identified = unidentifiedPayload(value, 'unknownExecute', form, 'r1')
  assert.equal(identified.reference, undefined); assert.equal(identified.confirmPhysical, undefined)
  value.identificationApprovals[0].decision = 'scrap'
  for (const confirmPhysical of [false, 'true', undefined]) assert.throws(() => unidentifiedPayload(value, 'unknownExecute', { ...form, confirmPhysical }, 'r1'), /physical_confirmation/)
  assert.equal(unidentifiedPayload(value, 'unknownExecute', form, 'r1').confirmPhysical, true)
  assert.throws(() => unidentifiedPayload(value, 'unknownExecute', { ...form, approval: 'other' }, 'r1'))
  assert.throws(() => unidentifiedPayload(value, 'unknownExecute', { ...form, quantity: 3 }, 'r1'))
})
test('unidentified actions recover original request across reload and cancel never submits execution fields', () => {
  for (const type of unknownActions) { const saved = { type, id: 'asn-1', payload: { requestId: 'original', arrival: 'u1' } }; assert.deepEqual(readPendingInbound({ getItem: () => JSON.stringify(saved) }, 7), saved) }
  const cancelled = unidentifiedPayload(unknown(), 'unknownCancel', { arrival: 'u1', approval: 'a1', quantity: 100, confirmPhysical: true, reason: 'Unused' }, 'r1')
  assert.equal(cancelled.quantity, undefined); assert.equal(cancelled.confirmPhysical, undefined)
})

test('supplement requires explicit policies and sends only approved inputs', () => {
  const original = { ...asn(), client: 'c1', warehouse: 'w1', status: 'CLOSED', lateRemaining: { p1: 3 } }
  const form = { ...blankInbound(), reference: 'LATE-1', lines: [{ product: 'p1', quantity: 3 }], reason: 'Late shipment', adminPolicy: '', skuPolicy: 'group', amount: 0, client: 'injected' }
  assert.throws(() => supplementPayload(original, form, 'r1'), /supplement_policy/)
  form.adminPolicy = 'included'; const body = supplementPayload(original, form, 'r1')
  assert.equal(body.client, undefined); assert.equal(body.amount, undefined); assert.equal(body._version, 2); assert.equal(body.adminPolicy, 'included')
  assert.throws(() => supplementPayload({ ...original, lateSupplement: {} }, form, 'r1'), /invalid_supplement/)
})
test('supplement checks remaining shortfall, strict extra approval and original products', () => {
  const original = { ...asn(), client: 'c1', warehouse: 'w1', status: 'CLOSED', lateRemaining: { p1: 1 } }
  const form = { ...blankInbound(), reference: 'LATE-2', lines: [{ product: 'p1', quantity: 2 }], reason: 'Late shipment', adminPolicy: 'separate', skuPolicy: 'separate', approveAdditional: 'true' }
  assert.throws(() => supplementPayload(original, form, 'r1'), /supplement_additional/)
  form.approveAdditional = true; assert.equal(supplementPayload(original, form, 'r1').approveAdditional, true)
  form.lines[0].product = 'unknown'; assert.throws(() => supplementPayload(original, form, 'r1'), /invalid_supplement/)
})
test('unreceived supplements can cancel but cannot rewrite approved forecast; pending replay survives reload', () => {
  const child = { ...asn(), status: 'NEW', lateSupplement: { parentAsn: 'original' } }
  assert.equal(inboundEditable(child), false); assert.equal(inboundCancellable(child), true)
  const pending = { type: 'lateSupplement', id: 'original', payload: { requestId: 'same-nonce' } }
  assert.deepEqual(readPendingInbound({ getItem: () => JSON.stringify(pending) }, 'actor-7'), pending)
})
test('forecast excludes protected and display fields and refuses repeated products', () => {
  const form = { ...blankInbound(), client: 'c1', warehouse: 'w1', reference: 'ASN-1', status: 'CLOSED', amount: 1, lines: [{ product: 'p1', quantity: 3 }] }
  const value = forecastPayload(form, 'request-1', 2)
  assert.equal(value.status, undefined); assert.equal(value.amount, undefined); assert.equal(value._version, 2)
  form.lines.push({ product: 'p1', quantity: 2 }); assert.throws(() => forecastPayload(form, 'request-1'), /invalid_forecast/)
})
test('receipt totals all lots of one product against remaining quantity', () => {
  assert.equal(receiptPayload(asn(), [row(2), row(4)], 'r1').lines.length, 2)
  assert.throws(() => receiptPayload(asn(), [row(3), row(4)], 'r1'), /over_receipt/)
  assert.throws(() => receiptPayload(asn(), [{ ...row(1), product: 'unknown' }], 'r1'), /over_receipt/)
})
test('serial units and positive integer quantities are enforced before sending', () => {
  for (const q of [0, -1, 1.5, 10000001, NaN, Infinity]) assert.throws(() => receiptPayload(asn(), [row(q)], 'r1'), /invalid_quantity/)
  assert.throws(() => receiptPayload(asn(), [{ ...row(2), serial: 'S1' }], 'r1'), /serial_quantity/)
  assert.equal(receiptPayload(asn(), [{ ...row(1), serial: ' S1 ' }], 'r1').lines[0].serial, 'S1')
})
test('new receipts cannot be generated for closed, cancelled or legacy records', () => {
  for (const status of ['CLOSED', 'CANCELLED', 'RECEIVED']) assert.throws(() => receiptPayload({ ...asn(), status }, [row(1)], 'r1'), /invalid_receipt/)
  assert.equal(inboundOpen({ ...asn(), workflow: 'LEGACY' }), false)
  assert.equal(inboundEditable({ ...asn(), status: 'NEW', receipts: [{}] }), false)
})
test('shortfall closure requires explicit approval and a reason', () => {
  const form = { deliveryType: 'LCL Boxes', deliveryQuantity: 1, hours: '1.125' }
  assert.throws(() => closePayload(asn(), form, 'r1'), /shortfall_approval/)
  assert.throws(() => closePayload(asn(), { ...form, approveShortfall: true, reason: ' ' }, 'r1'), /shortfall_approval/)
  const result = closePayload(asn(), { ...form, approveShortfall: true, reason: 'Supplier shortage' }, 'r1')
  assert.equal(result.hours, '1.125'); assert.equal(result._version, 2)
})
test('closure hours remain decimal text and reject invalid precision and ranges', () => {
  const full = { ...asn(), status: 'RECEIVED', lines: [{ product: 'p1', remaining: 0 }] }
  const form = { deliveryType: 'LCL Boxes', deliveryQuantity: 1, hours: '0' }
  assert.equal(closePayload(full, form, 'r1').hours, '0')
  for (const hours of ['-1', '0.0001', '100001', 'abc']) assert.throws(() => closePayload(full, { ...form, hours }, 'r1'))
})
test('pending request survives reload with exactly the same identity and payload', () => {
  const saved = { type: 'receive', id: 'asn-1', payload: receiptPayload(asn(), [row(2)], 'same-request') }
  let requestedKey
  assert.deepEqual(readPendingInbound({ getItem(key) { requestedKey = key; return JSON.stringify(saved) } }, 7), saved)
  assert.equal(requestedKey, 'warehouse.inbound.pending.7'); assert.notEqual(inboundPendingKey(7), inboundPendingKey(8))
})
test('corrupt or incomplete request storage fails closed', () => {
  for (const value of ['{', '{}', JSON.stringify({ type: 'receive', payload: { requestId: 'r1' } }), JSON.stringify({ type: 'delete', id: 'asn-1', payload: { requestId: 'r1' } })]) assert.throws(() => readPendingInbound({ getItem: () => value }, 7))
  assert.equal(readPendingInbound({ getItem: () => null }, 7), null)
  assert.throws(() => inboundPendingKey(undefined))
})

const held = () => ({ ...asn(), custodyCount: 1, custodyTasks: [{ id: 'task-1', product: 'p1', quantity: 8, remaining: 8, inspection: 'PASS', approvedExtra: 0 }] })
test('unresolved custody blocks direct receipt, editing and closure, with all-rejected short closure supported', () => {
  assert.equal(inboundOpen(held()), false); assert.equal(inboundClosable(held()), false)
  assert.equal(inboundEditable({ ...held(), status: 'NEW' }), false)
  const rejected = { ...held(), status: 'NEW', custodyTasks: [{ ...held().custodyTasks[0], remaining: 0 }] }
  assert.equal(inboundClosable(rejected), true)
  assert.equal(closePayload(rejected, { deliveryType: 'LCL Boxes', deliveryQuantity: 1, hours: '0', approveShortfall: true, reason: 'All damaged' }, 'r1').approveShortfall, true)
})
test('custody payload excludes injected privileges and requires approval only for the actual excess', () => {
  const form = { task: 'task-1', quantity: 8, location: 'pick-1', reason: 'Put away', approved_extra: 100 }
  assert.throws(() => custodyPayload(held(), 'putaway', form, 'r1'), /overage_approval/)
  const within = custodyPayload(held(), 'putaway', { ...form, quantity: 6 }, 'r1')
  assert.equal(within.approved_extra, undefined); assert.equal(within.quantity, 6)
  const approved = held(); approved.custodyTasks[0].approvedExtra = 2
  assert.equal(custodyPayload(approved, 'putaway', form, 'r1').quantity, 8)
})
test('inspection and disposal prevent invalid state changes and preserve exact retry identity', () => {
  const task = held(); task.custodyTasks[0].remaining = 3
  assert.throws(() => custodyPayload(task, 'inspect', { task: 'task-1', result: 'FAIL', reason: 'Changed mind' }, 'r1'))
  assert.throws(() => custodyPayload(task, 'scrap', { task: 'task-1', quantity: 1, reason: 'Scrap pass' }, 'r1'))
  for (const type of ['stage', 'inspect', 'approveOverage', 'putaway', 'scrap']) {
    const pending = { type, id: 'asn-1', payload: { requestId: 'original-r1', _version: 2, task: 'task-1' } }
    assert.deepEqual(readPendingInbound({ getItem: () => JSON.stringify(pending) }, 7), pending)
  }
})

test('supplier return reservation cannot be double-approved, put away or scrapped', () => {
  const asn = held(); asn.custodyTasks[0].returnReserved = 5
  assert.throws(() => custodyPayload(asn, 'putaway', { task: 'task-1', quantity: 4, location: 'p1', reason: 'Test' }, 'r1'), /return_reserved/)
  assert.throws(() => custodyPayload(asn, 'approveReturn', { task: 'task-1', quantity: 4, recipient: 'Supplier', destination: 'Test address', reference: 'Auth', reason: 'Test' }, 'r1'), /return_reserved/)
  assert.throws(() => custodyPayload(asn, 'inspect', { task: 'task-1', result: 'FAIL', reason: 'Test' }, 'r1'))
  assert.equal(custodyPayload(asn, 'approveReturn', { task: 'task-1', quantity: 3, recipient: 'Supplier', destination: 'Test address', reference: 'Auth', reason: 'Test' }, 'r1').quantity, 3)
})
test('supplier handover binds approval and requires explicit actual-handover evidence', () => {
  const asn = held(); asn.supplierReturnApprovals = [{ id: 'a1', task: 'task-1', remaining: 2 }]
  const form = { task: 'task-1', approval: 'a1', quantity: 2, handoverReference: 'Signed reference', reason: 'Test' }
  assert.throws(() => custodyPayload(asn, 'returnSupplier', form, 'r1'), /handover_confirmation/)
  assert.throws(() => custodyPayload(asn, 'returnSupplier', { ...form, confirmHandover: 'true' }, 'r1'), /handover_confirmation/)
  const value = custodyPayload(asn, 'returnSupplier', { ...form, confirmHandover: true, recipient: 'Injected' }, 'r1')
  assert.equal(value.recipient, undefined); assert.equal(value.approval, 'a1'); assert.equal(value.confirmHandover, true)
  assert.throws(() => custodyPayload(asn, 'returnSupplier', { ...form, confirmHandover: true, quantity: 3 }, 'r1'))
  assert.throws(() => custodyPayload(asn, 'cancelReturnApproval', { ...form, approval: 'different' }, 'r1'))
})
test('after uninspected supplier return the remaining unreserved goods can still be inspected', () => {
  const asn = held(); Object.assign(asn.custodyTasks[0], { remaining: 6, returned: 2, inspection: 'PENDING' })
  assert.equal(custodyPayload(asn, 'inspect', { task: 'task-1', result: 'PASS', reason: 'Inspect remainder' }, 'r1').result, 'PASS')
  for (const type of ['approveReturn', 'cancelReturnApproval', 'returnSupplier']) {
    const value = { type, id: 'asn-1', payload: { requestId: 'same-r1', task: 'task-1', approval: 'a1' } }
    assert.deepEqual(readPendingInbound({ getItem: () => JSON.stringify(value) }, 7), value)
  }
})
