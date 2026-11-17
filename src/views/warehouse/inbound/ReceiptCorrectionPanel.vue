<template>
  <section v-if="asn.receipts?.length" class="receipt-corrections">
    <h3>{{ t('收货记录更正', 'Receipt record corrections') }}</h3>
    <p class="help">{{ t('用于收货数量多录。原收货和费用记录保留，只扣除核实后仍在库且未预留的多录数量，费用会转财务复核。实际退供、报废或已发货的问题请走对应业务流程。', 'Correct quantities recorded in excess. Original receipts and fees are retained. Only verified stock still on hand and unreserved can be removed; fees go to financial review. Use the corresponding workflow for physical supplier returns, disposal or shipped goods.') }}</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-form v-if="permitted('approveCorrection')" label-position="top" :disabled="blocked || busy" @submit.prevent="preview">
      <el-form-item :label="t('需要更正的原收货行', 'Original receipt line')"><el-select v-model="receiptLine" :aria-label="t('需要更正的原收货行', 'Original receipt line')" class="receipt-select" @change="resetContext"><el-option v-for="row in asn.receipts" :key="row.receiptLineId" :value="row.receiptLineId" :label="row.sku + ' · ' + row.quantity + ' · ' + row.receivedAt + ' · ' + row.locationName" /></el-select></el-form-item>
      <el-button :disabled="!receiptLine" :loading="busy" @click="loadContext">{{ t('追踪当前来源库存', 'Trace current source stock') }}</el-button>
      <template v-if="context">
        <p>{{ t('原数量 / 已更正 / 尚未更正', 'Original / corrected / uncorrected') }}: {{ context.receipt.quantity }} / {{ context.corrected }} / {{ context.uncorrected }}</p>
        <el-table :data="context.layers" border><el-table-column prop="warehouse_name" :label="t('仓库', 'Warehouse')" min-width="160" /><el-table-column prop="location_name" :label="t('当前库位', 'Current location')" min-width="170" /><el-table-column prop="remaining" :label="t('在库', 'On hand')" min-width="90" /><el-table-column prop="reserved" :label="t('订单预留', 'Reserved')" min-width="115" /><el-table-column :label="t('本次扣除多录数量', 'Excess quantity to remove')" min-width="210"><template #default="{row,$index}"><el-input-number v-model="form.quantities[row.id]" :min="0" :max="Math.max(0,row.remaining-row.reserved)" :precision="0" :disabled="row.remaining===row.reserved" :aria-label="t('更正数量', 'Correction quantity') + ' ' + ($index+1)" /></template></el-table-column></el-table>
        <div class="form-grid"><el-form-item :label="t('更正凭据', 'Correction evidence')" required><el-input v-model="form.evidenceReference" maxlength="200" :aria-label="t('更正凭据', 'Correction evidence')" /></el-form-item><el-form-item :label="t('多录原因', 'Recording error reason')" required><el-input v-model="form.reason" type="textarea" maxlength="500" :aria-label="t('多录原因', 'Recording error reason')" /></el-form-item></div>
        <el-button type="primary" @click="preview">{{ t('预览更正', 'Preview correction') }}</el-button>
        <div v-if="quote" class="approval"><p>{{ t('确认扣除多录数量', 'Verified excess quantity') }}: {{ quote.quantity }} {{ t('件；批准后由另一人执行。', 'units; another person must execute after approval.') }}</p><el-button type="warning" @click="approve">{{ t('批准此收货更正', 'Approve receipt correction') }}</el-button></div>
      </template>
    </el-form>
    <el-table :data="asn.receiptCorrections || []" border class="history"><el-table-column prop="createdAt" :label="t('批准时间（UTC）', 'Approved at (UTC)')" min-width="220" /><el-table-column prop="quantity" :label="t('更正数量', 'Quantity')" min-width="110" /><el-table-column :label="t('状态', 'Status')" min-width="130"><template #default="{row}">{{ statusLabel(row.status) }}</template></el-table-column><el-table-column prop="reason" :label="t('原因', 'Reason')" min-width="210" /><el-table-column min-width="100"><template #default="{row}"><el-button link type="primary" :disabled="busy || blocked" @click="read(row)">{{ t('查看更正', 'View correction') }}</el-button></template></el-table-column></el-table>
    <template v-if="selected">
      <h4>{{ t('更正详情', 'Correction details') }}</h4><p>{{ selected.approval.planInput.evidenceReference }} · {{ selected.approval.planInput.reason }}</p><p>{{ t('批准人 / 状态', 'Approved by / status') }}: {{ selected.approvedBy }} / {{ statusLabel(selected.status) }}</p>
      <el-table :data="selected.approval.allocations" border><el-table-column :label="t('来源库位', 'Source location')" min-width="180"><template #default="{row}">{{ selected.approval.source.layers.find(l=>l.id===row.layer)?.location_name || row.location }}</template></el-table-column><el-table-column prop="quantity" :label="t('已批准更正数量', 'Approved correction quantity')" min-width="180" /></el-table>
      <el-form v-if="selected.status === 'APPROVED'" label-position="top" :disabled="blocked || busy" class="decision">
        <el-form-item :label="t('执行或撤销说明', 'Execution or cancellation reason')" required><el-input v-model="decision.reason" type="textarea" maxlength="500" :aria-label="t('执行或撤销说明', 'Execution or cancellation reason')" /></el-form-item>
        <el-checkbox v-if="canExecute" v-model="decision.confirmRecordedError">{{ t('已核实这是收货记录多录，确认扣除上述数量', 'Verified a receipt recording error; remove the approved quantity') }}</el-checkbox>
        <div class="actions"><el-button v-if="canExecute" type="danger" @click="act('executeCorrection')">{{ t('执行已批准更正', 'Execute approved correction') }}</el-button><el-button v-if="permitted('cancelCorrection')" @click="act('cancelCorrection')">{{ t('撤销未执行更正', 'Cancel unused correction') }}</el-button></div>
        <p v-if="Number(selected.approvedBy) === Number(user.id)" class="help">{{ t('批准人不能执行自己的更正，请交由另一人核对。', 'The approver cannot execute this correction. Ask another person to verify it.') }}</p>
      </el-form>
      <p v-else>{{ selected.result.reason }} · {{ selected.result.at }}</p>
    </template>
  </section>
</template>
<script setup>
import { ref, computed, watch, toRaw } from 'vue'
import request from '@/utils/request'
import useUserStore from '@/store/modules/user'
import { bilingual as t } from '@/warehouse/i18n'
import { correctionInput, correctionDecision } from '@/warehouse/receipt-correction'
const props=defineProps({asn:Object,blocked:Boolean,permitted:Function}),emit=defineEmits(['submit']),user=useUserStore()
const receiptLine=ref(''),context=ref(null),form=ref({quantities:{},reason:'',evidenceReference:''}),quote=ref(null),quotedInput=ref(null),selected=ref(null),decision=ref({reason:'',confirmRecordedError:false}),busy=ref(false),error=ref('')
const base=computed(()=>'/warehouse/inbound/'+props.asn.id+'/corrections'),canExecute=computed(()=>props.permitted('executeCorrection')&&Number(selected.value?.approvedBy)!==Number(user.id))
const statusLabel=status=>t(({APPROVED:'待执行',EXECUTED:'已执行',CANCELLED:'已撤销'})[status],({APPROVED:'Awaiting execution',EXECUTED:'Executed',CANCELLED:'Cancelled'})[status])
let generation=0
function resetContext(){generation++;context.value=null;quote.value=null;quotedInput.value=null;form.value={quantities:{},reason:'',evidenceReference:''}}
async function loadContext(){if(props.blocked||busy.value)return;const ticket=++generation;busy.value=true;error.value='';try{const r=await request({url:base.value+'/context',params:{receiptLine:receiptLine.value}});if(ticket===generation){context.value=r.data;form.value.quantities=Object.fromEntries(r.data.layers.map(row=>[row.id,0]))}}catch(e){error.value=e.message}finally{busy.value=false}}
async function preview(){if(props.blocked||busy.value)return;error.value='';try{const input=correctionInput(props.asn,context.value,form.value);busy.value=true;const r=await request({url:base.value+'/preview',method:'post',data:input,headers:{repeatSubmit:false}});quote.value=r.data;quotedInput.value=input}catch(e){error.value=e.response?e.message:t('请核对更正数量、原因和凭据。','Check correction quantities, reason and evidence.')}finally{busy.value=false}}
function approve(){if(props.blocked||busy.value||!quote.value)return;emit('submit','approveCorrection',props.asn.id,{...structuredClone(toRaw(quotedInput.value)),requestId:crypto.randomUUID(),quoteHash:quote.value.quoteHash})}
async function read(row){if(props.blocked||busy.value)return;busy.value=true;error.value='';try{selected.value=(await request({url:base.value+'/'+row.id})).data;decision.value={reason:'',confirmRecordedError:false}}catch(e){error.value=e.message}finally{busy.value=false}}
function act(action){try{emit('submit',action,props.asn.id,correctionDecision(selected.value,action,decision.value,crypto.randomUUID()))}catch{error.value=t('请填写说明；执行前还需确认已核实多录数量。','Enter a reason and confirm the verified recording error before execution.')}}
watch(form,()=>{quote.value=null;quotedInput.value=null},{deep:true})
watch(()=>props.asn,()=>{resetContext();selected.value=null})
</script>
<style scoped>
.receipt-corrections{margin-top:28px;min-width:0}.help{max-width:75ch;line-height:1.65;color:var(--el-text-color-regular)}h3{font-size:16px}.receipt-select{width:min(680px,100%)}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;margin-top:20px}.history{margin-top:24px}.decision{max-width:720px;margin-top:18px}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}.actions .el-button{margin-left:0}.approval{margin:18px 0}:deep(.el-checkbox){white-space:normal;height:auto;line-height:1.6}:deep(.el-checkbox__label){white-space:normal}.el-alert{margin-bottom:16px}@media(max-width:600px){.form-grid{grid-template-columns:1fr;gap:0}}
</style>
