---
name: steven-web-performance-http-compression
description: >
  Ingeniería de compresión HTTP y transferencia web (Brotli, Gzip, Zstd): handshake Accept-Encoding /
  Content-Encoding / Vary, prevención de net::ERR_CONTENT_DECODING_FAILED, trampa MIME de Nginx,
  pre-compresión estática, filtrado de Server-Sent Events (SSE) y auditoría con curl/DevTools. Actívalo
  cuando el usuario escriba "/steven-web-performance-http-compression", "/http-compression", "/gzip-brotli",
  o pida optimizar peso de payload JS/CSS/API o diagnosticar compresión en Nginx, Node, Vite o Cloud Run.
---

# Web Performance & HTTP Compression (`br` / `gzip` / `zstd`)

La compresión HTTP reduce típicamente entre un **`60%` y `80%`** el peso en red de `HTML`, `CSS`, `JavaScript`, `JSON` y `SVG` (`~÷ 3` a `÷ 4` veces menos bytes). Configurarla a medias o con el header incorrecto rompe la página o deja el `90%` de tus bundles sin comprimir.

## 1. Jerarquía de Algoritmos y Regla de Exclusión Binaria

1. **Prioridad de negociación:** **`br` (Brotli)** > **`zstd`** (clientes/CDNs modernos) > **`gzip`** (compatibilidad universal). Brotli comprime texto web ~15–20% mejor que Gzip a CPU equivalente cuando se pre-comprime estáticamente.
2. **Solo compresión sobre texto:** Comprime `text/html`, `text/css`, `application/javascript`, `application/json`, `image/svg+xml`, `application/xml`, `application/wasm`.
3. **Prohibido recomprimir binarios:** Nunca apliques `gzip`/`br` sobre formatos ya comprimidos (`JPEG`, `PNG`, `WebP`, `AVIF`, `MP4`, `WebM`, `WOFF2`, `ZIP`, `PDF`). Desperdicia CPU y puede aumentar el tamaño final.

---

## 2. El Handshake HTTP y las 3 Trampas de Producción

```http
GET /assets/app.js HTTP/1.1
Accept-Encoding: gzip, deflate, br, zstd

HTTP/1.1 200 OK
Content-Encoding: br
Vary: Accept-Encoding
Content-Type: application/javascript
```

### Trampa 1: `net::ERR_CONTENT_DECODING_FAILED`
- **Causa:** El servidor o proxy envía header `Content-Encoding: gzip` o `br`, pero el cuerpo real está en texto plano o sufrió **doble compresión** sobre un asset `.gz`/`.br` pre-empaquetado.
- **Regla:** No inyectes `Content-Encoding` manualmente salvo que el middleware/servidor sirva exactamente ese binario comprimido una única vez.

### Trampa 2: El engaño por defecto de Nginx (`gzip on;`)
- **Causa:** En Nginx, **`gzip on;` comprime exclusivamente `text/html`** si no declaras `gzip_types`. Tus `main.js`, `styles.css` y respuestas `application/json` siguen viajando al `100%` de su tamaño.
- **Regla:** Añade siempre `gzip_types` completo (`text/css`, `application/javascript`, `application/json`, `image/svg+xml`, etc.), `gzip_vary on` y `gzip_proxied any`.

### Trampa 3: CPU Saturado, Payloads Miniatura y Buffering SSE
- **Nivel dinámico calibrado:** Para compresión al vuelo, usa **`gzip_comp_level 5`** (`4–6`) o **`brotli_comp_level 4–5`**. Reservar nivel `9`/`11` exclusivamente para **pre-compresión estática en build** (`gzip_static on;` / `brotli_static on;`).
- **Umbral mínimo:** No comprimir respuestas menores a **`256–512 bytes`** (`gzip_min_length 256` / `threshold: 512`): las cabeceras del codec anulan el ahorro.
- **Excluir streams SSE (`text/event-stream`):** Desactiva compresión con buffering y envía `X-Accel-Buffering: no` en endpoints de chat IA en streaming para que los tokens lleguen en tiempo real.

---

## 3. Matriz Rápida `MÍNIMO` vs `EXTRAS` por Stack

| Stack | `MÍNIMO` Viable | `EXTRAS` de Producción |
|---|---|---|
| **Nginx** | `gzip on;` + `gzip_types ...` explícitos | `gzip_comp_level 5`, `gzip_min_length 256`, `gzip_vary on`, `gzip_proxied any`, `brotli on`, `*_static on` |
| **Express (Node)** | `app.use(compression())` | `threshold: 512`, `filter` excluyendo `text/event-stream` y `x-no-compression` |
| **Fastify (Node)** | `await app.register(compress)` | `{ encodings: ['br', 'gzip'], threshold: 512, customTypes: /.../ }` |
| **Vite (SPA)** | Build minificado estándar | `vite-plugin-compression2` generando `.br` (lvl 11) + `.gz` (lvl 9) en `dist/` para Nginx/CDN |
| **Next.js / Cloud Run / CDN** | `compress: true` en `next.config` (o Edge automático Vercel/Cloudflare) | En Cloud Run/proxies detrás de Nginx/CDN, evitar doble compresión y asegurar `Vary: Accept-Encoding` + cache headers |

*(Para cabeceras de seguridad HTTPS A+, CSP, HSTS y prevención de fuga BREACH en rutas autenticadas, complementar con `steven-seo-seguridad-web`).*

---

## 4. Configs Copiables y Script de Auditoría

> Todos los bloques listos para producción (`nginx.conf`, Express, Fastify, Vite, Next.js/Cloud Run) más comandos `curl` y script auditor en **[`./references/server-configs-and-audit-script.md`](./references/server-configs-and-audit-script.md)**.

---

## 5. Checklist de Auditoría de Compresión HTTP

1. [ ] ¿Devuelven las respuestas `.js`, `.css`, `.json` y `.svg` `Content-Encoding: br` (o `gzip`) en Chrome DevTools / `curl`?
2. [ ] ¿Incluye toda respuesta comprimida la cabecera `Vary: Accept-Encoding`?
3. [ ] ¿Tiene Nginx `gzip_types` explícitos además de `gzip on;`?
4. [ ] ¿Está el umbral mínimo en `256–512 bytes` y el nivel dinámico en `4–6` (reservando `9/11` para build estático)?
5. [ ] ¿Están excluidos del compresor los binarios (`webp/avif/png/woff2/mp4`) y los streams `text/event-stream`?
6. [ ] ¿Coincide `Content-Encoding` con el formato real del cuerpo sin riesgo de `ERR_CONTENT_DECODING_FAILED`?
