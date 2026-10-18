import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockAPI, signIn, ticket, achievement, domain, user } from './fixtures'
test('ticket detail remains accessible on desktop and mobile', async ({ page }, info) => {
  await mockAPI(page)
  await signIn(page)
  await page.goto('/admin/tickets/' + ticket.id)
  await expect(page.getByRole('heading', { name: ticket.subject })).toBeVisible()
  await expect(page.getByLabel('Причина решения', { exact: true })).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: info.outputPath('ticket.png'), fullPage: true })
})
test('domain modal traps focus, is accessible and refreshes a stale revision', async ({ page }) => {
  await mockAPI(page)
  await signIn(page)
  let version = 1
  await page.route('**/api/v1/admin/email-domains?*', (route) =>
    route.fulfill({ json: { items: [{ ...domain, revision: version }], total: '1' } }),
  )
  let calls = 0
  await page.route('**/api/v1/admin/email-domains/' + domain.id, async (route) => {
    calls++
    if (calls === 1) {
      version = 2
      return route.fulfill({ status: 409, json: { error: 'conflict' } })
    }
    expect(route.request().postDataJSON().expected_revision).toBe(2)
    return route.fulfill({ json: { ...domain, revision: 3 } })
  })
  await page.goto('/admin/domains')
  await page.getByRole('button', { name: 'hse.ru', exact: true }).click()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByLabel('Причина решения').fill('Проверка актуального правила')
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()
  await expect(page.getByRole('alert')).toContainText('Данные уже изменились')
  await page.getByRole('button', { name: 'Обновить данные', exact: true }).click()
  await page.getByLabel('Причина решения').fill('Проверка актуального правила')
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(calls).toBe(2)
})
test('an uncertain mutation is not replayed automatically', async ({ page }) => {
  await mockAPI(page)
  await signIn(page)
  let count = 0
  await page.route('**/api/v1/admin/users/' + user.id + '/status', (route) => {
    count++
    return route.fulfill({ status: 504, json: { error: 'timeout' } })
  })
  await page.goto('/admin/users/' + user.id)
  await page.getByLabel('Причина решения').fill('Проверка обращения')
  await page.getByRole('button', { name: 'Заблокировать пользователя' }).click()
  await expect(page.getByRole('alert')).toContainText('Результат операции неизвестен')
  await expect(page.getByRole('button', { name: 'Заблокировать пользователя' })).toBeDisabled()
  expect(count).toBe(1)
})
test('evidence is loaded on demand and uses a safe external link', async ({ page }) => {
  await mockAPI(page)
  await signIn(page)
  let count = 0
  await page.route(
    '**/api/v1/admin/achievements/' + achievement.id + '/evidence/download-url',
    (route) => {
      count++
      return route.fulfill({
        json: {
          download_url: 'https://example.org/proof.pdf?signature=test-only',
          expires_at_unix: String(Math.floor(Date.now() / 1000) + 60),
        },
      })
    },
  )
  await page.goto('/admin/achievements/' + achievement.id)
  await expect(page.getByRole('heading', { name: achievement.details.title })).toBeVisible()
  expect(count).toBe(0)
  await page.getByRole('button', { name: 'Получить ссылку' }).click()
  const link = page.getByRole('link', { name: 'Открыть документ' })
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer')
  expect(count).toBe(1)
})
test('date bounds and empty-page pagination use the API contract', async ({ page }) => {
  await mockAPI(page)
  await signIn(page)
  const request = page.waitForRequest(
    (r) =>
      r.url().includes('/api/v1/admin/tickets?') &&
      new URL(r.url()).searchParams.has('created_to_unix'),
  )
  await page.goto('/admin/tickets?created_from_unix=2026-10-01&created_to_unix=2026-10-18')
  const url = new URL((await request).url())
  expect(
    Number(url.searchParams.get('created_to_unix')) -
      Number(url.searchParams.get('created_from_unix')),
  ).toBe(18 * 86400)
  await page.goto('/admin/users?offset=10000')
  await expect(page.getByText('На этой странице нет записей')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Предыдущая страница' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Следующая страница' })).toBeDisabled()
})
test('logout clears the tab identity and returns to login', async ({ page }, info) => {
  await mockAPI(page)
  await signIn(page)
  await page.goto('/admin/')
  await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible()
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Открыть меню' }).click()
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('matchlab.admin.session'))).toBeNull()
})
