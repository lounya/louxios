import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import Louxios from '../src/louxios'
import { LouxiosError, ELouxiosError } from '../src/errors'

let server: http.Server
let baseURL: string

function createServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost`)

      if (url.pathname === '/ok') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
        return
      }

      if (url.pathname === '/set-cookie') {
        res.writeHead(200, {
          'Set-Cookie': 'token=abc123; Path=/',
          'Content-Type': 'text/plain',
        })
        res.end('cookie set')
        return
      }

      if (url.pathname === '/read-cookie') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(req.headers.cookie || 'no cookie')
        return
      }

      if (url.pathname === '/redirect') {
        res.writeHead(302, { Location: '/ok' })
        res.end()
        return
      }

      if (url.pathname === '/redirect-chain') {
        res.writeHead(301, { Location: '/redirect' })
        res.end()
        return
      }

      if (url.pathname === '/redirect-loop') {
        res.writeHead(302, { Location: '/redirect-loop' })
        res.end()
        return
      }

      if (url.pathname === '/redirect-post') {
        res.writeHead(303, { Location: '/ok' })
        res.end()
        return
      }

      if (url.pathname === '/redirect-with-cookie') {
        res.writeHead(302, {
          'Set-Cookie': 'redirect_token=xyz789; Path=/',
          Location: '/read-cookie',
        })
        res.end()
        return
      }

      if (url.pathname === '/redirect-307') {
        res.writeHead(307, { Location: '/echo-method' })
        res.end()
        return
      }

      if (url.pathname === '/echo-method') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(req.method)
        return
      }

      if (url.pathname === '/status-500') {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('server error')
        return
      }

      res.writeHead(404)
      res.end('not found')
    })

    s.listen(0, '127.0.0.1', () => {
      resolve(s)
    })
  })
}

beforeAll(async () => {
  server = await createServer()
  const addr = server.address() as AddressInfo
  baseURL = `http://127.0.0.1:${addr.port}`
})

afterAll(() => {
  server.closeAllConnections()
  server.close()
})

describe('Louxios', () => {
  test('makes a successful GET request', async () => {
    const client = new Louxios({ baseURL })
    const result = await client.get('/ok')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.status).toBe(200)
      expect(result.value.data).toEqual({ success: true })
    }
  })

  test('makes a successful POST request', async () => {
    const client = new Louxios({ baseURL })
    const result = await client.post('/ok')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.status).toBe(200)
    }
  })

  test('returns error for non-2xx status', async () => {
    const client = new Louxios({ baseURL })
    const result = await client.get('/status-500')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LouxiosError)
      expect(result.error.message).toBe(ELouxiosError.WrongStatusCodeReceived)
    }
  })

  test('respects custom validateStatus', async () => {
    const client = new Louxios({
      baseURL,
      validateStatus: () => true,
    })
    const result = await client.get('/status-500')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.status).toBe(500)
    }
  })

  test('respects per-request validateStatus', async () => {
    const client = new Louxios({ baseURL })
    const result = await client.get('/status-500', {
      validateStatus: () => true,
    })

    expect(result.isOk()).toBe(true)
  })

  test('persists cookies across requests', async () => {
    const client = new Louxios({ baseURL })

    await client.get('/set-cookie')
    const result = await client.get('/read-cookie')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.data).toBe('token=abc123')
    }
  })

  test('follows redirects', async () => {
    const client = new Louxios()
    const result = await client.get(`${baseURL}/redirect`)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.status).toBe(200)
      expect(result.value.data).toEqual({ success: true })
    }
  })

  test('follows redirect chains', async () => {
    const client = new Louxios()
    const result = await client.get(`${baseURL}/redirect-chain`)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.status).toBe(200)
    }
  })

  test('stops following redirects at maxRedirects', async () => {
    const client = new Louxios({ maxRedirects: 0 })
    const result = await client.get(`${baseURL}/redirect`)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toBe(ELouxiosError.WrongStatusCodeReceived)
    }
  })

  test('stops at redirect loop after maxRedirects', async () => {
    const client = new Louxios({ maxRedirects: 5 })
    const result = await client.get(`${baseURL}/redirect-loop`)

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toBe(ELouxiosError.WrongStatusCodeReceived)
    }
  })

  test('changes POST to GET on 303 redirect', async () => {
    const client = new Louxios()
    const result = await client.post(`${baseURL}/redirect-post`)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.status).toBe(200)
    }
  })

  test('respects per-request maxRedirects override via request()', async () => {
    const client = new Louxios({ maxRedirects: 10 })
    const result = await client.request({
      url: `${baseURL}/redirect`,
      method: 'GET',
      maxRedirects: 0,
    })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toBe(ELouxiosError.WrongStatusCodeReceived)
    }
  })

  test('captures cookies set during redirect', async () => {
    const client = new Louxios()
    const result = await client.get(`${baseURL}/redirect-with-cookie`)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.data).toContain('redirect_token=xyz789')
    }
  })

  test('preserves POST method on 307 redirect', async () => {
    const client = new Louxios()
    const result = await client.post(`${baseURL}/redirect-307`)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.data).toBe('POST')
    }
  })

  test('returns error when connection fails', async () => {
    const client = new Louxios({ baseURL: 'http://127.0.0.1:1' })
    const result = await client.get('/anything')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(LouxiosError)
    }
  })
})

describe('Louxios semaphore', () => {
  test('throttles concurrent requests with timeoutBetweenRequests', async () => {
    const client = new Louxios({
      baseURL,
      useSemaphore: true,
      simultaneousRequests: 1,
      timeoutBetweenRequests: 150,
    })

    const start = performance.now()
    const [r1, r2] = await Promise.all([
      client.get('/ok'),
      client.get('/ok'),
    ])
    const elapsed = performance.now() - start

    expect(r1.isOk()).toBe(true)
    expect(r2.isOk()).toBe(true)
    // With 1 slot and 150ms gap, two sequential requests must take at least 150ms
    expect(elapsed).toBeGreaterThanOrEqual(100)
  })

  test('allows concurrent requests up to simultaneousRequests limit', async () => {
    const client = new Louxios({
      baseURL,
      useSemaphore: true,
      simultaneousRequests: 2,
      timeoutBetweenRequests: 0,
    })

    const [r1, r2] = await Promise.all([
      client.get('/ok'),
      client.get('/ok'),
    ])

    expect(r1.isOk()).toBe(true)
    expect(r2.isOk()).toBe(true)
  })

  test('does not throttle when semaphore is disabled', async () => {
    const client = new Louxios({ baseURL })

    const start = performance.now()
    const [r1, r2] = await Promise.all([
      client.get('/ok'),
      client.get('/ok'),
    ])
    const elapsed = performance.now() - start

    expect(r1.isOk()).toBe(true)
    expect(r2.isOk()).toBe(true)
    // Without semaphore, parallel requests should complete quickly
    expect(elapsed).toBeLessThan(500)
  })
})

describe('Louxios constructor validation', () => {
  test('throws when simultaneousRequests is not a positive integer', () => {
    expect(() => new Louxios({
      useSemaphore: true,
      simultaneousRequests: 0,
      timeoutBetweenRequests: 100,
    })).toThrow()
  })

  test('throws when timeoutBetweenRequests is negative', () => {
    expect(() => new Louxios({
      useSemaphore: true,
      simultaneousRequests: 1,
      timeoutBetweenRequests: -1,
    })).toThrow()
  })

  test('creates client with valid semaphore config', () => {
    expect(() => new Louxios({
      useSemaphore: true,
      simultaneousRequests: 2,
      timeoutBetweenRequests: 0,
    })).not.toThrow()
  })

  test('creates client without semaphore by default', () => {
    expect(() => new Louxios()).not.toThrow()
  })
})

describe('Louxios proxy', () => {
  test('setProxy returns ok for valid proxy agents', () => {
    const client = new Louxios()
    const result = client.setProxy({
      http: {} as any,
      https: {} as any,
    })

    expect(result.isOk()).toBe(true)
  })

  test('setProxy returns error for invalid proxy string', () => {
    const client = new Louxios()
    const result = client.setProxy('ftp://invalid-proxy')

    expect(result.isErr()).toBe(true)
  })

  test('getAgent returns undefined when no proxy set', () => {
    const client = new Louxios()
    expect(client.getAgent('http')).toBeUndefined()
  })

  test('getAgent returns agent after setProxy', () => {
    const client = new Louxios()
    const agent = {} as any
    client.setProxy({ http: agent, https: agent })

    expect(client.getAgent('http')).toBe(agent)
    expect(client.getAgent('https')).toBe(agent)
  })

  test('throws when constructed with invalid proxy', () => {
    expect(() => new Louxios({
      proxy: 'ftp://bad-proxy',
    })).toThrow()
  })
})
