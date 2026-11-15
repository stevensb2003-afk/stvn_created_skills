# Plantillas Maestras BRD + Coordenadas LLM + Segregación RBAC (`steven-brd-docs-bootstrap`)

Este archivo define el formato canónico obligatorio para todos los documentos generados por el skill `steven-brd-docs-bootstrap`.

---

## 1. Reglas de Formato Orientadas a LLMs y Centros de Ayuda

1. **Lenguaje Funcional Estilo BRD (Cero Bloques de Código Crudo)**:
   - Explica **qué hace** cada pantalla/función, **para qué sirve en el negocio**, **cómo ejecutar cada proceso paso a paso**, **qué validaciones o fórmulas aplica** y **qué ocurre automáticamente después**.
   - **Prohibido** pegar funciones TypeScript/SQL completas en los documentos funcionales. Solo se usan identificadores breves entre comillas invertidas cuando ayudan al enrutamiento (ej. ruta `/caja`, módulo `caja`, permiso `crm.pos`).
2. **Etiquetas Obligatorias de Rol `[ROL: ...]` en Cada Encabezado `##` y `###`**:
   - Todo encabezado `## ` y `### ` **DEBE** terminar con una etiqueta estandarizada `[ROL: ...]`:
     - `[ROL: TODOS]` — Disponible para cualquier usuario autenticado de la aplicación.
     - `[ROL: COLABORADOR]` — Disponible para usuarios con acceso operativo estándar al módulo (`<permiso_operativo>` o rol base).
     - `[ROL: SUB-PERMISO: <id>]` — Requiere un sub-permiso granular específico (ej. `[ROL: SUB-PERMISO: pos]`, `[ROL: SUB-PERMISO: metricas]`).
     - `[ROL: ADMIN-MODULO]` — Exclusivo para usuarios con Control Total / Administración del módulo (`<permiso_admin_modulo>`).
     - `[ROL: ADMIN-GLOBAL]` — Exclusivo para Super-Administradores del sistema (`admin` / Owner).
     - `[ROL: SISTEMA-AUTO]` — Automatizaciones, agentes IA, webhooks, colas o validaciones automáticas que corren en segundo plano.
     - `[ROL: REFERENCIA-RBAC]` — Tablas comparativas de permisos para instruir al Agente IA sobre qué responder a cada perfil.
3. **Límite Estricto de Tamaño por Archivo (`<= 480` líneas, tope duro `500`)**:
   - Si un módulo es extenso (ej. CRM, Planificador 2D, ERP Contable), **divídelo en Parte A y Parte B** (ej. `09a-...md` y `09b-...md`) en vez de resumir u omitir funciones. Jamás sacrifiques precisión ni sobrepases las 500 líneas.
4. **Bloque `<!-- TOC:START --> ... <!-- TOC:END -->` Autogenerado**:
   - Nunca calcules números de línea a mano. Redacta el documento con el marcador `<!-- TOC:START -->` y `<!-- TOC:END -->` vacío y ejecuta `scripts/build-llm-toc-index.mjs` al finalizar para inyectar y verificar matemáticamente cada rango `Lxxx-Lyyy`.

---

## 2. Plantilla A: Carpeta Exclusiva (`/<proyecto>_ai_agent_docs/`) y Tabla Maestra (`00-CONTENT-TABLE.md`)

> **Regla de Aislamiento**: Tanto `docs.md` como `00-CONTENT-TABLE.md` y todos los `XX-*.md` viven siempre dentro de una única carpeta dedicada en la raíz del proyecto (`/<proyecto>_ai_agent_docs/`), jamás mezclados dentro de un directorio `/docs/` preexistente.

```markdown
# Índice Maestro de Navegación Documental para IA (`CONTENT TABLE`)
> **ID Documento**: `DOC-00` | **Módulo Sistema**: `global-router` | **Rutas**: `Todas`
> **Roles con Acceso**: `Router Maestro para Agente IA Multi-Rol y Lectura Humana`
> **Propósito LLM**: Tabla central de enrutamiento que indica en qué archivo de `<proyecto>_ai_agent_docs/` y en qué líneas exactas se encuentra cada módulo, proceso paso a paso, regla de negocio, automatización y nivel de permiso RBAC.

<!-- TOC:START -->
<!-- TOC:END -->

## 1. Protocolo de Lectura Eficiente y Respuesta por Rol para el Agente IA [ROL: REFERENCIA-RBAC]

1. **Identifica primero el Rol del Usuario que pregunta**:
   - Verifica sus módulos operativos permitidos (`<permisos_operativos>`), sus módulos administrados (`<permisos_admin_modulo>`) y sus sub-permisos granulares.
2. **Localiza el Archivo Destino en la Tabla Maestra inferior**:
   - No leas todos los archivos del repositorio. Selecciona únicamente el archivo cuyo alcance coincida con la consulta.
3. **Lee primero la Tabla de Contenido interna del archivo destino (`L001-L045`)**:
   - Ubica el subtema exacto y verifica su columna `Nivel de Rol`.
4. **Regla de Oro de Segregación por Rol**:
   - Si la sección marca `COLABORADOR` o `TODOS` y el usuario tiene acceso al módulo: guía paso a paso con todas las instrucciones.
   - Si la sección marca `ADMIN-MODULO`, `ADMIN-GLOBAL` o un `SUB-PERMISO` que el usuario **NO** posee: **no le des pasos que no podrá ejecutar en su pantalla**; infórmale con claridad que esa acción existe pero requiere perfil de Administrador del módulo (o el sub-permiso correspondiente) e indícale a quién solicitarlo.

## 2. Matriz Rápida de Módulos y Roles del Sistema [ROL: REFERENCIA-RBAC]

| Módulo ID | Nombre Comercial | Ruta Principal | Alcance Colaborador (`<permiso_operativo>`) | Alcance Admin (`<permiso_admin>`) | Documento(s) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ... | ... | ... | ... | ... | ... |

## 3. Directorio Global de Archivos y Coordenadas de Línea [ROL: TODOS]

<!-- MASTER-INDEX:START -->
<!-- MASTER-INDEX:END -->
```

---

## 3. Plantilla B: Documento Funcional BRD por Módulo (`XX-modulo-nombre.md`)

```markdown
# Módulo: [Nombre Comercial del Módulo]
> **ID Documento**: `DOC-XX` | **Módulo Sistema**: `<id_modulo>` | **Rutas**: `/ruta-principal`, `/subruta`
> **Roles con Acceso**: `Colaborador (<permiso_operativo>)` | `Admin Módulo (<permiso_admin_modulo>)` | `Admin Global (<rol_superadmin>)`
> **Propósito LLM**: Documentación funcional completa estilo BRD de capacidades, pantallas, flujos paso a paso, fórmulas, validaciones y segregación de permisos por rol.

<!-- TOC:START -->
<!-- TOC:END -->

## 1. Propósito de Negocio y Visión General del Módulo [ROL: TODOS]
Explicación clara en lenguaje llano de qué problema resuelve el módulo, quiénes lo utilizan en la operación diaria y cómo se conecta con el resto de la aplicación.

## 2. Matriz de Segregación de Funciones por Rol (Colaborador vs Admin) [ROL: REFERENCIA-RBAC]
Tabla y reglas explícitas que distinguen qué ve y qué puede ejecutar cada rol dentro del módulo, qué botones desaparecen o se bloquean sin permisos y qué responder desde el Agente IA a cada tipo de usuario.

## 3. Estructura de Pantallas, Vistas, Filtros y Controles [ROL: COLABORADOR]
Descripción detallada de cada zona de la interfaz, pestañas, tarjetas de indicadores, columnas de tablas, filtros de búsqueda y estados posibles de los registros.

## 4. Procesos Operativos Paso a Paso — Nivel Colaborador [ROL: COLABORADOR]
### 4.1 Cómo [ejecutar proceso 1] [ROL: COLABORADOR]
1. Paso exacto en pantalla...
2. Campos obligatorios, opcionales y validaciones...
3. Resultado esperado y efectos automáticos...

## 5. Procesos de Supervisión, Configuración y Control Total — Nivel Admin [ROL: ADMIN-MODULO]
### 5.1 Cómo [ejecutar función administrativa 1] [ROL: ADMIN-MODULO]
1. Paso exacto en pantalla...
2. Restricciones de seguridad e impacto sobre otros usuarios...

## 6. Reglas de Negocio, Fórmulas, Límites y Casos Borde [ROL: TODOS]
Listado preciso de fórmulas matemáticas, redondeos, impuestos, estados inmutables, validaciones que impiden errores y mensajes de alerta comunes.

## 7. Automatizaciones Conectadas e Integraciones del Módulo [ROL: SISTEMA-AUTO]
Qué notificaciones dispara el módulo, qué sincronizaciones automáticas ejecuta y con qué otros módulos o servicios externos intercambia información.
```

---

## 4. Plantilla C: Documento Transversal de Automatizaciones y Flujos (`XX-automatizaciones-y-flujos.md`)

Documenta en texto plano comprensible todos los procesos autónomos del sistema:
1. Webhooks entrantes y salientes (disparador, validación, acciones en cascada, manejo de duplicados/fallos).
2. Tareas programadas (Crons, colas SLA, horarios laborales, feriados, repartos automáticos).
3. Agentes de IA integrados (qué leen, qué herramientas tienen, qué guardrails nunca pueden romper, cuándo escalan a un humano).
4. Flujos de negocio End-to-End que cruzan múltiples módulos desde el primer contacto hasta la post-venta.
