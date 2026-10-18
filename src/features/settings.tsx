import { useAuth } from '../auth/Auth'
import { sessionStore } from '../api/client'
import { Heading, Panel, Info, Field } from '../ui/primitives'
import { date, label, passwordValid } from '../lib/format'
import { MutationForm } from './forms'
export function SettingsPage() {
  const { staff, session } = useAuth()
  return (
    <>
      <Heading
        title="Настройки аккаунта"
        subtitle="Ваш служебный профиль и безопасность доступа."
      />
      <div className="detail-grid">
        <Panel title="Ваш аккаунт">
          <dl className="info-grid">
            <Info title="Имя">{staff?.display_name}</Info>
            <Info title="Почта">{staff?.email}</Info>
            <Info title="Роль">{label(staff?.role || '')}</Info>
            <Info title="Сеанс действует до">{date((session?.expires || 0) / 1000, true)}</Info>
          </dl>
        </Panel>
        <Panel title="Изменить пароль">
          <MutationForm
            path="/me/password"
            method="PUT"
            button="Изменить пароль и выйти"
            onSuccess={() => sessionStore.set(null)}
            body={(f) => {
              const password = String(f.get('new_password'))
              if (!passwordValid(password))
                throw new Error('Новый пароль должен содержать 12–72 байта.')
              if (password !== f.get('repeat')) throw new Error('Новые пароли не совпадают.')
              return { current_password: String(f.get('current')), new_password: password }
            }}
          >
            <Field label="Текущий пароль">
              <input name="current" type="password" required autoComplete="current-password" />
            </Field>
            <Field
              label="Новый пароль"
              hint="От 12 до 72 байт. После изменения нужно войти заново."
            >
              <input name="new_password" type="password" required autoComplete="new-password" />
            </Field>
            <Field label="Повторите новый пароль">
              <input name="repeat" type="password" required autoComplete="new-password" />
            </Field>
          </MutationForm>
        </Panel>
      </div>
    </>
  )
}
