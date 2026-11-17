<template>
  <div v-if="plan" class="plan">
    <el-descriptions :column="1" border>
      <el-descriptions-item :label="bilingual('处理方式','Outcome')">{{adjustmentRoute(plan.route)}}</el-descriptions-item>
      <el-descriptions-item :label="bilingual('币种','Currency')">{{plan.currency}}</el-descriptions-item>
      <el-descriptions-item :label="bilingual('调整前税前余额','Net before adjustment')">{{moneyText(plan.beforeNet)}}</el-descriptions-item>
      <el-descriptions-item :label="bilingual('本次税前核减','Net reduction')">{{moneyText(plan.net)}}</el-descriptions-item>
      <el-descriptions-item :label="bilingual('本次税额核减','Tax reduction')">{{moneyText(plan.tax)}}</el-descriptions-item>
      <el-descriptions-item :label="bilingual('本次含税核减','Total reduction')">{{moneyText(plan.amount)}}</el-descriptions-item>
      <el-descriptions-item :label="bilingual('剩余税前金额','Remaining net')">{{moneyText(plan.remainingNet)}}</el-descriptions-item>
      <el-descriptions-item :label="bilingual('复核说明','Review explanation')">{{plan.reason}}</el-descriptions-item>
    </el-descriptions>
    <el-table :data="plan.decisions||[]" border class="mt16"><el-table-column prop="description" :label="bilingual('原收费项目','Original component')" min-width="230" /><el-table-column :label="bilingual('决定','Decision')" min-width="110"><template #default="scope">{{scope.row.decision==='reduce'?bilingual('核减','Reduce'):bilingual('保留','Retain')}}</template></el-table-column><el-table-column prop="quantity" :label="bilingual('数量 / 金额','Quantity / amount')" min-width="140" /><el-table-column prop="rate" :label="bilingual('原单价','Original rate')" min-width="130" /></el-table>
  </div>
</template>
<script setup>
import {bilingual} from '@/warehouse/i18n'
import {adjustmentRoute,moneyText} from '@/warehouse/adjustments'
defineProps({plan:Object})
</script>
<style scoped>.mt16{margin-top:16px}.plan{overflow-wrap:anywhere}</style>
