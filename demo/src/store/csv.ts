import type { Snapshot } from '../domain/types'

export const SNAPSHOT_CSV_COLUMNS = [
  '主患者标识',
  '姓名',
  '性别',
  '年龄',
  '就诊科室',
  '联系电话',
  '快照标识',
  '快照名称',
  '快照确认时间',
] as const

export const CSV_BOM = '\uFEFF'

export function csvEscape(value: string, asText = false): string {
  const needsQuote = asText || /[",\r\n]/.test(value)
  if (!needsQuote) return value
  return `"${value.replaceAll('"', '""')}"`
}

export function buildSnapshotCsv(
  snapshot: Snapshot,
  phoneByPatientId: Record<string, string | null | undefined>,
): string {
  const header = SNAPSHOT_CSV_COLUMNS.map((column) => csvEscape(column)).join(',')
  const lines = snapshot.members.map((member) => {
    const phone = phoneByPatientId[member.patientId]
    const phoneText = phone == null || phone === '' ? '' : String(phone)
    return [
      csvEscape(member.patientId, true),
      csvEscape(member.name),
      csvEscape(member.sex),
      csvEscape(String(member.age)),
      csvEscape(member.department ?? ''),
      phoneText === '' ? '' : csvEscape(phoneText, true),
      csvEscape(snapshot.id, true),
      csvEscape(snapshot.name),
      csvEscape(snapshot.confirmedAt),
    ].join(',')
  })
  return [header, ...lines].join('\r\n')
}

export function csvFileBytes(csv: string): string {
  return csv.startsWith(CSV_BOM) ? csv : `${CSV_BOM}${csv}`
}

export function parseCsv(text: string): string[][] {
  const source = text.startsWith(CSV_BOM) ? text.slice(CSV_BOM.length) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\r') {
      if (source[index + 1] === '\n') index += 1
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      continue
    }
    if (char === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      continue
    }
    field += char
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function triggerCsvDownload(filename: string, csv: string): void {
  const content = csvFileBytes(csv)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const createUrl = URL.createObjectURL
  if (typeof createUrl !== 'function') return
  const url = createUrl.call(URL, blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL?.(url)
}
