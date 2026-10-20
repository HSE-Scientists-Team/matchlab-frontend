import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { verificationToken, confirmationMessage } from '../web/assets/verify-email.mjs'
const token = 'a'.repeat(43)
test('verification URLs match the mobile contract without accepting foreign URLs or escaped tokens', () => {
  for (const path of ['/verify-email', '/verify-email/'])
    assert.equal(verificationToken(`https://matchlab.space${path}?token=${token}`), token)
  for (const url of [
    `https://www.matchlab.space/verify-email?token=${token}`,
    `https://api.matchlab.space/verify-email?token=${token}`,
    `http://matchlab.space/verify-email?token=${token}`,
    `https://user@matchlab.space/verify-email?token=${token}`,
    `https://matchlab.space:8443/verify-email?token=${token}`,
    `https://matchlab.space:443/verify-email?token=${token}`,
    `https://matchlab.space/verify-email?token=${token}#fragment`,
    `https://matchlab.space/verify-email?token=${token}&token=${token}`,
    `https://matchlab.space/verify-email?token=%61${token.slice(1)}`,
    'https://matchlab.space/verify-email?token=',
  ])
    assert.equal(verificationToken(url), null)
})
test('conflict never claims that possession of the address was verified', () => {
  assert.ok(!confirmationMessage(409).includes('Почта подтверждена'))
  assert.match(confirmationMessage(404), /уже использована/)
  assert.match(confirmationMessage(410), /истёк/)
})
test('assetlinks authorizes exactly the provided app and certificate, without placeholders', async () => {
  const statements = JSON.parse(await readFile(new URL('../web/assetlinks.json', import.meta.url)))
  assert.equal(statements.length, 1)
  assert.equal(statements[0].target.package_name, 'org.matchlab.academic_net')
  assert.deepEqual(statements[0].relation, ['delegate_permission/common.handle_all_urls'])
  assert.deepEqual(statements[0].target.sha256_cert_fingerprints, [
    '00:2D:35:39:2C:DB:2F:E0:13:C4:46:8E:0F:DE:0A:AB:DE:FE:47:7E:F6:B8:9F:3C:07:4D:9C:90:98:A4:6D:37',
  ])
})
