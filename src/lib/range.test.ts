import { expect, it } from 'vitest'
import { statisticsRange } from './range'
it('enforces inclusive UTC dates and the 366-day API limit', () => {
  expect(
    statisticsRange('2026-10-18', '2026-10-18')?.end! -
      statisticsRange('2026-10-18', '2026-10-18')?.start!,
  ).toBe(86400)
  expect(statisticsRange('2025-01-01', '2026-01-01')).not.toBeNull()
  expect(statisticsRange('2025-01-01', '2026-01-02')).toBeNull()
  expect(statisticsRange('2026-02-30', '2026-03-02')).toBeNull()
  expect(statisticsRange('2026-10-19', '2026-10-18')).toBeNull()
})
