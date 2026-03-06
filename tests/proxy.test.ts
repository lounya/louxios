import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { describe, expect, it } from 'vitest'
import { EProxyProtocol, getAgents, getProxyProtocol } from '../src/proxy'

describe('getProxyProtocol', () => {
  it('detects http protocol', () => {
    expect(getProxyProtocol('http://proxy.example.com')).toBe(EProxyProtocol.HTTP)
  })

  it('detects https protocol', () => {
    expect(getProxyProtocol('https://proxy.example.com')).toBe(EProxyProtocol.HTTPS)
  })

  it('detects socks protocol', () => {
    expect(getProxyProtocol('socks://proxy.example.com')).toBe(EProxyProtocol.SOCKS)
  })

  it('detects socks4 protocol', () => {
    expect(getProxyProtocol('socks4://proxy.example.com')).toBe(EProxyProtocol.SOCKS4)
  })

  it('detects socks5 protocol', () => {
    expect(getProxyProtocol('socks5://proxy.example.com')).toBe(EProxyProtocol.SOCKS5)
  })

  it('returns UNKNOWN for unrecognized protocol', () => {
    expect(getProxyProtocol('ftp://proxy.example.com')).toBe(EProxyProtocol.UNKNOWN)
  })

  it('returns UNKNOWN for no protocol', () => {
    expect(getProxyProtocol('proxy.example.com')).toBe(EProxyProtocol.UNKNOWN)
  })

  it('accepts URL object', () => {
    expect(getProxyProtocol(new URL('http://proxy.example.com'))).toBe(EProxyProtocol.HTTP)
  })
})

describe('getAgents', () => {
  it('returns HTTP agents for http proxy', () => {
    const result = getAgents('http://proxy.example.com:8080')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.http).toBeInstanceOf(HttpProxyAgent)
      expect(result.value.https).toBeInstanceOf(HttpsProxyAgent)
    }
  })

  it('returns HTTP agents for https proxy', () => {
    const result = getAgents('https://proxy.example.com:8080')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.http).toBeInstanceOf(HttpProxyAgent)
      expect(result.value.https).toBeInstanceOf(HttpsProxyAgent)
    }
  })

  it('returns SOCKS agents for socks proxy', () => {
    const result = getAgents('socks://proxy.example.com:1080')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.http).toBeInstanceOf(SocksProxyAgent)
      expect(result.value.https).toBeInstanceOf(SocksProxyAgent)
    }
  })

  it('returns SOCKS agents for socks5 proxy', () => {
    const result = getAgents('socks5://proxy.example.com:1080')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.http).toBeInstanceOf(SocksProxyAgent)
      expect(result.value.https).toBeInstanceOf(SocksProxyAgent)
    }
  })

  it('returns error for unknown protocol', () => {
    const result = getAgents('ftp://proxy.example.com')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toContain('No proxy protocol specified')
    }
  })

  it('accepts explicit protocol override', () => {
    const result = getAgents('http://proxy.example.com', EProxyProtocol.HTTP)

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.http).toBeInstanceOf(HttpProxyAgent)
    }
  })

  it('sanitizes credentials in error messages', () => {
    const result = getAgents('ftp://user:password@proxy.example.com')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      const errorStr = result.error.toString()
      expect(errorStr).not.toContain('password')
      expect(errorStr).toContain('<credentials>')
    }
  })
})
