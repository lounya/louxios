import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import type { TOrError } from './errors'
import type { TInitialConfig } from './types'
import type { TProxy, TProxyAgents } from './proxy'
import { Semaphore, SemaphoreInterface } from 'async-mutex'
import axios from 'axios'
import CookieJar from './CookieJar'
import { CookieClientError, ECookieClientError, isError } from './errors'
import { handleResponse, modifyRequest } from './interceptors'
import { getAgents } from './proxy'
import { sleep } from './utils'
import Releaser = SemaphoreInterface.Releaser

export default class CookieClient {
  useSemaphore: boolean = false

  semaphore!: Semaphore

  timeoutBetweenRequests!: number

  jar!: CookieJar

  axiosInstance!: AxiosInstance

  maxRedirects!: number

  validateStatus: (status: number) => boolean = status => status >= 200 && status < 300

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
  ): TOrError {
    const {
      proxy,
      validateStatus,
      cookieJar = new CookieJar(),
      maxRedirects = 10,
      ...config
    } = initialConfig

    this.jar = cookieJar

    this.maxRedirects = maxRedirects

    this.axiosInstance = axios.create({
      ...config,
      validateStatus: () => true,
      withCredentials: true,
      maxRedirects: 0,
    })

    this.axiosInstance.interceptors.request.use(_config => modifyRequest(_config, cookieJar))

    this.axiosInstance.interceptors.response.use(response => handleResponse(response, cookieJar))

    if (proxy) {
      const err = this.setProxy(proxy)
      if (isError(err))
        throw err
    }

    if (typeof validateStatus === 'function') {
      this.validateStatus = validateStatus
    }
    return null
  }

  async request<T = unknown>(
    initConfig: AxiosRequestConfig,
    redirectCount: number = 0,
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
      const response = await this.axiosInstance.request(requestConfig)

      if (
        maxRedirects > 0
        && [301, 302, 307, 308].includes(response.status)
        && redirectCount < maxRedirects
        && response.headers.location
      ) {
        const method = response.status === 303 ? 'GET' : requestConfig.method
        return await this.request(
          {
            ...requestConfig,
            url: response.headers.location,
            method,
          },
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
    finally {
      if (useSemaphore) {
        await sleep(timeoutBetweenRequests)

        release!()
      }
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

  setProxy(proxy: string | TProxyAgents): TOrError {
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
