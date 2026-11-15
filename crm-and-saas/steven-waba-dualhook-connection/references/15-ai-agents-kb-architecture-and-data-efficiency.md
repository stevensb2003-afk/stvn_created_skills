# Blueprint 15 — Arquitectura Maestra de Conocimiento IA (`<slug>_ai_agent_docs/`), RAG con Poda RBAC Pre-LLM, Streaming `Click-Pap` y Serialización de Datos Token-Densa

> **Lectura Obligatoria**: Estándar oficial White-Label para construir bases de conocimiento optimizadas para LLMs, asistentes internos de ayuda por rol (`HelpCopilot`), agentes comerciales omnicanal (`SalesAiAgent`) y copilotos B2B/POS de baja latencia (`< 1.5 s`), mínimo consumo de tokens (`-65%` a `-90%`) y aislamiento criptográfico de permisos y errores.

---

## 1. Estándar de Documentación Funcional Orientada a LLMs (`<slug>_ai_agent_docs/`)

En lugar de prompts gigantes o documentos sueltos imposibles de mantener, toda plataforma desplegada organiza su base funcional estilo **BRD (Business Requirements & Process Documentation)** en una carpeta aislada en la raíz del proyecto (`<slug>_ai_agent_docs/`):

```text
<slug>_ai_agent_docs/
├── docs.md                         # Índice raíz, reglas de taxonomía RBAC y guía de lectura
├── 00-CONTENT-TABLE.md             # Enrutador maestro con módulo, rutas y coordenadas Lxxx-Lyyy
├── 01-arquitectura-auth-y-roles.md # Manual transversal de acceso, UI y matriz RBAC
├── 02a-modulo-crm-chats.md         # Módulos extensos se dividen en Parte A y Parte B (< 500 líneas)
├── 02b-modulo-crm-pos-y-agenda.md
└── ...
```

### 4 Reglas Estructurales Obligatorias
1. **Límite Estricto `< 500` Líneas por Archivo**: Si un módulo supera `350–450` líneas, se divide obligatoriamente en **Parte A** y **Parte B** sin recortar reglas, fórmulas ni validaciones.
2. **Metadatos Estándar en Encabezado**:
   ```markdown
   # Módulo: <Nombre legible>
   > **ID Documento**: `DOC-XX` | **Módulo Sistema**: `<moduleId>` | **Rutas**: `/ruta-a, /ruta-b`
   > **Roles con Acceso**: `Colaborador (allowedModules)` | `Admin Módulo (adminModules)`
   > **Propósito LLM**: Resumen denso en 1–2 líneas para ranking semántico.
   ```
3. **Doble Nivel de Tablas de Contenido con Coordenadas Exactas (`Lxxx-Lyyy`)**:
   - **Nivel 1 (`00-CONTENT-TABLE.md`)**: Tabla por archivo con `ID`, `Módulo Sistema`, `Líneas` y `Secciones ##`.
   - **Nivel 2 (`<!-- TOC:START --> ... <!-- TOC:END -->` dentro de cada `.md`)**: Tabla exacta indicando `Sección | Nivel de Rol | Lxxx-Lyyy` para lectura quirúrgica sin cargar archivos completos.
4. **Taxonomía Explícita de Etiquetas RBAC (`[ROL: ...]`) y Matriz Obligatoria**:
   - `[ROL: TODOS]`: Visible para todo usuario autenticado con rol válido.
   - `[ROL: COLABORADOR]`: Usuarios con acceso operativo (`allowedModules`).
   - `[ROL: SUB-PERMISO: <permKey>]`: Sub-permiso granular exacto (ej. `[ROL: SUB-PERMISO: crm.pos]`, `[ROL: SUB-PERMISO: crm.settings.bot]`).
   - `[ROL: ADMIN-MODULO]`: Control Total del módulo (`adminModules`).
   - `[ROL: ADMIN-GLOBAL]`: Administrador Global / Owner.
   - `[ROL: SISTEMA-AUTO]` y `[ROL: REFERENCIA-RBAC]`: Procesos automáticos y reglas directas para orientar al LLM sobre qué responder según el perfil.
   - Toda guía de módulo incluye una tabla **Matriz de Segregación por Rol** y una subsección **Instrucción de Respuesta para el Agente IA según Rol**.

```typescript
// Utilidad CI/CLI para mantener sincronizados 100% los rangos Lxxx-Lyyy en <!-- TOC:START -->
export function buildSectionLineRanges(markdown: string): Array<{ title: string; roleTag: string; start: number; end: number }> {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let inToc = false;
  let inFence = false;
  const heads: Array<{ idx: number; level: number; title: string; roleTag: string }> = [];
  let parentTag = 'TODOS';

  lines.forEach((line, idx) => {
    const t = line.trim();
    if (t === '<!-- TOC:START -->') { inToc = true; return; }
    if (t === '<!-- TOC:END -->') { inToc = false; return; }
    if (inToc) return;
    if (/^(`{3,}|~{3,})/.test(t)) inFence = !inFence;
    if (inFence) return;
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) return;
    const tag = m[2].match(/\[ROL:\s*([^\]]+)\]/i)?.[1]?.trim() || (m[1].length === 2 ? 'TODOS' : parentTag);
    if (m[1].length === 2) parentTag = tag;
    heads.push({ idx, level: m[1].length, title: m[2].replace(/\s*\[ROL:[^\]]+\]\s*/gi, '').trim(), roleTag: tag });
  });

  const pad = (n: number) => `L${String(n).padStart(3, '0')}`;
  return heads.map((h, i) => ({
    title: h.title,
    roleTag: h.roleTag,
    start: h.idx + 1,
    end: (heads[i + 1]?.idx ?? lines.length),
  }));
}
```

---

## 2. Motor Selectivo RAG con Poda Física RBAC Pre-LLM (`help-agent-kb-reader.ts` + `help-agent-rbac.ts`)

> [!CAUTION]
> **REGLA ZERO-TRUST DE PASAPORTE RBAC**: Jamás aceptes roles, módulos ni permisos enviados por el cliente en el body del request. El servidor SIEMPRE reconstruye el `HelpPassport` directamente desde Firebase Auth + `users/{uid}` + `roles/{roleId}` (con caché RAM `45s` invalidable al editar usuarios/roles) y **poda físicamente** las secciones prohibidas *antes* de enviarlas al modelo.

1. **Partición y Caché en Memoria**:
   - Escanea todos los `.md` en `<slug>_ai_agent_docs/` (nuevos manuales se auto-indexan sin tocar código).
   - Caché en RAM: `10 min` en producción / `60s` en desarrollo, pre-normalizando texto en `NFD` (`normalize('NFD').replace(/[\u0300-\u036f]/g, '')`) y filtrando stopwords en español.
2. **Scoring Léxico + Stemming Español + Boost Contextual por Pantalla (`1.45x`)**:
   - Mide coincidencias por raíz de palabra (*abrir/abre/apertur*, *cerrar/cierra*) ponderando **`6x`** las coincidencias en `título` frente a `1.5x` en cuerpo, con bono por cobertura múltiple de tokens.
   - Si el documento pertenece a la ruta actual del usuario (`resolveHelpRouteContext(pathname).docs`), aplica **`score = score * 1.45 + 2`** (sin base vectorial ni costos extra).
3. **Poda Física Pre-LLM y Bloqueo Informativo Seguro**:
   - Si `!canAccessDoc(passport, sec.docModuleId)` o `!evaluateSectionAccess(...)`: la sección **NO entra al prompt**. Solo se añade un aviso resumido de 1 línea hasta un tope de 4 (`[BLOQUEADO POR ROL] "Título" (archivo): requiere <permiso>`) para que el modelo indique qué perfil habilita esa función sin conocer jamás sus pasos.
4. **Políticas Corporativas Vivas desde Firestore (`help_ai_settings/knowledge_addons`)**:
   - Permite a Admins Globales cargar hasta **40 políticas operativas vivas** (`<= 6,000` chars c/u) con audiencia segmentada (`TODOS | COLABORADOR | ADMIN-GLOBAL`), cacheadas por `60s` junto con la configuración y API Key cifrada (`AES-256-GCM`) de la tarjeta `helpCopilotAi` en una sola lectura paralela (`getHelpAiRuntimeBundle()`).

---

## 3. Clasificador Determinístico de Modo + Presupuesto Dinámico & `ThinkingLevel`

Evita gastar razonamiento profundo y contexto extenso en preguntas operativas simples clasificando la intención en `0 ms` con expresiones regulares antes de armar el RAG:

```typescript
// src/lib/services/help-agent-stream-helper.ts
export type HelpQueryMode = 'concise' | 'broad' | 'detailed';

export const MODE_BUDGETS: Record<HelpQueryMode, { maxSections: number; charBudget: number; relevanceRatio: number }> = {
  concise:  { maxSections: 3, charBudget: 3_800, relevanceRatio: 0.42 }, // < 1.5s respuestas puntuales
  broad:    { maxSections: 4, charBudget: 4_200, relevanceRatio: 0.35 }, // Mini resumen + selector botones
  detailed: { maxSections: 6, charBudget: 9_500, relevanceRatio: 0.30 }, // Pasos + reglas completas
};

export const MODE_EXECUTION: Record<HelpQueryMode, { maxOutputTokens: number; thinkingLevel: 'MINIMAL' | 'LOW'; timeoutMs: number }> = {
  concise:  { maxOutputTokens: 560,  thinkingLevel: 'MINIMAL', timeoutMs: 16_000 },
  broad:    { maxOutputTokens: 480,  thinkingLevel: 'MINIMAL', timeoutMs: 16_000 },
  detailed: { maxOutputTokens: 1050, thinkingLevel: 'LOW',     timeoutMs: 22_000 },
};

const BROAD_RE = /^(como funciona|explicame|todo sobre|resumen de|que puedo hacer en)\b/;
const DETAILED_RE = /\b(detallad[oa]|a fondo|complet[oa]|todas las reglas|todos los pasos|profundiz|validaciones y candados)\b/;

export function classifyHelpQueryMode(question: string, normalize: (s: string) => string): HelpQueryMode {
  const norm = normalize(question);
  if (!norm) return 'concise';
  if (DETAILED_RE.test(norm)) return 'detailed';
  if (BROAD_RE.test(norm)) return 'broad';
  return 'concise';
}
```

---

## 4. Streaming SSE Sin Parpadeos, Voz en 1 Turno Multimodal y Botones `Click-Pap` (`<<OPCIONES>>`)

1. **Voz en 1 Sola Llamada Multimodal (Cero Doble Latencia STT)**:
   - Si el navegador envía `audioBase64` junto con transcripción preliminar (`>= 6` chars), adjunta el audio al mismo turno `generateContentStream` indicando iniciar con `[TRANSCRIPCIÓN: texto exacto]` y en seguida responder la guía (`0` llamadas bloqueantes extra). Solo si viene audio sin transcripción previa ejecuta `transcribeAudioFast` con `ThinkingLevel.MINIMAL`.
2. **Filtro de Stream Sin Parpadeo (`createHelpStreamFilter`)**:
   - Retiene únicamente los primeros caracteres si espera `[TRANSCRIPCIÓN: ...]` (máx. 360 chars) y retiene al final hasta `HELP_OPTIONS_MARKER.length - 1` chars por si viene el delimitador `<<OPCIONES>>`.
   - Emite deltas limpios en tiempo real al cliente vía NDJSON/SSE y al detectar `<<OPCIONES>>`, corta el streaming visible al usuario, acumula el resto y parsea hasta **4 botones interactivos `Click-Pap`** (`Etiqueta corta::Consulta segura según rol`).
3. **Convenciones Visuales en el Texto del Asistente**:
   - Nombres exactos de botones, pestañas y campos encerrados entre dobles corchetes (`[[Abrir Caja de Hoy]]`) renderizados como chips tipo tecla; bloques destacados con `> Regla:`, `> Automático:`, `> Importante:` y `> Sin acceso:`.

---

## 5. Estructuración Ultra-Densa de Datos para Agentes IA (`SalesAiAgent`, `B2B`, `POS`)

Toda integración de datos comerciales, inventario, facturas o catálogos hacia un modelo Gemini / OpenAI / Anthropic DEBE cumplir estas **5 leyes de eficiencia y precisión**:

1. **Regla Anti-JSON Crudo (`-65%` a `-75%` Tokens)**:
   - **Prohibido** pasar `JSON.stringify(products)` con claves repetidas (`"sku":`, `"price_total":`, `"category_name":`) por cada ítem.
   - Agrupa por `[Nombre Categoría]` y formatea **1 línea compacta por ítem**, omitiendo descripciones que repitan el nombre y unidades por defecto:
   ```text
   [Láminas Decorativas]
   LMP1041: LÁMINA MÁRMOL BLANCO (1.22x2.44m) | ₡18,500 [🔥PROMO -15% ₡15,725] [FOTO_WEB]
   LMP1042: LÁMINA PIEDRA GRIS (1.20x0.60m) | ₡12,900/Pliego [FOTO_WEB]
   ```
2. **Zero-Trust Data Shaping Pre-LLM**:
   - Filtra en servidor antes de armar el prompt todo campo interno (`price_cost`, márgenes, cuentas contables) y todo grupo/SKU marcado en listas de exclusión (`excludedAiCategoryIds`, `excludedAiSkuPrefixes`, productos `active === false || activeWeb === false`).
3. **Arquitectura `Static-First` para Implicit Prefix Caching (`-90%` Costo Input Gemini)**:
   - Coloca en `systemInstruction` exclusivamente el bloque inmutable ordenado `A–Z`: Constitución de Mundo Cerrado (`Closed-World SSOT Veto`), catálogo compacto, lista de promociones y diccionario de activos multimedia permitidos. Cachea el objeto de conocimiento en RAM (`TTL 60s`) e invalídalo al instante al guardar productos o promos (`invalidateCrmAiContextCache()`).
   - Todo dato variable por turno (nombre del cliente, hora actual, historial reciente `<= 24` mensajes, notas internas recientes, origen anuncio CTWA) va en `contents[user]`.
4. **Salida Estructurada (`responseJsonSchema`) con IDs Cortos + Validación Server-Side**:
   - Jamás pidas al LLM que genere ni recuerde URLs firmadas largas de Storage. Pídele arreglos tipados de IDs (`selectedProductSkusToPhoto`, `selectedMarketingImageIds`, `selectedCatalogPdfIds`, `suggestedTagNames`) y deja que el servidor valide ámbito (`[INTERIOR]` vs `[EXTERIOR]` vs `[GENERAL]`), deduplique URLs ya enviadas (`alreadySentMediaUrls`) y resuelva los enlaces reales antes de llamar a Dualhook.
5. **Compuertas Determinísticas Cero-Tokens Pre-LLM**:
   - Antes de consumir 1 solo token evalúa en código: candado atómico `runTransaction` sobre `aiPendingEvaluation`, filtro de eco móvil (`isEcho`), takeover humano posterior, expiración de ventana WhatsApp `24h`, y detector de despedidas/cortesías finales (`isClosingCourtesyMessage`: *"gracias"*, *"ok perfecto"*, *"listo"*).

---

## 6. Circuit Breaker Multi-Ámbito (`GeminiErrorScope`) y Retry Acotado Pre-Envío

Para garantizar disponibilidad continua incluso cuando un modelo Flash sufre picos `503/429` o cuotas gratuitas diarias, implementa este enrutador de salud compartido entre todos los agentes del CRM:

```typescript
// src/lib/utils/gemini-error-formatter.ts — Circuit Breaker por ámbito + cero fugas JSON RPC
export const ACTIVE_GEMINI_FLASH_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
] as const;

export type GeminiErrorScope = 'crm' | 'help' | 'b2b' | 'ops';

const congestedByScope = new Map<string, number>();

export function markGeminiModelCongested(scope: GeminiErrorScope, model: string, err?: unknown): void {
  const msg = String((err as any)?.message || err || '');
  const ttl = /404|NOT_FOUND|no longer available/i.test(msg)
    ? 60 * 60_000
    : /PerDay|per day/i.test(msg)
    ? 30 * 60_000
    : 5 * 60_000;
  congestedByScope.set(`${scope}:${model}`, Date.now() + ttl);
}

export function markGeminiModelHealthy(scope: GeminiErrorScope, model: string): void {
  congestedByScope.delete(`${scope}:${model}`);
}

export function buildHealthyCandidateModels(scope: GeminiErrorScope, preferred?: string | null): string[] {
  const now = Date.now();
  const clean = String(preferred || '').replace(/^googleai\//i, '').trim() || ACTIVE_GEMINI_FLASH_MODELS[0];
  const unique = Array.from(new Set([clean, ...ACTIVE_GEMINI_FLASH_MODELS]));
  return [
    ...unique.filter((m) => (congestedByScope.get(`${scope}:${m}`) || 0) <= now),
    ...unique.filter((m) => (congestedByScope.get(`${scope}:${m}`) || 0) > now),
  ];
}
```

### Reglas Operativas Obligatorias de Resiliencia:
1. **Cero JSON Crudo al Usuario (`formatGeminiErrorForUser`)**: Traduce cualquier `401/403`, `429` (Free Tier diario vs límite por minuto, extrayendo `retryDelay`), `503` y `AbortError` a mensajes humanos accionables en español.
2. **Reintentos Acotados Solo Pre-Envío (`AiGenerationError`)**: Si el envío a WhatsApp todavía **no** ocurrió, programa hasta `2` reintentos con `6s` de espera (`aiRetryCount <= 2`). Al agotarse, desactiva `aiHandling`, marca `aiPausedByEscalation: true` y registra una **Nota Interna** automática avisando al asesor humano para evitar bucles infinitos o mensajes duplicados.
