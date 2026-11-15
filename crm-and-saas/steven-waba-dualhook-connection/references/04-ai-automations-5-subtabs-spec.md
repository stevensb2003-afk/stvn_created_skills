# Blueprint 04 — Módulo `Automatizaciones` (`SettingsBot`): Contenedor Maestro, `SmartVariableTextarea` y los 5 Subtabs Ejecutables

> **Lectura Obligatoria**: Todo agente que construya (`MODO A`), integre (`MODO B`) o audite (`MODO C`) el módulo de Inteligencia Artificial y Automatizaciones del CRM debe implementar el contenedor `SettingsBot`, el motor seguro de píldoras `SmartVariableTextarea` y **los 5 subtabs completos** (`General`, `Multimedia y Fuentes`, `Reglas y Campañas`, `Simulador` con micrófono/inspector y la hoja ejecutiva viva `Funcionamiento`). Prohibido hardcodear colores o marcas: todo consume tokens semánticos de `src/app/globals.css` y metadatos dinámicos de `crm_settings/general`.

---

## 1. Esquema Canónico `CrmAiAgentConfig` y Contenedor Maestro `SettingsBot.tsx`

### 1.1 Contrato de Datos Determinístico y Detección `isDirty`
- `serializeComparableConfig()` excluye `updatedAt` y ordena claves para que el botón **Guardar Cambios** refleje con precisión matemática si existen cambios pendientes respecto al snapshot de Firestore (`crm_settings/ai_agent`).
- Al guardar: sanitiza con `removeUndefined()`, ejecuta `setDoc(..., { merge: true })` y dispara `POST /api/crm/ai/config` (`{ action: 'refresh_cache' }`).

```tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
  Bot,
  BookOpen,
  FileSpreadsheet,
  FlaskConical,
  Loader2,
  Save,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { removeUndefined } from '@/lib/utils/crm-sanitizers';

export type BotOperationMode =
  | 'sandbox_only'
  | 'whitelist_phones'
  | 'production'
  | 'off';

export interface BotClosedDateItem {
  date: string; // "YYYY-MM-DD"
  label: string;
}

export interface BotCampaignRule {
  id: string;
  campaignName: string;
  triggerKeywordOrSourceId: string;
  promoInstructions: string;
  preferredAssetId?: string;
  enabled: boolean;
}

export interface CrmAiAgentConfig {
  enabled: boolean;
  operationMode: BotOperationMode;
  whitelistPhones: string[];
  model: string;
  temperature: number;
  listenToAudio: boolean;
  smartInternalNotes: boolean;
  autoTaggingEnabled: boolean;
  debounceSeconds: number;
  followUpSlaMinutes: number;
  autoArchiveMinutes: number;
  maxAiTurnsPerSession: number;
  welcomeMessageBusinessHours: string;
  welcomeMessageAfterHours: string;
  // Subtab 2: Fuentes y Gobernanza
  useMarketingImages: boolean;
  useCatalogPdfs: boolean;
  useDatasheetPdfs: boolean;
  useQuickKnowledgeCatalog: boolean;
  disabledMarketingItemIds: string[];
  wholesaleOnlyIds: string[];
  // Subtab 3: Reglas, Feriados y Campañas Meta (máx. 5 en foco)
  masterPrompt: string;
  restrictedTopics: string[];
  escalationClosingMessage: string;
  storeLocationText: string;
  deliveryPolicyText: string;
  closedDates: BotClosedDateItem[];
  campaignRules: BotCampaignRule[];
  updatedAt?: number;
}

export const DEFAULT_CRM_AI_CONFIG: CrmAiAgentConfig = {
  enabled: false,
  operationMode: 'sandbox_only',
  whitelistPhones: [],
  model: 'gemini-2.5-flash',
  temperature: 0.3,
  listenToAudio: true,
  smartInternalNotes: true,
  autoTaggingEnabled: true,
  debounceSeconds: 12,
  followUpSlaMinutes: 45,
  autoArchiveMinutes: 240,
  maxAiTurnsPerSession: 8,
  welcomeMessageBusinessHours:
    '¡Hola {{nombre_cliente}}! Bienvenido a *{{nombre_empresa}}*. ¿En qué te podemos asesorar hoy?',
  welcomeMessageAfterHours:
    '¡Hola {{nombre_cliente}}! Nuestro horario de atención humana en *{{nombre_empresa}}* es {{horario_atencion}}, pero puedo ayudarte con precios, catálogo y dudas frecuentes ahora mismo.',
  useMarketingImages: true,
  useCatalogPdfs: true,
  useDatasheetPdfs: true,
  useQuickKnowledgeCatalog: true,
  disabledMarketingItemIds: [],
  wholesaleOnlyIds: [],
  masterPrompt:
    'Eres un asesor comercial experto, cálido y conciso por WhatsApp. Responde en párrafos breves (máximo 3 líneas por idea), nunca inventes precios fuera de la base de conocimiento y prioriza llevar al cliente al cierre o cotización clara.',
  restrictedTopics: [
    'Reclamos de garantía o producto dañado',
    'Solicitud explícita de hablar con un asesor humano',
    'Negociación de descuentos mayoristas especiales',
    'Envío de comprobante bancario de pago',
  ],
  escalationClosingMessage:
    'Perfecto {{nombre_cliente}}, voy a transferir tu conversación con uno de nuestros asesores especialistas de *{{nombre_empresa}}* para atenderte personalmente.',
  storeLocationText: 'Encuéntranos en {{ubicacion_tienda}}.',
  deliveryPolicyText: 'Realizamos envíos a todo el país con seguimiento.',
  closedDates: [],
  campaignRules: [],
};

export function serializeComparableConfig(cfg: CrmAiAgentConfig): string {
  const { updatedAt: _ignored, ...rest } = cfg;
  return JSON.stringify(rest);
}

export type BotSubtabId = 'general' | 'sources' | 'rules' | 'sandbox' | 'guide';

export function SettingsBotShell({
  initialConfig,
  onPersistConfig,
  getIdToken,
  renderSubtab,
}: {
  initialConfig: CrmAiAgentConfig;
  onPersistConfig: (cleanConfig: CrmAiAgentConfig) => Promise<void>;
  getIdToken: () => Promise<string>;
  renderSubtab: (
    subtab: BotSubtabId,
    config: CrmAiAgentConfig,
    setConfig: React.Dispatch<React.SetStateAction<CrmAiAgentConfig>>
  ) => React.ReactNode;
}) {
  const [config, setConfig] = useState<CrmAiAgentConfig>(initialConfig);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    serializeComparableConfig(initialConfig)
  );
  const [activeSubtab, setActiveSubtab] = useState<BotSubtabId>('general');
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(
    () => serializeComparableConfig(config) !== savedSnapshot,
    [config, savedSnapshot]
  );

  const modeBadge = useMemo(() => {
    if (!config.enabled || config.operationMode === 'off') {
      return { label: 'Apagado', cls: 'bg-muted text-muted-foreground' };
    }
    if (config.operationMode === 'production') {
      return { label: 'Producción Activa', cls: 'bg-success/15 text-success' };
    }
    if (config.operationMode === 'whitelist_phones') {
      return {
        label: `Lista Blanca (${config.whitelistPhones.length})`,
        cls: 'bg-warning/15 text-warning',
      };
    }
    return { label: 'Solo Simulador', cls: 'bg-primary/15 text-primary' };
  }, [config.enabled, config.operationMode, config.whitelistPhones.length]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const clean = removeUndefined({
        ...config,
        updatedAt: Date.now(),
      });
      await onPersistConfig(clean);
      setSavedSnapshot(serializeComparableConfig(clean));

      const token = await getIdToken();
      await fetch('/api/crm/ai/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'refresh_cache' }),
      }).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  };

  const subtabs: {
    id: BotSubtabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'sources', label: 'Multimedia y Fuentes', icon: BookOpen },
    { id: 'rules', label: 'Reglas y Campañas', icon: ShieldCheck },
    { id: 'sandbox', label: 'Simulador', icon: FlaskConical },
    { id: 'guide', label: 'Funcionamiento', icon: FileSpreadsheet },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      {/* Cabecera Persistente con Switch Maestro y Control isDirty */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-headline text-base font-semibold text-foreground">
                Agente IA y Automatizaciones
              </h2>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  modeBadge.cls
                )}
              >
                {modeBadge.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Atención multimodal, calificación comercial y transferencia inteligente a humanos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            Motor Activo
          </label>

          <button
            type="button"
            disabled={!isDirty || saving}
            onClick={() => void handleSave()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all disabled:opacity-45',
              isDirty
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border bg-muted text-muted-foreground'
            )}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {isDirty ? 'Guardar Cambios' : 'Guardado'}
          </button>
        </div>
      </div>

      {/* Barra de los 5 Subtabs */}
      <div className="scrollbar-discreet flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-border bg-card p-1.5">
        {subtabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeSubtab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubtab(tab.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-2xs'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido del Subtab Activo */}
      <div>{renderSubtab(activeSubtab, config, setConfig)}</div>
    </div>
  );
}
```

---

## 2. Componente Especializado `SmartVariableTextarea.tsx` (Píldoras Atómicas `@variable` sin XSS)

### 2.1 Implementación Completa `contentEditable` con Serialización Segura
- Emite texto limpio con llaves `{{nombre_cliente}}`, `{{nombre_empresa}}`, etc., pero muestra en el DOM píldoras atómicas `contenteditable="false"` estilizadas exclusivamente con tokens semánticos (`bg-primary/15 text-foreground border-primary/35`).
- Soporta disparo al escribir **`@`** o mediante el botón superior **`+ Insertar variable`**, navegación por teclado (`↑↓`, `Enter`, `Esc`) y borrado de píldora en 1 clic (`×` o `Backspace`).

```tsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SmartVariableDef {
  key: string;        // ej. "nombre_cliente" -> serializa como {{nombre_cliente}}
  label: string;      // ej. "Nombre del Cliente"
  category: 'Cliente' | 'Negocio' | 'Horario';
  sampleValue: string;
}

export const CRM_SMART_VARIABLES: readonly SmartVariableDef[] = [
  {
    key: 'nombre_cliente',
    label: 'Nombre del Cliente',
    category: 'Cliente',
    sampleValue: 'María Fernández',
  },
  {
    key: 'nombre_asesor',
    label: 'Nombre del Asesor',
    category: 'Negocio',
    sampleValue: 'Carlos',
  },
  {
    key: 'nombre_empresa',
    label: 'Nombre de la Empresa',
    category: 'Negocio',
    sampleValue: 'Tu Empresa',
  },
  {
    key: 'horario_atencion',
    label: 'Horario de Atención',
    category: 'Horario',
    sampleValue: 'Lunes a Viernes de 8:00 a.m. a 5:30 p.m.',
  },
  {
    key: 'ubicacion_tienda',
    label: 'Ubicación Física',
    category: 'Negocio',
    sampleValue: 'Sucursal Principal · Waze disponible',
  },
] as const;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPillHtml(varDef: SmartVariableDef): string {
  return `<span contenteditable="false" data-variable-key="${escapeHtml(
    varDef.key
  )}" class="inline-flex items-center gap-1 rounded-md border border-primary/35 bg-primary/15 px-1.5 py-0.5 mx-0.5 text-xs font-semibold text-foreground select-none align-baseline">@${escapeHtml(
    varDef.label
  )}<button type="button" data-remove-pill="true" class="ml-0.5 text-muted-foreground hover:text-destructive">×</button></span>`;
}

function valueToHtml(rawValue: string): string {
  const escaped = escapeHtml(rawValue).replace(/\n/g, '<br/>');
  return escaped.replace(/\{\{([a-z0-9_]+)\}\}/gi, (full, key) => {
    const found = CRM_SMART_VARIABLES.find((v) => v.key === key);
    return found ? buildPillHtml(found) : full;
  });
}

function serializeDomToValue(root: HTMLElement): string {
  let result = '';
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset.variableKey) {
        result += `{{${el.dataset.variableKey}}}`;
      } else if (el.tagName === 'BR') {
        result += '\n';
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        if (result.length > 0 && !result.endsWith('\n')) result += '\n';
        result += serializeDomToValue(el);
      } else {
        result += serializeDomToValue(el);
      }
    }
  });
  return result;
}

export function SmartVariableTextarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef<string>(value);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastEmittedRef.current || el.innerHTML === '') {
      el.innerHTML = valueToHtml(value);
      lastEmittedRef.current = value;
    }
  }, [value]);

  const filteredVars = CRM_SMART_VARIABLES.filter(
    (v) =>
      v.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
      v.key.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const emitCurrentDom = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const serialized = serializeDomToValue(el);
    lastEmittedRef.current = serialized;
    onChange(serialized);
  }, [onChange]);

  const insertVariable = (varDef: SmartVariableDef) => {
    const el = editorRef.current;
    if (!el) return;
    // Si escribió @filtro al final o antes del cursor, limpiamos el sufijo @filtro
    const currentRaw = serializeDomToValue(el);
    const cleaned = currentRaw.replace(/@([a-z0-9_]*)$/i, '');
    const nextValue = `${cleaned}{{${varDef.key}}} `;
    el.innerHTML = valueToHtml(nextValue);
    lastEmittedRef.current = nextValue;
    onChange(nextValue);
    setMenuOpen(false);
    setFilterQuery('');
  };

  return (
    <div className="relative space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground">{label}</label>
        <button
          type="button"
          onClick={() => {
            setFilterQuery('');
            setActiveIndex(0);
            setMenuOpen((o) => !o);
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/25"
        >
          <AtSign className="h-3 w-3" />
          Insertar variable
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        style={{ minHeight: `${rows * 1.65}rem` }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.dataset.removePill === 'true') {
            target.closest('[data-variable-key]')?.remove();
            emitCurrentDom();
          }
        }}
        onInput={() => {
          emitCurrentDom();
          const raw = lastEmittedRef.current;
          const atMatch = raw.match(/@([a-z0-9_]*)$/i);
          if (atMatch) {
            setFilterQuery(atMatch[1] || '');
            setActiveIndex(0);
            setMenuOpen(true);
          } else {
            setMenuOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (!menuOpen || filteredVars.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % filteredVars.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + filteredVars.length) % filteredVars.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insertVariable(filteredVars[activeIndex]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setMenuOpen(false);
          }
        }}
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
      />

      {menuOpen && filteredVars.length > 0 && (
        <div className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
          {filteredVars.map((v, idx) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs',
                idx === activeIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
            >
              <div>
                <p className="font-semibold">@{v.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  Ej: {v.sampleValue}
                </p>
              </div>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {v.category}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 3. Subtab 1 — `General` (`BotTabGeneral.tsx`: 4 Modos, Lista Blanca `5s` + Reset `🧹`, Capacidades y SLAs)

```tsx
'use client';

import React, { useState } from 'react';
import { Eraser, Plus, Trash2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotOperationMode, CrmAiAgentConfig } from './SettingsBotShell';
import { SmartVariableTextarea } from './SmartVariableTextarea';

const OPERATION_MODES: {
  id: BotOperationMode;
  title: string;
  desc: string;
}[] = [
  {
    id: 'sandbox_only',
    title: 'Solo Simulador',
    desc: 'Prueba en el subtab Simulador; 0 mensajes enviados a WhatsApp real.',
  },
  {
    id: 'whitelist_phones',
    title: 'Lista Blanca (Pruebas Reales)',
    desc: 'Responde en WhatsApp real únicamente a los teléfonos autorizados abajo.',
  },
  {
    id: 'production',
    title: 'Producción Activa',
    desc: 'Atiende automáticamente conversaciones comerciales entrantes reales.',
  },
  {
    id: 'off',
    title: 'Desactivado',
    desc: 'Pausa toda respuesta automática conservando intactas tus reglas.',
  },
];

export function BotTabGeneral({
  config,
  setConfig,
  onResetWhitelistPhoneSession,
}: {
  config: CrmAiAgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<CrmAiAgentConfig>>;
  onResetWhitelistPhoneSession: (phoneE164: string) => Promise<void>;
}) {
  const [newPhone, setNewPhone] = useState('');
  const [resettingPhone, setResettingPhone] = useState<string | null>(null);

  const addWhitelistPhone = () => {
    const clean = newPhone.replace(/\D/g, '');
    if (clean.length < 8 || config.whitelistPhones.includes(clean)) return;
    setConfig((prev) => ({
      ...prev,
      whitelistPhones: [...prev.whitelistPhones, clean],
    }));
    setNewPhone('');
  };

  return (
    <div className="space-y-6">
      {/* 1. Selector de los 4 Modos de Operación */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="font-headline text-sm font-semibold text-foreground">
          Modo de Despliegue Operativo
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {OPERATION_MODES.map((m) => {
            const active = config.operationMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setConfig({ ...config, operationMode: m.id })}
                className={cn(
                  'rounded-2xl border p-3.5 text-left transition-all',
                  active
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border bg-background hover:bg-accent/40'
                )}
              >
                <p className="text-xs font-bold text-foreground">{m.title}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  {m.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Panel Exclusivo de Lista Blanca: Teléfonos + Preset 5s + Botón 🧹 Reset Firestore */}
        {config.operationMode === 'whitelist_phones' && (
          <div className="mt-4 space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">
                Teléfonos Autorizados en Lista Blanca (formato internacional sin +)
              </p>
              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    debounceSeconds: 5,
                    followUpSlaMinutes: 1,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
              >
                <Zap className="h-3 w-3" />
                Preset Rápido Testing (5s)
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Ej. 50688887777"
                className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-[16px] sm:text-xs"
              />
              <button
                type="button"
                onClick={addWhitelistPhone}
                className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {config.whitelistPhones.map((phone) => (
                <div
                  key={phone}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-mono"
                >
                  <span>+{phone}</span>
                  <button
                    type="button"
                    title="Limpiar sesión IA en Firestore para repetir prueba de primer contacto"
                    disabled={resettingPhone === phone}
                    onClick={async () => {
                      setResettingPhone(phone);
                      try {
                        await onResetWhitelistPhoneSession(phone);
                      } finally {
                        setResettingPhone(null);
                      }
                    }}
                    className="rounded p-0.5 text-primary hover:bg-primary/15"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        whitelistPhones: config.whitelistPhones.filter(
                          (p) => p !== phone
                        ),
                      })
                    }
                    className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 2. Modelo, Temperatura, Capacidades Multimodales y Temporizadores SLA */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-headline text-sm font-semibold text-foreground">
            Motor IA y Capacidades Multimodales
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Modelo Activo
              </label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Creatividad (Temperatura: {config.temperature.toFixed(1)})
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={config.temperature}
                onChange={(e) =>
                  setConfig({ ...config, temperature: Number(e.target.value) })
                }
                className="mt-3 w-full accent-primary"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {(
              [
                {
                  key: 'listenToAudio',
                  label: 'Escuchar y comprender Notas de Voz / Audios entrantes',
                },
                {
                  key: 'smartInternalNotes',
                  label: 'Escribir Notas Internas de resumen para el asesor humano',
                },
                {
                  key: 'autoTaggingEnabled',
                  label: 'Auto-etiquetar conversaciones según intención (writeBatch)',
                },
              ] as const
            ).map((cap) => (
              <label
                key={cap.key}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-xs"
              >
                <span className="font-medium text-foreground">{cap.label}</span>
                <input
                  type="checkbox"
                  checked={config[cap.key]}
                  onChange={(e) =>
                    setConfig({ ...config, [cap.key]: e.target.checked })
                  }
                  className="h-4 w-4 accent-primary"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-headline text-sm font-semibold text-foreground">
            Temporizadores SLA y Agrupación Anti-Ráfaga
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Agrupar ráfaga (seg)
              </label>
              <input
                type="number"
                min={3}
                max={120}
                value={config.debounceSeconds}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    debounceSeconds: Math.max(3, Number(e.target.value) || 5),
                  })
                }
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Seguimiento SLA (min)
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                value={config.followUpSlaMinutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    followUpSlaMinutes: Math.max(1, Number(e.target.value) || 30),
                  })
                }
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Cierre inactividad (min)
              </label>
              <input
                type="number"
                min={15}
                max={4320}
                value={config.autoArchiveMinutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    autoArchiveMinutes: Math.max(15, Number(e.target.value) || 240),
                  })
                }
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Máx. turnos IA / sesión
              </label>
              <input
                type="number"
                min={2}
                max={30}
                value={config.maxAiTurnsPerSession}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maxAiTurnsPerSession: Math.max(2, Number(e.target.value) || 8),
                  })
                }
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Mensajes de Primer Contacto con Píldoras @variable */}
      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-5 lg:grid-cols-2">
        <SmartVariableTextarea
          label="Saludo en Horario Comercial"
          value={config.welcomeMessageBusinessHours}
          onChange={(val) =>
            setConfig({ ...config, welcomeMessageBusinessHours: val })
          }
        />
        <SmartVariableTextarea
          label="Mensaje Fuera de Horario / Día Feriado"
          value={config.welcomeMessageAfterHours}
          onChange={(val) => setConfig({ ...config, welcomeMessageAfterHours: val })}
        />
      </section>
    </div>
  );
}
```

---

## 4. Subtabs 2 y 3 — `Multimedia y Fuentes` (`BotTabSources.tsx`) y `Reglas y Campañas` (`BotTabRules.tsx`)

### 4.1 Gobernanza Individual (`Activo / Bloqueado` + `MAYORISTA`), Catálogo Rápido Autocontenido (`crm_settings/ai_knowledge`), Feriados y Tope `≤ 5` Campañas Meta Ads

```tsx
'use client';

import React, { useState } from 'react';
import { CalendarOff, Megaphone, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CrmAiAgentConfig } from './SettingsBotShell';
import type { MarketingAssetItem } from '../SettingsMarketingImages';
import { SmartVariableTextarea } from './SmartVariableTextarea';

export interface QuickCatalogItem {
  id: string;
  name: string;
  category: string;
  retailPrice: string;
  wholesalePrice?: string;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  notes?: string;
}

export function BotTabSources({
  config,
  setConfig,
  marketingItems,
  knowledgeItems,
  onSaveKnowledgeItems,
}: {
  config: CrmAiAgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<CrmAiAgentConfig>>;
  marketingItems: MarketingAssetItem[];
  knowledgeItems: QuickCatalogItem[];
  onSaveKnowledgeItems: (items: QuickCatalogItem[]) => Promise<void>;
}) {
  const [draftProduct, setDraftProduct] = useState({
    name: '',
    category: '',
    retailPrice: '',
  });

  const toggleBlockedAsset = (assetId: string) => {
    const blocked = config.disabledMarketingItemIds.includes(assetId);
    setConfig({
      ...config,
      disabledMarketingItemIds: blocked
        ? config.disabledMarketingItemIds.filter((id) => id !== assetId)
        : [...config.disabledMarketingItemIds, assetId],
    });
  };

  const toggleWholesaleOnly = (assetId: string) => {
    const isWholesale = config.wholesaleOnlyIds.includes(assetId);
    setConfig({
      ...config,
      wholesaleOnlyIds: isWholesale
        ? config.wholesaleOnlyIds.filter((id) => id !== assetId)
        : [...config.wholesaleOnlyIds, assetId],
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 Switches de Fuentes Habilitadas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            { key: 'useMarketingImages', title: 'Imágenes Marketing (.webp -> JPEG)' },
            { key: 'useCatalogPdfs', title: 'Catálogos Generales PDF' },
            { key: 'useDatasheetPdfs', title: 'Fichas Técnicas PDF' },
            { key: 'useQuickKnowledgeCatalog', title: 'Base de Precios Autocontenida' },
          ] as const
        ).map((src) => (
          <label
            key={src.key}
            className="flex cursor-pointer items-center justify-between rounded-2xl border border-border bg-card p-4 text-xs font-semibold text-foreground"
          >
            <span>{src.title}</span>
            <input
              type="checkbox"
              checked={config[src.key]}
              onChange={(e) => setConfig({ ...config, [src.key]: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
          </label>
        ))}
      </div>

      {/* Base de Conocimiento / Catálogo Rápido Autocontenido (crm_settings/ai_knowledge) */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="font-headline text-sm font-semibold text-foreground">
          Catálogo Rápido Autocontenido ({knowledgeItems.length} ítems)
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            type="text"
            value={draftProduct.name}
            onChange={(e) =>
              setDraftProduct({ ...draftProduct, name: e.target.value })
            }
            placeholder="Producto o Servicio"
            className="rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
          />
          <input
            type="text"
            value={draftProduct.category}
            onChange={(e) =>
              setDraftProduct({ ...draftProduct, category: e.target.value })
            }
            placeholder="Categoría"
            className="rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
          />
          <input
            type="text"
            value={draftProduct.retailPrice}
            onChange={(e) =>
              setDraftProduct({ ...draftProduct, retailPrice: e.target.value })
            }
            placeholder="Precio Retail"
            className="rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
          />
          <button
            type="button"
            onClick={async () => {
              if (!draftProduct.name.trim()) return;
              const next: QuickCatalogItem[] = [
                {
                  id: `prd_${Date.now().toString(36)}`,
                  name: draftProduct.name.trim(),
                  category: draftProduct.category.trim() || 'General',
                  retailPrice: draftProduct.retailPrice.trim(),
                  stockStatus: 'in_stock',
                },
                ...knowledgeItems,
              ];
              await onSaveKnowledgeItems(next);
              setDraftProduct({ name: '', category: '', retailPrice: '' });
            }}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar Ítem
          </button>
        </div>
      </section>

      {/* Gobernanza Individual por Archivo Multimedia */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="font-headline text-sm font-semibold text-foreground">
          Gobernanza Individual de Archivos para la IA
        </h3>
        <div className="divide-y divide-border rounded-xl border border-border bg-background">
          {marketingItems.map((asset) => {
            const isBlocked = config.disabledMarketingItemIds.includes(asset.id);
            const isWholesale = config.wholesaleOnlyIds.includes(asset.id);
            return (
              <div
                key={asset.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{asset.title}</p>
                  <p className="text-[11px] text-muted-foreground uppercase">
                    {asset.kind} · {asset.categories.join(', ') || 'Sin categoría'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleWholesaleOnly(asset.id)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
                      isWholesale
                        ? 'bg-warning/20 text-warning'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isWholesale ? 'MAYORISTA / B2B' : 'Público Retail'}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleBlockedAsset(asset.id)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
                      isBlocked
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-success/15 text-success'
                    )}
                  >
                    {isBlocked ? 'Bloqueado para IA' : 'Activo para IA'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Subtab 3: Reglas, Escalación, Feriados y Campañas Meta Ads (<= 5 activas en foco) */
export function BotTabRules({
  config,
  setConfig,
}: {
  config: CrmAiAgentConfig;
  setConfig: React.Dispatch<React.SetStateAction<CrmAiAgentConfig>>;
}) {
  const [newTopic, setNewTopic] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayLabel, setHolidayLabel] = useState('');

  const activeCampaignCount = config.campaignRules.filter((c) => c.enabled).length;

  return (
    <div className="space-y-6">
      {/* 1. Directriz Maestra */}
      <section className="space-y-2 rounded-2xl border border-border bg-card p-5">
        <label className="font-headline text-sm font-semibold text-foreground">
          Directriz Maestra de Identidad Comercial (System Prompt)
        </label>
        <textarea
          rows={4}
          value={config.masterPrompt}
          onChange={(e) => setConfig({ ...config, masterPrompt: e.target.value })}
          className="w-full rounded-xl border border-input bg-background p-3 text-[16px] sm:text-sm"
        />
      </section>

      {/* 2. Disparadores Numerados de Escalación Humana + Mensaje de Transferencia */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h3 className="font-headline text-sm font-semibold text-foreground">
            Disparadores de Escalación Humana Inmediata ({config.restrictedTopics.length})
          </h3>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTopic.trim()) {
                e.preventDefault();
                setConfig({
                  ...config,
                  restrictedTopics: [...config.restrictedTopics, newTopic.trim()],
                });
                setNewTopic('');
              }
            }}
            placeholder="Agregar caso crítico que transfiere de inmediato a un asesor..."
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
          />
          <button
            type="button"
            onClick={() => {
              if (!newTopic.trim()) return;
              setConfig({
                ...config,
                restrictedTopics: [...config.restrictedTopics, newTopic.trim()],
              });
              setNewTopic('');
            }}
            className="rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
          >
            Agregar
          </button>
        </div>

        <div className="space-y-1.5">
          {config.restrictedTopics.map((topic, idx) => (
            <div
              key={`${topic}-${idx}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs"
            >
              <span>
                <strong className="mr-2 text-primary">#{idx + 1}</strong>
                {topic}
              </span>
              <button
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    restrictedTopics: config.restrictedTopics.filter(
                      (_, i) => i !== idx
                    ),
                  })
                }
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <SmartVariableTextarea
          label="Mensaje de Despedida al Transferir a Humano"
          value={config.escalationClosingMessage}
          onChange={(val) => setConfig({ ...config, escalationClosingMessage: val })}
        />
      </section>

      {/* 3. Ubicación Física y Política de Envíos */}
      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-5 lg:grid-cols-2">
        <SmartVariableTextarea
          label="Ubicación Física / Waze / Google Maps"
          value={config.storeLocationText}
          onChange={(val) => setConfig({ ...config, storeLocationText: val })}
        />
        <SmartVariableTextarea
          label="Política de Envíos y Cobertura"
          value={config.deliveryPolicyText}
          onChange={(val) => setConfig({ ...config, deliveryPolicyText: val })}
        />
      </section>

      {/* 4. Calendario de Feriados (closedDates) + 5. Campañas Meta Ads (Máx. 5 Activas) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-primary" />
            <h3 className="font-headline text-sm font-semibold text-foreground">
              Días Cerrados y Feriados ({config.closedDates.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              className="rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs"
            />
            <input
              type="text"
              value={holidayLabel}
              onChange={(e) => setHolidayLabel(e.target.value)}
              placeholder="Motivo (ej. Feriado Nacional)"
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-2.5 py-1.5 text-[16px] sm:text-xs"
            />
            <button
              type="button"
              onClick={() => {
                if (!holidayDate) return;
                setConfig({
                  ...config,
                  closedDates: [
                    ...config.closedDates,
                    { date: holidayDate, label: holidayLabel.trim() || 'Cerrado' },
                  ],
                });
                setHolidayDate('');
                setHolidayLabel('');
              }}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              Añadir
            </button>
          </div>
          <div className="space-y-1.5">
            {config.closedDates.map((d) => (
              <div
                key={d.date}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
              >
                <span>
                  <strong className="font-mono">{d.date}</strong> · {d.label}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      closedDates: config.closedDates.filter((x) => x.date !== d.date),
                    })
                  }
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <h3 className="font-headline text-sm font-semibold text-foreground">
                Campañas Meta Ads en Foco ({activeCampaignCount}/5)
              </h3>
            </div>
            <button
              type="button"
              disabled={config.campaignRules.length >= 5}
              onClick={() =>
                setConfig({
                  ...config,
                  campaignRules: [
                    ...config.campaignRules,
                    {
                      id: `cmp_${Date.now().toString(36)}`,
                      campaignName: 'Nueva Campaña CTWA',
                      triggerKeywordOrSourceId: '',
                      promoInstructions: '',
                      enabled: activeCampaignCount < 5,
                    },
                  ],
                })
              }
              className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
            >
              + Regla Campaña
            </button>
          </div>

          <div className="space-y-2.5">
            {config.campaignRules.map((rule, idx) => (
              <div
                key={rule.id}
                className="space-y-2 rounded-xl border border-border bg-background p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => {
                      if (e.target.checked && activeCampaignCount >= 5) return;
                      const next = [...config.campaignRules];
                      next[idx] = { ...rule, enabled: e.target.checked };
                      setConfig({ ...config, campaignRules: next });
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <input
                    type="text"
                    value={rule.campaignName}
                    onChange={(e) => {
                      const next = [...config.campaignRules];
                      next[idx] = { ...rule, campaignName: e.target.value };
                      setConfig({ ...config, campaignRules: next });
                    }}
                    placeholder="Nombre del anuncio"
                    className="min-w-0 flex-1 rounded-lg border border-input bg-card px-2.5 py-1 text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setConfig({
                        ...config,
                        campaignRules: config.campaignRules.filter(
                          (r) => r.id !== rule.id
                        ),
                      })
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={rule.triggerKeywordOrSourceId}
                  onChange={(e) => {
                    const next = [...config.campaignRules];
                    next[idx] = {
                      ...rule,
                      triggerKeywordOrSourceId: e.target.value,
                    };
                    setConfig({ ...config, campaignRules: next });
                  }}
                  placeholder="Ad Source ID o frase clave del anuncio"
                  className="w-full rounded-lg border border-input bg-card px-2.5 py-1 text-[16px] sm:text-xs"
                />
                <textarea
                  rows={2}
                  value={rule.promoInstructions}
                  onChange={(e) => {
                    const next = [...config.campaignRules];
                    next[idx] = { ...rule, promoInstructions: e.target.value };
                    setConfig({ ...config, campaignRules: next });
                  }}
                  placeholder="Instrucción específica de oferta para leads de este anuncio..."
                  className="w-full rounded-lg border border-input bg-card p-2 text-[16px] sm:text-xs"
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
```

---

## 5. Subtab 4 — `Simulador` (`BotTabSandbox.tsx` — 5 Escenarios, Grabación de Micrófono Real e Inspector JSON)

```tsx
'use client';

import React, { useRef, useState } from 'react';
import { Mic, RotateCcw, Send, Square, Terminal } from 'lucide-react';
import { WhatsAppText } from '@/components/crm/shared/WhatsAppText';
import type { CrmAiAgentConfig } from './SettingsBotShell';

export interface SandboxSimulationContext {
  clientStage: 'first_contact' | 'ongoing';
  scheduleState: 'business_hours' | 'after_hours' | 'holiday';
  assignmentState: 'unassigned' | 'assigned';
  contactKind: 'commercial' | 'operational';
  campaignRuleId: string; // 'organic' | campaign.id
}

export interface SandboxTurnInspectorTelemetry {
  decision: 'RESPONDED' | 'ESCALATED_TO_HUMAN' | 'SKIPPED_OPERATIONAL';
  matchedRule: string | null;
  autoTags: string[];
  selectedMedia: { id: string; title: string; kind: string }[];
  internalNoteDraft: string | null;
  latencyMs: number;
  tokensUsed: number;
}

interface SandboxBubble {
  id: string;
  role: 'client' | 'bot' | 'internal_note';
  text: string;
  isAudio?: boolean;
}

const QUICK_TEST_CHIPS = [
  'Hola, quiero información',
  '¿Cuál es el precio y catálogo?',
  '¿Dónde están ubicados?',
  '¿Hacen envíos a domicilio?',
  'Tengo un reclamo urgente',
  'Vi la promoción del anuncio',
] as const;

export function BotTabSandbox({
  config,
  onRunSimulationTurn,
}: {
  config: CrmAiAgentConfig;
  onRunSimulationTurn: (payload: {
    text?: string;
    audioBase64?: string;
    audioMimeType?: string;
    context: SandboxSimulationContext;
    draftConfig: CrmAiAgentConfig;
  }) => Promise<{
    replyText: string;
    telemetry: SandboxTurnInspectorTelemetry;
  }>;
}) {
  const [simCtx, setSimCtx] = useState<SandboxSimulationContext>({
    clientStage: 'first_contact',
    scheduleState: 'business_hours',
    assignmentState: 'unassigned',
    contactKind: 'commercial',
    campaignRuleId: 'organic',
  });
  const [bubbles, setBubbles] = useState<SandboxBubble[]>([]);
  const [inputText, setInputText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [lastTelemetry, setLastTelemetry] =
    useState<SandboxTurnInspectorTelemetry | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const executeTurn = async (opts: {
    text?: string;
    audioBase64?: string;
    audioMimeType?: string;
  }) => {
    setBusy(true);
    setBubbles((prev) => [
      ...prev,
      {
        id: `u_${Date.now()}`,
        role: 'client',
        text: opts.audioBase64 ? '🎤 Nota de voz grabada en navegador' : opts.text || '',
        isAudio: Boolean(opts.audioBase64),
      },
    ]);

    try {
      const res = await onRunSimulationTurn({
        ...opts,
        context: simCtx,
        draftConfig: config,
      });
      setLastTelemetry(res.telemetry);

      setBubbles((prev) => {
        const next = [...prev];
        if (res.replyText) {
          next.push({
            id: `b_${Date.now()}`,
            role: 'bot',
            text: res.replyText,
          });
        }
        if (res.telemetry.internalNoteDraft) {
          next.push({
            id: `n_${Date.now() + 1}`,
            role: 'internal_note',
            text: res.telemetry.internalNoteDraft,
          });
        }
        return next;
      });
      setSimCtx((prev) => ({ ...prev, clientStage: 'ongoing' }));
    } finally {
      setBusy(false);
    }
  };

  const toggleMicRecording = async () => {
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];

    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = String(reader.result || '').split(',')[1] || '';
        if (base64) {
          void executeTurn({
            audioBase64: base64,
            audioMimeType: blob.type || 'audio/webm',
          });
        }
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  return (
    <div className="space-y-4">
      {/* 5 Selectores de Escenario Simulado */}
      <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-border bg-card p-3.5 sm:grid-cols-5">
        <select
          value={simCtx.clientStage}
          onChange={(e) =>
            setSimCtx({
              ...simCtx,
              clientStage: e.target.value as SandboxSimulationContext['clientStage'],
            })
          }
          className="rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="first_contact">Primer Contacto</option>
          <option value="ongoing">Conversación en Curso</option>
        </select>

        <select
          value={simCtx.scheduleState}
          onChange={(e) =>
            setSimCtx({
              ...simCtx,
              scheduleState: e.target.value as SandboxSimulationContext['scheduleState'],
            })
          }
          className="rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="business_hours">Horario Hábil</option>
          <option value="after_hours">Fuera de Horario</option>
          <option value="holiday">Día Feriado</option>
        </select>

        <select
          value={simCtx.assignmentState}
          onChange={(e) =>
            setSimCtx({
              ...simCtx,
              assignmentState:
                e.target.value as SandboxSimulationContext['assignmentState'],
            })
          }
          className="rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="unassigned">Sin Asignar (Inbox)</option>
          <option value="assigned">Con Asesor Asignado</option>
        </select>

        <select
          value={simCtx.contactKind}
          onChange={(e) =>
            setSimCtx({
              ...simCtx,
              contactKind: e.target.value as SandboxSimulationContext['contactKind'],
            })
          }
          className="rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs"
        >
          <option value="commercial">Cliente Comercial</option>
          <option value="operational">Operativo / Proveedor</option>
        </select>

        <select
          value={simCtx.campaignRuleId}
          onChange={(e) => setSimCtx({ ...simCtx, campaignRuleId: e.target.value })}
          className="col-span-2 rounded-xl border border-input bg-background px-2.5 py-1.5 text-xs sm:col-span-1"
        >
          <option value="organic">Tráfico Orgánico</option>
          {config.campaignRules.map((c) => (
            <option key={c.id} value={c.id}>
              Anuncio: {c.campaignName}
            </option>
          ))}
        </select>
      </div>

      {/* 6 Chips de Prueba Rápida */}
      <div className="scrollbar-discreet flex items-center gap-1.5 overflow-x-auto pb-1">
        {QUICK_TEST_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={busy}
            onClick={() => void executeTurn({ text: chip })}
            className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Vista Split: Chat Simulado + Micrófono <-> BotSandboxInspector */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex h-[460px] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold text-foreground">
              Lienzo de Simulación Multimodal
            </span>
            <button
              type="button"
              onClick={() => {
                setBubbles([]);
                setLastTelemetry(null);
                setSimCtx((prev) => ({ ...prev, clientStage: 'first_contact' }));
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar
            </button>
          </div>

          <div className="scrollbar-discreet flex-1 space-y-2.5 overflow-y-auto bg-chat-canvas p-4">
            {bubbles.map((b) => {
              if (b.role === 'internal_note') {
                return (
                  <div
                    key={b.id}
                    className="mx-auto max-w-[90%] rounded-xl border border-warning/40 bg-chat-note p-2.5 text-xs text-chat-note-foreground"
                  >
                    <strong>Nota Interna IA:</strong> {b.text}
                  </div>
                );
              }
              const isClient = b.role === 'client';
              return (
                <div
                  key={b.id}
                  className={
                    isClient ? 'flex justify-start' : 'flex justify-end'
                  }
                >
                  <div
                    className={
                      isClient
                        ? 'max-w-[82%] rounded-2xl rounded-tl-xs bg-chat-incoming px-3 py-2 text-xs text-chat-incoming-foreground shadow-2xs'
                        : 'max-w-[82%] rounded-2xl rounded-tr-xs bg-chat-outgoing px-3 py-2 text-xs text-chat-outgoing-foreground shadow-2xs'
                    }
                  >
                    <WhatsAppText text={b.text} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 border-t border-border bg-card p-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleMicRecording()}
              className={
                recording
                  ? 'rounded-xl bg-destructive p-2 text-destructive-foreground'
                  : 'rounded-xl bg-accent p-2 text-foreground'
              }
              title="Grabar nota de voz real para probar comprensión de audio"
            >
              {recording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputText.trim() && !busy) {
                  const msg = inputText.trim();
                  setInputText('');
                  void executeTurn({ text: msg });
                }
              }}
              placeholder="Escribe como cliente o graba un audio..."
              className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
            />

            <button
              type="button"
              disabled={busy || !inputText.trim()}
              onClick={() => {
                const msg = inputText.trim();
                setInputText('');
                void executeTurn({ text: msg });
              }}
              className="rounded-xl bg-primary p-2 text-primary-foreground disabled:opacity-45"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* BotSandboxInspector */}
        <div className="flex h-[460px] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Inspector Técnico de Decisión
            </span>
          </div>

          <div className="scrollbar-discreet flex-1 overflow-y-auto p-4 text-xs">
            {!lastTelemetry ? (
              <p className="text-muted-foreground">
                Envía un mensaje o nota de voz para inspeccionar decisión, etiquetas, adjuntos y consumo de tokens.
              </p>
            ) : (
              <pre className="whitespace-pre-wrap rounded-xl bg-muted/50 p-3 font-mono text-[11px] text-foreground">
                {JSON.stringify(lastTelemetry, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Subtab 5 — `Funcionamiento` (`BotTabGuide.tsx` — La Hoja Ejecutiva Viva Reactiva)

> **Prohibición Estricta**: Este subtab **NO** es un documento estático. Lee el objeto `config` y las fuentes en tiempo real, interpola las variables `@variable` con datos reales del negocio y renderiza la comparativa visual de **Transferencia a Humano en Doble Vía** (incluyendo el mockup del botón **`Tomar Conversación`** de `ChatHeader`).

```tsx
'use client';

import React, { useMemo } from 'react';
import {
  CheckCircle2,
  Hand,
  Image as ImageIcon,
  Mic,
  ShieldAlert,
  StickyNote,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhatsAppText } from '@/components/crm/shared/WhatsAppText';
import type { CrmAiAgentConfig } from './SettingsBotShell';

export function interpolateExecutivePreview(
  template: string,
  businessName: string,
  scheduleSummary: string
): string {
  const map: Record<string, string> = {
    nombre_cliente: 'María',
    nombre_asesor: 'Carlos',
    nombre_empresa: businessName || 'Nuestra Empresa',
    horario_atencion: scheduleSummary || 'Lunes a Viernes 8:00 a.m. - 5:30 p.m.',
    ubicacion_tienda: 'Sucursal Principal',
  };
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (full, key) => map[key] ?? full);
}

export function BotTabGuide({
  config,
  businessName,
  scheduleSummary,
  knowledgeCount,
  marketingCount,
}: {
  config: CrmAiAgentConfig;
  businessName: string;
  scheduleSummary: string;
  knowledgeCount: number;
  marketingCount: number;
}) {
  const activeSourcesCount = [
    config.useMarketingImages,
    config.useCatalogPdfs,
    config.useDatasheetPdfs,
    config.useQuickKnowledgeCatalog,
  ].filter(Boolean).length;

  const activeCampaignsCount = config.campaignRules.filter((c) => c.enabled).length;

  const previewBusinessWelcome = useMemo(
    () =>
      interpolateExecutivePreview(
        config.welcomeMessageBusinessHours,
        businessName,
        scheduleSummary
      ),
    [config.welcomeMessageBusinessHours, businessName, scheduleSummary]
  );

  const previewAfterHoursWelcome = useMemo(
    () =>
      interpolateExecutivePreview(
        config.welcomeMessageAfterHours,
        businessName,
        scheduleSummary
      ),
    [config.welcomeMessageAfterHours, businessName, scheduleSummary]
  );

  const previewEscalation = useMemo(
    () =>
      interpolateExecutivePreview(
        config.escalationClosingMessage,
        businessName,
        scheduleSummary
      ),
    [config.escalationClosingMessage, businessName, scheduleSummary]
  );

  const capabilities = [
    {
      icon: Mic,
      title: 'Comprensión de Audio',
      active: config.listenToAudio,
      detail: 'Transcribe y responde notas de voz entrantes.',
    },
    {
      icon: ImageIcon,
      title: 'Envío Multimedia Inteligente',
      active: config.useMarketingImages || config.useCatalogPdfs,
      detail: `${marketingCount} activos sincronizados (${config.wholesaleOnlyIds.length} protegidos B2B).`,
    },
    {
      icon: StickyNote,
      title: 'Notas Internas de Contexto',
      active: config.smartInternalNotes,
      detail: 'Resume la intención del cliente antes de entregar al asesor.',
    },
    {
      icon: Tag,
      title: 'Auto-Etiquetado CRM',
      active: config.autoTaggingEnabled,
      detail: 'Sincroniza etiquetas en conversación y contacto vía writeBatch.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Banda Superior de Celdas KPI en Tiempo Real */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-[11px] text-muted-foreground">Modo Actual</p>
          <p className="mt-1 text-sm font-bold text-foreground">
            {config.enabled ? config.operationMode : 'off'}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-[11px] text-muted-foreground">Modelo · Temp</p>
          <p className="mt-1 truncate text-sm font-bold text-foreground">
            {config.model} · {config.temperature.toFixed(1)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-[11px] text-muted-foreground">Fuentes Activas</p>
          <p className="mt-1 text-sm font-bold text-primary">
            {activeSourcesCount} / 4 ({knowledgeCount} ítems)
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-[11px] text-muted-foreground">Reglas Escalación</p>
          <p className="mt-1 text-sm font-bold text-foreground">
            {config.restrictedTopics.length} activas
          </p>
        </div>
        <div className="col-span-2 rounded-2xl border border-border bg-card p-3.5 sm:col-span-1">
          <p className="text-[11px] text-muted-foreground">Campañas en Foco</p>
          <p className="mt-1 text-sm font-bold text-foreground">
            {activeCampaignsCount} / 5
          </p>
        </div>
      </div>

      {/* 2. Las 4 Tarjetas de Capacidades Reactivas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {capabilities.map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.title}
              className="space-y-2 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-4 w-4 text-primary" />
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    cap.active
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {cap.active ? 'ACTIVO' : 'DESACTIVADO'}
                </span>
              </div>
              <p className="text-xs font-bold text-foreground">{cap.title}</p>
              <p className="text-[11px] text-muted-foreground">{cap.detail}</p>
            </div>
          );
        })}
      </div>

      {/* 3. Etapa 1: Previsualización Viva de Saludos Interpolados */}
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-sm font-semibold text-foreground">
            Etapa 1 · Recepción y Primer Contacto (Delay agrupador: {config.debounceSeconds}s)
          </h3>
          <span className="text-xs text-muted-foreground">
            Seguimiento SLA: {config.followUpSlaMinutes} min · Cierre: {config.autoArchiveMinutes} min
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-chat-canvas p-3.5">
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
              En Horario Comercial:
            </p>
            <div className="rounded-2xl rounded-tr-xs bg-chat-outgoing p-3 text-xs text-chat-outgoing-foreground shadow-2xs">
              <WhatsAppText text={previewBusinessWelcome} />
            </div>
          </div>

          <div className="rounded-xl bg-chat-canvas p-3.5">
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
              Fuera de Horario o en los {config.closedDates.length} Feriados configurados:
            </p>
            <div className="rounded-2xl rounded-tr-xs bg-chat-outgoing p-3 text-xs text-chat-outgoing-foreground shadow-2xs">
              <WhatsAppText text={previewAfterHoursWelcome} />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Etapa 3: Comparativa Visual de Doble Vía de Escalación a Humano */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Vía A: Escalación Automática por Regla */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <h4 className="font-headline text-sm font-semibold text-foreground">
              Vía A · Transferencia Automática por Regla
            </h4>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {config.restrictedTopics.slice(0, 4).map((t, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{t}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-xl bg-chat-canvas p-3">
            <div className="rounded-2xl rounded-tr-xs bg-chat-outgoing p-2.5 text-xs text-chat-outgoing-foreground">
              <WhatsAppText text={previewEscalation} />
            </div>
          </div>
        </div>

        {/* Vía B: Toma Manual del Asesor o Eco Coexistencia */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Hand className="h-4 w-4 text-primary" />
            <h4 className="font-headline text-sm font-semibold text-foreground">
              Vía B · Intervención Humana Inmediata (Cero Colisión)
            </h4>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            En cuanto un asesor pulsa el botón superior del chat o responde manualmente desde el CRM o desde la App móvil WhatsApp Business (Modo Coexistencia), el Agente IA se silencia automáticamente en ese hilo.
          </p>

          {/* Mockup Visual del Botón Tomar Conversación */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
            <div>
              <p className="text-xs font-semibold text-foreground">
                Cabecera de Conversación Activa
              </p>
              <p className="text-[11px] text-muted-foreground">
                Silencia el piloto automático en 1 clic
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs">
              <Hand className="h-3.5 w-3.5" />
              Tomar Conversación
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
```


---

## 8. Servicio de Telemetría IA (`crm-ai-telemetry-service.ts`) y Post-Acciones Atómicas

Cada turno ejecutado por el Agente IA persiste un evento inmutable (`append-only`) en la colección `crm_ai_telemetry` (protegida con `allow read, write: if false;` en `firestore.rules`) y actualiza contadores denormalizados en `crm_conversations` para alimentar el Dashboard Ejecutivo de Telemetría IA en `O(1)`:

```typescript
// src/lib/services/crm-ai-telemetry-service.ts
import { FieldValue } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { removeUndefined } from '@/lib/utils';
import type { CrmConversation, CrmMessageReferral, CrmTag } from '@/lib/types/crm';
import type {
  CrmAiAgentConfig,
  CrmAiAgentDecision,
  CrmAiIntentCategory,
  CrmAiMediaCounts,
  CrmAiSelectedMedia,
  CrmAiSlaType,
  CrmAiTelemetryOutcome,
} from '@/lib/types/crm-ai';

export function computeAiMediaCounts(sentMedia: CrmAiSelectedMedia[]): CrmAiMediaCounts {
  const counts: CrmAiMediaCounts = {
    webCatalogImages: 0,
    marketingImages: 0,
    catalogsPdf: 0,
    specSheetsPdf: 0,
    total: 0,
  };
  for (const item of sentMedia) {
    if (item.sourceType === 'web_catalog_image') counts.webCatalogImages += 1;
    else if (item.sourceType === 'crm_marketing_image') counts.marketingImages += 1;
    else if (item.sourceType === 'crm_catalog_pdf') counts.catalogsPdf += 1;
    else if (item.sourceType === 'crm_spec_sheet_pdf') counts.specSheetsPdf += 1;
    counts.total += 1;
  }
  return counts;
}

export async function executeAiPostDecisionSideEffects(params: {
  db: FirebaseFirestore.Firestore;
  convRef: FirebaseFirestore.DocumentReference;
  conv: CrmConversation;
  aiConfig: CrmAiAgentConfig;
  decision: CrmAiAgentDecision;
  availableTags: CrmTag[];
  aiAgentDisplayName?: string;
}): Promise<{ appliedTagNames: string[]; smartNoteCreated: boolean }> {
  const {
    db,
    convRef,
    conv,
    aiConfig,
    decision,
    availableTags,
    aiAgentDisplayName = 'Agente IA',
  } = params;

  const appliedTagNames: string[] = [];
  let smartNoteCreated = false;

  // 1. Auto-etiquetado sincronizado entre conversación y contacto
  if (
    aiConfig.autoTaggingEnabled &&
    Array.isArray(decision.suggestedTagNames) &&
    decision.suggestedTagNames.length > 0
  ) {
    const matchedTagIds: string[] = [];
    for (const suggestedName of decision.suggestedTagNames) {
      const clean = suggestedName.trim().toLowerCase();
      const found = availableTags.find((t) => t.name.trim().toLowerCase() === clean);
      if (found) {
        matchedTagIds.push(found.id);
        appliedTagNames.push(found.name);
      }
    }
    if (matchedTagIds.length > 0) {
      const batch = db.batch();
      batch.update(convRef, { tagIds: FieldValue.arrayUnion(...matchedTagIds) });
      if (conv.contactId) {
        batch.update(db.collection('crm_contacts').doc(conv.contactId), {
          tagIds: FieldValue.arrayUnion(...matchedTagIds),
        });
      }
      await batch.commit().catch(() => {});
    }
  }

  // 2. Creación de Nota Interna Inteligente en el expediente del contacto
  if (
    aiConfig.smartInternalNotes &&
    decision.shouldCreateSmartNote &&
    decision.smartNoteText?.trim() &&
    conv.contactId
  ) {
    const noteBody = decision.audioTranscriptSummary
      ? `🤖 [Nota Inteligente IA]: ${decision.smartNoteText.trim()}\n🎤 Resumen de audio: ${decision.audioTranscriptSummary.trim()}`
      : `🤖 [Nota Inteligente IA]: ${decision.smartNoteText.trim()}`;

    await db
      .collection('crm_contacts')
      .doc(conv.contactId)
      .collection('notes')
      .add(
        removeUndefined({
          text: noteBody,
          authorId: 'ai_agent',
          authorName: aiAgentDisplayName,
          createdBy: 'ai_agent',
          createdByName: aiAgentDisplayName,
          createdAt: FieldValue.serverTimestamp(),
        })
      )
      .then(() => {
        smartNoteCreated = true;
      })
      .catch(() => {});
  }

  return { appliedTagNames, smartNoteCreated };
}

export async function recordCrmAiTelemetryEvent(params: {
  conv: Partial<CrmConversation> & { id: string };
  executionMode: 'production' | 'test';
  outcome: CrmAiTelemetryOutcome;
  sessionPhase: 'new_client' | 'follow_up';
  scheduleMode: 'business_hours' | 'after_hours';
  slaType: CrmAiSlaType;
  intentCategory?: CrmAiIntentCategory;
  escalationReason?: string | null;
  textBubblesSent?: number;
  mediaCounts?: CrmAiMediaCounts;
  audiosTranscribed?: number;
  autoTagsApplied?: string[];
  smartNoteCreated?: boolean;
  referral?: CrmMessageReferral | null;
  modelUsed?: string | null;
  latencyMs?: number | null;
}): Promise<void> {
  try {
    const db = initializeFirebaseAdmin().firestore;
    const { conv } = params;
    const mediaCounts = params.mediaCounts || {
      webCatalogImages: 0,
      marketingImages: 0,
      catalogsPdf: 0,
      specSheetsPdf: 0,
      total: 0,
    };

    await db.collection('crm_ai_telemetry').add(
      removeUndefined({
        conversationId: conv.id,
        contactId: conv.contactId || null,
        contactName: conv.contactName || conv.contactPhone || 'Cliente WhatsApp',
        assignedTo: conv.assignedTo || null,
        assignedToName: conv.assignedToName || null,
        executionMode: params.executionMode,
        outcome: params.outcome,
        sessionPhase: params.sessionPhase,
        scheduleMode: params.scheduleMode,
        slaType: params.slaType,
        intentCategory: params.intentCategory || 'other',
        escalationReason: params.escalationReason || null,
        textBubblesSent: params.textBubblesSent ?? 0,
        mediaCounts,
        audiosTranscribed: params.audiosTranscribed ?? 0,
        autoTagsApplied: params.autoTagsApplied || [],
        smartNoteCreated: Boolean(params.smartNoteCreated),
        referralAdId: params.referral?.sourceId || null,
        referralHeadline: params.referral?.headline || null,
        modelUsed: params.modelUsed || null,
        latencyMs: typeof params.latencyMs === 'number' ? Math.round(params.latencyMs) : null,
        createdAt: FieldValue.serverTimestamp(),
      })
    );
  } catch (err) {
    console.warn('[CrmAiTelemetry] Non-blocking telemetry log error:', err);
  }
}
```

---

## 9. Máquina de Estados de Sesión IA, Candado Transaccional y Detector de Cortesía (`crm-ai-session-state.ts` + `crm-ai-conversation-runner.ts`)

### 9.1 Detector de Mensajes de Cortesía/Despedida (`isClosingCourtesyMessage`) y Guardián de Ventana 24h
Evita consumir tokens de IA o re-abrir un chat cuando el cliente únicamente responde `"Muchas gracias"`, `"Ok gracias"`, `"Pura vida 👍"` tras una respuesta previa del asesor o del bot:

```typescript
// src/lib/services/crm-ai-conversation-runner.ts (Helpers de eficiencia y seguridad)
const WHATSAPP_24H_WINDOW_SAFETY_MS = (23 * 60 + 50) * 60 * 1000; // 23h 50m (margen de 10 min)

export function isWithin24HourWhatsappWindow(lastInboundTimestamp: unknown): boolean {
  const ms = toEpochMs(lastInboundTimestamp);
  if (!ms) return true;
  const ageMs = Date.now() - ms;
  return ageMs >= -60000 && ageMs <= WHATSAPP_24H_WINDOW_SAFETY_MS;
}

export function isClosingCourtesyMessage(rawText?: string | null): boolean {
  if (!rawText) return false;
  const text = rawText.trim();
  if (!text || text.length > 75) return false;
  if (/[?¿]/.test(text)) return false;

  // Si contiene palabras de consulta comercial, NO es cierre de cortesía
  if (
    /\b(precio|costo|cuanto|cuánto|vale|catalogo|catálogo|ficha|foto|imagen|ubicacion|ubicación|donde|dónde|horario|envio|envío|entrega|medida|cotiz|descuento|promo|disponible|stock|instal)/i.test(
      text
    )
  ) {
    return false;
  }

  if (/^[👍🙏👌🙌✅🤝❤️😊👏🎉\s]+$/u.test(text)) {
    return true;
  }

  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,!¡*~_"'()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return /^(ok|okay|listo|perfecto|buenisimo|excelente|entendido|claro|dale|esta bien|super|genial|de acuerdo|ahi les aviso|cualquier cosa les aviso)?\s*(muchas gracias|muchisimas gracias|mil gracias|gracias|gracias de nuevo|gracias de regreso|muy amable|muy amables|bendiciones|pura vida|feliz dia|feliz tarde|feliz noche|buenas noches|hasta luego|chao)(\s+(de nuevo|de regreso|por todo|por la info|por la informacion|muy amable|amigo|companero|bendiciones|pura vida|👍|🙏|👌|😊))*$/i.test(
    normalized
  );
}
```

### 9.2 Persistencia de Resultados y Separación Estricta `firstResponseAt` vs `firstAiResponseAt` (`src/lib/services/crm-ai-session-state.ts`)
- **Regla de Oro para Analíticas**: El Agente IA **NUNCA** escribe en `firstResponseAt` (reservado exclusivamente para la primera intervención de un asesor humano en Web o Móvil). La IA registra `firstAiResponseAt`, `firstEscalatedAt`, `aiEscalatedAt`, `aiTotalTurns`, `aiTotalMediaSent`, `aiAudiosProcessed`, `aiSmartNotesCreated`, `aiAutoTagsApplied`, `aiLastIntent` y `aiLastExecutionMode`.
- **Bloqueo de Toma Humana (`isHumanTakeoverBlockingCurrentTurn`)**: Devuelve `true` si `lastMessageSender` es `'agent'` o `'mobile'`, o si `humanTookOver === true` con `humanTookOverAt > lastCustomerMessageAt + 1000`. Si el cliente vuelve a escribir *después* de la intervención humana, el chat entra al SLA de Seguimiento configurado (`followUpSlaMinutes`).


---

## 10. Pipeline Completo de Descarga Automática de Audios OGG, Lectura Multimodal por la IA (`@google/genai`) y Regla de Pin de Ubicación (`[location]`)

### 10.1 Servicio de Descarga Automática y Persistencia en Firebase Storage (`src/lib/services/crm-media-downloader.ts`)
Cuando llega una nota de voz (`type === 'audio'`) o un sticker (`type === 'sticker'`) por el webhook (tanto de un cliente como desde el celular físico de la empresa vía `smb_message_echoes`), el servidor descarga inmediatamente el binario desde el CDN de Meta (previa validación Anti-SSRF `isTrustedWhatsappMediaUrl`), lo almacena en Firebase Storage con `firebaseStorageDownloadTokens` y actualiza `media.url` en el documento del mensaje.

```typescript
// src/lib/services/crm-media-downloader.ts
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { isTrustedWhatsappMediaUrl } from '@/lib/utils/crm-media-security';

/**
 * Descarga automáticamente audio o multimedia desde Meta CDN vía Dualhook y lo persiste
 * en Firebase Storage actualizando media.url y media.storagePath en Firestore.
 */
export async function autoDownloadMediaInBackground(
  conversationId: string,
  messageId: string,
  mediaId: string,
  mediaType: 'audio' | 'sticker' | 'image' | 'video' | 'document' = 'audio'
): Promise<string | null> {
  try {
    const { getDualhookMediaUrl } = await import('@/lib/services/dualhook-client');
    const mediaRes = await getDualhookMediaUrl(mediaId);
    if (!mediaRes.success || !mediaRes.url) {
      console.warn(`[Auto-download ${mediaType}]: Failed to get media URL for ${mediaId}`);
      return null;
    }

    if (!isTrustedWhatsappMediaUrl(mediaRes.url)) {
      console.warn(`[Auto-download ${mediaType}]: Blocked untrusted CDN URL for ${mediaId}`);
      return null;
    }

    const apiKey = process.env.DUALHOOK_API_KEY;
    const downloadRes = await fetch(mediaRes.url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!downloadRes.ok) {
      console.warn(`[Auto-download ${mediaType}]: CDN fetch failed with ${downloadRes.status}`);
      return null;
    }

    const rawBuffer = await downloadRes.arrayBuffer();
    let finalBuffer = Buffer.from(rawBuffer);

    let ext = '.ogg';
    let contentType = 'audio/ogg';
    if (mediaType === 'sticker') {
      ext = '.webp';
      contentType = 'image/webp';
    } else if (mediaType === 'audio') {
      ext = '.ogg';
      contentType = downloadRes.headers.get('content-type') || 'audio/ogg';
    } else if (mediaType === 'image') {
      const rawMime = (downloadRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
      if (rawMime === 'image/jpeg' || rawMime === 'image/jpg' || rawMime === 'image/png') {
        try {
          finalBuffer = await sharp(finalBuffer)
            .rotate()
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer();
          ext = '.webp';
          contentType = 'image/webp';
        } catch {
          ext = rawMime === 'image/png' ? '.png' : '.jpg';
          contentType = rawMime;
        }
      } else {
        ext = rawMime.includes('webp') ? '.webp' : '.jpg';
        contentType = rawMime;
      }
    } else if (mediaType === 'video') {
      ext = '.mp4';
      contentType = downloadRes.headers.get('content-type') || 'video/mp4';
    } else if (mediaType === 'document') {
      ext = '.pdf';
      contentType = downloadRes.headers.get('content-type') || 'application/pdf';
    }

    const storagePath = `crm_media/${conversationId}/${Date.now()}_${mediaId}${ext}`;
    const { storage, firestore } = initializeFirebaseAdmin();
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const downloadToken = randomUUID();

    await file.save(finalBuffer, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          conversationId,
          messageId,
          mediaId,
          mediaType,
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;

    const msgRef = firestore
      .collection('crm_conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(messageId);

    await msgRef.update({
      'media.url': publicUrl,
      'media.storagePath': storagePath,
      'media.mimeType': contentType,
      'media.isDownloading': false,
    });

    return publicUrl;
  } catch (err) {
    console.warn(`[Auto-download ${mediaType} error for ${mediaId}]:`, err);
    return null;
  }
}
```

### 10.2 Parser Completo de Webhook (`crm-webhook-parser.ts`) y Sincronización Pre-SLA en `POST /api/crm/webhook`
En `POST /api/crm/webhook`, cuando `type === 'audio'`, se ejecuta **`await autoDownloadMediaInBackground(conv.id, savedMsgId, mediaObj.mediaId, 'audio')` ANTES de invocar `scheduleAiEvaluationOnInboundMessage`**. Esto evita cualquier condición de carrera y garantiza que el archivo `.ogg` ya esté disponible en Firebase Storage tanto para el reproductor `VoiceNotePlayer` del asesor como para el motor multimodal de Gemini:

```typescript
// src/lib/services/crm-webhook-parser.ts
import type {
  CrmLocation,
  CrmMessageReferral,
  CrmMessageType,
  CrmSharedContact,
} from '@/lib/types/crm';
import { upsertMetaCampaign } from '@/lib/services/crm-marketing-service';

export function parseRawSharedContacts(rawContacts: any[]): CrmSharedContact[] {
  return rawContacts.map((c: any) => {
    const contact: CrmSharedContact = {
      formattedName:
        c.name?.formatted_name ||
        [c.name?.first_name, c.name?.last_name].filter(Boolean).join(' ') ||
        'Contacto',
      phones: Array.isArray(c.phones)
        ? c.phones
            .map((p: any) => ({
              phone: p.phone || p.wa_id || '',
              ...(p.type ? { type: p.type } : {}),
              ...(p.wa_id ? { waId: p.wa_id } : {}),
            }))
            .filter((p: any) => Boolean(p.phone))
        : [],
      emails: Array.isArray(c.emails)
        ? c.emails
            .map((e: any) => ({
              email: e.email || '',
              ...(e.type ? { type: e.type } : {}),
            }))
            .filter((e: any) => Boolean(e.email))
        : [],
    };
    if (c.name?.first_name) contact.firstName = c.name.first_name;
    if (c.name?.last_name) contact.lastName = c.name.last_name;
    if (c.org?.company || c.org?.title) {
      contact.org = {
        ...(c.org.company ? { company: c.org.company } : {}),
        ...(c.org.title ? { title: c.org.title } : {}),
      };
    }
    return contact;
  });
}

export function extractAndRegisterReferral(msg: any): CrmMessageReferral | undefined {
  if (!msg?.referral) return undefined;

  const referralObj: CrmMessageReferral = {
    sourceUrl: msg.referral.source_url,
    sourceId: msg.referral.source_id,
    sourceType: msg.referral.source_type,
    headline: msg.referral.headline,
    body: msg.referral.body,
    mediaType: msg.referral.media_type,
    imageUrl: msg.referral.image_url,
    videoUrl: msg.referral.video_url,
    thumbnailUrl: msg.referral.thumbnail_url,
    ctwaClid: msg.referral.ctwa_clid,
  };

  if (msg.referral.source_id) {
    const hl = msg.referral.headline?.trim();
    const isGeneric = !hl || hl.toLowerCase().includes('publicidad');
    let smartName = hl;
    if (isGeneric && msg.referral.body) {
      const firstLine = msg.referral.body
        .split('\n')
        .map((l: string) => l.trim())
        .find((l: string) => l.length >= 4);
      if (firstLine) {
        smartName = firstLine.length > 65 ? firstLine.slice(0, 62).trim() + '...' : firstLine;
      }
    }

    upsertMetaCampaign(msg.referral.source_id, {
      name: smartName || hl,
      headline: hl,
      sourceUrl: msg.referral.source_url,
    }).catch((err) => console.warn('[Auto-register Meta Campaign error]:', err));
  }

  return referralObj;
}

export function parseInboundMessageContent(msg: any): {
  unsupported: boolean;
  type: CrmMessageType;
  bodyText: string;
  mediaObj?: any;
  locationObj?: CrmLocation;
  sharedContactsObj?: CrmSharedContact[];
} {
  let type: CrmMessageType = 'text';
  let bodyText = '';
  let mediaObj: any = undefined;
  let locationObj: CrmLocation | undefined = undefined;
  let sharedContactsObj: CrmSharedContact[] | undefined = undefined;

  switch (msg.type) {
    case 'text':
      type = 'text';
      bodyText = msg.text?.body || '';
      break;
    case 'image':
      type = 'image';
      bodyText = msg.image?.caption || '📷 Foto';
      mediaObj = {
        mediaId: msg.image?.id,
        url: null,
        mimeType: msg.image?.mime_type || 'image/jpeg',
        filename: 'imagen.jpg',
      };
      break;
    case 'audio':
      type = 'audio';
      bodyText = '🎵 Nota de voz';
      mediaObj = {
        mediaId: msg.audio?.id,
        url: null,
        mimeType: msg.audio?.mime_type || 'audio/ogg',
        filename: 'audio.ogg',
      };
      break;
    case 'video':
      type = 'video';
      bodyText = msg.video?.caption || '🎥 Video';
      mediaObj = {
        mediaId: msg.video?.id,
        url: null,
        mimeType: msg.video?.mime_type || 'video/mp4',
        filename: 'video.mp4',
      };
      break;
    case 'document':
      type = 'document';
      bodyText = (msg.document as any)?.caption || '📄 Documento';
      mediaObj = {
        mediaId: msg.document?.id,
        url: null,
        mimeType: msg.document?.mime_type || 'application/pdf',
        filename: msg.document?.filename || 'documento.pdf',
      };
      break;
    case 'location':
      type = 'location';
      bodyText = msg.location?.name || '📍 Ubicación';
      locationObj = {
        latitude: msg.location?.latitude || 0,
        longitude: msg.location?.longitude || 0,
        name: msg.location?.name,
        address: msg.location?.address,
      };
      break;
    case 'sticker':
      type = 'sticker';
      bodyText = 'Sticker';
      if (msg.sticker) {
        mediaObj = {
          mediaId: msg.sticker.id,
          url: null,
          mimeType: msg.sticker.mime_type || 'image/webp',
          filename: 'sticker.webp',
        };
      }
      break;
    case 'button':
      type = 'text';
      bodyText = msg.button?.text || msg.button?.payload || '[Botón presionado]';
      break;
    case 'interactive':
      type = 'text';
      if (msg.interactive?.type === 'button_reply') {
        bodyText =
          msg.interactive.button_reply?.title ||
          msg.interactive.button_reply?.id ||
          '[Botón presionado]';
      } else if (msg.interactive?.type === 'list_reply') {
        bodyText =
          msg.interactive.list_reply?.title ||
          msg.interactive.list_reply?.id ||
          '[Opción seleccionada]';
      } else {
        bodyText = '[Respuesta interactiva]';
      }
      break;
    case 'contacts': {
      type = 'contacts';
      const rawContacts = Array.isArray(msg.contacts) ? msg.contacts : [];
      const contactNames = rawContacts
        .map((c: any) => c.name?.formatted_name || c.name?.first_name || 'Contacto')
        .join(', ');
      bodyText = `👤 Contacto compartido: ${contactNames || 'Contacto'}`;
      sharedContactsObj = parseRawSharedContacts(rawContacts);
      break;
    }
    case 'unsupported':
      return { unsupported: true, type: 'text', bodyText: '' };
    default:
      type = 'text';
      bodyText = `[Mensaje ${msg.type}]`;
  }

  return {
    unsupported: false,
    type,
    bodyText,
    mediaObj,
    locationObj,
    sharedContactsObj,
  };
}
```

### 10.3 Extracción de Binarios OGG desde Storage hacia Base64 en `crm-ai-conversation-runner.ts`
Cuando se cumple el SLA o debounce del Agente IA y `evaluateAndRespondConversation` despierta:
1. Recorre los últimos mensajes entrantes consecutivos del cliente (`m.direction === 'inbound'`).
2. Si `m.type === 'audio' && aiConfig.listenToAudio && audioPayloads.length < 4`:
   - Verifica si `m.media?.url` ya está poblada en Firestore (gracias al auto-download del webhook).
   - Si por cualquier motivo aún era `null` pero existe `m.media?.mediaId`, ejecuta `await autoDownloadMediaInBackground(conv.id, m.id, m.media.mediaId, 'audio')` en ese mismo instante.
   - Llama a `fetchAudioAsBase64(audioUrl)`, que descarga el archivo `.ogg` desde Firebase Storage, verifica que no supere `12 MB`, extrae su `Buffer` en `base64` y lo empuja al arreglo `audioPayloads`:

```typescript
// Fragmento ejecutable en src/lib/services/crm-ai-conversation-runner.ts
async function fetchAudioAsBase64(
  url: string
): Promise<{ base64Data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const rawContentType = (res.headers.get('content-type') || 'audio/ogg').split(';')[0].trim();
    const mimeType = rawContentType.startsWith('audio/') ? rawContentType : 'audio/ogg';
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > 12 * 1024 * 1024) return null;
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    return { base64Data, mimeType };
  } catch (err) {
    console.error('[CrmAiRunner] Error downloading audio for multimodal AI:', err);
    return null;
  }
}

// Dentro de evaluateAndRespondConversation:
const latestClientMessages: string[] = [];
const audioPayloads: Array<{ base64Data: string; mimeType: string }> = [];
let referral: CrmMessageReferral | null = conv.lastReferral || null;

for (let i = recentMsgs.length - 1; i >= 0; i--) {
  const m = recentMsgs[i];
  if (m.direction !== 'inbound') break;
  if (m.referral && !referral) referral = m.referral;
  if (m.body && m.body !== '🎵 Nota de voz') {
    latestClientMessages.unshift(m.body);
  }
  if (m.type === 'audio' && aiConfig.listenToAudio && audioPayloads.length < 4) {
    let audioUrl = m.media?.url || null;
    if (!audioUrl && m.media?.mediaId && m.id) {
      audioUrl = await autoDownloadMediaInBackground(conv.id, m.id, m.media.mediaId, 'audio');
    }
    if (audioUrl) {
      const downloaded = await fetchAudioAsBase64(audioUrl);
      if (downloaded) audioPayloads.push(downloaded);
    }
  }
}
```

### 10.4 Motor Multimodal `@google/genai` con `inlineData` (`audio/ogg`), `audioTranscriptSummary` y Regla Determinista de Pin de Ubicación (`src/ai/flows/crm-sales-agent-flow.ts`)
Este flujo recibe `audioPayloads`, los inyecta como partes multimodales `inlineData` en la llamada a Gemini junto con el esquema estructurado `DECISION_SCHEMA` (que incluye `audioTranscriptSummary`), y aplica además la intercepción determinista cuando el cliente envía un Pin de Ubicación (`[location]`):

```typescript
// src/ai/flows/crm-sales-agent-flow.ts
import { GoogleGenAI, ThinkingLevel, type Schema } from '@google/genai';
import { resolveCrmChatAgentApiKey } from '@/lib/services/crm-ai-config-service';
import {
  findSiblingMarketingImages,
  resolveAndFilterSalesAgentMedia,
  type CrmAiKnowledgeContext,
} from '@/lib/services/crm-ai-catalog-context';
import type { CrmMessageReferral } from '@/lib/types/crm';
import type {
  CrmAiAgentConfig,
  CrmAiAgentDecision,
  CrmAiSelectedMedia,
} from '@/lib/types/crm-ai';
import {
  buildSalesAgentSystemPrompt,
  DECISION_SCHEMA,
} from './crm-sales-agent-prompt';

export interface RunCrmSalesAgentInput {
  config: CrmAiAgentConfig;
  context: CrmAiKnowledgeContext;
  chatMode: 'new_client' | 'follow_up';
  scheduleMode: 'business_hours' | 'after_hours';
  assignedAdvisorName?: string | null;
  customerName?: string | null;
  isFirstAiGreetingInChat: boolean;
  referral?: CrmMessageReferral | null;
  activeTagNames?: string[];
  recentInternalNotes?: string[];
  isPostEscalationFaqWindow?: boolean;
  isFinalAllowedTurn?: boolean;
  conversationHistory: Array<{
    role: 'client' | 'advisor_or_ai';
    senderLabel?: string;
    text: string;
    timestamp?: string;
  }>;
  latestClientMessages: string[];
  alreadySentMediaUrls?: string[];
  audioPayloads?: Array<{
    base64Data: string;
    mimeType: string;
  }>;
}

export interface RunCrmSalesAgentOutput {
  decision: CrmAiAgentDecision;
  resolvedMedia: CrmAiSelectedMedia[];
  modelUsed: string;
  latencyMs: number;
}

const congestedModelsUntil = new Map<string, number>();
const CIRCUIT_BREAKER_TTL_MS = 5 * 60 * 1000;

async function callGeminiWithFallback(
  ai: GoogleGenAI,
  preferredModel: string,
  params: {
    systemInstruction: string;
    contents: any[];
    temperature: number;
    responseJsonSchema?: Schema;
  }
): Promise<{ text: string; modelUsed: string }> {
  const now = Date.now();
  const normalizedPreferred =
    preferredModel === 'gemini-3.8-flash' || !preferredModel
      ? 'gemini-3.6-flash'
      : preferredModel;
  const baseCandidates = Array.from(
    new Set([
      normalizedPreferred,
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3-flash-preview',
      'gemini-3.8-flash',
    ])
  );
  const candidateModels = [
    ...baseCandidates.filter((m) => (congestedModelsUntil.get(m) || 0) <= now),
    ...baseCandidates.filter((m) => (congestedModelsUntil.get(m) || 0) > now),
  ];

  let lastError: any = null;

  for (let idx = 0; idx < candidateModels.length; idx++) {
    const modelName = candidateModels[idx];
    const timeoutMs = 18000;
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: AbortSignal.timeout(timeoutMs),
          httpOptions: { retryOptions: { attempts: 1 } },
          ...(params.responseJsonSchema
            ? {
                responseMimeType: 'application/json',
                responseJsonSchema: params.responseJsonSchema,
              }
            : {}),
        },
      });
      congestedModelsUntil.delete(modelName);
      return { text: response.text || '{}', modelUsed: modelName };
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err?.name || '');
      const shouldFallback =
        msg.includes('404') ||
        msg.includes('NOT_FOUND') ||
        msg.includes('not found') ||
        msg.includes('is not supported') ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand') ||
        msg.includes('429') ||
        msg.includes('AbortError') ||
        msg.includes('TimeoutError') ||
        msg.includes('timed out') ||
        msg.includes('aborted');
      if (shouldFallback) {
        congestedModelsUntil.set(modelName, Date.now() + CIRCUIT_BREAKER_TTL_MS);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function runCrmSalesAgentFlow(
  input: RunCrmSalesAgentInput
): Promise<RunCrmSalesAgentOutput> {
  const start = Date.now();
  const { config, context } = input;
  const { apiKey } = await resolveCrmChatAgentApiKey();

  if (!apiKey) {
    throw new Error(
      'CRM_CHAT_AGENT_API_KEY no está configurada. Agrégala en el panel de Ajustes o en .env.local.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const {
    systemInstruction,
    allowedMarketingImages,
    allowedCatalogsPdf,
    allowedSpecSheetsPdf,
  } = buildSalesAgentSystemPrompt(input);

  const historyTranscript =
    input.conversationHistory.length > 0
      ? input.conversationHistory
          .slice(-24)
          .map((m) => {
            const label =
              m.senderLabel || (m.role === 'client' ? 'Cliente' : 'Asesor');
            const timePrefix = m.timestamp ? `(${m.timestamp}) ` : '';
            return `${timePrefix}[${label}]: ${m.text}`;
          })
          .join('\n')
      : 'Sin mensajes previos.';

  const hasAttachedAudio = Boolean(
    config.listenToAudio && input.audioPayloads && input.audioPayloads.length > 0
  );

  const userParts: any[] = [
    {
      text: `HISTORIAL RECIENTE DE LA CONVERSACIÓN:\n${historyTranscript}\n\nMENSAJE(S) ACTUAL(ES) DEL CLIENTE A RESPONDER AHORA:\n${
        input.latestClientMessages.length > 0
          ? input.latestClientMessages.join('\n')
          : '(El cliente envió una nota de voz en audio adjunto)'
      }${
        hasAttachedAudio
          ? `\n\nINSTRUCCIÓN OBLIGATORIA DE AUDIO: Se adjunta(n) ${input.audioPayloads!.length} archivo(s) de audio real enviado(s) por el cliente en WhatsApp. Escucha atentamente el audio adjunto, escribe la transcripción/resumen fiel en "audioTranscriptSummary" y responde directamente a la consulta que el cliente hace en el audio. JAMÁS le pidas que te escriba por texto lo que ya dijo en el audio.`
          : ''
      }`,
    },
  ];

  // Inyección multimodal nativa de cada archivo .ogg en Base64 hacia Gemini
  if (config.listenToAudio && input.audioPayloads && input.audioPayloads.length > 0) {
    for (const audio of input.audioPayloads) {
      if (audio.base64Data) {
        userParts.push({
          inlineData: {
            mimeType: audio.mimeType || 'audio/ogg',
            data: audio.base64Data,
          },
        });
      }
    }
  }

  const { text: rawJson, modelUsed } = await callGeminiWithFallback(ai, config.model, {
    systemInstruction,
    contents: [{ role: 'user', parts: userParts }],
    temperature: config.temperature ?? 0.35,
    responseJsonSchema: DECISION_SCHEMA,
  });

  const parsed = JSON.parse(rawJson) as CrmAiAgentDecision;

  // Regla determinista para Pin de Ubicación ([location]):
  // Cuando el cliente envía su ubicación GPS por WhatsApp, está solicitando cotizar el envío a su zona
  // (NO pidiendo la dirección de la tienda). Se confirma en 1.ª persona, se crea Nota Inteligente y se escala.
  const clientSentLocationPin = input.latestClientMessages.some((m) =>
    /\[location\]/i.test(m)
  );
  if (clientSentLocationPin) {
    parsed.canAnswerDirectly = true;
    parsed.escalateToHuman = true;
    parsed.shouldCreateSmartNote = true;
    if (!parsed.smartNoteText?.trim()) {
      parsed.smartNoteText =
        'El cliente envió su pin de ubicación por WhatsApp para cotizar el costo de transporte.';
    }
    parsed.replyMessages = [
      '¡Perfecto, muchas gracias! Ya recibí tu ubicación 📍. Voy a verificar la distancia exacta hasta tu zona y en breve te confirmo el costo del transporte.',
    ];
  }

  // Sanitizador de coherencia en 1.ª persona (elimina frases en 3.ª persona que delaten un bot)
  if (Array.isArray(parsed.replyMessages)) {
    parsed.replyMessages = parsed.replyMessages.map((msg) =>
      msg
        .replace(/uno de nuestros asesores revisará/gi, 'ya reviso')
        .replace(/nuestro equipo de asesores sacará/gi, 'saco')
        .replace(/nuestro equipo de asesores/gi, 'yo')
        .replace(/un asesor te contactará/gi, 'en breve te confirmo')
    );
  }

  const resolvedMedia = resolveAndFilterSalesAgentMedia({
    config,
    context,
    parsed,
    latestClientMessages: input.latestClientMessages,
    allowedMarketingImages,
    allowedCatalogsPdf,
    allowedSpecSheetsPdf,
    alreadySentMediaUrls: input.alreadySentMediaUrls,
  });

  return {
    decision: parsed,
    resolvedMedia,
    modelUsed,
    latencyMs: Date.now() - start,
  };
}
```


---

## 11. Guardrail Determinista de Consultas de Instalación / Mano de Obra (`installation_inquiry` — `v4.18.9`)

En negocios que venden materiales, equipamiento o productos que requieren instalación a medida, el costo de mano de obra depende de variables físicas de obra (altura, superficie, andamios, distancia, estado de paredes). Para impedir al 100% que el Agente IA invente o mencione tarifas de instalación, se aplica un **blindaje de 3 capas**:

### 11.1 Capa 1 — Exclusión de Ítems de Instalación en el Contexto del Catálogo (`src/lib/services/crm-ai-catalog-context.ts`)
Antes de construir el contexto que lee el LLM, se filtran todos los SKUs o servicios cuya categoría o nombre corresponda a instalación o mano de obra:

```typescript
// En src/lib/services/crm-ai-catalog-context.ts
const INSTALLATION_ITEM_REGEX =
  /\b(instalaci[oó]n|mano\s+de\s+obra|montaje|colocaci[oó]n)\b/i;

export function filterOutInstallationCatalogItems<
  T extends { name?: string; category?: string; sku?: string }
>(items: T[]): T[] {
  return items.filter((item) => {
    const haystack = `${item.name || ''} ${item.category || ''} ${item.sku || ''}`;
    return !INSTALLATION_ITEM_REGEX.test(haystack);
  });
}
```

### 11.2 Capa 2 — Regla Expresa en el System Prompt (`src/ai/flows/crm-sales-agent-prompt.ts`)
```typescript
// En src/ai/flows/crm-sales-agent-prompt.ts
const INSTALLATION_GUARDRAIL_PROMPT = `
REGLA CRÍTICA DE INSTALACIÓN Y MANO DE OBRA:
- Si el cliente pregunta por servicio de instalación, mano de obra o cuánto cuesta instalar:
  1. Confirma amablemente que SÍ contamos con servicio de instalación profesional.
  2. NUNCA des precios, tarifas por m², ni aproximados de instalación (el costo depende de las condiciones exactas del espacio, medidas y ubicación).
  3. Solicítale las medidas del área, fotos del espacio donde desea instalar y su ubicación para preparar la cotización formal, y activa "escalateToHuman": true con "shouldCreateSmartNote": true.
`;
```

### 11.3 Capa 3 — Sanitizador Post-LLM y Escalamiento Determinista (`src/ai/flows/crm-sales-agent-flow.ts`)
Incluso si el modelo intentara mencionar un monto en la respuesta cuando el cliente consulta por instalación, el post-procesador determinista limpia la frase y fuerza el escalamiento a humano + Nota Inteligente + etiqueta `'Cotización Pendiente'`:

```typescript
// En src/ai/flows/crm-sales-agent-flow.ts (Post-procesamiento determinista después de JSON.parse)
const combinedClientInput = [
  ...input.latestClientMessages,
  parsed.audioTranscriptSummary || '',
].join(' ');

const mentionsInstallation =
  /\b(instalaci[oó]n|instalar|instalan|instalado|mano\s+de\s+obra)\b/i.test(
    combinedClientInput
  );

if (mentionsInstallation) {
  parsed.escalateToHuman = true;
  parsed.shouldCreateSmartNote = true;
  if (!parsed.smartNoteText?.trim()) {
    parsed.smartNoteText =
      'El cliente consultó por servicio de instalación. Requiere cotización de mano de obra según medidas y condiciones del espacio.';
  }
  const currentTags = new Set(parsed.suggestedTags || []);
  currentTags.add('Cotización Pendiente');
  parsed.suggestedTags = Array.from(currentTags);

  // Si por alucinación el modelo incluyó cifras monetarias junto a la palabra instalación, reemplazar por respuesta segura
  const leakedInstallPrice = (parsed.replyMessages || []).some((msg) =>
    /instalaci[oó]n[^.!?\n]{0,40}([₡$]|\bcolones\b|\bd[oó]lares\b)/i.test(msg)
  );
  if (leakedInstallPrice) {
    parsed.replyMessages = [
      'Sí contamos con servicio de instalación profesional. Como el costo de instalación depende de las medidas exactas, el tipo de superficie y la ubicación del proyecto, compartime por favor las medidas del área y tu ubicación para prepararte la cotización completa.',
    ];
  }
}
```

---

## 12. Arquitectura de Prompt White-Label 100% Agnóstica por Cliente y Veto Estricto de Mundo Cerrado (`Out-of-Domain & Official Docs Only Veto` — `v5.2`)

> [!CAUTION]
> **REGLA INQUEBRANTABLE DE REPRODUCIBILIDAD MULTI-CLIENTE (CERO COMPORTAMIENTO QUEMADO DE UNA EMPRESA)**:
> - **PROHIBIDO** guardar o reutilizar en código el prompt comercial específico de un cliente previo (jamás quemar nombres de marcas, líneas de productos como paneles/mármol/adhesivos, bancos locales específicos, direcciones físicas ni reglas de negocio particulares dentro de `crm-sales-agent-prompt.ts` o `crm-ai-config-service.ts`).
> - La personalidad, tono, políticas y catálogo cambian de cliente en cliente desde Firestore (`crm_settings/ai_agent` + `crm_settings/ai_knowledge` / `web_catalog`).
> - Usa siempre un entero `promptSchemaVersion: number` para migraciones de estructura; **prohibido** sobrescribir el `masterPrompt` del cliente buscando subcadenas de texto.

### 12.1 Defensa en 2 Capas para el Veto Estricto de Dominio y Documentación Oficial (`Closed-World SSOT`)

El Agente IA **SOLO** tiene permitido responder consultas pertenecientes al giro comercial del negocio y respaldadas explícitamente por la documentación oficial cargada en el CRM:

#### Capa 0 — Filtro Pre-LLM de Cero Tokens para Consultas Fuera de Dominio (`src/lib/utils/crm-ai-domain-guard.ts`)
Antes de invocar al modelo generativo (ahorrando `100%` de tokens y evitando escalar chats basura a asesores humanos), evalúa si el mensaje entrante pide tareas ajenas al comercio sin mencionar ningún término comercial ni categoría del catálogo activo:

```typescript
// src/lib/utils/crm-ai-domain-guard.ts
const OBVIOUS_OUT_OF_DOMAIN_REGEX =
  /\b(receta\s+de\s+cocina|clima\s+en|pron[oó]stico\s+del\s+tiempo|chiste|poema|hor[oó]scopo|escribe\s+un\s+c[oó]digo|python|javascript|resuelve\s+esta\s+ecuaci[oó]n|tarea\s+escolar|qu[ií]en\s+gan[oó]\s+el\s+partido|capital\s+de\s+|traduce\s+este\s+texto)\b/i;

export function checkPreLlmOutOfDomain(params: {
  text: string;
  companyName: string;
  businessKeywords: string[]; // Categorías activas del catálogo + términos comerciales base
}): { blocked: boolean; politeRedirect?: string } {
  const normalized = params.text.trim().toLowerCase();
  if (!normalized || !OBVIOUS_OUT_OF_DOMAIN_REGEX.test(normalized)) {
    return { blocked: false };
  }

  const mentionsBusinessTerm = params.businessKeywords.some((kw) =>
    kw.length >= 3 && normalized.includes(kw.toLowerCase())
  );
  if (mentionsBusinessTerm) {
    return { blocked: false };
  }

  return {
    blocked: true,
    politeRedirect: `¡Hola! Por este medio te asisto exclusivamente con consultas sobre productos, precios, disponibilidad y servicios oficiales de ${params.companyName}. ¿En qué producto o cotización te puedo ayudar hoy?`,
  };
}
```

> Cuando `blocked === true`, el runner responde en 1 burbuja con `politeRedirect`, mantiene **`escalateToHuman: false`** y **`shouldCreateSmartNote: false`**, sin gastar llamadas a Gemini ni ensuciar la bandeja de asesores.

#### Capa 1 — Constitución Inmutable de Mundo Cerrado (`CLOSED_WORLD_CONSTITUTION`) en el System Prompt
Este bloque constitucional es **fijo y universal** para todos los clientes, mientras que los datos del negocio entran únicamente por slots parametrizados:

```typescript
// src/ai/flows/crm-sales-agent-prompt.ts — Bloque Constitucional White-Label (Prefix-Cached)
export function buildClosedWorldConstitution(companyName: string): string {
  return `
=== CONSTITUCIÓN INQUEBRANTABLE DE VERACIDAD Y FRONTERA DE DOMINIO (MUNDO CERRADO) ===
1. ÚNICAS FUENTES DE VERDAD AUTORIZADAS:
   Tu conocimiento está estrictamente limitado a los bloques oficiales inyectados en este prompt:
   - [INFORMACIÓN_OFICIAL_EMPRESA]
   - [POLÍTICAS_COMERCIALES_ACTIVAS]
   - [CATÁLOGO_OFICIAL_ACTIVO]
   - [ÍNDICE_MULTIMEDIA_AUTORIZADO]
   - [RESPUESTAS_RÁPIDAS_Y_CHECKLISTS]

2. VETO TOTAL A TEMAS AJENOS AL NEGOCIO (OUT-OF-DOMAIN):
   - PROHIBIDO ABSOLUTAMENTE responder preguntas de cultura general, noticias, política, programación, tareas académicas, salud general, recetas, chistes, opiniones personales o cualquier tema ajeno a la actividad comercial de ${companyName}.
   - Si el cliente pregunta algo fuera del giro del negocio, responde con cortesía ejecutiva en 1 sola oración indicando que este canal es exclusivo para atención comercial de ${companyName}, con "escalateToHuman": false y "shouldCreateSmartNote": false.

3. CERO INVENCIÓN SOBRE DATOS NO DOCUMENTADOS:
   - Si el cliente hace una consulta comercial o técnica legítima para ${companyName}, pero el precio exacto, compatibilidad, medida especial, garantía, tiempo de entrega, descuento o condición NO aparece explícitamente en los bloques oficiales:
     a) JAMÁS inventes, supongas, extrapoles ni prometas datos por intuición.
     b) Confirma con naturalidad en 1.ª persona qué información estás dejando registrada para verificación, activa "escalateToHuman": true y redacta el resumen completo en "smartNoteText".

4. HIGIENE CONVERSACIONAL Y ANTI-INMEDIATEZ:
   - Habla siempre en 1.ª persona natural (prohibido decir "soy un bot" o hablar en 3.ª persona como "nuestro equipo revisará").
   - PROHIBIDO prometer tiempos inmediatos irreales ("ya mismo", "de inmediato", "en 5 minutos").
   - No repitas saludos si ya saludaste antes en la conversación ni cierres con despedidas secas si el cliente sigue conversando.
`.trim();
}
```

### 12.2 Esquema Parametrizado de Políticas Comerciales por Cliente (`TenantAiCommercialPolicies`)

En lugar de quemar reglas de financiamiento, apartados, envíos o categorías en código, el documento `crm_settings/ai_agent` expone slots limpios editables desde el tab **Reglas** (`BotTabRules.tsx`):

```typescript
export interface TenantAiCommercialPolicies {
  freeShippingPolicy?: {
    enabled: boolean;
    minOrderAmount?: number;
    maxRadiusKm?: number;
    summaryText: string; // Ej: "Envío sin costo dentro de 10 km en compras mayores a X"
  };
  financingPolicy?: {
    enabled: boolean;
    minOrderAmount?: number;
    providersLabel: string; // Ej: "Cuotas sin intereses / Link de pago"
    responseSummary: string;
    escalateOnRequest: boolean; // false si solo informa condiciones; true si requiere generar link
  };
  layawayPolicy?: {
    enabled: boolean;
    responseSummary: string; // Condiciones oficiales de apartado / reserva de inventario
    forceEscalateToHuman: boolean; // true por defecto para validación de bodega + Smart Note
  };
  customQuotationChecklist?: {
    enabled: boolean;
    triggerKeywords: string[]; // Ej: ['instalación', 'a medida', 'proyecto especial']
    linkedQuickReplyShortcut?: string; // Ej: '/CotProyecto' -> pide fotos del área + medidas + ubicación
    excludedCatalogCategoryIds?: string[]; // Oculta SKUs de mano de obra del contexto IA
    redactedRatePatterns?: string[]; // Regex post-LLM opcional para blindar tarifas internas
  };
  disambiguationRules?: Array<{
    id: string;
    ambiguousQueryPattern: string; // Ej: consulta genérica con >1 variante técnica
    clarificationPrompt: string;   // Pregunta filtro antes de enviar fotos (0 imágenes mientras sea ambiguo)
  }>;
}
```

---

## 13. Ingeniería de Eficiencia Extrema, Prefix Caching (`-90%`), Circuit Breaker Multi-Ronda, Notas Inteligentes Consolidadas y Ventanas Conscientes de Madrugada (`v4.22.2` – `v4.23.0`)

### 13.1 Ordenamiento `Static-First` para Gemini Implicit Prefix Caching y Compresión de Catálogo

Para lograr hasta **`-90%` de ahorro en tokens de entrada** mediante el *Implicit Prefix Caching* de Gemini y minimizar latencia TTFT:
1. **`systemInstruction` Estático Primero (`~92%` idéntico entre chats simultáneos)**:
   - Coloca siempre en la cabeza del `systemInstruction` los bloques invariantes: `buildClosedWorldConstitution()`, `masterPrompt` del tenant, `TenantAiCommercialPolicies`, el catálogo serializado y el índice de activos multimedia + etiquetas.
   - Deja **únicamente al final** (`~8%` cola dinámica) el bloque `=== CONTEXTO OPERATIVO DE ESTA CONVERSACIÓN ===` (`calendarBlock`, `chatMode`, `scheduleMode`, `turnCount/maxTurns`, `advisorName`, `activeTags`, `recentInternalNotes` y `campaignContextHint`).
   - El historial reciente (`conversationHistory.slice(-24)`), los mensajes nuevos a responder y los binarios `inlineData` (`audio/ogg`, máx. `4` audios `<= 12 MB`) viajan **exclusivamente** en `contents: [{ role: 'user', parts: userParts }]`, jamás mezclados dentro de `systemInstruction`.
2. **Compresión Densa del Catálogo en Memoria (`CACHE_TTL_MS = 60_000`)**:
   - Cachea en RAM durante `60s` el contexto compilado (invalidado en `0 ms` con `invalidateCrmAiContextCache()` al editar catálogo, promociones o reglas).
   - Agrupa los SKUs bajo cabeceras `[NombreCategoría]` en vez de repetir la categoría en cada línea.
   - Suprime descripciones redundantes ya contenidas en el nombre del producto (truncando el resto a `<= 90` caracteres) y omite `/Unidad` cuando la unidad es estándar:
     ```text
     [Categoría Ejemplo]
     SKU-101: Producto A | ₡14,500 [🔥PROMO -15% ₡12,325] [FOTO_WEB]
     SKU-102: Producto B (2.4m) | ₡18,900/caja — Acabado mate impermeable
     ```
3. **Presupuesto de Salida y Razonamiento**: Configura `ThinkingLevel.LOW` y `maxOutputTokens: 1200` con `responseJsonSchema: DECISION_SCHEMA`.

### 13.2 Preservación del Reloj SLA ante Ráfagas (`Burst Debouncing` sin Reiniciar el SLA)

Cuando un cliente escribe varios mensajes seguidos (`"Hola"`, `"Buenas"`, `"Ocupo cotizar..."`) durante la cuenta regresiva inicial en horario hábil (`newClientSlaMinutes = 5m` o `followUpSlaMinutes = 60m`):
- **PROHIBIDO** reiniciar los `5m` / `60m` completos con cada mensaje nuevo.
- Calcula la marca objetivo preservando el vencimiento original del SLA y asegurando solo la ventana corta de agrupación (`debounceSeconds`, ej. `40s` en producción / `5s` en pruebas):
  ```typescript
  const targetEpochMs = Math.max(
    Math.min(previousScheduledMs || now + timingPlan.delayMs, now + timingPlan.delayMs),
    now + timingPlan.debounceMs
  );
  ```
- Antes de agendar la nueva tarea en Google Cloud Tasks (`crm-ai-evaluations`), elimina `previousTaskName` (`DELETE`) + limpia el `setTimeout` local, manteniendo el cron `every 1 minutes` como red de seguridad y el candado transaccional Firestore (`aiPendingEvaluation: true -> false` + `inFlightEvaluations: Set<string>`) para garantizar **cero respuestas duplicadas**.

### 13.3 Circuit Breaker Unificado por Scope (`GeminiErrorScope`), Tope Pre-Envío y Sanitizador de Errores (`src/lib/utils/gemini-error-formatter.ts`)

1. **Aislamiento por Bóveda (`GeminiErrorScope = 'crm' | 'help' | 'pos' | 'portal_b2b'`)**:
   - El mapa de salud `congestedByScope: Map<string, number>` indexa `${scope}:${modelName}` para que un límite `429` en el Copiloto Gratuito jamás degrade al Agente de Ventas del CRM.
2. **TTLs Graduados de Congestión y Failover Rápido**:
   - `5 min` (`300_000 ms`) ante `429`, `503`, `UNAVAILABLE`, `overloaded` o `AbortSignal.timeout(18_000)` (con `httpOptions: { retryOptions: { attempts: 1 } }` para saltar de inmediato al siguiente modelo sano del pool Flash).
   - `30 min` (`1_800_000 ms`) si el error reporta agotamiento diario (`PerDay`).
   - `60 min` (`3_600_000 ms`) ante `404` / `NOT_FOUND`.
3. **Separación Estricta `AiGenerationError` (Reintento Pre-Envío vs Cero Reintentos Post-Envío)**:
   - Envuelve únicamente la llamada al LLM en `AiGenerationError` con un máximo de `MAX_AI_GENERATION_RETRIES = 2` (`RETRY_DELAY_MS = 6000`). Una vez despachada la primera burbuja a Dualhook/Meta, **jamás** se reintenta la evaluación completa.
   - Al agotarse el 2.º reintento: marca `aiHandling: false`, `aiPausedByEscalation: true`, registra telemetría `outcome: 'error'` y deja una nota interna de alerta para el asesor (**cero errores técnicos enviados al WhatsApp del cliente**).
   - En agentes con herramientas (*tool calling*), aplica además un tope duro `round < 3` (`includeTools: round < 3` fuerza síntesis textual en la ronda 3).
4. **Sanitizador `formatGeminiErrorForUser(err)`**:
   - Intercepta respuestas crudas RPC/JSON (`QuotaFailure`, `generativelanguage.googleapis.com`, `{...}`), extrae `"retryDelay"` hacia etiquetas legibles (`"2 min"`, `"1 h 15 min"`) y entrega códigos limpios (`INVALID_API_KEY`, `FREE_TIER_DAILY_LIMIT`, `QUOTA_EXCEEDED`, `MODEL_UNAVAILABLE`, `TIMEOUT`) para los probadores de conexión y simuladores UI.

### 13.4 Notas Inteligentes Consolidadas por Sesión (`2h Rolling Evolution`) y Garantía `100%` al Escalar

Para evitar que una conversación de 6 turnos con la IA contamine la pestaña de Notas del contacto con 6 notas fragmentadas, pero garantizando a la vez que **ningún escalamiento llegue vacío al asesor humano**:

```typescript
// En src/lib/services/crm-ai-telemetry-service.ts — Consolidación In-Place de 2 Horas
const AI_SESSION_NOTE_MERGE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 horas

export async function upsertConsolidatedAiSmartNote(params: {
  firestore: FirebaseFirestore.Firestore;
  contactNotesPath: string;
  botDisplayName: string;
  smartNoteBody: string;
}) {
  const cleanBody = params.smartNoteBody.trim();
  if (!cleanBody) return;

  const formattedText = cleanBody.startsWith('🤖')
    ? cleanBody
    : `🤖 [Nota Inteligente IA]: ${cleanBody}`;

  const notesCol = params.firestore.collection(params.contactNotesPath);
  const latestSnap = await notesCol.orderBy('createdAt', 'desc').limit(1).get();
  const latestDoc = latestSnap.docs[0];
  const latestData = latestDoc?.data();

  const latestCreatedMs =
    typeof latestData?.createdAt?.toMillis === 'function'
      ? latestData.createdAt.toMillis()
      : 0;

  const isRecentAiNote =
    Boolean(latestDoc) &&
    latestData?.authorId === 'ai_agent' &&
    Date.now() - latestCreatedMs < AI_SESSION_NOTE_MERGE_WINDOW_MS;

  if (isRecentAiNote) {
    if (latestData?.text === formattedText) return; // Cero escrituras redundantes
    await latestDoc.ref.set(
      {
        text: formattedText,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  // Si no hay nota reciente de IA (o un asesor humano escribió una nota en medio), crea nueva nota debajo
  await notesCol.add({
    text: formattedText,
    authorId: 'ai_agent',
    authorName: params.botDisplayName,
    createdBy: 'ai_agent',
    createdByName: params.botDisplayName,
    createdAt: FieldValue.serverTimestamp(),
  });
}
```

- **Bucle Acumulativo**: El runner inyecta las últimas `5` notas del contacto en `recentInternalNotes` para que el modelo fusione los datos previos con las nuevas medidas/productos aportados por el cliente en cada turno.
- **Catch-All Determinista de Escalamiento (`100%` Cobertura)**: Después de parsear la decisión JSON del LLM, si `parsed.escalateToHuman === true` (por solicitud humana explícita, apartado, pin GPS `[location]`, cotización a medida o criterio del modelo), el flujo **fuerza siempre** `parsed.shouldCreateSmartNote = true` y genera un resumen de respaldo si `smartNoteText` venía vacío, asignando además la etiqueta `'Cotización Pendiente'` cuando `intentCategory === 'formal_quote_or_measurements'`.

### 13.5 Ventanas de Escalamiento Fuera de Horario Conscientes de Madrugada (`resolveAfterHoursNextAttentionWindow`) y Sanitizador Anti-Inmediatez

Resuelve el error clásico donde un cliente escribe a las `06:15 a.m.` de un martes hábil y el bot le responde erróneamente *"mañana te atendemos"*:

1. **Cálculo Dinámico en 3 Tramos desde `crm_settings/auto_assign` (`timezone` + `schedule` + `closedDates`)**:
   - **Tramo 1 — Pre-apertura del mismo día hábil** (`today.enabled && !isHoliday(today) && currentMinutes < todayStartMinutes`, ej. `00:00–07:59`):
     - `isPreOpenSameDay = true`
     - `whenPhrase = 'más adelante durante la mañana, apenas iniciemos nuestro horario laboral'`
   - **Tramo 2 — Apertura al día siguiente calendario** (`nextOpenDayOffset === 1`, ej. lunes `19:00` o domingo cuando el lunes abre):
     - `isPreOpenSameDay = false`
     - `whenPhrase = 'mañana durante la mañana'`
   - **Tramo 3 — Fin de semana largo o feriado multi-día** (`nextOpenDayOffset >= 2`, ej. sábado tarde cuando domingo es cerrado o feriado):
     - `isPreOpenSameDay = false`
     - `whenPhrase = 'el <nombreDíaApertura> durante la mañana, apenas iniciemos nuestro horario laboral'`
2. **Sanitizador Determinista Post-LLM Fuera de Horario**:
   - Fuera de horario laboral (`scheduleMode === 'after_hours'`), desactiva cualquier suplantación de asesor en descanso (`shouldImpersonate = false`).
   - Si `parsed.escalateToHuman === true` en `after_hours`:
     - Reescribe frases de falsa inmediatez (`"voy a revisar ya"`, `"en breve te paso"`, `"ya estoy procesando"`) por confirmación de registro + `whenPhrase`.
     - Si `isPreOpenSameDay === true`, reemplaza cualquier mención alucinada de `"mañana"` por `whenPhrase`.
     - Si la burbuja final omitió indicar cuándo será atendido, anexa automáticamente: `"Ya dejé registrado todo lo que necesitás; ${whenPhrase} te estaremos atendiendo por este medio."`

### 13.6 Cortafuegos Anti-Spam Multimedia (`crm-ai-media-resolver.ts`)

1. **Bloqueo Mayorista y Lista Negra**: Descarta en servidor cualquier activo en `disabledMarketingItemIds` o cuyo título/etiqueta contenga `"sin precio"` / `"mayorista"` en canales retail B2C.
2. **Deduplicación Estricta por Hilo**: Extrae `alreadySentMediaUrls` de los últimos `30` mensajes y omite cualquier imagen o PDF ya enviado previamente al cliente.
3. **Compuertas Deterministas de Intención para PDFs**: Limpia `selectedCatalogPdfIds = []` y `selectedSpecSheetPdfIds = []` salvo que el texto o audio del cliente pida explícitamente catálogo/lista PDF o ficha técnica/especificaciones (tope `máx 1` PDF por turno).
4. **Matriz `0..5` de Imágenes por Sub-Serie y Ámbito**: En consultas ambiguas envía `0` fotos y primero hace la pregunta filtro; cuando el producto es claro, autocompleta slides hermanos del mismo `subSeries` hasta `máx 5` respetando el atributo `scope` del activo.

