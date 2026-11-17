export function decimalInput(value, maxScale = 9) {
  if (typeof value !== 'string' && typeof value !== 'number') throw Error('invalid_decimal')
  const text = String(value).trim(), match = /^(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match || (match[2] || '').length > maxScale || text.replace('.', '').replace(/^0+/, '').length > 24) throw Error('invalid_decimal')
  return text
}
