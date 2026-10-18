import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { parse, stringify } from 'yaml'
const source = process.argv[2] || 'https://api.matchlab.space/docs/openapi.yaml'
const raw = /^https:\/\//.test(source)
  ? await (async () => {
      const r = await fetch(source)
      if (!r.ok) throw new Error('OpenAPI download failed: ' + r.status)
      return r.text()
    })()
  : await readFile(source, 'utf8')
const full = parse(raw)
const paths = Object.fromEntries(
  Object.entries(full.paths).filter(([path]) => path.startsWith('/api/v1/admin')),
)
const schemas = {}
function visit(value) {
  if (Array.isArray(value)) {
    value.forEach(visit)
    return
  }
  if (!value || typeof value !== 'object') return
  if (value.$ref?.startsWith('#/components/schemas/')) {
    const name = value.$ref.split('/').at(-1)
    if (!schemas[name]) {
      schemas[name] = full.components.schemas[name]
      if (!schemas[name]) throw new Error('Missing schema: ' + name)
      visit(schemas[name])
    }
  }
  Object.values(value).forEach(visit)
}
visit(paths)
if (!Object.keys(paths).length) throw new Error('Admin paths are missing')
const document = {
  openapi: '3.1.0',
  info: { title: 'MatchLab Admin API', version: full.info.version },
  paths,
  components: {
    schemas,
    securitySchemes: { AdminSession: full.components.securitySchemes.AdminSession },
  },
}
await mkdir('api', { recursive: true })
await writeFile('api/admin.openapi.yaml', stringify(document, { lineWidth: 100 }))
console.log('Synchronized ' + Object.keys(paths).length + ' administrative paths')
