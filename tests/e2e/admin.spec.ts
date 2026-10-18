import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mockAPI, signIn, staff, ticket, achievement, domain } from './fixtures'
test('login is usable, accessible and responsive', async ({ page }, info) => {
  await mockAPI(page)
  await page.goto('/admin/login')
  await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible()
  await page.getByLabel('Служебная почта').fill('admin@example.org')
  await page.getByLabel('Пароль', { exact: true }).fill('fixture-password-only')
  await page.screenshot({ path: info.outputPath('login.png'), fullPage: true })
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
  await page.getByRole('button', { name: 'Войти в панель' }).click()
  await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible()
})
test('overview uses API data and has no horizontal overflow', async ({ page }, info) => {
  await mockAPI(page)
  await signIn(page)
  await page.goto('/admin/')
  await expect(page.getByRole('heading', { name: 'Здравствуйте, Анна' })).toBeVisible()
  await expect(page.getByText('1 254', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('overview.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
test('filters persist in URL, pagination preserves filters', async ({ page }) => {
  await mockAPI(page)
  await signIn(page)
  await page.goto('/admin/tickets?text=участник')
  await expect(page.getByRole('link', { name: ticket.subject })).toBeVisible()
  await page.getByLabel('Статус', { exact: true }).selectOption('closed')
  const call = page.waitForRequest(
    (r) =>
      r.url().includes('/api/v1/admin/tickets?') &&
      new URL(r.url()).searchParams.get('status') === 'closed',
  )
  await page.getByRole('button', { name: 'Найти', exact: true }).click()
  await call
  await expect(page).toHaveURL(/text=.*status=closed/)
  await page.getByRole('link', { name: ticket.subject }).click()
  await page.getByRole('link', { name: 'Назад к списку' }).click()
  await expect(page).toHaveURL(/status=closed/)
})
test('ticket decision uses revision and blocks duplicate submissions', async ({ page }) => {
  await mockAPI(page)
  await signIn(page)
  let count = 0
  await page.route('**/api/v1/admin/tickets/' + ticket.id + '/actions', async (route) => {
    count++
    expect(route.request().postDataJSON()).toEqual({
      action: 'resolve',
      assigned_admin_id: '',
      comment: 'Проверили обстоятельства обращения',
      expected_revision: 3,
    })
    await new Promise((r) => setTimeout(r, 250))
    await route.fulfill({ status: 200, json: ticket })
  })
  await page.goto('/admin/tickets/' + ticket.id)
  await page
    .getByLabel('Причина решения', { exact: true })
    .fill('Проверили обстоятельства обращения')
  await page.getByRole('button', { name: 'Применить решение' }).dblclick()
  await expect(page.getByRole('status').filter({ hasText: 'Изменения сохранены' })).toBeVisible()
  expect(count).toBe(1)
})
test('a conflict requires refreshing state before retrying', async ({ page }) => {
  await mockAPI(page)
  await signIn(page)
  await page.route('**/api/v1/admin/achievements/' + achievement.id + '/decision', (route) =>
    route.fulfill({ status: 409, json: { error: 'conflict' } }),
  )
  await page.goto('/admin/achievements/' + achievement.id)
  await page.getByLabel('Причина решения', { exact: true }).fill('Документ проверен')
  await page.getByRole('button', { name: 'Сохранить решение' }).click()
  await expect(page.getByRole('alert')).toContainText('Данные уже изменились')
  await expect(page.getByRole('button', { name: 'Сохранить решение' })).toBeDisabled()
  await page.getByRole('button', { name: 'Обновить данные', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Сохранить решение' })).toBeEnabled()
})
test('moderator cannot open staff management and can inspect domains read-only', async ({
  page,
}) => {
  await mockAPI(page, { role: 'moderator' })
  await signIn(page)
  await page.goto('/admin/staff')
  await expect(page).toHaveURL(new RegExp('/admin/?$'))
  await expect(page.getByRole('link', { name: 'Сотрудники', exact: true })).toHaveCount(0)
  await page.goto('/admin/domains')
  await page.getByRole('button', { name: 'hse.ru', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('domain update sends explicit false and no unsupported detail GET', async ({ page }) => {
  await mockAPI(page)
  await signIn(page)
  await page.route('**/api/v1/admin/email-domains/' + domain.id, async (route) => {
    expect(route.request().method()).toBe('PUT')
    expect(route.request().postDataJSON()).toEqual({
      domain: 'hse.ru',
      organization_name: domain.organization_name,
      is_active: false,
      expected_revision: 1,
      reason: 'Временное ограничение регистрации',
    })
    await route.fulfill({ status: 200, json: { ...domain, is_active: false, revision: 2 } })
  })
  await page.goto('/admin/domains')
  await page.getByRole('button', { name: 'hse.ru', exact: true }).click()
  await page.getByLabel('Разрешить регистрацию').uncheck()
  await page.getByLabel('Причина решения').fill('Временное ограничение регистрации')
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('a lost session returns to login and removes cached staff data', async ({ page }) => {
  await mockAPI(page)
  await signIn(page)
  await page.goto('/admin/')
  await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible()
  await page.route('**/api/v1/admin/users?*', (route) =>
    route.fulfill({ status: 401, json: { error: 'expired' } }),
  )
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/admin\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('matchlab.admin.session'))).toBeNull()
  await expect(page.getByText(staff.display_name, { exact: true })).toHaveCount(0)
})
test('empty queues are explicit', async ({ page }) => {
  await mockAPI(page, { empty: true })
  await signIn(page)
  await page.goto('/admin/tickets')
  await expect(page.getByRole('heading', { name: 'Здесь пока пусто' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Следующая страница' })).toBeDisabled()
})
