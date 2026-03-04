import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { CookieJar } from 'tough-cookie'
import { AxiosHeaders } from 'axios'

export function resolveUrl(config: { url?: string, baseURL?: string }): string | undefined {
  if (!config.url) return undefined
  if (/^https?:\/\//.test(config.url)) return config.url
  if (config.baseURL) {
    try {
      const base = config.baseURL.endsWith('/') ? config.baseURL : config.baseURL + '/'
      return new URL(config.url, base).toString()
    }
    catch {
      return undefined
    }
  }
  return undefined
}

export function tryParseResponseAsJsonOrReturnAsIs(response: string) {
  try {
    return JSON.parse(response)
  }
  catch {
    return response
  }
}

export function modifyRequest(
  requestConfig: InternalAxiosRequestConfig<any>,
  cookieJar: CookieJar,
): InternalAxiosRequestConfig<any> {
  if (requestConfig.headers == null) {
    requestConfig.headers = new AxiosHeaders()
  }

  const url = resolveUrl(requestConfig)
  if (url) {
    const cookieString = cookieJar.getCookieStringSync(url)
    if (cookieString) {
      requestConfig.headers.Cookie = cookieString
    }
  }

  return requestConfig
}

export function handleResponse(
  response: AxiosResponse<any, any>,
  cookieJar: CookieJar,
) {
  const { headers, config } = response
  const url = resolveUrl(config)

  if (url && headers != null && 'set-cookie' in headers && headers['set-cookie']) {
    for (const cookie of headers['set-cookie']) {
      try {
        cookieJar.setCookieSync(cookie, url)
      }
      catch {
        // Silently ignore malformed cookies — matches browser behavior
      }
    }
  }

  return typeof response === 'string'
    ? tryParseResponseAsJsonOrReturnAsIs(response)
    : response
}
