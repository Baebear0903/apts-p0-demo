import { DEFAULT_DEMO_CLOCK, HOSPITAL_TIME_ZONE } from '../domain/ids'

export { DEFAULT_DEMO_CLOCK, HOSPITAL_TIME_ZONE }

const pad = (value: number): string => String(value).padStart(2, '0')

/** Convert an instant to hospital-local ISO with fixed +08:00 (no DST). */
export function toShanghaiIso(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}+08:00`
}

export function shanghaiIso(date: string, time: string): string {
  return `${date}T${time}+08:00`
}

export function addMinutes(iso: string, minutes: number): string {
  return toShanghaiIso(new Date(new Date(iso).getTime() + minutes * 60 * 1000))
}

export function addDays(iso: string, days: number): string {
  return addMinutes(iso, days * 24 * 60)
}

export function formatDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HOSPITAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
}

export function formatDate(iso: string): string {
  return formatDateTime(iso).slice(0, 10)
}

export function isNotAfter(iso: string, cutoffIso: string): boolean {
  return new Date(iso).getTime() <= new Date(cutoffIso).getTime()
}

export function startOfShanghaiDay(isoOrDate: string): string {
  const date = isoOrDate.includes('T') ? formatDate(isoOrDate) : isoOrDate.slice(0, 10)
  return shanghaiIso(date, '00:00:00')
}

export function endOfShanghaiDay(isoOrDate: string): string {
  const date = isoOrDate.includes('T') ? formatDate(isoOrDate) : isoOrDate.slice(0, 10)
  return shanghaiIso(date, '23:59:59')
}

/** Signed elapsed days; does not take the absolute value. */
export function daysBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / (24 * 60 * 60 * 1000)
}

export function isoToDatetimeLocal(iso: string): string {
  return iso.slice(0, 16)
}

export function datetimeLocalToIso(value: string): string {
  const [date, time] = value.split('T')
  if (!date || !time) return value
  const normalized = time.length === 5 ? `${time}:00` : time.slice(0, 8)
  return shanghaiIso(date, normalized)
}

export function minutesBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / (60 * 1000)
}

export function isAtOrAfter(iso: string, cutoffIso: string): boolean {
  return new Date(iso).getTime() >= new Date(cutoffIso).getTime()
}

export function eachShanghaiDate(startIso: string, endIso: string): string[] {
  const dates: string[] = []
  let cursor = startOfShanghaiDay(startIso)
  const last = startOfShanghaiDay(endIso)
  while (cursor <= last) {
    dates.push(formatDate(cursor))
    cursor = addDays(cursor, 1)
  }
  return dates
}
