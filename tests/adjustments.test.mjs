import test from 'node:test'
import assert from 'node:assert/strict'
import {moneyText,adjustmentPlanInput,financeRetryPermission,creditNoteHtml} from '../src/warehouse/adjustment-input.js'

test('review input preserves original precision and excludes rate, balances and client fields',()=>{
 const form={reason:'Verified',items:[{id:'units',selected:true,quantity:'2',quantityScale:0,decision:'reduce',rate:999},{id:'hours',selected:true,quantity:'0.125',quantityScale:3,decision:'retain'},{id:'ignored',selected:false,quantity:'bad'}],issueDate:'2026-11-16',reconsiderationOf:['prior'],reconsiderationReason:'New source',client:'wrong'}
 const result=adjustmentPlanInput({_version:3},form)
 assert.deepEqual(result,{_version:3,decisions:[{component:'units',quantity:'2',decision:'reduce'},{component:'hours',quantity:'0.125',decision:'retain'}],reason:'Verified',issueDate:'2026-11-16',reconsiderationReason:'New source',reconsiderationOf:['prior']})
 form.items[0].quantity='0.5';assert.throws(()=>adjustmentPlanInput({_version:3},form))
})
test('empty, negative and overprecision adjustment inputs cannot be submitted',()=>{
 assert.throws(()=>adjustmentPlanInput({_version:1},{items:[]}))
 for(const quantity of ['',null,undefined,false,'-1','1.234','1e4'])assert.throws(()=>adjustmentPlanInput({_version:1},{items:[{id:'amount',selected:true,quantity,quantityScale:2,decision:'reduce'}]}))
})
test('retry checks approval or execution permission independently of financial editing',()=>{
 for(const action of ['approve','revoke'])assert.equal(financeRetryPermission({url:'/warehouse/finance/adjustments/a/actions',data:{action}}),'warehouse:finance:approveAdjustment')
 assert.equal(financeRetryPermission({url:'/warehouse/finance/adjustments/a/actions',data:{action:'execute'}}),'warehouse:finance:executeAdjustment')
 assert.equal(financeRetryPermission({url:'/warehouse/finance/adjustments/a/actions',data:{action:'cancel'}}),'warehouse:finance:edit')
 assert.equal(financeRetryPermission({url:'/warehouse/finance/invoices/a/actions',data:{action:'confirm'}}),'warehouse:finance:edit')
})
test('credit print escapes all untrusted content, uses original figures and distinguishes a note from payment',()=>{
 const hostile='<img src=x onerror="alert(1)">',note={number:hostile,reason:hostile,originalInvoiceReference:hostile,currency:'GBP',net:'0.01',tax:'0.00',amount:'0.01',vatRate:'20',decisions:[{description:hostile,quantity:'2',rate:'0.125',decision:'reduce',basis:'SOURCE_QUANTITY'}],profile:{seller:{name:hostile,address:hostile,taxId:hostile},buyer:{name:hostile,address:hostile,taxId:hostile},issueDate:'2026-11-16'}}
 for(const english of [false,true]){const html=creditNoteHtml(note,english);assert(!html.includes('<img'));assert(html.includes('&lt;img'));assert(html.includes('0.01'));assert(html.includes(english?'cash refund':'现金退款'));assert(!/https?:\/\//.test(html));assert.equal((html.match(/<script/g)||[]).length,0)}
})

test('display pads exact money without converting through floating point',()=>{assert.equal(moneyText('9999999999999999999999.9'),'9999999999999999999999.90');assert.equal(moneyText('2.4'),'2.40');assert.equal(moneyText('0'),'0.00');assert.equal(moneyText('0.125'),'0.125');assert.equal(moneyText(null),'—')})
