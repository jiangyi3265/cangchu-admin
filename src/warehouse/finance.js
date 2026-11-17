import { ref, toRaw } from 'vue'
import request from '@/utils/request'
import { rejectedBeforeCommit } from './inventory'
import { decimalInput } from './decimal.js'
export { decimalInput }

export const financePending = ref(null)
export const financePendingError = ref('')
export const financeBusy = ref(false)
export const financeRevision = ref(0)
let actorId = ''
const key = () => 'warehouse.finance.pending.' + actorId
function validateOperation(value) {
  if (!value || !['post','put','delete'].includes(value.method) || !/^\/warehouse\/finance\/[A-Za-z0-9_/-]+$/.test(value.url) || !value.label) throw Error('invalid_finance_request')
  const id = value.method === 'delete' ? value.params?.requestId : value.data?.requestId
  if (typeof id !== 'string' || !id) throw Error('missing_request_id')
  return value
}
export function initializeFinance(actor) {
  financePending.value = null
  actorId = String(actor ?? '')
  if (!actorId) { financePendingError.value = 'missing_actor'; return }
  try { const value=sessionStorage.getItem(key());financePending.value=value?validateOperation(JSON.parse(value)):null;financePendingError.value='' }
  catch { financePendingError.value='invalid_pending' }
}
export async function submitFinance(operation, retry = false) {
  if (!actorId || financeBusy.value || financePendingError.value || financePending.value && !retry) throw Error('finance_pending')
  const owner=actorId,storageKey=key()
  if (!retry) { const next=validateOperation(structuredClone(toRaw(operation)));sessionStorage.setItem(storageKey,JSON.stringify(next));financePending.value=next }
  if (!financePending.value) throw Error('missing_pending')
  financeBusy.value=true
  try {
    const current=structuredClone(toRaw(financePending.value)),result=await request({...current,headers:{repeatSubmit:false}})
    sessionStorage.removeItem(storageKey);if(actorId===owner){financePending.value=null;financeRevision.value++}
    return result
  } catch(e) {
    if (!retry && rejectedBeforeCommit(e)) { sessionStorage.removeItem(storageKey);if(actorId===owner)financePending.value=null }
    throw e
  } finally { financeBusy.value=false }
}
const field = (key,label,labelEn,type='text',extra={}) => ({key,label,labelEn,type,...extra})
const client = field('client','客户','Client','ref',{source:'clients',required:true})
const active = field('active','启用','Active','toggle',{default:true})
const money = (key,label,labelEn,extra={}) => field(key,label,labelEn,'decimal',{min:0,...extra})
const tierFields = [money('minimumCharge','最低收费','Minimum charge',{default:0}),field('splitTiers','按阶梯分段计费','Split across tiers','toggle',{default:false}),active]
export const financeRuleKinds = [
  {kind:'orderTiers',label:'订单量阶梯价',labelEn:'Order volume tiers',fields:[client,...tierFields]},
  {kind:'channelTiers',label:'渠道阶梯价',labelEn:'Channel tiers',fields:[client,field('channel','渠道','Channel','refName',{required:true,source:'channels'}),field('basis','计费依据','Basis','select',{options:['Orders','Units'],default:'Orders'}),...tierFields]},
  {kind:'warehousePrices',label:'仓库拣货费',labelEn:'Warehouse pick rates',fields:[client,field('warehouse','仓库','Warehouse','ref',{source:'warehouses',required:true}),field('product','商品（选填）','Product (optional)','ref',{source:'products'}),money('firstPick','首件拣货费','First pick'),money('additionalPick','续件拣货费','Additional pick'),active]},
  {kind:'locationPrices',label:'库位仓储单价',labelEn:'Location storage rates',fields:[{...client,required:false,label:'客户（留空为公共价格，仅管理员可设）',labelEn:'Client (empty: shared rate, admin only)'},field('locationType','库位类型','Location type','refName',{source:'locationTypes',required:true}),field('frequency','频率','Frequency','select',{options:['Daily','Weekly','Monthly'],default:'Daily'}),money('cost','单价','Rate',{required:true}),active]},
  {kind:'recurring',label:'周期收费规则',labelEn:'Recurring charges',fields:[client,field('warehouse','仓库（选填）','Warehouse (optional)','ref',{source:'warehouses'}),field('description','描述','Description','text',{required:true}),field('type','费用类型','Charge type','select',{options:['Additional','Storage','Rework','Collection'],default:'Additional'}),money('amount','单价','Rate',{default:0,required:true}),money('quantity','数量','Quantity',{default:1}),field('frequency','频率','Frequency','select',{options:['Daily','Weekly','Monthly'],default:'Daily'}),field('notes','备注','Notes','textarea'),active]},
  {kind:'invoiceTypes',label:'账单项目类型','labelEn':'Invoice item types',admin:true,fields:[field('name','名称','Name','text',{required:true}),field('chargeType','费用类型','Charge type','select',{options:['Additional','Picking','Storage','Goods In','Collection','Rework'],default:'Additional'}),money('vatRate','增值税率（%）','VAT rate (%)',{default:0,max:100}),active]}
]
export function financeRulePayload(definition, values, version, requestId) {
  const payload={requestId}
  for(const item of definition.fields) if(values[item.key]!==undefined && values[item.key]!==null && !(item.type==='decimal' && values[item.key]==='')) { payload[item.key]=item.type==='decimal'?decimalInput(values[item.key]):values[item.key];if(item.max!==undefined&&Number(payload[item.key])>item.max)throw Error('invalid_decimal') }
  if(definition.kind.endsWith('Tiers')){
    if((values.tiers||[]).some(item=>item.from===null||item.from===undefined||item.from===''||item.rate===null||item.rate===undefined||item.rate===''))throw Error('invalid_tiers')
    const tiers=(values.tiers||[]).map(item=>({from:Number(item.from),rate:decimalInput(item.rate)})).sort((a,b)=>a.from-b.from)
    if(!tiers.length||tiers.length>100||tiers[0].from!==1||tiers.some(item=>!Number.isSafeInteger(item.from)||item.from<1)||new Set(tiers.map(item=>item.from)).size!==tiers.length)throw Error('invalid_tiers')
    payload.tiers=tiers;if(definition.kind==='orderTiers')payload.basis='Orders'
  }
  if(version!==undefined)payload._version=version
  return payload
}
