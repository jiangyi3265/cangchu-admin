export const editableKinds = new Set(['clients', 'products', 'warehouses', 'locationTypes', 'locations', 'suppliers', 'channels'])
export const fieldKey = field => field.key || field.name
export const writableFields = (fields, canEditFinance) => fields.map(field => field.financial && !canEditFinance ? { ...field, readOnly: true } : field)
export const entityFields = entity => (Array.isArray(entity?.fields) ? entity.fields : Object.values(entity?.fields || {}).flat()).map(field => {
  const tab = entity?.tabs?.find(tab => tab.keys?.includes(fieldKey(field)))
  return { ...field, group: field.group || field.tab || tab?.labelEn || 'General' }
})
export const fieldOptions = field => (field.options || []).map(option => typeof option === 'object' ? option : { value: option, label: option })
export const lookupSource = field => field.lookupSource || field.source
export const lookupScope = (source, values) => source === 'products' && values.client ? { client: values.client } : source === 'locations' && (values.warehouse || values.defaultWarehouse) ? { warehouse: values.warehouse || values.defaultWarehouse } : {}
export const lookupOptions = (field, values) => values.map(item => ({ ...item, id: field.lookupValue === 'label' ? item.label : item.id }))
export function initialValues(fields, record) {
  const values = {}
  for (const field of fields) {
    const key = fieldKey(field)
    if (record && Object.hasOwn(record, key)) values[key] = structuredClone(record[key])
    else if (!record && Object.hasOwn(field, 'default')) values[key] = structuredClone(field.default)
    else if (field.type === 'toggle' || field.type === 'boolean') values[key] = false
    else values[key] = field.type === 'number' ? undefined : ''
  }
  return values
}
export function savePayload(fields, values, version) {
  const payload = {}
  for (const field of fields) {
    const key = fieldKey(field)
    if (field.readOnly || field.readonly || field.disabled || !Object.hasOwn(values, key) || values[key] === undefined) continue
    payload[key] = values[key]
  }
  if (version !== undefined) payload._version = version
  return payload
}
export function entityColumns(entity) {
  return (entity?.columns || []).map(column => Array.isArray(column) ? { key: column[0], label: column[1] } : { ...column, key: column.key || column.prop || column.field })
}
