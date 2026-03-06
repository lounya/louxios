import { describe, test, expect } from 'vitest'
import { ErrorBase, LouxiosError, ELouxiosError } from '../src/errors'

describe('ErrorBase', () => {
  test('stores caller, message, and cause', () => {
    const cause = new Error('original')
    const error = new ErrorBase('TestCaller', 'something broke', cause)

    expect(error.caller).toBe('TestCaller')
    expect(error.message).toBe('something broke')
    expect(error.cause).toBe(cause)
  })

  test('is an instance of Error', () => {
    const error = new ErrorBase('Test', 'msg', null)
    expect(error).toBeInstanceOf(Error)
  })

  test('captures a stack trace', () => {
    const error = new ErrorBase('Test', 'msg', null)
    expect(error.stack).toBeTruthy()
    expect(typeof error.stack).toBe('string')
  })

  test('toString includes caller, message, stack, and cause', () => {
    const error = new ErrorBase('MyCaller', 'test message', { detail: 'info' })
    const str = error.toString()

    expect(str).toContain('MyCaller error: test message')
    expect(str).toContain('[stack]:')
    expect(str).toContain('[cause]:')
    expect(str).toContain('detail')
  })

  test('causeToString limits inspection depth', () => {
    const deepCause = { l0: { l1: { l2: { l3: { l4: { l5: { l6: 'hidden' } } } } } } }
    const error = new ErrorBase('Test', 'msg', deepCause)
    const str = error.causeToString()

    expect(str).toContain('l0')
    expect(str).toContain('l4')
    expect(str).not.toContain('hidden')
  })

  test('handles null cause', () => {
    const error = new ErrorBase('Test', 'msg', null)
    expect(error.causeToString()).toBe('null')
  })
})

describe('LouxiosError', () => {
  test('sets caller to Louxios', () => {
    const error = new LouxiosError('test', null)
    expect(error.caller).toBe('Louxios')
  })

  test('is an instance of ErrorBase', () => {
    const error = new LouxiosError('test', null)
    expect(error).toBeInstanceOf(ErrorBase)
    expect(error).toBeInstanceOf(Error)
  })

  test('works with ELouxiosError enum values', () => {
    const error = new LouxiosError(ELouxiosError.FatalRequestError, null)
    expect(error.message).toBe(ELouxiosError.FatalRequestError)
  })
})
