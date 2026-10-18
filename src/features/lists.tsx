import { useState, useEffect, type ReactNode, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { api, queryString } from '../api/client'
import type { Ticket, Achievement, User, Project, Domain, Staff, Event, List } from '../api/types'
import { useAuth } from '../auth/Auth'
import {
  Badge,
  Heading,
  Panel,
  Spinner,
  Empty,
  Alert,
  Pager,
  Modal,
  Refresh,
  Field,
  Info,
} from '../ui/primitives'
import { date, dayUnix, label, shortId, uuidPattern } from '../lib/format'
import { DomainForm, StaffCreateForm } from './forms'
import { DomainInspector } from './details'
type Filter = {
  name: string
  label: string
  options?: string[]
  date?: boolean
  uuid?: boolean
  values?: { value: string; title: string }[]
}
type Column<T> = { title: string; render: (item: T) => ReactNode }
const dateFilters: Filter[] = [
  { name: 'created_from_unix', label: 'Создано с (UTC)', date: true },
  { name: 'created_to_unix', label: 'Создано по (UTC)', date: true },
]
function RecordLink({ to, children }: { to: string; children: ReactNode }) {
  const l = useLocation()
  return (
    <Link className="record-link" to={to} state={{ back: l.pathname + l.search }}>
      {children}
      <ArrowUpRight size={15} />
    </Link>
  )
}
export function ListPage<T>({
  title,
  subtitle,
  endpoint,
  columns,
  filters = [],
  extra = [],
  initialStatus,
  tabs,
  action,
  rowKey,
  onRows,
}: {
  title: string
  subtitle: string
  endpoint: string
  columns: Column<T>[]
  filters?: Filter[]
  extra?: Filter[]
  initialStatus?: string
  tabs?: string[]
  action?: ReactNode
  onRows?: (rows: T[]) => void
  rowKey?: (item: T, index: number) => string
}) {
  const [params, setParams] = useSearchParams()
  const rawOffset = Number(params.get('offset') || 0),
    rawLimit = Number(params.get('limit') || 20)
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 && rawOffset <= 10000 ? rawOffset : 0
  const limit = [10, 20, 50, 100].includes(rawLimit) ? rawLimit : 20
  const activeStatus = params.get('status') ?? initialStatus ?? ''
  const query: Record<string, string | number | undefined> = { limit, offset }
  const allFilters = [{ name: 'text', label: 'Поиск' }, ...filters, ...extra]
  for (const f of allFilters) {
    const value = f.name === 'status' ? activeStatus : params.get(f.name) || ''
    if (value && value !== 'all')
      query[f.name] = f.date ? dayUnix(value, f.name === 'created_to_unix') : value
  }
  if (tabs && activeStatus && activeStatus !== 'all') query.status = activeStatus
  const queryURL = endpoint + queryString(query)
  const data = useQuery({
    queryKey: ['list', queryURL],
    queryFn: ({ signal }) => api<List<T>>(queryURL, { signal }),
  })
  useEffect(() => {
    if (data.data) onRows?.(data.data.items)
  }, [data.data, onRows])
  function patch(values: Record<string, string>) {
    const p = new URLSearchParams(params)
    Object.entries(values).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
    p.delete('offset')
    setParams(p)
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const values: Record<string, string> = {}
    allFilters.forEach((f) => {
      values[f.name] = String(form.get(f.name) || '')
    })
    patch(values)
  }
  function control(f: Filter) {
    const value = f.name === 'status' ? activeStatus : params.get(f.name) || ''
    return (
      <Field key={f.name} label={f.label}>
        {f.options || f.values ? (
          <select name={f.name} defaultValue={value}>
            <option value="all">Все</option>
            {(f.values || f.options!.map((v) => ({ value: v, title: label(v) }))).map((v) => (
              <option key={v.value} value={v.value}>
                {v.title}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={f.date ? 'date' : 'text'}
            name={f.name}
            defaultValue={value}
            pattern={f.uuid ? uuidPattern : undefined}
            placeholder={f.uuid ? 'UUID' : undefined}
            maxLength={f.uuid ? 36 : 200}
          />
        )}
      </Field>
    )
  }
  return (
    <>
      <Heading title={title} subtitle={subtitle}>
        {action}
        <Refresh onClick={() => void data.refetch()} busy={data.isFetching} />
      </Heading>
      <Panel className="list-panel">
        {tabs && (
          <div className="tabs" role="group" aria-label="Разделы очереди">
            {tabs.map((tab) => (
              <button
                key={tab}
                className={activeStatus === tab ? 'active' : ''}
                onClick={() => patch({ status: tab })}
              >
                {tab === 'all' ? 'Все записи' : label(tab)}
              </button>
            ))}
          </div>
        )}
        <form className="filter-form" key={params.toString()} onSubmit={submit}>
          <div className="filters">
            <label className="search-input">
              <Search size={18} />
              <span className="sr-only">Поиск</span>
              <input
                name="text"
                defaultValue={params.get('text') || ''}
                placeholder="Поиск по записям"
                maxLength={200}
              />
            </label>
            {filters.map(control)}
            <button className="btn primary">Найти</button>
            <button type="button" className="btn quiet" onClick={() => setParams({})}>
              Сбросить
            </button>
          </div>
          {extra.length > 0 && (
            <details className="advanced-filters">
              <summary>
                <SlidersHorizontal size={15} />
                Дополнительные фильтры
              </summary>
              <div className="filters">{extra.map(control)}</div>
            </details>
          )}
        </form>
        {data.isPending ? (
          <Spinner />
        ) : data.isError ? (
          <Alert error={data.error} retry={() => void data.refetch()} />
        ) : (
          <>
            {data.data.items.length === 0 ? (
              <Empty />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c.title}>{c.title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.items.map((item, i) => (
                      <tr key={rowKey ? rowKey(item, i) : (item as { id?: string }).id || i}>
                        {columns.map((c) => (
                          <td key={c.title}>{c.render(item)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="list-footer">
              <label className="page-size">
                На странице
                <select value={limit} onChange={(e) => patch({ limit: e.target.value })}>
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <Pager
                total={data.data.total}
                offset={offset}
                limit={limit}
                busy={data.isFetching}
                onPage={(n) => {
                  const p = new URLSearchParams(params)
                  p.set('offset', String(n))
                  setParams(p)
                }}
              />
            </div>
          </>
        )}
      </Panel>
    </>
  )
}
export function Tickets() {
  return (
    <ListPage<Ticket>
      title="Жалобы"
      subtitle="Рассматривайте обращения и помогайте сообществу."
      endpoint="/tickets"
      initialStatus="open"
      tabs={['open', 'closed', 'all']}
      filters={[
        { name: 'status', label: 'Статус', options: ['open', 'resolved', 'declined', 'closed'] },
      ]}
      extra={[
        { name: 'user_id', label: 'Автор', uuid: true },
        { name: 'assigned_admin_id', label: 'Исполнитель', uuid: true },
        {
          name: 'unassigned_only',
          label: 'Назначение',
          values: [{ value: 'true', title: 'Без исполнителя' }],
        },
        { name: 'target_user_id', label: 'На пользователя', uuid: true },
        { name: 'target_project_id', label: 'На проект', uuid: true },
        ...dateFilters,
      ]}
      columns={[
        {
          title: 'Обращение',
          render: (v) => (
            <>
              <RecordLink to={'/tickets/' + v.id}>{v.subject}</RecordLink>
              <small className="cell-sub">
                № {shortId(v.id)} · {v.target_user_id ? 'На пользователя' : 'На проект'}
              </small>
            </>
          ),
        },
        { title: 'Статус', render: (v) => <Badge value={v.status} /> },
        {
          title: 'Автор',
          render: (v) => (
            <Link className="mono" to={'/users/' + v.author_user_id}>
              {shortId(v.author_user_id)}
            </Link>
          ),
        },
        {
          title: 'Исполнитель',
          render: (v) => (
            <span className={v.assigned_admin_id ? 'mono' : 'muted'}>
              {v.assigned_admin_id ? shortId(v.assigned_admin_id) : 'Не назначен'}
            </span>
          ),
        },
        { title: 'Создано', render: (v) => date(v.created_at_unix, true) },
      ]}
    />
  )
}
export function Achievements() {
  return (
    <ListPage<Achievement>
      title="Достижения"
      subtitle="Подтверждайте опыт, образование и работы пользователей."
      endpoint="/achievements"
      initialStatus="pending_review"
      tabs={['pending_review', 'verified', 'needs_evidence', 'all']}
      filters={[
        {
          name: 'kind',
          label: 'Тип',
          options: ['education', 'certificate', 'scientific', 'project'],
        },
      ]}
      extra={[
        {
          name: 'status',
          label: 'Статус',
          options: ['unverified', 'pending_review', 'verified', 'needs_evidence'],
        },
        { name: 'user_id', label: 'Пользователь', uuid: true },
        ...dateFilters,
      ]}
      columns={[
        {
          title: 'Достижение',
          render: (v) => (
            <>
              <RecordLink to={'/achievements/' + v.id}>{v.details.title}</RecordLink>
              <small className="cell-sub">
                {v.details.institution || 'Организация не указана'}
              </small>
            </>
          ),
        },
        { title: 'Тип', render: (v) => label(v.details.kind) },
        { title: 'Статус', render: (v) => <Badge value={v.status} /> },
        {
          title: 'Пользователь',
          render: (v) => (
            <Link className="mono" to={'/users/' + v.user_id}>
              {shortId(v.user_id)}
            </Link>
          ),
        },
        { title: 'Добавлено', render: (v) => date(v.created_at_unix) },
      ]}
    />
  )
}
export function Users() {
  return (
    <ListPage<User>
      title="Пользователи"
      subtitle="Аккаунты участников и управление доступом к платформе."
      endpoint="/users"
      filters={[{ name: 'status', label: 'Статус', options: ['active', 'blocked', 'deleted'] }]}
      extra={[{ name: 'user_id', label: 'ID пользователя', uuid: true }, ...dateFilters]}
      columns={[
        {
          title: 'Пользователь',
          render: (v) => (
            <>
              <RecordLink to={'/users/' + v.id}>{v.display_name || 'Без имени'}</RecordLink>
              <small className="cell-sub">{v.email}</small>
            </>
          ),
        },
        { title: 'Статус', render: (v) => <Badge value={v.status} /> },
        {
          title: 'Почта',
          render: (v) => (
            <Badge value={v.email_verified ? 'verified' : 'unverified'}>
              {v.email_verified ? 'Подтверждена' : 'Не подтверждена'}
            </Badge>
          ),
        },
        { title: 'Регистрация', render: (v) => date(v.created_at_unix) },
        { title: 'Последний вход', render: (v) => date(v.last_login_at_unix, true) },
      ]}
    />
  )
}
export function Projects() {
  return (
    <ListPage<Project>
      title="Проекты"
      subtitle="Следите за проектами и управляйте их видимостью."
      endpoint="/projects"
      filters={[
        {
          name: 'status',
          label: 'Статус',
          options: ['unpublished', 'recruiting', 'active', 'completed', 'cancelled'],
        },
        {
          name: 'hidden_only',
          label: 'Видимость',
          values: [{ value: 'true', title: 'Только скрытые' }],
        },
      ]}
      columns={[
        {
          title: 'Проект',
          render: (v) => (
            <>
              <RecordLink to={'/projects/' + v.id}>{v.details.title}</RecordLink>
              <small className="cell-sub">{v.details.field || label(v.details.type)}</small>
            </>
          ),
        },
        { title: 'Статус', render: (v) => <Badge value={v.status} /> },
        {
          title: 'Видимость',
          render: (v) => (
            <Badge value={v.moderation_hidden ? 'blocked' : 'active'}>
              {v.moderation_hidden ? 'Скрыт' : 'Виден'}
            </Badge>
          ),
        },
        {
          title: 'Команда',
          render: (v) => v.members.filter((m) => m.status === 'active').length + ' участников',
        },
        { title: 'Создан', render: (v) => date(v.created_at_unix) },
      ]}
    />
  )
}
export function Domains() {
  const { staff } = useAuth()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rows, setRows] = useState<Domain[]>([])
  const selected = rows.find((row) => row.id === selectedId) || null
  return (
    <>
      <ListPage<Domain>
        title="Почтовые домены"
        subtitle="Управляйте организациями, пользователи которых могут зарегистрироваться."
        endpoint="/email-domains"
        onRows={setRows}
        filters={[{ name: 'status', label: 'Статус', options: ['active', 'inactive'] }]}
        action={
          staff?.role === 'administrator' && (
            <button className="btn primary" onClick={() => setOpen(true)}>
              <Plus size={17} />
              Добавить домен
            </button>
          )
        }
        columns={[
          {
            title: 'Домен',
            render: (v) => (
              <button className="text-button" onClick={() => setSelectedId(v.id)}>
                {v.domain}
              </button>
            ),
          },
          { title: 'Организация', render: (v) => v.organization_name },
          {
            title: 'Регистрация',
            render: (v) => (
              <Badge value={v.is_active ? 'active' : 'inactive'}>
                {v.is_active ? 'Разрешена' : 'Закрыта'}
              </Badge>
            ),
          },
          { title: 'Обновлено', render: (v) => date(v.updated_at_unix, true) },
        ]}
      />
      <Modal
        title="Новый почтовый домен"
        description="Правило действует на новую регистрацию и подтверждение почты."
        open={open}
        onOpenChange={setOpen}
      >
        <DomainForm onSuccess={() => setOpen(false)} />
      </Modal>
      <Modal
        title={selected?.domain || 'Домен'}
        description="Правило регистрации и история изменений"
        open={!!selected}
        onOpenChange={(v) => !v && setSelectedId(null)}
      >
        {selected && <DomainInspector domain={selected} onSave={() => setSelectedId(null)} />}
      </Modal>
    </>
  )
}
export function StaffList() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <ListPage<Staff>
        title="Сотрудники"
        subtitle="Роли, служебные аккаунты и доступ к панели."
        endpoint="/staff"
        filters={[{ name: 'status', label: 'Статус', options: ['active', 'inactive'] }]}
        action={
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={17} />
            Добавить сотрудника
          </button>
        }
        columns={[
          {
            title: 'Сотрудник',
            render: (v) => (
              <>
                <RecordLink to={'/staff/' + v.id}>{v.display_name}</RecordLink>
                <small className="cell-sub">{v.email}</small>
              </>
            ),
          },
          { title: 'Роль', render: (v) => label(v.role) },
          { title: 'Статус', render: (v) => <Badge value={v.active ? 'active' : 'inactive'} /> },
          { title: 'Последний вход', render: (v) => date(v.last_login_at_unix, true) },
        ]}
      />
      <Modal
        title="Новый сотрудник"
        description="Сотрудник получит отдельный служебный аккаунт."
        open={open}
        onOpenChange={setOpen}
      >
        <StaffCreateForm onSuccess={() => setOpen(false)} />
      </Modal>
    </>
  )
}
export function Audit() {
  const [selected, setSelected] = useState<Event | null>(null)
  return (
    <>
      <ListPage<Event>
        title="Журнал действий"
        subtitle="История решений и служебной активности команды."
        endpoint="/audit"
        filters={[
          {
            name: 'result',
            label: 'Результат',
            options: ['succeeded', 'failed', 'unknown', 'started'],
          },
        ]}
        extra={[
          { name: 'actor_admin_id', label: 'Сотрудник', uuid: true },
          { name: 'action', label: 'Код действия' },
          ...dateFilters,
        ]}
        columns={[
          {
            title: 'Действие',
            render: (v) => (
              <button className="text-button" onClick={() => setSelected(v)}>
                {label(v.action)}
              </button>
            ),
          },
          {
            title: 'Сотрудник',
            render: (v) => <span className="mono">{shortId(v.actor_admin_id)}</span>,
          },
          {
            title: 'Объект',
            render: (v) => <span className="mono">{shortId(v.resource_id)}</span>,
          },
          { title: 'Результат', render: (v) => <Badge value={v.result} /> },
          { title: 'Время', render: (v) => date(v.created_at_unix, true) },
        ]}
      />
      <Modal
        title="Запись аудита"
        description="Результат unknown требует проверки истории у владельца данных перед повтором."
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
      >
        {selected && (
          <dl className="info-grid">
            <Info title="Действие">{label(selected.action)}</Info>
            <Info title="Результат">
              <Badge value={selected.result} />
            </Info>
            <Info title="Сотрудник">
              <span className="mono">{selected.actor_admin_id}</span>
            </Info>
            <Info title="Объект">
              <span className="mono">{selected.resource_id}</span>
            </Info>
            <Info title="Комментарий">{selected.comment}</Info>
            <Info title="Время">{date(selected.created_at_unix, true)}</Info>
          </dl>
        )}
      </Modal>
    </>
  )
}
