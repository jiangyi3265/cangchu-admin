import test from 'node:test'
import assert from 'node:assert/strict'
import {acceptancePending,acceptancePendingKey} from '../src/warehouse/integration-acceptance.js'
import {orderActions,orderEditable} from '../src/warehouse/orders.js'

test('acceptance recovery keeps its original nonce, hash and source identity without recipient data',()=>{
 const value=acceptancePending({kind:'accept',connection:'store',item:'inbox',payload:{requestId:'r',reviewHash:'a'.repeat(64),recipient:'private',credentials:{consumerSecret:'never-store'}}})
 assert.deepEqual(value,{kind:'accept',connection:'store',item:'inbox',payload:{requestId:'r',reviewHash:'a'.repeat(64)}})
 assert.notEqual(acceptancePendingKey(1),acceptancePendingKey(2))
})
test('mapping and source policy recovery whitelist fields and retain the original version',()=>{
 const value=acceptancePending({kind:'mapping',connection:'store',item:'inbox',payload:{requestId:'r',_version:3,productId:'9007199254740993',variationId:'0',sku:'00001',product:'p',active:true,credentials:'excluded'}})
 assert.equal(value.payload._version,3);assert.equal(value.payload.productId,'9007199254740993');assert.equal(value.payload.sku,'00001');assert.equal(value.payload.credentials,undefined);assert.equal(value.item,'inbox')
 assert.throws(()=>acceptancePending({...value,payload:{...value.payload,_version:0.5}}))
})
test('source orders can enter warehouse work but cannot use manual editing or manual despatch',()=>{
 const order={workflow:'JAVA_WOO_V1',status:'NEW',allocations:[]}
 assert.deepEqual(orderActions(order),['allocate','hold','cancel']);assert.equal(orderEditable(order),false)
 assert.deepEqual(orderActions({...order,status:'PICKED'}),['cancel'])
 assert.deepEqual(orderActions({...order,workflow:'JAVA_MANUAL_V1',status:'PICKED'}),['despatch','cancel'])
})
