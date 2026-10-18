import { dayUnix } from './format'
export function statisticsRange(from: string, to: string) {
  const validDate = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v + 'T00:00:00Z')) &&
    new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v
  if (!validDate(from) || !validDate(to)) return null
  const start = dayUnix(from)!,
    end = dayUnix(to, true)!
  return start > 0 && end > start && end - start <= 366 * 86400 ? { start, end } : null
}
