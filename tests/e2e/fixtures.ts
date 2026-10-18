import type { Page, Route } from '@playwright/test'
export const staff = {
  id: '10000000-0000-0000-0000-000000000001',
  display_name: 'Анна Смирнова',
  email: 'admin@example.org',
  role: 'administrator',
  active: true,
  revision: 1,
  created_at_unix: '1770000000',
  last_login_at_unix: '1770000000',
}
export const user = {
  id: '20000000-0000-0000-0000-000000000002',
  display_name: 'Алексей Морозов',
  email: 'alex@example.org',
  status: 'active',
  email_verified: true,
  revision: 2,
  status_comment: '',
  created_at_unix: '1770000000',
  last_login_at_unix: '1770000000',
  status_changed_by_admin_id: '',
  status_changed_at_unix: '0',
}
export const ticket = {
  id: '30000000-0000-0000-0000-000000000003',
  author_user_id: user.id,
  assigned_admin_id: '',
  status: 'open',
  subject: 'Неприемлемые сообщения от участника',
  description:
    'Участник неоднократно присылает сообщения, не связанные с проектом. Прошу разобраться в ситуации.',
  target_user_id: user.id,
  target_project_id: '',
  file_ids: [],
  revision: 3,
  resolution_comment: '',
  created_at_unix: '1770000000',
  updated_at_unix: '1770000000',
  resolved_at_unix: '0',
}
export const achievement = {
  id: '40000000-0000-0000-0000-000000000004',
  user_id: user.id,
  details: {
    id: '40000000-0000-0000-0000-000000000004',
    kind: 'certificate',
    title: 'Машинное обучение: практический курс',
    description: 'Разработка моделей и работа с реальными данными.',
    institution: 'Университет',
    graduation_year: 2026,
    url: '',
    evidence_file_id: '50000000-0000-0000-0000-000000000005',
    expected_revision: 1,
  },
  status: 'pending_review',
  revision: 4,
  moderation_comment: '',
  created_at_unix: '1770000000',
}
export const domain = {
  id: '60000000-0000-0000-0000-000000000006',
  domain: 'hse.ru',
  organization_name: 'Высшая школа экономики',
  is_active: true,
  revision: 1,
  created_at_unix: '1770000000',
  updated_at_unix: '1770000000',
}
function section(
  counters: { category: string; value: string; count: string }[],
  daily: { date: string; category: string; count: string }[] = [],
) {
  return { counters, daily, generated_at_unix: String(Math.floor(Date.now() / 1000)) }
}
export const stats = {
  users: section([
    { category: 'users_by_status', value: 'active', count: '1248' },
    { category: 'users_by_status', value: 'blocked', count: '6' },
    { category: 'achievements_by_status', value: 'pending_review', count: '18' },
    { category: 'achievements_by_status', value: 'verified', count: '327' },
    { category: 'domains_by_status', value: 'active', count: '2' },
  ]),
  support: section([
    { category: 'tickets_by_status', value: 'open', count: '12' },
    { category: 'tickets_by_status', value: 'resolved', count: '47' },
  ]),
  projects: section([
    { category: 'projects_by_status', value: 'active', count: '86' },
    { category: 'projects_by_status', value: 'completed', count: '31' },
  ]),
  staff: section([
    { category: 'staff_by_role', value: 'administrator', count: '1' },
    { category: 'staff_by_role', value: 'moderator', count: '3' },
  ]),
}
// Synthetic daily points are confined to test fixtures, never shipped in src.
for (let i = 0; i < 30; i++) {
  const date = new Date((Math.floor(Date.now() / 86400000) - 29 + i) * 86400000)
    .toISOString()
    .slice(0, 10)
  stats.users.daily.push({ date, category: 'registrations', count: String([2, 4, 1, 3, 5][i % 5]) })
  stats.support.daily.push({ date, category: 'tickets_created', count: String(i % 3) })
  stats.projects.daily.push({ date, category: 'projects_created', count: String(i % 4) })
}
export async function mockAPI(
  page: Page,
  { role = 'administrator', empty = false }: { role?: string; empty?: boolean } = {},
) {
  await page.route('**/api/v1/admin/**', async (route: Route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace('/api/v1/admin', ''),
      method = route.request().method()
    const list = (items: unknown[]) => ({
      items: empty ? [] : items,
      total: empty ? '0' : String(items.length),
    })
    let body: unknown
    if (path === '/auth/login')
      body = {
        session_token: 'A'.repeat(43),
        expires_at_unix: String(Math.floor(Date.now() / 1000) + 3600),
        account: { ...staff, role },
      }
    else if (path === '/me') body = { ...staff, role }
    else if (path === '/statistics') body = stats
    else if (path === '/tickets') body = list([ticket])
    else if (path === '/tickets/' + ticket.id) body = ticket
    else if (path === '/achievements') body = list([achievement])
    else if (path === '/achievements/' + achievement.id) body = achievement
    else if (path === '/users')
      body = url.searchParams.get('offset') === '10000' ? { items: [], total: '1' } : list([user])
    else if (path === '/users/' + user.id) body = user
    else if (path === '/projects') body = list([])
    else if (path === '/email-domains') body = list([domain])
    else if (path === '/staff') body = list([{ ...staff, role }])
    else if (path === '/staff/' + staff.id) body = { ...staff, role }
    else if (path === '/audit' || path.endsWith('/history')) body = list([])
    else if (path.endsWith('/download-url'))
      body = {
        download_url: 'https://example.org/evidence.pdf',
        expires_at_unix: String(Math.floor(Date.now() / 1000) + 60),
      }
    else if (method === 'DELETE') return route.fulfill({ status: 204 })
    else if (method === 'PUT' || method === 'POST') body = { ...ticket, revision: 4 }
    else return route.fulfill({ status: 404, json: { error: 'Not found' } })
    return route.fulfill({ status: 200, json: body })
  })
}
export async function signIn(page: Page) {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'matchlab.admin.session',
      JSON.stringify({ token: 'A'.repeat(43), expires: Date.now() + 3600000 }),
    ),
  )
}
