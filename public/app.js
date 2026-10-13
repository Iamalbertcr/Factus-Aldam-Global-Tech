/**
 * ALDAM GLOBAL TECH - Interfaz del sistema (JS puro, sin build).
 * Estructura: utilidades -> estado/sincronizaciÃ³n -> vistas -> editor de documentos -> reportes -> configuraciÃ³n.
 * Todas las llamadas usan rutas relativas ("api/...") para funcionar bajo cualquier URL secreta.
 */

/* =============== Utilidades =============== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (isFinite(parseFloat(v)) ? parseFloat(v) : 0);
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const localDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayStr = () => localDate();
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d); };
const fmtDate = s => (s ? s.slice(0, 10).split('-').reverse().join('/') : 'â€”');
const fmtDT = s => { const d = new Date(s); return d.toLocaleDateString('es-CR') + ' ' + d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }); };
const fmt = n => (S.settings.currency === 'USD' ? '$' : 'â‚¡') + num(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAY = ['Efectivo', 'SINPE MÃ³vil', 'Transferencia', 'Tarjeta', 'Cheque', 'CrÃ©dito'];

async function api(method, url, body) {
  const r = await fetch('/api/' + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error de servidor');
  return j;
}
function toast(msg, err) {
  const el = document.createElement('div');
  el.className = 'card px-4 py-3 text-sm ' + (err ? 'border-red-400' : 'neon');
  el.textContent = (err ? 'âš ï¸ ' : 'âœ… ') + msg;
  $('#toast').appendChild(el); setTimeout(() => el.remove(), 3500);
}
// Ejecuta una acciÃ³n, recarga datos y muestra el resultado
async function act(fn, ok) {
  try { const r = await fn(); await load(); if (ok) toast(ok); return r === undefined ? true : r; }
  catch (e) { toast(e.message, true); return null; }
}
function openModal(html, width = 'max-w-2xl') {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${width}">${html}</div>`;
  bg.addEventListener('mousedown', e => { if (e.target === bg && !bg.dataset.lock) closeModal(bg); });
  $('#modals').appendChild(bg);
  return bg;
}
function closeModal(el) { (el || $('#modals').lastElementChild)?.remove(); }
const modalOpen = () => $('#modals').children.length > 0;
const closeBtn = '<button class="btn btn-sm" onclick="closeModal()">âœ• Cerrar</button>';

/* ImÃ¡genes: se reducen en el navegador y se suben al servidor */
function readImage(file, max = 700) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
const IMG = {};
async function pickImg(input, key) {
  const f = input.files[0]; if (!f) return;
  try {
    const { url } = await api('POST', 'upload', { dataUrl: await readImage(f, key === 'logo' ? 500 : 700) });
    IMG[key] = url; $('#prev-' + key).innerHTML = `<img src="${url}" class="max-h-24 rounded-lg">`;
  } catch (e) { toast(e.message || 'No se pudo cargar la imagen', true); }
}
const imgField = (key, cur) => {
  IMG[key] = cur || '';
  return `<div class="flex items-center gap-3"><div id="prev-${key}" class="min-w-16">${cur ? `<img src="${esc(cur)}" class="max-h-24 rounded-lg">` : '<span class="text-slate-500 text-xs">Sin imagen</span>'}</div>
  <label class="btn btn-sm cursor-pointer">ðŸ“· Subir imagen<input type="file" accept="image/*" class="hidden" onchange="pickImg(this,'${key}')"></label>
  <button type="button" class="btn btn-sm" onclick="IMG['${key}']='';$('#prev-${key}').innerHTML='<span class=&quot;text-slate-500 text-xs&quot;>Sin imagen</span>'">Quitar</button></div>`;
};

/* =============== Estado y sincronizaciÃ³n en tiempo real =============== */
let S = null, version = -1, dirty = false;
async function load() { S = await api('GET', 'state'); version = S.version; }
async function poll() {
  try {
    const v = await api('GET', 'version');
    if (v.version !== version) { await load(); dirty = true; }
    if (dirty && !modalOpen() && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { dirty = false; render(); }
    $('#syncInfo') && ($('#syncInfo').textContent = 'Sincronizado ' + new Date().toLocaleTimeString('es-CR'));
  } catch (e) { $('#syncInfo') && ($('#syncInfo').textContent = 'âš ï¸ Sin conexiÃ³n'); }
}

/* =============== NavegaciÃ³n =============== */
const ROUTES = [
  ['inicio', 'ðŸ ', 'Inicio'], ['inventario', 'ðŸ“¦', 'Inventario'], ['clientes', 'ðŸ‘¥', 'Clientes'],
  ['proformas', 'ðŸ“', 'Proformas'], ['facturas', 'ðŸ§¾', 'Facturas'], ['cobrar', 'ðŸ’°', 'Por cobrar'],
  ['reportes', 'ðŸ“Š', 'Reportes'], ['config', 'âš™ï¸', 'ConfiguraciÃ³n'],
];
const route = () => (location.hash.replace('#/', '') || 'inicio');
function render() {
  const r = route(), s = S.settings;
  const bv = $('#bgvid'); if (bv) bv.style.display = s.showVideo === false ? 'none' : '';
  $('#brand').innerHTML = `${s.logo ? `<img src="${esc(s.logo)}" class="h-10 w-10 rounded-xl object-contain bg-white/5">` : ''}
    <div class="leading-tight"><div class="font-extrabold gradtxt text-sm">${esc(s.name)}</div><div class="text-[10px] text-slate-400 hidden lg:block">${esc(s.slogan)}</div></div>`;
  $('#nav').innerHTML = ROUTES.map(([k, i, t]) => `<a href="#/${k}" class="${k === r ? 'active' : ''}"><span>${i}</span><span>${t}</span></a>`).join('');
  document.title = s.name + ' Â· Sistema';
  ({ inicio: vInicio, inventario: vInventario, clientes: vClientes, proformas: vProformas, facturas: vFacturas, cobrar: vCobrar, reportes: vReportes, config: vConfig }[r] || vInicio)();
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
const head = (title, actions = '') => `<div class="flex flex-wrap items-center justify-between gap-3 mb-4"><h1 class="text-2xl font-extrabold">${title}</h1><div class="flex flex-wrap gap-2">${actions}</div></div>`;
const badge = (t, c) => `<span class="badge b-${c}">${t}</span>`;
const empty = t => `<div class="text-center text-slate-400 py-10">${t}</div>`;
const tableWrap = h => `<div class="card overflow-x-auto">${h}</div>`;

/* Estados */
const invBadge = d => ({ pendiente: badge('Pendiente', d.dueDate < todayStr() ? 'red' : 'yellow'), pagada: badge('Pagada', 'green'), anulada: badge('Anulada', 'gray') }[d.status]) +
  (d.status === 'pendiente' && d.dueDate < todayStr() ? ' ' + badge('Vencida', 'red') : '');
const proBadge = d => d.status === 'vigente' ? (d.validUntil < todayStr() ? badge('Vencida', 'red') : badge('Vigente', 'blue')) : d.status === 'facturada' ? badge('Facturada', 'green') : badge('Anulada', 'gray');
const lowStock = p => p.type === 'producto' && p.stock <= p.min;
const prodById = id => S.products.find(p => p.id === id);

/* =============== INICIO =============== */
function vInicio() {
  const ym = todayStr().slice(0, 7);
  const valid = S.invoices.filter(i => i.status !== 'anulada');
  const month = valid.filter(i => i.date.startsWith(ym)).reduce((a, i) => a + i.total, 0);
  const pend = S.invoices.filter(i => i.status === 'pendiente');
  const low = S.products.filter(lowStock);
  const pf = S.proformas.filter(p => p.status === 'vigente').length;
  const card = (t, v, c, href) => `<a href="#/${href}" class="card p-4 block hover:neon transition"><div class="text-xs uppercase tracking-wide text-slate-400">${t}</div><div class="text-2xl font-extrabold mt-1 ${c}">${v}</div></a>`;
  $('#view').innerHTML = head(`Hola ðŸ‘‹ <span class="gradtxt">${esc(S.settings.name)}</span>`,
    `<button class="btn btn-primary" onclick="docEditor('proforma')">ï¼‹ Nueva proforma</button><button class="btn btn-primary" onclick="docEditor('invoice')">ï¼‹ Nueva factura</button>`) +
    `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${card('Ventas del mes', fmt(month), 'text-cyan-300', 'reportes')}${card('Por cobrar', fmt(pend.reduce((a, i) => a + i.total, 0)), 'text-amber-300', 'cobrar')}
      ${card('Stock bajo', low.length + ' artÃ­culos', low.length ? 'text-red-300' : 'text-emerald-300', 'inventario')}${card('Proformas vigentes', pf, 'text-violet-300', 'proformas')}</div>
    <div class="grid lg:grid-cols-2 gap-4">
      <div class="card p-4"><h2 class="font-bold mb-2">âš ï¸ Alertas de stock bajo</h2>${low.length ? low.map(p => `<div class="flex justify-between py-1.5 border-b border-white/5 text-sm"><span>${esc(p.name)}</span><span>${badge(p.stock + ' / mÃ­n. ' + p.min, 'red')}</span></div>`).join('') : '<div class="text-slate-400 text-sm">Todo el inventario estÃ¡ en orden âœ”ï¸</div>'}</div>
      <div class="card p-4"><h2 class="font-bold mb-2">ðŸ§¾ Ãšltimas facturas</h2>${S.invoices.length ? [...S.invoices].reverse().slice(0, 6).map(i => `<div class="flex justify-between items-center py-1.5 border-b border-white/5 text-sm cursor-pointer" onclick="showDoc('invoice','${i.id}')"><span>${esc(i.number)} Â· ${esc(i.client?.name || 'Contado')}</span><span>${fmt(i.total)} ${invBadge(i)}</span></div>`).join('') : '<div class="text-slate-400 text-sm">AÃºn no hay facturas.</div>'}</div>
    </div>`;
}

/* =============== INVENTARIO =============== */
const F = { inv: { q: '', cat: '', type: '' }, cli: { q: '' }, pro: { q: '', st: '' }, fac: { q: '', st: '', cli: '', from: '', to: '' } };
function vInventario() {
  const cats = [...new Set(S.products.map(p => p.category).filter(Boolean))].sort();
  $('#view').innerHTML = head('ðŸ“¦ Inventario', `<button class="btn btn-primary" onclick="productForm()">ï¼‹ Nuevo producto / servicio</button>`) +
    `<div class="card p-3 mb-3 grid sm:grid-cols-3 gap-2">
      <input class="inp" placeholder="ðŸ” Buscar por nombre o cÃ³digoâ€¦" value="${esc(F.inv.q)}" oninput="F.inv.q=this.value;listInv()">
      <select class="inp" onchange="F.inv.cat=this.value;listInv()"><option value="">Todas las categorÃ­as</option>${cats.map(c => `<option ${F.inv.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select class="inp" onchange="F.inv.type=this.value;listInv()"><option value="">Productos y servicios</option><option value="producto" ${F.inv.type === 'producto' ? 'selected' : ''}>Solo productos</option><option value="servicio" ${F.inv.type === 'servicio' ? 'selected' : ''}>Solo servicios</option><option value="bajo" ${F.inv.type === 'bajo' ? 'selected' : ''}>âš ï¸ Stock bajo</option></select></div>
    <div id="list"></div>`;
  listInv();
}
function listInv() {
  const f = F.inv, q = f.q.toLowerCase();
  const rows = S.products.filter(p => (!q || (p.name + p.code + p.description).toLowerCase().includes(q)) && (!f.cat || p.category === f.cat) &&
    (!f.type || (f.type === 'bajo' ? lowStock(p) : p.type === f.type)));
  $('#list').innerHTML = rows.length ? tableWrap(`<table class="tbl"><thead><tr><th></th><th>CÃ³digo</th><th>ArtÃ­culo</th><th>CategorÃ­a</th><th>Costo</th><th>Venta</th><th>Stock</th><th></th></tr></thead><tbody>${rows.map(p => `<tr>
    <td>${p.image ? `<img src="${esc(p.image)}" class="h-10 w-10 rounded-lg object-cover">` : '<div class="h-10 w-10 rounded-lg bg-white/5 grid place-items-center">' + (p.type === 'servicio' ? 'ðŸ› ï¸' : 'ðŸ“¦') + '</div>'}</td>
    <td class="font-mono text-xs">${esc(p.code)}</td><td><div class="font-semibold">${esc(p.name)}</div><div class="text-xs text-slate-400">${esc(p.description)}</div></td>
    <td>${esc(p.category)}</td><td>${fmt(p.cost)}</td><td class="font-semibold">${fmt(p.price)}</td>
    <td>${p.type === 'servicio' ? badge('Servicio', 'blue') : lowStock(p) ? badge(p.stock + ' Â· Stock bajo', 'red') : badge(p.stock, 'green')}</td>
    <td class="whitespace-nowrap">${p.type === 'producto' ? `<button class="btn btn-sm" title="Entrada / salida" onclick="moveForm('${p.id}')">â‡…</button> <button class="btn btn-sm" title="Historial" onclick="history_('${p.id}')">ðŸ•˜</button> ` : ''}<button class="btn btn-sm" title="Editar" onclick="productForm('${p.id}')">âœï¸</button> <button class="btn btn-sm btn-danger" title="Eliminar" onclick="delProduct('${p.id}')">ðŸ—‘</button></td></tr>`).join('')}</tbody></table>`) : tableWrap(empty('No hay artÃ­culos que coincidan.'));
}
function productForm(id) {
  const p = id ? prodById(id) : { code: '', name: '', description: '', category: '', type: 'producto', cost: 0, price: 0, stock: 0, min: 0, image: '' };
  const cats = [...new Set(S.products.map(x => x.category).filter(Boolean))];
  const m = openModal(`<form class="p-5 space-y-3" onsubmit="saveProduct(event,'${id || ''}')">
    <div class="flex justify-between items-center"><h2 class="text-xl font-bold">${id ? 'Editar' : 'Nuevo'} artÃ­culo</h2>${closeBtn}</div>
    <div class="grid sm:grid-cols-2 gap-3">
      <div><label class="lbl">Tipo</label><select name="type" class="inp" onchange="this.form.stock.disabled=this.form.min.disabled=this.value=='servicio'"><option value="producto" ${p.type === 'producto' ? 'selected' : ''}>Producto (con inventario)</option><option value="servicio" ${p.type === 'servicio' ? 'selected' : ''}>Servicio</option></select></div>
      <div><label class="lbl">CÃ³digo (opcional)</label><input name="code" class="inp" value="${esc(p.code)}" placeholder="Se genera si lo deja vacÃ­o"></div>
      <div class="sm:col-span-2"><label class="lbl">Nombre *</label><input name="name" class="inp" required value="${esc(p.name)}"></div>
      <div class="sm:col-span-2"><label class="lbl">DescripciÃ³n</label><textarea name="description" class="inp" rows="2">${esc(p.description)}</textarea></div>
      <div><label class="lbl">CategorÃ­a</label><input name="category" class="inp" list="catList" value="${esc(p.category)}"><datalist id="catList">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div><label class="lbl">Precio de costo</label><input name="cost" type="number" step="0.01" min="0" class="inp" value="${p.cost}"></div>
      <div><label class="lbl">Precio de venta</label><input name="price" type="number" step="0.01" min="0" class="inp" value="${p.price}"></div>
      <div class="grid grid-cols-2 gap-2"><div><label class="lbl">Stock</label><input name="stock" type="number" min="0" class="inp" value="${p.stock}" ${p.type === 'servicio' ? 'disabled' : ''}></div><div><label class="lbl">Stock mÃ­nimo</label><input name="min" type="number" min="0" class="inp" value="${p.min}" ${p.type === 'servicio' ? 'disabled' : ''}></div></div>
    </div><div><label class="lbl">Imagen</label>${imgField('prod', p.image)}</div>
    <div class="flex justify-end gap-2 pt-2"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">ðŸ’¾ Guardar</button></div></form>`);
}
async function saveProduct(e, id) {
  e.preventDefault(); const f = e.target;
  const body = { image: IMG.prod };
  ['type', 'code', 'name', 'description', 'category', 'cost', 'price', 'stock', 'min'].forEach(k => body[k] = f[k].value);
  if (await act(() => api(id ? 'PUT' : 'POST', 'products' + (id ? '/' + id : ''), body), 'ArtÃ­culo guardado')) { closeModal(); render(); }
}
async function delProduct(id) {
  if (confirm('Â¿Eliminar este artÃ­culo y su historial de movimientos? Las facturas existentes no se alteran.') && await act(() => api('DELETE', 'products/' + id), 'ArtÃ­culo eliminado')) render();
}
function moveForm(id) {
  const p = prodById(id);
  openModal(`<form class="p-5 space-y-3" onsubmit="saveMove(event,'${id}')">
    <div class="flex justify-between"><h2 class="text-xl font-bold">Movimiento: ${esc(p.name)}</h2>${closeBtn}</div>
    <div class="text-sm text-slate-400">Stock actual: <b class="text-white">${p.stock}</b></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Tipo</label><select name="type" class="inp"><option value="in">â¬‡ï¸ Entrada (compra)</option><option value="out">â¬†ï¸ Salida</option></select></div>
    <div><label class="lbl">Cantidad</label><input name="qty" type="number" min="1" required class="inp" value="1"></div></div>
    <div><label class="lbl">Nota / proveedor</label><input name="note" class="inp" placeholder="Ej: Compra a proveedor X"></div>
    <div class="flex justify-end gap-2"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Registrar</button></div></form>`, 'max-w-md');
}
async function saveMove(e, id) {
  e.preventDefault(); const f = e.target;
  if (await act(() => api('POST', 'movements', { productId: id, type: f.type.value, qty: f.qty.value, note: f.note.value }), 'Movimiento registrado')) { closeModal(); render(); }
}
function history_(id) {
  const p = prodById(id), ms = S.movements.filter(m => m.productId === id).reverse();
  openModal(`<div class="p-5"><div class="flex justify-between mb-3"><h2 class="text-xl font-bold">ðŸ•˜ Historial: ${esc(p.name)}</h2>${closeBtn}</div>
    ${ms.length ? `<div class="overflow-x-auto"><table class="tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Stock final</th><th>Detalle</th></tr></thead><tbody>${ms.map(m => `<tr><td>${fmtDT(m.date)}</td><td>${m.type === 'in' ? badge('Entrada', 'green') : badge('Salida', 'red')}</td><td>${m.qty}</td><td>${m.stockAfter ?? ''}</td><td>${esc(m.note)}</td></tr>`).join('')}</tbody></table></div>` : empty('Sin movimientos.')}</div>`, 'max-w-3xl');
}

/* =============== CLIENTES =============== */
function vClientes() {
  $('#view').innerHTML = head('ðŸ‘¥ Clientes', `<button class="btn btn-primary" onclick="clientForm()">ï¼‹ Nuevo cliente</button>`) +
    `<div class="card p-3 mb-3"><input class="inp" placeholder="ðŸ” Buscar por nombre, cÃ©dula, correo o telÃ©fonoâ€¦" value="${esc(F.cli.q)}" oninput="F.cli.q=this.value;listCli()"></div><div id="list"></div>`;
  listCli();
}
function listCli() {
  const q = F.cli.q.toLowerCase();
  const rows = S.clients.filter(c => !q || (c.name + c.taxId + c.email + c.phone).toLowerCase().includes(q));
  $('#list').innerHTML = rows.length ? tableWrap(`<table class="tbl"><thead><tr><th>Nombre</th><th>CÃ©dula</th><th>Correo</th><th>TelÃ©fono</th><th>DirecciÃ³n</th><th></th></tr></thead><tbody>${rows.map(c => `<tr><td class="font-semibold">${esc(c.name)}</td><td>${esc(c.taxId)}</td><td>${esc(c.email)}</td><td>${esc(c.phone)}</td><td>${esc(c.address)}</td>
    <td class="whitespace-nowrap"><button class="btn btn-sm" onclick="clientForm('${c.id}')">âœï¸</button> <button class="btn btn-sm btn-danger" onclick="delClient('${c.id}')">ðŸ—‘</button></td></tr>`).join('')}</tbody></table>`) : tableWrap(empty('Sin clientes.'));
}
function clientForm(id, after) {
  const c = id ? S.clients.find(x => x.id === id) : { name: '', taxId: '', email: '', phone: '', address: '' };
  window._afterClient = after;
  openModal(`<form class="p-5 space-y-3" onsubmit="saveClient(event,'${id || ''}')">
    <div class="flex justify-between"><h2 class="text-xl font-bold">${id ? 'Editar' : 'Nuevo'} cliente</h2>${closeBtn}</div>
    <div><label class="lbl">Nombre *</label><input name="name" required class="inp" value="${esc(c.name)}"></div>
    <div class="grid sm:grid-cols-2 gap-3"><div><label class="lbl">CÃ©dula / jurÃ­dico</label><input name="taxId" class="inp" value="${esc(c.taxId)}"></div>
    <div><label class="lbl">TelÃ©fono</label><input name="phone" class="inp" value="${esc(c.phone)}"></div></div>
    <div><label class="lbl">Correo</label><input name="email" type="email" class="inp" value="${esc(c.email)}"></div>
    <div><label class="lbl">DirecciÃ³n</label><textarea name="address" class="inp" rows="2">${esc(c.address)}</textarea></div>
    <div class="flex justify-end gap-2"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">ðŸ’¾ Guardar</button></div></form>`, 'max-w-lg');
}
async function saveClient(e, id) {
  e.preventDefault(); const f = e.target;
  const body = {}; ['name', 'taxId', 'phone', 'email', 'address'].forEach(k => body[k] = f[k].value);
  const r = await act(() => api(id ? 'PUT' : 'POST', 'clients' + (id ? '/' + id : ''), body), 'Cliente guardado');
  if (r) { closeModal(); if (window._afterClient) window._afterClient(r.id); else render(); }
}
async function delClient(id) { if (confirm('Â¿Eliminar este cliente? Los documentos existentes conservan sus datos.') && await act(() => api('DELETE', 'clients/' + id), 'Cliente eliminado')) render(); }

/* =============== PROFORMAS =============== */
function vProformas() {
  $('#view').innerHTML = head('ðŸ“ Proformas (cotizaciones)', `<button class="btn btn-primary" onclick="docEditor('proforma')">ï¼‹ Nueva proforma</button>`) +
    `<div class="card p-3 mb-3 grid sm:grid-cols-2 gap-2"><input class="inp" placeholder="ðŸ” Buscar por nÃºmero o clienteâ€¦" value="${esc(F.pro.q)}" oninput="F.pro.q=this.value;listPro()">
    <select class="inp" onchange="F.pro.st=this.value;listPro()"><option value="">Todos los estados</option>${['vigente', 'facturada', 'anulada'].map(s => `<option value="${s}" ${F.pro.st === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div id="list"></div>`;
  listPro();
}
function listPro() {
  const q = F.pro.q.toLowerCase();
  const rows = [...S.proformas].reverse().filter(p => (!q || (p.number + (p.client?.name || '')).toLowerCase().includes(q)) && (!F.pro.st || p.status === F.pro.st));
  $('#list').innerHTML = rows.length ? tableWrap(`<table class="tbl"><thead><tr><th>NÃºmero</th><th>Fecha</th><th>Cliente</th><th>Vigencia</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(p => `<tr>
    <td class="font-mono font-semibold">${esc(p.number)}</td><td>${fmtDate(p.date)}</td><td>${esc(p.client?.name || 'Sin cliente')}</td><td>${fmtDate(p.validUntil)}</td><td class="font-semibold">${fmt(p.total)}</td><td>${proBadge(p)}${p.invoiceNumber ? ` <span class="text-xs text-slate-400">${esc(p.invoiceNumber)}</span>` : ''}</td>
    <td class="whitespace-nowrap"><button class="btn btn-sm" onclick="showDoc('proforma','${p.id}')">ðŸ‘ Ver</button>${p.status === 'vigente' ? ` <button class="btn btn-sm" onclick="docEditor('proforma','${p.id}')">âœï¸</button> <button class="btn btn-sm btn-primary" onclick="convertForm('${p.id}')">â†’ Factura</button> <button class="btn btn-sm btn-danger" onclick="voidPro('${p.id}')">Anular</button>` : ''}</td></tr>`).join('')}</tbody></table>`) : tableWrap(empty('No hay proformas.'));
}
async function voidPro(id) { if (confirm('Â¿Anular esta proforma?') && await act(() => api('POST', `proformas/${id}/anular`), 'Proforma anulada')) { closeAllModals(); render(); } }
const closeAllModals = () => { $('#modals').innerHTML = ''; };
function convertForm(id) {
  const p = S.proformas.find(x => x.id === id);
  openModal(`<form class="p-5 space-y-3" onsubmit="doConvert(event,'${id}')"><div class="flex justify-between"><h2 class="text-xl font-bold">Convertir ${esc(p.number)} en factura</h2>${closeBtn}</div>
    <p class="text-sm text-slate-400">Se copiarÃ¡n todos los datos y se descontarÃ¡ el inventario automÃ¡ticamente.</p>
    <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Forma de pago</label><select name="pay" class="inp">${PAY.map(x => `<option>${x}</option>`).join('')}</select></div>
    <div><label class="lbl">Estado</label><select name="st" class="inp"><option value="pendiente">Pendiente</option><option value="pagada">Pagada</option></select></div></div>
    <div class="flex justify-end gap-2"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary">Crear factura</button></div></form>`, 'max-w-md');
}
async function doConvert(e, id) {
  e.preventDefault();
  const inv = await act(() => api('POST', `proformas/${id}/convertir`, { payMethod: e.target.pay.value, status: e.target.st.value }), 'Factura creada y stock descontado');
  if (inv) { closeAllModals(); showDoc('invoice', inv.id); render(); }
}

/* =============== FACTURAS =============== */
function vFacturas() {
  const f = F.fac;
  $('#view').innerHTML = head('ðŸ§¾ Facturas', `<button class="btn btn-primary" onclick="docEditor('invoice')">ï¼‹ Nueva factura</button>`) +
    `<div class="card p-3 mb-3 grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
    <input class="inp" placeholder="ðŸ” NÃºmero o clienteâ€¦" value="${esc(f.q)}" oninput="F.fac.q=this.value;listFac()">
    <select class="inp" onchange="F.fac.st=this.value;listFac()"><option value="">Todos los estados</option>${['pendiente', 'pagada', 'anulada'].map(s => `<option ${f.st === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <select class="inp" onchange="F.fac.cli=this.value;listFac()"><option value="">Todos los clientes</option>${S.clients.map(c => `<option value="${c.id}" ${f.cli === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <input type="date" class="inp" title="Desde" value="${f.from}" onchange="F.fac.from=this.value;listFac()"><input type="date" class="inp" title="Hasta" value="${f.to}" onchange="F.fac.to=this.value;listFac()"></div><div id="list"></div>`;
  listFac();
}
const invActions = i => `<button class="btn btn-sm" onclick="showDoc('invoice','${i.id}')">ðŸ‘ Ver</button>` +
  (i.status === 'pendiente' ? ` <button class="btn btn-sm" onclick="setInv('${i.id}','pagada')">âœ” Pagada</button>` : '') +
  (i.status === 'pagada' ? ` <button class="btn btn-sm" onclick="setInv('${i.id}','pendiente')">â†º Pendiente</button>` : '') +
  (i.status !== 'anulada' ? ` <button class="btn btn-sm btn-danger" onclick="setInv('${i.id}','anulada')">Anular</button>` : '');
function listFac() {
  const f = F.fac, q = f.q.toLowerCase();
  const rows = [...S.invoices].reverse().filter(i => (!q || (i.number + (i.client?.name || '')).toLowerCase().includes(q)) && (!f.st || i.status === f.st) && (!f.cli || i.clientId === f.cli) && (!f.from || i.date >= f.from) && (!f.to || i.date <= f.to));
  const tot = rows.filter(i => i.status !== 'anulada').reduce((a, i) => a + i.total, 0);
  $('#list').innerHTML = rows.length ? tableWrap(`<table class="tbl"><thead><tr><th>NÃºmero</th><th>EmisiÃ³n</th><th>Vence</th><th>Cliente</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(i => `<tr>
    <td class="font-mono font-semibold">${esc(i.number)}</td><td>${fmtDate(i.date)}</td><td>${fmtDate(i.dueDate)}</td><td>${esc(i.client?.name || 'Contado')}</td><td class="font-semibold">${fmt(i.total)}</td><td>${invBadge(i)}</td><td class="whitespace-nowrap">${invActions(i)}</td></tr>`).join('')}</tbody></table><div class="p-3 text-right text-sm text-slate-300">Total listado (sin anuladas): <b class="text-cyan-300">${fmt(tot)}</b></div>`) : tableWrap(empty('No hay facturas.'));
}
async function setInv(id, st) {
  const msg = st === 'anulada' ? 'Â¿Anular la factura? El stock serÃ¡ devuelto al inventario y no se podrÃ¡ reactivar.' : null;
  if ((!msg || confirm(msg)) && await act(() => api('PUT', `invoices/${id}/status`, { status: st }), 'Factura actualizada')) { closeAllModals(); render(); }
}
function vCobrar() {
  const rows = S.invoices.filter(i => i.status === 'pendiente').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const tot = rows.reduce((a, i) => a + i.total, 0), venc = rows.filter(i => i.dueDate < todayStr()).reduce((a, i) => a + i.total, 0);
  $('#view').innerHTML = head('ðŸ’° Cuentas por cobrar') + `<div class="grid grid-cols-2 gap-3 mb-4"><div class="card p-4"><div class="text-xs text-slate-400 uppercase">Total pendiente</div><div class="text-2xl font-extrabold text-amber-300">${fmt(tot)}</div></div><div class="card p-4"><div class="text-xs text-slate-400 uppercase">Vencido</div><div class="text-2xl font-extrabold text-red-300">${fmt(venc)}</div></div></div>` +
    (rows.length ? tableWrap(`<table class="tbl"><thead><tr><th>NÃºmero</th><th>Cliente</th><th>TelÃ©fono</th><th>Vence</th><th>Total</th><th></th></tr></thead><tbody>${rows.map(i => `<tr><td class="font-mono font-semibold">${esc(i.number)}</td><td>${esc(i.client?.name || 'Contado')}</td><td>${esc(i.client?.phone || '')}</td><td>${fmtDate(i.dueDate)} ${i.dueDate < todayStr() ? badge('Vencida', 'red') : ''}</td><td class="font-semibold">${fmt(i.total)}</td><td class="whitespace-nowrap">${invActions(i)}</td></tr>`).join('')}</tbody></table>`) : tableWrap(empty('ðŸŽ‰ No hay cuentas pendientes.')));
}

/* =============== EDITOR DE PROFORMAS / FACTURAS =============== */
let E = null;
function docEditor(kind, id) {
  const s = S.settings, t = todayStr();
  if (id) {
    const d = (kind === 'invoice' ? S.invoices : S.proformas).find(x => x.id === id);
    E = JSON.parse(JSON.stringify(d)); E.kind = kind; E.lines.forEach(l => { l.price = num(l.price); });
  } else E = { kind, id: null, clientId: '', date: t, validUntil: addDays(t, s.validDays || 15), dueDate: addDays(t, s.dueDays || 15), payMethod: 'Efectivo', status: 'pendiente', notes: '', discPct: 0, ivaPct: s.iva, lines: [] };
  const inv = kind === 'invoice';
  const m = openModal(`<div class="p-4 sm:p-5 space-y-4">
    <div class="flex justify-between items-center"><h2 class="text-xl font-bold">${id ? 'Editar' : 'Nueva'} ${inv ? 'factura' : 'proforma'}</h2>${closeBtn}</div>
    <div class="grid md:grid-cols-2 gap-3">
      <div class="relative"><label class="lbl">Cliente</label><div id="cliBox"></div><div id="cliDd" class="dd hidden"></div></div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="lbl">Fecha</label><input type="date" class="inp" value="${E.date}" onchange="E.date=this.value"></div>
        ${inv ? `<div><label class="lbl">Vencimiento</label><input type="date" class="inp" value="${E.dueDate}" onchange="E.dueDate=this.value"></div>
        <div><label class="lbl">Forma de pago</label><select class="inp" onchange="E.payMethod=this.value">${PAY.map(x => `<option ${E.payMethod === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div><label class="lbl">Estado</label><select class="inp" onchange="E.status=this.value"><option value="pendiente" ${E.status === 'pendiente' ? 'selected' : ''}>Pendiente</option><option value="pagada" ${E.status === 'pagada' ? 'selected' : ''}>Pagada</option></select></div>`
          : `<div><label class="lbl">Vigente hasta</label><input type="date" class="inp" value="${E.validUntil}" onchange="E.validUntil=this.value"></div>`}
      </div></div>
    <div class="relative"><label class="lbl">Agregar artÃ­culo (busque por nombre o cÃ³digo)</label><input id="pSearch" class="inp" placeholder="ðŸ” Escriba para buscar en el inventarioâ€¦" autocomplete="off" oninput="prodSearch()" onfocus="prodSearch()"><div id="proDd" class="dd hidden"></div></div>
    <div id="eLines" class="overflow-x-auto"></div>
    <div class="grid md:grid-cols-2 gap-4">
      <div><label class="lbl">Notas</label><textarea class="inp" rows="3" oninput="E.notes=this.value" placeholder="Condiciones, observacionesâ€¦">${esc(E.notes)}</textarea></div>
      <div class="card p-3 space-y-1.5 text-sm"><div class="grid grid-cols-2 gap-2 mb-2"><div><label class="lbl">Descuento global %</label><input type="number" min="0" max="100" step="0.01" class="inp" value="${E.discPct || 0}" oninput="E.discPct=num(this.value);totals()"></div><div><label class="lbl">IVA %</label><input type="number" min="0" step="0.01" class="inp" value="${E.ivaPct}" oninput="E.ivaPct=num(this.value);totals()"></div></div><div id="eTot"></div></div></div>
    <div class="flex justify-end gap-2"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="saveDoc()">ðŸ’¾ Guardar ${inv ? 'y descontar stock' : ''}</button></div></div>`, 'max-w-5xl');
  m.dataset.lock = '1';
  cliBox(); eLines(); totals();
  m.addEventListener('click', e => { if (!e.target.closest('#cliBox,#cliDd')) $('#cliDd')?.classList.add('hidden'); if (!e.target.closest('#pSearch,#proDd')) $('#proDd')?.classList.add('hidden'); });
}
function cliBox() {
  const c = S.clients.find(x => x.id === E.clientId) || E.client;
  $('#cliBox').innerHTML = E.clientId && c ? `<div class="inp flex justify-between items-center"><span>${esc(c.name)} <span class="text-slate-400 text-xs">${esc(c.taxId || '')}</span></span><button class="text-red-300" onclick="E.clientId='';E.client=null;cliBox()">âœ•</button></div>`
    : `<input class="inp" placeholder="ðŸ” Buscar cliente o dejar vacÃ­o (contado)â€¦" autocomplete="off" oninput="cliSearch(this.value)" onfocus="cliSearch(this.value)">`;
}
function cliSearch(q) {
  q = q.toLowerCase(); const dd = $('#cliDd');
  const r = S.clients.filter(c => !q || (c.name + c.taxId + c.phone).toLowerCase().includes(q)).slice(0, 8);
  dd.innerHTML = r.map(c => `<div onclick="E.clientId='${c.id}';cliBox();$('#cliDd').classList.add('hidden')">${esc(c.name)} <span class="text-slate-400 text-xs">${esc(c.taxId)}</span></div>`).join('') +
    `<div class="text-cyan-300" onclick="clientForm(null,id=>{E.clientId=id;cliBox()})">âž• Crear cliente nuevo</div>`;
  dd.classList.remove('hidden');
}
function prodSearch() {
  const el = $('#pSearch'), q = el.value.toLowerCase().trim(), dd = $('#proDd');
  const r = S.products.filter(p => !q || (p.name + p.code + p.category).toLowerCase().includes(q)).slice(0, 10);
  dd.innerHTML = r.map(p => `<div onclick="addLine('${p.id}')"><b>${esc(p.code)}</b> Â· ${esc(p.name)} <span class="float-right text-xs">${fmt(p.price)} ${p.type === 'servicio' ? 'Â· servicio' : `Â· stock ${p.stock}`}</span></div>`).join('') +
    (q ? `<div class="text-cyan-300" onclick="addLine(null,'${esc(el.value).replace(/'/g, '')}')">âž• Agregar "${esc(el.value)}" como lÃ­nea libre</div>` : '');
  dd.classList.remove('hidden');
}
function addLine(pid, name) {
  if (pid) {
    const ex = E.lines.find(l => l.productId === pid), p = prodById(pid);
    if (ex) ex.qty++; else E.lines.push({ productId: pid, code: p.code, name: p.name, qty: 1, price: p.price, discPct: 0 });
  } else E.lines.push({ productId: null, code: '', name, qty: 1, price: 0, discPct: 0 });
  $('#pSearch').value = ''; $('#proDd').classList.add('hidden'); eLines(); totals();
}
function eLines() {
  $('#eLines').innerHTML = E.lines.length ? `<table class="tbl"><thead><tr><th>ArtÃ­culo</th><th style="width:90px">Cant.</th><th style="width:130px">Precio</th><th style="width:90px">Desc. %</th><th class="text-right">Total</th><th></th></tr></thead><tbody>${E.lines.map((l, i) => `<tr>
    <td>${l.productId ? `<div class="font-semibold">${esc(l.name)}</div><div class="text-xs text-slate-400">${esc(l.code)}${E.kind === 'invoice' && prodById(l.productId)?.type === 'producto' ? ' Â· stock ' + prodById(l.productId).stock : ''}</div>` : `<input class="inp" value="${esc(l.name)}" oninput="E.lines[${i}].name=this.value">`}</td>
    <td><input type="number" min="0.01" step="any" class="inp" value="${l.qty}" oninput="E.lines[${i}].qty=num(this.value);totals()"></td>
    <td><input type="number" min="0" step="0.01" class="inp" value="${l.price}" oninput="E.lines[${i}].price=num(this.value);totals()"></td>
    <td><input type="number" min="0" max="100" step="0.01" class="inp" value="${l.discPct || 0}" oninput="E.lines[${i}].discPct=num(this.value);totals()"></td>
    <td class="text-right font-semibold" id="lt${i}"></td><td><button class="btn btn-sm btn-danger" onclick="E.lines.splice(${i},1);eLines();totals()">âœ•</button></td></tr>`).join('')}</tbody></table>` : empty('Busque y agregue artÃ­culos del inventario.');
}
function calcDoc(d) {
  let sub = 0;
  d.lines.forEach(l => { l._t = r2(l.qty * l.price * (1 - (l.discPct || 0) / 100)); sub += l._t; });
  const disc = r2(sub * (d.discPct || 0) / 100), tax = r2((sub - disc) * (d.ivaPct || 0) / 100);
  return { sub: r2(sub), disc, tax, total: r2(sub - disc + tax) };
}
function totals() {
  const t = calcDoc(E);
  E.lines.forEach((l, i) => { const c = $('#lt' + i); if (c) c.textContent = fmt(l._t); });
  $('#eTot').innerHTML = `<div class="flex justify-between"><span>Subtotal</span><b>${fmt(t.sub)}</b></div><div class="flex justify-between"><span>Descuento</span><b>- ${fmt(t.disc)}</b></div><div class="flex justify-between"><span>IVA (${E.ivaPct}%)</span><b>${fmt(t.tax)}</b></div><div class="flex justify-between text-lg border-t border-white/10 pt-1.5"><span>TOTAL</span><b class="text-cyan-300">${fmt(t.total)}</b></div>`;
}
async function saveDoc() {
  if (!E.lines.length) return toast('Agregue al menos un artÃ­culo', true);
  const inv = E.kind === 'invoice', body = { ...E }; delete body.client;
  const path = inv ? 'invoices' : 'proformas' + (E.id ? '/' + E.id : '');
  const d = await act(() => api(!inv && E.id ? 'PUT' : 'POST', path, body), inv ? 'Factura creada' : 'Proforma guardada');
  if (d) { closeAllModals(); showDoc(E.kind, d.id); render(); }
}

/* =============== VISTA / IMPRESIÃ“N / PDF DE DOCUMENTOS =============== */
function letterhead() {
  const s = S.settings;
  return `<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
    <div style="display:flex;gap:12px;align-items:center">${s.logo ? `<img src="${esc(s.logo)}" style="height:64px;max-width:110px;object-fit:contain">` : ''}
    <div><h1>${esc(s.name)}</h1><div style="color:#4b5563">${esc(s.slogan)}</div><div style="font-size:11px;color:#374151">${esc(s.taxId)}</div></div></div>
    <div style="text-align:right;font-size:11px;color:#374151">${esc(s.address)}<br>Tel: ${esc(s.phones)}<br>${esc(s.emails)}</div></div><div class="accent"></div>`;
}
function docHTML(kind, d) {
  const inv = kind === 'invoice', s = S.settings, c = d.client;
  const st = inv ? { pendiente: 'PENDIENTE', pagada: 'PAGADA', anulada: 'ANULADA' }[d.status] : { vigente: 'VIGENTE', facturada: 'FACTURADA', anulada: 'ANULADA' }[d.status];
  return `<div class="paper" style="position:relative">${letterhead()}
    <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:14px">
      <div style="flex:1"><div style="font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:700">Cliente</div>
        <div style="font-weight:700;font-size:14px">${esc(c?.name || 'Cliente de contado')}</div>${c ? `<div>${esc(c.taxId || '')}</div><div>${esc(c.address || '')}</div><div>${esc(c.phone || '')} ${esc(c.email || '')}</div>` : ''}</div>
      <div style="text-align:right"><div style="font-size:20px;font-weight:800;color:#4f46e5">${inv ? 'FACTURA' : 'PROFORMA'}</div><div style="font-size:15px;font-weight:700">${esc(d.number)}</div>
        <div>Fecha: <b>${fmtDate(d.date)}</b></div>${inv ? `<div>Vence: <b>${fmtDate(d.dueDate)}</b></div><div>Forma de pago: <b>${esc(d.payMethod)}</b></div>${d.proformaNumber ? `<div>Ref. proforma: ${esc(d.proformaNumber)}</div>` : ''}` : `<div>Vigente hasta: <b>${fmtDate(d.validUntil)}</b></div>`}
        <div style="margin-top:4px;font-weight:700;color:${d.status === 'anulada' ? '#dc2626' : '#059669'}">${st}</div></div></div>
    <table><thead><tr><th>CÃ³digo</th><th>DescripciÃ³n</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Desc.</th><th class="r">Total</th></tr></thead><tbody>
    ${d.lines.map(l => `<tr><td>${esc(l.code)}</td><td>${esc(l.name)}</td><td class="r">${l.qty}</td><td class="r">${fmt(l.price)}</td><td class="r">${l.discPct ? l.discPct + '%' : 'â€”'}</td><td class="r">${fmt(l.total)}</td></tr>`).join('')}</tbody></table>
    <div style="display:flex;justify-content:space-between;gap:20px;margin-top:14px">
      <div style="flex:1;font-size:11.5px">${d.notes ? `<b>Notas:</b><br>${esc(d.notes).replace(/\n/g, '<br>')}<br><br>` : ''}${inv && s.payInfo ? `<b>Datos de pago:</b><br>${esc(s.payInfo)}` : ''}</div>
      <table style="width:260px"><tr><td>Subtotal</td><td class="r">${fmt(d.subtotal)}</td></tr>${d.discount ? `<tr><td>Descuento (${d.discPct}%)</td><td class="r">- ${fmt(d.discount)}</td></tr>` : ''}<tr><td>IVA (${d.ivaPct}%)</td><td class="r">${fmt(d.tax)}</td></tr>
      <tr><td style="font-weight:800;font-size:15px;border-bottom:0">TOTAL</td><td class="r" style="font-weight:800;font-size:15px;border-bottom:0">${fmt(d.total)}</td></tr></table></div>
    <div class="accent" style="margin-top:22px"></div><div style="font-size:10.5px;color:#4b5563;text-align:center">${esc(s.terms)}</div></div>`;
}
function showDoc(kind, id) {
  const d = (kind === 'invoice' ? S.invoices : S.proformas).find(x => x.id === id); if (!d) return;
  const acts = kind === 'proforma' ? (d.status === 'vigente' ? `<button class="btn btn-sm" onclick="closeAllModals();docEditor('proforma','${id}')">âœï¸ Editar</button><button class="btn btn-sm btn-primary" onclick="closeAllModals();convertForm('${id}')">â†’ Convertir en factura</button><button class="btn btn-sm btn-danger" onclick="voidPro('${id}')">Anular</button>` : '')
    : (d.status === 'pendiente' ? `<button class="btn btn-sm" onclick="setInv('${id}','pagada')">âœ” Marcar pagada</button>` : '') + (d.status !== 'anulada' ? `<button class="btn btn-sm btn-danger" onclick="setInv('${id}','anulada')">Anular</button>` : '');
  const m = openModal(`<div class="p-3 sm:p-4"><div class="flex flex-wrap gap-2 mb-3 items-center"><button class="btn btn-sm btn-primary" onclick="printHTML($('#docPaper').innerHTML)">ðŸ–¨ Imprimir</button><button class="btn btn-sm btn-primary" onclick="pdfOf('docPaper','${esc(d.number)}')">â¬‡ PDF</button>${acts}<span class="flex-1"></span>${closeBtn}</div>
    <div class="overflow-auto rounded-xl"><div id="docPaper" style="min-width:720px">${docHTML(kind, d)}</div></div></div>`, 'max-w-4xl');
}
function printHTML(html) { $('#printRoot').innerHTML = html; setTimeout(() => window.print(), 150); }
function pdfOf(elId, name) {
  if (!window.html2pdf) return toast('El generador de PDF no cargÃ³ (Â¿sin internet?). Use Imprimir y elija "Guardar como PDF".', true);
  html2pdf().set({ margin: 8, filename: name + '.pdf', image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' } }).from($('#' + elId)).save();
}

/* =============== REPORTES =============== */
const R = { tab: 'dia', from: todayStr().slice(0, 8) + '01', to: todayStr() };
const TABS = [['dia', 'Ventas por dÃ­a'], ['mes', 'Ventas por mes'], ['top', 'MÃ¡s vendidos'], ['stock', 'Estado del inventario'], ['cobrar', 'Cuentas por cobrar']];
function reportData() {
  const inRange = S.invoices.filter(i => i.status !== 'anulada' && i.date >= R.from && i.date <= R.to);
  const group = len => {
    const g = {}; inRange.forEach(i => { const k = i.date.slice(0, len); (g[k] = g[k] || { n: 0, sub: 0, tax: 0, tot: 0, paid: 0 }); g[k].n++; g[k].sub += i.subtotal - i.discount; g[k].tax += i.tax; g[k].tot += i.total; if (i.status === 'pagada') g[k].paid += i.total; });
    return Object.keys(g).sort().map(k => [len === 10 ? fmtDate(k) : k, g[k].n, g[k].sub, g[k].tax, g[k].tot, g[k].paid]);
  };
  const sumRow = rows => ['TOTAL', rows.reduce((a, r) => a + r[1], 0), ...[2, 3, 4, 5].map(i => rows.reduce((a, r) => a + r[i], 0))];
  if (R.tab === 'dia' || R.tab === 'mes') {
    const rows = group(R.tab === 'dia' ? 10 : 7);
    return { title: 'Ventas por ' + (R.tab === 'dia' ? 'dÃ­a' : 'mes'), head: [R.tab === 'dia' ? 'Fecha' : 'Mes', 'Facturas', 'Subtotal neto', 'IVA', 'Total', 'Cobrado'], money: [2, 3, 4, 5], rows, foot: rows.length ? sumRow(rows) : null, chart: rows.map(r => [r[0], r[4]]) };
  }
  if (R.tab === 'top') {
    const g = {}; inRange.forEach(i => i.lines.forEach(l => { const k = l.code + '|' + l.name; (g[k] = g[k] || { c: l.code, n: l.name, q: 0, t: 0 }); g[k].q += l.qty; g[k].t += l.total; }));
    const rows = Object.values(g).sort((a, b) => b.t - a.t).slice(0, 25).map(x => [x.c, x.n, x.q, x.t]);
    return { title: 'Productos y servicios mÃ¡s vendidos', head: ['CÃ³digo', 'ArtÃ­culo', 'Cantidad', 'Monto vendido'], money: [3], rows, foot: null, chart: rows.slice(0, 10).map(r => [r[1], r[3]]) };
  }
  if (R.tab === 'stock') {
    const ps = S.products.filter(p => p.type === 'producto');
    const rows = ps.map(p => [p.code, p.name, p.category, p.stock, p.min, p.cost * p.stock, p.price * p.stock, lowStock(p) ? 'STOCK BAJO' : 'OK']);
    return { title: 'Estado del inventario', head: ['CÃ³digo', 'ArtÃ­culo', 'CategorÃ­a', 'Stock', 'MÃ­nimo', 'Valor a costo', 'Valor a venta', 'Estado'], money: [5, 6], rows, foot: ['TOTAL', '', '', rows.reduce((a, r) => a + r[3], 0), '', rows.reduce((a, r) => a + r[5], 0), rows.reduce((a, r) => a + r[6], 0), ''], noRange: true };
  }
  const p = S.invoices.filter(i => i.status === 'pendiente').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const rows = p.map(i => [i.number, i.client?.name || 'Contado', fmtDate(i.date), fmtDate(i.dueDate), i.dueDate < todayStr() ? 'VENCIDA' : 'Al dÃ­a', i.total]);
  return { title: 'Cuentas por cobrar', head: ['Factura', 'Cliente', 'EmisiÃ³n', 'Vence', 'Estado', 'Total'], money: [5], rows, foot: rows.length ? ['TOTAL', '', '', '', '', p.reduce((a, i) => a + i.total, 0)] : null, noRange: true };
}
const cell = (v, i, money) => money.includes(i) ? fmt(v) : esc(v);
function reportTable(r) {
  if (!r.rows.length) return empty('Sin datos para este reporte / rango.');
  const max = Math.max(...(r.chart || []).map(c => c[1]), 1);
  return `<table class="tbl"><thead><tr>${r.head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${r.rows.map(x => `<tr>${x.map((v, i) => `<td>${cell(v, i, r.money)}</td>`).join('')}</tr>`).join('')}</tbody>
    ${r.foot ? `<tfoot><tr>${r.foot.map((v, i) => `<td class="font-bold text-cyan-300">${v === '' ? '' : cell(v, i, r.money)}</td>`).join('')}</tr></tfoot>` : ''}</table>` +
    (r.chart ? `<div class="p-4 space-y-1.5">${r.chart.map(c => `<div class="flex items-center gap-2 text-xs"><span class="w-28 truncate">${esc(c[0])}</span><div class="flex-1"><div class="bar" style="width:${Math.max(2, c[1] / max * 100)}%"></div></div><span>${fmt(c[1])}</span></div>`).join('')}</div>` : '');
}
function vReportes() {
  $('#view').innerHTML = head('ðŸ“Š Reportes', `<button class="btn btn-primary" onclick="exportXls()">ðŸ“— Excel</button><button class="btn btn-primary" onclick="exportPdf()">ðŸ“• PDF</button><button class="btn" onclick="printReport()">ðŸ–¨ Imprimir</button>`) +
    `<div class="flex flex-wrap gap-2 mb-3">${TABS.map(([k, t]) => `<button class="btn ${R.tab === k ? 'btn-primary' : ''}" onclick="R.tab='${k}';vReportes()">${t}</button>`).join('')}</div>
    <div class="card p-3 mb-3 flex flex-wrap items-end gap-3 ${['stock', 'cobrar'].includes(R.tab) ? 'hidden' : ''}"><div><label class="lbl">Desde</label><input type="date" class="inp" value="${R.from}" onchange="R.from=this.value;vReportes()"></div><div><label class="lbl">Hasta</label><input type="date" class="inp" value="${R.to}" onchange="R.to=this.value;vReportes()"></div><div class="text-xs text-slate-400">Las facturas anuladas no cuentan como ventas.</div></div>
    <div class="card overflow-x-auto">${reportTable(reportData())}</div>`;
}
function reportPaper() {
  const r = reportData(), s = S.settings;
  const rng = r.noRange ? `Al ${fmtDate(todayStr())}` : `Del ${fmtDate(R.from)} al ${fmtDate(R.to)}`;
  return `<div class="paper" id="reportPaper">${letterhead()}<h1 style="font-size:17px">${r.title}</h1><div style="color:#6b7280;margin-bottom:10px">${rng} Â· Generado ${new Date().toLocaleString('es-CR')}</div>
    <table><thead><tr>${r.head.map((h, i) => `<th class="${r.money.includes(i) ? 'r' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${r.rows.map(x => `<tr>${x.map((v, i) => `<td class="${r.money.includes(i) ? 'r' : ''}">${cell(v, i, r.money)}</td>`).join('')}</tr>`).join('')}
    ${r.foot ? `<tr>${r.foot.map((v, i) => `<td class="${r.money.includes(i) ? 'r' : ''}" style="font-weight:800">${v === '' ? '' : cell(v, i, r.money)}</td>`).join('')}</tr>` : ''}</tbody></table></div>`;
}
function printReport() { printHTML(reportPaper()); }
function exportPdf() {
  const h = document.createElement('div'); h.id = 'tmpRep'; h.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px'; h.innerHTML = reportPaper(); document.body.appendChild(h);
  const done = () => h.remove();
  if (!window.html2pdf) { done(); return toast('El generador de PDF no cargÃ³. Use Imprimir â†’ Guardar como PDF.', true); }
  html2pdf().set({ margin: 8, filename: 'reporte-' + R.tab + '-' + todayStr() + '.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(h).save().then(done, done);
}
function exportXls() {
  const r = reportData(), cellX = (v, i) => r.money.includes(i) ? `<td x:num>${v}</td>` : `<td>${esc(v)}</td>`;
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1"><tr><td colspan="${r.head.length}"><b>${esc(S.settings.name)} - ${r.title}</b></td></tr>
    <tr>${r.head.map(h => `<th>${h}</th>`).join('')}</tr>${r.rows.map(x => `<tr>${x.map(cellX).join('')}</tr>`).join('')}${r.foot ? `<tr>${r.foot.map((v, i) => v === '' ? '<td></td>' : `<td${r.money.includes(i) ? ' x:num' : ''}><b>${r.money.includes(i) ? v : esc(v)}</b></td>`).join('')}</tr>` : ''}</table></body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' }));
  a.download = 'reporte-' + R.tab + '-' + todayStr() + '.xls'; a.click(); URL.revokeObjectURL(a.href);
}

/* =============== CONFIGURACIÃ“N =============== */
function vConfig() {
  const s = S.settings, f = (k, l, ph = '') => `<div><label class="lbl">${l}</label><input name="${k}" class="inp" value="${esc(s[k])}" placeholder="${ph}"></div>`;
  $('#view').innerHTML = head('âš™ï¸ ConfiguraciÃ³n') + `<div class="grid lg:grid-cols-3 gap-4">
    <form class="card p-4 space-y-3 lg:col-span-2" onsubmit="saveSettings(event)"><h2 class="font-bold">Datos de la empresa <span class="text-xs text-slate-400">(aparecen en proformas, facturas y reportes)</span></h2>
      <div class="grid sm:grid-cols-2 gap-3">${f('name', 'Nombre')}${f('slogan', 'Eslogan')}${f('taxId', 'CÃ©dula jurÃ­dica / datos fiscales')}${f('address', 'UbicaciÃ³n / direcciÃ³n')}${f('phones', 'TelÃ©fonos')}${f('emails', 'Correos')}</div>
      <div><label class="lbl">Logo</label>${imgField('logo', s.logo)}</div>
      <div class="grid sm:grid-cols-3 gap-3"><div><label class="lbl">Moneda</label><select name="currency" class="inp"><option value="CRC" ${s.currency === 'CRC' ? 'selected' : ''}>Colones â‚¡</option><option value="USD" ${s.currency === 'USD' ? 'selected' : ''}>DÃ³lares $</option></select></div>
      <div><label class="lbl">IVA por defecto %</label><input name="iva" type="number" step="0.01" class="inp" value="${s.iva}"></div>
      <div><label class="lbl">Vigencia proforma (dÃ­as)</label><input name="validDays" type="number" class="inp" value="${s.validDays}"></div>
      <div><label class="lbl">Plazo factura (dÃ­as)</label><input name="dueDays" type="number" class="inp" value="${s.dueDays}"></div>${f('proformaPrefix', 'Prefijo proformas')}${f('invoicePrefix', 'Prefijo facturas')}</div>
      <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer"><input type="checkbox" name="showVideo" class="accent-cyan-400" ${s.showVideo === false ? '' : 'checked'}> Mostrar fondo animado de la empresa</label>
      <div><label class="lbl">Datos de pago (SINPE, cuentasâ€¦)</label><textarea name="payInfo" class="inp" rows="2">${esc(s.payInfo)}</textarea></div>
      <div><label class="lbl">TÃ©rminos y condiciones (pie del documento)</label><textarea name="terms" class="inp" rows="3">${esc(s.terms)}</textarea></div>
      <button class="btn btn-primary">ðŸ’¾ Guardar cambios</button></form>
    <div class="space-y-4">
      <div class="card p-4 space-y-3"><h2 class="font-bold">ðŸ’¾ Copia de seguridad</h2><p class="text-sm text-slate-400">Descarga todos los datos e imÃ¡genes en un archivo. El servidor ademÃ¡s guarda una copia automÃ¡tica diaria.</p>
        <a class="btn btn-primary" href="api/backup">â¬‡ Descargar respaldo</a>
        <label class="btn cursor-pointer">â¬† Restaurar respaldo<input type="file" accept=".json" class="hidden" onchange="restore(this)"></label></div>
      <form class="card p-4 space-y-3" onsubmit="saveBase(event)"><h2 class="font-bold">ðŸ”’ URL secreta</h2><p class="text-sm text-slate-400">Ruta actual: <b class="text-white">${esc(S.base)}/</b><br>CÃ¡mbiela si cree que alguien la conoce. DespuÃ©s de guardar, el sistema le llevarÃ¡ a la nueva direcciÃ³n (guÃ¡rdela en favoritos).</p>
        <input name="p" class="inp" value="${esc(S.base)}"><button class="btn">Cambiar URL</button></form></div></div>`;
}
async function saveSettings(e) {
  e.preventDefault(); const f = e.target, b = { logo: IMG.logo, showVideo: f.showVideo.checked };
  ['name', 'slogan', 'taxId', 'address', 'phones', 'emails', 'currency', 'iva', 'validDays', 'dueDays', 'proformaPrefix', 'invoicePrefix', 'payInfo', 'terms'].forEach(k => b[k] = f[k].value);
  if (await act(() => api('PUT', 'settings', b), 'ConfiguraciÃ³n guardada')) render();
}
async function saveBase(e) {
  e.preventDefault();
  if (!confirm('Â¿Cambiar la URL secreta? La direcciÃ³n anterior dejarÃ¡ de funcionar.')) return;
  try { const r = await api('PUT', 'config', { secretPath: e.target.p.value }); location.href = r.base + '/'; } catch (x) { toast(x.message, true); }
}
function restore(input) {
  const f = input.files[0]; if (!f || !confirm('Esto reemplazarÃ¡ TODOS los datos actuales con los del respaldo. Â¿Continuar?')) return;
  const fr = new FileReader();
  fr.onload = async () => { try { await api('POST', 'restore', JSON.parse(fr.result)); await load(); render(); toast('Respaldo restaurado'); } catch (e) { toast(e.message, true); } };
  fr.readAsText(f);
}

/* =============== Inicio =============== */
(async () => { try { await load(); render(); setInterval(poll, 4000); } catch (e) { $('#view').innerHTML = '<div class="card p-6">No se pudo conectar con el servidor.</div>'; } })();

