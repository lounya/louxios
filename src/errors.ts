import util from 'node:util'

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
    if (splitStack[0]?.trim() === 'Error')
      splitStack.shift()
    if (splitStack[0] != null)
      splitStack[0] = splitStack[0].trim()
    return splitStack.join('\n')
  }

  causeToString(): string {
    return util.inspect(this.cause, {
      depth: 4,
      maxStringLength: 1024,
      maxArrayLength: 20,
    })
  }

  override toString(): string {
    return `${this.caller} error: ${this.message}
  [stack]: ${this.stack}
  [cause]: ${this.causeToString()}`
  }
}
export enum ELouxiosError {
  FatalRequestError = 'A fatal error occurred during the HTTP request.',
  WrongStatusCodeReceived = 'Incorrect status code received during the HTTP request.',
}

export class LouxiosError extends ErrorBase {
  constructor(message: string, cause: unknown) {
    super('Louxios', message, cause)
  }
}
