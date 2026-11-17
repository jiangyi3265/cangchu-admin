<template><div class="app-container"><h2>{{ routeTitle(route.meta) || bilingual('仓储业务', 'Warehouse operations') }}</h2><el-alert type="info" :closable="false" show-icon :title="bilingual('此业务正在迁移，暂不可操作', 'This workflow is being migrated and is not available yet')" :description="bilingual('当前页面不会执行收货、库存调整、订单发货或收费。完成 Java 业务校验和验收后再开放操作。', 'Receiving, stock adjustments, despatch and billing are unavailable on this page until the Java workflow is implemented and verified.')" /><el-button class="back" @click="router.push('/index')">{{ bilingual('返回首页', 'Back to overview') }}</el-button></div></template>
<script setup>
import { useRoute, useRouter } from 'vue-router'
import { bilingual, routeTitle } from '@/warehouse/i18n'
const route = useRoute(), router = useRouter()
</script>
<style scoped>.back { margin-top:24px; }</style>
