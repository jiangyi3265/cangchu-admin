export const carrierStates={PREPARING:['核验中','Verifying'],SENDING:['建单结果待确认','Awaiting creation result'],CREATED:['已建单，面单待补齐','Created, labels incomplete'],LABELLED:['面单已齐','Labels ready'],REJECTED:['未建单','Not created'],UNKNOWN:['建单结果不明','Creation outcome unknown']}
export const carrierMessages={
 CARRIER_REQUEST_CLOSED:['原请求已核对关闭，请刷新后重新操作。','The original request has been closed. Refresh before starting another operation.'],
 CARRIER_REQUEST_FAILED:['请求未完成，请先核对已有发运记录。','The request did not finish. Check the existing shipment record first.'],
 CARRIER_CONNECTION_FAILED:['连接 DPD 未完成，请按已有发运状态核对结果。','The DPD connection did not finish. Check the stored shipment state.'],
 CARRIER_TIME_BUDGET:['本次等待已结束，请核对原请求或补取剩余面单。','The request deadline was reached. Check the original request or retrieve remaining labels.'],
 CARRIER_RESPONSE_TOO_LARGE:['快递返回的数据超出处理范围，请联系管理员。','The carrier response is too large. Contact an administrator.'],
 CARRIER_ENCRYPTION_FAILED:['凭据加密未完成，请联系管理员。','Credential encryption failed. Contact an administrator.'],
 CARRIER_DECRYPTION_FAILED:['无法读取已保存的凭据，请管理员核对服务器密钥。','Stored credentials could not be read. Ask an administrator to check the server key.'],
 CARRIER_PATH_INVALID:['快递接口地址校验失败，请联系管理员。','Carrier endpoint validation failed. Contact an administrator.'],
 CARRIER_ORIGIN_INVALID:['快递服务器地址未通过校验，请联系管理员。','The carrier server address failed validation. Contact an administrator.'],
 DPD_ENVIRONMENT_INVALID:['快递环境配置无效，请管理员核对。','The carrier environment setting is invalid. Contact an administrator.'],
 DPD_RESPONSE_INVALID:['DPD 返回格式不完整，请按当前发运状态核对。','The DPD response is invalid. Check the current shipment state.'],
 DPD_IDENTITY_INVALID:['DPD 返回的运单信息不完整，不能直接重新建单。','DPD returned incomplete shipment identifiers. Do not create another shipment.'],
 DPD_AUTH_RESPONSE_INVALID:['DPD 授权响应无效，请核对账号配置。','The DPD authentication response is invalid. Review the account settings.'],
 DPD_REMOTE_ERROR:['DPD 未返回明确结果，请先核对原申请。','DPD did not return a conclusive result. Check the original request first.'],
 DPD_PARCEL_COUNT_INVALID:['每次申请须有 1 至 99 个已封箱包裹。','Each booking requires 1–99 sealed packages.'],
 DPD_WEIGHT_INVALID:['包裹重量不符合接口范围，请核对实测重量。','The measured package weight is outside the supported range.'],
 DPD_DANGEROUS_GOODS_UNSUPPORTED:['商品有特殊运输资料，当前普通派送流程暂不支持。','The product has special transport requirements that this domestic flow does not support.'],
 CARRIER_RUNTIME_DISABLED:['快递服务尚未启用，请联系管理员。','Carrier operations are disabled. Contact an administrator.'],
 CARRIER_KEY_MISSING:['服务器尚未配置凭据加密密钥。','The server credential encryption key is missing.'],
 CARRIER_CONNECTION_DISABLED:['该快递连接已停用。','This carrier connection is disabled.'],
 CARRIER_ROUTING_INACTIVE:['客户或仓库已停用。','The client or warehouse is inactive.'],
 CARRIER_ACCESS_REVOKED:['操作权限已变更，请联系管理员核对原请求。','Access has changed. Ask an administrator to check the original request.'],
 CARRIER_CREATE_OUTCOME_UNKNOWN:['请先联系 DPD 按发运参考号核对，暂时不能重新建单。','Ask DPD to check the shipment reference before taking further action.'],
 DPD_DOMESTIC_REQUIRED:['当前只支持国家代码为 GB 的英国境内订单。','This flow requires a domestic order with country code GB.'],
 DPD_CUSTOMS_OR_SPECIAL_ADDRESS:['该地址需要专门的报关或派送流程，暂不支持建单。','This address requires a separate customs or delivery workflow.'],
 DPD_ADDRESS_REQUIRES_REVIEW:['地址第三行无法完整传给 DPD，请先核对收货地址。','DPD cannot receive address line 3 in this flow. Review the delivery address.'],
 DPD_POSTCODE_INVALID:['请检查英国邮编。','Check the UK postcode.'],
 DPD_CONTACT_INVALID:['请检查联系人电话和邮箱。','Check the contact phone number and email.'],
 DPD_NOTIFICATION_REQUIRED:['此服务需要收件人邮箱和通知手机号。','This service requires a recipient email and notification mobile.'],
 DPD_SERVICE_REQUIRES_SPECIAL_FLOW:['此服务要求的附加资料暂不支持。','This service requires an unsupported additional workflow.'],
 DPD_SERVICE_UNAVAILABLE:['该账号当前没有此服务，请重新查询。','This service is unavailable for the account. Query services again.'],
 DPD_AUTH_DENIED:['DPD 未接受凭据，请管理员核对账号授权。','DPD rejected authentication. Check the account credentials.'],
 DPD_ACCOUNT_MISMATCH:['DPD 与 DPD Local 账号类型不匹配。','The account does not match the selected DPD business.'],
 DPD_RATE_LIMITED:['DPD 请求过于频繁，请稍后再试。','DPD has rate limited this account. Try again later.'],
 DPD_REQUEST_REJECTED:['DPD 拒绝了本次建单，请核对资料后重新查询服务。','DPD rejected creation. Review the details and query services again.'],
 DPD_SHIP_DATE_INVALID:['发运日期须为英国当地今天至七天内。','Use a shipment date from today through seven days ahead in London.'],
 DPD_LABEL_INVALID:['面单响应不完整，保留原运单补取面单。','The label response is invalid. Retrieve labels for the original shipment.'],
 DPD_LABEL_LIMIT:['面单总量超出限制，请联系管理员核对。','The label size limit was exceeded. Contact an administrator.'],
 CARRIER_LABEL_CORRUPT:['面单完整性检查失败，请联系管理员。','Label integrity verification failed. Contact an administrator.']
}
export const carrierLocked=order=>!!order?.carrierShipment?.id
export const canBookCarrier=order=>['JAVA_MANUAL_V1','JAVA_WOO_V1'].includes(order?.workflow)&&order.status==='PICKED'&&order.work?.scanningComplete===true&&order.work?.packingComplete===true&&!carrierLocked(order)
export function carrierPendingKey(actor,kind='book'){if(actor===undefined||actor===null||String(actor)==='')throw Error('missing_actor');return 'warehouse.carriers.'+kind+'.'+actor}
export function bookingPending(value){
 if(typeof value?.order!=='string'||!value.order||!value.payload)throw Error('invalid_pending')
 const payload={};for(const key of ['requestId','connection','networkCode','shipDate','notificationMobile']){if(typeof value.payload[key]!=='string'||key!=='notificationMobile'&&!value.payload[key])throw Error('invalid_pending');payload[key]=value.payload[key]}
 for(const key of ['_version','connectionVersion']){if(!Number.isSafeInteger(value.payload[key])||value.payload[key]<1)throw Error('invalid_pending');payload[key]=value.payload[key]}
 return {order:value.order,payload}
}
export function readCarrierPending(storage,actor){const raw=storage.getItem(carrierPendingKey(actor));return raw?bookingPending(JSON.parse(raw)):null}
export function connectionPending(value){if(!value?.id||!value.requestId)throw Error('invalid_pending');return {id:String(value.id),requestId:String(value.requestId)}}
export async function carrierIdentity(kind,actor,requestId){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode((kind==='book'?'carrier-book:':'carrier:')+actor+':'+requestId));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
export function londonDate(now=new Date()){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-')}
export function blankCarrier(){return {name:'',client:'',warehouse:'',enabled:false,config:{environment:'sandbox',businessUnit:'DPD',printerDpi:203,sender:{name:'',company:'',address1:'',address2:'',town:'',county:'',postcode:'',country:'GB',phone:'',email:''}},appKey:'',appSecret:''}}
export function carrierConnectionPayload(form,requestId){
 const out={requestId,name:String(form.name||'').trim(),client:String(form.client||''),warehouse:String(form.warehouse||''),enabled:form.enabled,config:{environment:form.config.environment,businessUnit:form.config.businessUnit,printerDpi:form.config.printerDpi,sender:{}}}
 for(const key of Object.keys(blankCarrier().config.sender))out.config.sender[key]=String(form.config.sender[key]||'')
 if(!out.name||!out.client||!out.warehouse||typeof out.enabled!=='boolean')throw Error('required_fields')
 if(form._version!==undefined)out._version=form._version
 if(form.appKey||form.appSecret){if(!form.appKey||!form.appSecret)throw Error('credential_pair');out.credentials={appKey:form.appKey,appSecret:form.appSecret}}
 return out
}
