---
name: steven-brd-docs-bootstrap
description: >
  Generador y actualizador universal de bases de conocimiento funcionales (estilo BRD paso a paso en texto plano) para Agentes de IA multi-rol y Centros de Ayuda internos. Crea siempre una carpeta dedicada exclusiva (`/<proyecto>_ai_agent_docs/`), exige e invoca el plugin externo `egm` (`egm-bootstrap` y `egm-drift-report`) tanto en la primera ejecución (con `/goal`) como al actualizar documentos tras ediciones o crear nuevos módulos/features, segrega permisos RBAC (`[ROL: ...]`) y compila coordenadas exactas de línea (`Lxxx-Lyyy`).
  Actívalo cuando el usuario escriba "/steven-brd-docs-bootstrap", "/brd-docs", "/docs-ia", "/app-docs", o pida crear o actualizar la documentación funcional para IA de cualquier repositorio.
---

# Generador y Actualizador Estándar BRD Multi-Rol para Agentes IA (`steven-brd-docs-bootstrap`)

Este skill orquesta en **cualquier repositorio y tecnología** tanto la **creación desde cero (Bootstrap)** como la **actualización quirúrgica post-edición o alta de nuevos módulos** de una base documental estilo **BRD paso a paso**, aislada en su propia carpeta exclusiva, segregada por roles RBAC y con coordenadas exactas de línea (`Lxxx-Lyyy`) para navegación instantánea de LLMs.

> **Arquitectura Desacoplada**: Este skill **no** empaqueta EGM adentro; invoca la instalación global externa del plugin oficial **Elephant-Goldfish Model (`egm`)** de Google (`egm-bootstrap`, `egm-drift-report` y subagentes `egm-*`).

---

## 1. Principios Inquebrantables (Iron Laws)

1. **Carpeta Dedicada Exclusiva Obligatoria (`/<proyecto>_ai_agent_docs/`)**:
   - **PROHIBIDO** mezclar esta documentación dentro de carpetas genéricas compartidas como `/docs/` o `/documentation/`.
   - **SIEMPRE** crea o usa en la raíz del proyecto una carpeta exclusiva llamada `/<slug_proyecto>_ai_agent_docs/` (o el nombre exacto `/*_ai_agent_docs` indicado por el usuario), guardando adentro `docs.md`, `00-CONTENT-TABLE.md` y todos los `XX-*.md`.
2. **Uso Obligatorio de EGM en TODOS los Modos (`BOOTSTRAP`, `UPDATE` y `NEW-MODULE`) + `/goal` en 1ª Vez**:
   - Antes de analizar o escribir nada, ejecuta **siempre** [`scripts/preflight-check.mjs`](./scripts/preflight-check.mjs).
   - **Si `egm` SÍ está instalado**: es **OBLIGATORIO** leer e invocar sus skills oficiales reportadas por el checker (`egm-bootstrap/SKILL.md` para exploración bottom-up completa o por sub-árbol `sub_tree_root`, y `egm-drift-report/SKILL.md` para detectar divergencias al actualizar documentos existentes).
   - **Si `egm` NO está instalado** (código de salida `2`): **DETENTE DE INMEDIATO**, comparte al usuario el enlace y comando CLI oficial de instalación global:
     - **Descarga / Repo oficial**: https://github.com/google/elephant-goldfish-model (https://egm.dev)
     - **Antigravity CLI**: `agy plugin install https://github.com/google/elephant-goldfish-model`
     - **Antigravity App / IDE**: Ejecutar `/plugin` y pedir `Install https://github.com/google/elephant-goldfish-model` (o instalar en `~/.gemini/config/plugins/egm/` con el comando impreso por `preflight-check.mjs`).
     - **Claude Code / Codex CLI**: `claude plugin marketplace add google/elephant-goldfish-model && claude plugin install egm@egm` (o `codex plugin add egm@egm`).
     - Solo continúa pasando `--allow-fallback` (usando [`references/rbac-and-egm-scout-protocol.md`](./references/rbac-and-egm-scout-protocol.md)) **si el usuario aprueba explícitamente proseguir sabiendo que el análisis puede ser de menor calidad**.
   - **En Primera Ejecución (`BOOTSTRAP_FIRST_RUN`)**: exige o recomienda correr la sesión con **`/goal`** activo para garantizar cobertura del 100% de módulos sin cortes prematuros.
3. **Estilo BRD Paso a Paso en Texto Plano (Guía Operativa + Reglas, Cero Bloques de Código)**:
   - Cada documento debe servir como **guía paso a paso real** para alguien que no sabe cómo funciona una herramienta: botones exactos, pestañas, campos obligatorios, fórmulas, candados, casos borde y automatizaciones.
4. **Segregación Estricta por Rol (`[ROL: ...]`) y Límite `< 500` Líneas**:
   - Todo encabezado `##` y `###` lleva su etiqueta `[ROL: ...]` (ver [`references/templates-brd-llm.md`](./references/templates-brd-llm.md)).
   - Ningún archivo puede superar `500` líneas (divide en `Parte A` y `Parte B` si supera `480` líneas, jamás recortes detalles).
5. **Coordenadas `Lxxx-Lyyy` 100% Compiladas por Script**:
   - Prohibido calcular números de línea a mano. Toda creación, edición o alta de documento finaliza ejecutando [`scripts/build-llm-toc-index.mjs`](./scripts/build-llm-toc-index.mjs).

---

## 2. Estructura Estándar de la Carpeta Exclusiva

```text
/<proyecto>_ai_agent_docs/
├── docs.md                                         # Punto de entrada general e instrucciones de conexión IA
├── 00-CONTENT-TABLE.md                             # Router Maestro Global (archivos, roles, módulos y rangos Lxxx-Lyyy)
├── 01-arquitectura-global-auth-y-roles.md          # Login, navegación, notificaciones y matriz maestra RBAC
├── 02-modulo-<slug>.md                             # 1 doc BRD paso a paso por módulo (o 02a / 02b si > 480 líneas)
├── ...
├── XX-automatizaciones-flujos-e-integraciones.md   # Webhooks, crons, agentes IA, SLAs y flujos End-to-End
└── YY-mapa-capas-egm-referencia.md                 # Mapa EGM que vincula cada DOC-XX con sus rutas, servicios y tablas reales
```

---

## 3. Los 3 Modos de Ejecución (Todos con EGM)

Ejecuta siempre primero la **Fase 0**:
```bash
node <RUTA_SKILL>/scripts/preflight-check.mjs [--target-dir <proyecto>_ai_agent_docs]
```

### Modo A — `BOOTSTRAP` (Primera vez: la carpeta aún no existe)
1. Confirma `egm-bootstrap` instalado (o aprobación explícita `--allow-fallback`) y `/goal` activo.
2. Lee `egm-bootstrap/SKILL.md`, [`references/templates-brd-llm.md`](./references/templates-brd-llm.md) y [`references/rbac-and-egm-scout-protocol.md`](./references/rbac-and-egm-scout-protocol.md).
3. Recorre el repositorio nivel por nivel (BFS sin `find` ciego), levanta el inventario central de módulos y roles RBAC y lanza entre **4 y 8 scouts paralelos (`egm-brd-scout`)** para auditar capa por capa y línea por línea todo el código.
4. Genera `/<proyecto>_ai_agent_docs/` con `docs.md`, `00-CONTENT-TABLE.md`, `01-*`, un BRD paso a paso por módulo, `XX-*` (automatizaciones/flujos) y `YY-*` (mapa EGM de capas).
5. Ejecuta la **Compuerta Final de Indexación** (Sección 4) y entrega la **Tabla de Reporte Final**.

### Modo B — `INCREMENTAL-UPDATE` (Actualizar tras editar código, fórmulas, UI o permisos)
Cuando `/<proyecto>_ai_agent_docs/` **ya existe** y se editaron archivos del proyecto:
1. Lee obligatoriamente **`egm-drift-report/SKILL.md`** y **`egm-bootstrap/SKILL.md`** (rutas entregadas por `preflight-check.mjs`).
2. Cruza los archivos modificados contra `YY-mapa-capas-egm-referencia.md` y `00-CONTENT-TABLE.md` para aislar únicamente los documentos `DOC-XX` impactados.
3. Aplica el protocolo de **`egm-drift-report` + scout EGM acotado al `sub_tree_root` modificado**: lee línea por línea el código actual vs el `DOC-XX` vigente para detectar todas las divergencias (nuevos pasos, botones, fórmulas, validaciones, campos eliminados o cambios de rol RBAC); opcionalmente valida fidelidad con el subagente `egm-codebase-details`.
4. Actualiza el `DOC-XX` afectado (dividiendo en `Parte A / B` si supera `480` líneas) y sincroniza `XX-automatizaciones-*` o `YY-mapa-capas-*` si cambiaron webhooks, rutas o colecciones.
5. Corre `build-llm-toc-index.mjs` para recalcular al instante todos los rangos `Lxxx-Lyyy`.

### Modo C — `NEW-MODULE / NEW-FEATURE` (Agregar un módulo o feature nuevo)
Cuando se construye un módulo nuevo o un feature mayor en un proyecto ya documentado:
1. Lee obligatoriamente **`egm-bootstrap/SKILL.md`** y ejecuta su exploración bottom-up focalizada (`sub_tree_root`) sobre todas las capas del nuevo módulo/feature (rutas UI, componentes, hooks, servicios, APIs, webhooks, reglas DB y permisos RBAC).
2. **Si es sub-feature de un módulo existente**: intégralo con su guía paso a paso y etiqueta `[ROL: ...]` en el `DOC-XX` correspondiente (dividiendo en `a`/`b` si pasa de `480` líneas).
3. **Si es un módulo nuevo**: crea `ZZ-modulo-<slug>.md` en `/<proyecto>_ai_agent_docs/` siguiendo [`references/templates-brd-llm.md`](./references/templates-brd-llm.md), actualiza la matriz RBAC en `01-*` (y Sección 2 de `00-CONTENT-TABLE.md`), documenta sus automatizaciones en `XX-*` y registra sus capas en `YY-mapa-capas-egm-referencia.md`.
4. Corre `build-llm-toc-index.mjs` para registrar automáticamente el nuevo doc y sus rangos `Lxxx-Lyyy` en `00-CONTENT-TABLE.md` y `docs.md`.

---

## 4. Compuerta Final Obligatoria de Indexación y Verificación

Tras crear, editar o añadir cualquier documento en `/<proyecto>_ai_agent_docs/`, ejecuta **siempre**:
```bash
node <RUTA_SKILL>/scripts/build-llm-toc-index.mjs <proyecto>_ai_agent_docs --root-doc <proyecto>_ai_agent_docs/docs.md --max-lines 500
```
Confirma `0` errores de verificación de línea, `0` archivos mayores a `500` líneas y entrega al usuario una **Tabla de Reporte** indicando qué archivos se crearon o actualizaron, sus rutas exactas, roles cubiertos y conteo final de líneas.
