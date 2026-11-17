<template>
  <section v-if="asn.lateSupplement || asn.status === 'CLOSED'" class="late-supplement">
    <h3>{{ t('迟到补收关联', 'Late receipt links') }}</h3>
    <template v-if="asn.lateSupplement">
      <p>{{ t('此单为迟到补单，原单的结案记录保持不变。', 'This is a late supplement. The original closure remains unchanged.') }}</p>
      <el-button link type="primary" :disabled="blocked" @click="$emit('open', asn.lateSupplement.parentAsn)">{{ t('查看原单', 'View original ASN') }} · {{ asn.lateSupplement.parentReference }}</el-button>
      <p>{{ adminLabel(asn.lateSupplement.adminPolicy) }} · {{ skuLabel(asn.lateSupplement.skuPolicy) }}</p>
      <p>{{ asn.lateSupplement.reason }}</p>
      <el-table :data="asn.lateSupplement.lines" border><el-table-column :label="t('商品', 'Product')" min-width="180"><template #default="{ row }">{{ sku(row.product) }}</template></el-table-column><el-table-column prop="quantity" :label="t('批准补收', 'Approved quantity')" min-width="140" /><el-table-column prop="matchedShortfall" :label="t('关联原单短收', 'Matched shortfall')" min-width="165" /><el-table-column prop="additionalApproved" :label="t('额外批准', 'Additional approved')" min-width="165" /></el-table>
    </template>
    <template v-else>
      <p>{{ t('补单单独记录到货和费用，原单不重新打开。未收货的补单占用关联短收数量；取消或短收结案后，未接受的部分可重新关联。', 'Supplements record their own receipts and charges without reopening this ASN. Open supplements reserve matched shortfall; cancellation or short closure releases the unaccepted portion.') }}</p>
      <el-table :data="asn.lateChildren || []" border :empty-text="t('尚无迟到补单', 'No late supplements')">
        <el-table-column :label="t('补单', 'Supplement')" min-width="200"><template #default="{ row }"><el-button link type="primary" :disabled="blocked" @click="$emit('open', row.id)">{{ row.reference }}</el-button></template></el-table-column>
        <el-table-column :label="t('状态', 'Status')" min-width="150"><template #default="{ row }">{{ status(row.status) }}</template></el-table-column>
        <el-table-column :label="t('管理费', 'Administration')" min-width="190"><template #default="{ row }">{{ adminLabel(row.adminPolicy) }}</template></el-table-column>
        <el-table-column :label="t('SKU 计费', 'SKU charging')" min-width="230"><template #default="{ row }">{{ skuLabel(row.skuPolicy) }}</template></el-table-column>
        <el-table-column prop="reason" :label="t('批准说明', 'Approval reason')" min-width="230" />
      </el-table>
      <el-button v-if="permitted('lateSupplement') && !editing" class="create-late" :disabled="blocked || (asn.lateChildren?.length || 0) >= 250" @click="start">{{ t('批准并创建迟到补单', 'Approve a late supplement') }}</el-button>
      <el-form v-if="editing" label-position="top" :disabled="blocked" @submit.prevent="submit">
        <h3>{{ t('迟到补单批准', 'Late supplement approval') }}</h3>
        <el-alert v-if="error" type="error" :title="error" show-icon :closable="false" />
        <div class="late-grid">
          <el-form-item :label="t('补单单号', 'Supplement reference')"><el-input v-model="form.reference" maxlength="191" /></el-form-item>
          <el-form-item :label="t('预计到货日', 'Expected date')"><el-date-picker v-model="form.expectedDate" type="date" value-format="YYYY-MM-DD" /></el-form-item>
          <el-form-item :label="t('补单到货类型', 'Supplement delivery type')"><el-select v-model="form.deliveryType"><el-option v-for="value in deliveryTypes" :key="value" :value="value" :label="value" /></el-select></el-form-item>
          <el-form-item :label="t('补单管理费', 'Supplement administration fee')" required><el-select v-model="form.adminPolicy" :aria-label="t('补单管理费', 'Supplement administration fee')" :placeholder="t('明确选择管理费规则', 'Choose administration policy')"><el-option v-for="value in ['included', 'separate']" :key="value" :value="value" :label="adminLabel(value)" /></el-select></el-form-item>
          <el-form-item :label="t('补单 SKU 费', 'Supplement SKU fee')" required><el-select v-model="form.skuPolicy" :aria-label="t('补单 SKU 费', 'Supplement SKU fee')" :placeholder="t('明确选择 SKU 费规则', 'Choose SKU policy')"><el-option v-for="value in ['group', 'separate']" :key="value" :value="value" :label="skuLabel(value)" /></el-select></el-form-item>
        </div>
        <p>{{ t('件费按本次实际接受数量计收；到货柜／托／箱费用和工时仍在补单结案时确认。', 'Unit fees apply to goods actually accepted. Delivery and labour charges are confirmed when this supplement closes.') }}</p>
        <el-table :data="form.lines" border>
          <el-table-column :label="t('原单商品', 'Original product')" min-width="220"><template #default="{ row, $index }"><el-select v-model="row.product" :aria-label="t('补单商品', 'Supplement product') + ' ' + ($index + 1)"><el-option v-for="line in asn.lines" :key="line.product" :value="line.product" :label="line.sku" /></el-select></template></el-table-column>
          <el-table-column :label="t('补收数量', 'Supplement quantity')" min-width="190"><template #default="{ row, $index }"><el-input-number v-model="row.quantity" :min="1" :max="10000000" :precision="0" :aria-label="t('补收数量', 'Supplement quantity') + ' ' + ($index + 1)" /></template></el-table-column>
          <el-table-column :label="t('可关联短收', 'Unallocated shortfall')" min-width="180"><template #default="{ row }">{{ asn.lateRemaining?.[row.product] || 0 }}</template></el-table-column>
          <el-table-column :label="t('本次额外数量', 'Additional quantity')" min-width="180"><template #default="{ row }">{{ Math.max(0, row.quantity - (asn.lateRemaining?.[row.product] || 0)) }}</template></el-table-column>
          <el-table-column width="100"><template #default="{ $index }"><el-button link type="danger" :disabled="blocked || form.lines.length === 1" @click="form.lines.splice($index, 1)">{{ t('移除', 'Remove') }}</el-button></template></el-table-column>
        </el-table>
        <el-button class="create-late" :disabled="blocked || form.lines.length >= asn.lines.length" @click="form.lines.push({ product: '', quantity: 1 })">{{ t('添加补收商品', 'Add supplement product') }}</el-button>
        <el-checkbox v-model="form.approveAdditional" class="additional-confirm">{{ t('明确批准超出原单未关联短收的额外数量', 'Approve quantities beyond the original unallocated shortfall') }}</el-checkbox>
        <el-form-item :label="t('批准原因', 'Approval reason')" required><el-input v-model="form.reason" :aria-label="t('批准原因', 'Approval reason')" type="textarea" maxlength="500" :rows="3" /></el-form-item>
        <div class="late-actions"><el-button type="primary" :disabled="blocked" @click="submit">{{ t('确认批准并建补单', 'Confirm approval and create supplement') }}</el-button><el-button :disabled="blocked" @click="editing = false">{{ t('取消填写', 'Cancel') }}</el-button></div>
      </el-form>
    </template>
  </section>
</template>
<script setup>
import { ref } from 'vue'
import { bilingual as t } from '@/warehouse/i18n'
import { deliveryTypes, supplementPayload } from '@/warehouse/inbound'
const props = defineProps({ asn: { type: Object, required: true }, blocked: Boolean, permitted: { type: Function, required: true } })
const emit = defineEmits(['submit', 'open']), editing = ref(false), form = ref({}), error = ref('')
const adminLabel = policy => policy === 'included' ? t('沿用原单，不另收管理费', 'Included in original administration') : t('补单另收管理费', 'Charge administration separately')
const skuLabel = policy => policy === 'group' ? t('与原单及合并补单去重', 'Once across original and grouped supplements') : t('本补单单独计 SKU 费', 'Charge SKU fees separately for this supplement')
const sku = product => props.asn.lines.find(line => line.product === product)?.sku || product
const status = value => t(({ NEW: '待收货', PARTIALLY_RECEIVED: '部分收货', RECEIVED: '已收齐待结案', CLOSED: '已结案', CANCELLED: '已取消' })[value] || value, ({ NEW: 'Awaiting receipt', PARTIALLY_RECEIVED: 'Partially received', RECEIVED: 'Fully received', CLOSED: 'Closed', CANCELLED: 'Cancelled' })[value] || value)
function start() {
  const lines = props.asn.lines.filter(row => props.asn.lateRemaining?.[row.product] > 0).map(row => ({ product: row.product, quantity: props.asn.lateRemaining[row.product] }))
  form.value = { reference: props.asn.reference.slice(0, 150) + '-L-' + crypto.randomUUID().slice(0, 8), deliveryType: props.asn.deliveryType, expectedDate: '', adminPolicy: '', skuPolicy: '', approveAdditional: false, reason: '', lines: lines.length ? lines : [{ product: props.asn.lines[0].product, quantity: 1 }] }; error.value = ''; editing.value = true
}
function submit() {
  if (props.blocked) return
  try { const body = supplementPayload(props.asn, form.value, crypto.randomUUID()); error.value = ''; emit('submit', 'lateSupplement', props.asn.id, body) }
  catch (e) { error.value = e.message === 'supplement_policy' ? t('请明确选择管理费和 SKU 费规则', 'Choose both administration and SKU policies') : e.message === 'supplement_additional' ? t('补收超过可关联短收，请核对并明确批准额外数量', 'Quantity exceeds unallocated shortfall; review and explicitly approve additional goods') : t('请检查单号、商品、数量和批准原因，重复商品请合并。', 'Check reference, products, quantities and reason. Combine duplicate products.') }
}
</script>
<style scoped>
.late-supplement { margin: 24px 0; min-width: 0; }
h3 { font-size: 16px; margin: 24px 0 14px; }
p { line-height: 1.65; overflow-wrap: anywhere; }
.late-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
.late-grid :deep(.el-select), .late-grid :deep(.el-date-editor) { width: 100%; }
.create-late { margin-top: 14px; }
.additional-confirm { display: flex; height: auto; margin: 20px 0; }
.additional-confirm :deep(.el-checkbox__label) { white-space: normal; line-height: 1.6; }
.late-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
.late-actions .el-button { margin-left: 0; max-width: 100%; height: auto; min-height: 32px; white-space: normal; }
.el-alert { margin-bottom: 16px; }
@media (max-width: 650px) { .late-grid { grid-template-columns: 1fr; } }
</style>
