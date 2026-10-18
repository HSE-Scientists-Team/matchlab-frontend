export const labels: Record<string, string> = {
  open: 'В очереди',
  resolved: 'Рассмотрена',
  declined: 'Отклонена',
  closed: 'Закрытые',
  active: 'Активен',
  blocked: 'Заблокирован',
  deleted: 'Удалён',
  inactive: 'Неактивен',
  pending_review: 'На проверке',
  verified: 'Подтверждено',
  needs_evidence: 'Нужны доказательства',
  unverified: 'Без проверки',
  recruiting: 'Набор команды',
  unpublished: 'Не опубликован',
  completed: 'Завершён',
  cancelled: 'Отменён',
  administrator: 'Администратор',
  moderator: 'Модератор',
  education: 'Образование',
  certificate: 'Сертификат',
  scientific: 'Научная работа',
  project: 'Проект',
  practical: 'Практический',
  succeeded: 'Успешно',
  failed: 'Ошибка',
  unknown: 'Результат неизвестен',
  started: 'Выполняется',
  'ticket.update': 'Изменение жалобы',
  'ticket.note': 'Заметка',
  'ticket.evidence': 'Просмотр вложения',
  'achievement.review': 'Решение по достижению',
  'achievement.evidence': 'Просмотр доказательства',
  'domain.save': 'Изменение домена',
  'user.status': 'Статус пользователя',
  'project.moderate': 'Модерация проекта',
  'staff.create': 'Создание сотрудника',
  'staff.update': 'Изменение сотрудника',
  'staff.password': 'Смена пароля',
  'staff.reset_password': 'Сброс пароля',
  'staff.revoke_sessions': 'Отзыв сеансов',
  'staff.bootstrap': 'Первый администратор',
  'session.login': 'Вход',
  'session.logout': 'Выход',
  assign: 'Назначение',
  unassign: 'Снятие назначения',
  resolve: 'Рассмотрение',
  decline: 'Отклонение',
  reopen: 'Возврат в очередь',
  note: 'Внутренняя заметка',
}
export const label = (s: string) => labels[s] || s || '—'
export const shortId = (s: string) => (s ? s.slice(0, 8) : '—')
export const number = (v: string | number) => new Intl.NumberFormat('ru-RU').format(Number(v))
export function date(v: string | number, withTime = false) {
  if (!v || Number(v) === 0) return '—'
  const d = new Date(Number(v) * 1000)
  if (!Number.isFinite(d.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  }).format(d)
}
export function safeURL(v: string) {
  try {
    const u = new URL(v)
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null
  } catch {
    return null
  }
}
export function passwordValid(v: string) {
  const bytes = new TextEncoder().encode(v).length
  return bytes >= 12 && bytes <= 72
}
export function initials(v: string) {
  return (
    v
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase() || 'М'
  )
}
export function dayUnix(value: string, end = false) {
  return value ? Math.floor(Date.parse(value + 'T00:00:00Z') / 1000) + (end ? 86400 : 0) : undefined
}
export const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
