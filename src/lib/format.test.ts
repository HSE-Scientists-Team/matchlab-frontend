import { describe, expect, it } from 'vitest'
import { safeURL, passwordValid, dayUnix } from './format'
describe('safe evidence links and form boundaries', () => {
  it('rejects executable and relative evidence URLs', () => {
    expect(safeURL('javascript:alert(1)')).toBeNull()
    expect(safeURL('//other.test/a')).toBeNull()
    expect(safeURL('https://example.org/a?signature=x')).toBe('https://example.org/a?signature=x')
  })
  it('validates bytes rather than character count', () => {
    expect(passwordValid('a'.repeat(11))).toBe(false)
    expect(passwordValid('я'.repeat(6))).toBe(true)
    expect(passwordValid('я'.repeat(37))).toBe(false)
  })
  it('turns inclusive UI end dates into an exclusive UTC upper bound', () =>
    expect(dayUnix('2026-10-18', true)! - dayUnix('2026-10-18')!).toBe(86400))
})
