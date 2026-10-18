import { test } from 'node:test'
import assert from 'node:assert/strict'
import { update } from './update-infra-image.mjs'
const oldImage = 'ghcr.io/hse-scientists-team/matchlab-services/frontend@sha256:' + 'a'.repeat(64)
const newImage = 'ghcr.io/hse-scientists-team/matchlab-services/frontend@sha256:' + 'b'.repeat(64)
const source =
  'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: matchlab-images\ndata:\n  GATEWAY_IMAGE: untouched\n  # Preserve backend versions and comments.\n  FRONTEND_IMAGE: ' +
  oldImage +
  '\n'
test('updates exactly the frontend line and preserves all other bytes', () =>
  assert.equal(update(source, newImage), source.replace(oldImage, newImage)))
test('rejects tags, other registries, other services and malformed digests', () => {
  for (const image of [
    newImage.replace('@sha256:', ':'),
    newImage.replace('ghcr.io', 'evil.test'),
    newImage.replace('/frontend@', '/gateway@'),
    newImage + '0',
  ]) {
    assert.throws(() => update(source, image), /immutable/)
  }
})
test('first release adds frontend without changing existing backend fields', () => {
  const initial = source.replace('  FRONTEND_IMAGE: ' + oldImage + '\n', '')
  const result = update(initial, newImage)
  assert.equal(result, initial.trimEnd() + '\n  FRONTEND_IMAGE: ' + newImage + '\n')
  assert.equal(update(result, newImage), result)
})
test('rejects duplicate fields and wrong target documents', () => {
  assert.throws(
    () => update(source + '  FRONTEND_IMAGE: ' + oldImage + '\n', newImage),
    /duplicate/,
  )
  assert.throws(
    () => update(source.replace('name: matchlab-images', 'name: wrong'), newImage),
    /ConfigMap/,
  )
})
test('repeated update with the same digest is idempotent', () =>
  assert.equal(update(update(source, newImage), newImage), update(source, newImage)))
