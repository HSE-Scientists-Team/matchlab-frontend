import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import assert from 'node:assert/strict'
import { setTimeout as pause } from 'node:timers/promises'
const exec = promisify(execFile)
const name = 'matchlab-frontend-check-' + process.pid + '-' + Date.now()
const image = name + ':test'
const docker = (...args) => exec('docker', args, { maxBuffer: 10 * 1024 * 1024 })
try {
  await docker('build', '-t', image, '.')
  await docker(
    'run',
    '--detach',
    '--name',
    name,
    '--read-only',
    '--user',
    '101:101',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--tmpfs',
    '/tmp:uid=101,gid=101,mode=1770',
    '--tmpfs',
    '/etc/nginx/conf.d:uid=101,gid=101,mode=0770',
    '-p',
    '127.0.0.1::8080',
    '-e',
    'GATEWAY_UPSTREAM=http://127.0.0.1:9',
    '-e',
    'DOCS_UPSTREAM=http://127.0.0.1:9',
    image,
  )
  const { stdout } = await docker('port', name, '8080/tcp')
  const base = 'http://' + stdout.trim()
  let ready = false
  for (let i = 0; i < 30; i++) {
    try {
      ready = (await fetch(base + '/healthz', { signal: AbortSignal.timeout(1000) })).ok
    } catch {
      /* starting */
    }
    if (ready) break
    await pause(500)
  }
  assert.ok(ready, 'read-only Nginx did not become ready')
  const redirect = await fetch(base + '/admin', {
    redirect: 'manual',
    headers: { Host: 'api.matchlab.space', 'X-Forwarded-Proto': 'https' },
  })
  assert.equal(redirect.status, 301)
  assert.equal(
    redirect.headers.get('location'),
    '/admin/',
    'TLS-terminated request must not redirect to HTTP/internal port',
  )
  const links = await fetch(base + '/.well-known/assetlinks.json', { redirect: 'manual' })
  assert.equal(links.status, 200)
  assert.equal(links.headers.get('location'), null)
  assert.match(links.headers.get('content-type'), /^application\/json/)
  assert.equal((await links.json())[0].target.package_name, 'org.matchlab.academic_net')
  for (const path of ['/verify-email', '/verify-email/']) {
    const verification = await fetch(base + path + '?token=synthetic-token', { redirect: 'manual' })
    assert.equal(verification.status, 200)
    assert.equal(verification.headers.get('location'), null)
    assert.equal(verification.headers.get('cache-control'), 'no-store')
    assert.equal(verification.headers.get('referrer-policy'), 'no-referrer')
    assert.ok((await verification.text()).includes('Подтвердить почту'))
  }
  const script = await fetch(base + '/verification-assets/verify-email.mjs')
  assert.equal(script.status, 200)
  assert.match(script.headers.get('content-type'), /javascript/)
  const { stdout: accessLogs } = await docker('logs', name)
  assert.ok(!accessLogs.includes('synthetic-token'), 'verification token leaked to access log')
  const page = await fetch(base + '/admin/')
  assert.equal(page.status, 200)
  assert.equal(page.headers.get('cache-control'), 'no-store')
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(page.headers.get('x-frame-options'), 'DENY')
  assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"))
  const html = await page.text()
  const asset = html.match(/src="([^"]+\.js)"/)?.[1]
  assert.ok(asset, 'built JS asset missing')
  const js = await fetch(base + asset)
  assert.equal(js.status, 200)
  assert.ok(js.headers.get('cache-control').includes('immutable'))
  assert.equal((await fetch(base + '/admin/users/example')).status, 200)
  assert.equal((await fetch(base + '/admin/assets/missing.js')).status, 404)
  console.log(
    'Container checks passed: non-root/read-only runtime, HTTPS-safe redirect, SPA, cache and security headers',
  )
} finally {
  await docker('rm', '--force', name).catch(() => {})
  await docker('image', 'rm', image).catch(() => {})
}
