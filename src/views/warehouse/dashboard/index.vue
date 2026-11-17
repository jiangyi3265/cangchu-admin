<template><div class="app-container"><div class="heading"><h2>{{ bilingual('仓储概览', 'Warehouse overview') }}</h2><el-button v-if="canDashboard || canCatalog" icon="Refresh" :loading="loading" @click="load">{{ bilingual('刷新', 'Refresh') }}</el-button></div><el-alert v-if="!canDashboard && !canCatalog" type="info" show-icon :closable="false" :title="bilingual('请从左侧菜单进入你的工作页面。', 'Choose your work page from the navigation menu.')" /><el-alert v-if="error" :title="error" type="error" show-icon :closable="false" /><el-descriptions v-if="summary" :column="2" border class="summary"><el-descriptions-item v-for="(value, key) in counts" :key="key" :label="labels[key] || key">{{ value }}</el-descriptions-item></el-descriptions><template v-if="canDashboard || canCatalog"><h3>{{ bilingual('业务模块', 'Modules') }}</h3><el-table v-loading="loading" :data="modules" border :empty-text="bilingual('尚未取得业务状态', 'Module status is unavailable')"><el-table-column :label="bilingual('模块', 'Module')"><template #default="scope">{{ bilingual(scope.row.label || scope.row.name, scope.row.labelEn || scope.row.name) }}</template></el-table-column><el-table-column :label="bilingual('状态', 'Status')" width="190"><template #default="scope"><el-tag :type="scope.row.available === true ? 'success' : 'info'">{{ scope.row.available === true ? bilingual('已开放', 'Available') : bilingual('暂不可操作', 'Not available') }}</el-tag></template></el-table-column><el-table-column :label="bilingual('说明', 'Notes')"><template #default="scope">{{ bilingual(scope.row.description || '', scope.row.descriptionEn || scope.row.description || '') }}</template></el-table-column></el-table></template></div></template>
<script setup>
import { computed, ref, onMounted } from 'vue'
import { getWarehouseDashboard, getWarehouseCapabilities } from '@/api/warehouse'
import { bilingual } from '@/warehouse/i18n'
import auth from '@/plugins/auth'
const summary = ref(null), modules = ref([]), loading = ref(false), error = ref('')
const canDashboard = computed(() => auth.hasPermi('warehouse:dashboard:query')), canCatalog = computed(() => auth.hasPermi('warehouse:catalog:list'))
const counts = computed(() => Object.fromEntries(Object.entries(summary.value?.counts || {}).filter(([, value]) => typeof value === 'number')))
const labels = computed(() => ({ clients: bilingual('客户', 'Clients'), products: bilingual('商品', 'Products'), warehouses: bilingual('仓库', 'Warehouses'), locations: bilingual('库位', 'Locations'), orders: bilingual('订单', 'Orders'), asns: bilingual('入库单', 'Inbound notices'), invoices: bilingual('账单', 'Invoices') }))
async function load() {
  loading.value = true; error.value = ''; summary.value = null; modules.value = []
  try {
    const [dashboard, capabilities] = await Promise.all([canDashboard.value ? getWarehouseDashboard() : null, canCatalog.value && !canDashboard.value ? getWarehouseCapabilities() : null])
    summary.value = dashboard?.data || null
    const available = dashboard?.data?.capabilities || capabilities?.data || []
    modules.value = Array.isArray(available) ? available : available.modules || []
  } catch (e) { error.value = e.message || bilingual('概览读取失败', 'Overview could not be loaded') } finally { loading.value = false }
}
onMounted(load)
</script>
<style scoped>.heading { display:flex; align-items:center; justify-content:space-between; }.heading h2 { font-size:20px; }.summary { margin:20px 0; }h3 { margin-top:28px; font-size:16px; }</style>
