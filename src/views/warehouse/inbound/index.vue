<template>
  <div class="app-container inbound-page">
    <div class="page-heading">
      <h2>{{ t('入库管理', 'Inbound receiving') }}</h2>
      <div class="actions">
        <el-button v-if="screen !== 'list'" :disabled="busy" @click="back">{{ t('返回列表', 'Back to list') }}</el-button>
        <el-button v-if="screen === 'list' && permitted('add')" type="primary" :disabled="blocked" @click="startCreate">{{ t('新建入库单', 'New ASN') }}</el-button>
        <el-button :loading="loading" :disabled="busy" @click="refresh">{{ t('刷新', 'Refresh') }}</el-button>
      </div>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <el-alert v-if="pending || pendingError" :title="pendingError || t('上次入库操作结果尚未确认', 'The last inbound operation is unconfirmed')" type="warning" show-icon :closable="false">
      <template v-if="pending" #default><p>{{ pending.payload.requestId }}</p><el-button :loading="busy" :disabled="!permitted(pendingPermission)" @click="send(true)">{{ t('重试原请求', 'Retry original request') }}</el-button></template>
    </el-alert>

    <template v-if="screen === 'list'">
      <el-form inline class="filters" @submit.prevent="search">
        <el-form-item :label="t('单号', 'Reference')"><el-input v-model="query.keyword" clearable :placeholder="t('搜索入库单号', 'Search ASN reference')" @keyup.enter="search" /></el-form-item>
        <el-form-item><el-button type="primary" :loading="loading" @click="search">{{ t('查询', 'Search') }}</el-button></el-form-item>
      </el-form>
      <el-table v-loading="loading" :data="rows" border :empty-text="t('暂无入库单，可新建预报后分批收货。', 'No ASNs yet. Create a forecast to begin receiving.')">
        <el-table-column prop="reference" :label="t('入库单号', 'ASN reference')" min-width="190" />
        <el-table-column :label="t('状态', 'Status')" min-width="155"><template #default="{ row }"><el-tag :type="tagType(row.status)">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column prop="deliveryType" :label="t('到货类型', 'Delivery type')" min-width="165" />
        <el-table-column prop="expectedDate" :label="t('预计到货日', 'Expected date')" min-width="150" />
        <el-table-column :label="t('已入库 / 预报', 'Accepted / expected')" min-width="155"><template #default="{ row }">{{ receivedTotal(row) }} / {{ expectedTotal(row) }}</template></el-table-column>
        <el-table-column :label="t('待检／待上架实物', 'Awaiting disposition')" min-width="175"><template #default="{ row }">{{ row.custodyPending || 0 }}</template></el-table-column>
        <el-table-column :label="t('操作', 'Actions')" width="100" fixed="right"><template #default="{ row }"><el-button v-if="permitted('query')" link type="primary" @click="open(row.id)">{{ t('查看', 'View') }}</el-button></template></el-table-column>
      </el-table>
      <pagination v-show="total > 0" :total="total" v-model:page="query.pageNum" v-model:limit="query.pageSize" @pagination="loadList" />
    </template>

    <el-form v-else-if="screen === 'edit'" ref="formRef" :model="form" label-position="top" :disabled="blocked" @submit.prevent="saveForecast">
      <h3>{{ editId ? t('修改入库预报', 'Edit forecast') : t('新建入库预报', 'New forecast') }}</h3>
      <div class="form-grid">
        <el-form-item prop="client" :label="t('客户', 'Client')" :rules="requiredRule">
          <el-select v-model="form.client" filterable remote :remote-method="q => lookup('clients', q)" :disabled="Boolean(editId)" :placeholder="t('选择客户', 'Select client')" @change="clientChanged"><el-option v-for="item in withCurrent('clients', form.client)" :key="item.id" :label="item.label" :value="item.id" /></el-select>
        </el-form-item>
        <el-form-item prop="warehouse" :label="t('仓库', 'Warehouse')" :rules="requiredRule"><el-select v-model="form.warehouse" filterable remote :remote-method="q => lookup('warehouses', q)" :disabled="Boolean(editId)" :placeholder="t('选择仓库', 'Select warehouse')"><el-option v-for="item in withCurrent('warehouses', form.warehouse)" :key="item.id" :label="item.label" :value="item.id" /></el-select></el-form-item>
        <el-form-item prop="reference" :label="t('入库单号', 'ASN reference')" :rules="requiredRule"><el-input v-model="form.reference" maxlength="191" /></el-form-item>
        <el-form-item :label="t('供应商','Supplier')"><el-select v-model="form.supplierId" clearable filterable remote :disabled="!auth.hasPermi('warehouse:suppliers:list')" :aria-label="t('供应商','Supplier')" :placeholder="t('可选，选择供应商','Optional supplier')" :remote-method="q=>lookup('suppliers',q)"><el-option v-for="item in withCurrent('suppliers',form.supplierId)" :key="item.id" :value="item.id" :label="item.label" :disabled="item.active===false && item.id!==form.supplierId" /></el-select></el-form-item>
        <el-form-item :label="t('预计到货日', 'Expected date')"><el-date-picker v-model="form.expectedDate" type="date" value-format="YYYY-MM-DD" :placeholder="t('选择日期', 'Select date')" /></el-form-item>
        <el-form-item :label="t('到货类型', 'Delivery type')"><el-select v-model="form.deliveryType"><el-option v-for="type in deliveryTypes" :key="type" :value="type" :label="type" /></el-select></el-form-item>
      </div>
      <el-form-item :label="t('备注', 'Notes')"><el-input v-model="form.notes" type="textarea" maxlength="5000" :rows="2" /></el-form-item>
      <h3>{{ t('预报商品', 'Expected products') }}</h3>
      <div class="table-scroll"><el-table :data="form.lines" border>
        <el-table-column :label="t('商品', 'Product')" min-width="250"><template #default="{ row, $index }"><el-select v-model="row.product" filterable remote :remote-method="q => lookup('products', q, { client: form.client })" :disabled="!form.client" :aria-label="t('商品', 'Product') + ' ' + ($index + 1)" :placeholder="t('选择商品', 'Select product')"><el-option v-for="item in withCurrent('products', row.product)" :key="item.id" :value="item.id" :label="item.label" /></el-select></template></el-table-column>
        <el-table-column :label="t('预报数量', 'Expected quantity')" min-width="180"><template #default="{ row, $index }"><el-input-number v-model="row.quantity" :min="1" :max="10000000" :precision="0" :aria-label="t('预报数量', 'Expected quantity') + ' ' + ($index + 1)" /></template></el-table-column>
        <el-table-column width="100"><template #default="{ $index }"><el-button link type="danger" :disabled="blocked || form.lines.length === 1" @click="form.lines.splice($index, 1)">{{ t('移除', 'Remove') }}</el-button></template></el-table-column>
      </el-table></div>
      <el-button class="add-row" :disabled="blocked || form.lines.length >= 200" @click="form.lines.push({ product: '', quantity: 1 })">{{ t('添加商品', 'Add product') }}</el-button>
      <div class="form-footer"><el-button type="primary" :loading="busy" @click="saveForecast">{{ t('保存预报', 'Save forecast') }}</el-button><el-button @click="back">{{ t('返回', 'Back') }}</el-button></div>
    </el-form>

    <template v-else-if="detail">
      <div class="detail-heading"><h3>{{ detail.reference }}</h3><el-tag :type="tagType(detail.status)">{{ statusLabel(detail.status) }}</el-tag></div>
      <dl class="details"><div><dt>{{t('供应商','Supplier')}}</dt><dd>{{detail.supplierName || '—'}}</dd></div><div><dt>{{ t('客户', 'Client') }}</dt><dd>{{ detail.clientName }}</dd></div><div><dt>{{ t('仓库', 'Warehouse') }}</dt><dd>{{ detail.warehouseName }}</dd></div><div><dt>{{ t('到货类型', 'Delivery type') }}</dt><dd>{{ detail.deliveryType }}</dd></div><div><dt>{{ t('预计到货日', 'Expected date') }}</dt><dd>{{ detail.expectedDate || '—' }}</dd></div></dl>
      <p v-if="detail.notes" class="notes">{{ detail.notes }}</p>
      <div v-if="screen === 'detail'" class="actions detail-actions">
        <el-button v-if="inboundOpen(detail) && permitted('receive')" type="primary" :disabled="blocked" @click="startReceive">{{ t('收货并上架', 'Receive and put away') }}</el-button>
        <el-button v-if="inboundEditable(detail) && permitted('edit')" :disabled="blocked" @click="startEdit">{{ t('修改预报', 'Edit forecast') }}</el-button>
        <el-button v-if="inboundClosable(detail) && permitted('close')" :disabled="blocked" @click="startClose">{{ t('入库结案', 'Close ASN') }}</el-button>
        <el-button v-if="inboundCancellable(detail) && permitted('cancel')" type="danger" plain :disabled="blocked" @click="screen = 'cancel'; cancelReason = ''; error = ''">{{ t('取消入库', 'Cancel ASN') }}</el-button>
      </div>
      <el-table :data="detail.lines" border class="forecast-summary"><el-table-column label="SKU" min-width="210"><template #default="{ row }">{{ row.sku }} <el-tag v-if="row.unexpected" type="warning" size="small">{{ t('未预报', 'Unforecast') }}</el-tag></template></el-table-column><el-table-column prop="quantity" :label="t('预报', 'Expected')" min-width="100" /><el-table-column prop="received" :label="t('已入库', 'Accepted')" min-width="100" /><el-table-column prop="remaining" :label="detail.status === 'CLOSED' ? t('短收', 'Shortfall') : t('待收', 'Remaining')" min-width="100" /><el-table-column prop="overage" :label="t('已超收', 'Accepted excess')" min-width="140" /></el-table>

      <el-form v-if="screen === 'receive'" label-position="top" :disabled="blocked" @submit.prevent="saveReceipt">
        <h3>{{ t('本次收货', 'This receipt') }}</h3>
        <p class="help">{{ t('按实际到货数量填写，提交后直接计入所选库位。不同批次、串号或库位请分行；每个串号数量为 1。', 'Enter the quantity actually received. Stock goes directly to the selected location. Use separate rows for lots, serials or locations; one unit per serial.') }}</p>
        <div class="table-scroll"><el-table :data="receiptLines" border>
          <el-table-column :label="t('商品', 'Product')" min-width="210"><template #default="{ row, $index }"><el-select v-model="row.product" :aria-label="t('收货商品', 'Receipt product') + ' ' + ($index + 1)"><el-option v-for="line in remainingLines" :key="line.product" :value="line.product" :label="line.sku" /></el-select></template></el-table-column>
          <el-table-column :label="t('实收数量', 'Received quantity')" min-width="175"><template #default="{ row, $index }"><el-input-number v-model="row.quantity" :min="1" :max="10000000" :precision="0" :aria-label="t('实收数量', 'Received quantity') + ' ' + ($index + 1)" /></template></el-table-column>
          <el-table-column :label="t('上架库位', 'Putaway location')" min-width="210"><template #default="{ row, $index }"><el-select v-model="row.location" filterable remote :remote-method="q => lookup('locations', q, { warehouse: detail.warehouse })" :aria-label="t('上架库位', 'Putaway location') + ' ' + ($index + 1)" :placeholder="t('选择库位', 'Select location')"><el-option v-for="item in locationOptions" :key="item.id" :value="item.id" :label="item.label" /></el-select></template></el-table-column>
          <el-table-column :label="t('批次', 'Batch')" min-width="160"><template #default="{ row, $index }"><el-input v-model="row.batch" maxlength="191" :aria-label="t('批次', 'Batch') + ' ' + ($index + 1)" /></template></el-table-column>
          <el-table-column :label="t('串号', 'Serial')" min-width="180"><template #default="{ row, $index }"><el-input v-model="row.serial" maxlength="191" :aria-label="t('串号', 'Serial') + ' ' + ($index + 1)" /></template></el-table-column>
          <el-table-column :label="t('有效期', 'Expiry')" min-width="190"><template #default="{ row, $index }"><el-date-picker v-model="row.expiry" type="date" value-format="YYYY-MM-DD" :aria-label="t('有效期', 'Expiry') + ' ' + ($index + 1)" /></template></el-table-column>
          <el-table-column width="90"><template #default="{ $index }"><el-button link type="danger" :disabled="blocked || receiptLines.length === 1" @click="receiptLines.splice($index, 1)">{{ t('移除', 'Remove') }}</el-button></template></el-table-column>
        </el-table></div>
        <el-button class="add-row" :disabled="blocked || receiptLines.length >= 200" @click="receiptLines.push(blankReceipt())">{{ t('添加收货行', 'Add receipt row') }}</el-button>
        <p class="help">{{ t('确认后按已配置价格记录本次入库费。缺少价格或库存校验不通过时，整笔收货不会提交。', 'Confirmation posts goods-in charges using configured rates. Missing rates or stock validation failures prevent the entire receipt.') }}</p>
        <div class="form-footer"><el-button type="primary" :loading="busy" @click="saveReceipt">{{ t('确认收货上架', 'Confirm receipt and putaway') }}</el-button><el-button @click="screen = 'detail'">{{ t('返回详情', 'Back to details') }}</el-button></div>
      </el-form>

      <el-form v-else-if="screen === 'close'" label-position="top" :disabled="blocked" @submit.prevent="saveClosure">
        <h3>{{ t('确认到货与结案', 'Confirm delivery and close ASN') }}</h3>
        <p class="help">{{ t('填写整张入库单的实际到货类型、柜／托／箱数量和工时。结案时计收固定入库费，结案后不能继续收货。', 'Enter the actual delivery type, total containers/pallets/boxes and labour hours for this ASN. Closing posts fixed goods-in charges and ends receiving.') }}</p>
        <div class="form-grid"><el-form-item :label="t('实际到货类型', 'Actual delivery type')"><el-select v-model="closing.deliveryType"><el-option v-for="type in deliveryTypes" :key="type" :value="type" :label="type" /></el-select></el-form-item><el-form-item :label="t('柜／托／箱数量', 'Containers / pallets / boxes')"><el-input-number v-model="closing.deliveryQuantity" :min="1" :max="10000000" :precision="0" /></el-form-item><el-form-item :label="t('实际工时', 'Labour hours')"><el-input v-model="closing.hours" inputmode="decimal" /></el-form-item></div>
        <el-alert v-if="hasShortfall" type="warning" show-icon :closable="false" :title="t('仍有未收数量，短收结案仅限管理员确认。', 'Goods are still outstanding. Shortfall closure requires administrator approval.')" />
        <el-checkbox v-if="hasShortfall" v-model="closing.approveShortfall" :disabled="Number(user.id) !== 1">{{ t('确认短收并结束后续收货', 'Approve shortfall and end receiving') }}</el-checkbox>
        <el-form-item :label="t('结案说明（短收必填）', 'Closure note (required for shortfall)')"><el-input v-model="closing.reason" type="textarea" maxlength="500" :rows="3" /></el-form-item>
        <div class="form-footer"><el-button type="primary" :loading="busy" :disabled="hasShortfall && Number(user.id) !== 1" @click="saveClosure">{{ t('确认结案', 'Confirm closure') }}</el-button><el-button @click="screen = 'detail'">{{ t('返回详情', 'Back to details') }}</el-button></div>
      </el-form>
      <el-form v-else-if="screen === 'cancel'" label-position="top" :disabled="blocked" @submit.prevent="cancelAsn"><el-form-item :label="t('取消原因', 'Cancellation reason')"><el-input v-model="cancelReason" type="textarea" maxlength="500" /></el-form-item><div class="form-footer"><el-button type="danger" :loading="busy" @click="cancelAsn">{{ t('确认取消入库', 'Confirm cancellation') }}</el-button><el-button @click="screen = 'detail'">{{ t('返回详情', 'Back to details') }}</el-button></div></el-form>
      <template v-else>
        <UnidentifiedPanel :key="'unknown:' + detail.id + ':' + detail._version" :asn="detail" :blocked="blocked" :permitted="permitted" @submit="submit" />
        <CustodyPanel :key="detail.id + ':' + detail._version" :asn="detail" :blocked="blocked" :permitted="permitted" @submit="submit" />
        <LateSupplementPanel :key="'late:' + detail.id + ':' + detail._version" :asn="detail" :blocked="blocked" :permitted="permitted" @submit="submit" @open="open" />
        <ReceiptCorrectionPanel :asn="detail" :blocked="blocked" :permitted="permitted" @submit="submit" />
        <h3>{{ t('收货记录', 'Receipt history') }}</h3>
        <el-table :data="detail.receipts" border :empty-text="t('还没有收货记录', 'No receipts yet')"><el-table-column prop="receivedAt" :label="t('收货时间（UTC）', 'Received at (UTC)')" min-width="220" /><el-table-column prop="sku" label="SKU" min-width="160" /><el-table-column prop="quantity" :label="t('数量', 'Quantity')" min-width="100" /><el-table-column prop="locationName" :label="t('库位', 'Location')" min-width="150" /><el-table-column prop="batch" :label="t('批次', 'Batch')" min-width="140" /><el-table-column prop="serial" :label="t('串号', 'Serial')" min-width="160" /><el-table-column prop="expiry" :label="t('有效期', 'Expiry')" min-width="130" /></el-table>
        <p v-if="detail.status === 'CLOSED'" class="help">{{ t('已结案，相关费用可在“费用与账单”中查询。', 'Closed. Related charges are available in Charges and invoices.') }} {{ detail.closureReason }}</p>
        <p v-if="detail.status === 'CANCELLED'" class="help">{{ detail.cancelReason }}</p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, toRaw } from 'vue'
import { ElMessage } from 'element-plus'
import auth from '@/plugins/auth'
import useUserStore from '@/store/modules/user'
import { bilingual as t } from '@/warehouse/i18n'
import { rejectedBeforeCommit } from '@/warehouse/inventory'
import requestClient from '@/utils/request'
import ReceiptCorrectionPanel from './ReceiptCorrectionPanel.vue'
import { correctionActions } from '@/warehouse/receipt-correction'
import CustodyPanel from './CustodyPanel.vue'
import UnidentifiedPanel from './UnidentifiedPanel.vue'
import LateSupplementPanel from './LateSupplementPanel.vue'
import { custodyActions, unknownActions, inboundClosable, inboundCancellable, deliveryTypes, inboundOpen, inboundEditable, blankInbound, forecastPayload, receiptPayload, closePayload, inboundPendingKey, readPendingInbound } from '@/warehouse/inbound'
import { listWarehouseInbound, getWarehouseInbound, saveWarehouseInbound, actionWarehouseInbound, actionInboundCustody, actionInboundUnidentified, getWarehouseLookups } from '@/api/warehouse'

const user = useUserStore(), permitted = action => auth.hasPermi('warehouse:asns:' + action)
const screen = ref('list'), rows = ref([]), total = ref(0), detail = ref(null), form = ref(blankInbound()), editId = ref(null), editVersion = ref(), formRef = ref()
const query = reactive({ pageNum: 1, pageSize: 20, keyword: '' }), options = reactive({}), loading = ref(false), busy = ref(false), error = ref(''), pending = ref(null), pendingError = ref('')
const receiptLines = ref([]), closing = ref({}), cancelReason = ref('')
const blocked = computed(() => busy.value || Boolean(pending.value) || Boolean(pendingError.value))
const pendingPermission = computed(() => ({ create: 'add', update: 'edit' })[pending.value?.type] || pending.value?.type)
const requiredRule = computed(() => [{ required: true, message: t('请填写或选择此项', 'Complete this field'), trigger: ['blur', 'change'] }])
const remainingLines = computed(() => detail.value?.lines?.filter(row => row.remaining > 0) || [])
const hasShortfall = computed(() => remainingLines.value.length > 0)
const locationOptions = computed(() => (options.locations || []).filter(row => row.active !== false && row.type !== 'Quarantine' && !row.custodyOnly && (!row.client || row.client === detail.value?.client)))
const statusLabel = status => t(({ NEW: '待收货', PARTIALLY_RECEIVED: '部分收货', RECEIVED: '已收齐待结案', CLOSED: '已结案', CANCELLED: '已取消' })[status] || status, ({ NEW: 'Awaiting receipt', PARTIALLY_RECEIVED: 'Partially received', RECEIVED: 'Fully received', CLOSED: 'Closed', CANCELLED: 'Cancelled' })[status] || status)
const tagType = status => ({ CLOSED: 'success', CANCELLED: 'info', PARTIALLY_RECEIVED: 'warning' })[status] || 'primary'
const receivedTotal = row => Object.values(row.received || {}).reduce((sum, n) => sum + Number(n), 0)
const expectedTotal = row => (row.lines || []).reduce((sum, line) => sum + Number(line.quantity), 0)
const withCurrent = (kind, id) => id && !(options[kind] || []).some(row => row.id === id) ? [{ id, label: (kind==='suppliers'?detail.value?.supplierName:detail.value?.lines?.find(row => row.product === id)?.sku) || id }, ...(options[kind] || [])] : options[kind] || []
const tickets = new Map(); let listTicket = 0, detailTicket = 0
async function lookup(kind, q = '', scope = {}) { if(kind==='suppliers'&&!auth.hasPermi('warehouse:suppliers:list'))return; const ticket = (tickets.get(kind) || 0) + 1; tickets.set(kind, ticket); try { const result = await getWarehouseLookups(kind, q, scope); if (tickets.get(kind) === ticket) options[kind] = result.data } catch (e) { if (tickets.get(kind) === ticket) error.value = e.message } }
async function loadList() { const ticket = ++listTicket; loading.value = true; try { const result = await listWarehouseInbound({ ...query }); if (ticket === listTicket) { rows.value = result.rows; total.value = result.total } } catch (e) { if (ticket === listTicket) error.value = e.message } finally { if (ticket === listTicket) loading.value = false } }
function search() { query.pageNum = 1; error.value = ''; loadList() }
async function open(id) { const ticket = ++detailTicket; loading.value = true; error.value = ''; try { const result = await getWarehouseInbound(id); if (ticket === detailTicket) { detail.value = result.data; screen.value = 'detail' } } catch (e) { if (ticket === detailTicket) error.value = e.message } finally { if (ticket === detailTicket) loading.value = false } }
function back() { detailTicket++; screen.value = 'list'; error.value = ''; loadList() }
function refresh() { error.value = ''; if (screen.value === 'detail' && detail.value) open(detail.value.id); else if (screen.value === 'list') loadList(); else error.value = t('正在填写表单，请先返回详情再刷新，避免覆盖当前输入。', 'Return to details before refreshing to preserve your current input.') }
function startCreate() { detailTicket++; editId.value = null; editVersion.value = undefined; detail.value = null; form.value = blankInbound(); error.value = ''; screen.value = 'edit'; lookup('clients'); lookup('warehouses'); lookup('suppliers') }
function startEdit() { editId.value = detail.value.id; editVersion.value = detail.value._version; form.value = { ...blankInbound(), ...structuredClone(toRaw(detail.value)), lines: detail.value.lines.map(row => ({ product: row.product, quantity: row.quantity })) }; error.value = ''; screen.value = 'edit'; lookup('clients'); lookup('warehouses'); lookup('suppliers'); lookup('products', '', { client: form.value.client }) }
function clientChanged() { form.value.lines = [{ product: '', quantity: 1 }]; options.products = []; if (form.value.client) lookup('products', '', { client: form.value.client }) }
function blankReceipt(product = remainingLines.value[0]?.product || '', quantity = 1) { return { product, quantity, location: '', batch: '', serial: '', expiry: '' } }
function startReceive() { receiptLines.value = remainingLines.value.map(row => blankReceipt(row.product, row.remaining)); error.value = ''; screen.value = 'receive'; options.locations = []; lookup('locations', '', { warehouse: detail.value.warehouse }) }
function startClose() { closing.value = { deliveryType: detail.value.deliveryType, deliveryQuantity: 1, hours: '0', approveShortfall: false, reason: '' }; error.value = ''; screen.value = 'close' }
const validationMessage = key => t(({ invalid_quantity: '数量必须为 1 至 10000000 的整数', required_field: '请填写必填项并选择商品和库位', invalid_forecast: '请检查商品行，合并重复商品，确认数量未超过上限', over_receipt: '本次实收不能超过该商品的待收数量', serial_quantity: '每个串号对应的数量必须为 1', invalid_hours: '工时最多三位小数，且不能超过 100000', shortfall_approval: '短收结案需要管理员确认并填写原因' })[key] || '请检查表单中的必填项、数量和工时', ({ invalid_quantity: 'Quantity must be an integer from 1 to 10000000', required_field: 'Complete required fields and select products and locations', invalid_forecast: 'Check forecast lines and combine duplicate products', over_receipt: 'Receipt exceeds the quantity remaining', serial_quantity: 'Each serial must have quantity 1', invalid_hours: 'Hours must have at most 3 decimals and be at most 100000', shortfall_approval: 'Approve shortfall and provide a reason' })[key] || 'Check required fields, quantities and hours')
async function saveForecast() { if (blocked.value) return; try { if (!await formRef.value.validate().catch(() => false)) return; await submit(editId.value ? 'update' : 'create', editId.value, forecastPayload(form.value, crypto.randomUUID(), editVersion.value)) } catch (e) { error.value = validationMessage(e.message) } }
async function saveReceipt() { if (blocked.value) return; try { await submit('receive', detail.value.id, receiptPayload(detail.value, receiptLines.value, crypto.randomUUID())) } catch (e) { error.value = validationMessage(e.message) } }
async function saveClosure() { if (blocked.value) return; try { await submit('close', detail.value.id, closePayload(detail.value, closing.value, crypto.randomUUID())) } catch (e) { error.value = validationMessage(e.message) } }
async function cancelAsn() { if (blocked.value) return; if (!cancelReason.value.trim()) { error.value = t('请填写取消原因', 'Enter a cancellation reason'); return } await submit('cancel', detail.value.id, { requestId: crypto.randomUUID(), _version: detail.value._version, reason: cancelReason.value.trim() }) }
async function submit(type, id, payload) {
  if (blocked.value) return
  const value = { type, id, payload }
  try { sessionStorage.setItem(inboundPendingKey(user.id), JSON.stringify(value)) } catch { error.value = t('无法保存请求编号，尚未提交。请检查浏览器存储权限。', 'The request could not be saved. Nothing was submitted. Check browser storage permissions.'); return }
  pending.value = value; await send(false)
}
async function correctionRequest(value) {
  const { correction, ...data } = value.payload
  const suffix = value.type === 'approveCorrection' ? '' : '/' + encodeURIComponent(correction) + '/' + (value.type === 'executeCorrection' ? 'execute' : 'cancel')
  return requestClient({ url: '/warehouse/inbound/' + encodeURIComponent(value.id) + '/corrections' + suffix, method: 'post', data, headers: { repeatSubmit: false } })
}
async function send(retrying) {
  if (busy.value || !pending.value || !permitted(pendingPermission.value)) return
  busy.value = true; error.value = ''
  try {
    const request = structuredClone(toRaw(pending.value))
    const result = correctionActions.includes(request.type) ? await correctionRequest(request) : ['create', 'update'].includes(request.type) ? await saveWarehouseInbound(request.id, request.payload) : custodyActions.includes(request.type) ? await actionInboundCustody(request.id, request.type, request.payload) : unknownActions.includes(request.type) ? await actionInboundUnidentified(request.id, request.type, request.payload) : await actionWarehouseInbound(request.id, request.type, request.payload)
    sessionStorage.removeItem(inboundPendingKey(user.id)); pending.value = null; if(correctionActions.includes(request.type))await open(request.id);else{detail.value = result.data; screen.value = 'detail'}; ElMessage.success(t('操作已完成', 'Operation completed')); await loadList()
  } catch (e) {
    if (!retrying && rejectedBeforeCommit(e)) { try { sessionStorage.removeItem(inboundPendingKey(user.id)); pending.value = null } catch { pendingError.value = t('无法更新本地请求记录，请先核对结果。', 'Local request storage could not be updated. Check the outcome first.') }; error.value = e.message }
    else error.value = (e.message || t('请求失败', 'Request failed')) + ' · ' + t('结果尚未确认，请重试原请求。', 'The outcome is unconfirmed. Retry the original request.')
  } finally { busy.value = false }
}
onMounted(() => { try { pending.value = readPendingInbound(sessionStorage, user.id) } catch { pendingError.value = t('无法读取上次请求，已暂停新提交。请先核对历史操作。', 'The previous request could not be read. New submissions are paused until the operation is checked.') } loadList() })
</script>

<style scoped>
.inbound-page { min-width: 0; }
.page-heading, .detail-heading, .actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.page-heading { justify-content: space-between; margin-bottom: 20px; }
h2, h3 { margin: 0; }
h3 { margin: 24px 0 14px; }
.page-heading .actions > *, .detail-actions > * { margin-left: 0; }
.inbound-page > .el-alert { margin-bottom: 16px; }
.filters { margin-top: 12px; }
.form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 20px; }
.form-grid :deep(.el-select), .form-grid :deep(.el-date-editor), .form-grid :deep(.el-input-number) { width: 100%; }
.table-scroll { max-width: 100%; }
.table-scroll :deep(.el-select), .table-scroll :deep(.el-date-editor) { width: 100%; }
.details { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin: 20px 0; }
.details dt { color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 8px; }
.details dd { margin: 0; overflow-wrap: anywhere; }
.help, .notes { color: var(--el-text-color-regular); line-height: 1.65; max-width: 75ch; white-space: pre-wrap; }
.detail-actions { margin: 20px 0; }
.add-row { margin-top: 12px; }
.form-footer { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; padding: 20px 0; border-top: 1px solid var(--el-border-color-lighter); }
.form-footer .el-button { margin-left: 0; }
@media (max-width: 800px) { .form-grid, .details { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 540px) { .form-grid { grid-template-columns: 1fr; } .details { grid-template-columns: 1fr 1fr; } .page-heading { align-items: flex-start; } .page-heading h2 { flex-basis: 100%; } .actions { gap: 8px; } .inbound-page { padding: 16px; } }
</style>
