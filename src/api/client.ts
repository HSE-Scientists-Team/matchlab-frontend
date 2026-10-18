import type { Session } from './types'
const key = 'matchlab.admin.session'
export function readSession(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(key) || 'null') as Session | null
    if (
      s &&
      typeof s.token === 'string' &&
      /^[A-Za-z0-9_-]{43}$/.test(s.token) &&
      Number.isFinite(s.expires) &&
      s.expires > Date.now()
    )
      return s
  } catch {
    /* unavailable storage or invalid previous session */
  }
  return null
}
let current: Session | null = readSession()
const subscribers = new Set<() => void>()
export const sessionStore = {
  get: () => current,
  subscribe: (fn: () => void) => {
    subscribers.add(fn)
    return () => {
      subscribers.delete(fn)
    }
  },
  set: (s: Session | null) => {
    current = s
    try {
      if (s) sessionStorage.setItem(key, JSON.stringify(s))
      else sessionStorage.removeItem(key)
    } catch {
      /* In-memory sessions still work. */
    }
    subscribers.forEach((fn) => fn())
  },
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public uncertain = false,
    public retryAfter = 0,
  ) {
    super(message)
  }
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос.'
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const session = sessionStore.get()
  if (session && session.expires <= Date.now()) {
    sessionStore.set(null)
    throw new ApiError(401, 'Сеанс истёк. Войдите снова.')
  }
  const method = options.method || 'GET'
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) controller.abort()
  const timeout = window.setTimeout(abort, 20_000)
  try {
    const response = await fetch('/api/v1/admin' + path, {
      method,
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(session ? { Authorization: 'Bearer ' + session.token } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    if (!response.ok) {
      if (response.status === 401 && session) sessionStore.set(null)
      let detail = ''
      try {
        const body = await response.json()
        detail =
          typeof body.error === 'string'
            ? body.error
            : typeof body.message === 'string'
              ? body.message
              : ''
      } catch {
        /* non-JSON proxy error */
      }
      const uncertain = method !== 'GET' && response.status >= 500
      const text =
        response.status === 409
          ? 'Данные уже изменились. Обновите карточку и проверьте состояние перед новым решением.'
          : response.status === 401
            ? path === '/auth/login'
              ? 'Неверная почта или пароль.'
              : 'Сеанс истёк. Войдите снова.'
            : response.status === 403
              ? 'У вас нет прав для этого действия.'
              : response.status === 429
                ? 'Слишком много попыток. Повторите позже.'
                : uncertain
                  ? 'Результат операции неизвестен. Обновите состояние и историю перед повтором.'
                  : response.status >= 500
                    ? 'Сервис временно недоступен. Попробуйте обновить данные.'
                    : detail || 'Не удалось выполнить запрос.'
      throw new ApiError(
        response.status,
        text,
        uncertain,
        Number(response.headers.get('Retry-After')) || 0,
      )
    }
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (options.signal?.aborted) throw error
    throw new ApiError(
      0,
      method === 'GET'
        ? 'Не удалось связаться с сервером. Проверьте соединение и обновите данные.'
        : 'Ответ сервера не получен. Проверьте состояние и историю перед повтором.',
      method !== 'GET',
    )
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abort)
  }
}
export function queryString(filters: Record<string, string | number | boolean | undefined>) {
  const p = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '') p.set(k, String(v))
  })
  return p.size ? '?' + p.toString() : ''
}
