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

Diseñado para responder dudas operativas del personal del cliente (*"¿Cómo creo una respuesta rápida?"*, *"¿Por qué no puedo responder un chat de hace 3 días?"*) usando **Google Gemini Free Tier (`gemini-2.5-flash-lite`)** y la base documental generada en `/<proyecto>_ai_agent_docs/` (`steven-brd-docs-bootstrap`):

```typescript
// src/app/api/crm/help-copilot/ask/route.ts
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { verifyCrmRequestAuth } from '@/lib/services/crm-auth-guard';
import { resolveCrmIntegrations } from '@/lib/services/crm-credentials-vault';

const dailyRateMap = new Map<string, { day: string; count: number }>();

function loadAuthorizedBrdContext(isAdmin: boolean, question: string): string {
  const cwd = process.cwd();
  const docsFolder = fs.readdirSync(cwd, { withFileTypes: true }).find((d) => d.isDirectory() && d.name.endsWith('_ai_agent_docs'));
  if (!docsFolder) return 'Base documental *_ai_agent_docs aún no generada.';

  const dirPath = path.join(cwd, docsFolder.name);
  const tocPath = path.join(dirPath, '00-CONTENT-TABLE.md');
  const toc = fs.existsSync(tocPath) ? fs.readFileSync(tocPath, 'utf8').slice(0, 3500) : '';

  const keywords = question.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  const candidates = fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith('.md') && f !== '00-CONTENT-TABLE.md')
    .map((f) => {
      const content = fs.readFileSync(path.join(dirPath, f), 'utf8');
      const adminOnly = /\[ROL:\s*(ADMIN|OWNER|DEVELOPER)\]/i.test(content) && !/\[ROL:[^\]]*(TODOS|AGENT|VENDEDOR)/i.test(content);
      if (adminOnly && !isAdmin) return null;
      const lower = content.toLowerCase();
      const score = keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
      return { file: f, score, content };
    })
    .filter(Boolean) as Array<{ file: string; score: number; content: string }>;

  candidates.sort((a, b) => b.score - a.score);
  const body = candidates.slice(0, 2).map((c) => `### ${c.file}\n${c.content.slice(0, 12000)}`).join('\n\n');
  return `${toc}\n\n${body}`;
}

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyCrmRequestAuth(req, 'crm.helpCopilot');
    const { question } = await req.json();
    const cleanQ = String(question || '').trim().slice(0, 600);
    if (!cleanQ) return NextResponse.json({ error: 'Pregunta vacía.' }, { status: 400 });

    const day = new Date().toISOString().slice(0, 10);
    const rateKey = `${caller.uid}:${day}`;
    const entry = dailyRateMap.get(rateKey) || { day, count: 0 };
    if (entry.count >= 30) return NextResponse.json({ error: 'Límite de 30 consultas/día alcanzado.' }, { status: 429 });
    entry.count += 1;
    dailyRateMap.set(rateKey, entry);

    const creds = await resolveCrmIntegrations(caller.tenantId);
    const apiKey = creds.helpCopilotAi?.apiKey || process.env.HELP_COPILOT_GEMINI_API_KEY || creds.ai?.apiKey || '';
    if (!apiKey) return NextResponse.json({ error: 'Configura la tarjeta Copiloto de Ayuda IA en Conexiones y APIs.' }, { status: 503 });

    const model = creds.helpCopilotAi?.modelName || 'gemini-2.5-flash-lite';
    const context = loadAuthorizedBrdContext(caller.isCrmAdmin || caller.isOwner, cleanQ);

    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'Eres el Copiloto de Ayuda Interna del CRM. Responde en español con pasos exactos basados únicamente en la documentación autorizada para el rol del usuario.' }],
          },
          contents: [{ role: 'user', parts: [{ text: `DOCUMENTACIÓN:\n${context}\n\nPREGUNTA:\n${cleanQ}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
        }),
      }
    );
    if (!gRes.ok) return NextResponse.json({ error: `Gemini API error ${gRes.status}` }, { status: 502 });
    const data = await gRes.json();
    return NextResponse.json({
      ok: true,
      answer: data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.',
      model,
      remainingToday: 30 - entry.count,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error Copiloto' }, { status: err.statusCode || 500 });
  }
}
```
