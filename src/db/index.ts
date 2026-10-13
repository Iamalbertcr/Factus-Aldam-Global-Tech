import { UploadService } from '../uploads'

export interface IASettings {
  name: string
  slogan: string
  taxId: string
  address: string
  phones: string
  emails: string
  logo: string
  currency: 'CRC' | 'USD'
  iva: number
  proformaPrefix: string
  invoicePrefix: string
  validDays: number
  dueDays: number
  showVideo: boolean
  payInfo: string
  terms: string
}

export interface IAProduct {
  id: string
  code: string
  name: string
  description: string
  category: string
  type: 'producto' | 'servicio'
  cost: number
  price: number
  stock: number
  min: number
  image: string
}

export interface IAClient {
  id: string
  name: string
  taxId: string
  email: string
  phone: string
  address: string
}

export interface IAMovement {
  id: string
  productId: string
  type: 'in' | 'out'
  qty: number
  date: string
  note: string
  ref: string
  stockAfter: number
}

export interface IADocLine {
  productId: string | null
  code: string
  name: string
  qty: number
  price: number
  discPct: number
  total: number
}

export interface IADocument {
  id: string
  number: string
  createdAt: string
  date: string
  clientId: string | null
  client: IAClient | null
  discPct: number
  ivaPct: number
  notes: string
  lines: IADocLine[]
  subtotal: number
  discount: number
  tax: number
  total: number
}

export interface IAProforma extends IADocument {
  status: 'vigente' | 'facturada' | 'anulada'
  validUntil: string
  invoiceId: string | null
  invoiceNumber: string
}

export interface IAInvoice extends IADocument {
  status: 'pendiente' | 'pagada' | 'anulada'
  dueDate: string
  payMethod: string
  proformaId: string | null
  proformaNumber: string
  paidDate: string | null
}

export interface IADatabase {
  version: number
  settings: IASettings
  counters: { proforma: number; invoice: number }
  products: IAProduct[]
  clients: IAClient[]
  movements: IAMovement[]
  proformas: IAProforma[]
  invoices: IAInvoice[]
}

// ---- Helper functions (ported from server.js) ----

export const uid = (): string => crypto.randomUUID().replace(/-/g, '').slice(0, 12)
export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const CR_OFFSET_MS = 6 * 3600 * 1000

export function today(): string {
  const now = new Date()
  const cr = new Date(now.getTime() - CR_OFFSET_MS)
  const y = cr.getUTCFullYear()
  const m = String(cr.getUTCMonth() + 1).padStart(2, '0')
  const d = String(cr.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function addDays(dateStr: string, n: number): string {
  const parts = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0))
  d.setUTCDate(d.getUTCDate() + n)
  return ymd(d)
}

export function normalizePath(p: string): string {
  return '/' + String(p || '').trim().replace(/^\/+|\/+$/g, '')
}

export function calc(d: any, db: IADatabase): any {
  const iva = db.settings.iva
  d.lines = (d.lines || []).map((l: any) => {
    const p = l.productId ? db.products.find(x => x.id === l.productId) : null
    return {
      productId: p ? p.id : null,
      code: p ? p.code : String(l.code || ''),
      name: String(l.name || (p ? p.name : '')),
      qty: Math.max(0, +l.qty || 0),
      price: Math.max(0, +l.price || 0),
      discPct: Math.min(100, Math.max(0, +l.discPct || 0)),
    }
  }).filter((l: any) => l.name && l.qty > 0)

  let sub = 0
  d.lines.forEach((l: any) => {
    l.total = r2(l.qty * l.price * (1 - l.discPct / 100))
    sub += l.total
  })
  d.subtotal = r2(sub)
  d.discPct = Math.min(100, Math.max(0, +d.discPct || 0))
  d.discount = r2(d.subtotal * d.discPct / 100)
  d.ivaPct = isFinite(parseFloat(String(d.ivaPct))) ? Math.max(0, +d.ivaPct) : iva
  d.tax = r2((d.subtotal - d.discount) * d.ivaPct / 100)
  d.total = r2(d.subtotal - d.discount + d.tax)
  return d
}

export function clientSnapshot(id: string | null, clients: IAClient[]): IAClient | null {
  if (!id) return null
  const c = clients.find(x => x.id === id)
  return c ? { ...c } : null
}

export function checkStock(doc: any, products: IAProduct[]): string | null {
  for (const l of doc.lines) {
    const p = products.find(x => x.id === l.productId)
    if (p && p.type === 'producto' && p.stock < l.qty)
      return `Stock insuficiente de "${p.name}" (disponible: ${p.stock}, solicitado: ${l.qty})`
  }
  return null
}

export function applyStock(doc: any, dir: 'in' | 'out', products: IAProduct[], movements: IAMovement[]): void {
  for (const l of doc.lines) {
    const p = products.find(x => x.id === l.productId)
    if (!p || p.type !== 'producto') continue
    p.stock += dir === 'out' ? -l.qty : l.qty
    movements.push({
      id: uid(),
      productId: p.id,
      type: dir,
      qty: l.qty,
      date: new Date().toISOString(),
      note: dir === 'out' ? `Factura ${doc.number}` : `Anulación factura ${doc.number}`,
      ref: doc.number,
      stockAfter: p.stock,
    })
  }
}

export function buildDoc(kind: 'proforma' | 'invoice', b: any, db: IADatabase): any {
  const s = db.settings
  const key = kind === 'invoice' ? 'invoice' : 'proforma'
  const n = ++db.counters[key]
  const prefix = kind === 'invoice' ? s.invoicePrefix : s.proformaPrefix
  const d: any = {
    id: uid(),
    number: prefix + String(n).padStart(6, '0'),
    createdAt: new Date().toISOString(),
    date: b.date || today(),
    clientId: b.clientId || null,
    client: typeof b.client === 'object' ? b.client : clientSnapshot(b.clientId, db.clients),
    discPct: b.discPct,
    ivaPct: b.ivaPct,
    notes: b.notes || '',
    lines: b.lines || [],
  }

  if (kind === 'invoice') {
    Object.assign(d, {
      status: ['pendiente', 'pagada'].includes(b.status) ? b.status : 'pendiente',
      dueDate: b.dueDate || addDays(d.date, s.dueDays || 15),
      payMethod: b.payMethod || 'Efectivo',
      proformaId: b.proformaId || null,
      proformaNumber: b.proformaNumber || '',
      paidDate: b.status === 'pagada' ? today() : null,
    })
  } else {
    Object.assign(d, {
      status: 'vigente' as const,
      validUntil: b.validUntil || addDays(d.date, s.validDays || 15),
      invoiceId: null,
      invoiceNumber: '',
    })
  }

  return calc(d, db)
}

// ---- Seed data ----

export function seed(): IADatabase {
  const products: IAProduct[] = [
    { id: uid(), code: 'RED-001', name: 'Cable UTP Cat6 (metro)', description: 'Cable de red categoría 6, venta por metro', category: 'Redes', type: 'producto', cost: 450, price: 850, stock: 300, min: 50, image: '' },
    { id: uid(), code: 'RED-002', name: 'Switch 8 puertos Gigabit', description: 'Switch no administrable 10/100/1000', category: 'Redes', type: 'producto', cost: 14500, price: 22000, stock: 6, min: 3, image: '' },
    { id: uid(), code: 'RED-003', name: 'Access Point WiFi 6', description: 'Punto de acceso doble banda AX1800', category: 'Redes', type: 'producto', cost: 28000, price: 42000, stock: 5, min: 3, image: '' },
    { id: uid(), code: 'RED-004', name: 'Instalación de punto de red', description: 'Mano de obra por punto de red certificado', category: 'Redes', type: 'servicio', cost: 0, price: 15000, stock: 0, min: 0, image: '' },
    { id: uid(), code: 'CCTV-001', name: 'Cámara IP 4MP exterior', description: 'Cámara bala PoE, visión nocturna', category: 'CCTV', type: 'producto', cost: 21000, price: 34000, stock: 10, min: 4, image: '' },
    { id: uid(), code: 'CCTV-002', name: 'NVR 8 canales', description: 'Grabador de red 8 canales con soporte de disco', category: 'CCTV', type: 'producto', cost: 48000, price: 72000, stock: 3, min: 2, image: '' },
    { id: uid(), code: 'CCTV-003', name: 'Disco duro 2TB videovigilancia', description: 'Disco especial 24/7', category: 'CCTV', type: 'producto', cost: 42000, price: 61000, stock: 1, min: 2, image: '' },
    { id: uid(), code: 'CCTV-004', name: 'Instalación sistema CCTV (por cámara)', description: 'Instalación, cableado y configuración', category: 'CCTV', type: 'servicio', cost: 0, price: 25000, stock: 0, min: 0, image: '' },
    { id: uid(), code: 'SOP-001', name: 'Soporte técnico por hora', description: 'Atención presencial o remota', category: 'Soporte', type: 'servicio', cost: 0, price: 18000, stock: 0, min: 0, image: '' },
    { id: uid(), code: 'SOP-002', name: 'Mantenimiento preventivo PC/Laptop', description: 'Limpieza, optimización y revisión', category: 'Soporte', type: 'servicio', cost: 0, price: 20000, stock: 0, min: 0, image: '' },
    { id: uid(), code: 'SOP-003', name: 'Formateo e instalación de sistema', description: 'Respaldo, instalación de SO y programas', category: 'Soporte', type: 'servicio', cost: 0, price: 25000, stock: 0, min: 0, image: '' },
    { id: uid(), code: 'IMP-001', name: 'Impresora multifuncional tinta continua', description: 'Imprime, escanea y copia', category: 'Impresoras', type: 'producto', cost: 95000, price: 135000, stock: 4, min: 2, image: '' },
    { id: uid(), code: 'IMP-002', name: 'Tinta original (juego 4 colores)', description: 'Botellas de tinta para sistema continuo', category: 'Impresoras', type: 'producto', cost: 7000, price: 12500, stock: 12, min: 5, image: '' },
    { id: uid(), code: 'IMP-003', name: 'Mantenimiento de impresora', description: 'Limpieza de cabezales y revisión general', category: 'Impresoras', type: 'servicio', cost: 0, price: 22000, stock: 0, min: 0, image: '' },
  ]

  const clients: IAClient[] = [
    { id: uid(), name: 'Juan Pérez Mora', taxId: '1-0123-0456', email: 'juan.perez@example.com', phone: '+506 8888 1111', address: 'San José, Costa Rica' },
    { id: uid(), name: 'Supermercado La Esperanza S.A.', taxId: '3-101-123456', email: 'compras@laesperanza.example.com', phone: '+506 2222 3333', address: 'Alajuela, Costa Rica' },
    { id: uid(), name: 'Clínica Dental Sonrisas', taxId: '3-102-654321', email: 'admin@sonrisas.example.com', phone: '+506 2440 5555', address: 'Heredia, Costa Rica' },
    { id: uid(), name: 'María Rodríguez Vargas', taxId: '2-0456-0789', email: 'maria.rv@example.com', phone: '+506 7000 2222', address: 'Cartago, Costa Rica' },
    { id: uid(), name: 'Luis Quesada Ramírez', taxId: '2-0666-1122', email: 'luis.quesada@example.com', phone: '+506 6090 2211', address: 'Heredia, Costa Rica' },
    { id: uid(), name: 'Soluciones Retail CR S.A.', taxId: '3-102-445577', email: 'info@solucionesretail.example.com', phone: '+506 2555 8899', address: 'Alajuela, Costa Rica' },
  ]

  const movements: IAMovement[] = []
  products.forEach(p => {
    if (p.type === 'producto' && p.stock > 0)
      movements.push({ id: uid(), productId: p.id, type: 'in', qty: p.stock, date: new Date(Date.now() - 45 * 864e5).toISOString(), note: 'Compra inicial a proveedor', ref: '', stockAfter: p.stock })
  })

  const D = (n: number) => addDays(today(), n)

  const proformas: IAProforma[] = []
  const invoices: IAInvoice[] = []

  // Helper to create invoice
  const mkInv = (b: any): IAInvoice => {
    const inv = buildDoc('invoice', b, {
      version: 1,
      settings: { name: products[0].name, slogan: '', taxId: '', address: '', phones: '', emails: '', logo: '', currency: 'CRC', iva: 13, proformaPrefix: 'PF-', invoicePrefix: 'FA-', validDays: 15, dueDays: 15, showVideo: true, payInfo: '', terms: '' } as any,
      counters: { proforma: 0, invoice: 0 },
      products, clients, movements, proformas, invoices,
    } as IADatabase)
    return inv
  }

  // Since buildDoc uses the db's counters, we need a different approach for seed
  // Let's set up the db state first and then build documents

  const db: IADatabase = {
    version: 1,
    settings: {
      name: 'ALDAM GLOBAL TECH', slogan: 'Técnicos en Tecnologías de la Información',
      taxId: 'Cédula jurídica: 3-101-000000', address: 'Costa Rica',
      phones: '+506 6260 3942 · +506 6370 1764', emails: 'dani_machadoten@hotmail.com · hidalgoalberto45@gmail.com',
      logo: '', currency: 'CRC', iva: 13, proformaPrefix: 'PF-', invoicePrefix: 'FA-',
      validDays: 15, dueDays: 15, showVideo: true,
      payInfo: 'SINPE Móvil: +506 6260 3942 · Transferencia bancaria: solicitar datos por correo.',
      terms: 'Garantía de productos según fabricante. Los servicios cuentan con 30 días de garantía sobre la mano de obra. Precios sujetos a cambio sin previo aviso. ¡Gracias por confiar en ALDAM GLOBAL TECH!',
    },
    counters: { proforma: 0, invoice: 0 },
    products, clients, movements, proformas, invoices,
  }

  // Build sample invoices
  const inv1 = buildDoc('invoice', {
    clientId: clients[1].id, payMethod: 'Transferencia', status: 'pendiente', date: D(-5), dueDate: D(10),
    lines: [{ productId: products[4].id, qty: 4, price: 34000 }, { productId: products[5].id, qty: 1, price: 72000 }, { productId: products[7].id, qty: 4, price: 25000 }],
  }, db)
  applyStock(inv1, 'out', products, movements)
  db.invoices.push(inv1)

  const inv2 = buildDoc('invoice', {
    clientId: clients[0].id, payMethod: 'Efectivo', status: 'pagada', date: D(-1), dueDate: D(14),
    lines: [{ productId: products[1].id, qty: 1, price: 22000 }, { productId: products[3].id, qty: 2, price: 15000 }, { productId: products[8].id, qty: 2, price: 18000 }],
  }, db)
  applyStock(inv2, 'out', products, movements)
  db.invoices.push(inv2)

  const inv3 = buildDoc('invoice', {
    clientId: clients[2].id, payMethod: 'Tarjeta', status: 'pagada', date: D(-12), dueDate: D(27),
    lines: [{ productId: products[2].id, qty: 2, price: 42000 }, { productId: products[3].id, qty: 3, price: 15000 }, { productId: products[12].id, qty: 2, price: 12500 }],
  }, db)
  applyStock(inv3, 'out', products, movements)
  db.invoices.push(inv3)

  const inv4 = buildDoc('invoice', {
    clientId: clients[3].id, payMethod: 'SINPE Móvil', status: 'pagada', date: D(-35), dueDate: D(-20),
    lines: [{ productId: products[11].id, qty: 1, price: 135000 }, { productId: products[9].id, qty: 1, price: 20000 }, { productId: products[0].id, qty: 100, price: 850 }],
  }, db)
  applyStock(inv4, 'out', products, movements)
  db.invoices.push(inv4)

  const invAnu = buildDoc('invoice', {
    clientId: clients[1].id, payMethod: 'SINPE Móvil', status: 'pagada', date: D(-40), dueDate: D(-25),
    lines: [{ productId: products[6].id, qty: 1, price: 61000 }, { productId: products[13].id, qty: 1, price: 22000 }],
  }, db)
  applyStock(invAnu, 'out', products, movements)
  applyStock(invAnu, 'in', products, movements)
  invAnu.status = 'anulada'
  db.invoices.push(invAnu)

  // Build sample proformas
  const pf1 = buildDoc('proforma', {
    clientId: clients[2].id, date: today(), validUntil: D(15), notes: 'Incluye configuración y capacitación básica.',
    lines: [{ productId: products[2].id, qty: 3, price: 42000 }, { productId: products[3].id, qty: 3, price: 15000 }],
  }, db)
  db.proformas.push(pf1)

  const pf2 = buildDoc('proforma', {
    clientId: clients[3].id, date: D(-3), validUntil: D(12), notes: 'Precio especial por volumen.',
    lines: [{ productId: products[0].id, qty: 200, price: 850 }, { productId: products[13].id, qty: 1, price: 22000 }],
  }, db)
  db.proformas.push(pf2)

  const pfAnu = buildDoc('proforma', {
    clientId: clients[4].id, date: D(-8), validUntil: D(7), notes: '',
    lines: [{ productId: products[1].id, qty: 2, price: 22000 }],
  }, db)
  pfAnu.status = 'anulada'
  db.proformas.push(pfAnu)

  return db
}

// ---- DatabaseService ----

export class DatabaseService {
  private db: D1Database
  private initialized = false

  constructor(db: D1Database) {
    this.db = db
  }

  async init(): Promise<void> {
    if (this.initialized) return
    await this.db.prepare(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)`).run()
    this.initialized = true
  }

  async ensureSeeded(): Promise<void> {
    const row = await this.db.prepare('SELECT value FROM kv WHERE key = ?').bind('db').first()
    if (!row) {
      const data = seed()
      await this.db.prepare('INSERT INTO kv (key, value) VALUES (?, ?)')
        .bind('db', JSON.stringify(data))
        .run()
    }
  }

  async load(): Promise<IADatabase> {
    const row = await this.db.prepare('SELECT value FROM kv WHERE key = ?').bind('db').first<{ value: string }>()
    if (!row) {
      const data = seed()
      await this.db.prepare('INSERT INTO kv (key, value) VALUES (?, ?)')
        .bind('db', JSON.stringify(data))
        .run()
      return data
    }
    return JSON.parse(row.value)
  }

  async save(data: IADatabase): Promise<void> {
    data.version = (data.version || 0) + 1
    await this.db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)')
      .bind('db', JSON.stringify(data))
      .run()
  }

  async getVersion(): Promise<number> {
    const data = await this.load()
    return data.version
  }

  async getState(): Promise<IADatabase> {
    return await this.load()
  }

  async getSettings(): Promise<IASettings> {
    const data = await this.load()
    return data.settings
  }

  async updateSettings(fields: Record<string, any>): Promise<IASettings> {
    const data = await this.load()
    const s = data.settings
    const stringFields = ['name', 'slogan', 'taxId', 'address', 'phones', 'emails', 'logo', 'proformaPrefix', 'invoicePrefix', 'payInfo', 'terms']
    stringFields.forEach(k => { if (typeof fields[k] === 'string') (s as any)[k] = fields[k] })
    ;['iva', 'validDays', 'dueDays'].forEach(k => { if (isFinite(parseFloat(fields[k]))) (s as any)[k] = +fields[k] })
    if (typeof fields.showVideo === 'boolean') s.showVideo = fields.showVideo
    if (!['CRC', 'USD'].includes(s.currency)) s.currency = 'CRC'
    await this.save(data)
    return s
  }

  // ---- Products ----
  async createProduct(body: any): Promise<IAProduct> {
    const data = await this.load()
    const o: any = { id: uid() }
    const fields = [{ k: 'code' }, { k: 'name' }, { k: 'description' }, { k: 'category' }, { k: 'type' }, { k: 'image' },
      { k: 'cost', t: 'n' }, { k: 'price', t: 'n' }, { k: 'stock', t: 'n' }, { k: 'min', t: 'n' }]
    fields.forEach(k => { o[k.k] = k.t === 'n' ? Math.max(0, +body[k.k] || 0) : String(body[k.k] || '').trim() })
    if (!o.name) throw Object.assign(new Error('El nombre es obligatorio'), { status: 400 })
    if (!['producto', 'servicio'].includes(o.type)) o.type = 'producto'
    if (!o.code) o.code = 'P-' + String(data.products.length + 1).padStart(4, '0')
    if (data.products.some(p => p.code.toLowerCase() === o.code.toLowerCase())) throw Object.assign(new Error('Ya existe un producto con ese código'), { status: 400 })
    if (o.type === 'servicio') { o.stock = 0; o.min = 0 }
    data.products.push(o)
    if (o.type === 'producto' && o.stock > 0)
      data.movements.push({ id: uid(), productId: o.id, type: 'in', qty: o.stock, date: new Date().toISOString(), note: 'Stock inicial', ref: '', stockAfter: o.stock })
    await this.save(data)
    return o
  }

  async updateProduct(id: string, body: any): Promise<IAProduct> {
    const data = await this.load()
    const o = data.products.find(p => p.id === id)
    if (!o) throw Object.assign(new Error('No encontrado'), { status: 404 })
    const copy: any = { ...o }
    const fields = [{ k: 'code' }, { k: 'name' }, { k: 'description' }, { k: 'category' }, { k: 'type' }, { k: 'image' },
      { k: 'cost', t: 'n' }, { k: 'price', t: 'n' }, { k: 'stock', t: 'n' }, { k: 'min', t: 'n' }]
    fields.forEach(k => { if (k.k in body) copy[k.k] = k.t === 'n' ? Math.max(0, +body[k.k] || 0) : String(body[k.k] || '').trim() })
    if (!copy.name) throw Object.assign(new Error('El nombre es obligatorio'), { status: 400 })
    if (!['producto', 'servicio'].includes(copy.type)) copy.type = 'producto'
    if (!copy.code) copy.code = 'P-' + String(data.products.length + 1).padStart(4, '0')
    if (data.products.some(p => p.code.toLowerCase() === copy.code.toLowerCase() && p.id !== id)) throw Object.assign(new Error('Ya existe un producto con ese código'), { status: 400 })
    if (copy.type === 'servicio') { copy.stock = 0; copy.min = 0 }
    if (copy.stock !== o.stock && copy.type === 'producto')
      data.movements.push({ id: uid(), productId: o.id, type: copy.stock > o.stock ? 'in' : 'out', qty: Math.abs(copy.stock - o.stock), date: new Date().toISOString(), note: 'Ajuste manual', ref: '', stockAfter: copy.stock })
    Object.assign(o, copy)
    await this.save(data)
    return o
  }

  async deleteProduct(id: string): Promise<{ ok: true }> {
    const data = await this.load()
    const o = data.products.find(p => p.id === id)
    if (!o) throw Object.assign(new Error('No encontrado'), { status: 404 })
    data.products = data.products.filter(p => p.id !== id)
    data.movements = data.movements.filter(m => m.productId !== id)
    await this.save(data)
    return { ok: true }
  }

  // ---- Clients ----
  async createClient(body: any): Promise<IAClient> {
    const data = await this.load()
    const o: any = { id: uid() }
    ;['name', 'taxId', 'email', 'phone', 'address'].forEach(k => { o[k] = String(body[k] || '').trim() })
    if (!o.name) throw Object.assign(new Error('El nombre es obligatorio'), { status: 400 })
    data.clients.push(o)
    await this.save(data)
    return o
  }

  async updateClient(id: string, body: any): Promise<IAClient> {
    const data = await this.load()
    const o = data.clients.find(c => c.id === id)
    if (!o) throw Object.assign(new Error('No encontrado'), { status: 404 })
    ;['name', 'taxId', 'email', 'phone', 'address'].forEach(k => { if (k in body) (o as any)[k] = String((body as any)[k] || '').trim() })
    if (!o.name) throw Object.assign(new Error('El nombre es obligatorio'), { status: 400 })
    await this.save(data)
    return o
  }

  async deleteClient(id: string): Promise<{ ok: true }> {
    const data = await this.load()
    if (!data.clients.find(c => c.id === id)) throw Object.assign(new Error('No encontrado'), { status: 404 })
    data.clients = data.clients.filter(c => c.id !== id)
    await this.save(data)
    return { ok: true }
  }

  // ---- Movements ----
  async createMovement(body: any): Promise<{ ok: true }> {
    const data = await this.load()
    const p = data.products.find(p => p.id === body.productId)
    if (!p) throw Object.assign(new Error('No encontrado'), { status: 404 })
    if (p.type !== 'producto') throw Object.assign(new Error('Los servicios no manejan inventario'), { status: 400 })
    const qty = +body.qty
    const type = body.type === 'out' ? 'out' : 'in'
    if (!(qty > 0)) throw Object.assign(new Error('Cantidad inválida'), { status: 400 })
    if (type === 'out' && p.stock < qty) throw Object.assign(new Error('No hay stock suficiente'), { status: 400 })
    p.stock += type === 'out' ? -qty : qty
    data.movements.push({ id: uid(), productId: p.id, type, qty, date: new Date().toISOString(), note: String(body.note || (type === 'in' ? 'Compra' : 'Salida')), ref: '', stockAfter: p.stock })
    await this.save(data)
    return { ok: true }
  }

  // ---- Proformas ----
  async createProforma(body: any): Promise<any> {
    const data = await this.load()
    const d = buildDoc('proforma', body, data)
    if (!d.lines.length) { data.counters.proforma--; throw Object.assign(new Error('Agregue al menos un artículo'), { status: 400 }) }
    data.proformas.push(d)
    await this.save(data)
    return d
  }

  async updateProforma(id: string, body: any): Promise<any> {
    const data = await this.load()
    const d = data.proformas.find(p => p.id === id)
    if (!d) throw Object.assign(new Error('No encontrado'), { status: 404 })
    if (d.status !== 'vigente') throw Object.assign(new Error('Solo se pueden editar proformas vigentes'), { status: 400 })
    Object.assign(d, {
      date: body.date || d.date, validUntil: body.validUntil || d.validUntil, notes: body.notes || '',
      clientId: body.clientId || null, client: clientSnapshot(body.clientId, data.clients),
      discPct: body.discPct, ivaPct: body.ivaPct, lines: body.lines,
    })
    calc(d, data)
    if (!d.lines.length) throw Object.assign(new Error('Agregue al menos un artículo'), { status: 400 })
    await this.save(data)
    return d
  }

  async anularProforma(id: string): Promise<any> {
    const data = await this.load()
    const d = data.proformas.find(p => p.id === id)
    if (!d) throw Object.assign(new Error('No encontrado'), { status: 404 })
    if (d.status === 'facturada') throw Object.assign(new Error('La proforma ya fue convertida en factura'), { status: 400 })
    d.status = 'anulada'
    await this.save(data)
    return d
  }

  async convertProforma(id: string, body: any): Promise<any> {
    const data = await this.load()
    const p = data.proformas.find(p => p.id === id)
    if (!p) throw Object.assign(new Error('No encontrado'), { status: 404 })
    if (p.status !== 'vigente') throw Object.assign(new Error('Solo se pueden convertir proformas vigentes'), { status: 400 })
    const err = checkStock({ lines: p.lines }, data.products)
    if (err) throw Object.assign(new Error(err), { status: 400 })
    const inv = buildDoc('invoice', {
      clientId: p.clientId, discPct: p.discPct, ivaPct: p.ivaPct, notes: p.notes, lines: p.lines,
      payMethod: body.payMethod, status: body.status, proformaId: p.id, proformaNumber: p.number,
    }, data)
    applyStock(inv, 'out', data.products, data.movements)
    data.invoices.push(inv)
    p.status = 'facturada'
    p.invoiceId = inv.id
    p.invoiceNumber = inv.number
    await this.save(data)
    return inv
  }

  // ---- Invoices ----
  async createInvoice(body: any): Promise<any> {
    const data = await this.load()
    const probe = calc({ lines: body.lines }, data)
    if (!probe.lines.length) throw Object.assign(new Error('Agregue al menos un artículo'), { status: 400 })
    const err = checkStock(probe, data.products)
    if (err) throw Object.assign(new Error(err), { status: 400 })
    const inv = buildDoc('invoice', body, data)
    applyStock(inv, 'out', data.products, data.movements)
    data.invoices.push(inv)
    await this.save(data)
    return inv
  }

  async updateInvoiceStatus(id: string, body: any): Promise<any> {
    const data = await this.load()
    const d = data.invoices.find(i => i.id === id)
    if (!d) throw Object.assign(new Error('No encontrado'), { status: 404 })
    const st = body.status
    if (!['pendiente', 'pagada', 'anulada'].includes(st)) throw Object.assign(new Error('Estado inválido'), { status: 400 })
    if (d.status === 'anulada') throw Object.assign(new Error('Una factura anulada no se puede reactivar'), { status: 400 })
    if (st === 'anulada') applyStock(d, 'in', data.products, data.movements)
    d.status = st
    d.paidDate = st === 'pagada' ? today() : null
    if (body.payMethod) d.payMethod = body.payMethod
    await this.save(data)
    return d
  }

  // ---- Backup / Restore ----
  async getBackup(uploadService: UploadService | null): Promise<any> {
    const data = await this.load()
    const files: Record<string, string> = {}
    if (uploadService) {
      const list = await uploadService.list()
      for (const { key } of list) {
        const obj = await uploadService.getObject(key)
        if (obj) {
          const buffer = await obj.arrayBuffer()
          const ext = key.split('.').pop() || 'png'
          const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
          files[key] = `data:${mimeType};base64,${base64}`
        }
      }
    }
    return { app: 'aldam-sistema', date: new Date().toISOString(), db: data, files }
  }

  async restore(data: any, uploadService: UploadService | null): Promise<{ ok: true }> {
    if (!data || data.app !== 'aldam-sistema' || !data.db || !Array.isArray(data.db.products))
      throw Object.assign(new Error('Archivo de respaldo inválido'), { status: 400 })

    // Save current state as a backup marker
    const current = await this.load()
    await this.db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)')
      .bind('backup-before-restore', JSON.stringify(current))
      .run()

    // Restore files to R2
    if (data.files && uploadService) {
      for (const [name, url] of Object.entries(data.files)) {
        if (!/^[\w.-]+\.(png|jpg|webp|gif)$/.test(String(name))) continue
        try {
          await uploadService.putObject(name, String(url))
        } catch (e) {
          // Skip invalid files
        }
      }
    }

    // Restore db state
    const restored = data.db as IADatabase
    restored.version = (current.version || 0) + 1
    await this.db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)')
      .bind('db', JSON.stringify(restored))
      .run()

    return { ok: true }
  }
}

export async function initDatabase(db: D1Database): Promise<DatabaseService> {
  const service = new DatabaseService(db)
  await service.init()
  await service.ensureSeeded()
  return service
}
