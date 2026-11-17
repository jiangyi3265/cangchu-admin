import test from 'node:test'
import assert from 'node:assert/strict'
import { newReturnPayload, returnActionPayload, returnPendingKey, readPendingReturn } from '../src/warehouse/returns.js'
const head = { workflow: 'JAVA_RETURN_V1', status: 'RECEIVED', _version: 3, quantity: 5, received: 2, held: 2, sources: [{ id: 'allocation', remaining: 3 }], receipts: [{ id: 'receipt', remaining: 2, disposed: 0, inspection: 'PASS' }] }
test('return creation accepts only explicit positive whole quantities and emits no stock or rate fields', () => {
  for (const quantity of [null, undefined, '', false, 0, -1, 1.5, 10000001]) assert.throws(() => newReturnPayload({ order: 'order', product: 'sku', reference: 'RMA', reason: 'Return', quantity }, 'nonce'))
  assert.deepEqual(newReturnPayload({ order: 'order', product: 'sku', reference: ' RMA ', reason: ' Return ', quantity: 2, amount: 9, status: 'CLOSED' }, 'nonce'), { requestId: 'nonce', order: 'order', product: 'sku', reference: 'RMA', reason: 'Return', quantity: 2 })
})
test('receipt requires explicit original source and observes both source and RMA limits', () => {
  assert.throws(() => returnActionPayload(head, 'receive', { allocation: 'wrong', location: 'hold', quantity: 1 }, 'n'))
  assert.throws(() => returnActionPayload(head, 'receive', { allocation: 'allocation', location: 'hold', quantity: 4 }, 'n'))
  assert.equal(returnActionPayload(head, 'receive', { allocation: 'allocation', location: 'hold', quantity: 2 }, 'n').quantity, 2)
})
test('inspection controls disposition and cannot be changed after partial disposition', () => {
  const form = { receipt: 'receipt', quantity: 1, location: 'pick', reason: 'Checked', result: 'FAIL' }
  assert.throws(() => returnActionPayload(head, 'scrap', form, 'n'))
  assert.equal(returnActionPayload(head, 'restock', form, 'n').location, 'pick')
  assert.throws(() => returnActionPayload({ ...head, receipts: [{ ...head.receipts[0], disposed: 1 }] }, 'inspect', form, 'n'))
})
test('closure never hides held stock or accepts implicit shortfall approval', () => {
  assert.throws(() => returnActionPayload(head, 'cancel', { reason: 'Cancel' }, 'n'))
  assert.throws(() => returnActionPayload(head, 'close', { reason: 'Done', approveShortfall: true }, 'n'))
  assert.throws(() => returnActionPayload({ ...head, held: 0 }, 'close', { reason: 'Done' }, 'n'))
  assert.equal(returnActionPayload({ ...head, held: 0 }, 'close', { reason: 'Done', approveShortfall: true }, 'n').approveShortfall, true)
})
test('uncertain request journal remains per actor and rejects malformed entries', () => {
  assert.notEqual(returnPendingKey(7), returnPendingKey(8))
  const original = { type: 'action', id: 'rma', payload: { requestId: 'same-nonce', action: 'receive', _version: 3, quantity: 2 } }
  assert.deepEqual(readPendingReturn({ getItem: () => JSON.stringify(original) }, 7), original)
  assert.throws(() => readPendingReturn({ getItem: () => '{bad' }, 7))
  assert.throws(() => readPendingReturn({ getItem: () => JSON.stringify({ ...original, payload: { ...original.payload, action: 'delete' } }) }, 7))
})
