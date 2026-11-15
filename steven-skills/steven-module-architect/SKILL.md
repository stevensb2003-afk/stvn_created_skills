---
name: steven-module-architect
description: >
  Arquitecto universal e independiente del proyecto para diseñar e implementar nuevos módulos o features completos en cualquier aplicación web.
  Analiza automáticamente las dependencias de package.json, router, design tokens CSS, librería de íconos, sistema RBAC, reglas/índices de base de datos, feature flags de licenciamiento y documentación IA (*_ai_agent_docs). Realiza una entrevista interactiva corta (ask_question), cablea tipos, backend seguro, reglas O(1), UI modular (< 500 líneas por archivo) y sincroniza la documentación BRD con steven-brd-docs-bootstrap.
  Actívalo cuando el usuario escriba "/steven-module-architect", "/nuevo-modulo", "/crear-modulo", "agregar nuevo módulo", "implementar módulo respetando RBAC" o pida extender cualquier proyecto con una nueva funcionalidad completa.
---

# Arquitecto Universal de Nuevos Módulos (`steven-module-architect`)

Este skill permite agregar módulos nuevos a **cualquier proyecto** (este CRM o cualquier otra aplicación Next.js/React/Vite/Firebase/SQL) sin romper su estilo visual, sin dejar huecos de seguridad RBAC y manteniendo sincronizada la base documental de IA.

---

## Fase 0: Escaneo Automático del Repositorio (Obligatorio Antes de Codificar)

Ejecuta primero el analizador arquitectónico sobre el proyecto destino:

```bash
node ~/.gemini/config/skills/steven-module-architect/scripts/analyze-project-architecture.mjs "<RUTA_DEL_PROYECTO>"
```

Lee cuidadosamente el reporte para identificar:
1. Framework (`nextjs-app-router`, `vite-react`, etc.) y base de datos (`firebase-firestore`, `supabase`, `prisma`).
2. Tokens CSS existentes (`globals.css`, `--primary`, `--tertiary`).
3. Librería de íconos instalada (`@phosphor-icons/react`, `lucide-react`, etc.).
4. Archivos reales de RBAC (`crm-permissions.ts`, `crm-auth-guard.ts`, `firestore.rules`) y licenciamiento (`tenant_license`).
5. Presencia de carpeta `/<proyecto>_ai_agent_docs/` para documentación BRD.

---

## Fase 1: Entrevista Interactiva con `ask_question`

Antes de escribir archivos, lanza `ask_question` para alinear alcance, visibilidad y modelo de negocio:

```json
{
  "questions": [
    {
      "question": "¿Cómo debe montarse este nuevo módulo dentro de la aplicación?",
      "is_multi_select": false,
      "options": [
        "(Recommended) Módulo Principal en navegación global (nueva ruta dedicada + ítem en menú)",
        "Submódulo Contextual dentro de un registro o chat existente (barra contextual + panel lateral)",
        "Módulo Opcional / Add-on vendible por separado (controlado por switch en panel Developer / tenant_license)"
      ]
    },
    {
      "question": "¿Qué roles y restricciones de seguridad debe respetar este módulo?",
      "is_multi_select": true,
      "options": [
        "(Recommended) Permisos RBAC granulares propios (ver, crear, editar, eliminar, administrar)",
        "(Recommended) Reglas estrictas de Base de Datos (firestore.rules / RLS) + validación en servidor",
        "(Recommended) Actualizar documentación IA paso a paso con steven-brd-docs-bootstrap al terminar",
        "Requiere credenciales externas guardadas en Bóveda Cifrada Write-Only"
      ]
    }
  ]
}
```

---

## Fase 2 a 4: Ejecución Guiada por Patrón

Consulta [`references/module-integration-checklists.md`](./references/module-integration-checklists.md) y ejecuta en orden estricto:

1. **Contratos & Seguridad (Backend primero):**
   - Define tipos en TypeScript y validadores (`zod` o sanitizador `removeUndefined`).
   - Agrega permisos granulares en el archivo maestro RBAC detectado por el escáner.
   - Si es un add-on comercial, agrega su clave `<moduleKey>` en el esquema de licenciamiento (`/config/tenant_license`) y protege tanto la ruta API como `firestore.rules`.
   - Crea índices compuestos necesarios en `firestore.indexes.json` (o migración SQL).
2. **Endpoints / Server Actions:**
   - Todo endpoint/Server Action debe validar token e invocar el guardián RBAC detectado (`verifyCrmRequestAuth` o equivalente) + verificar licencia activa del módulo.
   - Si usa llaves externas, intégralas en la Bóveda Cifrada Write-Only (nunca `NEXT_PUBLIC_*`).
3. **Frontend Modular (`< 500` líneas por archivo):**
   - Respeta 100% los tokens semánticos CSS del proyecto (`--primary`, `--secondary`, `--tertiary`, `--card`, `--border`) sin quemar colores HEX.
   - Usa la librería de íconos estándar del proyecto (priorizando `<AppIcon />` / `@phosphor-icons/react` si está disponible).
   - Cubre los 4 estados obligatorios de UX: Carga (*Skeleton*), Vacío (*Empty state con CTA*), Error recuperable y Bloqueado por Plan/Permiso.

---

## Fase 5: Sincronización Documental IA + Compuerta de Compilación

1. Si el proyecto tiene `/<proyecto>_ai_agent_docs/` (o el usuario aprobó actualizar docs): ejecuta el flujo **Modo C (`NEW-MODULE`)** detallado en [`references/module-integration-checklists.md`](./references/module-integration-checklists.md) usando `steven-brd-docs-bootstrap` para que el Copiloto IA interno conozca el nuevo módulo.
2. Verifica antes de entregar:
   - `npm run typecheck` (o `tsc --noEmit`) con `0` errores.
   - `npm run build` exitoso.
   - Confirmar que ningún archivo nuevo supera las `500` líneas.
