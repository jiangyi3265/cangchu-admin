import test from 'node:test'
import assert from 'node:assert/strict'
import { workPayload, workBlocksAction, packageRemainder } from '../src/warehouse/order-work.js'
import { readPendingOrder, orderPendingKey } from '../src/warehouse/orders.js'

const identity = {requestId:'request-1',version:2}
const box = () => ({action:'pack',packageCode:' BOX-1 ',weightKg:'1.250',lengthCm:'30.00',widthCm:'20',heightCm:'10',lines:[{allocationId:'a',quantity:1,secret:'ignored'}]})
test('scan preserves leading zeros and excludes untrusted quantities', () => {
  assert.deepEqual(workPayload({action:'scan',allocationId:'a',barcode:' 000123 ',quantity:99,status:'DESPATCHED'},identity),{action:'scan',requestId:'request-1',_version:2,allocationId:'a',barcode:'000123',serial:''})
  assert.throws(()=>workPayload({action:'scan',barcode:'x'},identity))
})
test('package quantities and measurement precision survive serialisation', () => {
  const result=workPayload(box(),identity)
  assert.equal(result.weightKg,'1.250');assert.equal(result.lengthCm,'30.00');assert.equal(result.packageCode,'BOX-1')
  assert.deepEqual(result.lines,[{allocationId:'a',quantity:1}]);assert.equal(result.notes,'')
})
test('invalid measurements and excessive quantities are rejected before posting', () => {
  for(const value of ['0','-1','1.0001','100001','1e3','NaN']) assert.throws(()=>workPayload({...box(),weightKg:value},identity),/work_measurements/)
  for(const value of [0,1.5,-1,10000001]) assert.throws(()=>workPayload({...box(),lines:[{allocationId:'a',quantity:value}]},identity),/work_lines/)
  assert.throws(()=>workPayload({...box(),lines:[{allocationId:'a',quantity:1},{allocationId:'a',quantity:2}]},identity),/work_lines/)
  assert.throws(()=>workPayload({...box(),lines:[]},identity),/work_lines/)
})
test('undo requires an evidence id and reason, every request requires a version', () => {
  assert.deepEqual(workPayload({action:'unscan',scanId:'s',reason:' Correction '},identity),{action:'unscan',scanId:'s',reason:'Correction',requestId:'request-1',_version:2})
  for(const input of [{action:'unscan',reason:'why'},{action:'unpack',packageId:'p',reason:''},{action:'unknown'}]) assert.throws(()=>workPayload(input,identity))
  assert.throws(()=>workPayload(box(),{requestId:'r'}),/work_version/)
})
test('mandatory order buttons follow distinct scanning and packing completion', () => {
  const order={scanRequired:true,work:{scanningComplete:true,packingComplete:false}}
  assert.equal(workBlocksAction(order,'pick'),false);assert.equal(workBlocksAction(order,'despatch'),true)
  assert.equal(workBlocksAction(order,'cancel'),false);assert.equal(workBlocksAction({...order,scanRequired:false},'despatch'),false)
  assert.equal(workBlocksAction({scanRequired:true},'pick'),true)
})
test('box defaults exclude released, consumed, and already packed allocations', () => {
  const rows=[{id:'a',state:'RESERVED',packRemaining:2},{id:'b',state:'RELEASED',packRemaining:3},{id:'c',state:'RESERVED',packRemaining:0}]
  const result=packageRemainder({work:{progress:rows}});assert.equal(result.length,1);assert.equal(result[0].quantity,2);result[0].quantity=1;assert.equal(rows[0].packRemaining,2)
})
test('unknown work result survives reload with original nonce, payload and version', () => {
  const pending={type:'work',id:'order',payload:workPayload(box(),identity)}
  const storage={getItem:key=>key===orderPendingKey(7)?JSON.stringify(pending):null}
  assert.deepEqual(readPendingOrder(storage,7),pending);assert.equal(readPendingOrder(storage,8),null)
  pending.payload._version=undefined;assert.throws(()=>readPendingOrder(storage,7),/invalid_pending/)
})
