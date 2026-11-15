# Blueprint 09 — Personalización en Vivo desde Frontend (`--primary`/`--secondary`/`--tertiary`), Íconos `@phosphor-icons/react`, Banner Global tipo Jira y Copiloto IA de Ayuda

> **Lectura Obligatoria**: Implementa la personalización visual desde el navegador sin tocar código, íconos no genéricos, barra global de avisos y el asistente IA de ayuda interna en capa gratuita.

---

## 1. Estudio de Marca y Temas en Vivo (`crm_settings/branding`)

En *Configuración CRM → Marca y Apariencia* (`crm.settings.branding`), el administrador del cliente personaliza sin tocar código:
- **Nombre comercial, Logo y Favicon:** Subidos y comprimidos a `.webp` en Storage bajo `/public_branding/{file}.webp` (`allow read: if true;`, para cargar en `/login` e invitaciones).
- **Selector de 8 Paletas Calibradas WCAG AA/AAA (`THEME_PALETTES`):** *Sky Slate*, *Emerald Executive*, *Royal Indigo*, *Warm Terracotta*, *Obsidian Luxe*, *Nordic Ocean Teal*, *Modern Violet* y *Crimson Studio* (Light + Dark).
- **Modo Personalizado (`primary`, `secondary`, `tertiary`):** Pickers de color que calculan automáticamente el contraste de texto (`getAccessibleForegroundHsl`) e inyectan `--primary`, `--secondary`, `--tertiary` y `--radius` en `document.documentElement.style`.
- **Zero-FOUC:** `ThemeInjectorProvider` lee `localStorage.getItem('crm_branding_cache')` inmediatamente en montaje y se suscribe por `onSnapshot` a `crm_settings/branding`.

---

## 2. Sistema de Íconos Anti-IA (`@phosphor-icons/react` + `<AppIcon />`)

Todo ícono nuevo o migrado se renderiza con `<AppIcon />` (`src/components/ui/app-icon.tsx`) usando `@phosphor-icons/react`:
- Peso **`duotone`** para menús laterales, tarjetas KPI, módulos de Configuración y estados vacíos.
- Peso **`regular` / `bold`** para acciones densas en chat y toolbars.
- Incluye un mapa de compatibilidad (`LEGACY_LUCIDE_ALIASES`: `Bot -> Robot`, `Users -> UsersThree`, `MessageSquare -> ChatsCircle`, `Settings -> GearSix`, `Truck -> Truck`, `Zap -> Lightning`, `KeyRound -> Key`) para respetar configuraciones previas guardadas en Firestore (`operationalDivisions` y `schedulingModule`).

---

## 3. Banner Global Estilo Jira (`GlobalAnnouncementBanner`) & Drawer de Novedades

### Documento `crm_settings/announcements`
Permite mostrar una barra superior global en todo el CRM para comunicar nuevas versiones, próximas funciones, deprecaciones o mantenimientos:
- `severity`: `'release' | 'upcoming' | 'deprecation' | 'maintenance' | 'alert'` (estilizados únicamente con tokens `bg-primary`, `bg-tertiary`, `bg-warning`, `bg-secondary`, `bg-destructive`).
- `audience`: `'all' | 'admins_only'`.
- `startsAtMs` / `endsAtMs` + `dismissible: boolean`.
- Botón CTA conectado al **`WhatsNewChangelogDrawer`**, el cual lee `/config/app_version` (`version`, `releaseSummary`, `changelogItems[]`) sincronizado por `steven-project-deploy` tras cada release.

---

## 4. Copiloto IA de Ayuda Interna en Capa Gratuita (`POST /api/crm/help-copilot/ask`)

Diseñado para responder dudas operativas del personal del cliente (*"¿Cómo creo una respuesta rápida?"*, *"¿Por qué no puedo responder un chat de hace 3 días?"*) en **< 1.5 s** sobre **Google Gemini Free Tier / Flash** (`gemini-3.6-flash` / `gemini-2.5-flash-lite`) y la base documental modular `<slug>_ai_agent_docs/` segregada por rol.

> [!IMPORTANT]
> **Arquitectura Completa en [Blueprint 15](./15-ai-agents-kb-architecture-and-data-efficiency.md)**: El motor completo de doble tabla de contenidos `Lxxx-Lyyy`, poda física RBAC pre-LLM por sección `##/###`, clasificador `concise | broad | detailed` con `ThinkingLevel.MINIMAL`, streaming SSE sin parpadeos (`createHelpStreamFilter`) y Circuit Breaker multi-modelo está especificado en el Blueprint 15.

### 4.1 Experiencia UX Multi-Dispositivo & Bóveda Privada de Historial (`crm_help_chats`)
1. **Desktop (`>= 768px`)**: Botón en barra superior `[[Guía · Nombre Pantalla Actual]]` + atajo global `⌘J` (Mac) / `Ctrl+J` (Windows/Linux) que abre un drawer lateral **no bloqueante** para seguir operando formularios mientras se leen los pasos; dentro de `/crm` se integra en la cabecera de la sidebar.
2. **Móvil (`< 768px`)**: Botón flotante adaptativo (se eleva automáticamente en pantallas con barras inferiores y se oculta en `/login`); abre a pantalla completa con botón retorno `←`.
3. **Voz en 1 Turno + Chips `Click-Pap`**: Soporta notas de voz (`<= 2 min` sin persistir audio binario, solo transcripción) y muestra botones clicables `[[Nombre Botón]]` más 2–4 chips de seguimiento (`<<OPCIONES>>`) filtrados para el rol del usuario.
4. **Historial Privado Transaccional (`crm_help_chats/{chatId}`)**:
   - **Acceso exclusivo Admin SDK** (`allow read, write: if false;` en `firestore.rules`): guarda `uid`, `title`, `areaLabel`, `updatedAt` y hasta **24 mensajes por conversación**, podando en `runTransaction` las conversaciones más antiguas cuando un usuario supera **10 chats activos**.

### 4.2 Flujo del Endpoint Streaming (`POST /api/crm/help-copilot/ask`)

```typescript
// src/app/api/crm/help-copilot/ask/route.ts — Orquestador Streaming SSE con Poda RBAC y Bóveda Aislada
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { verifyCrmRequestAuth } from '@/lib/services/crm-auth-guard';
import { resolveCrmIntegrations } from '@/lib/services/crm-credentials-vault';
import { buildHelpPassport, describePassport } from '@/lib/services/help-agent-rbac';
import { retrieveAuthorizedKnowledge } from '@/lib/services/help-agent-kb-reader';
import { classifyHelpQueryMode, createHelpStreamFilter, streamHelpGeminiWithFallback } from '@/lib/services/help-agent-stream-helper';
import { appendHelpChatTurn } from '@/lib/services/help-agent-chats-service';
import { resolveHelpRouteContext } from '@/lib/constants/help-route-context';
import { buildHealthyCandidateModels } from '@/lib/utils/gemini-error-formatter';

const RATE_WINDOW = new Map<string, { day: string; count: number }>();

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyCrmRequestAuth(req, 'crm.helpCopilot');
    const body = await req.json();
    const question = String(body.message || '').trim().slice(0, 1200);
    if (!question && !body.audioBase64) {
      return NextResponse.json({ error: 'Consulta vacía.' }, { status: 400 });
    }

    // Rate-limit protector por usuario (ej. 30 consultas/día en capa gratuita o 20/min en Tier 1)
    const day = new Date().toISOString().slice(0, 10);
    const rate = RATE_WINDOW.get(`${caller.uid}:${day}`) || { day, count: 0 };
    if (rate.count >= 40) return NextResponse.json({ error: 'Límite diario del Copiloto alcanzado.' }, { status: 429 });
    rate.count += 1;
    RATE_WINDOW.set(`${caller.uid}:${day}`, rate);

    const creds = await resolveCrmIntegrations(caller.tenantId);
    const apiKey = creds.helpCopilotAi?.apiKey || process.env.CRM_HELP_AGENT_API_KEY || creds.ai?.apiKey || '';
    if (!apiKey) {
      return NextResponse.json({ error: 'Configura la tarjeta Copiloto de Ayuda IA en Conexiones y APIs.' }, { status: 503 });
    }

    // 1. Reconstrucción Zero-Trust del pasaporte RBAC desde Firestore (nunca del cliente)
    const passport = await buildHelpPassport(caller.uid, caller.email, caller.displayName || '');
    const route = resolveHelpRouteContext(body.pathname || '/');
    const mode = classifyHelpQueryMode(question);
    // 2. Poda física Pre-LLM de secciones ##/### según [ROL: ...] + políticas vivas
    const kb = retrieveAuthorizedKnowledge({ question, passport, route, addons: body.livePolicies || [], mode });

    const ai = new GoogleGenAI({ apiKey });
    const models = buildHealthyCandidateModels('help', creds.helpCopilotAi?.modelName || 'gemini-3.6-flash');
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (ev: unknown) => controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
        try {
          emit({ type: 'stage', stage: { id: 'rbac', label: 'Rol y secciones verificadas', detail: `${kb.sources.length} fuentes`, status: 'done' } });
          const filter = createHelpStreamFilter(
            Boolean(body.audioBase64),
            (transcript) => emit({ type: 'meta', transcript }),
            (text) => emit({ type: 'delta', text })
          );

          const { usedModel } = await streamHelpGeminiWithFallback({
            ai,
            models,
            mode,
            temperature: 0.2,
            systemInstruction: 'Responde únicamente con CONTEXTO AUTORIZADO según el rol. Usa [[Botón]] y cierra con <<OPCIONES>>.',
            contents: [{ role: 'user', parts: [{ text: `PERFIL:\n${describePassport(passport)}\n\nCONTEXTO:\n${kb.context}\n\nPREGUNTA:\n${question}` }] }],
            onTextChunk: (chunk) => filter.push(chunk),
          });
          filter.flush();

          const assistantMsg = {
            id: `a_${Date.now()}`,
            role: 'assistant' as const,
            content: filter.getCleanText(),
            createdAt: Date.now(),
            quickOptions: filter.getQuickOptions(),
            trace: { areaLabel: route.areaLabel, roleLabel: passport.roleLabel, sources: kb.sources, model: usedModel },
          };
          const chatId = await appendHelpChatTurn({
            uid: caller.uid,
            chatId: body.chatId,
            areaLabel: route.areaLabel,
            route: body.pathname || '/',
            userMessage: { id: `u_${Date.now()}`, role: 'user', content: filter.getTranscript() || question, createdAt: Date.now() },
            assistantMessage: assistantMsg,
          });
          emit({ type: 'done', chatId, message: assistantMsg });
        } catch (err: any) {
          emit({ type: 'error', error: err?.message || 'Error en Copiloto IA' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error Copiloto' }, { status: err.statusCode || 500 });
  }
}
```
