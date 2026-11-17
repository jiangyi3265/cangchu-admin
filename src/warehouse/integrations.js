export function connectionPayload(form,requestId){
 const result={requestId};for(const key of ['name','siteUrl','client','warehouse','channel']){if(typeof form[key]!=='string'||!form[key].trim())throw Error('required_connection_fields');result[key]=form[key].trim()}
 if(typeof form.enabled!=='boolean')throw Error('required_connection_fields');result.enabled=form.enabled
 if(form._version!==undefined)result._version=form._version
 if(form.consumerKey||form.consumerSecret){if(!form.consumerKey||!form.consumerSecret)throw Error('complete_credential_pair');result.credentials={consumerKey:form.consumerKey,consumerSecret:form.consumerSecret}}
 return result
}
export const integrationPendingKey=actor=>'warehouse.integrations.pending.'+actor
export function pendingMetadata(pending){
 if(!pending||!['save','pull'].includes(pending.kind)||typeof pending.id!=='string'||!pending.id||typeof pending.requestId!=='string'||!pending.requestId)throw Error('invalid_pending')
 const result={kind:pending.kind,id:pending.id,requestId:pending.requestId}
 if(pending.kind==='save'){result.isNew=pending.isNew===true;result.version=pending.version??null}
 else{const p=pending.payload;if(!p||p.requestId!==pending.requestId||!Number.isSafeInteger(p._version)||p._version<1)throw Error('invalid_pending');result.payload={requestId:p.requestId,_version:p._version};if(p.since!==undefined){if(typeof p.since!=='string'||!Number.isFinite(Date.parse(p.since)))throw Error('invalid_pending');result.payload.since=p.since}if(p.restartWindow!==undefined){if(typeof p.restartWindow!=='boolean')throw Error('invalid_pending');result.payload.restartWindow=p.restartWindow}}
 return result
}
export const readIntegrationPending=(storage,actor)=>{const raw=storage.getItem(integrationPendingKey(actor));return raw?pendingMetadata(JSON.parse(raw)):null}
export async function createdConnectionId(actor,requestId){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('integration:'+actor+':'+requestId));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
