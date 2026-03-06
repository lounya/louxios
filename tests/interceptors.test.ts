import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { AxiosHeaders } from 'axios'
import { CookieJar } from 'tough-cookie'
import { describe, expect, it } from 'vitest'
import { handleResponse, modifyRequest, resolveUrl } from '../src/interceptors'

describe('resolveUrl', () => {
  it('returns absolute URL as-is', () => {
    expect(resolveUrl({ url: 'https://example.com/path' })).toBe('https://example.com/path')
  })

  it('returns undefined when no url', () => {
    expect(resolveUrl({})).toBeUndefined()
  })

  it('resolves relative URL against baseURL', () => {
    expect(resolveUrl({ url: 'api/data', baseURL: 'https://example.com' }))
      .toBe('https://example.com/api/data')
  })

  it('resolves relative URL when baseURL has trailing slash', () => {
    expect(resolveUrl({ url: 'api/data', baseURL: 'https://example.com/' }))
      .toBe('https://example.com/api/data')
  })

  it('returns undefined for relative URL without baseURL', () => {
    expect(resolveUrl({ url: 'api/data' })).toBeUndefined()
  })

  it('returns undefined for invalid baseURL', () => {
    expect(resolveUrl({ url: 'api/data', baseURL: 'not-a-url' })).toBeUndefined()
  })
})

function makeRequestConfig(overrides: Partial<InternalAxiosRequestConfig> = {}): InternalAxiosRequestConfig {
  return {
    headers: new AxiosHeaders(),
    ...overrides,
  } as InternalAxiosRequestConfig
}

describe('modifyRequest', () => {
  it('injects cookies from jar into request headers', () => {
    const jar = new CookieJar()
    jar.setCookieSync('session=abc123', 'https://example.com')

    const config = makeRequestConfig({ url: 'https://example.com/page' })
    const result = modifyRequest(config, jar)

    expect(result.headers.Cookie).toBe('session=abc123')
  })

  it('does not set cookie header when jar is empty', () => {
    const jar = new CookieJar()
    const config = makeRequestConfig({ url: 'https://example.com/page' })
    const result = modifyRequest(config, jar)

    expect(result.headers.Cookie).toBeUndefined()
  })

  it('creates headers if null', () => {
    const jar = new CookieJar()
    const config = { url: 'https://example.com' } as InternalAxiosRequestConfig
    config.headers = null as any

    const result = modifyRequest(config, jar)
    expect(result.headers).toBeInstanceOf(AxiosHeaders)
  })

  it('does not inject cookies when URL cannot be resolved', () => {
    const jar = new CookieJar()
    jar.setCookieSync('session=abc', 'https://example.com')

    const config = makeRequestConfig({ url: 'relative/path' })
    const result = modifyRequest(config, jar)

    expect(result.headers.Cookie).toBeUndefined()
  })
})

describe('handleResponse', () => {
  function makeResponse(overrides: Partial<AxiosResponse> = {}): AxiosResponse {
    return {
      data: null,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: makeRequestConfig({ url: 'https://example.com' }),
      ...overrides,
    }
  }

  it('stores set-cookie headers in the jar', () => {
    const jar = new CookieJar()
    const response = makeResponse({
      headers: { 'set-cookie': ['token=xyz; Path=/'] },
    })

    handleResponse(response, jar)

    expect(jar.getCookieStringSync('https://example.com')).toBe('token=xyz')
  })

  it('stores multiple cookies', () => {
    const jar = new CookieJar()
    const response = makeResponse({
      headers: { 'set-cookie': ['a=1; Path=/', 'b=2; Path=/'] },
    })

    handleResponse(response, jar)

    const cookies = jar.getCookieStringSync('https://example.com')
    expect(cookies).toContain('a=1')
    expect(cookies).toContain('b=2')
  })

  it('ignores response without set-cookie header', () => {
    const jar = new CookieJar()
    const response = makeResponse({ headers: {} })

    handleResponse(response, jar)

    expect(jar.getCookieStringSync('https://example.com')).toBe('')
  })

  it('silently ignores malformed cookies', () => {
    const jar = new CookieJar()
    const response = makeResponse({
      headers: { 'set-cookie': ['', 'valid=1; Path=/'] },
    })

    expect(() => handleResponse(response, jar)).not.toThrow()
    expect(jar.getCookieStringSync('https://example.com')).toBe('valid=1')
  })

  it('ignores set-cookie when URL cannot be resolved', () => {
    const jar = new CookieJar()
    const response = makeResponse({
      headers: { 'set-cookie': ['leaked=secret; Path=/'] },
      config: makeRequestConfig({ url: 'relative/path' }),
    })

    handleResponse(response, jar)

    expect(jar.getCookieStringSync('https://example.com')).toBe('')
  })

  it('returns the response object', () => {
    const jar = new CookieJar()
    const response = makeResponse()

    expect(handleResponse(response, jar)).toBe(response)
  })
})
