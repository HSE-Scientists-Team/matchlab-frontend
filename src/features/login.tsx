import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Eye, EyeOff, ShieldCheck, BadgeCheck, Flag, LockKeyhole } from 'lucide-react'
import { Logo } from '../ui/layout'
import { Alert, Field } from '../ui/primitives'
import { api, ApiError, sessionStore } from '../api/client'
import type { Login } from '../api/types'
import { useAuth } from '../auth/Auth'
export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate(),
    location = useLocation(),
    client = useQueryClient()
  const [show, setShow] = useState(false),
    [until, setUntil] = useState(0),
    [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!until) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [until])
  const mutation = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<Login>('/auth/login', { method: 'POST', body }),
    onSuccess: (result) => {
      client.clear()
      sessionStore.set({
        token: result.session_token,
        expires: Number(result.expires_at_unix) * 1000,
      })
      const from = (location.state as { from?: string } | null)?.from
      navigate(
        from && from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/',
        { replace: true },
      )
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 429)
        setUntil(Date.now() + (error.retryAfter || 900) * 1000)
    },
  })
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    mutation.mutate({ email: String(f.get('email')).trim(), password: String(f.get('password')) })
  }
  if (session) return <Navigate to="/" replace />
  const remaining = Math.max(0, Math.ceil((until - now) / 1000))
  return (
    <main className="login-page">
      <section className="login-story">
        <Logo />
        <div className="login-story-content">
          <div className="eyebrow">
            <span />
            Пространство доверия
          </div>
          <h2>
            Сильные команды
            <br />
            начинаются
            <br />с доверия<span>.</span>
          </h2>
          <p>
            Помогайте людям находить друг друга,
            <br />а хорошим идеям — становиться проектами.
          </p>
          <div className="story-art" aria-hidden="true">
            <div className="art-card art-achievement">
              <span className="icon-tile">
                <BadgeCheck />
              </span>
              <div>
                <strong>Достижения имеют значение</strong>
                <small>Проверяйте опыт и подтверждайте навыки</small>
              </div>
              <span className="art-check">✓</span>
            </div>
            <div className="art-card art-community">
              <span className="icon-tile soft-orange">
                <Flag />
              </span>
              <div>
                <strong>Сообщество в надёжных руках</strong>
                <small>Внимание к каждому обращению</small>
              </div>
            </div>
            <div className="art-dot dot-one" />
            <div className="art-dot dot-two" />
            <div className="art-orbit" />
          </div>
        </div>
        <div className="login-story-footer">
          MatchLab<span>Люди. Идеи. Совместные проекты.</span>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-mobile-brand">
          <Logo />
        </div>
        <div className="login-form">
          <div className="login-lock">
            <LockKeyhole size={25} />
          </div>
          <h1>С возвращением</h1>
          <p>Войдите в панель администратора</p>
          <form onSubmit={submit}>
            <Field label="Служебная почта">
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="name@example.org"
                required
                autoFocus
                disabled={mutation.isPending}
              />
            </Field>
            <Field label="Пароль">
              <div className="password-field">
                <input
                  name="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Введите пароль"
                  required
                  disabled={mutation.isPending}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            {mutation.isError && <Alert error={mutation.error} />}
            <button
              className="btn primary login-submit"
              disabled={mutation.isPending || remaining > 0}
            >
              {mutation.isPending
                ? 'Входим…'
                : remaining
                  ? 'Повторить через ' + Math.ceil(remaining / 60) + ' мин.'
                  : 'Войти в панель'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-hint">
            <ShieldCheck size={18} />
            <p>
              Доступ предоставляется сотрудникам.
              <br />
              Для получения доступа обратитесь к администратору.
            </p>
          </div>
        </div>
        <small className="login-legal">Служебные действия сохраняются в журнале аудита</small>
      </section>
    </main>
  )
}
