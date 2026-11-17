import {decimalInput} from './decimal.js'

export function moneyText(value){
  if(value===null||value===undefined||value==='')return '—'
  const text=String(value),match=text.match(/^(-?\d+)(?:\.(\d{0,2}))?$/)
  return match?match[1]+'.'+(match[2]||'').padEnd(2,'0'):text
}

export function adjustmentPlanInput(detail,form){
  const decisions=[]
  for(const row of form.items||[])if(row.selected)decisions.push({component:row.id,quantity:decimalInput(row.quantity,row.quantityScale),decision:row.decision})
  if(!decisions.length)throw Error('select_adjustment_items')
  const input={_version:detail._version,decisions,reason:form.reason||''}
  for(const key of ['issueDate','taxPointDate','accountingPeriod','reconsiderationReason'])if(form[key])input[key]=form[key]
  if(form.reconsiderationOf?.length)input.reconsiderationOf=[...form.reconsiderationOf]
  return input
}
export function financeRetryPermission(operation){
  if(operation?.url?.startsWith('/warehouse/finance/storage-reviews/')&&operation.url.endsWith('/actions'))return 'warehouse:finance:approveStorageReview'
  if(operation?.url?.startsWith('/warehouse/finance/adjustments/')&&operation.url.endsWith('/actions')){
    if(['approve','revoke'].includes(operation.data?.action))return 'warehouse:finance:approveAdjustment'
    if(operation.data?.action==='execute')return 'warehouse:finance:executeAdjustment'
  }
  return 'warehouse:finance:edit'
}
export function creditNoteHtml(note,english=false){
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))
  const t=(zh,en)=>english?en:zh,p=note.profile||{},seller=p.seller||{},buyer=p.buyer||{}
  const components=(note.decisions||[]).map(row=>`<tr><td>${escape(row.description)}</td><td>${escape(row.decision==='reduce'?t('核减','Reduce'):t('保留','Retain'))}</td><td>${escape(row.quantity)} ${escape(row.basis==='NET_AMOUNT'?note.currency:'')}</td><td>${escape(row.rate)}</td></tr>`).join('')
  const detail=components?`<table><thead><tr><th>${escape(t('原收费项目','Original component'))}</th><th>${escape(t('决定','Decision'))}</th><th>${escape(t('数量 / 税前金额','Quantity / net amount'))}</th><th>${escape(t('原单价','Original rate'))}</th></tr></thead><tbody>${components}</tbody></table>`:''
  const profile=(name,row)=>`<section><h2>${escape(name)}</h2><strong>${escape(row.name)}</strong><p>${escape(row.address)}</p><p>${escape(t('税务编号','Tax ID'))}: ${escape(row.taxId)}</p></section>`
  return `<!doctype html><html lang="${english?'en':'zh-CN'}"><head><meta charset="utf-8"><title>${escape(note.number)}</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#253044;max-width:900px;margin:36px auto;padding:20px}h1{font-size:28px}h2{font-size:16px}.parties{display:grid;grid-template-columns:1fr 1fr;gap:40px}p{white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{border:1px solid #cbd1db;padding:10px;text-align:left}.total{text-align:right;font-size:20px}@media print{body{margin:0;padding:0}button{display:none}}@media(max-width:550px){.parties{grid-template-columns:1fr;gap:10px}}</style></head><body><button onclick="window.print()">${escape(t('打印 / 另存为 PDF','Print / Save as PDF'))}</button><h1>${escape(t('贷项通知','Credit note'))} ${escape(note.number)}</h1><p>${escape(t('原账单','Original invoice'))}: ${escape(note.originalInvoiceReference)}<br>${escape(t('开具日期','Issue date'))}: ${escape(p.issueDate)}<br>${escape(t('税点日期','Tax point date'))}: ${escape(p.taxPointDate)}<br>${escape(t('会计期间','Accounting period'))}: ${escape(p.accountingPeriod)}</p><div class="parties">${profile(t('开具方','Seller'),seller)}${profile(t('客户','Buyer'),buyer)}</div><h2>${escape(t('调整原因','Reason'))}</h2><p>${escape(note.reason)}</p>${detail}<table><thead><tr><th>${escape(t('币种','Currency'))}</th><th>${escape(t('税前核减','Net credit'))}</th><th>${escape(t('原税率','Original VAT rate'))}</th><th>${escape(t('税额核减','Tax credit'))}</th></tr></thead><tbody><tr><td>${escape(note.currency)}</td><td>${escape(moneyText(note.net))}</td><td>${escape(note.vatRate)}%</td><td>${escape(moneyText(note.tax))}</td></tr></tbody></table><p class="total">${escape(t('贷项合计','Total credit'))}: ${escape(note.currency)} ${escape(moneyText(note.amount))}</p><p>${escape(t('本通知核减原账单应收，不表示已完成现金退款或会计平台同步。','This note reduces the original invoice receivable. It does not confirm a cash refund or accounting-platform synchronization.'))}</p><p>${escape(t('调整记录','Adjustment reference'))}: ${escape(note.adjustmentId)}</p></body></html>`
}
