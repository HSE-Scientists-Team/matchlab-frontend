import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useRef,
  type ReactNode,
  type ReactElement,
} from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  RefreshCw,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { message } from '../api/client'
import { label, number } from '../lib/format'
export function Spinner() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={21} />
      <span>Загружаем данные…</span>
    </div>
  )
}
export function Alert({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div role="alert" className="alert">
      <AlertCircle size={19} />
      <div>
        {message(error)}
        {retry && (
          <button className="text-button" onClick={retry}>
            Обновить данные
          </button>
        )}
      </div>
    </div>
  )
}
export function Empty({
  title = 'Здесь пока пусто',
  text = 'Ничего не найдено. Попробуйте изменить фильтры.',
}: {
  title?: string
  text?: string
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={28} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
export function Badge({ value, children }: { value: string; children?: ReactNode }) {
  const tone = ['verified', 'resolved', 'active', 'succeeded'].includes(value)
    ? 'green'
    : ['blocked', 'declined', 'failed', 'needs_evidence', 'deleted'].includes(value)
      ? 'red'
      : ['open', 'pending_review', 'started'].includes(value)
        ? 'blue'
        : 'gray'
  return (
    <span className={'badge ' + tone}>
      <span className="status-dot" />
      {children || label(value)}
    </span>
  )
}
export function Heading({
  title,
  subtitle,
  children,
  back,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
  back?: string
}) {
  return (
    <div className="page-heading">
      <div>
        {back && (
          <Link className="back" to={back}>
            <ArrowLeft size={15} />
            Назад к списку
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  )
}
export function Panel({
  title,
  children,
  action,
  className = '',
}: {
  title?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <section className={'panel ' + className}>
      {title && (
        <div className="panel-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
export function Pager({
  total,
  offset,
  limit,
  onPage,
  busy = false,
}: {
  total: string
  offset: number
  limit: number
  onPage: (n: number) => void
  busy?: boolean
}) {
  const count = Number(total),
    maxOffset = Math.min(10000, Math.max(0, Math.floor((count - 1) / limit) * limit))
  return (
    <div className="pager">
      <span>
        {count === 0
          ? 'Нет записей'
          : offset >= count
            ? 'На этой странице нет записей'
            : number(offset + 1) + '–' + number(Math.min(offset + limit, count))}{' '}
        · всего {number(total)}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Предыдущая страница"
          disabled={offset === 0 || busy}
          onClick={() => onPage(Math.max(0, offset - limit))}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Следующая страница"
          disabled={offset >= maxOffset || busy}
          onClick={() => onPage(offset + limit)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      {count > 10000 && <small>Для более ранних записей уточните фильтры.</small>}
    </div>
  )
}
export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  title: string
  description: string
  open: boolean
  onOpenChange: (b: boolean) => void
  children: ReactNode
}) {
  const opener = useRef<HTMLElement | null>(null)
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog"
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (opener.current?.isConnected) opener.current.focus()
          }}
        >
          <div className="dialog-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Закрыть">
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted">{description}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
export function Refresh({ onClick, busy = false }: { onClick: () => void; busy?: boolean }) {
  return (
    <button className="btn secondary" onClick={onClick} disabled={busy}>
      <RefreshCw size={16} className={busy ? 'spin' : ''} />
      Обновить
    </button>
  )
}
export function Field({
  label: title,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  const id = useId()
  function controls(nodes: ReactNode): ReactNode {
    return Children.map(nodes, (child) => {
      if (!isValidElement(child)) return child
      const element = child as ReactElement<{
        id?: string
        children?: ReactNode
        'aria-describedby'?: string
      }>
      if (['input', 'select', 'textarea'].includes(String(element.type)))
        return cloneElement(element, { id, 'aria-describedby': hint ? id + '-hint' : undefined })
      return element.props.children
        ? cloneElement(element, {}, controls(element.props.children))
        : element
    })
  }
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {title}
      </label>
      {controls(children)}
      {hint && <small id={id + '-hint'}>{hint}</small>}
    </div>
  )
}
export function Info({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="info">
      <dt>{title}</dt>
      <dd>{children || '—'}</dd>
    </div>
  )
}
