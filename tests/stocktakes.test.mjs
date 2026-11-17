import test from 'node:test'
import assert from 'node:assert/strict'
import { startCountPayload, countPayload, foundPayload, countPendingKey, readPendingCount } from '../src/warehouse/stocktakes.js'
const head={id:'s',status:'COUNTING',_version:2,locations:['l']}
test('starting requires an explicit distinct location scope',()=>{
  assert.deepEqual(startCountPayload({client:'c',warehouse:'w',reference:' Count ',locations:['l']},'r'),{requestId:'r',client:'c',warehouse:'w',reference:'Count',notes:'',locations:['l']})
  for(const locations of [[],['l','l'],Array.from({length:101},(_,i)=>String(i))])assert.throws(()=>startCountPayload({client:'c',warehouse:'w',reference:'r',locations},'r'),/count_locations/)
})
test('blank count is never silently posted as zero; zero shortage needs a reason',()=>{
  for(const counted of [null,undefined,'',-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>countPayload(head,[{id:'l',expected:3,counted,reason:'Test'}],'r'),/count_quantity/)
  assert.throws(()=>countPayload(head,[{id:'l',expected:3,counted:0,reason:''}],'r'),/count_reason/)
  assert.equal(countPayload(head,[{id:'l',expected:3,counted:0,reason:'Empty'}],'r').lines[0].counted,0)
})
test('counts exclude mutable snapshot or adjustment fields',()=>{
  const payload=countPayload(head,[{id:'l',expected:5,counted:4,reason:'Missing',inventoryId:'tampered',result:{delta:9}}],'r')
  assert.deepEqual(payload,{requestId:'r',_version:2,action:'count',lines:[{id:'l',counted:4,reason:'Missing'}]})
  assert.throws(()=>countPayload({...head,status:'REVIEW'},payload.lines,'r'),/count_lines/)
  assert.throws(()=>countPayload(head,Array(201).fill({id:'l',expected:1,counted:1}),'r'),/count_lines/)
})
test('found goods require owned locations, positive quantity and serial identity',()=>{
  const form={product:'p',location:'l',counted:1,serial:'0001',batch:'LOT',reason:'Found'}
  assert.equal(foundPayload(head,form,'r').serial,'0001')
  assert.throws(()=>foundPayload(head,{...form,location:'other'},'r'),/count_found/)
  assert.throws(()=>foundPayload(head,{...form,counted:0},'r'),/count_found/)
  assert.throws(()=>foundPayload(head,{...form,counted:2},'r'),/count_serial/)
})
test('per-operator recovery preserves version and nonce for approval retry',()=>{
  const p={type:'action',id:'s',payload:{requestId:'r',_version:3,action:'approve',reason:'Checked',selfApproval:true}}
  const storage={getItem:key=>key===countPendingKey(7)?JSON.stringify(p):null}
  assert.deepEqual(readPendingCount(storage,7),p);assert.equal(readPendingCount(storage,8),null)
  delete p.payload._version;assert.throws(()=>readPendingCount(storage,7),/invalid_pending/)
})
