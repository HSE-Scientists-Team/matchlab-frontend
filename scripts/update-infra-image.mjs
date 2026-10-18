import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDocument, isMap } from 'yaml'
export function update(content, image) {
  if (
    !/^ghcr\.io\/hse-scientists-team\/matchlab-services\/frontend@sha256:[a-f0-9]{64}$/.test(image)
  ) {
    throw new Error('Expected an immutable MatchLab frontend digest')
  }
  const doc = parseDocument(content)
  if (doc.errors.length) throw new Error('Invalid or duplicate YAML fields')
  if (doc.get('kind') !== 'ConfigMap' || doc.getIn(['metadata', 'name']) !== 'matchlab-images') {
    throw new Error('Expected matchlab-images ConfigMap')
  }
  if (!isMap(doc.get('data'))) throw new Error('Expected ConfigMap data mapping')
  if (!doc.hasIn(['data', 'FRONTEND_IMAGE'])) {
    const start = content.indexOf('\ndata:\n')
    if (
      start < 0 ||
      content
        .slice(start + 7)
        .split('\n')
        .some((line) => line && !line.startsWith(' ') && !line.startsWith('#'))
    ) {
      throw new Error('Expected final ConfigMap data block')
    }
    return content.trimEnd() + '\n  FRONTEND_IMAGE: ' + image + '\n'
  }
  if (typeof doc.getIn(['data', 'FRONTEND_IMAGE']) !== 'string') {
    throw new Error('Expected string FRONTEND_IMAGE')
  }
  const matches = content.match(/^  FRONTEND_IMAGE: [^\n]+/gm)
  if (matches?.length !== 1) throw new Error('Expected exactly one FRONTEND_IMAGE entry')
  return content.replace(matches[0], '  FRONTEND_IMAGE: ' + image)
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [, , path, image] = process.argv
  if (!path || !image)
    throw new Error('Usage: node scripts/update-infra-image.mjs <images.yaml> <image@digest>')
  await writeFile(path, update(await readFile(path, 'utf8'), image))
}
