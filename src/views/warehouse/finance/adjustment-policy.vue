<template>
  <el-drawer v-model="opened" :title="bilingual('贷项政策与主体资料','Credit policy and billing profiles')" size="min(850px,100%)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
    <el-alert :closable="false" type="info" class="mb16" :title="bilingual('请使用实际主体资料。非零贷项需要开具方、客户资料及原账单税额；修改政策会要求尚未执行的批准重新复核。','Use actual billing profiles. Non-zero credit notes require seller and buyer details and original invoice tax. Policy changes invalidate approvals that have not been executed.')" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="mb16" />
    <el-form v-if="form" label-position="top" :disabled="blocked" @submit.prevent>
      <el-row :gutter="20"><el-col :xs="24" :sm="12"><el-form-item :label="bilingual('政策版本名称','Policy version name')"><el-input v-model="form.version" maxlength="100" :aria-label="bilingual('政策版本名称','Policy version name')" /></el-form-item></el-col><el-col :xs="24" :sm="12"><el-form-item :label="bilingual('贷项编号前缀','Credit number prefix')"><el-input v-model="form.creditPrefix" maxlength="20" :aria-label="bilingual('贷项编号前缀','Credit number prefix')" /></el-form-item></el-col></el-row>
      <el-form-item><el-checkbox v-model="form.requireDifferentActor">{{bilingual('批准人与执行人必须不同','Approval and execution require different people')}}</el-checkbox></el-form-item>
      <h3>{{bilingual('开具方','Seller')}}</h3>
      <el-form-item :label="bilingual('开具方名称','Seller name')"><el-input v-model="form.seller.name" maxlength="200" :aria-label="bilingual('开具方名称','Seller name')" /></el-form-item>
      <el-form-item :label="bilingual('开具方地址','Seller address')"><el-input v-model="form.seller.address" type="textarea" maxlength="1000" :aria-label="bilingual('开具方地址','Seller address')" /></el-form-item>
      <el-form-item :label="bilingual('开具方税务编号','Seller tax ID')"><el-input v-model="form.seller.taxId" maxlength="100" :aria-label="bilingual('开具方税务编号','Seller tax ID')" /></el-form-item>
      <h3>{{bilingual('客户开票资料','Buyer billing profiles')}}</h3>
      <div v-for="(buyer,index) in form.buyers" :key="buyer.key" class="buyer">
        <el-form-item :label="bilingual('客户','Client')"><el-select v-model="buyer.client" filterable remote :remote-method="lookup" style="width:100%"><el-option v-for="item in withCurrent(buyer.client)" :key="item.id" :label="item.label" :value="item.id" /></el-select></el-form-item>
        <el-form-item :label="bilingual('客户主体名称','Buyer name')"><el-input v-model="buyer.name" maxlength="200" :aria-label="bilingual('客户主体名称','Buyer name')" /></el-form-item>
        <el-form-item :label="bilingual('客户主体地址','Buyer address')"><el-input v-model="buyer.address" type="textarea" maxlength="1000" :aria-label="bilingual('客户主体地址','Buyer address')" /></el-form-item>
        <el-form-item :label="bilingual('客户税务编号','Buyer tax ID')"><el-input v-model="buyer.taxId" maxlength="100" :aria-label="bilingual('客户税务编号','Buyer tax ID')" /></el-form-item>
        <el-button type="danger" plain @click="form.buyers.splice(index,1)">{{bilingual('移除此客户资料','Remove buyer profile')}}</el-button>
      </div>
      <el-button @click="addBuyer">{{bilingual('增加客户资料','Add buyer profile')}}</el-button>
    </el-form>
    <template #footer><el-button :disabled="saving" @click="opened=false">{{bilingual('关闭','Close')}}</el-button><el-button type="primary" :loading="saving" :disabled="blocked||!form" @click="save">{{bilingual('保存政策','Save policy')}}</el-button></template>
  </el-drawer>
</template>
<script setup>
import {computed,ref} from 'vue'
import {ElMessageBox,ElMessage} from 'element-plus'
import request from '@/utils/request'
import {getWarehouseLookups} from '@/api/warehouse'
import {bilingual} from '@/warehouse/i18n'
import {financePending,financePendingError,financeBusy,submitFinance} from '@/warehouse/finance'
const opened=ref(false),form=ref(null),version=ref(0),saving=ref(false),error=ref(''),clients=ref([])
const blocked=computed(()=>saving.value||financeBusy.value||!!financePending.value||!!financePendingError.value)
const withCurrent=id=>id&&!clients.value.some(item=>item.id===id)?[{id,label:id},...clients.value]:clients.value
let ticket=0
async function lookup(q=''){const own=++ticket;try{const result=await getWarehouseLookups('clients',q);if(own===ticket)clients.value=result.data}catch(e){error.value=e.message}}
async function open(){error.value='';form.value=null;opened.value=true;try{const data=(await request({url:'/warehouse/finance/adjustment-policy',method:'get'})).data;version.value=data._version;const p=data.policy||{version:'',creditPrefix:'',requireDifferentActor:true,seller:{name:'',address:'',taxId:''},buyers:{}};form.value={...p,buyers:Object.entries(p.buyers).map(([client,profile])=>({key:crypto.randomUUID(),client,...profile}))};lookup()}catch(e){error.value=e.message}}
async function save(){if(blocked.value||!form.value)return;saving.value=true;error.value='';try{const buyers={};for(const row of form.value.buyers){if(!row.client||Object.hasOwn(buyers,row.client))throw Error(bilingual('请选择不重复的客户','Choose unique clients'));buyers[row.client]={name:row.name,address:row.address,taxId:row.taxId}}const policy={version:form.value.version,creditPrefix:form.value.creditPrefix,requireDifferentActor:form.value.requireDifferentActor,taxMethod:'original-line-remainder-half-even',seller:{...form.value.seller},buyers};try{await ElMessageBox.confirm(bilingual('保存后，未执行的调整需要按新政策重新复核。确认保存？','Unexecuted adjustments must be reviewed against the changed policy. Save it?'),bilingual('保存政策','Save policy'),{type:'warning',confirmButtonText:bilingual('保存','Save'),cancelButtonText:bilingual('取消','Cancel')})}catch{return}await submitFinance({label:bilingual('配置贷项政策','Configure credit policy'),url:'/warehouse/finance/adjustment-policy',method:'post',data:{requestId:crypto.randomUUID(),_version:version.value,policy}});opened.value=false;ElMessage.success(bilingual('政策已保存','Policy saved'))}catch(e){error.value=e.message}finally{saving.value=false}}
function addBuyer(){form.value.buyers.push({key:crypto.randomUUID(),client:'',name:'',address:'',taxId:''})}
defineExpose({open})
</script>
<style scoped>.mb16{margin-bottom:16px}h3{font-size:16px;margin:24px 0 16px}.buyer{border:1px solid var(--el-border-color);border-radius:4px;padding:16px;margin-bottom:16px}</style>
