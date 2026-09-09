import { describe, expect, it } from 'vitest'
import { addMinutes, DEFAULT_DEMO_CLOCK, formatDateTime } from './clock'

describe('clock', () => {
  it('默认演示时钟格式化为医院时区 2026-09-07 11:00', () => {
    expect(formatDateTime(DEFAULT_DEMO_CLOCK)).toBe('2026-09-07 11:00')
  })

  it('推进分钟保持 +08:00', () => {
    expect(addMinutes(DEFAULT_DEMO_CLOCK, 60)).toBe('2026-09-07T12:00:00+08:00')
  })
})
