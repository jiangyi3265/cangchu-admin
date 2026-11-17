<template>
  <div class="app-container warehouse-scopes">
    <h2>{{ bilingual('数据范围授权', 'Data access scopes') }}</h2>
    <el-alert :title="bilingual('分别指定用户可访问的客户和仓库。未授权的范围不可访问，留空表示没有授权。菜单和操作权限仍由角色管理。', 'Choose the clients and warehouses a user may access. An empty selection grants no access. Roles still control menus and actions.')" type="info" show-icon :closable="false" class="mb16" />
    <el-alert v-if="!canQuery" :title="bilingual('只有内置超级管理员可以读取和管理数据范围。', 'Only the built-in super administrator can read and manage data scopes.')" type="warning" show-icon :closable="false" />
    <el-row v-else :gutter="28">
      <el-col :xs="24" :lg="10">
        <h3>{{ bilingual('选择用户', 'Select a user') }}</h3>
        <el-form :inline="true" @submit.prevent="searchUsers">
          <el-form-item :label="bilingual('用户名', 'Username')"><el-input v-model="query.userName" clearable :maxlength="30" @keyup.enter="searchUsers" /></el-form-item>
          <el-form-item><el-button type="primary" icon="Search" :loading="usersLoading" @click="searchUsers">{{ bilingual('搜索', 'Search') }}</el-button></el-form-item>
        </el-form>
        <el-alert v-if="usersError" :title="usersError" type="error" show-icon :closable="false" class="mb16" />
        <el-table v-loading="usersLoading" :data="users" row-key="userId" border :empty-text="bilingual('没有匹配的用户', 'No matching users')">
          <el-table-column :label="bilingual('用户', 'User')" min-width="160"><template #default="scope"><strong>{{ scope.row.userName }}</strong><div class="secondary">{{ scope.row.nickName }} · ID {{ scope.row.userId }}</div></template></el-table-column>
          <el-table-column :label="bilingual('状态', 'Status')" width="110"><template #default="scope"><el-tag :type="disabledUser(scope.row) ? 'info' : 'success'">{{ Number(scope.row.userId) === 1 ? bilingual('超级管理员', 'Super admin') : disabledUser(scope.row) ? bilingual('已停用', 'Disabled') : bilingual('正常', 'Active') }}</el-tag></template></el-table-column>
          <el-table-column :label="bilingual('操作', 'Action')" width="105"><template #default="scope"><el-button link type="primary" :disabled="saving || scopesLoading || uncertain || !!review" @click="selectUser(scope.row)">{{ selected?.userId === scope.row.userId ? bilingual('已选择', 'Selected') : bilingual('选择', 'Select') }}</el-button></template></el-table-column>
        </el-table>
        <pagination v-show="usersTotal > 0" :total="usersTotal" v-model:page="query.pageNum" v-model:limit="query.pageSize" @pagination="loadUsers" />
      </el-col>
      <el-col :xs="24" :lg="14" class="scope-panel">
        <el-empty v-if="!selected" :description="bilingual('选择用户后读取其当前授权', 'Select a user to load their current scopes')" />
        <template v-else>
          <div class="panel-heading"><h3>{{ selected.userName }} · {{ bilingual('授权范围', 'Access scopes') }}</h3><el-button icon="Refresh" :loading="scopesLoading" :disabled="saving" @click="reloadScopes">{{ uncertain ? bilingual('读取并核对结果', 'Read and verify result') : bilingual('重新读取', 'Reload') }}</el-button></div>
          <el-alert v-if="scopeError" :title="scopeError" type="error" show-icon :closable="false" class="mb16" />
          <el-alert v-if="notice" :title="notice" type="info" show-icon :closable="false" class="mb16" />
          <el-alert v-if="uncertain" :title="bilingual('上次保存结果尚未确认，输入已保留。请读取服务器当前授权后核对，再继续操作。', 'The last save is unconfirmed. Your input is preserved. Read the current server scopes before continuing.')" type="warning" show-icon :closable="false" class="mb16" />
          <el-skeleton v-if="scopesLoading && !loaded" :rows="5" animated />
          <el-alert v-else-if="Number(selected.userId) === 1" :title="bilingual('内置超级管理员拥有全部数据范围，无需授权，也不能在此修改。', 'The built-in super administrator has unrestricted data access and cannot be changed here.')" type="info" show-icon :closable="false" />
          <template v-else-if="loaded">
            <el-alert v-if="disabledUser(selected)" :title="bilingual('此账号已停用，当前不能登录。可在此预配置启用后的数据范围。', 'This account is disabled and cannot sign in. You may configure data scopes for when it is enabled.')" type="warning" show-icon :closable="false" class="mb16" />
            <div v-if="review" class="review-block">
              <h4>{{ bilingual('服务器当前授权与本页不同', 'Server scopes differ from this page') }}</h4>
              <p class="secondary">{{ bilingual('请先核对。保留我的增删会在当前授权上应用本页变更，并保留其他新增授权。', 'Review before continuing. Keeping your changes applies your additions and removals to the current scopes while preserving other new grants.') }}</p>
              <div v-for="kind in kinds" :key="kind.key" class="review-row"><strong>{{ bilingual(kind.label, kind.labelEn) }}</strong><span>{{ review[kind.key].map(id => scopeLabel(kind.key, id)).join(', ') || bilingual('无授权', 'No access') }}</span></div>
              <div class="review-actions"><el-button :disabled="saving || scopesLoading" @click="resolveReview(false)">{{ bilingual('使用服务器当前授权', 'Use current server scopes') }}</el-button><el-button v-if="canEdit" :disabled="saving || scopesLoading" @click="resolveReview(true)">{{ bilingual('保留我的增删', 'Keep my changes') }}</el-button></div>
            </div>
            <el-form label-position="top" :disabled="!editable || saving || scopesLoading || uncertain || !!review">
              <el-form-item v-for="kind in kinds" :key="kind.key" :label="bilingual(kind.label, kind.labelEn) + ' (' + form[kind.key].length + ')'">
                <el-select v-model="form[kind.key]" multiple collapse-tags collapse-tags-tooltip :max-collapse-tags="3" filterable remote reserve-keyword :remote-method="q => searchScopes(kind.key, q)" :loading="lookupLoading[kind.key]" :multiple-limit="5000" :placeholder="bilingual('留空表示无授权；输入名称搜索', 'Empty means no access; search by name')" style="width:100%">
                  <el-option v-for="option in scopeOptions(kind.key)" :key="option.id" :label="option.label" :value="option.id" />
                </el-select>
                <div v-if="lookupErrors[kind.key]" class="lookup-error">{{ lookupErrors[kind.key] }} <el-button link type="primary" @click="searchScopes(kind.key)">{{ bilingual('重试读取', 'Retry lookup') }}</el-button></div>
                <div class="secondary helper">{{ bilingual('每次搜索显示最多 200 条。未出现在结果中的已有授权仍会保留，以原编号显示。', 'Each search shows up to 200 matches. Existing grants outside the results are preserved and shown by their IDs.') }}</div>
              </el-form-item>
            </el-form>
            <div class="save-row"><span class="secondary">{{ dirty ? bilingual('有未保存的变更', 'You have unsaved changes') : bilingual('与已读取的授权一致', 'Matches the loaded scopes') }}</span><el-button v-if="canEdit" type="primary" :loading="saving" :disabled="!editable || !dirty || scopesLoading || uncertain || !!review" @click="save">{{ bilingual('保存授权', 'Save scopes') }}</el-button></div>
          </template>
        </template>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import auth from '@/plugins/auth'
import useUserStore from '@/store/modules/user'
import { getWarehouseLookups } from '@/api/warehouse'
import { bilingual } from '@/warehouse/i18n'

const actor = useUserStore()
const canQuery = computed(() => Number(actor.id) === 1 && auth.hasPermi('warehouse:scope:query'))
const canEdit = computed(() => canQuery.value && auth.hasPermi('warehouse:scope:edit'))
const kinds = [{ key: 'clients', label: '客户', labelEn: 'Clients' }, { key: 'warehouses', label: '仓库', labelEn: 'Warehouses' }]
const query = reactive({ pageNum: 1, pageSize: 10, userName: '' })
const users = ref([]), usersTotal = ref(0), usersLoading = ref(false), usersError = ref('')
const selected = ref(null), loadedId = ref(null), scopesLoading = ref(false), saving = ref(false), scopeError = ref(''), notice = ref(''), uncertain = ref(false), review = ref(null)
const baseline = ref({ clients: [], warehouses: [], _version: '' }), form = reactive({ clients: [], warehouses: [] })
const options = reactive({ clients: [], warehouses: [] }), labels = reactive({ clients: new Map(), warehouses: new Map() }), lookupLoading = reactive({}), lookupErrors = reactive({}), lookupTickets = new Map()
const loaded = computed(() => selected.value && loadedId.value === selected.value.userId)
const editable = computed(() => canEdit.value && loaded.value && Number(selected.value?.userId) !== 1)
const dirty = computed(() => loaded.value && !equalScopes(form, baseline.value))
const disabledUser = user => String(user?.status) !== '0'
const scopePath = id => '/warehouse/security/scopes/' + encodeURIComponent(String(id))
const scopeLabel = (kind, id) => labels[kind].get(id) || id
function normaliseScopes(value, requireVersion = false) {
  const out = {}
  for (const { key } of kinds) {
    const values = value?.[key]
    if (!Array.isArray(values) || values.length > 5000 || values.some(id => typeof id !== 'string' || !id.trim() || id.length > 64) || new Set(values).size !== values.length) throw Error(bilingual('授权数据不完整，请重新读取。', 'Scope data is incomplete. Reload it before editing.'))
    out[key] = [...values].sort()
  }
  if (requireVersion) {
    if (typeof value._version !== 'string' || !/^[a-f0-9]{64}$/.test(value._version)) throw Error(bilingual('缺少有效授权版本，请重新读取。', 'A valid scope version is missing. Reload before editing.'))
    out._version = value._version
  }
  return out
}
function equalScopes(a, b) { return kinds.every(({ key }) => JSON.stringify([...a[key]].sort()) === JSON.stringify([...b[key]].sort())) }
function applyScopes(value) { const next = normaliseScopes(value, true); baseline.value = next; form.clients = [...next.clients]; form.warehouses = [...next.warehouses]; loadedId.value = selected.value.userId; review.value = null; uncertain.value = false }
function scopeOptions(kind) { const values = new Map(options[kind].map(item => [item.id, item])); for (const id of form[kind]) if (!values.has(id)) values.set(id, { id, label: scopeLabel(kind, id) }); return [...values.values()] }
async function searchScopes(kind, q = '') {
  if (!canQuery.value) return
  const ticket = (lookupTickets.get(kind) || 0) + 1; lookupTickets.set(kind, ticket); lookupLoading[kind] = true; lookupErrors[kind] = ''
  try { const result = await getWarehouseLookups(kind, q); if (lookupTickets.get(kind) !== ticket) return; options[kind] = result.data; for (const item of result.data) labels[kind].set(item.id, item.label) }
  catch (e) { if (lookupTickets.get(kind) === ticket) lookupErrors[kind] = e.message || bilingual('关联资料读取失败，已有授权已保留。', 'Lookup failed. Existing grants are preserved.') }
  finally { if (lookupTickets.get(kind) === ticket) lookupLoading[kind] = false }
}
let usersGeneration = 0
async function loadUsers() {
  if (!canQuery.value) return
  const ticket = ++usersGeneration; usersLoading.value = true; usersError.value = ''
  try { const result = await request({ url: '/system/user/list', method: 'get', params: { ...query } }); if (ticket === usersGeneration) { users.value = result.rows; usersTotal.value = result.total; const current = result.rows.find(row => row.userId === selected.value?.userId); if (current) selected.value = { ...current } } }
  catch (e) { if (ticket === usersGeneration) usersError.value = e.message || bilingual('用户列表读取失败', 'Could not load users') }
  finally { if (ticket === usersGeneration) usersLoading.value = false }
}
function searchUsers() { query.pageNum = 1; loadUsers() }
async function selectUser(row) {
  if (!canQuery.value || saving.value || scopesLoading.value || uncertain.value || review.value || row.userId === selected.value?.userId) return
  if (dirty.value) { try { await ElMessageBox.confirm(bilingual('切换用户将放弃当前未保存的变更。', 'Switching users discards your unsaved changes.'), bilingual('切换用户', 'Switch user'), { type: 'warning', confirmButtonText: bilingual('切换', 'Switch'), cancelButtonText: bilingual('取消', 'Cancel') }) } catch { return } }
  selected.value = { ...row }; loadedId.value = null; form.clients = []; form.warehouses = []; scopeError.value = ''; notice.value = ''
  await reloadScopes()
}
async function reloadScopes() {
  if (!canQuery.value || !selected.value || saving.value || scopesLoading.value) return
  const checking = uncertain.value || !!review.value
  if (dirty.value && !checking) { try { await ElMessageBox.confirm(bilingual('重新读取会替换本页未保存的输入。', 'Reloading replaces your unsaved input.'), bilingual('重新读取授权', 'Reload scopes'), { type: 'warning', confirmButtonText: bilingual('重新读取', 'Reload'), cancelButtonText: bilingual('取消', 'Cancel') }) } catch { return } }
  const id = selected.value.userId; scopesLoading.value = true; scopeError.value = ''; notice.value = ''
  try {
    const result = await request({ url: scopePath(id), method: 'get' }), current = normaliseScopes(result.data, true)
    if (id !== selected.value?.userId) return
    if (checking && !equalScopes(current, form)) { review.value = current; uncertain.value = false }
    else { applyScopes(current); notice.value = checking ? bilingual('已读取核对，服务器当前授权与本页输入一致。', 'Verified: current server scopes match your input.') : bilingual('已读取当前授权。', 'Current scopes loaded.') }
  } catch (e) { scopeError.value = e.message || bilingual('授权读取失败，尚不能提交修改。', 'Could not load scopes. Changes cannot be submitted yet.') }
  finally { scopesLoading.value = false }
}
function resolveReview(keepChanges) {
  if (!review.value || saving.value || scopesLoading.value) return
  const current = normaliseScopes(review.value, true), merged = {}
  for (const { key } of kinds) {
    const removed = new Set(baseline.value[key].filter(id => !form[key].includes(id)))
    const added = form[key].filter(id => !baseline.value[key].includes(id))
    merged[key] = [...new Set([...current[key].filter(id => !removed.has(id)), ...added])]
  }
  applyScopes(current)
  if (keepChanges) { form.clients = merged.clients; form.warehouses = merged.warehouses }
  scopeError.value = ''; notice.value = bilingual('已采用最新授权作为核对基础，请检查后再保存。', 'The latest scopes are loaded. Review your selection before saving.')
}
async function save() {
  if (!editable.value || !dirty.value || saving.value || scopesLoading.value || uncertain.value || review.value) return
  const id = selected.value.userId, next = { ...normaliseScopes(form), _version: baseline.value._version }
  saving.value = true; scopeError.value = ''; notice.value = ''
  let sent = false
  try {
    try { await ElMessageBox.confirm(bilingual('确认保存 ', 'Save scopes for ') + selected.value.userName + '? ' + bilingual('客户 ', 'Clients: ') + next.clients.length + ', ' + bilingual('仓库 ', 'Warehouses: ') + next.warehouses.length + '. ' + bilingual('空范围表示无授权。', 'An empty scope grants no access.'), bilingual('确认变更授权', 'Confirm scope changes'), { type: 'warning', confirmButtonText: bilingual('保存授权', 'Save scopes'), cancelButtonText: bilingual('取消', 'Cancel') }) } catch { return }
    const current = normaliseScopes((await request({ url: scopePath(id), method: 'get' })).data, true)
    if (!equalScopes(current, baseline.value) || current._version !== baseline.value._version) { review.value = current; notice.value = bilingual('授权已被更新，本次尚未提交。请核对差异。', 'Scopes have changed. Nothing was submitted. Review the differences.'); return }
    if (!editable.value || id !== selected.value?.userId) return
    sent = true
    const result = await request({ url: scopePath(id), method: 'put', data: next, headers: { repeatSubmit: false } })
    const saved = normaliseScopes(result.data, true)
    if (!equalScopes(saved, next)) throw Error(bilingual('保存响应与提交内容不一致。', 'The save response does not match the submitted scopes.'))
    applyScopes(saved); ElMessage.success(bilingual('授权已保存', 'Scopes saved'))
  } catch (e) {
    const rejected = [400, 403, 404, 409, 422].includes(Number(e.response?.data?.code)) && e.response?.data?.data?.committed === false
    uncertain.value = sent && !rejected
    scopeError.value = e.message || bilingual('授权保存失败，输入已保留。', 'Could not save scopes. Your input is preserved.')
  } finally { saving.value = false }
}
onMounted(async () => { if (canQuery.value) await Promise.all([loadUsers(), ...kinds.map(({ key }) => searchScopes(key))]) })
</script>

<style scoped>
.warehouse-scopes h2 { margin:0 0 20px; font-size:20px; font-weight:600; }
.warehouse-scopes h3 { margin:0 0 20px; font-size:16px; font-weight:600; }
.mb16 { margin-bottom:16px; }
.secondary { color:var(--el-text-color-secondary); font-size:13px; line-height:1.6; }
.helper { margin-top:8px; }
.panel-heading,.save-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.panel-heading { margin-bottom:20px; }.panel-heading h3 { margin:0; }
.scope-panel { min-width:0; }.lookup-error { color:var(--el-color-danger); }
.review-block { margin-bottom:20px; padding:16px; border:1px solid var(--el-border-color); border-radius:4px; }
.review-block h4 { margin:0 0 8px; font-size:14px; }.review-block p { margin:0 0 12px; }
.review-row { display:grid; grid-template-columns:90px minmax(0,1fr); gap:12px; margin:8px 0; font-size:13px; overflow-wrap:anywhere; }
.review-row span { max-height:160px; overflow:auto; }
.review-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; }.review-actions :deep(.el-button) { margin-left:0; }
.save-row { padding-top:8px; }.scope-panel :deep(.el-select__selected-item) { max-width:100%; }
@media(max-width:1199px) { .scope-panel { margin-top:28px; } }
@media(max-width:600px) { .panel-heading,.save-row { align-items:flex-start; flex-wrap:wrap; }.warehouse-scopes :deep(.el-form--inline .el-form-item) { margin-right:12px; }.review-row { grid-template-columns:1fr; gap:2px; } }
</style>
