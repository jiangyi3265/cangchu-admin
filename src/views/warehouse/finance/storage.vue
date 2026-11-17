<template>
  <section v-loading="loading">
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="mb16" />
    <el-alert type="info" :closable="false" class="mb16" :title="bilingual('从启用时开始记录库存和价格变化。之前的日期不能用当前库存补算。','Stock and price history starts when recording is enabled. Earlier dates cannot be billed using current stock.')" />
    <el-descriptions v-if="status" :column="1" border class="mb16">
      <el-descriptions-item :label="bilingual('记录状态','Recording status')">{{ status.enabled ? bilingual('记录中','Recording') : bilingual('尚未启用','Not enabled') }}</el-descriptions-item>
      <el-descriptions-item v-if="status.enabled" :label="bilingual('开始时间（UTC）','Started at (UTC)')">{{ status.startedAt }}</el-descriptions-item>
      <el-descriptions-item v-if="status.enabled" :label="bilingual('首个完整日期（UTC）','First complete day (UTC)')">{{ status.firstCompleteDay }}</el-descriptions-item>
    </el-descriptions>
    <div class="actions mb16">
      <el-button :disabled="loading" @click="loadStatus">{{ bilingual('刷新状态','Refresh status') }}</el-button>
      <el-button v-if="status && !status.enabled && canStart" type="primary" :disabled="blocked" :loading="starting" @click="start">{{ bilingual('启用历史记录','Enable history recording') }}</el-button>
      <span v-if="status && !status.enabled && !canStart">{{ bilingual('请由系统管理员启用记录。','A system administrator must enable recording.') }}</span>
    </div>
    <template v-if="status?.enabled">
      <el-form ref="formRef" :model="form" :inline="true">
        <el-form-item :label="bilingual('客户','Client')" prop="client" :rules="required">
          <el-select v-model="form.client" filterable remote :remote-method="lookup" style="width:240px"><el-option v-for="item in clients" :key="item.id" :label="item.label" :value="item.id" /></el-select>
        </el-form-item>
        <el-form-item :label="bilingual('历史日期（UTC）','Historical day (UTC)')" prop="date" :rules="required"><el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item><el-button type="primary" :loading="querying" @click="query">{{ bilingual('查看历史','View history') }}</el-button></el-form-item>
      </el-form>
      <template v-if="snapshot">
        <h3>{{ snapshot.day }} · {{ bilingual('日末库存','Closing stock') }}</h3>
        <el-table :data="snapshot.stock" border :empty-text="bilingual('当日结束时没有库存','No stock at the end of this day')">
          <el-table-column type="expand"><template #default="scope"><div class="details"><h4>{{ bilingual('库存来源','Stock sources') }}</h4><el-table :data="scope.row.layers" border><el-table-column prop="receivedAt" :label="bilingual('首次入库时间（UTC）','Original receipt time (UTC)')" min-width="240" /><el-table-column prop="quantity" :label="bilingual('剩余数量','Remaining quantity')" width="150" /></el-table></div></template></el-table-column>
          <el-table-column :label="bilingual('商品','Product')" min-width="180"><template #default="scope">{{ productName(scope.row.product) }}</template></el-table-column>
          <el-table-column :label="bilingual('库位','Location')" min-width="150"><template #default="scope">{{ locationName(scope.row.location) }}</template></el-table-column>
          <el-table-column prop="onhand" :label="bilingual('实物数量','Physical quantity')" width="150" />
          <el-table-column prop="batch" :label="bilingual('批次','Batch')" min-width="150" /><el-table-column prop="serial" :label="bilingual('序列号','Serial')" min-width="150" /><el-table-column prop="expiry" :label="bilingual('有效期','Expiry')" min-width="140" />
        </el-table>
        <template v-if="snapshot.unidentifiedStock?.length">
          <h3>{{ bilingual('日末未识别实物','Unidentified goods at day end') }}</h3>
          <el-alert class="mb16" type="warning" :closable="false" :title="bilingual('这些实物已计入库位占用。按商品计价的仓储费需要先核对历史归属，系统不会自动按零费用结算。','These goods count toward location usage. Product-based storage pricing requires historical identity review and will not silently settle at zero.')" />
          <el-table :data="snapshot.unidentifiedStock" border><el-table-column prop="description" :label="bilingual('实物描述','Observed description')" min-width="220" /><el-table-column :label="bilingual('库位','Location')" min-width="160"><template #default="{ row }">{{ locationName(row.location) }}</template></el-table-column><el-table-column prop="onhand" :label="bilingual('实物数量','Physical quantity')" min-width="140" /><el-table-column prop="arrivedAt" :label="bilingual('到仓时间（UTC）','Arrived at (UTC)')" min-width="220" /></el-table>
        </template>
        <h3>{{ bilingual('当日库位占用峰值','Peak occupied locations during the day') }}</h3>
        <el-table :data="peaks" border><el-table-column prop="type" :label="bilingual('库位类型','Location type')" /><el-table-column prop="count" :label="bilingual('峰值数量','Peak count')" /></el-table>
        <p>{{ bilingual('仓储费请在“周期结算”中预览。查看历史不会生成费用。','Preview storage charges in Period billing. Viewing history does not create charges.') }}</p>
      </template>
    </template>
  </section>
</template>
<script setup>
import {computed,ref,reactive,onMounted,watch} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import auth from '@/plugins/auth'
import request from '@/utils/request'
import useUserStore from '@/store/modules/user'
import {getWarehouseLookups} from '@/api/warehouse'
import {bilingual} from '@/warehouse/i18n'
import {financePending,financePendingError,financeBusy,financeRevision,submitFinance} from '@/warehouse/finance'
const status=ref(null),snapshot=ref(null),error=ref(''),loading=ref(false),starting=ref(false),querying=ref(false),clients=ref([]),formRef=ref(),form=reactive({client:'',date:''}),user=useUserStore()
const canStart=computed(()=>Number(user.id)===1&&auth.hasPermi('warehouse:finance:edit')),blocked=computed(()=>starting.value||financeBusy.value||!!financePending.value||!!financePendingError.value)
const required=computed(()=>[{required:true,message:bilingual('请填写此项','Complete this field'),trigger:['blur','change']}])
const peaks=computed(()=>Object.entries(snapshot.value?.locationPeaks||{}).map(([type,count])=>({type,count})))
const productName=id=>snapshot.value?.products?.find(item=>item.id===id)?.sku||id
const locationName=id=>snapshot.value?.locations?.find(item=>item.id===id)?.name||id
let queryTicket=0,lookupTicket=0,statusTicket=0
async function lookup(q=''){const ticket=++lookupTicket;try{const result=await getWarehouseLookups('clients',q);if(ticket===lookupTicket)clients.value=result.data}catch(e){error.value=e.message}}
async function loadStatus(){const ticket=++statusTicket;loading.value=true;error.value='';try{const result=await request({url:'/warehouse/finance/storage-history/status',method:'get'});if(ticket===statusTicket)status.value=result.data}catch(e){if(ticket===statusTicket)error.value=e.message}finally{if(ticket===statusTicket)loading.value=false}}
async function start(){if(blocked.value||!canStart.value)return;starting.value=true;error.value='';try{try{await ElMessageBox.confirm(bilingual('启用后会持续保存库存和价格变化，不能补出启用之前的历史。现在开始记录？','Record stock and price changes from now? This cannot recover history from before recording began.'),bilingual('启用仓储历史','Enable storage history'),{type:'warning',confirmButtonText:bilingual('开始记录','Start recording'),cancelButtonText:bilingual('取消','Cancel')})}catch{return}await submitFinance({label:bilingual('启用仓储历史','Enable storage history'),url:'/warehouse/finance/storage-history/start',method:'post',data:{requestId:crypto.randomUUID(),confirm:true}});ElMessage.success(bilingual('已开始记录','Recording started'))}catch(e){error.value=e.message}finally{starting.value=false}}
async function query(){if(querying.value||!await formRef.value.validate().catch(()=>false))return;const ticket=++queryTicket;querying.value=true;error.value='';snapshot.value=null;try{const result=await request({url:'/warehouse/finance/storage-history/day',method:'get',params:{...form}});if(ticket===queryTicket)snapshot.value=result.data}catch(e){if(ticket===queryTicket)error.value=e.message}finally{if(ticket===queryTicket)querying.value=false}}
watch(()=>JSON.stringify(form),()=>{queryTicket++;snapshot.value=null;querying.value=false})
watch(financeRevision,()=>{queryTicket++;snapshot.value=null;querying.value=false;loadStatus()})
onMounted(()=>{loadStatus();lookup()})
</script>
<style scoped>.mb16{margin-bottom:16px}.actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.actions span,p{color:var(--el-text-color-secondary);font-size:13px}h3{font-size:16px;margin:24px 0 12px}.details{padding:12px 20px}h4{margin:0 0 12px}</style>
