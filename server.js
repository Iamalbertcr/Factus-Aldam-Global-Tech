/**
 * ALDAM GLOBAL TECH - Sistema de Inventario, FacturaciÃ³n y Proformas
 * Backend ligero: Node.js + Express. Datos en un archivo JSON dentro de /data.
 *
 * - Acceso solo por la URL secreta (ver data/config.json -> secretPath).
 * - Sin login. Cualquier otra ruta responde 404.
 * - Los datos se guardan en el servidor: data/db.json (+ imÃ¡genes en data/uploads).
 */
process.env.TZ = process.env.TZ || 'America/Costa_Rica'; // fechas locales correctas
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const BACKUPS = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const CFG_FILE = path.join(DATA_DIR, 'config.json');
[DATA_DIR, UPLOADS, BACKUPS].forEach(d => fs.mkdirSync(d, { recursive: true }));

/* ---------- ConfiguraciÃ³n (URL secreta) ---------- */
function normPath(p) { return '/' + String(p || '').trim().replace(/^\/+|\/+$/g, ''); }
let config;
if (fs.existsSync(CFG_FILE)) config = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));
else {
  config = { secretPath: normPath(process.env.SECRET_PATH || '/sistema') };
  fs.writeFileSync(CFG_FILE, JSON.stringify(config, null, 2));
}
const getBase = () => normPath(config.secretPath);

/* ---------- Base de datos JSON ---------- */
const uid = () => crypto.randomBytes(6).toString('hex');
const r2 = n => Math.round((+n + Number.EPSILON) * 100) / 100;
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return ymd(x); };

let db;
let saveTimer = null;
function save() {
  db.version = (db.version || 0) + 1;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 150);
}
function flush() {
  clearTimeout(saveTimer);
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE); // escritura atÃ³mica
  dailyBackup();
}
function dailyBackup() {
  const f = path.join(BACKUPS, `auto-${today()}.json`);
  if (fs.existsSync(f)) return;
  fs.copyFileSync(DB_FILE, f);
  const files = fs.readdirSync(BACKUPS).filter(n => n.startsWith('auto-')).sort();
  files.slice(0, Math.max(0, files.length - 14)).forEach(n => fs.unlinkSync(path.join(BACKUPS, n)));
}

function seed() {
  // Logo de ejemplo
  let logo = '';
  const lp = path.join(__dirname, 'seed', 'logo.png');
  if (fs.existsSync(lp)) { fs.copyFileSync(lp, path.join(UPLOADS, 'logo.png')); logo = 'uploads/logo.png'; }
  const P = (code, name, description, category, type, cost, price, stock, min) =>
    ({ id: uid(), code, name, description, category, type, cost, price, stock, min, image: '' });
  const products = [
    P('RED-001', 'Cable UTP Cat6 (metro)', 'Cable de red categorÃ­a 6, venta por metro', 'Redes', 'producto', 450, 850, 300, 50),
    P('RED-002', 'Switch 8 puertos Gigabit', 'Switch no administrable 10/100/1000', 'Redes', 'producto', 14500, 22000, 6, 3),
    P('RED-003', 'Access Point WiFi 6', 'Punto de acceso doble banda AX1800', 'Redes', 'producto', 28000, 42000, 5, 3),
    P('RED-004', 'InstalaciÃ³n de punto de red', 'Mano de obra por punto de red certificado', 'Redes', 'servicio', 0, 15000, 0, 0),
    P('CCTV-001', 'CÃ¡mara IP 4MP exterior', 'CÃ¡mara bala PoE, visiÃ³n nocturna', 'CCTV', 'producto', 21000, 34000, 10, 4),
    P('CCTV-002', 'NVR 8 canales', 'Grabador de red 8 canales con soporte de disco', 'CCTV', 'producto', 48000, 72000, 3, 2),
    P('CCTV-003', 'Disco duro 2TB videovigilancia', 'Disco especial 24/7', 'CCTV', 'producto', 42000, 61000, 1, 2),
    P('CCTV-004', 'InstalaciÃ³n sistema CCTV (por cÃ¡mara)', 'InstalaciÃ³n, cableado y configuraciÃ³n', 'CCTV', 'servicio', 0, 25000, 0, 0),
    P('SOP-001', 'Soporte tÃ©cnico por hora', 'AtenciÃ³n presencial o remota', 'Soporte', 'servicio', 0, 18000, 0, 0),
    P('SOP-002', 'Mantenimiento preventivo PC/Laptop', 'Limpieza, optimizaciÃ³n y revisiÃ³n', 'Soporte', 'servicio', 0, 20000, 0, 0),
    P('SOP-003', 'Formateo e instalaciÃ³n de sistema', 'Respaldo, instalaciÃ³n de SO y programas', 'Soporte', 'servicio', 0, 25000, 0, 0),
    P('IMP-001', 'Impresora multifuncional tinta continua', 'Imprime, escanea y copia', 'Impresoras', 'producto', 95000, 135000, 4, 2),
    P('IMP-002', 'Tinta original (juego 4 colores)', 'Botellas de tinta para sistema continuo', 'Impresoras', 'producto', 7000, 12500, 12, 5),
    P('IMP-003', 'Mantenimiento de impresora', 'Limpieza de cabezales y revisiÃ³n general', 'Impresoras', 'servicio', 0, 22000, 0, 0),
  ];
  const clients = [
    { id: uid(), name: 'Juan PÃ©rez Mora', taxId: '1-0123-0456', email: 'juan.perez@example.com', phone: '+506 8888 1111', address: 'San JosÃ©, Costa Rica' },
    { id: uid(), name: 'Supermercado La Esperanza S.A.', taxId: '3-101-123456', email: 'compras@laesperanza.example.com', phone: '+506 2222 3333', address: 'Alajuela, Costa Rica' },
    { id: uid(), name: 'ClÃ­nica Dental Sonrisas', taxId: '3-102-654321', email: 'admin@sonrisas.example.com', phone: '+506 2440 5555', address: 'Heredia, Costa Rica' },
    { id: uid(), name: 'MarÃ­a RodrÃ­guez Vargas', taxId: '2-0456-0789', email: 'maria.rv@example.com', phone: '+506 7000 2222', address: 'Cartago, Costa Rica' },
    { id: uid(), name: 'Luis Quesada RamÃ­rez', taxId: '2-0666-1122', email: 'luis.quesada@example.com', phone: '+506 6090 2211', address: 'Heredia, Costa Rica' },
    { id: uid(), name: 'Soluciones Retail CR S.A.', taxId: '3-102-445577', email: 'info@solucionesretail.example.com', phone: '+506 2555 8899', address: 'Alajuela, Costa Rica' },
  ];
  db = {
    version: 1,
    settings: {
      name: 'ALDAM GLOBAL TECH', slogan: 'TÃ©cnicos en TecnologÃ­as de la InformaciÃ³n',
      taxId: 'CÃ©dula jurÃ­dica: 3-101-000000', address: 'Costa Rica',
      phones: '+506 6260 3942 Â· +506 6370 1764',
      emails: 'dani_machadoten@hotmail.com Â· hidalgoalberto45@gmail.com',
      logo, currency: 'CRC', iva: 13, proformaPrefix: 'PF-', invoicePrefix: 'FA-', validDays: 15, dueDays: 15,
      showVideo: true,
      payInfo: 'SINPE MÃ³vil: +506 6260 3942 Â· Transferencia bancaria: solicitar datos por correo.',
      terms: 'GarantÃ­a de productos segÃºn fabricante. Los servicios cuentan con 30 dÃ­as de garantÃ­a sobre la mano de obra. Precios sujetos a cambio sin previo aviso. Â¡Gracias por confiar en ALDAM GLOBAL TECH!',
    },
    counters: { proforma: 0, invoice: 0 },
    products, clients, movements: [], proformas: [], invoices: [],
  };
  // ---------- Datos de ejemplo (fÃ¡cilmente borrables desde el sistema) ----------
  const c = clients, D = n => addDays(today(), n);
  // Compras iniciales: historial de entradas de cada producto
  products.forEach(p => {
    if (p.type === 'producto' && p.stock > 0)
      db.movements.push({ id: uid(), productId: p.id, type: 'in', qty: p.stock, date: new Date(Date.now() - 45 * 864e5).toISOString(), note: 'Compra inicial a proveedor', ref: '', stockAfter: p.stock });
  });
  const mkInv = o => { const inv = buildDoc('invoice', o); db.invoices.push(inv); return inv; };
  // FA-000001 Â· Pendiente Â· Supermercado La Esperanza
  applyStock(mkInv({
    clientId: c[1].id, payMethod: 'Transferencia', status: 'pendiente', date: D(-5), dueDate: D(10),
    lines: [{ productId: products[4].id, qty: 4, price: 34000 }, { productId: products[5].id, qty: 1, price: 72000 }, { productId: products[7].id, qty: 4, price: 25000 }],
  }), 'out');
  // FA-000002 Â· Pagada Â· Juan PÃ©rez
  applyStock(mkInv({
    clientId: c[0].id, payMethod: 'Efectivo', status: 'pagada', date: D(-1), dueDate: D(14),
    lines: [{ productId: products[1].id, qty: 1, price: 22000 }, { productId: products[3].id, qty: 2, price: 15000 }, { productId: products[8].id, qty: 2, price: 18000 }],
  }), 'out');
  // FA-000003 Â· Pagada Â· ClÃ­nica Dental Sonrisas
  applyStock(mkInv({
    clientId: c[2].id, payMethod: 'Tarjeta', status: 'pagada', date: D(-12), dueDate: D(27),
    lines: [{ productId: products[2].id, qty: 2, price: 42000 }, { productId: products[3].id, qty: 3, price: 15000 }, { productId: products[12].id, qty: 2, price: 12500 }],
  }), 'out');
  // FA-000004 Â· Pagada Â· MarÃ­a RodrÃ­guez
  applyStock(mkInv({
    clientId: c[3].id, payMethod: 'SINPE MÃ³vil', status: 'pagada', date: D(-35), dueDate: D(-20),
    lines: [{ productId: products[11].id, qty: 1, price: 135000 }, { productId: products[9].id, qty: 1, price: 20000 }, { productId: products[0].id, qty: 100, price: 850 }],
  }), 'out');
  // FA-000005 Â· Anulada (el stock fue devuelto) Â· Supermercado La Esperanza
  const invAnu = mkInv({
    clientId: c[1].id, payMethod: 'SINPE MÃ³vil', status: 'pagada', date: D(-40), dueDate: D(-25),
    lines: [{ productId: products[6].id, qty: 1, price: 61000 }, { productId: products[13].id, qty: 1, price: 22000 }],
  });
  applyStock(invAnu, 'out'); applyStock(invAnu, 'in'); invAnu.status = 'anulada';
  // Proformas de ejemplo
  db.proformas.push(buildDoc('proforma', {
    clientId: c[2].id, date: today(), validUntil: D(15), notes: 'Incluye configuraciÃ³n y capacitaciÃ³n bÃ¡sica.',
    lines: [{ productId: products[2].id, qty: 3, price: 42000 }, { productId: products[3].id, qty: 3, price: 15000 }],
  }));
  db.proformas.push(buildDoc('proforma', {
    clientId: c[3].id, date: D(-3), validUntil: D(12), notes: 'Precio especial por volumen.',
    lines: [{ productId: products[0].id, qty: 200, price: 850 }, { productId: products[13].id, qty: 1, price: 22000 }],
  }));
  const pfAnu = buildDoc('proforma', {
    clientId: c[4].id, date: D(-8), validUntil: D(7), notes: '',
    lines: [{ productId: products[1].id, qty: 2, price: 22000 }],
  });
  pfAnu.status = 'anulada';
  db.proformas.push(pfAnu);
  flush();
}

if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
else seed();

/* ---------- LÃ³gica de documentos ---------- */
function calc(d) {
  d.lines = (d.lines || []).map(l => {
    const p = l.productId ? db.products.find(x => x.id === l.productId) : null;
    return {
      productId: p ? p.id : null,
      code: p ? p.code : String(l.code || ''),
      name: String(l.name || (p ? p.name : '')),
      qty: Math.max(0, +l.qty || 0), price: Math.max(0, +l.price || 0),
      discPct: Math.min(100, Math.max(0, +l.discPct || 0)),
    };
  }).filter(l => l.name && l.qty > 0);
  let sub = 0;
  d.lines.forEach(l => { l.total = r2(l.qty * l.price * (1 - l.discPct / 100)); sub += l.total; });
  d.subtotal = r2(sub);
  d.discPct = Math.min(100, Math.max(0, +d.discPct || 0));
  d.discount = r2(d.subtotal * d.discPct / 100);
  d.ivaPct = isFinite(parseFloat(d.ivaPct)) ? Math.max(0, +d.ivaPct) : db.settings.iva;
  d.tax = r2((d.subtotal - d.discount) * d.ivaPct / 100);
  d.total = r2(d.subtotal - d.discount + d.tax);
  return d;
}
function clientSnapshot(id) {
  const c = db.clients.find(x => x.id === id);
  return c ? { ...c } : null;
}
function buildDoc(kind, b) {
  const s = db.settings;
  const key = kind === 'invoice' ? 'invoice' : 'proforma';
  const n = ++db.counters[key];
  const prefix = kind === 'invoice' ? s.invoicePrefix : s.proformaPrefix;
  const d = {
    id: uid(), number: prefix + String(n).padStart(6, '0'), createdAt: new Date().toISOString(),
    date: b.date || today(), clientId: b.clientId || null, client: clientSnapshot(b.clientId),
    discPct: b.discPct, ivaPct: b.ivaPct, notes: b.notes || '', lines: b.lines,
  };
  if (kind === 'invoice') {
    Object.assign(d, {
      status: ['pendiente', 'pagada'].includes(b.status) ? b.status : 'pendiente',
      dueDate: b.dueDate || addDays(d.date, s.dueDays || 15), payMethod: b.payMethod || 'Efectivo',
      proformaId: b.proformaId || null, proformaNumber: b.proformaNumber || '',
    });
    if (d.status === 'pagada') d.paidDate = today();
  } else {
    Object.assign(d, { status: 'vigente', validUntil: b.validUntil || addDays(d.date, s.validDays || 15), invoiceId: null });
  }
  return calc(d);
}
function checkStock(d) {
  for (const l of d.lines) {
    const p = db.products.find(x => x.id === l.productId);
    if (p && p.type === 'producto' && p.stock < l.qty)
      return `Stock insuficiente de "${p.name}" (disponible: ${p.stock}, solicitado: ${l.qty})`;
  }
  return null;
}
function applyStock(d, dir) {
  for (const l of d.lines) {
    const p = db.products.find(x => x.id === l.productId);
    if (!p || p.type !== 'producto') continue;
    p.stock += dir === 'out' ? -l.qty : l.qty;
    db.movements.push({
      id: uid(), productId: p.id, type: dir, qty: l.qty, date: new Date().toISOString(),
      note: dir === 'out' ? `Factura ${d.number}` : `AnulaciÃ³n factura ${d.number}`, ref: d.number, stockAfter: p.stock,
    });
  }
}

/* ---------- API ---------- */
const api = express.Router();
const wrap = fn => (req, res) => {
  try { const out = fn(req, res); if (out !== undefined && !res.headersSent) res.json(out); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
};
const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; throw e; };
const find = (arr, id) => arr.find(x => x.id === id) || fail('No encontrado', 404);

api.get('/version', wrap(() => ({ version: db.version, base: getBase() })));
api.get('/state', wrap(() => ({ ...db, base: getBase() })));

// ConfiguraciÃ³n / empresa
api.put('/settings', wrap(req => {
  const b = req.body, s = db.settings;
  ['name', 'slogan', 'taxId', 'address', 'phones', 'emails', 'logo', 'currency', 'proformaPrefix', 'invoicePrefix', 'payInfo', 'terms']
    .forEach(k => { if (typeof b[k] === 'string') s[k] = b[k]; });
  ['iva', 'validDays', 'dueDays'].forEach(k => { if (isFinite(parseFloat(b[k]))) s[k] = +b[k]; });
  if (typeof b.showVideo === 'boolean') s.showVideo = b.showVideo;
  if (!['CRC', 'USD'].includes(s.currency)) s.currency = 'CRC';
  save(); return s;
}));
api.put('/config', wrap(req => {
  const p = normPath(req.body.secretPath);
  if (!/^\/[A-Za-z0-9_\-\/]{3,60}$/.test(p)) fail('Ruta invÃ¡lida: use 3-60 letras, nÃºmeros, guion o guion bajo.');
  config.secretPath = p;
  fs.writeFileSync(CFG_FILE, JSON.stringify(config, null, 2));
  return { base: p };
}));

// ImÃ¡genes
api.post('/upload', wrap(req => {
  const m = /^data:image\/(png|jpeg|webp|gif);base64,(.+)$/.exec(req.body.dataUrl || '');
  if (!m) fail('Imagen invÃ¡lida (use PNG, JPG, WEBP o GIF)');
  const name = uid() + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(m[2], 'base64'));
  return { url: 'uploads/' + name };
}));

// CRUD genÃ©rico de productos y clientes
function crud(name, coll, fields, validate) {
  api.post('/' + name, wrap(req => {
    const o = { id: uid() }; fields.forEach(k => o[k.k] = k.t === 'n' ? Math.max(0, +req.body[k.k] || 0) : String(req.body[k.k] || '').trim());
    validate(o, null); db[coll].push(o);
    if (coll === 'products' && o.type === 'producto' && o.stock > 0)
      db.movements.push({ id: uid(), productId: o.id, type: 'in', qty: o.stock, date: new Date().toISOString(), note: 'Stock inicial', ref: '', stockAfter: o.stock });
    save(); return o;
  }));
  api.put('/' + name + '/:id', wrap(req => {
    const o = find(db[coll], req.params.id); const copy = { ...o };
    fields.forEach(k => { if (k.k in req.body) copy[k.k] = k.t === 'n' ? Math.max(0, +req.body[k.k] || 0) : String(req.body[k.k] || '').trim(); });
    validate(copy, o);
    if (coll === 'products' && copy.stock !== o.stock && copy.type === 'producto')
      db.movements.push({ id: uid(), productId: o.id, type: copy.stock > o.stock ? 'in' : 'out', qty: Math.abs(copy.stock - o.stock), date: new Date().toISOString(), note: 'Ajuste manual', ref: '', stockAfter: copy.stock });
    Object.assign(o, copy); save(); return o;
  }));
  api.delete('/' + name + '/:id', wrap(req => {
    find(db[coll], req.params.id);
    db[coll] = db[coll].filter(x => x.id !== req.params.id);
    if (coll === 'products') db.movements = db.movements.filter(m => m.productId !== req.params.id);
    save(); return { ok: true };
  }));
}
crud('products', 'products', [
  { k: 'code' }, { k: 'name' }, { k: 'description' }, { k: 'category' }, { k: 'type' }, { k: 'image' },
  { k: 'cost', t: 'n' }, { k: 'price', t: 'n' }, { k: 'stock', t: 'n' }, { k: 'min', t: 'n' },
], (o, old) => {
  if (!o.name) fail('El nombre es obligatorio');
  if (!['producto', 'servicio'].includes(o.type)) o.type = 'producto';
  if (!o.code) o.code = 'P-' + String(db.products.length + 1).padStart(4, '0');
  if (db.products.some(p => p.code.toLowerCase() === o.code.toLowerCase() && (!old || p.id !== old.id))) fail('Ya existe un producto con ese cÃ³digo');
  if (o.type === 'servicio') { o.stock = 0; o.min = 0; }
});
crud('clients', 'clients', [{ k: 'name' }, { k: 'taxId' }, { k: 'email' }, { k: 'phone' }, { k: 'address' }],
  o => { if (!o.name) fail('El nombre es obligatorio'); });

// Movimientos de inventario
api.post('/movements', wrap(req => {
  const p = find(db.products, req.body.productId);
  if (p.type !== 'producto') fail('Los servicios no manejan inventario');
  const qty = +req.body.qty; const type = req.body.type === 'out' ? 'out' : 'in';
  if (!(qty > 0)) fail('Cantidad invÃ¡lida');
  if (type === 'out' && p.stock < qty) fail('No hay stock suficiente');
  p.stock += type === 'out' ? -qty : qty;
  db.movements.push({ id: uid(), productId: p.id, type, qty, date: new Date().toISOString(), note: String(req.body.note || (type === 'in' ? 'Compra' : 'Salida')), ref: '', stockAfter: p.stock });
  save(); return { ok: true };
}));

// Proformas
api.post('/proformas', wrap(req => {
  const d = buildDoc('proforma', req.body);
  if (!d.lines.length) { db.counters.proforma--; fail('Agregue al menos un artÃ­culo'); }
  db.proformas.push(d); save(); return d;
}));
api.put('/proformas/:id', wrap(req => {
  const d = find(db.proformas, req.params.id);
  if (d.status !== 'vigente') fail('Solo se pueden editar proformas vigentes');
  const b = req.body;
  Object.assign(d, { date: b.date || d.date, validUntil: b.validUntil || d.validUntil, notes: b.notes || '', clientId: b.clientId || null, client: clientSnapshot(b.clientId), discPct: b.discPct, ivaPct: b.ivaPct, lines: b.lines });
  calc(d); if (!d.lines.length) fail('Agregue al menos un artÃ­culo');
  save(); return d;
}));
api.post('/proformas/:id/anular', wrap(req => {
  const d = find(db.proformas, req.params.id);
  if (d.status === 'facturada') fail('La proforma ya fue convertida en factura');
  d.status = 'anulada'; save(); return d;
}));
api.post('/proformas/:id/convertir', wrap(req => {
  const p = find(db.proformas, req.params.id);
  if (p.status !== 'vigente') fail('Solo se pueden convertir proformas vigentes');
  const probe = { lines: p.lines }; const err = checkStock(probe); if (err) fail(err);
  const inv = buildDoc('invoice', {
    clientId: p.clientId, discPct: p.discPct, ivaPct: p.ivaPct, notes: p.notes, lines: p.lines,
    payMethod: req.body.payMethod, status: req.body.status, proformaId: p.id, proformaNumber: p.number,
  });
  applyStock(inv, 'out'); db.invoices.push(inv);
  p.status = 'facturada'; p.invoiceId = inv.id; p.invoiceNumber = inv.number;
  save(); return inv;
}));

// Facturas
api.post('/invoices', wrap(req => {
  const probe = calc({ lines: req.body.lines, ivaPct: req.body.ivaPct });
  if (!probe.lines.length) fail('Agregue al menos un artÃ­culo');
  const err = checkStock(probe); if (err) fail(err);
  const inv = buildDoc('invoice', req.body);
  applyStock(inv, 'out'); db.invoices.push(inv); save(); return inv;
}));
api.put('/invoices/:id/status', wrap(req => {
  const d = find(db.invoices, req.params.id); const st = req.body.status;
  if (!['pendiente', 'pagada', 'anulada'].includes(st)) fail('Estado invÃ¡lido');
  if (d.status === 'anulada') fail('Una factura anulada no se puede reactivar');
  if (st === 'anulada') applyStock(d, 'in');
  d.status = st; d.paidDate = st === 'pagada' ? today() : null;
  if (req.body.payMethod) d.payMethod = req.body.payMethod;
  save(); return d;
}));

// Copias de seguridad (datos + imÃ¡genes en un solo archivo)
api.get('/backup', (req, res) => {
  flush();
  const files = {};
  fs.readdirSync(UPLOADS).forEach(n => {
    const ext = path.extname(n).slice(1).toLowerCase();
    files[n] = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,` + fs.readFileSync(path.join(UPLOADS, n)).toString('base64');
  });
  res.setHeader('Content-Disposition', `attachment; filename="respaldo-aldam-${today()}.json"`);
  res.json({ app: 'aldam-sistema', date: new Date().toISOString(), db, files });
});
api.post('/restore', wrap(req => {
  const b = req.body;
  if (!b || b.app !== 'aldam-sistema' || !b.db || !Array.isArray(b.db.products)) fail('Archivo de respaldo invÃ¡lido');
  fs.copyFileSync(DB_FILE, path.join(BACKUPS, `antes-de-restaurar-${Date.now()}.json`));
  Object.entries(b.files || {}).forEach(([n, url]) => {
    if (!/^[\w.-]+\.(png|jpg|webp|gif)$/.test(n)) return;
    const m = /^data:image\/[a-z]+;base64,(.+)$/.exec(url); if (m) fs.writeFileSync(path.join(UPLOADS, n), Buffer.from(m[1], 'base64'));
  });
  const v = db.version; db = b.db; db.version = v + 1; flush(); return { ok: true };
}));

/* ---------- App: solo accesible bajo la URL secreta ---------- */
const app = express();
app.disable('x-powered-by');
const router = express.Router();
router.use((req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Cache-Control', 'no-store'); next(); });
router.use('/api', express.json({ limit: '60mb' }), api);
router.use('/uploads', express.static(UPLOADS, { maxAge: '7d', setHeaders: r => r.setHeader('Cache-Control', 'public, max-age=604800') }));
router.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

app.use((req, res, next) => {
  const base = getBase();
  if (req.path === base) return res.redirect(base + '/');
  if (req.path.startsWith(base + '/')) { req.url = req.url.slice(base.length); return router(req, res, next); }
  res.status(404).type('text').send('Not Found');
});
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

process.on('SIGINT', () => { flush(); process.exit(); });
process.on('SIGTERM', () => { flush(); process.exit(); });
// app.listen(PORT, () => console.log(`ALDAM sistema listo: http://localhost:${PORT}${getBase()}/`));

module.exports = app;
