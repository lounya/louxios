import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { TOrError } from './errors'
import type { TInitialConfig } from './types'
import type { TProxy, TProxyAgents } from './proxy'
import { Semaphore, SemaphoreInterface } from 'async-mutex'
import axios from 'axios'
import { CookieJar } from 'tough-cookie'
import { CookieClientError, ECookieClientError, isError } from './errors'
import { handleResponse, modifyRequest, resolveUrl } from './interceptors'
import { getAgents } from './proxy'
import { sleep } from './utils'
import Releaser = SemaphoreInterface.Releaser

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
      this.useSemaphore = true
      this.semaphore = new Semaphore(simultaneousRequests)
      this.timeoutBetweenRequests = timeoutBetweenRequests
    }

    this.initializeClient(config)
  }

  private initializeClient(
    initialConfig: Omit<TInitialConfig, 'useSemaphore'>,
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
      const err = this.setProxy(proxy)
      if (isError(err))
        throw err
    }

    if (typeof validateStatus === 'function') {
      this.validateStatus = validateStatus
    }
  }

  async request<T = unknown>(
    initConfig: AxiosRequestConfig,
  ): Promise<TOrError<AxiosResponse<T>>> {
    const { useSemaphore, timeoutBetweenRequests, semaphore } = this
    let release: Releaser

    const { maxRedirects: initMaxRedirects, ...requestConfig } = initConfig
    const maxRedirects = initMaxRedirects ?? this.maxRedirects

    if (useSemaphore) {
      const [, rls] = await semaphore.acquire()
      release = rls
    }

    try {
      return await this.executeRequest<T>(requestConfig, maxRedirects)
    }
    finally {
      if (useSemaphore) {
        // Slot is held during sleep to enforce a minimum gap between requests per slot
        await sleep(timeoutBetweenRequests)

        release!()
      }
    }
  }

  private async executeRequest<T = unknown>(
    requestConfig: AxiosRequestConfig,
    maxRedirects: number,
    redirectCount: number = 0,
  ): Promise<TOrError<AxiosResponse<T>>> {
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
        return response
      }

      return new CookieClientError(
        ECookieClientError.WrongStatusCodeReceived,
        response,
      )
    }
    catch (err) {
      return new CookieClientError(ECookieClientError.FatalRequestError, err)
    }
  }

  private isRequestStatusValid(
    validateStatusFn: unknown,
    { status }: AxiosResponse,
  ): boolean {
    const validateStatus = typeof validateStatusFn === 'function'
      ? validateStatusFn
      : this.validateStatus

    return validateStatus(status)
  }

  get<T = unknown>(
    url: string,
    config: AxiosRequestConfig = {},
  ): Promise<TOrError<AxiosResponse<T>>> {
    return this.request({
      ...config,
      url,
      method: 'GET',
    })
  }

  post<T = unknown>(
    url: string,
    config: AxiosRequestConfig = {},
  ): Promise<TOrError<AxiosResponse<T>>> {
    return this.request({
      ...config,
      url,
      method: 'POST',
    })
  }

  setAgents({ http, https }: TProxyAgents) {
    this.setAgent(http, 'http')
    this.setAgent(https, 'https')
  }

  setAgent(agent: TProxy, type: 'http' | 'https' = 'http') {
    this.axiosInstance.defaults[`${type}Agent`] = agent
  }

  setProxy(proxy: string | TProxyAgents): TOrError<null> {
    const agents = typeof proxy === 'string' ? getAgents(proxy) : proxy
    if (isError(agents))
      return agents

    this.setAgents(agents)
    return null
  }

  getAgent(
    type: 'http' | 'https',
  ): TProxy {
    return this.axiosInstance.defaults[`${type}Agent`]
  }
}
