<template>
 <section v-if="shipment" class="shipment-detail">
  <div class="heading"><h4>{{ shipment.reference }}</h4><el-tag :type="shipment.state==='UNKNOWN'?'danger':shipment.state==='LABELLED'?'success':'info'">{{ state(shipment.state) }}</el-tag></div>
  <el-alert v-if="['SENDING','UNKNOWN'].includes(shipment.state)" :closable="false" type="warning" :title="t('建单结果尚未确认。请联系 DPD 按上方参考号核对，不要重复创建或人工发货。','Creation is unconfirmed. Ask DPD to check the reference above before creating another shipment or despatching manually.')" />
  <el-alert v-if="shipment.state==='LABELLED'" :closable="false" type="info" :title="t('面单已取得，尚未确认实物交运；订单仍保持已拣货，库存未扣减。','Labels are ready. Physical handover is not confirmed; the order remains picked and stock has not been deducted.')" />
  <p v-if="shipment.errorCode" role="alert">{{ message(shipment.errorCode) }}</p>
  <el-descriptions :column="width<600?1:2" border class="summary">
   <el-descriptions-item :label="t('订单号','Order')">{{ shipment.orderReference }}</el-descriptions-item>
   <el-descriptions-item :label="t('环境 / 业务','Environment / business')">{{ shipment.config.environment==='production'?t('正式','Production'):t('测试','Sandbox') }} / {{ shipment.config.businessUnit }}</el-descriptions-item>
   <el-descriptions-item :label="t('服务代码','Service code')">{{ shipment.networkCode }}</el-descriptions-item>
   <el-descriptions-item :label="t('发运日期','Shipment date')">{{ shipment.shipDate }}</el-descriptions-item>
   <el-descriptions-item :label="t('DPD 发运编号','DPD shipment ID')">{{ shipment.identity?.shipmentId||'—' }}</el-descriptions-item>
   <el-descriptions-item :label="t('托运编号','Consignment')">{{ shipment.identity?.consignmentNumber||'—' }}</el-descriptions-item>
  </el-descriptions>
  <el-table :data="parcels" border :aria-label="t('包裹与原始面单','Packages and original labels')">
   <el-table-column prop="packageCode" :label="t('包裹','Package')" min-width="140" />
   <el-table-column prop="tracking" :label="t('运单号','Tracking number')" min-width="170" />
   <el-table-column prop="weightKg" :label="t('重量 kg','Weight kg')" width="110" />
   <el-table-column :label="t('原始面单','Original label')" min-width="140"><template #default="{row}"><el-button v-if="row.label&&can('label')" link type="primary" :disabled="busy||downloading" @click="download(row)">{{ t('下载 ZPL','Download ZPL') }}</el-button><span v-else>{{ row.label?t('已保存','Saved'):t('待取得','Pending') }}</span></template></el-table-column>
  </el-table>
  <p class="hint">{{ t('ZPL 为快递返回的原始打印文件，请使用匹配 DPI 的打印机。','ZPL is the original carrier print file. Use a printer with the matching DPI.') }} {{ shipment.config.printerDpi }} DPI</p>
  <el-button v-if="can('recover')&&['PREPARING','SENDING','CREATED'].includes(shipment.state)" :loading="busy" @click="$emit('recover',shipment.id)">{{ shipment.state==='CREATED'?t('补取缺失面单','Retrieve missing labels'):t('核对原请求','Check original request') }}</el-button>
  <p v-if="error" role="alert">{{ error }}</p>
 </section>
</template>
<script setup>
import {computed,ref} from 'vue'
import {useWindowSize} from '@vueuse/core'
import {saveAs} from 'file-saver'
import auth from '@/plugins/auth'
import {bilingual as t} from '@/warehouse/i18n'
import {carrierStates,carrierMessages} from '@/warehouse/carriers'
import {carrierLabel} from '@/api/carriers'
const props=defineProps({shipment:Object,busy:Boolean});defineEmits(['recover'])
const {width}=useWindowSize(),error=ref(''),downloading=ref(false),can=a=>auth.hasPermi('warehouse:carriers:'+a)
const state=s=>carrierStates[s]?t(...carrierStates[s]):s,message=code=>carrierMessages[code]?t(...carrierMessages[code]):t('请求未完成，请按当前状态核对。','The request did not finish. Check its current state.')+' ('+code+')'
const parcels=computed(()=>(props.shipment.parcels||[]).map((p,index)=>({...p,index,tracking:props.shipment.identity?.trackingNumbers?.[index]||'—',label:props.shipment.labels?.some(l=>l.parcelIndex===index)})))
async function download(row){downloading.value=true;error.value='';try{const blob=await carrierLabel(props.shipment.id,row.index);if(!blob.type.includes('zebra-zpl'))throw Error(t('未返回有效面单','No valid label was returned'));saveAs(blob,props.shipment.reference+'-'+(row.index+1)+'.zpl')}catch(e){error.value=e.message}finally{downloading.value=false}}
</script>
<style scoped>
.shipment-detail{margin-top:20px}.heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.heading h4{font-size:16px;overflow-wrap:anywhere}.summary{margin:16px 0}.hint{color:var(--el-text-color-secondary);line-height:1.5}.summary :deep(.el-descriptions__table){table-layout:fixed}.summary :deep(.el-descriptions__content){overflow-wrap:anywhere}
</style>
