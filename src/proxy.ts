import type { TOrError } from './errors'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { ErrorBase } from './errors'

export type TProxy<Uri extends string = string>
  = | HttpProxyAgent<Uri>
    | HttpsProxyAgent<Uri>
    | SocksProxyAgent

export interface TProxyAgents {
  http: TProxy
  https: TProxy
}

export enum EProxyProtocol {
  UNKNOWN = 'unknown',
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS = 'socks',
  SOCKS4 = 'socks4',
  SOCKS5 = 'socks5',
}

class ProxyError extends ErrorBase {
  constructor(message: string, cause: unknown) {
    super('Proxy', message, cause)
  }
}

enum EProxyError {
  NoProtocolSpecified = 'No proxy protocol specified. Use http://, https://, socks://, socks4://, or socks5:// prefix.',
}

const protocols: Set<string> = new Set([
  EProxyProtocol.HTTP,
  EProxyProtocol.HTTPS,
  EProxyProtocol.SOCKS,
  EProxyProtocol.SOCKS4,
  EProxyProtocol.SOCKS5,
])

export function getProxyProtocol(str: string | URL): EProxyProtocol {
  const [protocol] = str.toString().split('://')

  return protocols.has(protocol)
    ? (protocol as EProxyProtocol)
    : EProxyProtocol.UNKNOWN
}

export function getAgents(
  proxy: string | URL,
  protocol?: Exclude<EProxyProtocol, EProxyProtocol.UNKNOWN>,
): TOrError<{
  http: TProxy
  https: TProxy
}> {
  const p = protocol || getProxyProtocol(proxy)

  switch (p) {
    case EProxyProtocol.HTTP:
    case EProxyProtocol.HTTPS:
      return {
        http: new HttpProxyAgent(proxy),
        https: new HttpsProxyAgent(proxy),
      }

    case EProxyProtocol.SOCKS:
    case EProxyProtocol.SOCKS4:
    case EProxyProtocol.SOCKS5:
      return {
        http: new SocksProxyAgent(proxy),
        https: new SocksProxyAgent(proxy),
      }

    default:
      return new ProxyError(EProxyError.NoProtocolSpecified, { str: proxy })
  }
}
