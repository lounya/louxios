import type { CreateAxiosDefaults } from 'axios'
import type { TProxyAgents } from './proxy'

export type TInitialConfig = Partial<
  Omit<CreateAxiosDefaults, 'withCredentials' | 'proxy'> & {
    proxy?: TProxyAgents | string
    useSemaphore?: boolean
  }
>
& (
  | {
    useSemaphore?: false | never
    timeoutBetweenRequests?: never
    simultaneousRequests?: never
  }
  | {
    useSemaphore: true
    timeoutBetweenRequests: number
    simultaneousRequests: number
  }
)
