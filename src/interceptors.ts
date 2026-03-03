import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type CookieJar from './CookieJar'
import { AxiosHeaders } from 'axios'

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
): InternalAxiosRequestConfig<any> | Promise<InternalAxiosRequestConfig<any>> {
  if (requestConfig.headers == null) {
    requestConfig.headers = new AxiosHeaders()
  }

  requestConfig.headers.Cookie = cookieJar.getCookiesString()

  return requestConfig
}

export function handleResponse(
  response: AxiosResponse<any, any>,
  cookieJar: CookieJar,
) {
  const { headers } = response

  if (headers != null && 'set-cookie' in headers && headers['set-cookie']) {
    cookieJar.setCookies(headers['set-cookie'])
  }

  return typeof response === 'string'
    ? tryParseResponseAsJsonOrReturnAsIs(response)
    : response
}
