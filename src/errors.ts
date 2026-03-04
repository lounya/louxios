import util from 'node:util'

export type TOrError<T = unknown> = T | ErrorBase

export class ErrorBase extends Error {
  public override stack: string

  public override message: string

  public caller: string

  public override readonly cause: unknown

  constructor(caller: string, message: string, cause: unknown) {
    super(message)
    this.message = message
    this.cause = cause

    const capturedStack = this.captureStack()
    this.stack = this.getFormattedStack(capturedStack)
    this.caller = caller
  }

  private captureStack(): { stack: string } {
    const errorObj = {} as { stack: string }
    Error.captureStackTrace(errorObj, this.constructor)
    return errorObj
  }

  private getFormattedStack(stackObj: { stack: string }): string {
    if (!stackObj?.stack)
      return ''
    const splitStack = stackObj.stack.split('\n')
    splitStack[0] = splitStack[0].trim()
    return splitStack.join('\n')
  }

  causeToString(): string {
    return util.inspect(this.cause, {
      depth: null,
      maxStringLength: null,
      maxArrayLength: null,
    })
  }

  override toString(): string {
    return `${this.caller} error: ${this.message}
  [stack]: ${this.stack}
  [cause]: ${this.causeToString()}`
  }
}

export function isError(e: unknown): e is ErrorBase {
  return e instanceof ErrorBase
}

export enum ECookieClientError {
  FatalRequestError = 'A fatal error occurred during the HTTP request.',
  WrongStatusCodeReceived = 'Incorrect status code received during the HTTP request.',
}

export class CookieClientError extends ErrorBase {
  constructor(message: string, cause: unknown) {
    super('Cookie Client', message, cause)
  }
}
