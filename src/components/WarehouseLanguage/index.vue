<template>
  <el-dropdown trigger="click" @command="setLanguage">
    <el-button text :aria-label="bilingual('选择语言', 'Select language')">{{ language === 'en' ? 'English' : '中文' }} <el-icon><ArrowDown /></el-icon></el-button>
    <template #dropdown><el-dropdown-menu><el-dropdown-item command="zh-CN" :disabled="language === 'zh-CN'">中文</el-dropdown-item><el-dropdown-item command="en" :disabled="language === 'en'">English</el-dropdown-item></el-dropdown-menu></template>
  </el-dropdown>
</template>
<script setup>
import { language, setLanguage, bilingual } from '@/warehouse/i18n'
</script>
