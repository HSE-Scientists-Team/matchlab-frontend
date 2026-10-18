import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  FolderKanban,
  Flag,
  BadgeCheck,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
} from 'lucide-react'
import { api, queryString } from '../api/client'
import type { Stats, Statistics, Ticket, Achievement, List } from '../api/types'
import { useAuth } from '../auth/Auth'
import { Alert, Badge, Empty, Heading, Panel, Refresh, Spinner } from '../ui/primitives'
import { date, label, number } from '../lib/format'
import { statisticsRange } from '../lib/range'
const categories: Record<string, string> = {
  users_by_status: 'Пользователи по статусу',
  achievements_by_status: 'Статусы достижений',
  achievements_by_kind: 'Виды достижений',
  domains_by_status: 'Статусы доменов',
  users_by_email_domain: 'Пользователи по домену',
  registrations_by_domain: 'Регистрации по домену за период',
  tickets_by_status: 'Статусы обращений',
  open_by_assignment: 'Назначение открытых жалоб',
  tickets_by_target: 'Цели обращений',
  projects_by_status: 'Статусы проектов',
  projects_by_visibility: 'Видимость проектов',
  staff_by_status: 'Активность сотрудников',
  staff_by_role: 'Роли сотрудников',
}
const counterLabel: Record<string, string> = {
  assigned: 'Назначены',
  unassigned: 'Без исполнителя',
  user: 'Пользователь',
  project: 'Проект',
  hidden: 'Скрыт',
  visible: 'Виден',
}
const dailyNames: Record<string, string> = {
  registrations: 'Регистрации',
  achievement_submissions: 'Подачи достижений',
  achievement_approvals: 'Подтверждения достижений',
  achievement_rejections: 'Запросы доказательств',
  tickets_created: 'Новые обращения',
  resolutions: 'Закрытия обращений',
  projects_created: 'Создание проектов',
  moderation_decisions: 'Модерация проектов',
  logins: 'Входы сотрудников',
}
const sum = (s: Statistics, category: string, value?: string) =>
  s.counters
    .filter((c) => c.category === category && (value === undefined || c.value === value))
    .reduce((n, c) => n + Number(c.count), 0)
function Queue({ kind }: { kind: 'tickets' | 'achievements' }) {
  const path =
    kind === 'tickets'
      ? '/tickets?status=open&limit=4'
      : '/achievements?status=pending_review&limit=4'
  const q = useQuery({
    queryKey: ['queue-preview', kind],
    queryFn: ({ signal }) => api<List<Ticket | Achievement>>(path, { signal }),
  })
  return (
    <Panel
      title={kind === 'tickets' ? 'Последние в очереди жалоб' : 'Достижения на проверке'}
      action={
        <Link className="text-button" to={'/' + kind}>
          Все записи
          <ArrowUpRight size={14} />
        </Link>
      }
    >
      {q.isPending ? (
        <Spinner />
      ) : q.isError ? (
        <Alert error={q.error} retry={() => void q.refetch()} />
      ) : q.data.items.length ? (
        <div className="queue-preview">
          {q.data.items.map((item) => (
            <Link key={item.id} to={'/' + kind + '/' + item.id} className="queue-item">
              <span className={'queue-icon ' + (kind === 'tickets' ? 'soft-orange' : '')}>
                {kind === 'tickets' ? <Flag size={18} /> : <BadgeCheck size={19} />}
              </span>
              <div>
                <strong>{'subject' in item ? item.subject : item.details.title}</strong>
                <small>{date(item.created_at_unix, true)}</small>
              </div>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="Всё разобрано" text="Сейчас в этой очереди нет записей." />
      )}
    </Panel>
  )
}
function Activity({ stats, start, end }: { stats: Stats; start: number; end: number }) {
  const series = [
    { key: 'registrations', label: 'Регистрации', color: '#5361ff', source: stats.users },
    { key: 'tickets_created', label: 'Обращения', color: '#b87a24', source: stats.support },
    { key: 'projects_created', label: 'Проекты', color: '#268f7c', source: stats.projects },
  ]
  const days = useMemo(() => {
    const result: string[] = []
    for (let d = start; d < end; d += 86400)
      result.push(new Date(d * 1000).toISOString().slice(0, 10))
    return result
  }, [start, end])
  const values = series.map((s) =>
    days.map((d) =>
      Number(s.source.daily.find((v) => v.category === s.key && v.date === d)?.count || 0),
    ),
  )
  const maximum = Math.max(1, ...values.flat()),
    total = values.flat().reduce((a, b) => a + b, 0)
  const y = (n: number) => 170 - (Number(n) / maximum) * 130,
    x = (i: number) => 35 + (i * 610) / Math.max(1, days.length - 1)
  return (
    <Panel
      title="Активность платформы"
      action={<span className="muted small">За выбранный период · UTC</span>}
    >
      <div className="chart-legend">
        {series.map((s, i) => (
          <span key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
            <strong>{number(values[i].reduce((a, b) => a + b, 0))}</strong>
          </span>
        ))}
      </div>
      {total === 0 ? (
        <div className="chart-empty">
          <span className="chart-baseline" />
          <p>За выбранный период событий не было</p>
        </div>
      ) : (
        <svg
          className="activity-chart"
          viewBox="0 0 680 210"
          role="img"
          aria-label="Дневная активность: регистрации, обращения, создание проектов"
        >
          <title>Активность по дням UTC</title>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1="35" x2="650" y1={y(t * maximum)} y2={y(t * maximum)} stroke="#edf0f7" />
              <text x="4" y={y(t * maximum) + 4}>
                {new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(t * maximum)}
              </text>
            </g>
          ))}
          {series.map((s, i) => (
            <polyline
              key={s.key}
              points={values[i].map((v, j) => x(j) + ',' + y(v)).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
          ))}
          {[0, Math.floor((days.length - 1) / 2), days.length - 1].map((i, k) => (
            <text
              key={k}
              x={x(i)}
              y="200"
              textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}
            >
              {days[i]?.slice(8) + '.' + days[i]?.slice(5, 7)}
            </text>
          ))}
        </svg>
      )}
      <details className="chart-data">
        <summary>Таблица активности</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Дата UTC</th>
                {series.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, i) => (
                <tr key={day}>
                  <td>{day}</td>
                  {values.map((v, k) => (
                    <td key={k}>{number(v[i])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Panel>
  )
}
function Breakdown({ title, stats }: { title: string; stats: Statistics }) {
  const groups = [...new Set(stats.counters.map((c) => c.category))]
  return (
    <Panel title={title}>
      {groups.map((g) => (
        <div className="distribution" key={g}>
          <h3>{categories[g] || g}</h3>
          {stats.counters
            .filter((c) => c.category === g)
            .map((c) => (
              <div className="distribution-row" key={c.value}>
                <span>{counterLabel[c.value] || label(c.value)}</span>
                <strong>{number(c.count)}</strong>
              </div>
            ))}
        </div>
      ))}
      {stats.daily.length > 0 && (
        <details className="distribution">
          <summary>События за период</summary>
          {[...new Set(stats.daily.map((d) => d.category))].map((category) => (
            <div className="distribution-row" key={category}>
              <span>{dailyNames[category] || category}</span>
              <strong>
                {number(
                  stats.daily
                    .filter((d) => d.category === category)
                    .reduce((n, d) => n + Number(d.count), 0),
                )}
              </strong>
            </div>
          ))}
        </details>
      )}
      {!groups.length && !stats.daily.length && (
        <p className="muted">За выбранный период данных нет.</p>
      )}
    </Panel>
  )
}
export function Overview() {
  const { staff } = useAuth(),
    [params, setParams] = useSearchParams()
  const days = [7, 30, 90].includes(Number(params.get('days'))) ? Number(params.get('days')) : 30
  const todayUTC = Math.floor(Date.now() / 86400000) * 86400,
    defaultEnd = todayUTC + 86400,
    defaultStart = defaultEnd - days * 86400
  const custom = params.get('days') === 'custom'
  const from = params.get('from') || new Date(defaultStart * 1000).toISOString().slice(0, 10)
  const to = params.get('to') || new Date(todayUTC * 1000).toISOString().slice(0, 10)
  const range = custom ? statisticsRange(from, to) : { start: defaultStart, end: defaultEnd }
  const start = range?.start || defaultStart,
    end = range?.end || defaultEnd
  const [rangeError, setRangeError] = useState<Error | null>(null)
  const path = '/statistics' + queryString({ from_unix: start, to_unix: end })
  const q = useQuery({
    queryKey: ['statistics', path],
    enabled: !!range,
    queryFn: ({ signal }) => api<Stats>(path, { signal }),
  })
  const greeting = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date())
  return (
    <>
      <div className="eyebrow overview-date">{greeting}</div>
      <Heading
        title={'Здравствуйте, ' + (staff?.display_name.split(' ')[0] || 'коллега')}
        subtitle="Всё, что важно для сообщества, — в одном месте."
      >
        <div className="period-select">
          <CalendarDays size={16} />
          <label>
            <span className="sr-only">Период статистики</span>
            <select
              value={custom ? 'custom' : days}
              onChange={(e) => {
                setRangeError(null)
                setParams({ days: e.target.value })
              }}
            >
              <option value="7">Последние 7 дней</option>
              <option value="30">Последние 30 дней</option>
              <option value="90">Последние 90 дней</option>
              <option value="custom">Свой период</option>
            </select>
          </label>
        </div>
        <Refresh onClick={() => void q.refetch()} busy={q.isFetching} />
      </Heading>
      {custom && (
        <Panel className="range-panel">
          <form
            className="filters"
            key={from + to}
            onSubmit={(event) => {
              event.preventDefault()
              const f = new FormData(event.currentTarget)
              const from = String(f.get('from')),
                to = String(f.get('to'))
              if (!statisticsRange(from, to)) {
                setRangeError(new Error('Выберите корректный период не более 366 дней.'))
                return
              }
              setRangeError(null)
              setParams({ days: 'custom', from, to })
            }}
          >
            <label className="field">
              Начало периода (UTC)
              <input name="from" type="date" required defaultValue={from} />
            </label>
            <label className="field">
              Конец периода (UTC)
              <input name="to" type="date" required defaultValue={to} />
            </label>
            <button className="btn primary">Показать статистику</button>
          </form>
          {rangeError && <Alert error={rangeError} />}
        </Panel>
      )}
      {!range ? (
        <Alert
          error={new Error('В URL указан некорректный период. Выберите даты не более 366 дней.')}
        />
      ) : q.isPending ? (
        <Spinner />
      ) : q.isError ? (
        <Alert error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <div className="kpi-grid">
            {[
              {
                title: 'Пользователей',
                value: sum(q.data.users, 'users_by_status'),
                note: 'Всего аккаунтов',
                icon: Users,
                to: '/users',
                tone: '',
              },
              {
                title: 'Активных проектов',
                value: sum(q.data.projects, 'projects_by_status', 'active'),
                note: 'Команды работают над идеями',
                icon: FolderKanban,
                to: '/projects?status=active',
                tone: 'teal',
              },
              {
                title: 'Открытых жалоб',
                value: sum(q.data.support, 'tickets_by_status', 'open'),
                note: 'Ожидают решения команды',
                icon: Flag,
                to: '/tickets',
                tone: 'orange',
              },
              {
                title: 'Достижений на проверке',
                value: sum(q.data.users, 'achievements_by_status', 'pending_review'),
                note: 'Ожидают подтверждения',
                icon: BadgeCheck,
                to: '/achievements',
                tone: 'violet',
              },
            ].map((c) => (
              <Link to={c.to} className="kpi-card" key={c.title}>
                <div className="kpi-top">
                  <span className={'icon-tile ' + c.tone}>
                    <c.icon size={21} />
                  </span>
                  <ArrowUpRight size={17} />
                </div>
                <p>{c.title}</p>
                <strong>{number(c.value)}</strong>
                <small>{c.note}</small>
              </Link>
            ))}
          </div>
          <div className="kpi-context">Показатели выше отражают текущее состояние платформы.</div>
          <div className="overview-main">
            <Activity stats={q.data} start={start} end={end} />
            <Panel className="work-card">
              <div className="work-card-icon">
                <ShieldCheckIcon />
              </div>
              <span className="eyebrow">Фокус команды</span>
              <h2>
                Каждое решение
                <br />
                помогает сообществу
              </h2>
              <p>Проверьте обращения без исполнителя и достижения, которые ждут подтверждения.</p>
              <Link to="/tickets?unassigned_only=true" className="btn primary">
                Перейти к очереди
                <ArrowRight size={16} />
              </Link>
            </Panel>
          </div>
          <div className="two-columns">
            <Queue kind="tickets" />
            <Queue kind="achievements" />
          </div>
          <div className="section-heading">
            <div>
              <h2>Платформа в деталях</h2>
              <p>Текущие распределения и события выбранного периода</p>
            </div>
            <Badge value="active">Данные API</Badge>
          </div>
          <div className="two-columns">
            <Breakdown title="Пользователи и достижения" stats={q.data.users} />
            <div className="stack">
              <Breakdown title="Жалобы" stats={q.data.support} />
              <Breakdown title="Проекты" stats={q.data.projects} />
              <Breakdown title="Команда" stats={q.data.staff} />
            </div>
          </div>
        </>
      )}
    </>
  )
}
function ShieldCheckIcon() {
  return (
    <svg width="31" height="35" viewBox="0 0 31 35" fill="none" aria-hidden="true">
      <path
        d="M15.5 2 28 7v10c0 8-12.5 15-12.5 15S3 25 3 17V7L15.5 2Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m10 17 4 4 8-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
