import test from 'node:test'
import assert from 'node:assert/strict'
import { importPendingKey, readImportPending, importFileProblem, importChanges } from '../src/warehouse/master-transfer.js'
test('pending import preserves actor, kind, batch, version and original nonce across reload',()=>{
  const p={kind:'products',id:'preview',payload:{action:'commit',requestId:'same-nonce',_version:1}}
  const storage={getItem:key=>key===importPendingKey(7,'products')?JSON.stringify(p):null}
  assert.deepEqual(readImportPending(storage,7,'products'),p);assert.equal(readImportPending(storage,8,'products'),null)
  assert.throws(()=>readImportPending({getItem:()=>JSON.stringify({...p,kind:'clients'})},7,'products'))
})
test('invalid identities, operations and file types cannot be submitted as an import',()=>{
  for(const payload of [{action:'delete',requestId:'n',_version:1},{action:'commit',requestId:'n',_version:0},{action:'commit',_version:1}])assert.throws(()=>readImportPending({getItem:()=>JSON.stringify({kind:'products',id:'p',payload})},7,'products'))
  assert.equal(importFileProblem({name:'data.xlsx',size:2048}),'');assert.equal(importFileProblem({name:'data.xlsm',size:2048}),'file_type');assert.equal(importFileProblem({name:'data.csv',size:3*1024*1024}),'file_size')
})
test('preview changes retain exact server decimal strings and explicit empty values',()=>{
  assert.deepEqual(importChanges({changed:['rate','barcode'],before:{rate:'0.123456789',barcode:'0001'},after:{rate:'0',barcode:''}}),[{key:'rate',before:'0.123456789',after:'0'},{key:'barcode',before:'0001',after:''}])
})
