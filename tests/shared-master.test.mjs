import test from 'node:test'
import assert from 'node:assert/strict'
import { orderPayload, blankOrder } from '../src/warehouse/orders.js'
import { forecastPayload, blankInbound } from '../src/warehouse/inbound.js'

test('manual order submits the selected channel identity without accepting forged source or name',()=>{
 const form={...blankOrder(),channelId:'channel-1',channel:'Forged',source:'API',lines:[{product:'p1',quantity:1}]}
 const payload=orderPayload(form,{requestId:'original-request'})
 assert.equal(payload.channelId,'channel-1');assert.equal(payload.source,undefined);assert.equal(payload.channel,undefined)
 assert.equal(orderPayload({...form,channelId:''}).channelId,'')
})
test('supplier association can be explicitly cleared while original request and business lines are retained',()=>{
 const form={...blankInbound(),client:'c1',warehouse:'w1',reference:'ASN',supplierId:'s1',supplierName:'Snapshot',lines:[{product:'p1',quantity:2}]}
 const payload=forecastPayload(form,'original-request',3)
 assert.equal(payload.supplierId,'s1');assert.equal(payload.supplierName,undefined);assert.equal(payload._version,3);assert.equal(payload.requestId,'original-request')
 assert.deepEqual(forecastPayload({...form,supplierId:''},'retry',3).lines,payload.lines)
 assert.equal(forecastPayload({...form,supplierId:''},'retry',3).supplierId,'')
})
