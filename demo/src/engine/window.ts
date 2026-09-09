import { addDays, endOfShanghaiDay, isNotAfter, startOfShanghaiDay } from '../demo/clock'
import type { TimeWindow } from '../domain/types'
import type { EvalContext, QueryFail } from './types'
import { queryFail } from './types'

export type ResolvedInterval = { start: string; end: string }

export function resolveWindows(
  ctx: EvalContext,
  patientId: string,
  window: TimeWindow,
): ResolvedInterval[] | QueryFail {
  if (window.kind === 'relative_days') {
    return [
      {
        start: addDays(ctx.computeAt, -window.days),
        end: ctx.computeAt,
      },
    ]
  }
  if (window.kind === 'fixed') {
    return [normalizeFixed(window.start, window.end, ctx.computeAt)]
  }
  if (ctx.simulateFailure) return queryFail()
  const events = ctx.events
    .filter(
      (event) =>
        event.patientId === patientId &&
        event.type === window.eventType &&
        !isAfterCompute(event.occurredAt, ctx.computeAt) &&
        !isAfterCompute(event.ingestedAt, ctx.computeAt),
    )
    .slice()
    .sort((a, b) => {
      if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? -1 : 1
      return a.id < b.id ? -1 : 1
    })
  if (events.length === 0) return []
  const chosen =
    window.occurrence === 'first'
      ? events.slice(0, 1)
      : window.occurrence === 'latest'
        ? events.slice(-1)
        : events
  return chosen.map((event) => ({
    start: addDays(event.occurredAt, -Math.max(0, window.offsetBeforeDays)),
    end: clipEnd(addDays(event.occurredAt, Math.max(0, window.offsetAfterDays)), ctx.computeAt),
  }))
}

export function inInterval(businessTime: string, interval: ResolvedInterval, computeAt: string): boolean {
  return (
    isNotAfter(interval.start, businessTime) &&
    isNotAfter(businessTime, interval.end) &&
    isNotAfter(businessTime, computeAt)
  )
}

export function inAnyInterval(
  businessTime: string,
  intervals: ResolvedInterval[],
  computeAt: string,
): boolean {
  return intervals.some((interval) => inInterval(businessTime, interval, computeAt))
}

function normalizeFixed(start: string, end: string, computeAt: string): ResolvedInterval {
  const startIso = start.includes('T') ? start : startOfShanghaiDay(start)
  let endIso = end.includes('T') ? end : endOfShanghaiDay(end)
  if (/T00:00:00/.test(endIso)) {
    endIso = endOfShanghaiDay(endIso)
  }
  return { start: startIso, end: clipEnd(endIso, computeAt) }
}

function clipEnd(end: string, computeAt: string): string {
  return isNotAfter(end, computeAt) ? end : computeAt
}

function isAfterCompute(iso: string, computeAt: string): boolean {
  return !isNotAfter(iso, computeAt)
}


