export const importPendingKey = (actor, kind) => 'warehouse.master.import.pending.' + actor + '.' + kind
export function readImportPending(storage, actor, kind) {
  const raw = storage.getItem(importPendingKey(actor, kind)); if (!raw) return null
  const pending = JSON.parse(raw)
  if (!pending || pending.kind !== kind || typeof pending.id !== 'string' || !pending.id || !['commit', 'cancel'].includes(pending.payload?.action) || typeof pending.payload.requestId !== 'string' || !pending.payload.requestId || !Number.isSafeInteger(pending.payload._version) || pending.payload._version < 1) throw Error('invalid_pending_import')
  return pending
}
export function importFileProblem(file) {
  if (!file || !/\.(xlsx|csv)$/i.test(file.name)) return 'file_type'
  if (!file.size || file.size > 2 * 1024 * 1024) return 'file_size'
  return ''
}
export function importChanges(row) {
  return (row.changed || []).map(key => ({ key, before: row.before?.[key] ?? '', after: row.after?.[key] ?? '' }))
}
