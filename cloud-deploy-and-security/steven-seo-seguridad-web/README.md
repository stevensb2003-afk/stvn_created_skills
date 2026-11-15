# `steven-seo-seguridad-web`

Estándar maestro universal y agnóstico para **Auditar, Construir desde Cero, Sanitizar y Posicionar** cualquier proyecto web (`Next.js`, `React`, `Vite`, `Angular`, `Firebase`) en buscadores tradicionales, motores de IA (**GEO/LLMO**) y seguridad perimetral HTTP grado **`A+`**.

---

## 🚦 Clasificador Inteligente Fase 0

Antes de implementar nada, autodescubre `<PUBLIC_ROUTES>` y `<PRIVATE_ROUTES>` y clasifica el proyecto en 1 de 4 categorías para no desperdiciar esfuerzo ni exponer rutas internas:
1. **Back-Office / CRM / ERP Interno** (`noindex` global + `A+` + RBAC + PWA).
2. **Web Pública Comercial B2C** (SEO On-Page + `/llms.txt` + JSON-LD + Search Console/Bing + GA4/Meta Pixel + `A+`).
3. **Portal Privado B2B / Extranet**.
4. **Arquitectura Híbrida (Web Pública + Panel Privado / SaaS)**.

Incluye auditoría de **20 Señales de Alerta de "Vibe Coding"**, cabeceras CSP/HSTS Grado `A+`, Google Consent Mode v2 y optimización `alt`/accesibilidad.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Clasificador Fase 0, Modo Auditoría E2E y Modo Implementación paso a paso.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-seo-seguridad-web
```

**Triggers:** `/steven-seo-seguridad-web`, `auditar seo`, `auditar seguridad web`, `configurar llms.txt`, `security headers A+`.
