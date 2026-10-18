import { useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Download as DownloadIcon, ExternalLink, FileText, ShieldCheck } from 'lucide-react'
import { api } from '../api/client'
import type {
  Achievement,
  Decision,
  Domain,
  Download,
  Event,
  List,
  Moderation,
  Project,
  Staff,
  Ticket,
  User,
} from '../api/types'
import { useAuth } from '../auth/Auth'
import {
  Alert,
  Badge,
  Empty,
  Field,
  Heading,
  Info,
  Pager,
  Panel,
  Refresh,
  Spinner,
} from '../ui/primitives'
import { date, label, safeURL, shortId, uuidPattern, passwordValid } from '../lib/format'
import { DomainForm, MutationForm, Reason, text } from './forms'
function Detail<T>({
  endpoint,
  back,
  title,
  children,
}: {
  endpoint: string
  back: string
  title: (v: T) => string
  children: (v: T) => ReactNode
}) {
  const { id } = useParams(),
    location = useLocation()
  const q = useQuery({
    queryKey: ['detail', endpoint, id],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) => api<T>(endpoint + '/' + id, { signal }),
  })
  const returnTo = (location.state as { back?: string } | null)?.back || back
  return (
    <>
      <Heading
        back={returnTo}
        title={q.data ? title(q.data) : 'Загрузка карточки'}
        subtitle={'ID · ' + id}
      >
        <Refresh busy={q.isFetching} onClick={() => void q.refetch()} />
      </Heading>
      {q.isPending ? (
        <Spinner />
      ) : q.isError ? (
        <Alert error={q.error} retry={() => void q.refetch()} />
      ) : (
        children(q.data)
      )}
    </>
  )
}
function EventCard({ v }: { v: Event }) {
  return (
    <>
      <div className="timeline-top">
        <strong>{label(v.action)}</strong>
        <time>{date(v.created_at_unix, true)}</time>
      </div>
      <p className="muted">
        Сотрудник <span className="mono">{v.actor_admin_id}</span> · версия {v.revision}
      </p>
      {v.previous_status && v.previous_status !== v.status && (
        <p>
          {label(v.previous_status)} → {label(v.status)}
        </p>
      )}
      {v.action === 'assign' || v.action === 'unassign' ? (
        <p>
          Исполнитель: {shortId(v.previous_assigned_admin_id)} → {shortId(v.assigned_admin_id)}
        </p>
      ) : null}
      {v.comment && <p className="pre-wrap">{v.comment}</p>}
    </>
  )
}
function History<T>({ path, render }: { path: string; render: (v: T) => ReactNode }) {
  const [offset, setOffset] = useState(0)
  const q = useQuery({
    queryKey: ['history', path, offset],
    queryFn: ({ signal }) => api<List<T>>(path + '?limit=10&offset=' + offset, { signal }),
  })
  return (
    <Panel title="История изменений">
      {q.isPending ? (
        <Spinner />
      ) : q.isError ? (
        <Alert error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {q.data.items.length ? (
            <ol className="timeline">
              {q.data.items.map((v, i) => (
                <li key={i}>{render(v)}</li>
              ))}
            </ol>
          ) : (
            <Empty title="История пока пуста" text="Решения и изменения появятся здесь." />
          )}
          <Pager
            total={q.data.total}
            offset={offset}
            limit={10}
            onPage={setOffset}
            busy={q.isFetching}
          />
        </>
      )}
    </Panel>
  )
}
function Evidence({ path, title }: { path: string; title: string }) {
  const m = useMutation({ mutationFn: () => api<Download>(path, { method: 'POST' }) })
  const url =
    m.data && Number(m.data.expires_at_unix) * 1000 > Date.now()
      ? safeURL(m.data.download_url)
      : null
  return (
    <div className="evidence">
      <FileText size={20} />
      <div>
        <strong>{title}</strong>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
            Открыть документ
            <ExternalLink size={13} />
          </a>
        )}
        {m.data && <small>Ссылка действует до {date(m.data.expires_at_unix, true)}</small>}
        {m.isError && <Alert error={m.error} />}
      </div>
      <button className="btn secondary" disabled={m.isPending} onClick={() => m.mutate()}>
        <DownloadIcon size={15} />
        {m.isPending ? 'Готовим…' : url ? 'Обновить ссылку' : 'Получить ссылку'}
      </button>
    </div>
  )
}
function UserLink({ id }: { id: string }) {
  return id ? (
    <Link className="mono break" to={'/users/' + id}>
      {id}
    </Link>
  ) : (
    <>—</>
  )
}
function TicketActions({ v }: { v: Ticket }) {
  const { staff } = useAuth()
  const [action, setAction] = useState(v.status === 'open' ? 'resolve' : 'reopen')
  const [assignee, setAssignee] = useState(v.assigned_admin_id || staff?.id || '')
  const staffList = useQuery({
    queryKey: ['assignees'],
    enabled: staff?.role === 'administrator',
    queryFn: ({ signal }) => api<List<Staff>>('/staff?status=active&limit=100', { signal }),
  })
  return (
    <Panel title="Решение по обращению">
      <MutationForm
        path={'/tickets/' + v.id + '/actions'}
        button="Применить решение"
        body={(f) => ({
          action,
          assigned_admin_id: action === 'assign' ? assignee : '',
          comment: text(f, 'reason'),
          expected_revision: v.revision,
        })}
      >
        <Field label="Действие">
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            {(v.status === 'open' ? ['resolve', 'decline', 'assign', 'unassign'] : ['reopen']).map(
              (a) => (
                <option key={a} value={a}>
                  {
                    {
                      resolve: 'Закрыть как рассмотренную',
                      decline: 'Отклонить жалобу',
                      assign: 'Назначить исполнителя',
                      unassign: 'Снять исполнителя',
                      reopen: 'Вернуть в очередь',
                    }[a]
                  }
                </option>
              ),
            )}
          </select>
        </Field>
        {action === 'assign' && (
          <>
            <Field label="ID сотрудника">
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                required
                pattern={uuidPattern}
                list="assignees"
              />
              <datalist id="assignees">
                {staffList.data?.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name} · {s.email}
                  </option>
                ))}
              </datalist>
            </Field>
            <button
              type="button"
              className="text-button"
              onClick={() => setAssignee(staff?.id || '')}
            >
              Назначить себе
            </button>
          </>
        )}
        <Reason />
        <p className="muted small">
          Закрытие жалобы не блокирует пользователя и не скрывает проект. Эти решения принимаются
          отдельно.
        </p>
      </MutationForm>
    </Panel>
  )
}
export function TicketDetail() {
  return (
    <Detail<Ticket> endpoint="/tickets" back="/tickets" title={(v) => v.subject}>
      {(v) => (
        <div className="detail-grid">
          <div className="stack">
            <Panel title="Обращение">
              <div className="detail-status">
                <Badge value={v.status} />
                <span className="muted">Создано {date(v.created_at_unix, true)}</span>
              </div>
              <p className="pre-wrap description">{v.description}</p>
              <dl className="info-grid">
                <Info title="Автор">
                  <UserLink id={v.author_user_id} />
                </Info>
                <Info title="Исполнитель">
                  <span className="mono">{v.assigned_admin_id || 'Не назначен'}</span>
                </Info>
                {v.target_user_id && (
                  <Info title="Жалоба на пользователя">
                    <UserLink id={v.target_user_id} />
                  </Info>
                )}
                {v.target_project_id && (
                  <Info title="Жалоба на проект">
                    <Link className="mono" to={'/projects/' + v.target_project_id}>
                      {v.target_project_id}
                    </Link>
                  </Info>
                )}
                {v.resolution_comment && <Info title="Решение">{v.resolution_comment}</Info>}
              </dl>
            </Panel>
            {!!v.file_ids.length && (
              <Panel title="Вложения">
                {v.file_ids.map((id, i) => (
                  <Evidence
                    key={id}
                    title={'Вложение ' + (i + 1)}
                    path={'/tickets/' + v.id + '/attachments/' + id + '/download-url'}
                  />
                ))}
              </Panel>
            )}
            <History<Event>
              path={'/tickets/' + v.id + '/history'}
              render={(e) => <EventCard v={e} />}
            />
          </div>
          <div className="stack">
            <TicketActions key={v.status} v={v} />
            <Panel title="Внутренняя заметка">
              <MutationForm
                path={'/tickets/' + v.id + '/notes'}
                button="Добавить заметку"
                success="Заметка добавлена"
                body={(f) => ({ comment: text(f, 'note'), expected_revision: v.revision })}
              >
                <Field label="Заметка" hint="Доступна только сотрудникам.">
                  <textarea
                    name="note"
                    required
                    maxLength={4000}
                    rows={4}
                    placeholder="Контекст для команды модерации"
                  />
                </Field>
              </MutationForm>
            </Panel>
          </div>
        </div>
      )}
    </Detail>
  )
}
export function AchievementDetail() {
  return (
    <Detail<Achievement>
      endpoint="/achievements"
      back="/achievements"
      title={(v) => v.details.title}
    >
      {(v) => (
        <div className="detail-grid">
          <div className="stack">
            <Panel title="Достижение">
              <div className="detail-status">
                <Badge value={v.status} />
                <span className="muted">{label(v.details.kind)}</span>
              </div>
              <p className="pre-wrap description">
                {v.details.description || 'Описание не добавлено.'}
              </p>
              <dl className="info-grid">
                <Info title="Пользователь">
                  <UserLink id={v.user_id} />
                </Info>
                <Info title="Организация">{v.details.institution}</Info>
                <Info title="Год">{v.details.graduation_year || '—'}</Info>
                <Info title="Добавлено">{date(v.created_at_unix)}</Info>
                {safeURL(v.details.url) && (
                  <Info title="Ссылка">
                    <a href={safeURL(v.details.url)!} target="_blank" rel="noreferrer">
                      Открыть источник
                      <ExternalLink size={13} />
                    </a>
                  </Info>
                )}
                {v.moderation_comment && (
                  <Info title="Комментарий проверки">{v.moderation_comment}</Info>
                )}
              </dl>
            </Panel>
            {v.details.evidence_file_id && (
              <Panel title="Подтверждающий документ">
                <Evidence
                  path={'/achievements/' + v.id + '/evidence/download-url'}
                  title="Доказательство достижения"
                />
              </Panel>
            )}
            <History<Decision>
              path={'/achievements/' + v.id + '/history'}
              render={(e) => (
                <>
                  <div className="timeline-top">
                    <strong>
                      {e.approved ? 'Достижение подтверждено' : 'Запрошены доказательства'}
                    </strong>
                    <time>{date(e.created_at_unix, true)}</time>
                  </div>
                  <p className="pre-wrap">{e.comment}</p>
                  <p className="muted">
                    Сотрудник{' '}
                    <span className="mono">{e.actor_admin_id || e.legacy_reviewer_user_id}</span> ·
                    проверенная версия {e.revision}
                  </p>
                  <details>
                    <summary>Проверенные данные</summary>
                    <div className="stack compact">
                      <strong>{e.reviewed_details.title}</strong>
                      <p>{e.reviewed_details.description}</p>
                      <small>{e.reviewed_details.institution}</small>
                      {e.evidence_file_id && (
                        <small className="mono">Файл: {e.evidence_file_id}</small>
                      )}
                    </div>
                  </details>
                </>
              )}
            />
          </div>
          <div className="stack">
            <Panel title="Проверка достижения">
              {v.status === 'pending_review' ? (
                <MutationForm
                  path={'/achievements/' + v.id + '/decision'}
                  button="Сохранить решение"
                  body={(f) => ({
                    approve: text(f, 'decision') === 'approve',
                    comment: text(f, 'reason'),
                    expected_revision: v.revision,
                  })}
                >
                  <Field label="Решение">
                    <select name="decision">
                      <option value="approve">Подтвердить достижение</option>
                      <option value="reject">Запросить доказательства</option>
                    </select>
                  </Field>
                  <Reason />
                  <p className="muted small">
                    После запроса доказательств пользователь сможет дополнить данные и подать их
                    повторно.
                  </p>
                </MutationForm>
              ) : (
                <div className="notice">
                  <ShieldCheck size={22} />
                  <p>
                    Достижение сейчас не ожидает проверки. Текущий статус —{' '}
                    {label(v.status).toLowerCase()}.
                  </p>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </Detail>
  )
}
export function UserDetail() {
  return (
    <Detail<User> endpoint="/users" back="/users" title={(v) => v.display_name || v.email}>
      {(v) => (
        <div className="detail-grid">
          <div className="stack">
            <Panel title="Учётная запись">
              <div className="detail-status">
                <Badge value={v.status} />
                <Badge value={v.email_verified ? 'verified' : 'unverified'}>
                  {v.email_verified ? 'Почта подтверждена' : 'Почта не подтверждена'}
                </Badge>
              </div>
              <dl className="info-grid">
                <Info title="Имя">{v.display_name}</Info>
                <Info title="Почта">{v.email}</Info>
                <Info title="Регистрация">{date(v.created_at_unix, true)}</Info>
                <Info title="Последний вход">{date(v.last_login_at_unix, true)}</Info>
                {v.status_comment && <Info title="Последняя причина">{v.status_comment}</Info>}
                {v.status_changed_at_unix !== '0' && (
                  <Info title="Статус изменён">{date(v.status_changed_at_unix, true)}</Info>
                )}
              </dl>
              <div className="related-links">
                <Link to={'/achievements?user_id=' + v.id + '&status=all'}>
                  Достижения пользователя
                  <ExternalLink size={14} />
                </Link>
                <Link to={'/tickets?target_user_id=' + v.id + '&status=all'}>
                  Жалобы на пользователя
                  <ExternalLink size={14} />
                </Link>
              </div>
            </Panel>
            <History<Event>
              path={'/users/' + v.id + '/history'}
              render={(e) => <EventCard v={e} />}
            />
          </div>
          <Panel title="Доступ к платформе">
            {v.status === 'deleted' ? (
              <p className="muted">
                Удалённый аккаунт нельзя восстановить через изменение статуса.
              </p>
            ) : (
              <MutationForm
                path={'/users/' + v.id + '/status'}
                method="PUT"
                button={
                  v.status === 'blocked'
                    ? 'Разблокировать пользователя'
                    : 'Заблокировать пользователя'
                }
                danger={v.status !== 'blocked'}
                body={(f) => ({
                  status: v.status === 'blocked' ? 'active' : 'blocked',
                  reason: text(f, 'reason'),
                  expected_revision: v.revision,
                })}
              >
                <p className="muted">
                  Блокировка запрещает защищённые действия, включая запросы по ранее выданному
                  сеансу.
                </p>
                <Reason />
              </MutationForm>
            )}
          </Panel>
        </div>
      )}
    </Detail>
  )
}
export function ProjectDetail() {
  return (
    <Detail<Project> endpoint="/projects" back="/projects" title={(v) => v.details.title}>
      {(v) => (
        <div className="detail-grid">
          <div className="stack">
            <Panel title="Проект">
              <div className="detail-status">
                <Badge value={v.status} />
                <Badge value={v.moderation_hidden ? 'blocked' : 'active'}>
                  {v.moderation_hidden ? 'Скрыт' : 'Виден'}
                </Badge>
              </div>
              <dl className="info-grid">
                <Info title="Владелец">
                  <UserLink id={v.owner_user_id} />
                </Info>
                <Info title="Тип">{label(v.details.type)}</Info>
                <Info title="Направление">{v.details.field}</Info>
                <Info title="Сроки">
                  {v.details.planned_start || '—'} → {v.details.planned_end || '—'}
                </Info>
              </dl>
              <h3>Проблема</h3>
              <p className="pre-wrap">{v.details.problem || '—'}</p>
              <h3>Цель</h3>
              <p className="pre-wrap">{v.details.goal || '—'}</p>
              <div className="tags">
                {v.details.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </Panel>
            <Panel title="Команда и роли">
              <div className="stack compact">
                {v.roles.map((r) => (
                  <div className="mini-card" key={r.id}>
                    <strong>{r.title}</strong>
                    <p>{r.description}</p>
                    <small>
                      {r.occupied} из {r.slots} мест занято · {r.skills.join(', ')}
                    </small>
                  </div>
                ))}
                {v.members.map((m) => (
                  <div key={m.user_id} className="member-row">
                    <UserLink id={m.user_id} />
                    <span>{m.role_title}</span>
                    <Badge value={m.status} />
                  </div>
                ))}
                {!v.members.length && !v.roles.length && (
                  <p className="muted">Команда пока не сформирована.</p>
                )}
              </div>
            </Panel>
            <History<Moderation>
              path={'/projects/' + v.id + '/history'}
              render={(e) => (
                <>
                  <div className="timeline-top">
                    <strong>{e.hidden ? 'Проект скрыт' : 'Видимость восстановлена'}</strong>
                    <time>{date(e.created_at_unix, true)}</time>
                  </div>
                  <p className="pre-wrap">{e.reason}</p>
                  <small className="mono">{e.actor_admin_id || e.actor_user_id}</small>
                </>
              )}
            />
          </div>
          <Panel title="Видимость проекта">
            <MutationForm
              path={'/projects/' + v.id + '/moderation'}
              method="PUT"
              button={v.moderation_hidden ? 'Восстановить видимость' : 'Скрыть проект'}
              danger={!v.moderation_hidden}
              body={(f) => ({
                hide: !v.moderation_hidden,
                reason: text(f, 'reason'),
                expected_revision: v.revision,
              })}
            >
              <p className="muted">
                Модерация меняет видимость проекта независимо от его жизненного цикла.
              </p>
              <Reason />
            </MutationForm>
          </Panel>
        </div>
      )}
    </Detail>
  )
}
export function DomainInspector({ domain: v, onSave }: { domain: Domain; onSave: () => void }) {
  const { staff } = useAuth()
  return (
    <div className="stack">
      <dl className="info-grid">
        <Info title="Организация">{v.organization_name}</Info>
        <Info title="Регистрация">
          <Badge value={v.is_active ? 'active' : 'inactive'}>
            {v.is_active ? 'Разрешена' : 'Закрыта'}
          </Badge>
        </Info>
      </dl>
      {staff?.role === 'administrator' && (
        <DomainForm key={v.revision} domain={v} onSuccess={onSave} />
      )}
      <History<Event>
        path={'/email-domains/' + v.id + '/history'}
        render={(e) => <EventCard v={e} />}
      />
    </div>
  )
}
export function StaffDetail() {
  const { staff } = useAuth()
  return (
    <Detail<Staff> endpoint="/staff" back="/staff" title={(v) => v.display_name}>
      {(v) => (
        <div className="detail-grid">
          <div className="stack">
            <Panel title="Служебный аккаунт">
              <dl className="info-grid">
                <Info title="Почта">{v.email}</Info>
                <Info title="Роль">{label(v.role)}</Info>
                <Info title="Статус">
                  <Badge value={v.active ? 'active' : 'inactive'} />
                </Info>
                <Info title="Последний вход">{date(v.last_login_at_unix, true)}</Info>
              </dl>
            </Panel>
            <Panel title="Роль и доступ">
              <MutationForm
                key={v.revision}
                path={'/staff/' + v.id}
                method="PUT"
                button="Сохранить аккаунт"
                body={(f) => ({
                  display_name: text(f, 'name'),
                  role: text(f, 'role'),
                  active: f.get('active') === 'on',
                  expected_revision: v.revision,
                  reason: text(f, 'reason'),
                })}
              >
                <Field label="Имя">
                  <input name="name" defaultValue={v.display_name} required maxLength={120} />
                </Field>
                <Field label="Роль">
                  <select name="role" defaultValue={v.role}>
                    <option value="moderator">Модератор</option>
                    <option value="administrator">Администратор</option>
                  </select>
                </Field>
                <label className="checkbox">
                  <input name="active" type="checkbox" defaultChecked={v.active} />
                  Аккаунт активен
                </label>
                <Reason />
                <p className="muted small">
                  Изменение отзывает сеансы сотрудника. Последнего активного администратора нельзя
                  отключить или понизить.
                </p>
              </MutationForm>
            </Panel>
          </div>
          <div className="stack">
            <Panel title="Сеансы">
              <MutationForm
                path={'/staff/' + v.id + '/sessions'}
                method="DELETE"
                button="Отозвать все сеансы"
                success="Сеансы отозваны"
                body={() => undefined}
              >
                <p className="muted">Сотруднику потребуется войти заново на всех устройствах.</p>
              </MutationForm>
            </Panel>
            {staff?.id !== v.id && (
              <Panel title="Сброс пароля">
                <MutationForm
                  path={'/staff/' + v.id + '/password'}
                  method="PUT"
                  button="Установить новый пароль"
                  body={(f) => {
                    const password = String(f.get('password'))
                    if (!passwordValid(password))
                      throw new Error('Пароль должен содержать 12–72 байта.')
                    return { password, reason: text(f, 'reason'), expected_revision: v.revision }
                  }}
                >
                  <Field
                    label="Новый пароль"
                    hint="12–72 байта. Все предыдущие сеансы будут отозваны."
                  >
                    <input name="password" type="password" required autoComplete="new-password" />
                  </Field>
                  <Reason />
                </MutationForm>
              </Panel>
            )}
          </div>
        </div>
      )}
    </Detail>
  )
}
