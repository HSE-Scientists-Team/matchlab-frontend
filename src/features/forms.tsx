import { useState, useRef, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../api/client'
import { Alert, Field } from '../ui/primitives'
import { passwordValid } from '../lib/format'
import type { Domain } from '../api/types'
export const text = (f: FormData, key: string) => String(f.get(key) || '').trim()
export function MutationForm({
  path,
  method = 'POST',
  body,
  children,
  button,
  success = 'Изменения сохранены',
  danger = false,
  onSuccess,
}: {
  path: string
  method?: string
  body: (f: FormData) => unknown
  children: ReactNode
  button: string
  success?: string
  danger?: boolean
  onSuccess?: () => void
}) {
  const client = useQueryClient(),
    [reloading, setReloading] = useState(false),
    inFlight = useRef(false)
  const m = useMutation({
    mutationFn: (f: FormData) => api(path, { method, body: body(f) }),
    onSuccess: async () => {
      await client.invalidateQueries()
      onSuccess?.()
    },
    onSettled: () => {
      inFlight.current = false
    },
  })
  const [refreshError, setRefreshError] = useState<unknown>(null)
  const blocked = m.error instanceof ApiError && (m.error.status === 409 || m.error.uncertain)
  async function reload() {
    setReloading(true)
    try {
      await client.refetchQueries({ type: 'active' }, { throwOnError: true })
      setRefreshError(null)
      m.reset()
    } catch (error) {
      setRefreshError(error)
    } finally {
      setReloading(false)
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!inFlight.current && !blocked) {
      inFlight.current = true
      m.mutate(new FormData(e.currentTarget))
    }
  }
  return (
    <form className="stack form" onSubmit={submit}>
      <fieldset disabled={m.isPending || reloading}>{children}</fieldset>
      {m.isError && (
        <Alert error={m.error} retry={blocked ? () => void reload() : undefined} />
      )}{' '}
      {refreshError ? <Alert error={refreshError} /> : null}
      {m.isSuccess && (
        <div className="success" role="status">
          {success}
        </div>
      )}
      <button
        className={'btn ' + (danger ? 'danger' : 'primary')}
        disabled={m.isPending || reloading || blocked}
      >
        {m.isPending ? 'Сохраняем…' : reloading ? 'Обновляем…' : button}
      </button>
    </form>
  )
}
export function Reason({ label = 'Причина решения' }: { label?: string }) {
  return (
    <Field label={label} hint="Комментарий сохранится в истории.">
      <textarea
        name="reason"
        required
        maxLength={2000}
        rows={3}
        placeholder="Опишите причину решения"
      />
    </Field>
  )
}
export function DomainForm({ domain, onSuccess }: { domain?: Domain; onSuccess?: () => void }) {
  return (
    <MutationForm
      path={'/email-domains' + (domain ? '/' + domain.id : '')}
      method={domain ? 'PUT' : 'POST'}
      button={domain ? 'Сохранить изменения' : 'Добавить домен'}
      onSuccess={onSuccess}
      body={(f) => ({
        domain: text(f, 'domain'),
        organization_name: text(f, 'organization'),
        is_active: f.get('active') === 'on',
        expected_revision: domain?.revision || 0,
        reason: text(f, 'reason'),
      })}
    >
      <Field
        label="Домен"
        hint="Например, hse.ru или *.example.org. Международные домены — в Punycode."
      >
        <input
          name="domain"
          defaultValue={domain?.domain}
          required
          maxLength={253}
          placeholder="example.org"
          autoCapitalize="none"
        />
      </Field>
      <Field label="Организация">
        <input
          name="organization"
          defaultValue={domain?.organization_name}
          required
          maxLength={200}
          placeholder="Название организации"
        />
      </Field>
      <label className="checkbox">
        <input name="active" type="checkbox" defaultChecked={domain ? domain.is_active : true} />
        Разрешить регистрацию
      </label>
      <Reason />
    </MutationForm>
  )
}
export function StaffCreateForm({ onSuccess }: { onSuccess: () => void }) {
  return (
    <MutationForm
      path="/staff"
      button="Создать сотрудника"
      onSuccess={onSuccess}
      body={(f) => {
        const password = String(f.get('password'))
        if (!passwordValid(password)) throw new Error('Пароль должен содержать от 12 до 72 байт.')
        return {
          email: text(f, 'email'),
          display_name: text(f, 'name'),
          role: text(f, 'role'),
          password,
        }
      }}
    >
      <Field label="Имя сотрудника">
        <input name="name" required maxLength={120} autoComplete="name" />
      </Field>
      <Field label="Служебная почта">
        <input name="email" required type="email" autoComplete="off" />
      </Field>
      <Field label="Роль">
        <select name="role">
          <option value="moderator">Модератор</option>
          <option value="administrator">Администратор</option>
        </select>
      </Field>
      <Field
        label="Начальный пароль"
        hint="12–72 байта. Передайте сотруднику по защищённому каналу."
      >
        <input name="password" type="password" required autoComplete="new-password" />
      </Field>
    </MutationForm>
  )
}
