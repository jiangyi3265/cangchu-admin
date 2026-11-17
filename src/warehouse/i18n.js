import { computed, ref } from 'vue'
import zhElement from 'element-plus/es/locale/lang/zh-cn'
import enElement from 'element-plus/es/locale/lang/en'

const key = 'warehouse.locale'
let saved = 'zh-CN'
try { saved = localStorage.getItem(key) || saved } catch {}
export const language = ref(saved === 'en' ? 'en' : 'zh-CN')
export const elementLocale = computed(() => language.value === 'en' ? enElement : zhElement)
export function setLanguage(value) {
  language.value = value === 'en' ? 'en' : 'zh-CN'
  try { localStorage.setItem(key, language.value) } catch {}
  document.documentElement.lang = language.value
}
export const bilingual = (zh, en) => language.value === 'en' ? en || zh : zh || en
const translations = {
  '退货处理': 'Returns',
  '仓储管理': 'Warehouse', '仓储首页': 'Warehouse overview', '待迁移说明': 'Migration status', '基础资料': 'Master data', '客户管理': 'Clients', '商品管理': 'Products', '仓库管理': 'Warehouses', '库位类型': 'Location types', '库位管理': 'Locations', '供应商管理': 'Suppliers', '销售渠道': 'Sales channels', '店铺对接': 'Store connections', '快递发运': 'Carrier shipments',
  '库存盘点': 'Stocktakes', '库存管理': 'Inventory', '库存作业': 'Inventory operations', '订单管理': 'Orders', '订单履约': 'Order fulfilment', '数据范围': 'Data access', '财务计费': 'Finance and billing', '财务管理': 'Finance', '费用与账单': 'Charges and invoices', '入库管理': 'Inbound receiving', '计费管理': 'Billing', '平台对接': 'Integrations', '数据迁移': 'Data migration', '首页': 'Overview', '若依官网': 'RuoYi website',
  '系统管理': 'System', '用户管理': 'Users', '角色管理': 'Roles', '菜单管理': 'Menus', '部门管理': 'Departments', '岗位管理': 'Posts', '字典管理': 'Dictionaries', '参数设置': 'Configuration', '通知公告': 'Notices', '日志管理': 'Logs',
  '操作日志': 'Operation logs', '登录日志': 'Sign-in logs', '系统监控': 'Monitoring', '在线用户': 'Online users', '定时任务': 'Scheduled jobs', '服务监控': 'Server', '缓存监控': 'Cache', '缓存列表': 'Cache entries', '系统工具': 'Tools',
  '个人中心': 'Profile', '布局设置': 'Layout settings', '锁定屏幕': 'Lock screen', '退出登录': 'Sign out', '源码地址': 'Source repository', '文档地址': 'Documentation', '主题模式': 'Theme', '布局大小': 'Layout size', '消息通知': 'Notifications',
  '更多菜单': 'More menus', '刷新页面': 'Refresh page', '刷新': 'Refresh', '关闭当前': 'Close current', '关闭其他': 'Close others', '关闭左侧': 'Close left', '关闭右侧': 'Close right', '全部关闭': 'Close all', '全屏显示': 'Fullscreen', '退出全屏': 'Exit fullscreen'
}
export const ui = text => language.value === 'en' ? translations[text] || text : text
export const routeTitle = meta => bilingual(meta?.title || '', meta?.titleEn || translations[meta?.title] || meta?.title)
export const financeOption = value => bilingual(({ Orders: '订单数', Units: '商品件数', Daily: '每日', Weekly: '每周', Monthly: '每月', Additional: '附加费', Picking: '拣货费', Storage: '仓储费', 'Goods In': '入库费', Collection: '提货费', Rework: '加工费' })[value] || value, ({ Orders: 'Orders', Units: 'Units', Daily: 'Daily', Weekly: 'Weekly', Monthly: 'Monthly', Additional: 'Additional', Picking: 'Picking', Storage: 'Storage', 'Goods In': 'Goods in', Collection: 'Collection', Rework: 'Rework' })[value] || value)

export const storageLineLabel = value => {
  const text=String(value||'')
  const labels=[['Storage locations','库位仓储'],['Stock management fee','库存管理费'],['StorageUnits','存储单位'],['VolumetricCarton','整箱体积'],['Volumetric','商品体积'],['PerPalletUnit','托盘单位']]
  const item=labels.find(([prefix])=>text===prefix||text.startsWith(prefix+' · '))
  return item?bilingual(item[1]+text.slice(item[0].length),text):text
}
