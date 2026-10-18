import { test, expect } from '@playwright/test'
import { mockAPI, signIn } from './fixtures'
test('custom statistics range follows UTC bounds and exposes chart data', async ({ page }) => {
  await mockAPI(page)
  await signIn(page)
  await page.goto('/admin/')
  await page.getByLabel('Период статистики').selectOption('custom')
  await page.getByLabel('Начало периода (UTC)').fill('2026-10-01')
  await page.getByLabel('Конец периода (UTC)').fill('2026-10-18')
  const call = page.waitForRequest(
    (r) =>
      r.url().includes('/api/v1/admin/statistics?') &&
      new URL(r.url()).searchParams.get('from_unix') ===
        String(Date.parse('2026-10-01T00:00:00Z') / 1000),
  )
  await page.getByRole('button', { name: 'Показать статистику' }).click()
  const url = new URL((await call).url())
  expect(Number(url.searchParams.get('to_unix')) - Number(url.searchParams.get('from_unix'))).toBe(
    18 * 86400,
  )
  await expect(page).toHaveURL(/days=custom/)
  await page.getByText('Таблица активности', { exact: true }).click()
  await expect(page.getByRole('cell', { name: '2026-10-01', exact: true })).toBeVisible()
  await page.getByLabel('Начало периода (UTC)').fill('2024-01-01')
  await page.getByRole('button', { name: 'Показать статистику' }).click()
  await expect(page.getByRole('alert')).toContainText('не более 366 дней')
})
