import { Context, Next } from 'hono'

export function normalizePath(p: string): string {
  return '/' + String(p || '').trim().replace(/^\/+|\/+$/g, '')
}

export async function checkSecretPath(
  request: Request,
  getSecretPath: () => Promise<string>
): Promise<Request | Response> {
  const base = normalizePath(await getSecretPath())
  const url = new URL(request.url)
  const path = url.pathname

  if (path === base) {
    return Response.redirect(url.origin + base + '/', 302)
  }

  if (!path.startsWith(base + '/')) {
    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  }

  url.pathname = path.slice(base.length) || '/'
  return new Request(url, request)
}

export function secretPathMiddleware(configService: { getSecretPath: () => Promise<string> }) {
  return async (c: Context, next: Next) => {
    const base = normalizePath(await configService.getSecretPath())
    const path = c.req.path

    if (path === base) {
      return c.redirect(base + '/')
    }

    if (!path.startsWith(base + '/')) {
      return c.notFound()
    }

    await next()
  }
}
