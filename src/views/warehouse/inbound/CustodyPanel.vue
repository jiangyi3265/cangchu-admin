<template>
  <section class="custody-panel" :aria-label="t('待检与上架', 'Inspection and putaway')">
    <div class="heading"><h3>{{ t('待检与上架', 'Inspection and putaway') }}</h3><el-button v-if="custodyOpen(asn) && permitted('stage')" :disabled="blocked" @click="start('stage')">{{ t('登记隔离签收', 'Receive into quarantine') }}</el-button></div>
    <p class="help">{{ t('隔离签收只登记实物，不增加可用库存，也不计收入库件费。检验合格后按实际数量上架并计费；超收先批准，不合格货物可报废。', 'Quarantine receipt records physical goods without adding available stock or goods-in unit fees. Inspected goods are billed when put away. Approve excess quantities first; failed goods may be scrapped.') }}</p>
    <el-table :data="asn.custodyTasks || []" border :empty-text="t('暂无待检或上架任务', 'No inspection or putaway tasks')">
      <el-table-column prop="sku" label="SKU" min-width="160" />
      <el-table-column prop="locationName" :label="t('隔离库位', 'Quarantine location')" min-width="150" />
      <el-table-column :label="t('检验', 'Inspection')" min-width="100"><template #default="{ row }"><el-tag :type="row.inspection === 'PASS' ? 'success' : row.inspection === 'FAIL' ? 'danger' : 'warning'">{{ inspectionLabel(row.inspection) }}</el-tag></template></el-table-column>
      <el-table-column prop="quantity" :label="t('签收', 'Arrived')" min-width="85" /><el-table-column prop="remaining" :label="t('待处理', 'Remaining')" min-width="100" /><el-table-column prop="accepted" :label="t('已上架', 'Put away')" min-width="95" /><el-table-column prop="scrapped" :label="t('已报废', 'Scrapped')" min-width="95" />
      <el-table-column prop="approvedExtra" :label="t('超收额度余量', 'Unused excess approval')" min-width="180" />
      <el-table-column prop="returned" :label="t('已退供', 'Returned to supplier')" min-width="170" /><el-table-column prop="returnReserved" :label="t('退供待交接', 'Awaiting supplier handover')" min-width="200" />
      <el-table-column prop="batch" :label="t('批次', 'Batch')" min-width="130" /><el-table-column prop="serial" :label="t('串号', 'Serial')" min-width="140" /><el-table-column prop="expiry" :label="t('有效期', 'Expiry')" min-width="120" />
      <el-table-column :label="t('操作', 'Actions')" min-width="240"><template #default="{ row }"><div v-if="custodyOpen(asn) && row.remaining > 0" class="actions">
        <el-button v-if="permitted('inspect') && row.remaining + (row.returned || 0) === row.quantity && !row.returnReserved" link type="primary" :disabled="blocked" @click="start('inspect', row)">{{ t('检验', 'Inspect') }}</el-button>
        <el-button v-if="permitted('approveOverage') && row.inspection === 'PASS' && row.overageRequired > row.approvedExtra" link type="warning" :disabled="blocked" @click="start('approveOverage', row)">{{ t('批准超收', 'Approve excess') }}</el-button>
        <el-button v-if="permitted('putaway') && row.inspection === 'PASS' && freeQuantity(row) > 0" link type="primary" :disabled="blocked" @click="start('putaway', row)">{{ t('上架', 'Put away') }}</el-button>
        <el-button v-if="permitted('scrap') && row.inspection === 'FAIL' && freeQuantity(row) > 0" link type="danger" :disabled="blocked" @click="start('scrap', row)">{{ t('报废', 'Scrap') }}</el-button>
        <el-button v-if="permitted('approveReturn') && freeQuantity(row) > 0" link type="warning" :disabled="blocked" @click="start('approveReturn', row)">{{ t('批准退供', 'Approve supplier return') }}</el-button>
      </div><span v-else>{{ row.remaining === 0 ? t('已处理完', 'Completed') : '—' }}</span></template></el-table-column>
    </el-table>

    <template v-if="asn.supplierReturnApprovals?.length">
      <h3>{{ t('退供批准与交接', 'Supplier return approvals and handovers') }}</h3>
      <el-table :data="asn.supplierReturnApprovals" border>
        <el-table-column prop="reference" :label="t('退供批准凭据', 'Return authorisation reference')" min-width="200" /><el-table-column prop="sku" label="SKU" min-width="160" /><el-table-column prop="recipient" :label="t('收货方', 'Recipient')" min-width="170" /><el-table-column prop="destination" :label="t('退回目的地', 'Return destination')" min-width="250" />
        <el-table-column prop="quantity" :label="t('批准数量', 'Approved')" min-width="100" /><el-table-column prop="handed" :label="t('已交接', 'Handed over')" min-width="110" /><el-table-column prop="remaining" :label="t('待交接', 'Pending handover')" min-width="140" /><el-table-column prop="cancelled" :label="t('已撤销', 'Cancelled')" min-width="110" />
        <el-table-column prop="actorId" :label="t('批准人编号', 'Approver ID')" min-width="110" /><el-table-column prop="createdAt" :label="t('批准时间（UTC）', 'Approved at (UTC)')" min-width="220" />
        <el-table-column :label="t('操作', 'Actions')" min-width="220"><template #default="{ row }"><div v-if="custodyOpen(asn) && row.remaining > 0" class="actions"><el-button v-if="permitted('returnSupplier')" link type="primary" :disabled="blocked" @click="startReturn('returnSupplier', row)">{{ t('记录实际交接', 'Record handover') }}</el-button><el-button v-if="permitted('cancelReturnApproval')" link type="danger" :disabled="blocked" @click="startReturn('cancelReturnApproval', row)">{{ t('撤销剩余批准', 'Cancel unused approval') }}</el-button></div><span v-else>{{ t('已处理完', 'Completed') }}</span></template></el-table-column>
      </el-table>
    </template>

    <el-form v-if="action" class="task-form" label-position="top" :disabled="blocked" @submit.prevent="save">
      <h3>{{ actionLabel(action) }}<span v-if="selected"> · {{ selected.sku }}</span></h3>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <p v-if="selected" class="help">{{ t('原签收', 'Original arrival') }}: {{ selected.quantity }} · {{ t('待处理', 'Remaining') }}: {{ selected.remaining }} · {{ t('隔离库位', 'Quarantine location') }}: {{ selected.locationName }}<br />{{ t('签收说明', 'Arrival note') }}: {{ selected.reason }}</p>
      <p v-if="action === 'approveOverage'" class="help">{{ t('批准此任务剩余的', 'Approve the remaining') }} {{ selected.remaining }} {{ t('件在需要时超出原预报入库。预报数量保持原样，批准本身不移动库存、不收费。重新检验会清除未使用的批准额度。', 'units for acceptance beyond the original forecast if needed. Approval preserves the forecast and does not move stock or charge fees. Reinspection clears unused approval.') }}</p>
      <p v-if="action === 'scrap'" class="help">{{ t('报废会扣减隔离实物并保留记录，不增加可售库存。请核对数量和报废原因。', 'Scrapping removes physical quarantine stock and retains its evidence. Check the quantity and reason before confirming.') }}</p>
      <p v-if="action === 'approveReturn'" class="help">{{ t('批准后，这些实物会留在隔离区等待交接，不能再用于上架或报废。收货方和目的地会随批准保存。', 'Approved goods stay in quarantine until handover and cannot be put away or scrapped. The recipient and destination are fixed with the approval.') }}</p>
      <p v-if="selectedApproval" class="help">{{ t('批准凭据', 'Authorisation reference') }}: {{ selectedApproval.reference }}<br />{{ t('收货方', 'Recipient') }}: {{ selectedApproval.recipient }}<br />{{ t('目的地', 'Destination') }}: {{ selectedApproval.destination }}<br />{{ t('已交接 / 待交接', 'Handed over / remaining') }}: {{ selectedApproval.handed }} / {{ selectedApproval.remaining }}</p>
      <p v-if="action === 'cancelReturnApproval'" class="help">{{ t('仅撤销还没交接的批准数量，已经退回的实物和原交接记录保持原样。撤销后剩余实物可重新安排处理。', 'Cancel only the unused quantity. Previously handed-over stock and evidence remain unchanged. The remaining goods become available for another disposition.') }}</p>
      <div class="form-grid">
        <el-form-item v-if="action === 'stage'" :label="t('签收商品', 'Arrival product')" required><el-select v-model="form.product" :aria-label="t('签收商品', 'Arrival product')"><el-option v-for="row in asn.lines" :key="row.product" :value="row.product" :label="row.sku" /></el-select></el-form-item>
        <el-form-item v-if="['stage', 'putaway', 'scrap', 'approveReturn', 'returnSupplier'].includes(action)" :label="t('操作数量', 'Action quantity')" required><el-input-number v-model="form.quantity" :min="1" :max="maximumQuantity" :precision="0" :aria-label="t('操作数量', 'Action quantity')" /></el-form-item>
        <el-form-item v-if="['stage', 'putaway'].includes(action)" :label="action === 'stage' ? t('签收隔离库位', 'Receiving quarantine location') : t('目标上架库位', 'Destination location')" required><el-select v-model="form.location" filterable remote :remote-method="lookup" :aria-label="action === 'stage' ? t('签收隔离库位', 'Receiving quarantine location') : t('目标上架库位', 'Destination location')"><el-option v-for="row in locations" :key="row.id" :value="row.id" :label="row.label" /></el-select></el-form-item>
        <template v-if="action === 'stage'"><el-form-item :label="t('签收批次', 'Arrival batch')"><el-input v-model="form.batch" maxlength="191" :aria-label="t('签收批次', 'Arrival batch')" /></el-form-item><el-form-item :label="t('签收串号', 'Arrival serial')"><el-input v-model="form.serial" maxlength="191" :aria-label="t('签收串号', 'Arrival serial')" /></el-form-item><el-form-item :label="t('签收有效期', 'Arrival expiry')"><el-date-picker v-model="form.expiry" type="date" value-format="YYYY-MM-DD" :aria-label="t('签收有效期', 'Arrival expiry')" /></el-form-item></template>
        <el-form-item v-if="action === 'inspect'" :label="t('检验结论', 'Inspection result')" required><el-select v-model="form.result" :aria-label="t('检验结论', 'Inspection result')"><el-option value="PASS" :label="t('合格', 'Pass')" /><el-option value="FAIL" :label="t('不合格', 'Fail')" /></el-select></el-form-item>
        <template v-if="action === 'approveReturn'"><el-form-item :label="t('退供收货方', 'Supplier return recipient')" required><el-input v-model="form.recipient" maxlength="200" :aria-label="t('退供收货方', 'Supplier return recipient')" /></el-form-item><el-form-item :label="t('退供批准凭据', 'Return authorisation reference')" required><el-input v-model="form.reference" maxlength="200" :aria-label="t('退供批准凭据', 'Return authorisation reference')" /></el-form-item></template>
        <el-form-item v-if="action === 'returnSupplier'" :label="t('实际交接凭据', 'Actual handover reference')" required><el-input v-model="form.handoverReference" maxlength="200" :aria-label="t('实际交接凭据', 'Actual handover reference')" /></el-form-item>
      </div>
      <el-form-item v-if="action === 'approveReturn'" :label="t('退回目的地', 'Return destination')" required><el-input v-model="form.destination" type="textarea" :rows="3" maxlength="1000" :aria-label="t('退回目的地', 'Return destination')" /></el-form-item>
      <template v-if="action === 'returnSupplier'"><p class="help">{{ t('填写实际签收单、交接单或物流凭据。确认后扣减隔离实物；本操作不会预约快递、购买面单或发起退款。', 'Enter the actual signed receipt, handover document or shipping reference. Confirmation removes the physical quarantine stock. This action does not book a courier, buy a label or issue a refund.') }}</p><el-checkbox v-model="form.confirmHandover">{{ t('我确认上述货物已实际交接给批准的收货方', 'I confirm these goods were physically handed over to the approved recipient') }}</el-checkbox></template>
      <p v-if="action === 'stage'" class="help">{{ t('同一行货物应具有相同批次、串号、效期和质量状况；不同状况请分别签收。每个串号数量为 1。', 'Receive different lots, serials, expiry dates or quality conditions separately. Each serial must have quantity 1.') }}</p>
      <el-form-item :label="t('操作说明', 'Action reason')" required><el-input v-model="form.reason" type="textarea" :rows="3" maxlength="500" show-word-limit :aria-label="t('操作说明', 'Action reason')" /></el-form-item>
      <div class="actions"><el-button :type="action === 'scrap' ? 'danger' : 'primary'" :disabled="blocked" @click="save">{{ t('确认', 'Confirm') }}{{ ' ' + actionLabel(action) }}</el-button><el-button :disabled="blocked" @click="action = ''; error = ''">{{ t('取消填写', 'Cancel entry') }}</el-button></div>
    </el-form>
    <template v-if="asn.custodyEvents?.length"><h3>{{ t('检验与上架记录', 'Inspection and putaway history') }}</h3><el-table :data="asn.custodyEvents" border><el-table-column prop="createdAt" :label="t('时间（UTC）', 'Time (UTC)')" min-width="220" /><el-table-column prop="sku" label="SKU" min-width="150" /><el-table-column :label="t('操作', 'Action')" min-width="150"><template #default="{ row }">{{ actionLabel(row.action) }}<span v-if="row.result?.inspection"> · {{ inspectionLabel(row.result.inspection) }}</span></template></el-table-column><el-table-column prop="quantity" :label="t('数量', 'Quantity')" min-width="90" /><el-table-column prop="actorId" :label="t('操作人编号', 'Actor ID')" min-width="100" /><el-table-column prop="reason" :label="t('说明', 'Reason')" min-width="220" /><el-table-column :label="t('退供／交接凭据', 'Return / handover reference')" min-width="220"><template #default="{ row }">{{ row.result?.handoverReference || row.result?.reference || asn.supplierReturnApprovals?.find(item => item.id === row.result?.approval)?.reference || '—' }}</template></el-table-column><el-table-column prop="locationName" :label="t('库位', 'Location')" min-width="150" /></el-table></template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { bilingual as t } from '@/warehouse/i18n'
import { custodyOpen, custodyPayload } from '@/warehouse/inbound'
import { getWarehouseLookups } from '@/api/warehouse'
const props = defineProps({ asn: { type: Object, required: true }, blocked: Boolean, permitted: { type: Function, required: true } })
const emit = defineEmits(['submit'])
const action = ref(''), form = ref({}), error = ref(''), locationRows = ref([])
const selected = computed(() => props.asn.custodyTasks?.find(row => row.id === form.value.task))
const selectedApproval = computed(() => props.asn.supplierReturnApprovals?.find(row => row.id === form.value.approval))
const freeQuantity = row => row.remaining - (row.returnReserved || 0)
const maximumQuantity = computed(() => selectedApproval.value?.remaining || (selected.value ? freeQuantity(selected.value) : 10000000))
const locations = computed(() => locationRows.value.filter(row => row.active !== false && (!row.client || row.client === props.asn.client) && (action.value === 'stage' ? row.type === 'Quarantine' && row.custodyOnly : row.type !== 'Quarantine' && !row.custodyOnly)))
const actionLabel = value => t(({ stage: '隔离签收', inspect: '检验', approveOverage: '批准超收', putaway: '上架', scrap: '报废', approveReturn: '批准退供', cancelReturnApproval: '撤销剩余批准', returnSupplier: '实际交接' })[value] || value, ({ stage: 'Quarantine receipt', inspect: 'Inspection', approveOverage: 'Excess approval', putaway: 'Putaway', scrap: 'Scrapping', approveReturn: 'Supplier return approval', cancelReturnApproval: 'Cancel unused approval', returnSupplier: 'Physical handover' })[value] || value)
const inspectionLabel = value => t(({ PENDING: '待检', PASS: '合格', FAIL: '不合格' })[value] || value, ({ PENDING: 'Pending', PASS: 'Pass', FAIL: 'Fail' })[value] || value)
let ticket = 0
async function lookup(q = '') { const n = ++ticket; try { const response = await getWarehouseLookups('locations', q, { warehouse: props.asn.warehouse }); if (n === ticket) locationRows.value = response.data } catch (e) { if (n === ticket) error.value = e.message } }
function start(value, task, approval) { if (props.blocked) return; action.value = value; error.value = ''; locationRows.value = []; form.value = { task: task?.id || '', approval: approval?.id || '', product: props.asn.lines[0]?.product || '', quantity: approval?.remaining || (task ? freeQuantity(task) : 1), location: '', batch: '', serial: '', expiry: '', reason: '', result: '', recipient: '', destination: '', reference: '', handoverReference: '', confirmHandover: false }; if (['stage', 'putaway'].includes(value)) lookup() }
function startReturn(value, approval) { const task = props.asn.custodyTasks.find(row => row.id === approval.task); if (task) start(value, task, approval) }
function save() { if (props.blocked) return; error.value = ''; try { const payload = custodyPayload(props.asn, action.value, form.value, crypto.randomUUID()); emit('submit', action.value, props.asn.id, payload) } catch (e) { error.value = e.message === 'overage_approval' ? t('超出预报的数量需要先批准，也可以先上架预报范围内的数量。', 'Approve excess quantities first, or put away only the remaining forecast quantity.') : e.message === 'handover_confirmation' ? t('请填写交接凭据，并确认货物已经实际交接。', 'Enter the handover evidence and confirm that the goods were physically handed over.') : e.message === 'return_reserved' ? t('这些数量已批准退供，请先核对待交接数量。', 'These goods are reserved for supplier return. Check the pending handover quantity.') : t('请检查必填项、数量和检验结论。串号货物每次只能处理 1 件。', 'Check required fields, quantities and inspection. Each serial must have quantity 1.') } }
</script>

<style scoped>
.custody-panel { margin-top: 24px; min-width: 0; }
.heading, .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.actions .el-button { margin-left: 0; }
h3 { font-size: 16px; margin: 20px 0 14px; }
.heading h3 { margin: 0; }
.help { max-width: 75ch; line-height: 1.65; color: var(--el-text-color-regular); }
.task-form { margin: 20px 0; padding: 20px 0; border-block: 1px solid var(--el-border-color-lighter); }
.task-form h3 { margin-top: 0; }
.form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 20px; }
.form-grid :deep(.el-select), .form-grid :deep(.el-input-number), .form-grid :deep(.el-date-editor) { width: 100%; }
@media (max-width: 800px) { .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 540px) { .form-grid { grid-template-columns: 1fr; } }
</style>
