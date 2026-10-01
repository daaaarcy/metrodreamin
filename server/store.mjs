// Tiny local map store — no accounts, no deps. A map's token (its id) is the
// credential: anyone with the #m=<id> link can load/save that map from any port.
// Data lives in server-data/<id>.json on this machine only.
import http from 'node:http'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const PORT = 8734
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'server-data')
mkdirSync(DIR, { recursive: true })

const okId = (id) => /^[A-Za-z0-9_-]{4,32}$/.test(id)
const file = (id) => join(DIR, `${id}.json`)
const readBody = (req) =>
  new Promise((res) => {
    let b = ''
    req.on('data', (c) => (b += c))
    req.on('end', () => res(b))
  })
const isSystem = (d) => d?.meta && typeof d.stations === 'object' && typeof d.lines === 'object'

http
  .createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.writeHead(204).end()

    const m = req.url?.match(/^\/map(?:\/([A-Za-z0-9_-]+))?\/?$/)

    if (req.method === 'GET' && m?.[1] && okId(m[1])) {
      if (!existsSync(file(m[1]))) return res.writeHead(404).end('{}')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(readFileSync(file(m[1]), 'utf8'))
    }

    if ((req.method === 'POST' && m && !m[1]) || (req.method === 'PUT' && m?.[1] && okId(m[1]))) {
      try {
        const data = JSON.parse(await readBody(req))
        if (!isSystem(data)) return res.writeHead(400).end('{}')
        const id = m[1] ?? randomBytes(8).toString('base64url')
        writeFileSync(file(id), JSON.stringify(data))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ id }))
      } catch {
        return res.writeHead(400).end('{}')
      }
    }

    res.writeHead(404).end('{}')
  })
  .listen(PORT, '127.0.0.1', () =>
    console.log(`map store listening on http://127.0.0.1:${PORT}`),
  )
