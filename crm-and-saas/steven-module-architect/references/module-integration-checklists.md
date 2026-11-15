# Checklists de Integración End-to-End para Nuevos Módulos

Usa estos 3 patrones canónicos al construir un módulo nuevo detectado por `analyze-project-architecture.mjs`.

---

## Patrón A: Módulo Top-Level Independiente (`/app/<module>/...` o Ruta Principal)

Ideal para módulos completos como *Inventario*, *Proyectos*, *Contabilidad*, *Ticket Desk* o *Facturación*.

1. **Registro del Módulo y Permisos RBAC:**
   - Agregar la clave del módulo en el catálogo de módulos (ej. `SystemModule` / `CRM_MODULE_KEYS`).
   - Declarar sub-permisos granulares mínimos: `<mod>.view`, `<mod>.create`, `<mod>.edit`, `<mod>.delete`, `<mod>.admin`.
   - Mapear los permisos en `DEFAULT_ROLES` y permitir editarlos en el constructor de roles (`roles/{roleId}`).
2. **Licenciamiento Remoto (`tenant_license`):**
   - Registrar `<moduleKey>` en el esquema de `enabledModules` (`/config/tenant_license`).
   - En Frontend: si `!isModuleLicensed('<moduleKey>')`, mostrar tarjeta elegante de *Módulo no incluido en tu plan* (en vez de pantalla rota) y ocultar de la navegación operativa si corresponde.
   - En Backend/Rules: bloquear API routes y `firestore.rules` (o RLS SQL) cuando `isModuleLicensed('<moduleKey>') == false`.
3. **Capa de Datos e Índices:**
   - Todo documento guarda `tenantId` (si aplica multi-tenant) y `createdBy`, `createdAt`, `updatedAt`.
   - Sanitizar con `removeUndefined()` (o esquema `zod`) antes de escribir en DB.
   - Registrar todo query compuesto (`where` + `orderBy`) en `firestore.indexes.json` (o migración SQL).
4. **UI Token-Pure (`< 500` líneas por archivo):**
   - Usar únicamente tokens semánticos (`bg-background`, `bg-card`, `text-foreground`, `bg-primary`, `bg-tertiary`, `border-border`).
   - Usar `<AppIcon />` (`@phosphor-icons/react`) o la librería de íconos detectada por el escáner.
   - Soporte móvil obligatorio (`100dvh`, `text-[16px] sm:text-sm` en inputs, pila de navegación móvil con botón `←` físico/virtual).

---

## Patrón B: Submódulo Contextual de Workspace (Toolbar + Panel Derecho `400px`)

Ideal para herramientas acopladas a un hilo o entidad central (ej. *Cotizador dentro del Chat*, *Expediente Médico*, *Garantías*, *Checklist de Despacho*).

1. **Botón en Toolbar Contextual:** Renderizado condicionalmente por `isModuleLicensed('<mod>') && can('<mod>.view')`.
2. **Panel Responsivo Único:**
   - Desktop (`>= 768px`): columna derecha fija `w-[400px] border-l border-border`.
   - Móvil (`< 768px`): pantalla completa `fixed inset-0 z-40` registrada en la pila del botón físico Atrás (`useMobileBackLayer`).
3. **Subcolección Aislada + Enlace Bidireccional:**
   - Guardar bajo la entidad padre (`contacts/{contactId}/<submodulo>/{id}`) con `tenantId`.
   - Despachar evento de navegación (`window.dispatchEvent(new CustomEvent('app:select-entity', ...))`) para saltar desde calendarios o listados globales al registro exacto.

---

## Patrón C: Sincronización Obligatoria con Base Documental IA (`steven-brd-docs-bootstrap`)

Cuando el repositorio tenga una carpeta `/<proyecto>_ai_agent_docs/` (o el usuario quiera que el Copiloto de Ayuda IA interno conozca el módulo nuevo):

1. Verificar si existe `~/.gemini/config/skills/steven-brd-docs-bootstrap/SKILL.md`.
2. Invocar su **Modo C (`NEW-MODULE / NEW-FEATURE`)**:
   - Generar `ZZ-modulo-<slug>.md` estilo BRD paso a paso en texto plano (botones exactos, pestañas, campos obligatorios, candados RBAC, casos borde).
   - Etiquetar cada sección `##` y `###` con `[ROL: ...]`.
   - Mantener cada archivo `< 500` líneas (dividir en `a` / `b` si excede `480`).
   - Actualizar la matriz RBAC en `01-*`, automatizaciones en `XX-*` y mapa de capas en `YY-*`.
3. Ejecutar el compilador de índices para recalcular `Lxxx-Lyyy`:
   ```bash
   node ~/.gemini/config/skills/steven-brd-docs-bootstrap/scripts/build-llm-toc-index.mjs <proyecto>_ai_agent_docs --root-doc <proyecto>_ai_agent_docs/docs.md --max-lines 500
   ```
4. Con esto, el **Copiloto de Ayuda IA** dentro de la app aprenderá automáticamente a explicar el módulo nuevo sin tocar código del bot.
