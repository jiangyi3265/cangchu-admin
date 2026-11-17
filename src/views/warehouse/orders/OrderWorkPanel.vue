<template>
  <section class="order-work" v-if="nativeOrder(order) && order.allocations?.length">
    <div class="work-heading"><h3>{{ t('扫码与装箱', 'Scanning and packing') }}</h3><el-button :disabled="busy" @click="$emit('refresh')">{{ t('刷新作业记录', 'Refresh work') }}</el-button></div>
    <el-alert :closable="false" type="info" :title="order.scanRequired ? t('本单需逐件扫齐、确认拣货并全部装箱，才可发货。', 'Scan every unit, confirm picking and seal all packages before despatch.') : t('本单可手工确认拣货；一旦开始扫码，后续必须完成扫码和装箱。', 'Manual picking is available. Starting a scan makes scanning and packing mandatory for this order.')" />
    <div class="work-summary" aria-live="polite">
      <el-tag :type="work.scanningComplete ? 'success' : 'info'">{{ t('已扫码', 'Scanned') }} {{ scanned }} / {{ quantity }}</el-tag>
      <el-tag :type="work.packingComplete ? 'success' : 'info'">{{ t('已装箱', 'Packed') }} {{ packed }} / {{ quantity }}</el-tag>
      <span>{{ work.activePackageCount || 0 }} {{ t('箱', 'packages') }} · {{ work.totalWeightKg || '0' }} kg</span>
    </div>
    <el-table :data="progress" border class="mb16" :aria-label="t('作业进度', 'Work progress')">
      <el-table-column prop="sku" label="SKU" min-width="130" />
      <el-table-column prop="locationName" :label="t('库位', 'Location')" min-width="100" />
      <el-table-column prop="batch" :label="t('批次', 'Batch')" min-width="100" />
      <el-table-column prop="serial" :label="t('串号', 'Serial')" min-width="120" />
      <el-table-column :label="t('扫码 / 应扫', 'Scanned / required')" width="130"><template #default="{ row }">{{ row.scanned }} / {{ row.quantity }}</template></el-table-column>
      <el-table-column :label="t('装箱 / 应装', 'Packed / required')" width="130"><template #default="{ row }">{{ row.packed }} / {{ row.quantity }}</template></el-table-column>
    </el-table>
    <el-form v-if="order.status === 'ALLOCATED' && can('scan')" :disabled="disabled" label-position="top" @submit.prevent="scan">
      <el-form-item :label="t('扫描分配行', 'Allocation to scan')"><el-select v-model="allocationId" :aria-label="t('扫描分配行', 'Allocation to scan')" class="full"><el-option v-for="row in scannable" :key="row.id" :value="row.id" :label="[row.sku, row.locationName, row.batch, row.serial, t('剩余 ', 'Remaining ') + row.scanRemaining].filter(Boolean).join(' · ')" /></el-select></el-form-item>
      <div class="scan-fields">
        <el-form-item :label="t('商品条码', 'Product barcode')"><el-input ref="barcodeInput" v-model="barcode" :aria-label="t('商品条码', 'Product barcode')" autocomplete="off" maxlength="191" @keydown.enter.prevent="scanOrSerial" /></el-form-item>
        <el-form-item v-if="selected?.serial" :label="t('实物串号', 'Unit serial')"><el-input ref="serialInput" v-model="serial" :aria-label="t('实物串号', 'Unit serial')" autocomplete="off" maxlength="191" @keydown.enter.prevent="scan" /></el-form-item>
      </div>
      <p class="hint">{{ t('每次扫描记 1 件；商品未配置条码或 UPC 时，可扫描 SKU。', 'Each scan records one unit. Scan the SKU only when no barcode or UPC is configured.') }}</p>
      <el-button type="primary" :disabled="!selected || !barcode.trim() || (!!selected.serial && !serial.trim()) || disabled" :loading="busy" @click="scan">{{ t('记录扫描', 'Record scan') }}</el-button>
    </el-form>
    <div v-if="order.status === 'PICKED'" class="packing-actions">
      <el-button v-if="can('pack')" type="primary" :disabled="disabled || !work.scanningComplete || !remaining.length" @click="openPackage">{{ t('新增包裹', 'Add package') }}</el-button>
      <el-button v-if="can('reopenpick')" :disabled="disabled || work.activePackageCount > 0" @click="undo('reopenpick')">{{ t('返回拣货核验', 'Reopen picking') }}</el-button>
    </div>
    <el-form v-if="packing" class="package-form" :disabled="disabled" label-position="top" @submit.prevent>
      <h4>{{ t('包裹实测信息', 'Measured package details') }}</h4>
      <div class="measurements"><el-form-item v-for="field in packageFields" :key="field.key" :label="t(field.zh, field.en)"><el-input v-model="packageForm[field.key]" :aria-label="t(field.zh, field.en)" :inputmode="field.key === 'packageCode' ? 'text' : 'decimal'" :maxlength="field.key === 'packageCode' ? 100 : 20" /></el-form-item></div>
      <el-table :data="packageForm.lines" border><el-table-column prop="sku" label="SKU" min-width="130" /><el-table-column prop="locationName" :label="t('库位', 'Location')" min-width="100" /><el-table-column prop="serial" :label="t('串号', 'Serial')" min-width="100" /><el-table-column :label="t('本箱数量', 'Quantity in box')" width="170"><template #default="{ row }"><el-input-number v-model="row.quantity" :min="0" :max="row.packRemaining" :precision="0" :aria-label="t('本箱数量 ', 'Box quantity ') + row.sku" controls-position="right" /></template></el-table-column></el-table>
      <p class="hint">{{ t('数量填 0 的行不装入本箱；撤销后的包裹编号不能复用。', 'Lines with zero quantity are excluded. A voided package code cannot be reused.') }}</p>
      <el-form-item :label="t('装箱备注', 'Packing notes')"><el-input v-model="packageForm.notes" type="textarea" maxlength="500" /></el-form-item>
      <el-button type="primary" :loading="busy" @click="seal">{{ t('确认封箱', 'Seal package') }}</el-button><el-button @click="packing = false">{{ t('收起', 'Hide') }}</el-button>
    </el-form>
    <h4>{{ t('包裹记录', 'Package history') }}</h4>
    <el-table :data="work.packages || []" border :empty-text="t('暂无包裹', 'No packages')">
      <el-table-column type="expand"><template #default="{ row }"><div class="manifest"><p>{{ t('装箱清单', 'Contents') }}: {{ manifest(row) }}</p><p v-if="row.notes">{{ row.notes }}</p><p v-if="row.voidReason">{{ t('撤销原因', 'Void reason') }}: {{ row.voidReason }}</p></div></template></el-table-column>
      <el-table-column prop="packageCode" :label="t('包裹编号', 'Package code')" min-width="140" />
      <el-table-column :label="t('状态', 'State')" width="110"><template #default="{ row }">{{ state(row.state) }}</template></el-table-column>
      <el-table-column prop="weightKg" :label="t('重量 kg', 'Weight kg')" width="110" />
      <el-table-column :label="t('长 × 宽 × 高 cm', 'L × W × H cm')" min-width="190"><template #default="{ row }">{{ row.lengthCm }} × {{ row.widthCm }} × {{ row.heightCm }}</template></el-table-column>
      <el-table-column v-if="active && can('unpack')" :label="t('操作', 'Actions')" width="110"><template #default="{ row }"><el-button v-if="row.state === 'SEALED'" link type="danger" :disabled="disabled" @click="undo('unpack', row.id)">{{ t('撤销装箱', 'Void package') }}</el-button></template></el-table-column>
    </el-table>
    <h4>{{ t('扫码记录（最近 100 条）', 'Scan history (latest 100)') }} · {{ work.scanEventCount || 0 }}</h4>
    <el-table :data="recentScans" border :empty-text="t('暂无扫码记录', 'No scans')">
      <el-table-column prop="barcode" :label="t('条码', 'Barcode')" min-width="140" /><el-table-column prop="serial" :label="t('串号', 'Serial')" min-width="120" />
      <el-table-column :label="t('状态', 'State')" width="100"><template #default="{ row }">{{ state(row.state) }}</template></el-table-column>
      <el-table-column prop="createdAt" :label="t('扫描时间', 'Scanned at')" min-width="210" /><el-table-column prop="voidReason" :label="t('撤销原因', 'Void reason')" min-width="150" />
      <el-table-column v-if="active && can('unscan')" :label="t('操作', 'Actions')" width="110"><template #default="{ row }"><el-button v-if="row.state === 'ACTIVE'" link type="danger" :disabled="disabled || !canUndoScan(row)" @click="undo('unscan', row.id)">{{ t('撤销扫码', 'Void scan') }}</el-button></template></el-table-column>
    </el-table>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch, nextTick } from 'vue'
import { ElMessageBox } from 'element-plus'
import auth from '@/plugins/auth'
import { bilingual as t } from '@/warehouse/i18n'
import { packageRemainder } from '@/warehouse/order-work'
import { nativeOrder } from '@/warehouse/orders'

const props = defineProps({ order: { type: Object, required: true }, busy: Boolean, blocked: Boolean })
const emit = defineEmits(['work', 'refresh'])
const can = action => auth.hasPermi('warehouse:orders:' + action)
const work = computed(() => props.order.work || {}), progress = computed(() => work.value.progress || [])
const active = computed(() => ['ALLOCATED', 'PICKED'].includes(props.order.status)), disabled = computed(() => props.busy || props.blocked || !active.value)
const quantity = computed(() => progress.value.reduce((n, row) => n + row.quantity, 0)), scanned = computed(() => progress.value.reduce((n, row) => n + row.scanned, 0)), packed = computed(() => progress.value.reduce((n, row) => n + row.packed, 0))
const scannable = computed(() => progress.value.filter(row => row.state === 'RESERVED' && row.scanRemaining > 0)), remaining = computed(() => packageRemainder(props.order))
const recentScans = computed(() => [...(work.value.scans || [])].reverse())
const allocationId = ref(''), barcode = ref(''), serial = ref(''), barcodeInput = ref(), serialInput = ref(), packing = ref(false)
const selected = computed(() => scannable.value.find(row => row.id === allocationId.value))
const packageForm = reactive({ packageCode: '', weightKg: '', lengthCm: '', widthCm: '', heightCm: '', notes: '', lines: [] })
const packageFields = [{key:'packageCode',zh:'包裹编号',en:'Package code'},{key:'weightKg',zh:'实测重量 kg',en:'Measured weight kg'},{key:'lengthCm',zh:'长度 cm',en:'Length cm'},{key:'widthCm',zh:'宽度 cm',en:'Width cm'},{key:'heightCm',zh:'高度 cm',en:'Height cm'}]
const state = value => t(({ACTIVE:'有效',VOID:'已撤销',SEALED:'已封箱',DESPATCHED:'已出库'})[value] || value, ({ACTIVE:'Active',VOID:'Voided',SEALED:'Sealed',DESPATCHED:'Despatched'})[value] || value)
const canUndoScan = row => { const allocation = progress.value.find(item => item.id === row.allocationId); return allocation && allocation.scanned > allocation.packed }
const manifest = row => row.lines.map(line => { const allocation = progress.value.find(item => item.id === line.allocationId); return [allocation?.sku || line.allocationId, allocation?.serial, '× ' + line.quantity].filter(Boolean).join(' ') }).join(' / ')
watch(() => [props.order.id, props.order._version], async () => {
  barcode.value = ''; serial.value = ''; packing.value = false
  if (!scannable.value.some(row => row.id === allocationId.value)) allocationId.value = scannable.value[0]?.id || ''
  await nextTick(); if (props.order.status === 'ALLOCATED') barcodeInput.value?.focus()
}, { immediate: true })
watch(allocationId, () => { barcode.value = ''; serial.value = '' })
watch(() => props.busy, async busy => { if (!busy && !props.blocked && props.order.status === 'ALLOCATED') { await nextTick(); barcodeInput.value?.focus() } })
function scanOrSerial() { if (selected.value?.serial) serialInput.value?.focus(); else scan() }
function scan() { if (disabled.value || !selected.value || !barcode.value.trim() || selected.value.serial && !serial.value.trim()) return; emit('work', {action:'scan', allocationId:allocationId.value, barcode:barcode.value, serial:serial.value}) }
function openPackage() { Object.assign(packageForm, { packageCode: 'BOX-' + ((work.value.packages?.length || 0) + 1), weightKg:'', lengthCm:'', widthCm:'', heightCm:'', notes:'', lines: remaining.value.map(row => ({...row})) }); packing.value = true }
function seal() { if (!disabled.value) emit('work', {action:'pack',...packageForm,lines:packageForm.lines.filter(row => row.quantity !== 0)}) }
async function undo(action, id) {
  if (disabled.value || !can(action)) return
  try {
    const result = await ElMessageBox.prompt(t('请填写原因。撤销记录会保留；此操作不改变实物库存。', 'Enter a reason. History is retained; this does not change physical stock.'), t('更正作业记录', 'Correct work record'), { inputValidator: value => !!value?.trim() && value.length <= 500 || t('请填写 1–500 字的原因', 'Enter a reason of 1–500 characters'), confirmButtonText:t('确认','Confirm'),cancelButtonText:t('取消','Cancel') })
    if (!disabled.value) emit('work', { action, reason: result.value, ...(action === 'unscan' ? {scanId:id} : action === 'unpack' ? {packageId:id} : {}) })
  } catch { /* Operator cancelled the reason dialog. */ }
}
</script>
<style scoped>
.order-work{margin-top:24px;min-width:0}.work-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.work-heading h3{font-size:16px}.work-summary{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:16px 0}.full{width:100%}.mb16{margin-bottom:16px}.scan-fields,.measurements{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.hint{font-size:13px;color:var(--el-text-color-regular);line-height:1.6}.packing-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.packing-actions .el-button{margin-left:0}.package-form{border:1px solid var(--el-border-color);border-radius:6px;padding:16px;margin-top:16px}.manifest{padding:0 20px;overflow-wrap:anywhere}h4{font-size:14px;margin:24px 0 12px}.el-input-number{width:145px}@media(max-width:600px){.scan-fields,.measurements{grid-template-columns:1fr}.work-heading{align-items:flex-start;flex-wrap:wrap}.package-form{padding:12px}}
</style>
