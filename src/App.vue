<template>
  <el-config-provider :locale="elementLocale"><router-view /></el-config-provider>
</template>

<script setup>
import useSettingsStore from '@/store/modules/settings'
import { handleThemeStyle } from '@/utils/theme'
import { elementLocale, language, setLanguage } from '@/warehouse/i18n'

onMounted(() => {
  setLanguage(language.value)
  nextTick(() => {
    // 初始化主题样式
    handleThemeStyle(useSettingsStore().theme)
  })
})
</script>
