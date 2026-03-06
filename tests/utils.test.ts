import { afterEach, describe, expect, it, vi } from 'vitest'
import { sleep } from '../src/utils'

describe('sleep', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves after the specified delay', async () => {
    vi.useFakeTimers()

    let resolved = false
    const promise = sleep(100).then(() => {
      resolved = true
    })

    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(99)
    expect(resolved).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)

    await promise
  })

  it('resolves immediately with 0ms delay', async () => {
    vi.useFakeTimers()

    let resolved = false
    const promise = sleep(0).then(() => {
      resolved = true
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(resolved).toBe(true)

    await promise
  })
})
