<template>
  <section class="unidentified-panel" :aria-label="t('未识别到货', 'Unidentified arrivals')">
    <div class="heading"><h3>{{ t('未识别到货', 'Unidentified arrivals') }}</h3><el-button v-if="custodyOpen(asn) && permitted('unknownArrive')" :disabled="blocked" @click="start('unknownArrive')">{{ t('登记未识别到货', 'Record unidentified arrival') }}</el-button></div>
    <p class="help">{{ t('先记录实际到货、凭据和隔离库位，不增加可用库存。确认商品后仍需检验和上架；退供或报废须先批准，再记录实际处理。', 'Record the physical arrival, evidence and quarantine location first. Identification still requires inspection and putaway. Returns and disposal require approval followed by a record of the actual handling.') }}</p>
    <el-table :data="asn.unidentifiedArrivals || []" border :empty-text="t('暂无未识别到货', 'No unidentified arrivals')">
      <el-table-column type="expand"><template #default="{ row }"><dl class="evidence"><dt>{{ t('到货凭据', 'Arrival evidence') }}</dt><dd>{{ row.evidenceReference }}</dd><dt>{{ t('批次 / 串号 / 有效期', 'Batch / serial / expiry') }}</dt><dd>{{ row.batch || '—' }} / {{ row.serial || '—' }} / {{ row.expiry || '—' }}</dd><dt>{{ t('登记说明', 'Arrival reason') }}</dt><dd>{{ row.reason }}</dd><dt>{{ t('记录编号', 'Record ID') }}</dt><dd>{{ row.id }}</dd></dl></template></el-table-column>
      <el-table-column prop="description" :label="t('实物描述', 'Observed description')" min-width="230" />
      <el-table-column prop="barcode" :label="t('观察到的条码', 'Observed barcode')" min-width="160" />
      <el-table-column prop="locationName" :label="t('隔离库位', 'Quarantine location')" min-width="150" />
      <el-table-column prop="quantity" :label="t('到货', 'Arrived')" min-width="85" /><el-table-column prop="remaining" :label="t('未识别实物', 'Unidentified held')" min-width="140" /><el-table-column prop="reserved" :label="t('已批准待执行', 'Approved pending')" min-width="150" />
      <el-table-column prop="mapped" :label="t('已认领', 'Identified')" min-width="100" /><el-table-column prop="returned" :label="t('已退供', 'Returned')" min-width="100" /><el-table-column prop="scrapped" :label="t('已报废', 'Disposed')" min-width="100" />
      <el-table-column prop="arrivedAt" :label="t('实际到仓时间（UTC）', 'Original arrival (UTC)')" min-width="220" />
      <el-table-column :label="t('操作', 'Actions')" min-width="145"><template #default="{ row }"><el-button v-if="custodyOpen(asn) && permitted('unknownApprove') && row.remaining > row.reserved" link type="primary" :disabled="blocked" @click="start('unknownApprove', row)">{{ t('审核处理方式', 'Review disposition') }}</el-button></template></el-table-column>
    </el-table>

    <template v-if="asn.identificationApprovals?.length">
      <h3>{{ t('认领与处理批准', 'Identification and disposition approvals') }}</h3>
      <el-table :data="asn.identificationApprovals" border>
        <el-table-column :label="t('原到货', 'Original arrival')" min-width="200"><template #default="{ row }">{{ arrivalName(row.arrival) }}</template></el-table-column>
        <el-table-column :label="t('处理方式', 'Disposition')" min-width="140"><template #default="{ row }">{{ decisionLabel(row.decision) }}</template></el-table-column>
        <el-table-column :label="t('商品 / 接收方', 'Product / recipient')" min-width="180"><template #default="{ row }">{{ row.sku || row.recipient }}</template></el-table-column>
        <el-table-column prop="destination" :label="t('处理目的地', 'Destination')" min-width="210" /><el-table-column prop="reference" :label="t('批准凭据', 'Approval reference')" min-width="180" />
        <el-table-column prop="quantity" :label="t('批准', 'Approved')" min-width="90" /><el-table-column prop="executed" :label="t('已执行', 'Executed')" min-width="100" /><el-table-column prop="remaining" :label="t('待执行', 'Pending')" min-width="100" /><el-table-column prop="cancelled" :label="t('已撤销', 'Cancelled')" min-width="100" />
        <el-table-column prop="actorId" :label="t('批准人编号', 'Approver ID')" min-width="110" /><el-table-column prop="createdAt" :label="t('批准时间（UTC）', 'Approved at (UTC)')" min-width="220" />
        <el-table-column :label="t('操作', 'Actions')" min-width="230"><template #default="{ row }"><div v-if="custodyOpen(asn) && row.remaining > 0" class="actions"><el-button v-if="permitted('unknownExecute')" link type="primary" :disabled="blocked" @click="startApproval('unknownExecute', row)">{{ row.decision === 'identify' ? t('执行认领', 'Identify goods') : t('记录实际处理', 'Record physical handling') }}</el-button><el-button v-if="permitted('unknownCancel')" link type="danger" :disabled="blocked" @click="startApproval('unknownCancel', row)">{{ t('撤销剩余批准', 'Cancel unused approval') }}</el-button></div></template></el-table-column>
      </el-table>
    </template>

    <el-form v-if="action" class="task-form" label-position="top" :disabled="blocked" @submit.prevent="save">
      <h3>{{ actionLabel(action) }}</h3>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <p v-if="selected" class="help">{{ selected.description }} · {{ selected.locationName }}<br />{{ t('原到货凭据', 'Original arrival evidence') }}: {{ selected.evidenceReference }}<br />{{ t('未识别实物 / 已批准待执行', 'Unidentified held / approved pending') }}: {{ selected.remaining }} / {{ selected.reserved }}</p>
      <p v-if="approval" class="help">{{ decisionLabel(approval.decision) }} · {{ approval.sku || approval.recipient }}<br />{{ approval.destination }}<br />{{ t('批准凭据', 'Approval reference') }}: {{ approval.reference }}<br />{{ t('批次 / 串号 / 有效期', 'Batch / serial / expiry') }}: {{ approval.batch || '—' }} / {{ approval.serial || '—' }} / {{ approval.expiry || '—' }}</p>
      <p v-if="action === 'unknownCancel'" class="help">{{ t('只撤销尚未执行的数量。已认领、退供或报废的记录保持原样。', 'Cancel only the unused quantity. Completed identification, return and disposal records remain unchanged.') }}</p>
      <div class="form-grid">
        <el-form-item v-if="action === 'unknownApprove'" :label="t('处理方式', 'Disposition')" required><el-select v-model="form.decision" :aria-label="t('处理方式', 'Disposition')" @change="decisionChanged"><el-option v-for="value in ['identify', 'returnSupplier', 'scrap']" :key="value" :value="value" :label="decisionLabel(value)" /></el-select></el-form-item>
        <el-form-item v-if="action !== 'unknownCancel'" :label="t('处理数量', 'Handling quantity')" required><el-input-number v-model="form.quantity" :min="1" :max="maxQuantity" :precision="0" :aria-label="t('处理数量', 'Handling quantity')" /></el-form-item>
        <template v-if="action === 'unknownArrive'">
          <el-form-item :label="t('到货隔离库位', 'Arrival quarantine location')" required><el-select v-model="form.location" filterable remote :remote-method="q => lookup('locations', q)" :aria-label="t('到货隔离库位', 'Arrival quarantine location')"><el-option v-for="row in locations" :key="row.id" :value="row.id" :label="row.label" /></el-select></el-form-item>
          <el-form-item :label="t('观察到的条码', 'Observed barcode')"><el-input v-model="form.barcode" maxlength="200" :aria-label="t('观察到的条码', 'Observed barcode')" /></el-form-item>
          <el-form-item :label="t('到货凭据', 'Arrival evidence')" required><el-input v-model="form.evidenceReference" maxlength="200" :aria-label="t('到货凭据', 'Arrival evidence')" /></el-form-item>
        </template>
        <el-form-item v-if="action === 'unknownApprove' && form.decision === 'identify'" :label="t('认领商品', 'Identified product')" required><el-select v-model="form.product" filterable remote :remote-method="q => lookup('products', q)" :aria-label="t('认领商品', 'Identified product')"><el-option v-for="row in products" :key="row.id" :value="row.id" :label="row.label" /></el-select></el-form-item>
        <template v-if="action === 'unknownArrive' || (action === 'unknownApprove' && form.decision === 'identify')">
          <el-form-item :label="t('到货批次', 'Arrival batch')"><el-input v-model="form.batch" :disabled="Boolean(selected?.batch)" maxlength="191" :aria-label="t('到货批次', 'Arrival batch')" /></el-form-item>
          <el-form-item :label="t('到货串号', 'Arrival serial')"><el-input v-model="form.serial" :disabled="Boolean(selected?.serial)" maxlength="191" :aria-label="t('到货串号', 'Arrival serial')" /></el-form-item>
          <el-form-item :label="t('到货有效期', 'Arrival expiry')"><el-date-picker v-model="form.expiry" :disabled="Boolean(selected?.expiry)" type="date" value-format="YYYY-MM-DD" :aria-label="t('到货有效期', 'Arrival expiry')" /></el-form-item>
        </template>
        <el-form-item v-if="action === 'unknownApprove'" :label="t('批准凭据', 'Approval reference')" required><el-input v-model="form.reference" maxlength="200" :aria-label="t('批准凭据', 'Approval reference')" /></el-form-item>
        <el-form-item v-if="action === 'unknownApprove' && form.decision !== 'identify'" :label="t('接收方 / 处置方', 'Recipient / disposal operator')" required><el-input v-model="form.recipient" maxlength="200" :aria-label="t('接收方 / 处置方', 'Recipient / disposal operator')" /></el-form-item>
        <el-form-item v-if="physicalExecution" :label="t('实际处理凭据', 'Actual handling reference')" required><el-input v-model="form.reference" maxlength="200" :aria-label="t('实际处理凭据', 'Actual handling reference')" /></el-form-item>
      </div>
      <el-form-item v-if="action === 'unknownArrive'" :label="t('实物描述', 'Observed description')" required><el-input v-model="form.description" type="textarea" :rows="2" maxlength="500" :aria-label="t('实物描述', 'Observed description')" /></el-form-item>
      <el-form-item v-if="action === 'unknownApprove' && form.decision !== 'identify'" :label="t('处理目的地', 'Destination')" required><el-input v-model="form.destination" type="textarea" :rows="2" maxlength="1000" :aria-label="t('处理目的地', 'Destination')" /></el-form-item>
      <p v-if="action === 'unknownApprove' && form.decision === 'identify'" class="help">{{ t('请核对客户商品及追踪信息。登记时已确认的信息不能覆盖；认领后保留原到仓时间，继续检验。未预报商品须另行批准超收后才能上架。', 'Verify the client product and tracking details. Previously observed tracking cannot be overwritten. Identification retains the original arrival time and creates an inspection task. Unforecast goods require separate excess approval before putaway.') }}</p>
      <template v-if="physicalExecution"><p class="help">{{ t('完成实际交接或处置后再填写，本操作会减少隔离区实物数量。', 'Record this after actual handover or disposal. It reduces the physical quantity held in quarantine.') }}</p><el-checkbox v-model="form.confirmPhysical">{{ t('我确认货物已按批准内容实际交接或处置', 'I confirm the goods were physically handed over or disposed of as approved') }}</el-checkbox></template>
      <el-form-item :label="t('处理说明', 'Handling reason')" required><el-input v-model="form.reason" type="textarea" :rows="3" maxlength="500" show-word-limit :aria-label="t('处理说明', 'Handling reason')" /></el-form-item>
      <div class="actions"><el-button :type="physicalExecution ? 'warning' : 'primary'" :disabled="blocked" @click="save">{{ t('确认', 'Confirm') + ' ' + actionLabel(action) }}</el-button><el-button :disabled="blocked" @click="action = ''; error = ''">{{ t('取消填写', 'Cancel entry') }}</el-button></div>
    </el-form>

    <el-collapse v-if="asn.unidentifiedEvents?.length" class="history"><el-collapse-item :title="t('未识别到货处理记录', 'Unidentified arrival history')" name="history"><el-table :data="asn.unidentifiedEvents" border>
      <el-table-column prop="createdAt" :label="t('时间（UTC）', 'Time (UTC)')" min-width="220" /><el-table-column :label="t('原到货', 'Original arrival')" min-width="200"><template #default="{ row }">{{ arrivalName(row.arrival) }}</template></el-table-column><el-table-column :label="t('操作', 'Action')" min-width="175"><template #default="{ row }">{{ actionLabel(row.action) }}<span v-if="row.result?.decision"> · {{ decisionLabel(row.result.decision) }}</span></template></el-table-column><el-table-column prop="quantity" :label="t('数量', 'Quantity')" min-width="90" /><el-table-column prop="actorId" :label="t('操作人编号', 'Actor ID')" min-width="110" /><el-table-column prop="reference" :label="t('凭据', 'Reference')" min-width="170" /><el-table-column prop="reason" :label="t('说明', 'Reason')" min-width="210" /><el-table-column prop="custody" :label="t('检验任务编号', 'Inspection task ID')" min-width="310" />
    </el-table></el-collapse-item></el-collapse>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { bilingual as t } from '@/warehouse/i18n'
import { custodyOpen, unidentifiedPayload } from '@/warehouse/inbound'
import { getWarehouseLookups } from '@/api/warehouse'
const props = defineProps({ asn: { type: Object, required: true }, blocked: Boolean, permitted: { type: Function, required: true } })
const emit = defineEmits(['submit'])
const action = ref(''), form = ref({}), error = ref(''), locationRows = ref([]), productRows = ref([])
const selected = computed(() => props.asn.unidentifiedArrivals?.find(row => row.id === form.value.arrival))
const approval = computed(() => props.asn.identificationApprovals?.find(row => row.id === form.value.approval))
const physicalExecution = computed(() => action.value === 'unknownExecute' && approval.value?.decision !== 'identify')
const maxQuantity = computed(() => approval.value?.remaining || (selected.value ? selected.value.remaining - selected.value.reserved : 10000000))
const locations = computed(() => locationRows.value.filter(row => row.active !== false && row.type === 'Quarantine' && row.custodyOnly && (!row.client || row.client === props.asn.client)))
const products = computed(() => productRows.value.filter(row => row.active !== false && (!row.client || row.client === props.asn.client)))
const arrivalName = id => props.asn.unidentifiedArrivals?.find(row => row.id === id)?.description || id
const decisionLabel = value => t(({ identify: '认领商品', returnSupplier: '退供', scrap: '报废' })[value] || value, ({ identify: 'Identify product', returnSupplier: 'Return to supplier', scrap: 'Dispose' })[value] || value)
const actionLabel = value => t(({ unknownArrive: '登记未识别到货', unknownApprove: '批准处理', unknownExecute: '执行处理', unknownCancel: '撤销剩余批准' })[value] || value, ({ unknownArrive: 'Record unidentified arrival', unknownApprove: 'Approve disposition', unknownExecute: 'Execute disposition', unknownCancel: 'Cancel unused approval' })[value] || value)
let tickets = { locations: 0, products: 0 }
async function lookup(kind, q = '') { const ticket = ++tickets[kind]; try { const response = await getWarehouseLookups(kind, q, kind === 'products' ? { client: props.asn.client } : { warehouse: props.asn.warehouse }); if (ticket === tickets[kind]) (kind === 'products' ? productRows : locationRows).value = response.data } catch (e) { if (ticket === tickets[kind]) error.value = e.message } }
function decisionChanged() { form.value.product = ''; if (form.value.decision === 'identify') lookup('products') }
function start(value, arrival, approved) { if (props.blocked) return; action.value = value; error.value = ''; tickets.locations++; tickets.products++; locationRows.value = []; productRows.value = []; form.value = { arrival: arrival?.id || '', approval: approved?.id || '', quantity: approved?.remaining || (arrival ? arrival.remaining - arrival.reserved : 1), decision: 'identify', product: '', location: '', barcode: '', description: '', evidenceReference: '', batch: arrival?.batch || '', serial: arrival?.serial || '', expiry: arrival?.expiry || '', recipient: '', destination: '', reference: '', reason: '', confirmPhysical: false }; if (value === 'unknownArrive') lookup('locations'); if (value === 'unknownApprove') lookup('products') }
function startApproval(value, row) { const arrival = props.asn.unidentifiedArrivals.find(item => item.id === row.arrival); if (arrival) start(value, arrival, row) }
function save() { if (props.blocked) return; error.value = ''; try { emit('submit', action.value, props.asn.id, unidentifiedPayload(props.asn, action.value, form.value, crypto.randomUUID())) } catch (e) { error.value = e.message === 'physical_confirmation' ? t('请确认已按批准内容实际交接或处置。', 'Confirm that the approved physical handling has taken place.') : e.message === 'observed_tracking' ? t('请保留原到货记录中的批次、串号和有效期。', 'Retain the batch, serial and expiry observed at arrival.') : t('请检查必填项及可处理数量，并填写对应凭据。每个串号数量为 1。', 'Check required fields, available quantities and evidence. Each serial must have quantity 1.') } }
</script>

<style scoped>
.unidentified-panel { margin-top: 24px; min-width: 0; }
.heading, .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.actions .el-button { margin-left: 0; }
h3 { font-size: 16px; margin: 20px 0 14px; }
.heading h3 { margin: 0; }
.help { max-width: 75ch; line-height: 1.65; color: var(--el-text-color-regular); }
.task-form { margin: 20px 0; padding: 20px 0; border-block: 1px solid var(--el-border-color-lighter); }
.task-form h3 { margin-top: 0; }
.form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 20px; }
.form-grid :deep(.el-select), .form-grid :deep(.el-input-number), .form-grid :deep(.el-date-editor) { width: 100%; }
.evidence { margin: 16px 24px; overflow-wrap: anywhere; }
.evidence dt { color: var(--el-text-color-secondary); margin-top: 12px; }
.evidence dd { margin: 6px 0; }
.history { margin-top: 16px; }
.task-form :deep(.el-checkbox) { height: auto; white-space: normal; margin-bottom: 16px; }
.task-form :deep(.el-checkbox__label) { white-space: normal; line-height: 1.5; }
@media (max-width: 800px) { .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 540px) { .form-grid { grid-template-columns: 1fr; } }
</style>
