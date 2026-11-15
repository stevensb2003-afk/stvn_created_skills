# `steven-brd-docs-bootstrap`

Generador y actualizador universal de bases de conocimiento funcionales (estilo **BRD paso a paso** en texto plano) diseñadas para **Agentes de IA multi-rol** y **Centros de Ayuda internos**.

---

## 🛡️ Principios Clave

* **Carpeta exclusiva obligatoria:** crea `/<proyecto>_ai_agent_docs/` aislada de `/docs/` genéricos (`docs.md`, `00-CONTENT-TABLE.md`, `01-*` a `YY-*`).
* **Integración obligatoria con EGM (`egm`):** ejecuta `scripts/preflight-check.mjs` para verificar `egm-bootstrap` y `egm-drift-report` (plugin `google/elephant-goldfish-model`), con 3 modos: `BOOTSTRAP`, `INCREMENTAL-UPDATE` y `NEW-MODULE / NEW-FEATURE`.
* **Segregación RBAC (`[ROL: ...]`) y archivos `< 500` líneas** divididos en `a`/`b` cuando crecen.
* **Coordenadas `Lxxx-Lyyy` compiladas por script:** prohibido calcular líneas a mano; todo termina ejecutando `scripts/build-llm-toc-index.mjs`.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Reglas de hierro, estructura estándar y 3 modos de ejecución.
* [`references/templates-brd-llm.md`](./references/templates-brd-llm.md) — Plantillas BRD y etiquetas `[ROL: ...]`.
* [`references/rbac-and-egm-scout-protocol.md`](./references/rbac-and-egm-scout-protocol.md) — Protocolo de exploración con scouts EGM y fallback.
* [`scripts/preflight-check.mjs`](./scripts/preflight-check.mjs) & [`scripts/build-llm-toc-index.mjs`](./scripts/build-llm-toc-index.mjs).

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-brd-docs-bootstrap
```

**Triggers:** `/steven-brd-docs-bootstrap`, `/brd-docs`, `/docs-ia`, `/app-docs`.
