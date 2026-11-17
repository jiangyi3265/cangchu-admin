<template>
  <section class="acceptance-panel" v-loading="loading">
    <h3>{{t('仓库接单','Warehouse acceptance')}}</h3>
    <el-alert v-if="error" type="error" :closable="false" :title="error" class="gap" />
    <el-alert v-if="pending||pendingError" type="warning" :closable="false" class="gap" :title="pendingError||t('接单操作的结果尚未确认','An acceptance operation is unconfirmed')">
      <template v-if="pending" #default><p>{{t('可以重试原请求，或核对结果并结束尚未提交的请求，防止迟到请求继续执行。','Retry the original request, or resolve its result and cancel it if it has not committed, including any late arrival.')}}</p><div class="buttons"><el-button :loading="busy" @click="send(true)">{{t('重试原请求','Retry original request')}}</el-button><el-button :loading="busy" @click="resolve">{{t('核对并结束原请求','Resolve original request')}}</el-button></div></template>
    </el-alert>
    <el-alert v-if="acceptedId" type="success" :closable="false" class="gap" :title="t('已生成关联的仓库订单','A linked warehouse order has been created')"><template #default><p class="identifier">{{acceptedReference||acceptedId}}</p><el-button v-if="canOpenOrder" type="primary" link @click="openOrder">{{t('打开仓库订单','Open warehouse order')}}</el-button></template></el-alert>
    <p class="hint">{{t('接单前会重新读取平台订单、商品和履约记录。已接单的订单可以分配、扫码和装箱；快递发运、库存回推和发货回传仍待接通。','Acceptance rechecks the source order, products and fulfillments. Accepted orders support allocation, scanning and packing; carrier dispatch, stock updates and fulfillment feedback still need to be connected.')}}</p>

    <el-collapse v-model="expanded" class="gap">
      <el-collapse-item name="authority" :title="t('接单来源与切换起点','Source ownership and cutover')">
        <template v-if="canAuthority">
          <el-form label-position="top" :disabled="blocked">
            <el-form-item :label="t('店铺主网址（来源标识）','Canonical store URL (source identity)')"><el-input v-model="authority.sourceIdentity" :disabled="authority._version>0" maxlength="512" /></el-form-item>
            <p class="hint">{{t('同一店铺的别名、代理连接和原系统必须归到同一来源，只允许一个接单连接。请填写店铺实际主网址。','Store aliases, aggregators and the old system must share one source identity with one accepting connection. Use the actual canonical store URL.')}}</p>
            <el-form-item :label="t('接单起点（UTC）','Accept orders placed from (UTC)')"><el-input v-model="authority.cutoverAt" :disabled="authority._version>0" placeholder="2026-11-01T00:00:00Z" /></el-form-item>
            <el-form-item :label="t('平台履约模式','Store fulfillment mode')"><el-select v-model="authority.fulfillmentMode" :aria-label="t('平台履约模式','Store fulfillment mode')"><el-option value="CORE" :label="t('核对 WooCommerce 履约接口','Require WooCommerce fulfillments API')"/><el-option value="LEGACY_METADATA" :label="t('旧版店铺：核对订单发货资料','Legacy store: verify order shipment metadata')"/></el-select></el-form-item>
            <p class="hint">{{t('旧版模式仅在平台明确返回履约接口未启用时使用。自定义插件的发运字段仍需按实际店铺验收；任何已有履约任务都会拦截。','Legacy mode is only for stores whose fulfillment route is explicitly unavailable. Custom plugin shipment fields still require store-specific validation; any existing fulfillment task blocks acceptance.')}}</p>
            <el-form-item :label="t('切换依据或说明','Cutover evidence or reason')"><el-input v-model="authority.reason" type="textarea" maxlength="500" /></el-form-item>
            <el-form-item :label="t('允许仓库接单','Allow warehouse acceptance')"><el-switch v-model="authority.active" :aria-label="t('允许仓库接单','Allow warehouse acceptance')" /></el-form-item>
            <el-checkbox v-model="authority.exclusiveSource">{{t('我已核对原系统停止此来源接单，且没有其他接单通道','I verified that the old system stopped accepting this source and no other acceptance channel is active')}}</el-checkbox>
            <div class="buttons gap"><el-button type="primary" :loading="busy" :disabled="blocked" @click="saveAuthority">{{t('保存接单设置','Save acceptance settings')}}</el-button></div>
          </el-form>
        </template>
        <p v-else>{{settings.authority.active?t('此来源已允许接单','Acceptance is enabled for this source'):t('此来源尚未允许接单，请联系管理员配置','Acceptance is disabled; ask an administrator to configure the source')}}</p>
        <p v-if="settings.authority.source_identity" class="identifier">{{settings.authority.source_identity}} · {{settings.authority.cutover_at}}</p>
      </el-collapse-item>
    </el-collapse>

    <el-table :data="lineRows" border :empty-text="t('暂无商品明细','No source lines')">
      <el-table-column prop="sku" :label="t('平台 SKU','Source SKU')" min-width="140" />
      <el-table-column :label="t('仓库商品 / 发货资格','Warehouse product / eligibility')" min-width="210"><template #default="{row}"><template v-if="row.physical===false">{{t('虚拟商品，不进入仓库发货明细','Virtual item, excluded from warehouse lines')}}</template><template v-else>{{row.localSku||mappingFor(row)?.product_id||t('尚未对照','Not mapped')}}<p v-if="row.issue" class="line-issue">{{issue(row.issue)}}</p></template></template></el-table-column>
      <el-table-column prop="quantity" :label="t('数量','Quantity')" width="90" />
      <el-table-column v-if="canMapping" :label="t('商品对照','SKU mapping')" width="125"><template #default="{row}"><el-button link type="primary" :disabled="blocked||row.physical===false" @click="editMapping(row)">{{t('设置对照','Set mapping')}}</el-button></template></el-table-column>
    </el-table>
    <el-form v-if="mapping" class="mapping-form" label-position="top" :disabled="blocked">
      <h4>{{t('商品对照','SKU mapping')}} · {{mapping.sku}}</h4>
      <p class="hint">{{t('平台商品 / 变体 ID','Source product / variation ID')}}: {{mapping.productId}} / {{mapping.variationId}}</p>
      <el-form-item :label="t('对应仓库商品','Warehouse product')"><el-select v-model="mapping.product" filterable remote :remote-method="lookupProducts" :aria-label="t('对应仓库商品','Warehouse product')"><el-option v-for="p in productOptions" :key="p.id" :label="p.label" :value="p.id" /></el-select></el-form-item>
      <el-form-item :label="t('启用对照','Enable mapping')"><el-switch v-model="mapping.active" :aria-label="t('启用对照','Enable mapping')" /></el-form-item>
      <div class="buttons"><el-button type="primary" :loading="busy" @click="saveMapping">{{t('保存商品对照','Save SKU mapping')}}</el-button><el-button @click="mapping=null">{{t('关闭','Close')}}</el-button></div>
    </el-form>
    <ul v-if="verification?.issues?.length" class="issues"><li v-for="code in verification.issues" :key="code">{{issue(code)}}</li></ul>
    <p v-if="verification?.warehouseIssue">{{verification.warehouseIssue}}</p>
    <el-alert v-if="verification?.ready" type="success" :closable="false" class="gap" :title="t('商品和来源核验通过，可以接入仓库','Products and source checks passed; the order can be accepted')" />
    <div v-if="!acceptedId" class="buttons gap"><el-button v-if="canReview" :loading="busy" :disabled="blocked" @click="verify">{{t('核验并匹配','Verify and match')}}</el-button><el-button v-if="canAccept" type="primary" :loading="busy" :disabled="blocked||!verification?.ready" @click="accept">{{t('生成仓库订单','Create warehouse order')}}</el-button></div>
  </section>
</template>

<script setup>
import {computed,ref,watch,onMounted} from 'vue'
import {useRouter} from 'vue-router'
import {ElMessage} from 'element-plus'
import auth from '@/plugins/auth'
import useUserStore from '@/store/modules/user'
import {bilingual as t} from '@/warehouse/i18n'
import * as api from '@/api/integrations'
import {getWarehouseLookups} from '@/api/warehouse'
import {rejectedBeforeCommit} from '@/warehouse/inventory'
import {acceptancePending,acceptancePendingKey,intakeMessages} from '@/warehouse/integration-acceptance'
const props=defineProps({connection:{type:Object,required:true},detail:{type:Object,required:true},disabled:{type:Boolean,default:false}}),emit=defineEmits(['blocked','accepted'])
const user=useUserStore(),router=useRouter(),canAuthority=Number(user.id)===1&&auth.hasPermi('warehouse:integrations:authority'),canMapping=Number(user.id)===1&&auth.hasPermi('warehouse:integrations:mapping'),canReview=auth.hasPermi('warehouse:integrations:review'),canAccept=auth.hasPermi('warehouse:integrations:accept'),canOpenOrder=auth.hasPermi('warehouse:orders:query')
const loading=ref(false),busy=ref(false),error=ref(''),settings=ref({authority:{},mappings:[]}),authority=ref({}),mapping=ref(null),productOptions=ref([]),expanded=ref([]),verification=ref(null),accepted=ref(null),pending=ref(null),pendingError=ref('')
const blocked=computed(()=>props.disabled||busy.value||!!pending.value||!!pendingError.value),acceptedId=computed(()=>accepted.value?.orderId||props.detail.warehouseOrderId||''),acceptedReference=computed(()=>accepted.value?.reference||''),lineRows=computed(()=>verification.value?.lines||(settings.value.acceptedLines?.length?settings.value.acceptedLines:props.detail.document.lines))
const issue=code=>t(...(intakeMessages[code]||[code,code])),message=e=>intakeMessages[e?.response?.data?.error]?issue(e.response.data.error):e?.response?.data?.msg||e.message||t('操作未完成','Operation did not complete')
watch(blocked,value=>emit('blocked',value),{immediate:true})
let generation=0
async function load(){const ticket=++generation,connection=props.connection.id,item=props.detail.id;loading.value=true;try{const data=(await api.integrationAcceptanceSettings(connection,item)).data;if(ticket!==generation)return;settings.value=data;const a=data.authority;authority.value={_version:a.revision||0,sourceIdentity:a.source_identity||props.connection.siteUrl,cutoverAt:a.cutover_at||new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),fulfillmentMode:a.fulfillment_mode||'CORE',active:a.active===true,reason:a.reason||'',exclusiveSource:false}}catch(e){error.value=message(e)}finally{if(ticket===generation)loading.value=false}}
watch(()=>[props.connection.id,props.detail.id],()=>{verification.value=null;accepted.value=null;mapping.value=null;error.value='';load()},{immediate:true})
function mappingFor(row){return settings.value.mappings.find(m=>m.external_product_id===row.productId&&m.external_variation_id===row.variationId)}
async function lookupProducts(keyword=''){try{productOptions.value=(await getWarehouseLookups('products',keyword,{client:props.connection.client})).data;if(mapping.value?.product&&!productOptions.value.some(p=>p.id===mapping.value.product))productOptions.value.unshift({id:mapping.value.product,label:mapping.value.product})}catch(e){error.value=message(e)}}
function editMapping(row){const saved=mappingFor(row);mapping.value={_version:saved?.revision||0,productId:row.productId,variationId:row.variationId,sku:row.sku,product:saved?.product_id||'',active:saved?.active!==false};lookupProducts()}
function keep(kind,payload){const value=acceptancePending({kind,connection:props.connection.id,item:props.detail.id,payload:{...payload,requestId:crypto.randomUUID()}});sessionStorage.setItem(acceptancePendingKey(user.id),JSON.stringify(value));pending.value=value}
function clear(){sessionStorage.removeItem(acceptancePendingKey(user.id));pending.value=null}
async function saveAuthority(){if(blocked.value)return;error.value='';try{keep('authority',{...authority.value});await send(false)}catch(e){error.value=message(e)}}
async function saveMapping(){if(blocked.value)return;error.value='';try{keep('mapping',{...mapping.value});await send(false)}catch(e){error.value=message(e)}}
async function accept(){if(blocked.value||!verification.value?.ready)return;error.value='';try{keep('accept',{reviewHash:verification.value.reviewHash});await send(false)}catch(e){error.value=message(e)}}
async function result(data){const value=pending.value;clear();verification.value=null;mapping.value=null;await load();if(data.accepted){accepted.value=data;emit('accepted',value?.item);ElMessage.success(t('已生成仓库订单','Warehouse order created'))}else ElMessage.success(data.requestCancelled?t('原请求未提交，已结束','The original request had not committed and was cancelled'):t('设置已保存','Settings saved'))}
async function send(retrying){if(busy.value||!pending.value)return;busy.value=true;error.value='';try{const p=pending.value,r=p.kind==='authority'?await api.saveIntegrationAuthority(p.connection,p.payload):p.kind==='mapping'?await api.saveIntegrationMapping(p.connection,p.payload):await api.acceptIntegrationOrder(p.connection,p.item,p.payload);await result(r.data)}catch(e){if(!retrying&&rejectedBeforeCommit(e))clear();error.value=message(e)}finally{busy.value=false}}
async function resolve(){if(busy.value||!pending.value)return;busy.value=true;error.value='';try{const p=pending.value;await result((await api.resolveIntegrationRequest(p.connection,{kind:p.kind,...(p.item?{item:p.item}:{}),payload:p.payload})).data)}catch(e){error.value=message(e)}finally{busy.value=false}}
async function verify(){if(blocked.value)return;busy.value=true;error.value='';verification.value=null;try{const r=(await api.reviewIntegrationOrder(props.connection.id,props.detail.id)).data;if(r.accepted)accepted.value=r;else verification.value=r}catch(e){error.value=message(e)}finally{busy.value=false}}
function openOrder(){router.push({path:'/warehouse/orders',query:{order:acceptedId.value}})}
onMounted(()=>{try{const value=sessionStorage.getItem(acceptancePendingKey(user.id));if(value)pending.value=acceptancePending(JSON.parse(value))}catch{pendingError.value=t('原请求记录损坏，请先核对已接单记录','The pending record is invalid; reconcile accepted orders first')}})
</script>

<style scoped>
.acceptance-panel{margin-top:24px}.acceptance-panel h3{font-size:16px;margin:0 0 16px}.gap{margin:16px 0}.hint{max-width:75ch;color:var(--el-text-color-secondary);line-height:1.7}.identifier{overflow-wrap:anywhere}.buttons{display:flex;flex-wrap:wrap;gap:8px}.buttons .el-button{margin:0}.mapping-form{padding:16px 0;border-bottom:1px solid var(--el-border-color-lighter)}.mapping-form h4{margin:0 0 12px}.acceptance-panel :deep(.el-select){width:100%}.acceptance-panel :deep(.el-checkbox){height:auto;align-items:flex-start}.acceptance-panel :deep(.el-checkbox__label){white-space:normal;line-height:1.6}.line-issue{margin:6px 0 0;color:var(--el-color-danger)}.issues{line-height:1.7;padding-left:20px}
</style>
