<template>
  <div class="app-container warehouse-inventory">
    <div class="heading"><h2>{{ bilingual('库存管理', 'Inventory') }}</h2><el-button v-if="canMove" type="primary" icon="Plus" :disabled="saving || !!pending || !!pendingError" @click="openMovement(null, 'add')">{{ bilingual('人工入库', 'Add stock') }}</el-button></div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="mb16" />
    <el-alert v-if="pending || pendingError" type="warning" show-icon :closable="false" class="mb16" :title="pendingError || bilingual('上次库存提交尚未确认，请先核对原请求结果', 'The last stock operation is unconfirmed. Check its original request before starting another.')">
      <template v-if="pending" #default><div class="pending-id">{{ bilingual('请求编号', 'Request ID') }}: {{ pending.payload.requestId }}</div><el-button :loading="saving" @click="showPending">{{ bilingual('查看并重试原请求', 'View and retry original request') }}</el-button></template>
    </el-alert>
    <el-form :inline="true" @submit.prevent="search">
      <el-form-item v-for="filter in filters" :key="filter.key" :label="bilingual(filter.label, filter.labelEn)"><el-select v-model="query[filter.key]" filterable remote clearable :remote-method="q => loadLookup(filter.source, q, filterScope(filter))" :loading="lookupLoading[filter.source]" class="filter-select"><el-option v-for="option in lookupValues(filter.source, filterScope(filter))" :key="option.id" :label="option.label" :value="option.id" /></el-select></el-form-item>
      <el-form-item :label="bilingual('关键词', 'Keyword')"><el-input v-model="query.keyword" clearable :placeholder="bilingual('SKU、商品名称或批次', 'SKU, product name or batch')" @keyup.enter="search" /></el-form-item>
      <el-form-item><el-button type="primary" icon="Search" :loading="loading" @click="search">{{ bilingual('搜索', 'Search') }}</el-button><el-button icon="Refresh" :disabled="loading" @click="resetSearch">{{ bilingual('重置', 'Reset') }}</el-button></el-form-item>
    </el-form>
    <el-table v-loading="loading" :data="rows" row-key="id" border :empty-text="bilingual('暂无库存记录', 'No stock records')">
      <el-table-column v-for="column in columns" :key="column.key" :prop="column.key" :label="bilingual(column.label, column.labelEn)" :min-width="column.width || 130" show-overflow-tooltip><template #default="scope">{{ cell(scope.row, column.key) }}</template></el-table-column>
      <el-table-column v-if="canMove" :label="bilingual('操作', 'Actions')" width="155" fixed="right"><template #default="scope"><el-button link type="primary" :disabled="saving || !!pending || !!pendingError || Number(scope.row.available) <= 0" @click="openMovement(scope.row, 'transfer')">{{ bilingual('移库', 'Transfer') }}</el-button><el-button link type="danger" :disabled="saving || !!pending || !!pendingError || Number(scope.row.available) <= 0" @click="openMovement(scope.row, 'remove')">{{ bilingual('扣减', 'Remove') }}</el-button></template></el-table-column>
    </el-table>
    <pagination v-show="total > 0" :total="total" v-model:page="query.pageNum" v-model:limit="query.pageSize" @pagination="load" />
    <el-drawer v-model="opened" :title="actionLabel(form.action)" size="min(650px, 100%)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <el-alert type="info" :closable="false" show-icon :title="bilingual('此处仅调整实物库存，不自动生成费用。预留库存不能扣减或转移。', 'These manual operations adjust physical stock without creating charges. Reserved stock cannot be removed or transferred.')" class="mb16" />
      <el-alert v-if="formError" :title="formError" type="error" :closable="false" show-icon class="mb16" />
      <el-form ref="formRef" :model="form" label-position="top" :disabled="saving || !!pending">
        <el-row :gutter="20"><el-col v-for="item in sourceFields" :key="item.key" :xs="24" :sm="12"><el-form-item :label="bilingual(item.label, item.labelEn)" :prop="item.key" :rules="requiredRules(item.required)"><el-select v-model="form[item.key]" :disabled="form.action !== 'add'" filterable remote clearable :remote-method="q => loadLookup(item.source, q, itemScope(item))" :loading="lookupLoading[item.source]" style="width:100%"><el-option v-for="option in formOptions(item.source, form[item.key], itemScope(item))" :key="option.id" :label="option.label" :value="option.id" /></el-select></el-form-item></el-col></el-row>
        <el-row :gutter="20"><el-col v-for="item in trackingFields" :key="item.key" :xs="24" :sm="12"><el-form-item :label="bilingual(item.label, item.labelEn)"><el-date-picker v-if="item.key === 'expiry'" v-model="form.expiry" :disabled="form.action !== 'add'" type="date" value-format="YYYY-MM-DD" style="width:100%" /><el-input v-else v-model="form[item.key]" :disabled="form.action !== 'add'" maxlength="191" /></el-form-item></el-col></el-row>
        <el-row v-if="form.action === 'transfer'" :gutter="20"><el-col v-for="item in targetFields" :key="item.key" :xs="24" :sm="12"><el-form-item :label="bilingual(item.label, item.labelEn)" :prop="item.key" :rules="requiredRules(item.required)"><el-select v-model="form[item.key]" filterable remote clearable :remote-method="q => loadLookup(item.source, q, itemScope(item))" :loading="lookupLoading[item.source]" style="width:100%"><el-option v-for="option in formOptions(item.source, form[item.key], itemScope(item))" :key="option.id" :label="option.label" :value="option.id" /></el-select></el-form-item></el-col></el-row>
        <el-form-item :label="bilingual('数量', 'Quantity')" prop="quantity" :rules="requiredRules(true)"><el-input-number v-model="form.quantity" :min="1" :max="form.serial ? 1 : 10000000" :precision="0" :step="1" controls-position="right" /><span v-if="sourceAvailable !== null" class="available">{{ bilingual('当前可用', 'Currently available') }}: {{ sourceAvailable }}</span></el-form-item>
        <el-form-item :label="bilingual('操作原因', 'Reason')" prop="reason" :rules="requiredRules(true)"><el-input v-model="form.reason" type="textarea" :rows="3" maxlength="500" show-word-limit /></el-form-item>
      </el-form>
      <div v-if="pending" class="pending-id">{{ bilingual('请求编号', 'Request ID') }}: {{ pending.payload.requestId }}</div>
      <template #footer><el-button :disabled="saving" @click="opened = false">{{ bilingual('关闭', 'Close') }}</el-button><el-button v-if="canMove" type="primary" :loading="saving" :disabled="!!pendingError" @click="submit">{{ pending ? bilingual('重试原请求', 'Retry original request') : bilingual('确认提交', 'Confirm operation') }}</el-button></template>
    </el-drawer>
  </div>
</template>
<script setup>
import { computed, reactive, ref, onMounted, toRaw, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import auth from '@/plugins/auth'
import useUserStore from '@/store/modules/user'
import { bilingual } from '@/warehouse/i18n'
import { listWarehouseInventory, getWarehouseLookups, postWarehouseMovement } from '@/api/warehouse'
import { movementPayload, rowMovement, pendingStorageKey, readPendingMovement, rejectedBeforeCommit } from '@/warehouse/inventory'
const user = useUserStore(), canMove = computed(() => auth.hasPermi('warehouse:inventory:move'))
const query = reactive({ pageNum: 1, pageSize: 20, keyword: '', client: '', product: '', warehouse: '' }), rows = ref([]), total = ref(0), loading = ref(false), saving = ref(false), error = ref(''), formError = ref(''), opened = ref(false), formRef = ref(), form = ref(rowMovement(null, 'add')), sourceAvailable = ref(null), pending = ref(null), pendingError = ref('')
const options = reactive({}), lookupLoading = reactive({}), lookupGenerations = new Map()
const filters = [{ key: 'client', source: 'clients', label: '客户', labelEn: 'Client' }, { key: 'product', source: 'products', label: '商品', labelEn: 'Product' }, { key: 'warehouse', source: 'warehouses', label: '仓库', labelEn: 'Warehouse' }]
const sourceFields = [{ key: 'client', source: 'clients', label: '客户筛选', labelEn: 'Client filter', required: false }, { key: 'product', source: 'products', label: '商品', labelEn: 'Product', required: true }, { key: 'warehouse', source: 'warehouses', label: '来源仓库', labelEn: 'Source warehouse', required: true }, { key: 'location', source: 'locations', label: '来源库位', labelEn: 'Source location', required: true }]
const targetFields = [{ key: 'toWarehouse', source: 'warehouses', label: '目标仓库', labelEn: 'Destination warehouse', required: true }, { key: 'toLocation', source: 'locations', label: '目标库位', labelEn: 'Destination location', required: true }]
const trackingFields = [{ key: 'batch', label: '批次', labelEn: 'Batch' }, { key: 'serial', label: '序列号', labelEn: 'Serial number' }, { key: 'expiry', label: '到期日期', labelEn: 'Expiry date' }]
const columns = [{ key: 'clientName', label: '客户', labelEn: 'Client', width: 150 }, { key: 'sku', label: 'SKU', labelEn: 'SKU' }, { key: 'productName', label: '商品', labelEn: 'Product', width: 180 }, { key: 'warehouseName', label: '仓库', labelEn: 'Warehouse' }, { key: 'locationName', label: '库位', labelEn: 'Location' }, { key: 'batch', label: '批次', labelEn: 'Batch' }, { key: 'serial', label: '序列号', labelEn: 'Serial' }, { key: 'expiry', label: '到期日期', labelEn: 'Expiry' }, { key: 'onhand', label: '实物库存', labelEn: 'On hand', width: 105 }, { key: 'reserved', label: '已预留', labelEn: 'Reserved', width: 105 }, { key: 'available', label: '可用库存', labelEn: 'Available', width: 105 }, { key: 'quarantined', label: '隔离保管', labelEn: 'Quarantine', width: 120 }, { key: 'stocktakeId', label: '盘点状态', labelEn: 'Count status', width: 120 }, { key: 'oldestReceivedAt', label: '最早入库时间', labelEn: 'Oldest receipt', width: 175 }]
const cell = (row, key) => key === 'quarantined' ? (row.quarantined ? bilingual('隔离保管', 'Quarantined') : '—') : key === 'stocktakeId' ? (row.stocktakeId ? bilingual('盘点冻结', 'Frozen for count') : bilingual('正常', 'Normal')) : row[key] ?? row[({ productName: 'product', clientName: 'client', warehouseName: 'warehouse', locationName: 'location' })[key]] ?? '—'
const actionLabel = action => ({ add: bilingual('人工入库', 'Add stock'), remove: bilingual('人工扣减', 'Remove stock'), transfer: bilingual('库存转移', 'Transfer stock') })[action]
const requiredRules = required => required ? [{ required: true, message: bilingual('请填写或选择此项', 'Complete this field'), trigger: ['blur', 'change'] }] : []
const lookupKey = (source, scope = {}) => [source,scope.client || '',scope.warehouse || ''].join(':')
const lookupValues = (source, scope = {}) => options[lookupKey(source,scope)] || []
const filterScope = filter => filter.source==='products'&&query.client?{client:query.client}:{}
const itemScope = item => item.source==='products'&&form.value.client?{client:form.value.client}:item.source==='locations'?(item.key==='toLocation'?(form.value.toWarehouse?{warehouse:form.value.toWarehouse}:{}):(form.value.warehouse?{warehouse:form.value.warehouse}:{})):{}
function formOptions(source, current, scope={}) { const values = lookupValues(source,scope); return current && !values.some(item => item.id === current) ? [{ id: current, label: String(current) }, ...values] : values }
async function loadLookup(source, q = '', scope={}) { const key=lookupKey(source,scope),ticket = (lookupGenerations.get(key) || 0) + 1; lookupGenerations.set(key, ticket); lookupLoading[source] = true; try { const result = await getWarehouseLookups(source, q, scope); if (lookupGenerations.get(key) === ticket) options[key] = result.data } catch (e) { error.value = e.message || bilingual('关联资料读取失败', 'Related records could not be loaded') } finally { if (lookupGenerations.get(key) === ticket) lookupLoading[source] = false } }
let generation = 0
async function load() { const ticket = ++generation; loading.value = true; error.value = ''; try { const result = await listWarehouseInventory({ ...query }); if (ticket === generation) { rows.value = result.rows; total.value = result.total } } catch (e) { if (ticket === generation) error.value = e.message || bilingual('库存读取失败', 'Inventory could not be loaded') } finally { if (ticket === generation) loading.value = false } }
function search() { query.pageNum = 1; load() }
function resetSearch() { Object.assign(query, { pageNum: 1, keyword: '', client: '', product: '', warehouse: '' }); load() }
let assigningForm=false
function openMovement(row, action) { if (!canMove.value || pending.value || pendingError.value) return; assigningForm=true;form.value = {...rowMovement(row, action),client:row?.client || query.client || ''};assigningForm=false; sourceAvailable.value = row ? row.available : null; formError.value = ''; opened.value = true;for(const item of sourceFields)if(['products','locations'].includes(item.source))loadLookup(item.source,'',itemScope(item)) }
function showPending() { if (!pending.value) return; assigningForm=true;form.value = structuredClone(toRaw(pending.value.payload));assigningForm=false; sourceAvailable.value = null; formError.value = bilingual('提交结果尚未确认。重试将使用原编号和原内容，不能修改。', 'The result is unconfirmed. Retry uses the original ID and content without changes.'); opened.value = true }
watch(()=>query.client,()=>{query.product='';loadLookup('products','',query.client?{client:query.client}:{})})
watch(()=>[form.value.client,form.value.warehouse,form.value.toWarehouse],(next,previous)=>{if(assigningForm||!opened.value||pending.value)return;if(next[0]!==previous[0]){form.value.product='';loadLookup('products','',next[0]?{client:next[0]}:{})}if(next[1]!==previous[1]){form.value.location='';loadLookup('locations','',next[1]?{warehouse:next[1]}:{})}if(next[2]!==previous[2]){form.value.toLocation='';loadLookup('locations','',next[2]?{warehouse:next[2]}:{})}},{flush:'sync'})
async function submit() {
  if (saving.value || !canMove.value || pendingError.value) return
  const retrying = !!pending.value
  saving.value = true; formError.value = ''
  try {
    if (!retrying) {
      if (!await formRef.value.validate().catch(() => false)) return
      try { await ElMessageBox.confirm(bilingual('确认提交这次库存调整？', 'Confirm this stock operation?'), actionLabel(form.value.action), { type: 'warning', confirmButtonText: bilingual('提交', 'Confirm'), cancelButtonText: bilingual('取消', 'Cancel') }) } catch { return }
      try {
        const next = { payload: movementPayload(form.value, crypto.randomUUID()), createdAt: new Date().toISOString() }
        sessionStorage.setItem(pendingStorageKey(user.id), JSON.stringify(next))
        pending.value = next
      } catch { formError.value = bilingual('无法安全保存请求编号，尚未提交。请检查浏览器存储权限。', 'The request ID could not be saved safely. Nothing was submitted. Check browser storage permissions.'); return }
    }
    try {
      await postWarehouseMovement(structuredClone(toRaw(pending.value.payload)))
      sessionStorage.removeItem(pendingStorageKey(user.id)); pending.value = null; opened.value = false
      ElMessage.success(bilingual('库存调整已完成', 'Stock operation completed')); await load()
    } catch (e) {
      if (!retrying && rejectedBeforeCommit(e)) { sessionStorage.removeItem(pendingStorageKey(user.id)); pending.value = null; formError.value = e.message || bilingual('操作被拒绝，库存未修改', 'The operation was rejected without changing stock') }
      else formError.value = (e.message || bilingual('请求失败', 'Request failed')) + ' · ' + bilingual('结果尚未确认，请重试原请求。', 'The result is unconfirmed. Retry the original request.')
    }
  } finally { saving.value = false }
}
onMounted(async () => { try { pending.value = readPendingMovement(sessionStorage, user.id) } catch { pendingError.value = bilingual('上次请求记录无法读取，新的库存操作已暂停，请联系管理员核对。', 'The previous request record cannot be read. New stock operations are paused until an administrator checks it.') } await Promise.all([load(), ...['clients', 'products', 'warehouses', 'locations'].map(source => loadLookup(source))]) })
</script>
<style scoped>
.heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:20px; }.heading h2 { font-size:20px; font-weight:600; margin:0; }.mb16 { margin-bottom:16px; }.filter-select { width:200px; }.available { margin-left:12px; color:var(--el-text-color-secondary); }.pending-id { overflow-wrap:anywhere; margin:8px 0 12px; font-size:12px; }
@media(max-width:600px) { .warehouse-inventory :deep(.el-form--inline .el-form-item) { display:flex; margin-right:0; }.filter-select { width:100%; }.available { display:block; margin:8px 0 0; } }
</style>


