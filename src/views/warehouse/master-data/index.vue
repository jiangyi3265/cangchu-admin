<template>
  <div class="app-container warehouse-master">
    <div class="warehouse-heading"><h2>{{ title }}</h2><span>{{ bilingual('基础资料', 'Master data') }}</span></div>
    <p v-if="['suppliers','channels'].includes(kind)" class="field-help">{{bilingual('这是共用资料，由管理员维护。停用后不能建立新关联，已有业务记录仍可继续处理。','These shared records are maintained by administrators. Deactivation blocks new assignments; existing business documents can still be processed.')}}</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="mb16" />
    <template v-if="entity">
      <el-form :inline="true" @submit.prevent="search">
        <el-form-item :label="bilingual('关键词', 'Keyword')"><el-input v-model="query.keyword" clearable :placeholder="bilingual('名称、编号或 SKU', 'Name, reference or SKU')" @keyup.enter="search" /></el-form-item>
        <el-form-item><el-button type="primary" icon="Search" :loading="loading" @click="search">{{ bilingual('搜索', 'Search') }}</el-button><el-button icon="Refresh" :disabled="loading" @click="resetSearch">{{ bilingual('重置', 'Reset') }}</el-button></el-form-item>
      </el-form>
      <el-row class="mb16"><el-col :span="24"><el-button v-if="canCreate" type="primary" plain icon="Plus" :disabled="loading || saving || transferBlocked" @click="edit()">{{ bilingual('新增', 'Add') }}</el-button><TransferPanel :key="kind" :kind="kind" :fields="entity.fields" :keyword="query.keyword" :total="total" :external-busy="saving" @changed="loadRecords" @blocked="transferBlocked=$event" /></el-col></el-row>
      <el-table v-loading="loading" :data="rows" row-key="id" border :empty-text="bilingual('暂无资料', 'No records')">
        <el-table-column v-for="column in columns" :key="column.key" :prop="column.key" :label="label(column)" :min-width="column.key === 'name' ? 200 : 145" show-overflow-tooltip>
          <template #default="scope">{{ display(scope.row[column.key], column.key) }}</template>
        </el-table-column>
        <el-table-column v-if="canView || canDelete" :label="bilingual('操作', 'Actions')" fixed="right" width="170"><template #default="scope">
          <el-button v-if="canView" link type="primary" icon="Edit" :disabled="saving || transferBlocked" @click="edit(scope.row)">{{ canEdit ? bilingual('编辑', 'Edit') : bilingual('查看', 'View') }}</el-button>
          <el-button v-if="canDelete" link type="danger" icon="Delete" :disabled="saving || transferBlocked" @click="remove(scope.row)">{{ bilingual('删除', 'Delete') }}</el-button>
        </template></el-table-column>
      </el-table>
      <pagination v-show="total > 0" :total="total" v-model:page="query.pageNum" v-model:limit="query.pageSize" @pagination="loadRecords" />
    </template>
    <el-empty v-else-if="!loading && !error" :description="bilingual('此类资料尚未开放', 'This record type is not available')" />
    <el-drawer v-model="opened" :title="(editingId ? (canEdit ? bilingual('编辑', 'Edit') : bilingual('查看', 'View')) : bilingual('新增', 'Add')) + ' · ' + title" size="min(760px, 100%)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" destroy-on-close>
      <el-alert v-if="formError" :title="formError" type="error" :closable="false" show-icon class="mb16" />
      <el-form ref="formRef" :model="form" label-position="top" :disabled="saving || !formWritable">
        <el-tabs v-model="activeTab"><el-tab-pane v-for="[group, items] in groups" :key="group" :label="groupLabel(group)" :name="group">
          <el-row :gutter="20"><el-col v-for="field in items" :key="fieldKey(field)" :xs="24" :sm="field.type === 'textarea' ? 24 : 12">
            <el-form-item :label="label(field)" :prop="fieldKey(field)" :rules="rules(field)">
              <el-select v-if="field.type === 'ref' || field.type === 'reference' || field.lookupSource" v-model="form[fieldKey(field)]" filterable remote clearable :remote-method="q => searchLookup(field, q)" :loading="lookupLoading[lookupSource(field)]" :disabled="readOnly(field)" style="width:100%">
                <el-option v-for="option in optionsFor(field)" :key="option.id" :label="option.label" :value="option.id" />
              </el-select>
              <el-select v-else-if="field.type === 'select'" v-model="form[fieldKey(field)]" clearable :disabled="readOnly(field)" style="width:100%"><el-option v-for="option in fieldOptions(field)" :key="String(option.value)" :label="label(option)" :value="option.value" /></el-select>
              <el-switch v-else-if="field.type === 'toggle' || field.type === 'boolean'" v-model="form[fieldKey(field)]" :active-value="toggleValues(field)[0]" :inactive-value="toggleValues(field)[1]" :disabled="readOnly(field)" />
              <el-input v-else-if="field.type === 'number' && field.financial" v-model="form[fieldKey(field)]" inputmode="decimal" maxlength="35" :disabled="readOnly(field)" />
              <el-input-number v-else-if="field.type === 'number'" v-model="form[fieldKey(field)]" :min="field.min" :max="field.max" :step="field.step || 1" controls-position="right" :disabled="readOnly(field)" style="width:100%" />
              <el-date-picker v-else-if="field.type === 'date'" v-model="form[fieldKey(field)]" type="date" value-format="YYYY-MM-DD" :disabled="readOnly(field)" style="width:100%" />
              <el-input v-else v-model="form[fieldKey(field)]" :type="field.type === 'textarea' ? 'textarea' : field.type === 'email' ? 'email' : 'text'" :rows="3" :maxlength="field.maxLength" :disabled="readOnly(field)" />
              <div v-if="field.help" class="field-help">{{ bilingual(field.helpZh || field.help, field.helpEn || field.help) }}</div>
            </el-form-item>
          </el-col></el-row>
        </el-tab-pane></el-tabs>
      </el-form>
      <template #footer><el-button :disabled="saving" @click="opened = false">{{ bilingual('取消', 'Cancel') }}</el-button><el-button v-if="formWritable" type="primary" :loading="saving" @click="save">{{ bilingual('保存', 'Save') }}</el-button></template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, ref, reactive, watch, toRaw } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import auth from '@/plugins/auth'
import useUserStore from '@/store/modules/user'
import TransferPanel from './TransferPanel.vue'
import { getWarehouseCatalog, listWarehouseRecords, getWarehouseRecord, createWarehouseRecord, updateWarehouseRecord, deleteWarehouseRecord, getWarehouseLookups } from '@/api/warehouse'
import { bilingual } from '@/warehouse/i18n'
import { editableKinds, entityFields, entityColumns, fieldKey, fieldOptions, initialValues, savePayload, lookupSource, lookupOptions, writableFields, lookupScope } from '@/warehouse/master-data'

const route = useRoute(), entity = ref(null), rows = ref([]), total = ref(0), loading = ref(false), saving = ref(false), error = ref(''), formError = ref(''), opened = ref(false), editingId = ref(null), version = ref(undefined), form = ref({}), formRef = ref(), activeTab = ref('General')
const query = reactive({ pageNum: 1, pageSize: 20, keyword: '' }), lookups = reactive({}), lookupLoading = reactive({})
const transferBlocked=ref(false)
const kind = computed(() => String(route.params.kind || route.meta.kind || route.query.kind || route.path.split('/').pop()))
const fields = computed(() => writableFields(entityFields(entity.value), auth.hasPermi('warehouse:finance:edit'))), columns = computed(() => entityColumns(entity.value)), title = computed(() => entity.value ? bilingual(entity.value.label, entity.value.labelEn) : bilingual('基础资料', 'Master data'))
const allowed = action => editableKinds.has(kind.value) && entity.value?.readOnly === false && auth.hasPermi('warehouse:' + kind.value + ':' + action)
const sharedWritable = computed(() => !['suppliers','channels'].includes(kind.value) || Number(useUserStore().id)===1)
const canCreate = computed(() => sharedWritable.value && allowed('add')), canEdit = computed(() => sharedWritable.value && allowed('edit')), canDelete = computed(() => sharedWritable.value && allowed('remove')), formWritable = computed(() => editingId.value ? canEdit.value : canCreate.value)
const canView = computed(() => auth.hasPermi('warehouse:' + kind.value + ':query'))
const groups = computed(() => { const grouped = new Map(); for (const field of fields.value) { const group = field.group || field.tab || 'General'; if (!grouped.has(group)) grouped.set(group, []); grouped.get(group).push(field) } return [...grouped] })
const groupLabel = value => { const tab = entity.value?.tabs?.find(tab => tab.labelEn === value || tab.label === value); return tab ? bilingual(tab.label, tab.labelEn) : bilingual(({ General: '基本资料', Details: '详细资料', Defaults: '默认设置', 'Extra Details': '附加资料', 'Hazardous Details': '危险品资料', 'Picking Costs': '拣货费用', 'Storage Costs': '仓储费用', 'Goods In Costs': '入库费用' })[value] || value, value) }
const label = value => bilingual(value.labelZh || value.label || value.name || value.key, value.labelEn || value.label || value.name || value.key)
const readOnly = field => !!(field.readOnly || field.readonly || field.disabled)
const rules = field => field.required && !readOnly(field) ? [{ required: true, message: bilingual('请填写或选择此项', 'Complete this field'), trigger: ['blur', 'change'] }] : []
function toggleValues(field) { const value = form.value[fieldKey(field)]; return value === 'Y' || value === 'N' || field.default === 'Y' || field.default === 'N' ? ['Y', 'N'] : [true, false] }
function display(value, key) { if (value == null || value === '') return '—'; const field = fields.value.find(item => fieldKey(item) === key); if (field && lookupSource(field)) return lookupOptions(field, lookups[lookupSource(field)] || []).find(item => item.id === value)?.label || value; if (typeof value === 'boolean') return value ? bilingual('是', 'Yes') : bilingual('否', 'No'); if (typeof value === 'object') return JSON.stringify(value); return value }
function optionsFor(field) { const values = lookupOptions(field, lookups[lookupSource(field)] || []), current = form.value[fieldKey(field)]; return current && !values.some(item => item.id === current) ? [{ id: current, label: String(current) }, ...values] : values }
const lookupTickets = new Map()
async function searchLookup(field, q = '') { const source = lookupSource(field); if (!source) return; const ticket=(lookupTickets.get(source)||0)+1;lookupTickets.set(source,ticket);lookupLoading[source] = true; try { const result = await getWarehouseLookups(source, q, opened.value ? lookupScope(source,form.value) : {}); if(lookupTickets.get(source)===ticket)lookups[source] = result.data } catch { formError.value = bilingual('关联资料加载失败，请重试', 'Related records could not be loaded. Try again.') } finally { if(lookupTickets.get(source)===ticket)lookupLoading[source] = false } }
let generation = 0
async function loadRecords() { const ticket = ++generation, target = kind.value; loading.value = true; error.value = ''; try { const result = await listWarehouseRecords(target, { ...query }); if (ticket !== generation) return; rows.value = result.rows; total.value = result.total } catch (e) { if (ticket === generation) error.value = e.message || bilingual('资料读取失败', 'Records could not be loaded') } finally { if (ticket === generation) loading.value = false } }
async function initialize() { generation++; opened.value = false; entity.value = null; rows.value = []; query.pageNum = 1; query.keyword = ''; const target = kind.value; loading.value = true; error.value = ''; try { const result = await getWarehouseCatalog(); if (target !== kind.value) return; entity.value = result.data.entities.find(item => item.kind === target); if (!entity.value) throw Error(bilingual('此类资料尚未开放', 'This record type is not available')); await loadRecords(); const sources = new Set(); for (const field of fields.value) if (lookupSource(field) && !sources.has(lookupSource(field))) { sources.add(lookupSource(field)); await searchLookup(field) } } catch (e) { if (target === kind.value) error.value = e.message || bilingual('读取失败', 'Could not load records') } finally { if (target === kind.value) loading.value = false } }
function search() { query.pageNum = 1; loadRecords() }
function resetSearch() { query.keyword = ''; search() }
let assigningForm = false
async function edit(row) { formError.value = ''; const target = kind.value; try { const record = row ? (await getWarehouseRecord(target, row.id)).data : null; if (target !== kind.value) return; editingId.value = record?.id || null; version.value = record?._version; assigningForm=true;form.value = initialValues(fields.value, record);assigningForm=false; activeTab.value = groups.value[0]?.[0] || 'General'; opened.value = true;for(const field of fields.value)if(['products','locations'].includes(lookupSource(field)))searchLookup(field) } catch (e) { assigningForm=false;if (target === kind.value) error.value = e.message || bilingual('详情读取失败', 'Could not load record') } }
watch(()=>[form.value.client,form.value.warehouse,form.value.defaultWarehouse],(next,previous)=>{if(assigningForm||!opened.value)return;for(const field of fields.value){const source=lookupSource(field);if(source==='products'&&next[0]!==previous[0]||source==='locations'&&(next[1]!==previous[1]||next[2]!==previous[2])){form.value[fieldKey(field)]='';searchLookup(field)}}},{flush:'sync'})
async function save() {
  if (saving.value || !formWritable.value) return
  const target = kind.value, id = editingId.value, recordVersion = version.value, snapshot = structuredClone(toRaw(form.value)), schema = fields.value
  saving.value = true; formError.value = ''
  try {
    if (!await formRef.value.validate().catch(() => false) || target !== kind.value || id !== editingId.value) return
    const payload = savePayload(schema, snapshot, id ? recordVersion : undefined)
    if (id) { if (!Number.isInteger(recordVersion)) throw Error(bilingual('缺少记录版本，请重新打开记录', 'Record version is missing. Reopen this record.')); await updateWarehouseRecord(target, id, payload) }
    else await createWarehouseRecord(target, payload)
    if (target === kind.value) { opened.value = false; await loadRecords() }
    ElMessage.success(bilingual('已保存', 'Saved'))
  } catch (e) { if (target === kind.value) formError.value = e.message || bilingual('保存失败，输入内容已保留', 'Save failed. Your input has been kept.') }
  finally { saving.value = false }
}
async function remove(row) {
  if (!canDelete.value || saving.value) return
  const target = kind.value
  saving.value = true
  try {
    try { await ElMessageBox.confirm(bilingual('确认删除这条资料？已有业务关联时系统会拒绝删除。', 'Delete this record? Existing business references can prevent deletion.'), bilingual('删除确认', 'Confirm deletion'), { type: 'warning', confirmButtonText: bilingual('删除', 'Delete'), cancelButtonText: bilingual('取消', 'Cancel') }) } catch { return }
    if (target !== kind.value) return
    if (!Number.isInteger(row._version)) throw Error(bilingual('缺少记录版本，请刷新列表', 'Record version is missing. Refresh the list.'))
    await deleteWarehouseRecord(target, row.id, row._version)
    ElMessage.success(bilingual('已删除', 'Deleted'))
    if (target === kind.value) await loadRecords()
  } catch (e) { if (target === kind.value) error.value = e.message || bilingual('删除失败', 'Delete failed') }
  finally { saving.value = false }
}
watch(kind, initialize, { immediate: true })
</script>

<style scoped>
.warehouse-heading { display:flex; align-items:baseline; gap:16px; margin-bottom:20px; }
.warehouse-heading h2 { margin:0; font-size:20px; font-weight:600; }
.warehouse-heading span,.field-help { color:var(--el-text-color-secondary); font-size:13px; }
.field-help { line-height:1.5; margin-top:6px; }
.mb16 { margin-bottom:16px; }
</style>
