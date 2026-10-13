import { Hono, Context } from 'hono'
import { DatabaseService } from '../db'
import { ConfigService } from '../config'
import { UploadService } from '../uploads'

type Services = {
  db: DatabaseService
  config: ConfigService
  uploads: UploadService
}

function svc(c: Context): Services {
  return {
    db: c.get('db'),
    config: c.get('config'),
    uploads: c.get('uploads'),
  }
}

export const apiRoutes = new Hono<{
  Variables: Services
}>()

apiRoutes.get('/version', async (c) => {
  const { db, config } = svc(c)
  const version = await db.getVersion()
  const base = await config.getSecretPath()
  return c.json({ version, base })
})

apiRoutes.get('/state', async (c) => {
  const { db, config } = svc(c)
  const data = await db.getState()
  const base = await config.getSecretPath()
  return c.json({ ...data, base })
})

// ---- Settings ----
apiRoutes.put('/settings', async (c) => {
  const { db } = svc(c)
  const body = await c.req.json()
  const settings = await db.updateSettings(body)
  return c.json(settings)
})

apiRoutes.put('/config', async (c) => {
  const { config } = svc(c)
  const body = await c.req.json()
  const p = '/' + String(body.secretPath || '').trim().replace(/^\/+|\/+$/g, '')
  const result = await config.setSecretPath(p)
  return c.json({ base: result })
})

// ---- Upload ----
apiRoutes.post('/upload', async (c) => {
  const { uploads } = svc(c)
  const body = await c.req.json()
  const result = await uploads.upload(body.dataUrl || '')
  return c.json(result)
})

// ---- Products ----
apiRoutes.post('/products', async (c) => {
  const { db } = svc(c)
  const body = await c.req.json()
  const product = await db.createProduct(body)
  return c.json(product)
})

apiRoutes.put('/products/:id', async (c) => {
  const { db } = svc(c)
  const id = c.req.param('id')
  const body = await c.req.json()
  const product = await db.updateProduct(id, body)
  return c.json(product)
})

apiRoutes.delete('/products/:id', async (c) => {
  const { db } = svc(c)
  const id = c.req.param('id')
  const result = await db.deleteProduct(id)
  return c.json(result)
})

// ---- Clients ----
apiRoutes.post('/clients', async (c) => {
  const { db } = svc(c)
  const body = await c.req.json()
  const client = await db.createClient(body)
  return c.json(client)
})

apiRoutes.put('/clients/:id', async (c) => {
  const { db } = svc(c)
  const id = c.req.param('id')
  const body = await c.req.json()
  const client = await db.updateClient(id, body)
  return c.json(client)
})

apiRoutes.delete('/clients/:id', async (c) => {
  const { db } = svc(c)
  const id = c.req.param('id')
  const result = await db.deleteClient(id)
  return c.json(result)
})

// ---- Movements ----
apiRoutes.post('/movements', async (c) => {
  const { db } = svc(c)
  const body = await c.req.json()
  const result = await db.createMovement(body)
  return c.json(result)
})

// ---- Proformas ----
apiRoutes.post('/proformas', async (c) => {
  const { db } = svc(c)
  const body = await c.req.json()
  const proforma = await db.createProforma(body)
  return c.json(proforma)
})

apiRoutes.put('/proformas/:id', async (c) => {
  const { db } = svc(c)
  const id = c.req.param('id')
  const body = await c.req.json()
  const proforma = await db.updateProforma(id, body)
  return c.json(proforma)
})

apiRoutes.post('/proformas/:id/anular', async (c) => {
  const { db } = svc(c)
  const id = c.req.param('id')
  const proforma = await db.anularProforma(id)
  return c.json(proforma)
})

apiRoutes.post('/proformas/:id/convertir', async (c) => {
  const { db } = svc(c)
  const id = c.req.param('id')
  const body = await c.req.json()
  const invoice = await db.convertProforma(id, body)
  return c.json(invoice)
})

// ---- Invoices ----
apiRoutes.post('/invoices', async (c) => {
  const { db } = svc(c)
  const body = await c.req.json()
  const invoice = await db.createInvoice(body)
  return c.json(invoice)
})

apiRoutes.put('/invoices/:id/status', async (c) => {
  const { db } = svc(c)
  const id = c.req.param('id')
  const body = await c.req.json()
  const invoice = await db.updateInvoiceStatus(id, body)
  return c.json(invoice)
})

// ---- Backup / Restore ----
apiRoutes.get('/backup', async (c) => {
  const { db, uploads } = svc(c)
  const backup = await db.getBackup(uploads)
  return c.json(backup, 200, {
    'Content-Disposition': `attachment; filename="respaldo-aldam-${backup.date.slice(0, 10)}.json"`,
  })
})

apiRoutes.post('/restore', async (c) => {
  const { db, uploads } = svc(c)
  const body = await c.req.json()
  const result = await db.restore(body, uploads)
  return c.json(result)
})
