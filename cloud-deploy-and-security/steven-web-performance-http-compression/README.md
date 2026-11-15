# `steven-web-performance-http-compression`

Ingeniería de **compresión HTTP y transferencia web (`br` / `gzip` / `zstd`)** para reducir entre `60%` y `80%` el tamaño en red de `HTML`, `CSS`, `JS`, `JSON` y `SVG` sin errores de decodificación ni buffering de streams IA.

---

## ⚙️ Qué Incluye

* **Jerarquía de algoritmos & exclusión binaria:** `br` > `zstd` > `gzip`, prohibiendo recomprimir binarios (`WebP`, `AVIF`, `PNG`, `MP4`, `WOFF2`, `PDF`).
* **Prevención de las 3 Trampas de Producción:**
  1. `net::ERR_CONTENT_DECODING_FAILED` (doble compresión o header manual erróneo).
  2. La trampa de Nginx `gzip on;` (que solo comprime `text/html` sin `gzip_types`).
  3. Buffering en **Server-Sent Events (`text/event-stream`)** con `X-Accel-Buffering: no`, umbrales mínimos (`256–512 bytes`) y calibración de niveles dinámicos vs build estático.
* **Matriz `MÍNIMO` vs `EXTRAS`** para Nginx, Express, Fastify, Vite y Next.js / Cloud Run.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Reglas, trampas de producción, matriz por stack y checklist.
* [`references/server-configs-and-audit-script.md`](./references/server-configs-and-audit-script.md) — Bloques copiables de configuración, comandos `curl` y script auditor.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-web-performance-http-compression
```

**Triggers:** `/steven-web-performance-http-compression`, `/http-compression`, `/gzip-brotli`.
