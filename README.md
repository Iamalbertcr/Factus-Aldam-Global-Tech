# ALDAM GLOBAL TECH · Sistema de Inventario, Facturación y Proformas

Sistema web completo para **ALDAM GLOBAL TECH** — Técnicos en Tecnologías de la Información (Costa Rica).
Gestiona inventario, clientes, proformas (cotizaciones), facturas, cuentas por cobrar y reportes.
**Sin login ni contraseña:** se accede únicamente por una URL secreta. Todos los datos se guardan en el servidor.

## Requisitos

- [Node.js 18 o superior](https://nodejs.org) (cualquier hosting con Node.js sirve).
- Navegador moderno (Chrome, Edge, Firefox, Safari).
- Internet en el navegador para cargar Tailwind (CDN) y el generador de PDF opcional.

## Instalación (local o hosting)

1. Suba la carpeta completa a su servidor o computadora.
2. Ejecute:
   ```
   npm install
   npm start
   ```
3. Abra `http://localhost:3000/sistema/` (o `http://su-dominio.com/sistema/`).

Al primer arranque se crean automáticamente: los datos de la empresa, 14 productos y servicios
de ejemplo (redes, CCTV, soporte, impresoras), 6 clientes, facturas y proformas de prueba.
Para empezar desde cero, elimine los registros desde el sistema o borre la carpeta `data/`
con el servidor apagado (se regeneran los ejemplos).

## Despliegue en hosting

- **cPanel (Setup Node.js App), Render, Railway, VPS:** suba la carpeta, `npm install`, comando de inicio `node server.js`. El puerto se toma de la variable `PORT`.
- **VPS:** use `pm2 start server.js --name aldam` y un proxy (Nginx/Caddy) con HTTPS hacia el puerto 3000. **Use HTTPS**, ya que el acceso es por URL secreta sin contraseña.
- La carpeta `data/` debe ser persistente. En Render/Railway monte un disco y use `DATA_DIR=/ruta/disco`.
- Zona horaria: `America/Costa_Rica` por defecto (variable `TZ` para cambiarla).

## URL secreta

- La ruta actual es `/sistema` (ver archivo `data/config.json`).
- Cámbiela desde el sistema: **Configuración → URL secreta** (la anterior deja de funcionar al instante).
- O edite `data/config.json` (`"secretPath": "/mi-ruta-privada"`) y reinicie.
- Cualquier otra ruta del servidor responde 404; no existe ningún enlace público al sistema.
  Elija una ruta larga y difícil de adivinar (ej.: `/mi-aldam-2026-x7k`).

## Módulos

- **Inicio:** resumen de ventas del mes, cuentas por cobrar, alertas de stock bajo y últimas facturas.
- **Inventario:** productos y servicios con código, categoría, precios, stock e imagen. Buscador y filtros.
  Alertas de "stock bajo". Entradas (compras) y salidas con historial de movimientos por artículo.
- **Clientes:** registro con cédula/jurídico, correo, teléfono y dirección; buscador rápido para reutilizarlos.
- **Proformas:** numeración consecutiva (PF-), cliente, artículos del inventario con búsqueda rápida,
  descuentos por línea y global, IVA, vigencia y notas. Cálculo automático de totales.
  Edición, anulación y **"Convertir en factura"** (pasa todos los datos y descuenta el inventario).
- **Facturas:** numeración consecutiva (FA-), desde cero o desde una proforma. Estados pendiente / pagada / anulada,
  fechas de emisión y vencimiento, forma de pago. Filtros por fecha, cliente y estado.
  Facturar descuenta el stock; anular una factura lo devuelve.
- **Por cobrar:** listado de facturas pendientes con total general y monto vencido.
- **Impresión y PDF:** cada proforma y factura se ve, imprime y exporta en PDF (carta/A4) con el encabezado
  de la empresa (logo, nombre, dirección, teléfonos, correos y datos fiscales), detalle, totales y términos.
- **Reportes:** ventas por día/mes, productos más vendidos, estado del inventario y cuentas por cobrar;
  exportación a Excel y PDF. Las facturas anuladas no cuentan como ventas.
- **Configuración:** datos de la empresa (editables, aparecen en todos los documentos), logo, moneda
  (colones ₡ o USD), IVA, prefijos de numeración, plazos, datos de pago, términos y fondo animado.

## Copias de seguridad

- **Configuración → Descargar respaldo:** un solo archivo con todos los datos e imágenes.
- **Restaurar respaldo** lo reimporta (pide confirmación).
- El servidor guarda además una copia automática diaria en `data/backups/` (últimos 14 días).

## Estructura de archivos

- `server.js` — servidor y API (Express), comentado.
- `public/index.html`, `public/app.js` — interfaz (HTML/JS + Tailwind).
- `public/fondo.mp4` — fondo animado de la empresa (opcional, se puede quitar en Configuración).
- `seed/logo.png` — logo de ejemplo que se instala en el primer arranque.
- `data/db.json` — todos los datos (se crea solo). `data/uploads/` — imágenes. `data/config.json` — URL secreta.

## Notas

- Sincronización en tiempo real: la interfaz se actualiza sola cada pocos segundos si otro dispositivo hizo cambios.
- Las proformas y facturas son documentos internos de trabajo; no son comprobantes electrónicos autorizados por Hacienda.
- Los servicios no manejan inventario (no descontan stock).
