import { describe, test, expect } from 'vitest'
import { getProxyProtocol, getAgents, EProxyProtocol } from '../src/proxy'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

describe('getProxyProtocol', () => {
  test('detects http protocol', () => {
    expect(getProxyProtocol('http://proxy.example.com')).toBe(EProxyProtocol.HTTP)
  })

  test('detects https protocol', () => {
    expect(getProxyProtocol('https://proxy.example.com')).toBe(EProxyProtocol.HTTPS)
  })

  test('detects socks protocol', () => {
    expect(getProxyProtocol('socks://proxy.example.com')).toBe(EProxyProtocol.SOCKS)
  })

  test('detects socks4 protocol', () => {
    expect(getProxyProtocol('socks4://proxy.example.com')).toBe(EProxyProtocol.SOCKS4)
  })

  test('detects socks5 protocol', () => {
    expect(getProxyProtocol('socks5://proxy.example.com')).toBe(EProxyProtocol.SOCKS5)
  })

  test('returns UNKNOWN for unrecognized protocol', () => {
    expect(getProxyProtocol('ftp://proxy.example.com')).toBe(EProxyProtocol.UNKNOWN)
  })

  test('returns UNKNOWN for no protocol', () => {
    expect(getProxyProtocol('proxy.example.com')).toBe(EProxyProtocol.UNKNOWN)
  })

  test('accepts URL object', () => {
    expect(getProxyProtocol(new URL('http://proxy.example.com'))).toBe(EProxyProtocol.HTTP)
  })
})

describe('getAgents', () => {
  test('returns HTTP agents for http proxy', () => {
    const result = getAgents('http://proxy.example.com:8080')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.http).toBeInstanceOf(HttpProxyAgent)
      expect(result.value.https).toBeInstanceOf(HttpsProxyAgent)
    }
  })

  test('returns HTTP agents for https proxy', () => {
    const result = getAgents('https://proxy.example.com:8080')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.http).toBeInstanceOf(HttpProxyAgent)
      expect(result.value.https).toBeInstanceOf(HttpsProxyAgent)
    }
  })

  test('returns SOCKS agents for socks proxy', () => {
    const result = getAgents('socks://proxy.example.com:1080')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.http).toBeInstanceOf(SocksProxyAgent)
      expect(result.value.https).toBeInstanceOf(SocksProxyAgent)
    }
  })

  test('returns SOCKS agents for socks5 proxy', () => {
    const result = getAgents('socks5://proxy.example.com:1080')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.http).toBeInstanceOf(SocksProxyAgent)
      expect(result.value.https).toBeInstanceOf(SocksProxyAgent)
    }
  })

  test('returns error for unknown protocol', () => {
    const result = getAgents('ftp://proxy.example.com')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('No proxy protocol specified')
    }
  })

  test('accepts explicit protocol override', () => {
    const result = getAgents('http://proxy.example.com', EProxyProtocol.HTTP)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.http).toBeInstanceOf(HttpProxyAgent)
    }
  })

  test('sanitizes credentials in error messages', () => {
    const result = getAgents('ftp://user:password@proxy.example.com')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      const errorStr = result.error.toString()
      expect(errorStr).not.toContain('password')
      expect(errorStr).toContain('<credentials>')
    }
  })
})
