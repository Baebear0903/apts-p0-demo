/** @vitest-environment node */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import { HTTP_CHECK_PATHS } from '../app/routes'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

let server: ViteDevServer | undefined
let origin = ''

describe('关键路由 HTTP', () => {
  beforeAll(async () => {
    server = await createServer({
      configFile: path.join(root, 'vite.config.ts'),
      root,
      server: { host: '127.0.0.1', port: 0, strictPort: false },
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') {
      throw new Error('无法读取 Vite 地址')
    }
    origin = `http://127.0.0.1:${address.port}`
  }, 30000)

  afterAll(async () => {
    await server?.close()
  })

  it.each([...HTTP_CHECK_PATHS])('%s 返回 200', async (routePath) => {
    const response = await fetch(`${origin}${routePath}`)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('id="root"')
  })
})
