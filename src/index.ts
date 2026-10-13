import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { initDatabase, DatabaseService } from './db'
import { initConfig, ConfigService } from './config'
import { initUploads, UploadService } from './uploads'
import { apiRoutes } from './routes/api'
import { checkSecretPath } from './middleware/secretPath'

export interface Env {
  DB: D1Database
  UPLOADS: R2Bucket
  CONFIG: KVNamespace
  ASSETS: Fetcher
  SECRET_PATH: string
  TZ: string
}

interface Variables {
  db: DatabaseService
  config: ConfigService
  uploads: UploadService
}

const app = new Hono<{ Bindings: Env, Variables: Variables }>()

app.use('*', cors())

app.use('*', async (c, next) => {
  c.set('db', new DatabaseService(c.env.DB))
  c.set('config', new ConfigService(c.env.CONFIG))
  c.set('uploads', new UploadService(c.env.UPLOADS))
  await next()
})

app.onError((err, c) => {
  const status = (err as any).status || 500
  return c.json({ error: err.message }, status)
})

app.route('/api', apiRoutes)

app.get('/uploads/*', async (c) => {
  const uploads = c.get('uploads')
  const key = c.req.path.slice('/uploads/'.length)
  return uploads.serve(key)
})

app.get('*', async (c) => {
  const url = new URL(c.req.url)
  const res = await c.env.ASSETS.fetch(new Request(url.toString(), c.req))
  if (res && res.status !== 404) return res
  url.pathname = '/index.html'
  const indexRes = await c.env.ASSETS.fetch(new Request(url.toString(), c.req))
  if (indexRes && indexRes.status !== 404) return indexRes
  return c.notFound()
})

const handle: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const config = new ConfigService(env.CONFIG)
    await initConfig(config)

    const dbService = new DatabaseService(env.DB)
    await initDatabase(env.DB)

    const result = await checkSecretPath(request, () => config.getSecretPath())
    if (result instanceof Response) {
      return result
    }

    return app.fetch(result, env, ctx)
  },
}

export default handle
