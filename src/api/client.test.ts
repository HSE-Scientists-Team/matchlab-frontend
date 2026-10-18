import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, readSession, sessionStore, queryString } from './client'
afterEach(() => {
  sessionStore.set(null)
  vi.unstubAllGlobals()
})
describe('administrative API boundary', () => {
  it('never stores an expired or malformed session as a usable identity', () => {
    sessionStorage.setItem(
      'matchlab.admin.session',
      JSON.stringify({ token: 'bad', expires: Date.now() + 100000 }),
    )
    expect(readSession()).toBeNull()
    sessionStorage.setItem(
      'matchlab.admin.session',
      JSON.stringify({ token: 'A'.repeat(43), expires: Date.now() - 1 }),
    )
    expect(readSession()).toBeNull()
  })
  it('sends only admin bearer credentials and removes them after a 401', async () => {
    sessionStore.set({ token: 'A'.repeat(43), expires: Date.now() + 10000 })
    const mock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: 'expired' }), { status: 401 }))
    vi.stubGlobal('fetch', mock)
    await expect(api('/me')).rejects.toMatchObject({ status: 401 })
    expect(sessionStore.get()).toBeNull()
    expect(mock.mock.calls[0][1].headers.Authorization).toBe('Bearer ' + 'A'.repeat(43))
    expect(mock.mock.calls[0][1].credentials).toBe('omit')
  })
  it('treats a lost mutation response as uncertain and never retries it', async () => {
    const mock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', mock)
    await expect(
      api('/tickets/id/actions', { method: 'POST', body: { expected_revision: 3 } }),
    ).rejects.toMatchObject({ uncertain: true, status: 0 })
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('keeps a valid session on a server failure', async () => {
    sessionStore.set({ token: 'A'.repeat(43), expires: Date.now() + 10000 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('proxy error', { status: 502 })))
    await expect(api('/me')).rejects.toBeInstanceOf(ApiError)
    expect(sessionStore.get()).not.toBeNull()
  })
  it('retains explicit false while omitting absent filters', () =>
    expect(queryString({ is_active: false, text: '', limit: 20 })).toBe(
      '?is_active=false&limit=20',
    ))
})
