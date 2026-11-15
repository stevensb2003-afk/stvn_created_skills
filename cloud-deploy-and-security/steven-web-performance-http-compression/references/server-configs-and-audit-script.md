# Configuraciones de Servidor y Script Auditor de Compresión HTTP

Referencia técnica ejecutable correspondiente a `steven-web-performance-http-compression`. Compara configuración `MÍNIMO` frente a `EXTRAS` recomendada para producción.

---

## 1. Nginx (`nginx.conf` — Gzip + Brotli + Pre-compresión Estática)

> Nginx ya comprime `text/html` por defecto cuando `gzip on;` está activo; listar `text/html` dentro de `gzip_types` genera warning innecesario. Lista todos los demás tipos de texto/vectoriales.

```nginx
http {
  # ---- MÍNIMO (evita la trampa de comprimir solo HTML) ----
  gzip on;
  gzip_types
    text/plain
    text/css
    text/javascript
    application/javascript
    application/x-javascript
    application/json
    application/manifest+json
    application/xml
    application/rss+xml
    image/svg+xml
    font/ttf
    font/otf;

  # ---- EXTRAS (calibración CPU/Red/CDN de producción) ----
  gzip_comp_level 5;      # Balance óptimo velocidad/ratio (evitar 8-9 en caliente)
  gzip_min_length 256;    # No gastar CPU en respuestas < 256 bytes
  gzip_vary on;           # Emite "Vary: Accept-Encoding" obligatorio para proxies/CDN
  gzip_proxied any;       # Comprime incluso tras reverse proxy / Cloud Run / Cloudflare
  gzip_static on;         # Sirve archivos .gz pre-generados sin usar CPU en tiempo real

  # ---- Si Nginx incluye ngx_brotli ----
  # brotli on;
  # brotli_comp_level 4;
  # brotli_min_length 256;
  # brotli_static on;     # Sirve .br (nivel 11 generado en Vite build) con coste CPU = 0
  # brotli_types
  #   text/plain text/css text/javascript application/javascript
  #   application/json application/manifest+json application/xml image/svg+xml;
}
```

### Rutas SSE (Chat IA / Streaming en tiempo real)

```nginx
location /api/chat/stream {
  proxy_pass http://app_backend;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  gzip off;
  proxy_buffering off;
  add_header X-Accel-Buffering "no" always;
}
```

---

## 2. Express (Node.js) con Filtro Seguro para SSE y Binarios

```ts
import express from "express";
import compression from "compression";

const app = express();

// MÍNIMO: app.use(compression());
// EXTRAS: umbral 512B, nivel 6 y exclusión explícita de SSE / opt-out
app.use(
  compression({
    level: 6,
    threshold: 512,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      const accept = String(req.headers.accept ?? "");
      if (accept.includes("text/event-stream")) return false;
      const contentType = String(res.getHeader("Content-Type") ?? "");
      if (contentType.includes("text/event-stream")) return false;
      return compression.filter(req, res);
    },
  }),
);
```

---

## 3. Fastify (`@fastify/compress`)

```ts
import Fastify from "fastify";
import compress from "@fastify/compress";

const fastify = Fastify();

await fastify.register(compress, {
  global: true,
  threshold: 512,
  encodings: ["br", "gzip"],
  // En rutas SSE usar reply.compress(...) desactivado o hook por ruta
});
```

---

## 4. Vite: Pre-Compresión Estática en Build (`vite-plugin-compression2`)

Permite generar `.br` (nivel máximo 11) y `.gz` (nivel 9) **una sola vez en CI/build** para que Nginx/Cloudflare/S3 sirvan `Content-Encoding: br` con 0% carga de CPU en servidor.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { compression } from "vite-plugin-compression2";

export default defineConfig({
  plugins: [
    compression({
      algorithms: [
        ["gzip", { level: 9 }],
        ["brotliCompress", {}],
      ],
      threshold: 512,
      exclude: [/\.(png|jpe?g|webp|avif|woff2|mp4|pdf|zip)$/i],
      deleteOriginalAssets: false, // Mantener original para clientes sin encoding
    }),
  ],
});
```

---

## 5. Next.js / Cloud Run / Cloudflare Notes

- **Next.js standalone detrás de Nginx/CDN:** Si ya comprimes en el borde (Cloudflare / Nginx / Envoy), desactiva la compresión doble en Node fijando `compress: false` en `next.config.mjs` (o deja `compress: true` únicamente cuando Node sirva directo sin proxy compresor).
- **Rutas Streaming Route Handler (App Router):** Añade `export const dynamic = "force-dynamic";` y responde con headers `"Content-Type": "text/event-stream; charset=utf-8"`, `"Cache-Control": "no-cache, no-transform"` (`no-transform` evita que proxies reempaqueten o rompan chunks) y `"X-Accel-Buffering": "no"`.

---

## 6. Verificación Rápida con `curl` y Script Auditor

### Comandos manuales rápidos

```bash
# Comparar peso sin comprimir vs Gzip vs Brotli y validar Content-Encoding + Vary
URL="https://example.com/assets/app.js"

curl -s -o /dev/null -w "RAW:  %{size_download} bytes\n" "$URL"
curl -s -H "Accept-Encoding: gzip" -D - -o /dev/null -w "GZIP: %{size_download} bytes\n" "$URL" | grep -iE "HTTP/|content-encoding|vary|GZIP:"
curl -s -H "Accept-Encoding: br"   -D - -o /dev/null -w "BR:   %{size_download} bytes\n" "$URL" | grep -iE "HTTP/|content-encoding|vary|BR:"
```

### Script Auditor Todo-en-Uno (`audit-compression.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 <url>"
  exit 1
fi

URL="$1"
measure() {
  local enc="$1"
  if [ "$enc" = "identity" ]; then
    curl -sSL -D /tmp/hdr_"$enc".txt -o /dev/null -w "%{size_download}" "$URL"
  else
    curl -sSL -H "Accept-Encoding: $enc" -D /tmp/hdr_"$enc".txt -o /dev/null -w "%{size_download}" "$URL"
  fi
}

RAW_BYTES=$(measure "identity")
GZIP_BYTES=$(measure "gzip")
BR_BYTES=$(measure "br")

GZIP_CE=$(grep -i "^content-encoding:" /tmp/hdr_gzip.txt | tail -n1 | tr -d '\r' || true)
BR_CE=$(grep -i "^content-encoding:" /tmp/hdr_br.txt | tail -n1 | tr -d '\r' || true)
BR_VARY=$(grep -i "^vary:" /tmp/hdr_br.txt | tail -n1 | tr -d '\r' || true)

python3 - "$RAW_BYTES" "$GZIP_BYTES" "$BR_BYTES" "$GZIP_CE" "$BR_CE" "$BR_VARY" <<'PY'
import sys
raw, gz, br = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
gz_ce, br_ce, br_vary = sys.argv[4], sys.argv[5], sys.argv[6]

def pct(val):
    return 0.0 if raw == 0 else ((raw - val) / raw) * 100.0

print(f"Raw:    {raw:>9} B")
print(f"Gzip:   {gz:>9} B  ({pct(gz):5.1f}% ahorro) | {gz_ce or 'Content-Encoding: (none)'}")
print(f"Brotli: {br:>9} B  ({pct(br):5.1f}% ahorro) | {br_ce or 'Content-Encoding: (none)'}")
print(f"Vary:   {br_vary or '(missing!)'}")
PY
```
