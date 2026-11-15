# Blueprint 10 — Extensión de Nuevos Módulos (RBAC + Dependencias) y Operación Multi-Cliente (`demo` → `main`)

> **Autocontenido para Compradores y Agencia:** Este manual funciona tanto de forma autónoma al entregar este skill como integrado con los skills hermanos `steven-module-architect`, `steven-firebase-client-bootstrap` y `steven-brd-docs-bootstrap` si están instalados.

---

## Parte A: Cómo Agregar un Nuevo Módulo al CRM sin Romper Arquitectura

### 1. Diagnóstico Previo Obligatorio
Antes de crear archivos para un módulo nuevo:
- Si existe `steven-module-architect`, ejecuta su escáner (`analyze-project-architecture.mjs`).
- De forma manual o autónoma, inspecciona:
  1. `package.json` (dependencias y librería de íconos `@phosphor-icons/react`).
  2. `src/app/globals.css` (tokens `--primary`, `--secondary`, `--tertiary`, `--border`).
  3. `src/lib/constants/crm-permissions.ts` y `src/lib/services/crm-auth-guard.ts`.
  4. `crm_system/tenant_license` (flags remotos del panel `/developer`).
  5. `firestore.rules`, `storage.rules` y `firestore.indexes.json`.
  6. Carpeta `/<proyecto>_ai_agent_docs/` (si existe, para mantener sincronizado el Copiloto IA).

### 2. Checklist de 6 Pasos para Cablear el Nuevo Módulo
1. **Permiso RBAC:** Agrega la nueva clave en `CRM_PERMISSIONS` (ej. `CRM_PERMISSIONS.WARRANTIES = 'crm.warranties'`) y añádela al constructor de roles dinámicos.
2. **Licencia Remota:** Agrega la clave booleana del módulo en `CrmTenantLicense['enabledModules']` y valida `isModuleLicensed(licenseDoc, '<moduleKey>')` en `firestore.rules` y backend.
3. **Índices y Reglas:** Toda consulta nueva (`where` + `orderBy`) debe quedar registrada en `firestore.indexes.json` y respetar el límite `<= 2` lecturas por evaluación en `firestore.rules` (pase único O(1)).
4. **Endpoints Seguros:** Toda ruta `/api/crm/<modulo>/*` llama a `verifyCrmRequestAuth(req, requiredPerm)` y valida `subscriptionStatus !== 'suspended'`.
5. **UI Modular (`< 500` líneas por archivo):**
   - Solo tokens semánticos CSS (cero colores HEX quemados).
   - Íconos vía `<AppIcon />` (`@phosphor-icons/react`).
   - En móvil (`< 768px`), registrar subvistas en `useCrmMobileBackLayer` y usar inputs `text-[16px] sm:text-sm`.
6. **Documentación BRD IA:** Si existe `steven-brd-docs-bootstrap`, invoca **Modo C (`NEW-MODULE`)** y recompila `00-CONTENT-TABLE.md` con `build-llm-toc-index.mjs` para que el Copiloto IA responda sobre el nuevo módulo al instante.

---

## Parte B: Operación Multi-Cliente con 2 Ramas (`demo` → `main`) y Reglas Recicladas

### 1. Flujo de Ramas (Cero Ramas por Cliente)
- **Rama `demo`:** Auto-despliega al proyecto **Firebase Demo** (`deploy/clients.manifest.json` → `demoProject.projectId`). Sirve para pruebas internas y demostraciones a prospectos.
- **Rama `main` (Protegida):** Solo recibe código probado mediante **Pull Request desde `demo`**. Alimenta a **todos los proyectos Firebase de clientes**.
- Las diferencias entre clientes viven en **Firestore** (`crm_settings/branding`, `crm_system/tenant_license`, `crm_secrets/integrations`) y variables públicas del Web SDK, **nunca en ramas separadas de Git**.

### 2. Alta Automática de Cliente Nuevo en 1 Comando
Usa el script incluido en este skill (`scripts/provision-firebase-crm.mjs`) —o `steven-firebase-client-bootstrap` si está disponible— pasando `--project`, `--display-name`, `--domains`, `--seed`, `--deploy-rules` y `--manifest deploy/clients.manifest.json`.
- Despliega exactamente los mismos `firestore.rules`, `storage.rules` y `firestore.indexes.json` en cada proyecto nuevo (100% reciclables porque no contienen correos ni IDs quemados).
- Configura los webhooks de GitHub Actions (`.github/workflows/deploy-demo.yml` y `.github/workflows/deploy-clients.yml`) para actualizar reglas e instancias pasando `--project <ID>` de forma explícita.

---

## Parte C: Suite de Módulos Comerciales Pre-Construidos Listos para Activar por Plan (`v5.2`)

Antes de construir un módulo desde cero para un nuevo cliente, verifica si su requerimiento ya está cubierto por los **Blueprints Oficiales Pre-Integrados** gobernados desde `crm_system/tenant_license`:
1. **Entregas Locales, Visitas, Proyectos Multi-Día y Garantías (`enabledModules.scheduling`)** → Ver [Blueprint 12](./12-local-deliveries-agenda-projects-spec.md) (`100%` local en Firestore con folios atómicos `ETG/VIS/PROY/GAR`, desenrollador GPS/OSRM y `ExternalLogisticsAdapter` opcional).
2. **Catálogo Maestro (`catalog_master`), Exposición Web (`web_catalog`) y Plantillas Excel / Edición Masiva** → Ver [Blueprint 13](./13-master-catalog-web-exposure-excel-engine.md) (`100%` desacoplado de ERPs, `writeBatch` dual `catalogProducts` + `web_catalog`, asistente Excel de 3 pasos y hoja interactiva con 5 fórmulas por lote).
3. **Escalas y Aprobaciones de Descuento B2C (`pricing_approvals`), Portal Mayorista B2B (`b2b_wholesale_portal`), Prospectos Web (`web_leads`) y Caja/Links de Pago/Transferencias (`cash_reconciliation`)** → Ver [Blueprint 14](./14-modular-addons-pricing-b2b-webleads-pwa.md).
