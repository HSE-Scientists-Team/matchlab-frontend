import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
const token = 'a'.repeat(43)
const href = `https://matchlab.space/verify-email?token=${token}`
async function mockSite(page: import('@playwright/test').Page, code = 204) {
  let calls = 0
  await page.route('https://api.matchlab.space/api/v1/auth/email/confirm', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': 'https://matchlab.space',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'content-type',
        },
      })
      return
    }
    calls++
    expect(route.request().postDataJSON()).toEqual({ token })
    expect(route.request().headers().referer).toBeUndefined()
    await route.fulfill({
      status: code,
      headers: { 'Access-Control-Allow-Origin': 'https://matchlab.space' },
    })
  })
  await page.route('https://matchlab.space/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const file = path.startsWith('/verification-assets/')
      ? 'assets/' + path.split('/').pop()
      : 'verify-email.html'
    await route.fulfill({
      body: await readFile('web/' + file),
      contentType: file.endsWith('.mjs')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : 'text/html',
      headers: { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' },
    })
  })
  return () => calls
}
test('does not consume the token on load; explicit click confirms and clears the URL', async ({
  page,
}) => {
  const calls = await mockSite(page)
  await page.goto(href)
  await expect(page.getByRole('button', { name: 'Подтвердить почту' })).toBeEnabled()
  expect(calls()).toBe(0)
  await expect(page.getByRole('link', { name: 'Открыть в приложении' })).toHaveAttribute(
    'href',
    href,
  )
  await page.getByRole('button', { name: 'Подтвердить почту' }).click()
  await expect(page.getByRole('status')).toContainText('Почта подтверждена')
  expect(calls()).toBe(1)
  expect(page.url()).toBe('https://matchlab.space/verify-email')
  await expect(page.getByRole('link', { name: 'Открыть в приложении' })).toBeHidden()
})
test('does not treat account conflict as successful verification', async ({ page }) => {
  const calls = await mockSite(page, 409)
  await page.goto(href)
  await page.getByRole('button', { name: 'Подтвердить почту' }).click()
  await expect(page.getByRole('status')).toContainText('уже существует аккаунт')
  expect(calls()).toBe(1)
  expect(page.url()).toBe(href)
})
