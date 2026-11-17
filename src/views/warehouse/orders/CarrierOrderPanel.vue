<template>
 <section v-if="can('query')" class="carrier-order">
  <div class="heading"><h3>{{ t('快递面单','Carrier labels') }}</h3><el-button :disabled="busy||loading" @click="load">{{ t('刷新快递记录','Refresh carrier records') }}</el-button></div>
  <el-alert v-if="capabilities.localTestMode" type="warning" :closable="false" :title="t('本地模拟接口，不会生成真实快递运单。','Local simulated carrier. No real shipment will be created.')" />
  <el-alert v-else-if="!capabilities.runtimeEnabled" type="info" :closable="false" :title="t('快递服务尚未启用，可查看已有记录。','Carrier operations are disabled. Existing records remain available.')" />
  <el-alert v-if="pending" class="notice" type="warning" :closable="false" :title="t('上次申请结果未确认，请先核对原请求。','The previous request is unconfirmed. Check that request first.')"><p class="break">{{ pending.payload.requestId }}</p><el-button :loading="busy" :disabled="!can('book')" @click="retry">{{ t('核对原申请','Check original booking') }}</el-button></el-alert>
  <p v-if="error||pendingError" role="alert" class="error">{{ error||pendingError }}</p>
  <el-form v-if="can('services')&&canBookCarrier(order)&&!pending&&!pendingError" :disabled="busy||blocked||!capabilities.runtimeEnabled" label-position="top" @submit.prevent>
   <div class="fields">
    <el-form-item :label="t('快递连接','Carrier connection')"><el-select v-model="form.connection" :aria-label="t('快递连接','Carrier connection')" class="full"><el-option v-for="c in matching" :key="c.id" :value="c.id" :label="c.name+' · '+c.config.businessUnit+' · '+c.config.environment" /></el-select></el-form-item>
    <el-form-item :label="t('发运日期（英国当地）','Shipment date (London)')"><el-date-picker v-model="form.shipDate" value-format="YYYY-MM-DD" type="date" class="full" :aria-label="t('发运日期','Shipment date')" /></el-form-item>
    <el-form-item :label="t('通知手机号（服务要求时填写）','Notification mobile (if required)')"><el-input v-model="form.notificationMobile" maxlength="30" :aria-label="t('通知手机号','Notification mobile')" /></el-form-item>
   </div>
   <el-button :disabled="!form.connection" :loading="busy" @click="queryServices">{{ t('查询账号可用服务','Query account services') }}</el-button>
   <template v-if="quote">
    <el-form-item class="service" :label="t('派送服务','Delivery service')"><el-select v-model="network" :aria-label="t('派送服务','Delivery service')" class="full"><el-option v-for="s in quote.services" :key="s.networkCode" :value="s.networkCode" :disabled="!s.supported" :label="s.name+' · '+s.networkCode+(s.supported?'':' · '+message(s.reason))" /></el-select></el-form-item>
    <p v-if="!quote.services.length">{{ t('该账号没有返回适用服务。','No applicable services were returned for this account.') }}</p>
    <el-button v-if="can('book')" type="primary" :disabled="!network||!form.shipDate" :loading="busy" @click="book">{{ t('申请面单','Request labels') }}</el-button>
   </template>
  </el-form>
  <p v-else-if="!order.carrierShipment?.id&&!pending" class="hint">{{ t('完成扫码、确认拣货并封好所有包裹后，可查询 DPD 英国境内派送服务。','Complete scanning, confirm picking and seal every package to query DPD UK domestic services.') }}</p>
  <p v-if="!loading&&!history.length" class="hint">{{ t('本单暂无快递申请。','No carrier bookings for this order.') }}</p>
  <ShipmentDetails v-for="item in history" :key="item.id" :shipment="item" :busy="busy" @recover="recover" />
 </section>
</template>
<script setup>
import {computed,ref,reactive,watch,toRaw,onMounted} from 'vue'
import {ElMessageBox} from 'element-plus'
import auth from '@/plugins/auth'
import useUserStore from '@/store/modules/user'
import {bilingual as t} from '@/warehouse/i18n'
import {canBookCarrier,carrierMessages,carrierPendingKey,bookingPending,readCarrierPending,londonDate} from '@/warehouse/carriers'
import {carrierCapabilities,carrierConnections,orderCarrierShipments,carrierServices,bookCarrier,recoverCarrier,resolveCarrierBooking} from '@/api/carriers'
import ShipmentDetails from '../carriers/ShipmentDetails.vue'
const props=defineProps({order:{type:Object,required:true},blocked:Boolean}),emit=defineEmits(['changed','busy'])
const user=useUserStore(),can=a=>auth.hasPermi('warehouse:carriers:'+a),busy=ref(false),loading=ref(false),error=ref(''),pendingError=ref(''),pending=ref(null),capabilities=ref({}),connections=ref([]),history=ref([]),quote=ref(null),network=ref('')
const form=reactive({connection:'',shipDate:londonDate(),notificationMobile:''}),matching=computed(()=>connections.value.filter(c=>c.enabled&&c.client===props.order.client&&c.warehouse===props.order.warehouse))
const message=code=>carrierMessages[code]?t(...carrierMessages[code]):code
const failure=e=>e.response?.data?.error?message(e.response.data.error):e.message||t('请求失败','Request failed')
watch(busy,value=>emit('busy',value))
watch(()=>[form.connection,form.notificationMobile,props.order.id,props.order._version],()=>{quote.value=null;network.value=''})
let generation=0
async function load(){const ticket=++generation;loading.value=true;try{const results=await Promise.all([orderCarrierShipments(props.order.id),...(can('list')?[carrierCapabilities(),carrierConnections()]:[])]);if(ticket!==generation)return;history.value=results[0].data;if(results[1])capabilities.value=results[1].data;if(results[2])connections.value=results[2].data}catch(e){if(ticket===generation)error.value=failure(e)}finally{if(ticket===generation)loading.value=false}}
async function queryServices(){if(busy.value||props.blocked||!form.connection)return;busy.value=true;error.value='';quote.value=null;network.value='';try{quote.value=(await carrierServices(props.order.id,{connection:form.connection,notificationMobile:form.notificationMobile})).data}catch(e){error.value=failure(e)}finally{busy.value=false}}
async function send(){const p=bookingPending(toRaw(pending.value));try{await bookCarrier(p.order,p.payload);sessionStorage.removeItem(carrierPendingKey(user.id));pending.value=null;quote.value=null;network.value='';await load();emit('changed')}catch(e){error.value=failure(e)+' · '+t('请保留原请求并核对结果。','Keep the original request and check its result.');await load();emit('changed')}}
async function book(){if(busy.value||props.blocked||pending.value||!quote.value||!network.value)return;try{await ElMessageBox.confirm(t('将按已封箱的包裹向 DPD 申请运单。成功后包裹不能直接拆箱或改走人工发货。','Request a DPD shipment for the sealed packages? Once created, packages cannot be reopened or despatched manually.'),t('申请面单','Request labels'),{confirmButtonText:t('确认申请','Confirm booking'),cancelButtonText:t('取消','Cancel'),type:'warning'})}catch{return}busy.value=true;error.value='';try{const p=bookingPending({order:props.order.id,payload:{requestId:crypto.randomUUID(),...toRaw(form),networkCode:network.value,_version:quote.value.orderVersion,connectionVersion:quote.value.connectionVersion}});sessionStorage.setItem(carrierPendingKey(user.id),JSON.stringify(p));pending.value=p;await send()}catch(e){error.value=failure(e)}finally{busy.value=false}}
async function retry(){if(busy.value||!pending.value)return;busy.value=true;error.value='';try{await resolveCarrierBooking(pending.value.order,pending.value.payload.requestId);sessionStorage.removeItem(carrierPendingKey(user.id));pending.value=null;await load();emit('changed')}catch(e){error.value=failure(e)}finally{busy.value=false}}
async function recover(id){if(busy.value)return;busy.value=true;error.value='';try{await recoverCarrier(id);await load();emit('changed')}catch(e){error.value=failure(e);await load()}finally{busy.value=false}}
onMounted(()=>{try{pending.value=readCarrierPending(sessionStorage,user.id)}catch{pendingError.value=t('无法读取原申请记录，请联系管理员核对。','Cannot read the original request. Ask an administrator to check it.')}load()})
watch(()=>props.order.id,()=>{history.value=[];form.connection='';load()})
</script>
<style scoped>
.carrier-order{margin-top:24px}.heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.heading h3{font-size:16px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;margin-top:16px}.full{width:100%!important}.hint{color:var(--el-text-color-secondary);line-height:1.6}.notice,.service{margin-top:16px}.break,.error{overflow-wrap:anywhere}.error{color:var(--el-color-danger)}@media(max-width:600px){.fields{grid-template-columns:1fr}.heading{align-items:flex-start;flex-direction:column}}
</style>
