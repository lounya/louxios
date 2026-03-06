# louxios

Axios wrapper that handles cookies, proxies, and rate limiting so you don't have to.

Built this because I got tired of wiring up `tough-cookie` + proxy agents + request throttling every time I needed an HTTP client that behaves more like a browser session. It manages a cookie jar internally, follows redirects while preserving cookies across them, and optionally limits concurrent requests with a semaphore.

## Install

```bash
npm install @lounya/louxios axios
```

`axios` is a peer dependency, bring your own version (^1.0.0).

## Quick start

```typescript
import Louxios from '@lounya/louxios'

const client = new Louxios()

const result = await client.get('https://example.com/api/data')

if (result.isErr()) {
  console.error(result.error.toString())
} else {
  console.log(result.value.data)
}
```

Cookies are stored and sent automatically on subsequent requests, no setup needed.

## Error handling

Requests never throw. Every method returns a `Result<AxiosResponse, LouxiosError>` from [neverthrow](https://github.com/supermacro/neverthrow), so you always handle errors explicitly:

```typescript
const result = await client.post('https://example.com/login', {
  data: { user: 'me', pass: 'secret' },
})

if (result.isErr()) {
  // result.error is a LouxiosError with stack trace and cause
  return
}

// result.value is a normal AxiosResponse
const { data, status, headers } = result.value
```

Two error cases are distinguished via `ELouxiosError`:
- `FatalRequestError` - network failure, timeout, DNS resolution, etc.
- `WrongStatusCodeReceived` - the request completed but the status code didn't pass validation (2xx by default)

## Proxies

Pass a proxy URL string or pre-built agents:

```typescript
// HTTP/HTTPS proxy
const client = new Louxios({
  proxy: 'http://user:pass@proxy.example.com:8080',
})

// SOCKS proxy
const client = new Louxios({
  proxy: 'socks5://proxy.example.com:1080',
})
```

Supported protocols: `http`, `https`, `socks`, `socks4`, `socks5`.

You can also swap proxies at runtime:

```typescript
const result = client.setProxy('http://new-proxy:8080')
if (result.isErr()) {
  // invalid proxy URL
}
```

## Rate limiting

Use the semaphore to limit concurrent requests and add delays between them:

```typescript
const client = new Louxios({
  useSemaphore: true,
  simultaneousRequests: 3,   // max 3 concurrent requests
  timeoutBetweenRequests: 500, // 500ms cooldown per slot after each request
})
```

Useful when you're hitting APIs with rate limits and don't want to deal with 429s manually.

## Redirects

Redirects are followed automatically (up to 10 by default) with proper cookie handling at each hop. The client correctly downgrades POST/PUT/PATCH to GET on 301/302/303 responses, matching browser behavior.

```typescript
// override redirect limit globally
const client = new Louxios({ maxRedirects: 5 })

// or per-request
await client.get('https://example.com', { maxRedirects: 0 })
```

## Status validation

By default, only 2xx responses are considered successful. You can customize this:

```typescript
const client = new Louxios({
  validateStatus: (status) => status < 500, // treat 4xx as success too
})
```

Per-request override works too, just pass `validateStatus` in the request config.

## Config

The constructor accepts all [axios config options](https://axios-http.com/docs/req_config) (except `withCredentials` and the built-in `proxy`, which are managed internally), plus:

| Option | Type | Description |
|---|---|---|
| `proxy` | `string \| TProxyAgents` | Proxy URL or custom agents |
| `useSemaphore` | `boolean` | Enable request throttling |
| `simultaneousRequests` | `number` | Max concurrent requests (required if semaphore enabled) |
| `timeoutBetweenRequests` | `number` | Delay in ms after each request per slot (required if semaphore enabled) |
| `maxRedirects` | `number` | Max redirect hops (default: 10) |
| `validateStatus` | `(status: number) => boolean` | Custom status validation |

## API

### `new Louxios(config?)`

Creates a new client instance with its own cookie jar.

### `.get<T>(url, config?)` / `.post<T>(url, config?)`

Convenience methods. Return `Promise<Result<AxiosResponse<T>, LouxiosError>>`.

### `.request<T>(config)`

Low-level method, takes a full `AxiosRequestConfig`.

### `.setProxy(proxy)`

Set or change proxy at runtime. Returns `Result<null, ErrorBase>`.

### `.getAgent(type)`

Get the current HTTP or HTTPS agent. Returns the agent or `undefined`.

## License

MIT
