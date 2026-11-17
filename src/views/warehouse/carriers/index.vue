<template>
 <div class="app-container carriers">
  <div class="heading"><h2>{{ t('快递发运','Carrier shipments') }}</h2><el-button :loading="loading" :disabled="busy" @click="load">{{ t('刷新','Refresh') }}</el-button></div>
  <el-alert v-if="error" :title="error" type="error" :closable="false" class="notice" />
  <el-alert v-if="caps.localTestMode" type="warning" :closable="false" class="notice" :title="t('当前连接本地模拟接口，记录仅用于测试。','Connected to a local simulated carrier. These records are for testing only.')" />
  <el-alert v-else-if="!caps.runtimeEnabled" type="info" :closable="false" class="notice" :title="t('快递请求尚未启用。管理员可先保存连接配置。','Carrier requests are disabled. Administrators can prepare connection settings.')" />
  <el-alert v-if="pending" type="warning" :closable="false" class="notice" :title="t('上次配置保存结果未确认，请先核对。','The previous configuration save is unconfirmed. Check it first.')"><p class="break">{{ pending.requestId }}</p><el-button :loading="busy" @click="checkPending">{{ t('核对保存结果','Check saved result') }}</el-button><el-button v-if="pendingPayload" :loading="busy" @click="retrySave">{{ t('重试原保存','Retry original save') }}</el-button></el-alert>
  <el-tabs v-model="tab">
   <el-tab-pane :label="t('发运记录','Shipment records')" name="shipments">
    <p class="hint">{{ t('从订单详情申请面单；此处查看运单结果和补取原面单。','Request labels from order details. Review shipment results and retrieve missing labels here.') }}</p>
    <el-table v-loading="loading" :data="rows" border :empty-text="t('暂无发运申请','No shipment requests')">
     <el-table-column prop="orderReference" :label="t('订单号','Order')" min-width="170" />
     <el-table-column prop="reference" :label="t('发运参考号','Shipment reference')" min-width="230" />
     <el-table-column :label="t('状态','State')" min-width="190"><template #default="{row}">{{ state(row.state) }}</template></el-table-column>
     <el-table-column prop="shipDate" :label="t('发运日期','Shipment date')" width="145" />
     <el-table-column :label="t('操作','Actions')" width="110" fixed="right"><template #default="{row}"><el-button v-if="can('query')" link type="primary" :disabled="busy" @click="openShipment(row.id)">{{ t('查看','View') }}</el-button></template></el-table-column>
    </el-table>
    <pagination v-show="total>0" :total="total" v-model:page="page.pageNum" v-model:limit="page.pageSize" @pagination="load" />
   </el-tab-pane>
   <el-tab-pane :label="t('快递连接','Carrier connections')" name="connections">
    <div class="heading"><p class="hint">{{ t('DPD 英国与 DPD Local 英国使用独立账号。每个连接固定客户、仓库、环境和账号。','DPD UK and DPD Local UK use separate accounts. Each connection has a fixed client, warehouse, environment and account.') }}</p><el-button v-if="canConfigure" type="primary" :disabled="busy||!!pending||!!pendingError" @click="edit()">{{ t('新增连接','Add connection') }}</el-button></div>
    <el-table :data="connections" border :empty-text="t('尚未配置快递连接','No carrier connections configured')">
     <el-table-column prop="name" :label="t('连接名称','Connection')" min-width="180" />
     <el-table-column :label="t('客户 / 仓库','Client / warehouse')" min-width="220"><template #default="{row}">{{ label('clients',row.client) }} / {{ label('warehouses',row.warehouse) }}</template></el-table-column>
     <el-table-column :label="t('业务 / 环境','Business / environment')" min-width="190"><template #default="{row}">{{ row.config.businessUnit }} / {{ row.config.environment==='production'?t('正式','Production'):t('测试','Sandbox') }}</template></el-table-column>
     <el-table-column :label="t('状态','State')" min-width="140"><template #default="{row}">{{ row.enabled?t('已启用','Enabled'):t('已停用','Disabled') }} · {{ row.credentialConfigured?t('已配置凭据','Credentials saved'):t('缺少凭据','No credentials') }}</template></el-table-column>
     <el-table-column v-if="canConfigure" :label="t('操作','Actions')" width="100"><template #default="{row}"><el-button link type="primary" :disabled="busy||!!pending||!!pendingError" @click="edit(row)">{{ t('编辑','Edit') }}</el-button></template></el-table-column>
    </el-table>
    <section v-if="editing" class="editor">
     <h3>{{ editingId?t('编辑连接','Edit connection'):t('新增连接','Add connection') }}</h3>
     <p class="hint">{{ t('密钥只提交给服务器加密保存，页面不会回显。更换账号请新增连接。','Credentials are encrypted on the server and never displayed again. Create another connection to change accounts.') }}</p>
     <el-form ref="formRef" :model="form" :disabled="busy||!!pending||!!pendingError" label-position="top" @submit.prevent="save">
      <div class="fields">
       <el-form-item :label="t('连接名称','Connection name')" prop="name" :rules="required"><el-input v-model="form.name" maxlength="191" /></el-form-item>
       <el-form-item v-for="item in routes" :key="item.key" :label="t(item.zh,item.en)" :prop="item.key" :rules="required"><el-select v-model="form[item.key]" filterable remote :remote-method="q=>lookup(item.source,q)" :disabled="!!editingId" class="full" :aria-label="t(item.zh,item.en)"><el-option v-for="o in choices(item.source,form[item.key])" :key="o.id" :value="o.id" :label="o.label" /></el-select></el-form-item>
       <el-form-item :label="t('环境','Environment')"><el-select v-model="form.config.environment" :disabled="!!editingId" class="full"><el-option value="sandbox" :label="t('测试','Sandbox')" /><el-option value="production" :label="t('正式','Production')" /></el-select></el-form-item>
       <el-form-item :label="t('业务类型','Business')"><el-select v-model="form.config.businessUnit" :disabled="!!editingId" class="full"><el-option value="DPD" label="DPD UK" /><el-option value="DPDLocal" label="DPD Local UK" /></el-select></el-form-item>
       <el-form-item :label="t('打印机 DPI','Printer DPI')"><el-select v-model="form.config.printerDpi" class="full"><el-option :value="203" label="203" /><el-option :value="300" label="300" /></el-select></el-form-item>
      </div>
      <h4>{{ t('发件地址（英国境内）','Collection address (UK)') }}</h4>
      <div class="fields"><el-form-item v-for="f in senderFields" :key="f.key" :label="t(f.zh,f.en)" :prop="'config.sender.'+f.key" :rules="f.required?required:[]"><el-input v-model="form.config.sender[f.key]" :maxlength="f.max||35" /></el-form-item></div>
      <div class="fields"><el-form-item label="App key"><el-input v-model="form.appKey" type="password" show-password autocomplete="new-password" maxlength="1024" /></el-form-item><el-form-item label="App secret"><el-input v-model="form.appSecret" type="password" show-password autocomplete="new-password" maxlength="4096" /></el-form-item></div>
      <el-form-item :label="t('允许使用此连接','Enable this connection')"><el-switch v-model="form.enabled" :disabled="!caps.credentialKeyConfigured&&!form.credentialConfigured" /></el-form-item>
      <el-button type="primary" :loading="busy" native-type="submit">{{ t('保存连接','Save connection') }}</el-button><el-button :disabled="busy" @click="closeEditor">{{ t('收起','Hide') }}</el-button>
     </el-form>
    </section>
   </el-tab-pane>
  </el-tabs>
  <el-drawer v-model="opened" :title="t('发运详情','Shipment details')" size="min(850px, 100%)" :close-on-click-modal="!busy" :close-on-press-escape="!busy" :show-close="!busy"><ShipmentDetails :shipment="detail" :busy="busy" @recover="recover" /></el-drawer>
 </div>
</template>
<script setup>
import {computed,ref,reactive,onMounted,toRaw} from 'vue'
import auth from '@/plugins/auth'
import useUserStore from '@/store/modules/user'
import {bilingual as t} from '@/warehouse/i18n'
import {blankCarrier,carrierConnectionPayload,carrierIdentity,carrierPendingKey,connectionPending,carrierStates,carrierMessages} from '@/warehouse/carriers'
import {carrierCapabilities,carrierConnections,saveCarrierConnection,carrierShipments,carrierShipment,recoverCarrier,resolveCarrierConfig} from '@/api/carriers'
import {getWarehouseLookups} from '@/api/warehouse'
import ShipmentDetails from './ShipmentDetails.vue'
const user=useUserStore(),can=a=>auth.hasPermi('warehouse:carriers:'+a),canConfigure=computed(()=>Number(user.id)===1&&can('configure'))
const loading=ref(false),busy=ref(false),error=ref(''),caps=ref({}),connections=ref([]),rows=ref([]),total=ref(0),page=reactive({pageNum:1,pageSize:20}),tab=ref('shipments'),opened=ref(false),detail=ref(null)
const editing=ref(false),editingId=ref(''),form=ref(blankCarrier()),formRef=ref(),options=reactive({clients:[],warehouses:[]}),pending=ref(null),pendingPayload=ref(null),pendingError=ref('')
const required=computed(()=>[{required:true,message:t('请填写此项','Complete this field'),trigger:['blur','change']}]),routes=[{key:'client',source:'clients',zh:'客户',en:'Client'},{key:'warehouse',source:'warehouses',zh:'仓库',en:'Warehouse'}]
const senderFields=[{key:'name',zh:'发件人',en:'Contact name',required:true},{key:'company',zh:'公司',en:'Company'},{key:'address1',zh:'地址第一行',en:'Street',required:true},{key:'address2',zh:'地址第二行',en:'Locality'},{key:'town',zh:'城市',en:'Town',required:true},{key:'county',zh:'地区',en:'County'},{key:'postcode',zh:'邮编',en:'Postcode',required:true,max:8},{key:'phone',zh:'电话',en:'Phone',required:true,max:30},{key:'email',zh:'邮箱',en:'Email',max:100}]
const state=s=>carrierStates[s]?t(...carrierStates[s]):s,failure=e=>carrierMessages[e.response?.data?.error]?t(...carrierMessages[e.response.data.error]):e.message||t('请求失败','Request failed')
const label=(source,id)=>options[source].find(r=>r.id===id)?.label||id,choices=(source,id)=>id&&!options[source].some(r=>r.id===id)?[{id,label:id},...options[source]]:options[source]
let generation=0;const lookupTickets={}
async function lookup(source,q=''){const ticket=(lookupTickets[source]||0)+1;lookupTickets[source]=ticket;try{const r=await getWarehouseLookups(source,q);if(lookupTickets[source]===ticket)options[source]=r.data}catch(e){error.value=failure(e)}}
async function load(){const ticket=++generation;loading.value=true;try{const result=await Promise.all([carrierCapabilities(),carrierConnections(),carrierShipments({...page})]);if(ticket===generation){caps.value=result[0].data;connections.value=result[1].data;rows.value=result[2].data.rows;total.value=result[2].data.total}}catch(e){if(ticket===generation)error.value=failure(e)}finally{if(ticket===generation)loading.value=false}}
function edit(row){if(busy.value||pending.value||pendingError.value)return;editingId.value=row?.id||'';form.value=row?{...structuredClone(toRaw(row)),appKey:'',appSecret:''}:blankCarrier();editing.value=true;error.value=''}
function closeEditor(){editing.value=false;form.value=blankCarrier()}
function clearPending(){sessionStorage.removeItem(carrierPendingKey(user.id,'config'));pending.value=null;pendingPayload.value=null;closeEditor()}
async function checkPending(){if(busy.value||!pending.value)return;busy.value=true;try{await resolveCarrierConfig(pending.value.id,pending.value.requestId);clearPending();error.value='';await load()}catch(e){error.value=failure(e)}finally{busy.value=false}}
async function performSave(){try{await saveCarrierConnection(pendingPayload.value.id,pendingPayload.value.payload);clearPending();error.value='';await load()}catch(e){error.value=failure(e);if(e.response?.data?.data?.committed===false){sessionStorage.removeItem(carrierPendingKey(user.id,'config'));pending.value=null;pendingPayload.value=null}}}
async function save(){if(busy.value||pending.value||pendingError.value)return;if(!await formRef.value.validate().catch(()=>false))return;busy.value=true;error.value='';try{const requestId=crypto.randomUUID(),payload=carrierConnectionPayload(toRaw(form.value),requestId),id=editingId.value||await carrierIdentity('connection',user.id,requestId),metadata=connectionPending({id,requestId});sessionStorage.setItem(carrierPendingKey(user.id,'config'),JSON.stringify(metadata));pending.value=metadata;pendingPayload.value={id:editingId.value,payload};await performSave()}catch(e){error.value=({credential_pair:t('请同时填写 App key 和 App secret。','Provide both App key and App secret.'),required_fields:t('请填写名称、客户和仓库。','Complete the name, client and warehouse.')})[e.message]||failure(e)}finally{busy.value=false}}
async function retrySave(){if(busy.value||!pendingPayload.value)return;busy.value=true;try{await performSave()}finally{busy.value=false}}
async function openShipment(id){try{detail.value=(await carrierShipment(id)).data;opened.value=true}catch(e){error.value=failure(e)}}
async function recover(id){busy.value=true;try{detail.value=(await recoverCarrier(id)).data;await load()}catch(e){error.value=failure(e);await openShipment(id)}finally{busy.value=false}}
onMounted(()=>{try{const raw=sessionStorage.getItem(carrierPendingKey(user.id,'config'));if(raw)pending.value=connectionPending(JSON.parse(raw))}catch{pendingError.value=t('无法读取上次保存记录，请联系管理员。','Cannot read the previous save record. Contact an administrator.');error.value=pendingError.value}load();for(const source of ['clients','warehouses'])lookup(source)})
</script>
<style scoped>
.heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}.heading h2{font-size:20px;margin:0}.notice{margin-bottom:16px}.hint{color:var(--el-text-color-secondary);line-height:1.6;max-width:75ch}.editor{margin-top:24px;padding-top:16px;border-top:1px solid var(--el-border-color)}.editor h3{font-size:18px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}.full{width:100%}.break{overflow-wrap:anywhere}@media(max-width:600px){.fields{grid-template-columns:1fr}.heading{align-items:flex-start;flex-wrap:wrap}.heading .hint{margin:0}}
</style>
