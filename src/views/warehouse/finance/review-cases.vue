<template>
  <section>
    <p class="help">{{ t('仓库执行收货更正后，原费用会进入此处待核对。核实后可发起费用调整，或填写原因保留原收费；这里不会自动退款或重开账单。', 'Executed receipt corrections enter this queue with their original charges. Review the evidence, then request an adjustment or record why the charge is retained. No refund or replacement invoice is automatic.') }}</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-form inline @submit.prevent="search"><el-form-item :label="t('待办状态', 'Review status')"><el-select v-model="query.status" :aria-label="t('待办状态', 'Review status')" style="width:210px"><el-option v-for="s in ['OPEN','LINKED','RETAINED','']" :key="s" :value="s" :label="statusLabel(s)" /></el-select></el-form-item><el-form-item><el-button type="primary" :loading="loading" @click="search">{{ t('查询待办', 'Search review queue') }}</el-button></el-form-item></el-form>
    <el-table :data="rows" v-loading="loading" border><el-table-column prop="createdAt" :label="t('产生时间（UTC）', 'Created at (UTC)')" min-width="220" /><el-table-column prop="reason" :label="t('仓库更正原因', 'Warehouse correction reason')" min-width="230" /><el-table-column prop="quantity" :label="t('更正数量', 'Corrected quantity')" min-width="140" /><el-table-column :label="t('状态', 'Status')" min-width="180"><template #default="{row}">{{ statusLabel(row.status) }}</template></el-table-column><el-table-column min-width="110"><template #default="{row}"><el-button link type="primary" :disabled="blocked" @click="open(row.id)">{{ t('核对费用', 'Review charge') }}</el-button></template></el-table-column></el-table>
    <pagination v-show="total>0" :total="total" v-model:page="query.pageNum" v-model:limit="query.pageSize" @pagination="load" />
    <el-drawer v-model="opened" :title="t('收货更正费用复核', 'Receipt correction charge review')" size="min(800px,100%)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
      <template v-if="detail">
        <el-descriptions :column="1" border><el-descriptions-item :label="t('仓库更正编号', 'Warehouse correction ID')">{{detail.correction}}</el-descriptions-item><el-descriptions-item :label="t('凭据', 'Evidence')">{{detail.evidenceReference}}</el-descriptions-item><el-descriptions-item :label="t('仓库原因 / 更正数量', 'Warehouse reason / quantity')">{{detail.reason}} / {{detail.quantity}}</el-descriptions-item><el-descriptions-item :label="t('原费用', 'Original charge')">{{detail.source.charge.description}}</el-descriptions-item><el-descriptions-item :label="t('原金额 / 剩余金额', 'Original / remaining net')">{{detail.source.charge.amount}} / {{detail.source.remainingNet}} {{detail.source.charge.currency}}</el-descriptions-item><el-descriptions-item :label="t('关联账单', 'Invoice')">{{detail.source.invoice?.id || '—'}}</el-descriptions-item><el-descriptions-item :label="t('处理状态', 'Review status')">{{statusLabel(detail.status)}}</el-descriptions-item></el-descriptions>
        <el-table :data="detail.source.components" border class="components"><el-table-column prop="description" :label="t('原计费项目', 'Original component')" min-width="230" /><el-table-column prop="quantity" :label="t('原数量', 'Original quantity')" min-width="120" /><el-table-column prop="rate" :label="t('原单价', 'Original rate')" min-width="120" /><el-table-column prop="remaining" :label="t('未核减数量', 'Remaining quantity')" min-width="140" /></el-table>
        <el-form v-if="detail.status==='OPEN' && canEdit" label-position="top" :disabled="blocked" class="decision"><el-form-item :label="t('财务核对说明', 'Financial review reason')" required><el-input v-model="reason" type="textarea" maxlength="500" :rows="3" :aria-label="t('财务核对说明', 'Financial review reason')" /></el-form-item><p class="help">{{t('创建调整申请后，还需在调账页核对各项是否核减，并由有权限的人员批准、执行。','After creating an adjustment, review each component in Adjustments and obtain the required approval and execution.')}}</p></el-form>
        <p v-else>{{detail.decisionReason}}</p>
      </template>
      <template #footer><div class="actions"><el-button :disabled="saving" @click="opened=false">{{t('关闭','Close')}}</el-button><el-button v-if="detail?.adjustment" :disabled="blocked" @click="openAdjustment(detail.adjustment)">{{t('打开关联调整','Open linked adjustment')}}</el-button><template v-if="detail?.status==='OPEN'&&canEdit"><el-button :disabled="blocked" @click="act('retain')">{{t('保留收费并记录原因','Retain charge with reason')}}</el-button><el-button type="primary" :disabled="blocked" :loading="saving" @click="act('adjust')">{{t('创建关联调整申请','Create linked adjustment')}}</el-button></template></div></template>
    </el-drawer>
  </section>
</template>
<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import request from '@/utils/request'
import auth from '@/plugins/auth'
import { bilingual as t } from '@/warehouse/i18n'
import { financePending, financePendingError, financeBusy, financeRevision, submitFinance } from '@/warehouse/finance'
const emit=defineEmits(['open-adjustment']),base='/warehouse/finance/review-cases',query=reactive({pageNum:1,pageSize:20,status:'OPEN'})
const rows=ref([]),total=ref(0),loading=ref(false),saving=ref(false),error=ref(''),detailError=ref(''),opened=ref(false),detail=ref(null),reason=ref('')
const canEdit=computed(()=>auth.hasPermi('warehouse:finance:edit')),blocked=computed(()=>saving.value||financeBusy.value||!!financePending.value||!!financePendingError.value)
const statusLabel=value=>t(({OPEN:'待核对',LINKED:'已关联调整',RETAINED:'已保留收费','':'全部'})[value],({OPEN:'Awaiting review',LINKED:'Adjustment linked',RETAINED:'Charge retained','':'All'})[value])
let generation=0,detailGeneration=0
async function load(){const ticket=++generation;loading.value=true;error.value='';try{const r=await request({url:base,params:{...query}});if(ticket===generation){rows.value=r.rows;total.value=r.total}}catch(e){error.value=e.message}finally{if(ticket===generation)loading.value=false}}
function openAdjustment(id){opened.value=false;emit('open-adjustment',id)}
function search(){query.pageNum=1;load()}
async function open(id){const ticket=++detailGeneration;opened.value=true;detail.value=null;detailError.value='';reason.value='';try{const r=await request({url:base+'/'+id});if(ticket===detailGeneration)detail.value=r.data}catch(e){if(ticket===detailGeneration)detailError.value=e.message}}
async function act(action){if(blocked.value||!detail.value)return;if(!reason.value.trim()){detailError.value=t('请填写财务核对说明。','Enter the financial review reason.');return}saving.value=true;detailError.value='';const id=detail.value.id;try{const r=await submitFinance({url:base+'/'+id+'/actions',method:'post',label:t('处理收货更正费用','Review receipt correction charge'),data:{requestId:crypto.randomUUID(),_version:detail.value._version,action,reason:reason.value.trim()}});await open(id);await load();if(r.data.adjustment)openAdjustment(r.data.adjustment)}catch(e){detailError.value=e.message}finally{saving.value=false}}
watch(financeRevision,()=>{load();if(opened.value&&detail.value&&!saving.value)open(detail.value.id)})
onMounted(load)
</script>
<style scoped>.help{max-width:75ch;line-height:1.65;color:var(--el-text-color-regular)}.el-alert{margin-bottom:16px}.components,.decision{margin-top:20px}.actions{display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap}.actions .el-button{margin-left:0}</style>
