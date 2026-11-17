import {bilingual} from './i18n'
export {moneyText,adjustmentPlanInput,financeRetryPermission,creditNoteHtml} from './adjustment-input.js'

export const adjustmentStatus = value => bilingual(({REVIEW:'待复核',APPROVED:'已批准，待执行',EXECUTED:'已执行',RETAINED:'已确认保留费用',CANCELLED:'已取消',POSTED:'已出具',REVOKED:'批准已撤销'})[value]||value,({REVIEW:'Awaiting review',APPROVED:'Approved, awaiting execution',EXECUTED:'Executed',RETAINED:'Charge retained',CANCELLED:'Cancelled',POSTED:'Posted',REVOKED:'Approval revoked'})[value]||value)
export const adjustmentRoute = value => bilingual(({RETAIN:'保留原费用',UNBILLED_REDUCTION:'核减未开票费用',DRAFT_REISSUE:'保留旧草稿并重开',CREDIT_NOTE:'出具原账单贷项'})[value]||value,({RETAIN:'Retain original charge',UNBILLED_REDUCTION:'Reduce unbilled charge',DRAFT_REISSUE:'Supersede and reissue draft',CREDIT_NOTE:'Credit original invoice'})[value]||value)
