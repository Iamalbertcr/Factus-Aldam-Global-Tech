# ALDAM GLOBAL TECH · Sistema de Inventario, Facturación y Proformas

Node.js + Express, datos en JSON dentro del servidor (`data/`), interfaz HTML/JS + Tailwind. Sin login: se accede **solo** por una URL secreta.

## Instalación local
1. Instalar [Node.js 18+](https://nodejs.org).
2. En esta carpeta: `npm install` y luego `npm start`.
3. Abrir `http://localhost:3000/sistema/`.

Al primer arranque se crean datos de ejemplo (empresa, 14 productos/servicios de redes, CCTV, soporte e impresoras, 4 clientes, 1 factura y 1 proforma). Para empezar limpio, borre la carpeta `data/` con el servidor apagado (se regenera con los ejemplos) o elimine los registros desde el sistema.

## Despliegue en un hosting
- **Hosting con Node.js (cPanel "Setup Node.js App", Render, Railway, VPS):** subir la carpeta, ejecutar `npm install`, comando de inicio `node server.js`. El puerto se toma de la variable `PORT`.
- **VPS:** use `pm2 start server.js --name aldam` y un proxy (Nginx/Caddy) con HTTPS hacia el puerto 3000. **Use HTTPS**, pues no hay contraseña.
- La carpeta `data/` debe ser persistente (en Render/Railway monte un disco/volumen y use `DATA_DIR=/ruta/disco`).
- Zona horaria por defecto: America/Costa_Rica (variable `TZ` para cambiarla).

## Cambiar la URL secreta
- Desde el sistema: **Configuración → URL secreta** (cambia al instante; guarde la nueva dirección).
- O editando `data/config.json` (`"secretPath": "/mi-ruta-privada"`) y reiniciando.
- Cualquier otra ruta responde 404 y no existe ningún enlace público al sistema. Elija una ruta larga y difícil de adivinar.

## Copias de seguridad
- **Configuración → Descargar respaldo**: un archivo con todos los datos e imágenes. **Restaurar respaldo** lo reimporta.
- El servidor guarda además una copia diaria automática en `data/backups/` (últimas 14).

## Estructura
- `server.js` API y almacenamiento (comentado).
- `public/index.html`, `public/app.js` interfaz.
- `data/db.json`, `data/uploads/` datos (se crean solos).

## Notas
- Las proformas/facturas se imprimen en tamaño carta/A4; "PDF" descarga el archivo (requiere internet para cargar la librería html2pdf) o use Imprimir → *Guardar como PDF*.
- Facturar descuenta stock; anular una factura lo devuelve. Los servicios no manejan stock.
- Tailwind se carga por CDN (necesita internet en el navegador).
- No es un comprobante electrónico autorizado por Hacienda; es un documento interno de facturación.
