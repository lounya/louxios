import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { TInitialConfig } from './types'
import type { TProxy, TProxyAgents } from './proxy'
import { ok, err, type Result } from 'neverthrow'
import { Semaphore } from 'async-mutex'
import axios from 'axios'
import { CookieJar } from 'tough-cookie'
import { CookieClientError, ECookieClientError, ErrorBase } from './errors'
import { handleResponse, modifyRequest, resolveUrl } from './interceptors'
import { getAgents } from './proxy'
import { sleep } from './utils'

export default class CookieClient {
  private useSemaphore: boolean = false

  private semaphore!: Semaphore

  private timeoutBetweenRequests!: number

  private jar!: CookieJar

  private axiosInstance!: AxiosInstance

  private maxRedirects!: number

  private validateStatus: (status: number) => boolean = status => status >= 200 && status < 300

  constructor(constructorConfig?: TInitialConfig) {
    const {
      useSemaphore,
      simultaneousRequests,
      timeoutBetweenRequests,
      ...config
    } = constructorConfig || {}

    if (useSemaphore) {
      if (!Number.isInteger(simultaneousRequests) || simultaneousRequests < 1) {
        throw new CookieClientError(
          'simultaneousRequests must be a positive integer',
          { simultaneousRequests },
        )
      }

      if (typeof timeoutBetweenRequests !== 'number' || timeoutBetweenRequests < 0 || !Number.isFinite(timeoutBetweenRequests)) {
        throw new CookieClientError(
          'timeoutBetweenRequests must be a non-negative finite number',
          { timeoutBetweenRequests },
        )
      }

      this.useSemaphore = true
      this.semaphore = new Semaphore(simultaneousRequests)
      this.timeoutBetweenRequests = timeoutBetweenRequests
    }

    this.initializeClient(config)
  }

  private initializeClient(
    initialConfig: Omit<TInitialConfig, 'useSemaphore' | 'simultaneousRequests' | 'timeoutBetweenRequests'>,
  ): void {
    const {
      proxy,
      validateStatus,
      maxRedirects = 10,
      ...config
    } = initialConfig

    this.jar = new CookieJar()

    this.maxRedirects = maxRedirects

    this.axiosInstance = axios.create({
      ...config,
      validateStatus: () => true,
      withCredentials: true,
      maxRedirects: 0,
    })

    this.axiosInstance.interceptors.request.use(_config => modifyRequest(_config, this.jar))

    this.axiosInstance.interceptors.response.use(response => handleResponse(response, this.jar))

    if (proxy) {
      const result = this.setProxy(proxy)
      if (result.isErr())
        throw result.error
    }

    if (typeof validateStatus === 'function') {
      this.validateStatus = validateStatus
    }
  }

  async request<T = unknown>(
    initConfig: AxiosRequestConfig,
  ): Promise<Result<AxiosResponse<T>, CookieClientError>> {
    const { maxRedirects: initMaxRedirects, ...requestConfig } = initConfig
    const maxRedirects = initMaxRedirects ?? this.maxRedirects

    if (!this.useSemaphore) {
      return this.executeRequest<T>(requestConfig, maxRedirects)
    }

    const [, release] = await this.semaphore.acquire()
    try {
      return await this.executeRequest<T>(requestConfig, maxRedirects)
    }
    finally {
      // Slot is held during sleep to enforce a minimum gap between requests per slot
      await sleep(this.timeoutBetweenRequests)
      release()
    }
  }

  private async executeRequest<T = unknown>(
    requestConfig: AxiosRequestConfig,
    maxRedirects: number,
    redirectCount: number = 0,
  ): Promise<Result<AxiosResponse<T>, CookieClientError>> {
    try {
      const response = await this.axiosInstance.request(requestConfig)

      if (
        maxRedirects > 0
        && [301, 302, 303, 307, 308].includes(response.status)
        && redirectCount < maxRedirects
        && response.headers.location
      ) {
        const currentUrl = resolveUrl(requestConfig) ?? requestConfig.url
        const redirectUrl = currentUrl
          ? new URL(response.headers.location, currentUrl).toString()
          : response.headers.location

        const currentMethod = (requestConfig.method ?? 'GET').toUpperCase()
        const shouldChangeToGet = [301, 302, 303].includes(response.status)
          && currentMethod !== 'GET'
          && currentMethod !== 'HEAD'

        const method = shouldChangeToGet ? 'GET' : requestConfig.method
        const data = shouldChangeToGet ? undefined : requestConfig.data
        const headers = shouldChangeToGet
          ? { ...requestConfig.headers, 'Content-Type': undefined, 'Content-Length': undefined }
          : requestConfig.headers

        return await this.executeRequest(
          {
            ...requestConfig,
            url: redirectUrl,
            method,
            data,
            headers,
          },
          maxRedirects,
          redirectCount + 1,
        )
      }

      if (this.isRequestStatusValid(requestConfig.validateStatus, response)) {
        return ok(response)
      }

      return err(new CookieClientError(
        ECookieClientError.WrongStatusCodeReceived,
        response,
      ))
    }
    catch (e) {
      return err(new CookieClientError(ECookieClientError.FatalRequestError, e))
    }
  }

  private isRequestStatusValid(
    validateStatusFn: AxiosRequestConfig['validateStatus'],
    { status }: AxiosResponse,
  ): boolean {
    const validateStatus = validateStatusFn ?? this.validateStatus
    return validateStatus(status)
  }

  get<T = unknown>(
    url: string,
    config: AxiosRequestConfig = {},
  ): Promise<Result<AxiosResponse<T>, CookieClientError>> {
    return this.request({
      ...config,
      url,
      method: 'GET',
    })
  }

  post<T = unknown>(
    url: string,
    config: AxiosRequestConfig = {},
  ): Promise<Result<AxiosResponse<T>, CookieClientError>> {
    return this.request({
      ...config,
      url,
      method: 'POST',
    })
  }

  private setAgents({ http, https }: TProxyAgents) {
    this.setAgent(http, 'http')
    this.setAgent(https, 'https')
  }

  private setAgent(agent: TProxy, type: 'http' | 'https' = 'http') {
    this.axiosInstance.defaults[`${type}Agent`] = agent
  }

  setProxy(proxy: string | TProxyAgents): Result<null, ErrorBase> {
    const agents = typeof proxy === 'string' ? getAgents(proxy) : ok(proxy)
    if (agents.isErr())
      return err(agents.error)
    this.setAgents(agents.value)
    return ok(null)
  }

  getAgent(
    type: 'http' | 'https',
  ): TProxy | undefined {
    return this.axiosInstance.defaults[`${type}Agent`] as TProxy | undefined
  }
}
