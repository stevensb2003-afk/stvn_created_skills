# Protocolo de Exploración por Enjambre EGM + Extracción RBAC (`rbac-and-egm-scout-protocol.md`)

Este documento detalla cómo los subagentes exploradores (`egm-brd-scout`) deben inspeccionar cualquier repositorio de código de abajo hacia arriba (*Bottom-Up Peanuts & Hay*, inspirado en `/egm-bootstrap`) sin inventar ni omitir una sola función.

---

## 1. Descubrimiento Incremental BFS (Sin `find` ni `ls -R` Ciegos)

1. Inspecciona primero la raíz del proyecto (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `firebase.json`, reglas de base de datos/storage, variables de entorno documentadas).
2. Recorre las carpetas de código nivel por nivel (BFS), ignorando `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage` y carpetas puramente de artefactos compilados.
3. Identifica las **6 Capas Reales del Sistema**:
   - **Capa 1 — Catálogo de Módulos, Rutas y Navegación**: Definición de rutas, menú lateral/superior, home dashboard y constantes de módulos.
   - **Capa 2 — Seguridad, Autenticación y Autorización (RBAC)**: Hooks de permisos en cliente, guardias de servidor, middleware y reglas de base de datos/almacenamiento (`firestore.rules`, `storage.rules`, políticas RLS, decoradores RBAC).
   - **Capa 3 — Interfaz de Usuario (UI)**: Páginas, pestañas, modales, drawers, tablas, barras de filtros, formularios y renderizados condicionales según permisos (`if (isModuleAdmin(...))`).
   - **Capa 4 — Estado, Hooks y Caché Reactiva**: Suscripciones en tiempo real, paginación, borradores en `localStorage`/`IndexedDB`, colas de envío en cliente.
   - **Capa 5 — Lógica de Negocio, Servicios y APIs**: Endpoints REST/RPC, Server Actions, motores de cálculo, validadores, puentes de exportación/importación Excel/PDF.
   - **Capa 6 — Automatizaciones, IA, Crons y Webhooks**: Flujos LLM/GenAI, herramientas de agentes, trabajadores programados (Cloud Scheduler / Cron), funciones serverless (FFmpeg, colas) y webhooks de terceros.

---

## 2. Reglas de Extracción Línea por Línea para Cada Scout (`egm-brd-scout`)

Cuando un scout analiza una partición del código:

1. **Lectura Íntegra Obligatoria**:
   - Todo archivo productivo asignado se lee completo (en bloques de hasta 800 líneas si es largo).
   - **Cero inferencias por nombre de archivo**: Si un botón está deshabilitado, oculto o valida una condición específica en la línea 240, esa condición exacta debe capturarse.
2. **Rastreo Cruzado de Permisos (Frontend + Backend + DB)**:
   - Un permiso solo está bien documentado cuando el scout cruza:
     - Qué muestra/oculta la UI (ej. `hasModuleAccess`, `isModuleAdmin`, `hasPermission`),
     - Qué valida el endpoint o Server Action en el servidor, y
     - Qué permite o bloquea la regla de base de datos (`allow create, update, delete`).
   - Si existe diferencia (por ejemplo: todos ven el historial, pero solo el Admin puede eliminar un registro), documéntalo explícitamente en la **Matriz de Segregación por Rol**.
3. **Traducción de Código Técnico a Lenguaje de Proceso (BRD)**:
   - Convierte cada expresión condicional, fórmula matemática o transacción en una regla de negocio legible:
     - *En código*: `if (discountPct > maxGreenPct) createApprovalRequest(...)`
     - *En documentación BRD*: *"Si el porcentaje de descuento solicitado supera el tope pre-aprobado (Semáforo Verde) de ese escalón o producto, el sistema bloquea la aplicación directa y envía una solicitud de aprobación en tiempo real a Gerencia."*

---

## 3. Particionamiento en Paralelo para Proyectos Grandes (Modo Bootstrap)

- Si el proyecto supera los 15 directorios de código:
  1. Agrupa el árbol por **dominios funcionales cohesivos** (de 4 a 8 particiones paralelas: ej. *Core/Auth/Admin*, *Operaciones/Proyectos*, *Finanzas/Caja/Pagos*, *ERP/Facturación*, *Catálogo/Inventario*, *CRM/Atención*, *Automatizaciones/IA*).
  2. Registra el subagente de solo lectura `egm-brd-scout` (`EnableWriteTools: false`) e invoca todos los scouts en paralelo.
  3. Consolida los hallazgos verificados en los documentos funcionales de la carpeta exclusiva `/<proyecto>_ai_agent_docs/`, verificando que ningún archivo supere las **500 líneas** y ejecutando siempre `scripts/build-llm-toc-index.mjs` como compuerta final obligatoria.

---

## 4. Uso de EGM en Actualizaciones Incrementales y Nuevos Módulos (`egm-drift-report` + `sub_tree_root`)

1. **Actualización Post-Edición (`INCREMENTAL-UPDATE`)**:
   - Combina el protocolo oficial de **`egm-drift-report`** (comparación estricta documento existente vs estado actual del código en disco) con un scout **`egm-bootstrap` acotado por `sub_tree_root`** sobre los directorios modificados.
   - Detecta y corrige las 4 clases de deriva (*Drift*): funciones nuevas sin documentar, pasos/botones que cambiaron en UI, fórmulas o límites modificados en servicios, y cambios en permisos RBAC o reglas de seguridad.
   - Si el entorno cuenta con los subagentes nativos `egm-codebase-details` o `egm-comprehension`, úsalos para validar que la sección actualizada coincida al 100% con el código y sea entendible paso a paso sin contexto previo.
2. **Nuevo Módulo o Feature (`NEW-MODULE`)**:
   - Ejecuta el protocolo bottom-up de **`egm-bootstrap`** apuntando como `sub_tree_root` únicamente a las carpetas del nuevo módulo (UI + Hooks + Servicios/APIs + Reglas DB), evitando re-escanear el resto del repositorio.
3. **Modo Respaldo (`--allow-fallback`)**:
   - Solo se emplea cuando `preflight-check.mjs` detecta que el plugin externo `egm` no está instalado y el usuario **aprobó explícitamente** continuar sin instalarlo todavía. En ese caso, sigue íntegramente las Secciones 1 y 2 de este documento leyendo cada archivo de forma manual o con el subagente `research`.
