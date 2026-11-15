# `steven-waba-dualhook-connection` (v5.2)

Skill maestra **100% autocontenida** para diseñar, aprovisionar desde terminal, construir desde cero (`crm-from-scratch`), desplegar en flujo GitHub 2-ramas (`demo` → `main` multi-cliente), extender con add-ons comerciales y auditar un **CRM Omnicanal** sobre **WhatsApp Business Dualhook (`v25.0`, Coexistencia)**, **Instagram Direct** y **Facebook Messenger**, con **POS de 4 Modos** y **Facturación Electrónica Costa Rica Hacienda DGT v4.4 (`XAdES-EPES` + XSD offline)**.

---

## 📂 Estructura de la Skill

| Elemento | Descripción |
| :--- | :--- |
| [`SKILL.md`](./SKILL.md) | Especificación maestra v5.2 (Fases 0 a 12, Pre-Flight `7/7`, Wizard Interactivo de 4 Rondas, reglas reciclables y Checklist Forense). |
| [`references/`](./references/) | **14 blueprints modulares (`01` a `14`):** Design system, Chat Workspace, Settings Hub (8 tarjetas), IA Automations, Directorio/Analytics, POS Global, Meta Omnicanal, RBAC/Invites/Licensing, Banners/Theming/Copiloto, Extensión Multi-Cliente, Hacienda CR v4.4, Entregas/Agenda/Proyectos, Catálogo Maestro/Excel y Add-Ons B2B/PWA. |
| [`scripts/`](./scripts/) | **8 scripts CLI/motores `.mjs`:** `provision-firebase-crm.mjs`, `audit-crm-forensic.mjs`, `preflight-and-drift-sentinel.mjs`, `sign-and-validate-v44.mjs`, `hacienda-math-and-clave-v44.mjs`, `hacienda-xml-builder-v44.mjs`, `dgt-error-humanizer.mjs`, `generate-lab-p12.mjs`. |
| [`resources/`](./resources/) | Esquemas XSD oficiales v4.4 (`resources/xsd/v4.4/*.xsd`) y `xmldsig-core-schema.xsd`. |

---

## ⚙️ Prerrequisitos

* Node.js 18+, `gcloud` CLI, `firebase-tools` (para aprovisionamiento Firebase Blaze + Firestore Native + App Check).
* `openssl` y `xmllint` si se utiliza validación local de firma y XSD para Hacienda CR v4.4.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-waba-dualhook-connection
```

**Triggers:** `/steven-waba-dualhook-connection`, `/waba-dualhook`, `/dualhook-crm`, `/whatsapp-crm-setup`, `/waba-audit`, `/facturacion-hacienda`, `/hacienda-v44`.
