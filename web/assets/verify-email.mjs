export function verificationToken(href) {
  try {
    if (!href.startsWith('https://matchlab.space/')) return null
    const u = new URL(href)
    if (u.origin !== 'https://matchlab.space' || u.username || u.password || u.hash) return null
    if (!['/verify-email', '/verify-email/'].includes(u.pathname)) return null
    const tokens = u.search
      .slice(1)
      .split('&')
      .filter((v) => v.split('=')[0] === 'token')
    if (tokens.length !== 1) return null
    const raw = tokens[0].slice('token='.length)
    return /^[A-Za-z0-9_-]{43}$/.test(raw) ? raw : null
  } catch {
    return null
  }
}

export function confirmationMessage(status) {
  return (
    {
      400: 'Некорректная ссылка. Откройте полную ссылку из письма.',
      403: 'Подтверждение для этого почтового домена недоступно.',
      404: 'Ссылка не найдена или уже использована. Если вы уже подтверждали почту, попробуйте войти в приложение.',
      409: 'Для этого адреса уже существует аккаунт. Попробуйте войти в приложение; при необходимости обратитесь в поддержку.',
      410: 'Срок действия ссылки истёк. Повторите регистрацию, чтобы получить новое письмо.',
      429: 'Слишком много попыток. Подождите и повторите позже.',
    }[status] ||
    'Не удалось получить подтверждение от сервера. Запрос мог быть выполнен — проверьте вход в приложении перед повторной попыткой.'
  )
}

if (typeof document !== 'undefined') {
  const button = document.getElementById('confirm')
  const app = document.getElementById('open-app')
  const status = document.getElementById('status')
  let token = verificationToken(window.location.href)
  if (!token) {
    status.textContent = 'Откройте полную ссылку подтверждения из письма MatchLab.'
    status.dataset.error = 'true'
  } else {
    app.href = window.location.href
    app.hidden = false
    button.disabled = false
  }
  button.addEventListener('click', async () => {
    if (button.disabled || !token) return
    button.disabled = true
    button.textContent = 'Подтверждаем…'
    status.textContent = ''
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await fetch('https://api.matchlab.space/api/v1/auth/email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
        body: JSON.stringify({ token }),
      })
      if (!response.ok) {
        status.textContent = confirmationMessage(response.status)
        status.dataset.error = 'true'
        button.textContent = 'Повторить подтверждение'
        // No automatic retries, including Retry-After: tokens are single-use.
        const delay = Math.min(3600, Math.max(1, Number(response.headers.get('Retry-After')) || 30))
        if (response.status === 429)
          window.setTimeout(() => {
            button.disabled = false
          }, delay * 1000)
        else button.disabled = false
        return
      }
      token = null
      app.removeAttribute('href')
      app.hidden = true
      window.history.replaceState(null, '', '/verify-email')
      status.dataset.error = 'false'
      status.textContent =
        'Почта подтверждена. Вернитесь в приложение MatchLab и войдите с почтой и паролем.'
      button.textContent = 'Почта подтверждена'
    } catch {
      status.dataset.error = 'true'
      status.textContent = confirmationMessage(0)
      button.textContent = 'Повторить подтверждение'
      button.disabled = false
    } finally {
      window.clearTimeout(timeout)
    }
  })
}
