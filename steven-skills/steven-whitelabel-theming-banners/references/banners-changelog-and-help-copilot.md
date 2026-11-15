# Banner Global Estilo Jira, Changelog Drawer y Copiloto IA de Ayuda Interna (Capa Gratuita)

---

## 1. Documento Singleton de Avisos Globales (`crm_settings/announcements`)

Una sola lectura compartida gobierna tanto avisos de próximas funcionalidades, alertas de deprecación, mantenimientos o notas de versión:

```typescript
// src/lib/types/announcements.ts
export type AnnouncementSeverity = 'release' | 'upcoming' | 'deprecation' | 'maintenance' | 'alert';

export interface GlobalAnnouncementDoc {
  id: string;
  active: boolean;
  severity: AnnouncementSeverity;
  title: string;                // Ej: "Nueva versión v2.4.0 disponible"
  message: string;              // Ej: "Ya puedes unificar clientes de Instagram y WhatsApp desde el header."
  audience: 'all' | 'admins_only';
  ctaLabel?: string;            // Ej: "Ver novedades"
  ctaAction?: 'open_changelog' | 'external_url';
  ctaUrl?: string;
  dismissible: boolean;
  startsAtMs?: number | null;
  endsAtMs?: number | null;
  updatedAt?: any;
}
```

---

## 2. Banner Global Superior Estilo Jira (`GlobalAnnouncementBanner.tsx`)

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { X, ArrowRight } from '@phosphor-icons/react';
import { useFirestore } from '@/firebase/client';
import { GlobalAnnouncementDoc, AnnouncementSeverity } from '@/lib/types/announcements';
import { AppIcon } from '@/components/ui/app-icon';

const SEVERITY_STYLES: Record<AnnouncementSeverity, { bar: string; icon: string }> = {
  release: { bar: 'bg-primary text-primary-foreground border-b border-primary/20', icon: 'Sparkle' },
  upcoming: { bar: 'bg-tertiary text-tertiary-foreground border-b border-tertiary/20', icon: 'Megaphone' },
  deprecation: { bar: 'bg-warning text-warning-foreground border-b border-warning/30', icon: 'WarningCircle' },
  maintenance: { bar: 'bg-secondary text-secondary-foreground border-b border-border', icon: 'GearSix' },
  alert: { bar: 'bg-destructive text-destructive-foreground border-b border-destructive/20', icon: 'BellRinging' },
};

export function GlobalAnnouncementBanner({
  isAdmin,
  onOpenChangelog,
}: {
  isAdmin: boolean;
  onOpenChangelog: () => void;
}) {
  const firestore = useFirestore();
  const [banner, setBanner] = useState<GlobalAnnouncementDoc | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    setDismissedId(localStorage.getItem('crm_dismissed_announcement_id'));
    if (!firestore) return;
    return onSnapshot(doc(firestore, 'crm_settings', 'announcements'), (snap) => {
      if (!snap.exists()) {
        setBanner(null);
        return;
      }
      setBanner(snap.data() as GlobalAnnouncementDoc);
    });
  }, [firestore]);

  if (!banner?.active) return null;
  if (banner.audience === 'admins_only' && !isAdmin) return null;

  const now = Date.now();
  if (banner.startsAtMs && now < banner.startsAtMs) return null;
  if (banner.endsAtMs && now > banner.endsAtMs) return null;
  if (banner.dismissible && dismissedId === banner.id) return null;

  const style = SEVERITY_STYLES[banner.severity || 'release'];

  return (
    <div
      role="status"
      className={`relative z-30 flex items-center justify-between gap-3 px-4 py-2 text-xs sm:text-sm ${style.bar}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <AppIcon name={style.icon} variant="duotone" size={18} className="shrink-0" />
        <p className="truncate font-medium">
          <strong className="mr-1.5 font-semibold">{banner.title}:</strong>
          <span className="opacity-95">{banner.message}</span>
        </p>
        {banner.ctaLabel && (
          <button
            type="button"
            onClick={() => {
              if (banner.ctaAction === 'external_url' && banner.ctaUrl) {
                window.open(banner.ctaUrl, '_blank', 'noopener,noreferrer');
              } else {
                onOpenChangelog();
              }
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-background/20 px-2.5 py-0.5 text-xs font-semibold hover:bg-background/30 transition-colors"
          >
            <span>{banner.ctaLabel}</span>
            <ArrowRight size={13} weight="bold" />
          </button>
        )}
      </div>
      {banner.dismissible && (
        <button
          type="button"
          onClick={() => {
            localStorage.setItem('crm_dismissed_announcement_id', banner.id);
            setDismissedId(banner.id);
          }}
          className="rounded-md p-1 hover:bg-background/20 transition-colors"
          aria-label="Cerrar aviso"
        >
          <X size={15} weight="bold" />
        </button>
      )}
    </div>
  );
}
```

---

## 3. Drawer Visual de Novedades (`WhatsNewChangelogDrawer.tsx`)

Se conecta directamente al documento `/config/app_version` actualizado por `steven-project-deploy` tras el arranque del servidor:
- Muestra un punto indicador (*unread dot*) en la barra superior cuando `localStorage.getItem('crm_last_seen_version') !== appVersion.currentVersion`.
- Al abrir el panel lateral derecho, marca la versión como vista, renderiza los cambios categorizados (`Nuevo`, `Mejora`, `Corrección`, `Deprecación`) y muestra a `platformDev === true` un editor rápido para publicar notas o encender el `GlobalAnnouncementBanner`.

---

## 4. Copiloto IA de Ayuda Interna (Capa Gratuita Gemini + `*_ai_agent_docs` de `steven-brd-docs-bootstrap`)

Este asistente ayuda a los usuarios de tus clientes a resolver dudas sobre cómo usar la plataforma (*"¿Cómo creo una etiqueta?"*, *"¿Dónde configuro el horario del Round-Robin?"*) leyendo **únicamente los manuales permitidos para su rol RBAC** y consumiendo la **capa gratuita de Google AI Studio (`gemini-2.5-flash-lite`)**.

### Backend Seguro y RBAC-Filtrado (`src/app/api/help-copilot/ask/route.ts`)

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { verifyCrmRequestAuth } from '@/lib/services/crm-auth-guard';
import { resolveCrmIntegrations } from '@/lib/services/crm-credentials-vault';

// Límite simple por usuario en RAM para proteger cuota gratuita (30 consultas/día)
const userDailyCounter = new Map<string, { day: string; count: number }>();

function locateAiDocsDir(): string | null {
  const cwd = process.cwd();
  const entries = fs.readdirSync(cwd, { withFileTypes: true });
  const match = entries.find((e) => e.isDirectory() && e.name.endsWith('_ai_agent_docs'));
  return match ? path.join(cwd, match.name) : null;
}

function selectRoleFilteredDocSlices(docsDir: string, callerRoles: string[], question: string): string {
  const tocPath = path.join(docsDir, '00-CONTENT-TABLE.md');
  if (!fs.existsSync(tocPath)) return '';
  const toc = fs.readFileSync(tocPath, 'utf8');

  // Filtrar archivos markdown cuyo encabezado o rol corresponda al usuario y tengan coincidencia léxica
  const words = question.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  const mdFiles = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md') && f !== '00-CONTENT-TABLE.md');

  const scored: Array<{ file: string; score: number; content: string }> = [];
  for (const file of mdFiles) {
    const raw = fs.readFileSync(path.join(docsDir, file), 'utf8');
    // Filtrado RBAC simple por etiquetas [ROL: ...] presentes en el documento
    const hasAdminOnly = /\[ROL:\s*(ADMIN|OWNER|DEVELOPER)\]/i.test(raw) && !/\[ROL:[^\]]*(TODOS|AGENT|VENDEDOR)/i.test(raw);
    if (hasAdminOnly && !callerRoles.includes('admin') && !callerRoles.includes('owner')) {
      continue;
    }
    const lower = raw.toLowerCase();
    const hits = words.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
    scored.push({ file, score: hits, content: raw });
  }

  scored.sort((a, b) => b.score - a.score);
  const topDocs = scored.slice(0, 2).map((s) => `--- ${s.file} ---\n${s.content.slice(0, 12000)}`);
  return `ÍNDICE:\n${toc.slice(0, 3500)}\n\nMANUALES AUTORIZADOS:\n${topDocs.join('\n\n')}`;
}

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyCrmRequestAuth(req, 'crm.helpCopilot');
    const { question } = await req.json();
    const cleanQ = String(question || '').trim().slice(0, 600);
    if (!cleanQ) {
      return NextResponse.json({ error: 'Escribe tu pregunta.' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const key = `${caller.uid}:${today}`;
    const counter = userDailyCounter.get(key) || { day: today, count: 0 };
    if (counter.count >= 30) {
      return NextResponse.json({ error: 'Límite diario de consultas de ayuda alcanzado (30/día).' }, { status: 429 });
    }
    counter.count += 1;
    userDailyCounter.set(key, counter);

    const integrations = await resolveCrmIntegrations(caller.tenantId);
    const apiKey =
      integrations.helpCopilotAi?.apiKey ||
      process.env.HELP_COPILOT_GEMINI_API_KEY ||
      integrations.ai?.apiKey ||
      '';
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key del Copiloto de Ayuda no configurada.' }, { status: 503 });
    }

    const docsDir = locateAiDocsDir();
    const roles = [caller.isOwner ? 'owner' : '', caller.isCrmAdmin ? 'admin' : 'agent'].filter(Boolean);
    const docContext = docsDir
      ? selectRoleFilteredDocSlices(docsDir, roles, cleanQ)
      : 'No hay carpeta *_ai_agent_docs generada aún. Responde indicando que se debe ejecutar steven-brd-docs-bootstrap.';

    const modelName = integrations.helpCopilotAi?.modelName || 'gemini-2.5-flash-lite';
    const systemPrompt = [
      'Eres el Asistente de Ayuda Interna de la plataforma.',
      'Responde en español claro, amigable y paso a paso (botones, pestañas y reglas exactas) usando EXCLUSIVAMENTE el contexto documental autorizado.',
      'Si la respuesta no está en el contexto o corresponde a un módulo restringido, dilo honestamente y sugiere contactar al administrador.',
    ].join(' ');

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: `CONTEXTO:\n${docContext}\n\nPREGUNTA DEL USUARIO:\n${cleanQ}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
        }),
      }
    );

    if (!geminiRes.ok) {
      return NextResponse.json({ error: `Error del proveedor IA (${geminiRes.status})` }, { status: 502 });
    }

    const data = await geminiRes.json();
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar una respuesta.';
    return NextResponse.json({ ok: true, answer, model: modelName, remainingToday: 30 - counter.count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error en Copiloto' }, { status: err.statusCode || 500 });
  }
}
```
