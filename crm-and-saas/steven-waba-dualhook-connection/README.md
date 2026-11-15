# `steven-waba-dualhook-connection` (v5.4)

Skill maestra **100% autocontenida** para diseñar, aprovisionar desde terminal, construir desde cero (`crm-from-scratch`), orquestar por olas multi-agente, desplegar en flujo GitHub 2-ramas (`demo` → `main` multi-cliente), extender con add-ons comerciales y auditar un **CRM Omnicanal** sobre **WhatsApp Business Dualhook (`v25.0`, Coexistencia `smb_message_echoes`)**, **Instagram Direct** y **Facebook Messenger**, con **Catálogo Maestro Parametrizable** (`crm_settings/catalog_config` + Buscador CABYS en vivo), **Arquitectura IA Token-Densa (`<slug>_ai_agent_docs/` + Poda RBAC + `Click-Pap`)**, **POS de 4 Modos** y **Facturación Electrónica Costa Rica Hacienda DGT v4.4 (`XAdES-EPES` + XSD offline)**.

---

## ✨ Novedades Destacadas (v5.4)

* **Wizard Interactivo de 5 Rondas (`Ronda 0` + `Rondas 1..4`) & Protocolo por Olas:** captura `PROJECT_ID`, país fiscal, moneda y reglas del catálogo antes de escribir código, y permite despachar construcción paralela en 3 Olas disjuntas para Carbon/Subagentes.
* **Catálogo Maestro Parametrizable (`crm_settings/catalog_config`):** activación por cliente de Origen, Sub-series, Regla de SKU (`prefix_origin_sub_seq` | `prefix_seq` | `manual_free`), Matriz de Cuentas Contables (`/products/settings`) y **Buscador CABYS en vivo** contra API de Hacienda CR + favoritos offline.
* **Ingeniería IA & Copiloto de Alta Eficiencia (`Blueprint 15`):** estándar `<slug>_ai_agent_docs/` (`< 500` líneas, doble TOC `Lxxx-Lyyy`, tags `[ROL: ...]`), **Poda Física RBAC Pre-LLM**, Streaming SSE **`Click-Pap`** (`<<OPCIONES>>`), serialización 1-línea (`-65%` a `-90%` tokens), Prefix Caching, Circuit Breaker multi-ámbito y `crm_help_chats`.
* **Blindaje Anti-Pérdida & Escalabilidad en Chats:** manejo inteligente en 3 casos para mensajes efímeros/CTWA `131051 unsupported` (`resolveUnsupportedOpeningTurn`), Sidebar Híbrida anti-evicción (`LIVE_LIMIT = 80` + sockets por asesor + `loadMoreTabHistory`), filtros server-indexed y búsqueda histórica total en `collectionGroup(messages)` con `searchTokens`.
* **Auditor Forense Ampliado (`audit-crm-forensic.mjs`):** `12` controles estáticos (incluyendo `0` escrituras `lastMessageAt: null`, `131051` + índice `searchTokens`, `0` fugas de `price_cost` en `web_catalog`, higiene `<slug>_ai_agent_docs/` y privacidad de `crm_help_chats`) + **Checklist Forense de 60 puntos**.

---

## 📂 Estructura de la Skill

| Elemento | Descripción |
| :--- | :--- |
| [`SKILL.md`](./SKILL.md) | Especificación maestra v5.4 (Ronda 0 + Fases 0 a 8, Wizard Interactivo de 5 Rondas, Protocolo Multi-Agente por Olas, reglas reciclables y Checklist Forense de 60 puntos). |
| [`references/`](./references/) | **15 blueprints modulares (`01` a `15`):** Design System/Tooltips/Favicon SVG, Chat Workspace + Sidebar Híbrida/Búsqueda Total, Settings Hub (8 tarjetas), IA Automations + Blindaje `131051`, Directorio/Analytics, POS Global 4 Modos, Meta Omnicanal, RBAC/Invites/Licensing, Banners/Theming/Copiloto, Extensión Multi-Cliente, Hacienda CR v4.4, Entregas/Agenda/Proyectos, Catálogo Parametrizable/CABYS/Cuentas/Excel, Add-Ons B2B (`admin_preview`)/PWA, y Arquitectura KB `<slug>_ai_agent_docs/` + Eficiencia IA (`Blueprint 15`). |
| [`scripts/`](./scripts/) | **8 scripts CLI/motores `.mjs`:** `provision-firebase-crm.mjs` (con `--fiscal-code-mode` y `--sku-mode` + seed `catalog_config`), `audit-crm-forensic.mjs` (12 controles estáticos), `preflight-and-drift-sentinel.mjs`, `sign-and-validate-v44.mjs`, `hacienda-math-and-clave-v44.mjs`, `hacienda-xml-builder-v44.mjs`, `dgt-error-humanizer.mjs`, `generate-lab-p12.mjs`. |
| [`resources/`](./resources/) | Esquemas XSD oficiales v4.4 (`resources/xsd/v4.4/*.xsd`) y `xmldsig-core-schema.xsd`. |

---

## ⚙️ Prerrequisitos

* Node.js 18+, `gcloud` CLI, `firebase-tools` (para aprovisionamiento Firebase Blaze + Firestore Native + App Check).
* `openssl` y `xmllint` si se utiliza validación local de firma y XSD para Hacienda CR v4.4.

## 🚀 Instalación y Uso Rápido

```bash
./install.sh --skill steven-waba-dualhook-connection

# Aprovisionamiento inicial (Fase 0) con modo fiscal y regla SKU de catálogo:
node ~/.gemini/config/skills/steven-waba-dualhook-connection/scripts/provision-firebase-crm.mjs \
  --project <PROJECT_ID> --region us-central1 --role <demo|client> \
  --dev-emails <TU_CORREO_DEV> --fiscal-code-mode cabys_cr_api \
  --sku-mode prefix_origin_sub_seq --seed

# Auditoría forense estática (12 controles):
node ~/.gemini/config/skills/steven-waba-dualhook-connection/scripts/audit-crm-forensic.mjs .
```

**Triggers:** `/steven-waba-dualhook-connection`, `/waba-dualhook`, `/dualhook-crm`, `/whatsapp-crm-setup`, `/waba-audit`, `/facturacion-hacienda`, `/hacienda-v44`.
