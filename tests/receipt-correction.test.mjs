import test from 'node:test'
import assert from 'node:assert/strict'
import { correctionInput, correctionDecision } from '../src/warehouse/receipt-correction.js'
import { readPendingInbound, inboundPendingKey, inboundClosable } from '../src/warehouse/inbound.js'
const context={receipt:{id:'receipt-line'},uncorrected:5,layers:[{id:'one',remaining:3,reserved:2},{id:'two',remaining:2,reserved:0}]}
test('correction quantities use only the selected original sources and exclude reservations',()=>{
  const form={quantities:{one:2,two:0},reason:'Count checked',evidenceReference:'Signed count'}
  assert.throws(()=>correctionInput({_version:4},context,form),/correction_quantity/)
  form.quantities={one:1,two:2,foreign:100};const result=correctionInput({_version:4},context,form);assert.deepEqual(result.allocations,[{layer:'one',quantity:1},{layer:'two',quantity:2}]);assert.equal(result.receiptLine,'receipt-line')
})
test('execution needs explicit recording-error confirmation; cancellation does not imply a stock movement',()=>{
  const row={id:'approval',_version:1,status:'APPROVED'}
  assert.throws(()=>correctionDecision(row,'executeCorrection',{reason:'Checked'},'nonce'),/correction_confirmation/)
  assert.equal(correctionDecision(row,'executeCorrection',{reason:'Checked',confirmRecordedError:true},'nonce').confirmRecordedError,true)
  assert.equal(correctionDecision(row,'cancelCorrection',{reason:'Withdrawn'},'nonce').confirmRecordedError,undefined)
})
test('pending correction survives reload with its original approval and nonce; all-corrected ASN can close with approval',()=>{
  const operation={type:'executeCorrection',id:'asn',payload:{requestId:'nonce',correction:'approval',_version:1,confirmRecordedError:true,reason:'Checked'}}
  const storage={getItem:key=>key===inboundPendingKey(8)?JSON.stringify(operation):null}
  assert.deepEqual(readPendingInbound(storage,8),operation)
  assert.equal(inboundClosable({workflow:'JAVA_ASN_V1',status:'NEW',receipts:[{}]}),true)
})
test('damaged pending correction cannot be replayed without its approval identity and revision',()=>{
  for(const payload of [{requestId:'nonce'},{requestId:'nonce',correction:' '},{requestId:'nonce',correction:'approval',_version:0}]){
    assert.throws(()=>readPendingInbound({getItem:()=>JSON.stringify({type:'executeCorrection',id:'asn',payload})},8),/invalid_pending/)
  }
})
