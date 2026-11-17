import test from 'node:test'
import assert from 'node:assert/strict'
import { storageReviewInput } from '../src/warehouse/storage-review.js'
import { financeRetryPermission } from '../src/warehouse/adjustment-input.js'
const period = () => ({ context: { client: { storageType: 'StorageUnits' }, unidentifiedStock: [{ id: 'u1', onhand: 3 }] }, historicalProducts: [{ id: 'p1' }] })
const form = () => ({ allocations: [{ arrival: 'u1', product: 'p1', quantity: 3 }], facts: {}, reason: 'Checked evidence', evidenceReference: 'Signed document' })
test('review covers every historical quantity and rejects duplicate product allocations', () => {
  const input = form(); input.allocations[0].quantity = 2; assert.throws(() => storageReviewInput(period(), input), /allocation_quantity/)
  input.allocations.push({ arrival: 'u1', product: 'p1', quantity: 1 }); assert.throws(() => storageReviewInput(period(), input), /duplicate/)
  input.allocations[1].product = 'p2'; input.facts.p2 = { unitStoragePrice: '0.123456789' }; assert.equal(storageReviewInput(period(), input).productFacts[0].unitStoragePrice, '0.123456789')
})
test('historical product facts cannot be sent as overrides and new facts are mandatory', () => {
  const input = form(); input.facts.p1 = { unitStoragePrice: '999', approved: true }; assert.deepEqual(storageReviewInput(period(), input).productFacts, [])
  input.allocations[0].product = 'p2'; assert.throws(() => storageReviewInput(period(), input), /missing_facts/)
  input.facts.p2 = { unitStoragePrice: '0', approved: true }; const result = storageReviewInput(period(), input); assert.equal(result.productFacts[0].approved, undefined); assert.equal(result.productFacts[0].unitStoragePrice, '0')
})
test('dimensions must be positive and recovered approvals require their dedicated permission', () => {
  const p = period(), f = form(); p.context.client.storageType = 'Volumetric'; f.allocations[0].product = 'p2'; f.facts.p2 = { volume: '0' }; assert.throws(() => storageReviewInput(p, f), /positive_facts/)
  f.facts.p2.volume = '0.001'; assert.equal(storageReviewInput(p, f).productFacts[0].volume, '0.001')
  assert.equal(financeRetryPermission({ url: '/warehouse/finance/storage-reviews/id/actions', data: { action: 'approve' } }), 'warehouse:finance:approveStorageReview')
  assert.equal(financeRetryPermission({ url: '/warehouse/finance/storage-reviews', data: {} }), 'warehouse:finance:edit')
})
