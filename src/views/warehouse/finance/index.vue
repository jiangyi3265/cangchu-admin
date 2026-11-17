<template><div class="app-container"><h2>{{ bilingual('财务计费','Finance and billing') }}</h2><el-alert v-if="!canQuery" type="warning" show-icon :closable="false" :title="bilingual('没有财务查询权限','Financial read permission is required')" /><template v-else><el-alert v-if="financePendingError" type="error" show-icon :closable="false" :title="bilingual('无法读取上次财务请求，新的提交已暂停，请先核对。','The previous finance request cannot be read. New submissions are paused until it is checked.')" class="mb16" /><el-alert v-if="financePending" type="warning" show-icon :closable="false" :title="bilingual('上次财务操作结果尚未确认','The last financial operation is unconfirmed')" class="mb16"><template #default><p>{{ financePending.label }} · {{ financePending.data?.requestId || financePending.params?.requestId }}</p><el-button :loading="financeBusy" :disabled="!canRetry" @click="retry">{{ bilingual('重试原请求','Retry original request') }}</el-button></template></el-alert><el-alert v-if="error" type="error" show-icon :closable="false" :title="error" class="mb16" /><el-tabs v-model="tab"><el-tab-pane :label="bilingual('收费规则','Pricing rules')" name="rules" lazy><FinanceRules /></el-tab-pane><el-tab-pane :label="bilingual('费用与账单','Charges and invoices')" name="ledger" lazy><FinanceLedger @review-charge="reviewCharge" /></el-tab-pane><el-tab-pane :label="bilingual('周期结算','Period billing')" name="period" lazy><FinancePeriod /></el-tab-pane><el-tab-pane :label="bilingual('结算记录','Billing history')" name="history" lazy><FinanceHistory /></el-tab-pane><el-tab-pane :label="bilingual('仓储历史','Storage history')" name="storage" lazy><FinanceStorage /></el-tab-pane><el-tab-pane :label="bilingual('历史仓储复核','Storage identity review')" name="storage-review" lazy><StorageReview /></el-tab-pane><el-tab-pane :label="bilingual('费用复核待办','Charge review queue')" name="review-cases" lazy><FinanceReviewCases @open-adjustment="openAdjustment" /></el-tab-pane><el-tab-pane :label="bilingual('调账与贷项','Adjustments and credits')" name="adjustments" lazy><FinanceAdjustments :target-charge="targetCharge" :target-adjustment="targetAdjustment" /></el-tab-pane></el-tabs></template></div></template>
<script setup>
import { computed, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import auth from '@/plugins/auth'
import useUserStore from '@/store/modules/user'
import { bilingual } from '@/warehouse/i18n'
import { financePending, financePendingError, financeBusy, initializeFinance, submitFinance } from '@/warehouse/finance'
import FinanceRules from './rules.vue'
import FinanceLedger from './ledger.vue'
import FinancePeriod from './period.vue'
import FinanceHistory from './history.vue'
import FinanceStorage from './storage.vue'
import StorageReview from './storage-review.vue'
import FinanceReviewCases from './review-cases.vue'
import FinanceAdjustments from './adjustments.vue'
import {financeRetryPermission} from '@/warehouse/adjustments'
const targetCharge=ref(null),targetAdjustment=ref(null)
function openAdjustment(id){targetAdjustment.value={id,nonce:crypto.randomUUID()};tab.value='adjustments'}
function reviewCharge(id){targetCharge.value={id,nonce:crypto.randomUUID()};tab.value='adjustments'}
const canRetry=computed(()=>auth.hasPermi(financeRetryPermission(financePending.value)))
const tab=ref('rules'),error=ref(''),user=useUserStore(),canQuery=computed(()=>auth.hasPermi('warehouse:finance:query'))
async function retry(){if(!canRetry.value)return;error.value='';try{await submitFinance(null,true);ElMessage.success(bilingual('已核对并完成原操作','Original operation confirmed'))}catch(e){error.value=e.message||bilingual('仍未确认，请稍后重试原请求','The result remains unconfirmed. Retry the original request later.')}}
onMounted(()=>initializeFinance(user.id))
</script>
<style scoped>h2{margin:0 0 20px;font-size:20px;font-weight:600}.mb16{margin-bottom:16px}p{overflow-wrap:anywhere}@media(max-width:600px){:deep(.el-form--inline .el-form-item){display:flex;margin-right:0}:deep(.el-form--inline .el-select),:deep(.el-form--inline .el-date-editor){max-width:100%}:deep(.el-form--inline .el-form-item__content){min-width:0}}</style>

