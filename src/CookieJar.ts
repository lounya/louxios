export default class CookieJar {
  private cookies: Map<string, string> = new Map()

  public setCookie(name: string, value: string): void {
    this.cookies.set(name, value)
  }

  public setCookies(cookies: string[]): void {
    cookies
      .map((cookie: string) => cookie.split(';')[0].split('='))
      .forEach(([name, value]) => this.setCookie(name, value))
  }

  public getCookieValue(name: string): string | undefined {
    return this.cookies.get(name)
  }

  public getCookieString(name: string): string | undefined {
    const cookieValue = this.cookies.get(name)

    return cookieValue ? `${name}=${cookieValue}` : undefined
  }

  public deleteCookie(name: string): void {
    this.cookies.delete(name)
  }

  public getCookiesString(): string {
    return Array.from(this.cookies, ([name, value]) => `${name}=${value}`)
      .join('; ')
      .trim()
  }

  public getCookiesArray(): string[] {
    return Array.from(this.cookies, ([name, value]) => `${name}=${value}`)
  }
}
