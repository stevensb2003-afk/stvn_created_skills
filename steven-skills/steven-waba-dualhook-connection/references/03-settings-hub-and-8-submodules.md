# Blueprint 03 — Centro de `Configuración CRM` (`SettingsLayout`) y los 8 Submódulos Core por Defecto

> **Lectura Obligatoria**: Todo agente que construya (`MODO A`), integre (`MODO B`) o audite (`MODO C`) el panel `Configuración CRM` debe implementar exactamente estos **submódulos core por defecto** y respetar la exclusión estricta de conectores propietarios de clientes específicos (**PROHIBIDO incluir acoples externos quemados por defecto**). Todos los componentes consumen exclusivamente tokens semánticos de `src/app/globals.css` (cero colores hexadecimales o paletas Tailwind quemadas en `.tsx`).

---

## 1. Layout Responsivo de `Configuración CRM` (`SettingsLayout.tsx`)

### 1.1 Reglas Arquitectónicas y Navegación Dual (Desktop vs. Móvil)
- **Desktop (`≥ 768px`)**:
  - Cabecera superior única con botón `←` para volver a la bandeja de chats y título **`Configuración CRM`**.
  - Columna lateral fija `w-64 shrink-0 border-r border-border bg-background p-3 space-y-1`.
  - **Estilo Exacto del Ítem Activo**: Píldora completa `bg-primary text-primary-foreground font-semibold rounded-xl px-3.5 py-2.5 shadow-xs` (que en el tema base de `globals.css` produce la píldora Sky Blue sobre Dark Slate, y muta automáticamente si se edita `--primary` en `globals.css`). Ítems inactivos: `text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-xl px-3.5 py-2.5`.
- **Móvil (`< 768px`) — Navegación Stack en 2 Niveles (Cero Doble Cabecera)**:
  - **Nivel 1 (`mobileActiveTab === null`)**: Lista vertical a pantalla completa de tarjetas (`bg-card text-card-foreground border border-border rounded-2xl p-4`) con ícono Lucide, título, descripción corta y chevron `›`.
  - **Nivel 2 (`mobileActiveTab !== null`)**: Oculta el menú raíz y monta el submódulo activo bajo **una sola barra superior unificada**: `← Configuración CRM / {Título}` (el botón `←` ejecuta `setMobileActiveTab(null)`). **Prohibido** renderizar dos barras de retorno apiladas.

### 1.2 Catálogo Oficial de Submódulos Core & Studio (Filtrados por RBAC + Licencia)

| Orden | ID (`CrmSettingsTabId`) | Etiqueta en UI | Ícono `<AppIcon />` (`@phosphor-icons/react`) | Sub-Permiso RBAC Canónico | Estado por Defecto |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | `connections` | **Conexiones y APIs** | `credentials` (`Key`) | `crm.settings.credentials` \|\| `crm.settings.general` (alias: `.connections`) | **OBLIGATORIO (Core)** |
| **2** | `branding` | **Marca y Apariencia** | `branding` (`Palette`) | `crm.settings.branding` \|\| `isOwner` | **OBLIGATORIO (White-Label)** |
| **3** | `automations` | **Automatizaciones** | `bot` (`Robot`) | `crm.settings.bot` (alias: `.automations`) | **OBLIGATORIO (Core)** |
| **4** | `users` | **Usuarios, Roles e Invitaciones** | `roles` (`UsersThree`) | `crm.settings.roles` \|\| `isModuleAdmin('crm')` \|\| `isOwner` (alias: `.team`) | **OBLIGATORIO (RBAC v5)** |
| **5** | `templates` | **Plantillas WABA** | `templates` (`FileText`) | `crm.settings.templates` | **OBLIGATORIO (Core)** |
| **6** | `auto_assign` | **Auto-Asignación** | `autoAssign` (`SlidersHorizontal`) | `crm.settings.autoAssign` | **OBLIGATORIO (Core)** |
| **7** | `marketing` | **Marketing** | `marketing` (`ImageSquare`) | `crm.settings.marketing` | **OBLIGATORIO (Core)** |
| **8** | `quick_replies` | **Respuestas Rápidas** | `quickReplies` (`ChatCircleDots`) | `crm.settings.quickReplies` | **OBLIGATORIO (Core)** |
| **9** | `tags` | **Etiquetas** | `tags` (`Tag`) | `crm.settings.tags` | **OBLIGATORIO (Core)** |

> **Módulo Opcional Dinámico (`schedulingModule`)**: Jamás incluyas acoples logísticos propietarios quemados. Si `crm_system/tenant_license.enabledModules.scheduling !== false` y el administrador activa `schedulingModule.enabled === true` dentro de **Conexiones y APIs → Operación General**, `SettingsLayout` inyecta dinámicamente la pestaña opcional con la etiqueta configurada por el negocio (`Citas`, `Entregas`, `Agenda`), respaldada 100% de forma local en Firestore según [Blueprint 12](./12-local-deliveries-agenda-projects-spec.md) (con `ExternalLogisticsAdapter` opcional). Ver también [Blueprint 08](./08-rbac-roles-branded-invites-and-licensing.md) y [Blueprint 09](./09-global-banners-theming-and-help-copilot.md).

### 1.3 Implementación Ejecutable — `src/components/crm/settings/SettingsLayout.tsx`

```tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { cn } from '@/lib/utils';

export type CrmSettingsTabId =
  | 'connections'
  | 'fiscal_hacienda'
  | 'branding'
  | 'automations'
  | 'users'
  | 'templates'
  | 'auto_assign'
  | 'marketing'
  | 'quick_replies'
  | 'tags'
  | 'scheduling_dynamic';

export interface CrmSettingsTabDef {
  id: CrmSettingsTabId;
  label: string;
  description: string;
  iconName: AppIconName;
  visible: boolean;
}

export interface SettingsLayoutProps {
  onBackToChats: () => void;
  initialTab?: CrmSettingsTabId;
  isOwner: boolean;
  isCrmAdmin: boolean;
  hasCrmPermission: (perm: string) => boolean;
  isModuleLicensed?: (moduleKey: string) => boolean;
  dynamicSchedulingModule?: {
    enabled: boolean;
    pluralLabel: string;
  };
  renderSubmodule: (tabId: CrmSettingsTabId) => React.ReactNode;
}

export function SettingsLayout({
  onBackToChats,
  initialTab,
  isOwner,
  isCrmAdmin,
  hasCrmPermission,
  isModuleLicensed = () => true,
  dynamicSchedulingModule,
  renderSubmodule,
}: SettingsLayoutProps) {
  const allowedTabs = useMemo<CrmSettingsTabDef[]>(() => {
    const coreTabs: CrmSettingsTabDef[] = [
      {
        id: 'connections',
        label: 'Conexiones y APIs',
        description: 'Bóveda cifrada 7-tarjetas (Dualhook, Meta, IA, Correo, POS)',
        iconName: 'credentials',
        visible:
          isOwner ||
          isCrmAdmin ||
          hasCrmPermission('crm.settings.credentials') ||
          hasCrmPermission('crm.settings.connections') ||
          hasCrmPermission('crm.settings.general'),
      },
      {
        id: 'branding',
        label: 'Marca y Apariencia',
        description: 'Logo WebP, 8 paletas calibradas WCAG y modo personalizado (--tertiary)',
        iconName: 'branding',
        visible: isOwner || isCrmAdmin || hasCrmPermission('crm.settings.branding'),
      },
      {
        id: 'automations',
        label: 'Automatizaciones',
        description: 'Agente IA, modos de operación, reglas, simulador y hoja viva',
        iconName: 'bot',
        visible:
          isModuleLicensed('ai_agent') &&
          (isOwner ||
            isCrmAdmin ||
            hasCrmPermission('crm.settings.bot') ||
            hasCrmPermission('crm.settings.automations')),
      },
      {
        id: 'users',
        label: 'Usuarios, Roles e Invitaciones',
        description: 'Constructor de roles dinámicos, invitaciones branded y 19 permisos',
        iconName: 'roles',
        visible:
          isOwner ||
          isCrmAdmin ||
          hasCrmPermission('crm.settings.roles') ||
          hasCrmPermission('crm.settings.team'),
      },
      {
        id: 'templates',
        label: 'Plantillas WABA',
        description: 'Constructor oficial Meta para iniciar o reabrir chats > 24h',
        iconName: 'templates',
        visible: isModuleLicensed('whatsapp') && (isOwner || isCrmAdmin || hasCrmPermission('crm.settings.templates')),
      },
      {
        id: 'auto_assign',
        label: 'Auto-Asignación',
        description: 'Motor Round-Robin, horario semanal Lunes-Domingo y cola activa',
        iconName: 'autoAssign',
        visible: isOwner || isCrmAdmin || hasCrmPermission('crm.settings.autoAssign'),
      },
      {
        id: 'marketing',
        label: 'Marketing',
        description: 'Galería WebP optimizada, catálogos y fichas técnicas PDF',
        iconName: 'marketing',
        visible: isOwner || isCrmAdmin || hasCrmPermission('crm.settings.marketing'),
      },
      {
        id: 'quick_replies',
        label: 'Respuestas Rápidas',
        description: 'Atajos /comando con formato WhatsApp y variables dinámicas',
        iconName: 'quickReplies',
        visible: isOwner || isCrmAdmin || hasCrmPermission('crm.settings.quickReplies'),
      },
      {
        id: 'tags',
        label: 'Etiquetas',
        description: 'Paleta semántica de 18 colores sincronizada en todo el CRM',
        iconName: 'tags',
        visible: isOwner || isCrmAdmin || hasCrmPermission('crm.settings.tags'),
      },
    ];

    if (isModuleLicensed('hacienda_cr')) {
      coreTabs.splice(1, 0, {
        id: 'fiscal_hacienda',
        label: 'Facturación Hacienda CR',
        description: 'Certificado .p12, TRIBU-CR v4.4 y Sandbox',
        iconName: 'fiscal',
        visible: isOwner || isCrmAdmin || hasCrmPermission('crm.settings.fiscal'),
      });
    }

    if (dynamicSchedulingModule?.enabled && isModuleLicensed('scheduling')) {
      coreTabs.push({
        id: 'scheduling_dynamic',
        label: dynamicSchedulingModule.pluralLabel || 'Agenda',
        description: 'Configuración opcional de recordatorios y logística',
        iconName: 'scheduling',
        visible: isOwner || isCrmAdmin || hasCrmPermission('crm.settings.general'),
      });
    }

    return coreTabs.filter((tab) => tab.visible);
  }, [isOwner, isCrmAdmin, hasCrmPermission, isModuleLicensed, dynamicSchedulingModule]);

  const [desktopTab, setDesktopTab] = useState<CrmSettingsTabId>(
    initialTab && allowedTabs.some((t) => t.id === initialTab)
      ? initialTab
      : allowedTabs[0]?.id ?? 'connections'
  );
  const [mobileActiveTab, setMobileActiveTab] = useState<CrmSettingsTabId | null>(
    initialTab && allowedTabs.some((t) => t.id === initialTab) ? initialTab : null
  );

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.some((t) => t.id === desktopTab)) {
      setDesktopTab(allowedTabs[0].id);
    }
  }, [allowedTabs, desktopTab]);

  if (allowedTabs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <AppIcon name="shieldAlert" className="h-7 w-7" />
        </div>
        <h2 className="font-headline text-lg font-semibold text-foreground">
          Acceso Restringido
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Tu perfil actual no cuenta con permisos administrativos para configurar submódulos del CRM.
        </p>
        <button
          type="button"
          onClick={onBackToChats}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs"
        >
          <AppIcon name="arrowLeft" weight="bold" className="h-4 w-4" />
          Volver a Conversaciones
        </button>
      </div>
    );
  }

  const activeMobileDef = allowedTabs.find((t) => t.id === mobileActiveTab) ?? null;

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      {/* CABECERA UNIFICADA (Cero doble header en móvil) */}
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (mobileActiveTab !== null && window.innerWidth < 768) {
                setMobileActiveTab(null);
              } else {
                onBackToChats();
              }
            }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Volver"
          >
            <AppIcon name="arrowLeft" weight="bold" className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-1.5 font-headline text-base font-semibold">
            <span className={cn(activeMobileDef ? 'hidden md:inline' : 'truncate')}>
              Configuración CRM
            </span>
            {activeMobileDef && (
              <div className="flex min-w-0 items-center gap-1.5 md:hidden">
                <span className="text-xs font-normal text-muted-foreground">
                  Configuración CRM /
                </span>
                <span className="truncate text-foreground">{activeMobileDef.label}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CUERPO RESPONSIVO */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* SIDEBAR DESKTOP (w-64 + píldora bg-primary text-primary-foreground) */}
        <aside className="scrollbar-discreet hidden w-64 shrink-0 overflow-y-auto border-r border-border bg-background p-3 md:block">
          <nav className="space-y-1" aria-label="Submódulos de Configuración CRM">
            {allowedTabs.map((tab) => {
              const isActive = desktopTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDesktopTab(tab.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-primary font-semibold text-primary-foreground shadow-xs'
                      : 'font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <AppIcon name={tab.iconName} weight={isActive ? 'fill' : 'duotone'} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* PANEL DESKTOP */}
        <main className="scrollbar-discreet hidden min-w-0 flex-1 overflow-y-auto bg-background md:block">
          {renderSubmodule(desktopTab)}
        </main>

        {/* STACK MÓVIL (< 768px): Nivel 1 Tarjetas Raíz vs Nivel 2 Submódulo */}
        <div className="scrollbar-discreet flex-1 overflow-y-auto bg-background md:hidden">
          {mobileActiveTab === null ? (
            <div className="space-y-2.5 p-4">
              {allowedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMobileActiveTab(tab.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-left text-card-foreground shadow-2xs transition-colors active:bg-accent/40"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <AppIcon name={tab.iconName} weight="duotone" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {tab.label}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {tab.description}
                      </p>
                    </div>
                  </div>
                  <AppIcon name="chevronRight" weight="bold" className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="min-h-full">{renderSubmodule(mobileActiveTab)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 2. Submódulo 1 — `Conexiones y APIs` (`SettingsConnections.tsx` — Bóveda Write-Only + Operación)

### 2.1 Contrato Write-Only Anti-Exfiltración (Bóveda Unificada 7 Tarjetas) y Configuración General
- El endpoint único canónico **`GET /api/crm/admin/credentials/status`** (y opcionalmente re-exportado en `/api/crm/settings/integrations/status` para clientes legados) **NUNCA** retorna secretos desencriptados. Solo retorna `{ configured, source: 'vault' | 'env' | 'none', maskedHint, lastTestedAt, testStatus, publicMeta }`.
- Las escrituras (`POST /api/crm/admin/credentials`) y pruebas en vivo (`POST /api/crm/admin/credentials/test`) exigen sesión fresca **`auth_time < 900` s (15 min)** y permiso `crm.settings.credentials` (alias `.connections`).
- Los inputs de llaves secretas siempre se montan con `type="password"` y `value=""` (usando `maskedHint` únicamente como `placeholder`). Tras guardar o probar, el estado local de los inputs sensibles se limpia inmediatamente.
- Incluye además la configuración general del negocio (`crm_settings/general`): nombre comercial (`businessName`), código telefónico por defecto (`defaultCountryCode`), moneda (`currencyCode`, `currencySymbol`), zona horaria IANA (`timezone` con autodetección en 1 clic), hasta **`4` subdivisiones de la pestaña `Operativo`** (`operationalDivisions`) y el switch opcional `schedulingModule`.

```tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwise, ShieldCheck } from '@phosphor-icons/react';
import { AppIcon } from '@/components/ui/app-icon';
import { cn } from '@/lib/utils';

export type VaultProviderKey =
  | 'dualhook'
  | 'metaSocial'
  | 'ai'
  | 'helpCopilotAi'
  | 'metaAds'
  | 'transactionalEmail'
  | 'externalOpsOrPos'
  | 'haciendaCr';

export interface VaultServiceStatus {
  configured: boolean;
  source: 'vault' | 'env' | 'none';
  maskedHint: string | null;
  lastTestedAt: string | null;
  testStatus: 'ok' | 'error' | 'untested';
  publicMeta?: Record<string, string>;
}

export interface OperationalDivisionDef {
  id: string;
  label: string;
  iconName: string;
  enabled: boolean;
}

export interface CrmGeneralSettings {
  businessName: string;
  defaultCountryCode: string;
  currencyCode: string;
  currencySymbol: string;
  timezone: string;
  operationalDivisions: OperationalDivisionDef[];
  schedulingModule: {
    enabled: boolean;
    pluralLabel: string;
    singularLabel: string;
    iconName: string;
  };
}

export function SettingsConnections({
  canEditCredentials,
  canEditGeneral,
  webhookPublicUrl,
  generalSettings,
  onSaveGeneralSettings,
  getIdToken,
}: {
  canEditCredentials: boolean;
  canEditGeneral: boolean;
  webhookPublicUrl: string;
  generalSettings: CrmGeneralSettings;
  onSaveGeneralSettings: (next: CrmGeneralSettings) => Promise<void>;
  getIdToken: () => Promise<string>;
}) {
  const [vaultStatus, setVaultStatus] = useState<
    Record<VaultProviderKey, VaultServiceStatus> | null
  >(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Estado Write-Only (se vacía inmediatamente después de guardar)
  const [waForm, setWaForm] = useState({
    apiKey: '',
    phoneNumberId: '',
    wabaId: '',
    webhookVerifyToken: '',
    webhookHmacSecret: '',
    baseUrl: 'https://api.dualhook.com/v25.0',
  });
  const [metaSocialForm, setMetaSocialForm] = useState({
    appSecret: '',
    systemUserToken: '',
    selectedPageId: '',
  });
  const [aiForm, setAiForm] = useState({
    provider: 'google-gemini',
    apiKey: '',
    primaryModel: 'gemini-2.5-flash',
  });
  const [copilotForm, setCopilotForm] = useState({
    apiKey: '',
    model: 'gemini-2.5-flash-lite',
  });
  const [emailForm, setEmailForm] = useState({
    provider: 'resend',
    apiKey: '',
    fromAddress: '',
    customDomain: '',
  });
  const [busyCard, setBusyCard] = useState<string | null>(null);
  const [cardFeedback, setCardFeedback] = useState<Record<string, string>>({});
  const [generalDraft, setGeneralDraft] = useState<CrmGeneralSettings>(generalSettings);
  const [savingGeneral, setSavingGeneral] = useState(false);

  useEffect(() => {
    setGeneralDraft(generalSettings);
  }, [generalSettings]);

  const fetchVaultStatus = useCallback(async () => {
    if (!canEditCredentials) return;
    const token = await getIdToken();
    const res = await fetch('/api/crm/admin/credentials/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setVaultStatus(data.services);
    }
  }, [canEditCredentials, getIdToken]);

  useEffect(() => {
    void fetchVaultStatus();
  }, [fetchVaultStatus]);

  const handleVaultAction = async (
    providerKey: VaultProviderKey,
    mode: 'test' | 'save',
    payload: Record<string, string>
  ) => {
    setBusyCard(`${providerKey}:${mode}`);
    setCardFeedback((prev) => ({ ...prev, [providerKey]: '' }));
    try {
      const token = await getIdToken();
      const endpoint =
        providerKey === 'metaSocial' && mode === 'save'
          ? '/api/crm/admin/meta-social/discover'
          : mode === 'test'
            ? '/api/crm/admin/credentials/test'
            : '/api/crm/admin/credentials';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          providerKey === 'metaSocial' && mode === 'save'
            ? payload
            : { providerKey, payload }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error validando credenciales');
      }
      if (mode === 'save') {
        // Limpieza Write-Only obligatoria en memoria cliente
        if (providerKey === 'dualhook') {
          setWaForm((f) => ({
            ...f,
            apiKey: '',
            webhookVerifyToken: '',
            webhookHmacSecret: '',
          }));
        }
        if (providerKey === 'metaSocial') {
          setMetaSocialForm((f) => ({ ...f, appSecret: '', systemUserToken: '' }));
        }
        if (providerKey === 'ai') {
          setAiForm((f) => ({ ...f, apiKey: '' }));
        }
        if (providerKey === 'helpCopilotAi') {
          setCopilotForm((f) => ({ ...f, apiKey: '' }));
        }
        if (providerKey === 'transactionalEmail') {
          setEmailForm((f) => ({ ...f, apiKey: '' }));
        }
        await fetchVaultStatus();
      }
      setCardFeedback((prev) => ({
        ...prev,
        [providerKey]:
          mode === 'test'
            ? 'Conexión verificada exitosamente contra el proveedor.'
            : 'Credenciales cifradas (AES-256-GCM) guardadas en Bóveda.',
      }));
    } catch (err) {
      setCardFeedback((prev) => ({
        ...prev,
        [providerKey]: err instanceof Error ? err.message : 'Error inesperado',
      }));
    } finally {
      setBusyCard(null);
    }
  };

  const renderSourceBadge = (st?: VaultServiceStatus) => {
    if (!st || !st.configured) {
      return (
        <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">
          Pendiente
        </span>
      );
    }
    if (st.source === 'vault') {
      return (
        <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
          Activo en Bóveda Cifrada
        </span>
      );
    }
    return (
      <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
        Heredado de .env
      </span>
    );
  };

  const addDivision = () => {
    if (generalDraft.operationalDivisions.length >= 4) return;
    setGeneralDraft((prev) => ({
      ...prev,
      operationalDivisions: [
        ...prev.operationalDivisions,
        {
          id: `div_${Date.now().toString(36)}`,
          label: 'Nueva Subdivisión',
          iconName: 'Briefcase',
          enabled: true,
        },
      ],
    }));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      {/* BLOQUE 1: BÓVEDA CIFRADA WRITE-ONLY */}
      {canEditCredentials && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline text-lg font-semibold text-foreground">
                Bóveda Cifrada de Integraciones (Write-Only)
              </h2>
              <p className="text-xs text-muted-foreground">
                Las llaves se cifran con AES-256-GCM en servidor y jamás regresan en texto plano al navegador.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchVaultStatus()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              <ArrowsClockwise weight="bold" className="h-3.5 w-3.5" />
              Estado
            </button>
          </div>

          {/* URL Pública del Webhook con Copiado en 1 Clic */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              URL Oficial del Webhook (Dualhook + Meta IG/FB Callback)
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookPublicUrl}
                className="flex-1 rounded-xl border border-input bg-muted/50 px-3 py-2 font-mono text-[16px] text-foreground sm:text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(webhookPublicUrl);
                  setCopiedWebhook(true);
                  setTimeout(() => setCopiedWebhook(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
              >
                <AppIcon name={copiedWebhook ? 'check' : 'copy'} weight="bold" className="h-4 w-4" />
                {copiedWebhook ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Tarjeta 1 (`dualhook`): Gateway WhatsApp (Dualhook + Meta WABA) */}
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AppIcon name="credentials" className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    1. Gateway WhatsApp (Dualhook / Meta)
                  </h3>
                </div>
                {renderSourceBadge(vaultStatus?.dualhook)}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={waForm.apiKey}
                  onChange={(e) => setWaForm({ ...waForm, apiKey: e.target.value })}
                  placeholder={vaultStatus?.dualhook?.maskedHint || 'API Key / Access Token'}
                  className="col-span-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
                <input
                  type="text"
                  value={waForm.phoneNumberId}
                  onChange={(e) => setWaForm({ ...waForm, phoneNumberId: e.target.value })}
                  placeholder={
                    vaultStatus?.dualhook?.publicMeta?.phoneNumberId || 'Phone Number ID'
                  }
                  className="rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
                <input
                  type="text"
                  value={waForm.wabaId}
                  onChange={(e) => setWaForm({ ...waForm, wabaId: e.target.value })}
                  placeholder={vaultStatus?.dualhook?.publicMeta?.wabaId || 'WABA Account ID'}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={waForm.webhookVerifyToken}
                  onChange={(e) =>
                    setWaForm({ ...waForm, webhookVerifyToken: e.target.value })
                  }
                  placeholder="Webhook Verify Token"
                  className="rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={waForm.webhookHmacSecret}
                  onChange={(e) =>
                    setWaForm({ ...waForm, webhookHmacSecret: e.target.value })
                  }
                  placeholder="App Secret (HMAC X-Hub-Signature-256)"
                  className="rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
              </div>

              {cardFeedback.dualhook && (
                <p className="text-xs text-muted-foreground">{cardFeedback.dualhook}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyCard !== null}
                  onClick={() => void handleVaultAction('dualhook', 'test', waForm)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                >
                  {busyCard === 'dualhook:test' ? 'Probando...' : 'Probar Conexión'}
                </button>
                <button
                  type="button"
                  disabled={busyCard !== null}
                  onClick={() => void handleVaultAction('dualhook', 'save', waForm)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busyCard === 'dualhook:save' && (
                    <AppIcon name="spinner" weight="bold" className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Guardar en Bóveda
                </button>
              </div>
            </div>

            {/* Tarjeta 2 (`ai`): Proveedor GenAI (Bot Clientes) */}
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AppIcon name="ai" className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    2. Motor Inteligencia Artificial (Atención Clientes)
                  </h3>
                </div>
                {renderSourceBadge(vaultStatus?.ai)}
              </div>

              <div className="space-y-2.5">
                <select
                  value={aiForm.provider}
                  onChange={(e) => setAiForm({ ...aiForm, provider: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                >
                  <option value="google-gemini">Google Gemini (Multimodal Audio/Visión)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic Claude</option>
                </select>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={aiForm.apiKey}
                  onChange={(e) => setAiForm({ ...aiForm, apiKey: e.target.value })}
                  placeholder={vaultStatus?.ai?.maskedHint || 'API Key del proveedor IA'}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
                <input
                  type="text"
                  value={aiForm.primaryModel}
                  onChange={(e) => setAiForm({ ...aiForm, primaryModel: e.target.value })}
                  placeholder="Modelo por defecto (ej. gemini-2.5-flash)"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
              </div>

              {cardFeedback.ai && (
                <p className="text-xs text-muted-foreground">{cardFeedback.ai}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyCard !== null}
                  onClick={() => void handleVaultAction('ai', 'test', aiForm)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                >
                  Probar Conexión
                </button>
                <button
                  type="button"
                  disabled={busyCard !== null}
                  onClick={() => void handleVaultAction('ai', 'save', aiForm)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Guardar en Bóveda
                </button>
              </div>
            </div>

            {/* Tarjeta 3 (`metaSocial`): Meta Omnicanal (IG Direct + Messenger Auto-Discovery) */}
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AppIcon name="chats" className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    3. Meta Omnicanal (Instagram Direct + Messenger)
                  </h3>
                </div>
                {renderSourceBadge(vaultStatus?.metaSocial)}
              </div>
              <div className="space-y-2.5">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={metaSocialForm.appSecret}
                  onChange={(e) => setMetaSocialForm({ ...metaSocialForm, appSecret: e.target.value })}
                  placeholder={vaultStatus?.metaSocial?.maskedHint || 'Meta App Secret (HMAC)'}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={metaSocialForm.systemUserToken}
                  onChange={(e) =>
                    setMetaSocialForm({ ...metaSocialForm, systemUserToken: e.target.value })
                  }
                  placeholder="System User Token permanente (autodescubre Page + IG)"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
              </div>
              {cardFeedback.metaSocial && (
                <p className="text-xs text-muted-foreground">{cardFeedback.metaSocial}</p>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyCard !== null}
                  onClick={() => void handleVaultAction('metaSocial', 'save', metaSocialForm)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Autodescubrir y Conectar
                </button>
              </div>
            </div>

            {/* Tarjeta 4 (`helpCopilotAi`) y Tarjeta 5 (`transactionalEmail`) */}
            <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AppIcon name="send" className="h-4 w-4 text-tertiary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    4. Correo Corporativo (`transactionalEmail`) &amp; 5. Copiloto Ayuda Gratis (`helpCopilotAi`)
                  </h3>
                </div>
                {renderSourceBadge(vaultStatus?.transactionalEmail)}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={emailForm.apiKey}
                  onChange={(e) => setEmailForm({ ...emailForm, apiKey: e.target.value })}
                  placeholder={vaultStatus?.transactionalEmail?.maskedHint || 'Resend / Postmark API Key'}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
                <input
                  type="text"
                  value={emailForm.fromAddress}
                  onChange={(e) => setEmailForm({ ...emailForm, fromAddress: e.target.value })}
                  placeholder="notificaciones@mail.tuagencia.com"
                  className="rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={copilotForm.apiKey}
                  onChange={(e) => setCopilotForm({ ...copilotForm, apiKey: e.target.value })}
                  placeholder={vaultStatus?.helpCopilotAi?.maskedHint || 'Gemini Free Tier Key (Copiloto Ayuda)'}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
                <button
                  type="button"
                  disabled={busyCard !== null}
                  onClick={() => void handleVaultAction('helpCopilotAi', 'save', copilotForm)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                >
                  Guardar Key Copiloto Gratis
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
                <span>Las tarjetas 6 (`metaAds`) y 7 (`externalOpsOrPos`) comparten el mismo patrón Write-Only (`vaultStatus?.metaAds`, `vaultStatus?.externalOpsOrPos`).</span>
                <button
                  type="button"
                  disabled={busyCard !== null}
                  onClick={() => void handleVaultAction('transactionalEmail', 'save', emailForm)}
                  className="shrink-0 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Guardar SMTP/Resend
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* BLOQUE 2: LOCALIZACIÓN, SUBDIVISIONES OPERATIVAS (<= 4) Y AGENDA OPCIONAL */}
      {canEditGeneral && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <AppIcon name="globe" className="h-4 w-4 text-primary" />
            <h2 className="font-headline text-base font-semibold text-foreground">
              Localización, Subdivisiones Operativas y Agenda Opcional
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Nombre del Negocio
              </label>
              <input
                type="text"
                value={generalDraft.businessName}
                onChange={(e) =>
                  setGeneralDraft({ ...generalDraft, businessName: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Código País (sin +)
              </label>
              <input
                type="text"
                value={generalDraft.defaultCountryCode}
                onChange={(e) =>
                  setGeneralDraft({
                    ...generalDraft,
                    defaultCountryCode: e.target.value.replace(/\D/g, ''),
                  })
                }
                placeholder="506"
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Moneda (ISO / Símbolo)
              </label>
              <div className="mt-1 flex gap-1.5">
                <input
                  type="text"
                  value={generalDraft.currencyCode}
                  onChange={(e) =>
                    setGeneralDraft({
                      ...generalDraft,
                      currencyCode: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="CRC"
                  className="w-20 rounded-xl border border-input bg-background px-2.5 py-2 text-[16px] sm:text-sm"
                />
                <input
                  type="text"
                  value={generalDraft.currencySymbol}
                  onChange={(e) =>
                    setGeneralDraft({ ...generalDraft, currencySymbol: e.target.value })
                  }
                  placeholder="₡"
                  className="flex-1 rounded-xl border border-input bg-background px-2.5 py-2 text-[16px] sm:text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Zona Horaria IANA
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setGeneralDraft({
                      ...generalDraft,
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    })
                  }
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Detectar
                </button>
              </div>
              <input
                type="text"
                value={generalDraft.timezone}
                onChange={(e) =>
                  setGeneralDraft({ ...generalDraft, timezone: e.target.value })
                }
                placeholder="America/Costa_Rica"
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
              />
            </div>
          </div>

          {/* Subdivisiones de la pestaña Operativo (máximo 4) */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Subdivisiones de Pestaña Operativo ({generalDraft.operationalDivisions.length}/4)
              </span>
              <button
                type="button"
                disabled={generalDraft.operationalDivisions.length >= 4}
                onClick={addDivision}
                className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-foreground disabled:opacity-40"
              >
                <AppIcon name="plus" weight="bold" className="h-3.5 w-3.5" />
                Agregar subdivisión
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {generalDraft.operationalDivisions.map((div, idx) => (
                <div
                  key={div.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background p-2.5"
                >
                  <input
                    type="checkbox"
                    checked={div.enabled}
                    onChange={(e) => {
                      const next = [...generalDraft.operationalDivisions];
                      next[idx] = { ...div, enabled: e.target.checked };
                      setGeneralDraft({ ...generalDraft, operationalDivisions: next });
                    }}
                    className="h-4 w-4 accent-primary"
                  />
                  <input
                    type="text"
                    value={div.label}
                    onChange={(e) => {
                      const next = [...generalDraft.operationalDivisions];
                      next[idx] = { ...div, label: e.target.value };
                      setGeneralDraft({ ...generalDraft, operationalDivisions: next });
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-input bg-card px-2.5 py-1 text-[16px] sm:text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setGeneralDraft({
                        ...generalDraft,
                        operationalDivisions: generalDraft.operationalDivisions.filter(
                          (d) => d.id !== div.id
                        ),
                      })
                    }
                    className="rounded-lg p-1 text-muted-foreground hover:text-destructive"
                  >
                    <AppIcon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Módulo Opcional de Agenda / Entregas (Desactivado por defecto; 100% configurable) */}
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2.5 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={generalDraft.schedulingModule.enabled}
                onChange={(e) =>
                  setGeneralDraft({
                    ...generalDraft,
                    schedulingModule: {
                      ...generalDraft.schedulingModule,
                      enabled: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 accent-primary"
              />
              Activar módulo opcional de Agenda / Entregas personalizable
            </label>

            {generalDraft.schedulingModule.enabled && (
              <input
                type="text"
                value={generalDraft.schedulingModule.pluralLabel}
                onChange={(e) =>
                  setGeneralDraft({
                    ...generalDraft,
                    schedulingModule: {
                      ...generalDraft.schedulingModule,
                      pluralLabel: e.target.value,
                    },
                  })
                }
                placeholder="Nombre visible (ej. Citas, Entregas)"
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-[16px] sm:w-64 sm:text-xs"
              />
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={savingGeneral}
              onClick={async () => {
                setSavingGeneral(true);
                try {
                  await onSaveGeneralSettings(generalDraft);
                } finally {
                  setSavingGeneral(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {savingGeneral ? (
                <AppIcon name="spinner" weight="bold" className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck weight="duotone" className="h-3.5 w-3.5" />
              )}
              Guardar Operación General
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
```

---

## 3. Submódulo 3 — `Usuarios, Roles e Invitaciones` (`SettingsUsers.tsx` — Acordeón CSS Grid + Constructor Dinámico + Bottom Sheet `z-[100]`)

### 3.1 Los Sub-Permisos Granulares Canónicos (`CRM_PERMISSIONS`) y Animación Libre de Reflow
- En desktop (`≥ 768px`), cada fila de usuario despliega una fila secundaria con `grid-template-rows: 0fr` → `1fr` (`transition-[grid-template-rows] duration-200 ease-out`) que anima suavemente los **switches granulares canónicos** agrupados en 3 columnas (*Operación de Chat y POS*, *Analítica, Directorio y Ayuda*, *Configuración de Submódulos*).
- Los permisos de módulos licenciados (`crm.pos`, `crm.scheduling`, `crm.settings.bot`) se ocultan automáticamente cuando `crm_system/tenant_license` deshabilita el módulo correspondiente. Ver constructor dinámico `SettingsRolesBuilder` e invitaciones `crm_invitations` en [Blueprint 08](./08-rbac-roles-branded-invites-and-licensing.md).
- En móvil (`< 768px`), monta tarjetas limpias y abre `PermissionsSheet` mediante `createPortal` en **`z-[100]`**.
- Lock `updatingUserId` bloquea exclusivamente los switches de la fila en tránsito para garantizar idempotencia.

```tsx
'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  HelpCircle,
  Lock,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CrmPermissionDef {
  id: string;
  label: string;
  group: 'chat_ops' | 'data_metrics' | 'settings_admin';
}

export const CRM_GRANULAR_PERMISSIONS: readonly CrmPermissionDef[] = [
  // Grupo 1: Operación de Chat y POS
  { id: 'crm.chats', label: 'Ver y responder bandeja omnicanal', group: 'chat_ops' },
  { id: 'crm.chats.viewAll', label: 'Ver conversaciones de todo el equipo', group: 'chat_ops' },
  { id: 'crm.chats.assign', label: 'Asignar y transferir conversaciones', group: 'chat_ops' },
  { id: 'crm.agent', label: 'Elegible en cola de rotación Round-Robin', group: 'chat_ops' },
  { id: 'crm.chats.archive', label: 'Archivar / reabrir conversaciones', group: 'chat_ops' },
  { id: 'crm.chats.operational', label: 'Gestionar pestaña Operativo / Internos', group: 'chat_ops' },
  { id: 'crm.pos', label: 'Operar Punto de Venta (POS) y Caja', group: 'chat_ops' },
  // Grupo 2: Analítica, Directorio y Asistencia
  { id: 'crm.directory', label: 'Acceder al Directorio de Clientes', group: 'data_metrics' },
  { id: 'crm.scheduling', label: 'Gestionar Agenda / Entregas opcionales', group: 'data_metrics' },
  { id: 'crm.metrics', label: 'Ver Métricas personales de atención', group: 'data_metrics' },
  { id: 'crm.metrics.admin', label: 'Ver Métricas globales de todo el equipo', group: 'data_metrics' },
  { id: 'crm.webLeads', label: 'Gestionar Web Leads y formularios', group: 'data_metrics' },
  { id: 'crm.helpCopilot', label: 'Consultar Copiloto IA de Ayuda interna', group: 'data_metrics' },
  // Grupo 3: Configuración de Submódulos
  { id: 'crm.settings.credentials', label: 'Administrar Bóveda de APIs y Webhooks', group: 'settings_admin' },
  { id: 'crm.settings.fiscal', label: 'Configurar Facturación Electrónica (Hacienda CR)', group: 'settings_admin' },
  { id: 'crm.settings.general', label: 'Configurar localización y operación', group: 'settings_admin' },
  { id: 'crm.settings.branding', label: 'Personalizar Marca, Logo y Paleta de Colores', group: 'settings_admin' },
  { id: 'crm.settings.bot', label: 'Configurar Agente IA y Automatizaciones', group: 'settings_admin' },
  { id: 'crm.settings.roles', label: 'Crear Roles Dinámicos e Invitar Usuarios', group: 'settings_admin' },
  { id: 'crm.settings.templates', label: 'Crear y eliminar Plantillas WABA', group: 'settings_admin' },
  { id: 'crm.settings.autoAssign', label: 'Configurar Horario y Auto-Asignación', group: 'settings_admin' },
  { id: 'crm.settings.marketing', label: 'Gestionar Galería y PDFs de Marketing', group: 'settings_admin' },
  { id: 'crm.settings.quickReplies', label: 'Gestionar Respuestas Rápidas (/atajos)', group: 'settings_admin' },
  { id: 'crm.settings.tags', label: 'Gestionar Etiquetas Semánticas', group: 'settings_admin' },
] as const;

export interface CrmManagedUser {
  uid: string;
  displayName: string;
  email: string;
  role: string;
  isGlobalAdmin: boolean;
  hasCrmModuleAccess: boolean;
  crmAvailability: boolean;
  crmPermissions: string[];
}

export function SettingsUsers({
  users,
  onToggleModuleAccess,
  onToggleAvailability,
  onUpdatePermissions,
}: {
  users: CrmManagedUser[];
  onToggleModuleAccess: (uid: string, enabled: boolean) => Promise<void>;
  onToggleAvailability: (uid: string, available: boolean) => Promise<void>;
  onUpdatePermissions: (uid: string, nextPermissions: string[]) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [mobileSheetUser, setMobileSheetUser] = useState<CrmManagedUser | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleTogglePerm = async (user: CrmManagedUser, permId: string) => {
    if (user.isGlobalAdmin || updatingUserId === user.uid) return;
    setUpdatingUserId(user.uid);
    try {
      const exists = user.crmPermissions.includes(permId);
      const next = exists
        ? user.crmPermissions.filter((p) => p !== permId)
        : [...user.crmPermissions, permId];
      // Si también controla crm.settings.tags junto a quickReplies o individual, se sincroniza limpio
      await onUpdatePermissions(user.uid, next);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const renderPermissionsMatrix = (user: CrmManagedUser) => {
    if (user.isGlobalAdmin) {
      return (
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs text-foreground">
          <Lock className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <strong>Control Total por Rol Administrador:</strong> Este usuario posee automáticamente los 15 permisos del CRM.
          </span>
        </div>
      );
    }

    const groups: { key: CrmPermissionDef['group']; title: string }[] = [
      { key: 'chat_ops', title: 'Operación de Chat' },
      { key: 'data_metrics', title: 'Analítica y Directorio' },
      { key: 'settings_admin', title: 'Configuración de Submódulos' },
    ];

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Sub-permisos activos: {user.crmPermissions.length} / {CRM_GRANULAR_PERMISSIONS.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={updatingUserId === user.uid}
              onClick={async () => {
                setUpdatingUserId(user.uid);
                try {
                  await onUpdatePermissions(
                    user.uid,
                    CRM_GRANULAR_PERMISSIONS.map((p) => p.id)
                  );
                } finally {
                  setUpdatingUserId(null);
                }
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Activar todos
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              disabled={updatingUserId === user.uid}
              onClick={async () => {
                setUpdatingUserId(user.uid);
                try {
                  await onUpdatePermissions(user.uid, ['crm.chats', 'crm.agent', 'crm.directory']);
                } finally {
                  setUpdatingUserId(null);
                }
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Preset Asesor Base
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {groups.map((grp) => (
            <div
              key={grp.key}
              className="space-y-2 rounded-xl border border-border bg-background p-3"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {grp.title}
              </h4>
              {CRM_GRANULAR_PERMISSIONS.filter((p) => p.group === grp.key).map((perm) => {
                const checked = user.crmPermissions.includes(perm.id);
                return (
                  <label
                    key={perm.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-accent/40"
                  >
                    <span className="text-foreground">{perm.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={updatingUserId === user.uid}
                      onChange={() => void handleTogglePerm(user, perm.id)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      {/* Buscador + Guía de Niveles */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar colaborador por nombre, correo o rol..."
            className="w-full rounded-xl border border-input bg-card py-2 pr-3 pl-9 text-[16px] sm:text-sm"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
        >
          <HelpCircle className="h-4 w-4 text-primary" />
          Guía de Niveles de Acceso
        </button>
      </div>

      {showGuide && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 text-xs sm:grid-cols-3">
          <div>
            <p className="font-semibold text-foreground">1. Acceso CRM</p>
            <p className="mt-0.5 text-muted-foreground">
              Habilita el módulo en la navegación principal del colaborador.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">2. Rotación Round-Robin</p>
            <p className="mt-0.5 text-muted-foreground">
              Requiere permisos <code>crm.chats</code> + <code>crm.agent</code> y estado <em>Disponible</em>.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">3. Administrador Global</p>
            <p className="mt-0.5 text-muted-foreground">
              Supervisa métricas de todo el equipo, usuarios y configuraciones críticas.
            </p>
          </div>
        </div>
      )}

      {/* TABLA DESKTOP CON FILA ACORDEÓN CSS GRID (grid-template-rows: 0fr -> 1fr) */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <div className="grid grid-cols-12 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Colaborador</div>
          <div className="col-span-2">Rol</div>
          <div className="col-span-2 text-center">Acceso CRM</div>
          <div className="col-span-2 text-center">Estado en Vivo</div>
          <div className="col-span-2 text-right">Permisos</div>
        </div>

        <div className="divide-y divide-border">
          {filteredUsers.map((user) => {
            const isExpanded = expandedUid === user.uid;
            const isBusy = updatingUserId === user.uid;
            const permCount = user.isGlobalAdmin
              ? CRM_GRANULAR_PERMISSIONS.length
              : user.crmPermissions.length;

            return (
              <div key={user.uid} className="transition-colors">
                <div className="grid grid-cols-12 items-center px-4 py-3 text-sm">
                  <div className="col-span-4 min-w-0 pr-3">
                    <p className="truncate font-semibold text-foreground">
                      {user.displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>

                  <div className="col-span-2">
                    <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                      {user.role}
                    </span>
                  </div>

                  <div className="col-span-2 text-center">
                    <input
                      type="checkbox"
                      checked={user.hasCrmModuleAccess || user.isGlobalAdmin}
                      disabled={user.isGlobalAdmin || isBusy}
                      onChange={async (e) => {
                        setUpdatingUserId(user.uid);
                        try {
                          await onToggleModuleAccess(user.uid, e.target.checked);
                        } finally {
                          setUpdatingUserId(null);
                        }
                      }}
                      className="h-4 w-4 accent-primary"
                    />
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={async () => {
                        setUpdatingUserId(user.uid);
                        try {
                          await onToggleAvailability(user.uid, !user.crmAvailability);
                        } finally {
                          setUpdatingUserId(null);
                        }
                      }}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                        user.crmAvailability
                          ? 'bg-success/15 text-success'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {user.crmAvailability ? 'Disponible' : 'Ausente'}
                    </button>
                  </div>

                  <div className="col-span-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setExpandedUid(isExpanded ? null : user.uid)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      <span>Permisos ({permCount})</span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform duration-200',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </button>
                  </div>
                </div>

                {/* Acordeón CSS Grid sin layout thrashing */}
                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-200 ease-out',
                    isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-border bg-muted/20 p-4">
                      {renderPermissionsMatrix(user)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TARJETAS MÓVILES + BOTTOM SHEET EN PORTAL z-[100] */}
      <div className="space-y-3 md:hidden">
        {filteredUsers.map((user) => (
          <div
            key={user.uid}
            className="space-y-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {user.displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <span className="rounded-lg bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                {user.role}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <button
                type="button"
                onClick={() => void onToggleAvailability(user.uid, !user.crmAvailability)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium',
                  user.crmAvailability
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {user.crmAvailability ? 'Disponible' : 'Ausente'}
              </button>

              <button
                type="button"
                onClick={() => setMobileSheetUser(user)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Configurar Permisos
              </button>
            </div>
          </div>
        ))}
      </div>

      {mobileSheetUser &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-background/80 backdrop-blur-xs md:hidden">
            <div className="flex max-h-[85vh] flex-col rounded-t-3xl border-t border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <h3 className="truncate font-headline text-base font-semibold text-foreground">
                    Permisos · {mobileSheetUser.displayName}
                  </h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {mobileSheetUser.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSheetUser(null)}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="scrollbar-discreet overflow-y-auto p-4">
                {renderPermissionsMatrix(mobileSheetUser)}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
```

---

## 4. Submódulo 4 — `Plantillas WABA` (`TemplateBuilderModal` en `z-[9999]` + `WhatsAppPhoneMockup` + Borrado Anti-Fantasmas)

### 4.1 Sanitizador `snake_case`, Compilador Meta Graph Components, Mockup en Vivo y Borrado de 2 Niveles
- **Nombre de Plantilla**: Auto-sanitizado en vivo con `.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')`.
- **Variables Secuenciales (`{{1}}..{{N}}`)**: Meta exige incluir `example.body_text` con valores reales de muestra al enviar una plantilla con variables a revisión; el constructor valida que ninguna variable quede sin ejemplo antes de habilitar el envío.
- **Borrado de 2 Niveles (Anti-Fantasmas)**: Si una plantilla fue eliminada directamente en Meta Business Suite y el intento de borrado remoto falla con `template_not_found`, la tarjeta habilita el botón de segundo nivel **`Forzar borrado local`** (`forceLocal: true`) para purgar el documento huérfano en Firestore sin bloquear al administrador.
- **Elevación Máxima**: `TemplateBuilderModal` se monta con `createPortal(..., document.body)` en **`z-[9999]`** (ver jerarquía en Blueprint `01`).

```tsx
'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Phone,
  Plus,
  Reply,
  Trash2,
  X,
} from 'lucide-react';
import { WhatsAppText } from '@/components/crm/shared/WhatsAppText';

export type WabaCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
export type WabaHeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

export interface WabaTemplateButtonDraft {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface TemplateBuilderState {
  name: string;
  category: WabaCategory;
  language: string;
  headerFormat: WabaHeaderFormat;
  headerText: string;
  bodyText: string;
  bodyExamples: Record<number, string>;
  footerText: string;
  buttons: WabaTemplateButtonDraft[];
}

export function sanitizeWabaTemplateName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 512);
}

export function extractTemplateVariableIndices(body: string): number[] {
  const matches = Array.from(body.matchAll(/\{\{(\d+)\}\}/g));
  const unique = Array.from(new Set(matches.map((m) => Number(m[1])))).filter(
    (n) => n >= 1
  );
  return unique.sort((a, b) => a - b);
}

export function buildMetaTemplateComponents(state: TemplateBuilderState) {
  const components: Record<string, unknown>[] = [];

  if (state.headerFormat !== 'NONE') {
    if (state.headerFormat === 'TEXT' && state.headerText.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: state.headerText.trim().slice(0, 60),
      });
    } else if (state.headerFormat !== 'TEXT') {
      components.push({
        type: 'HEADER',
        format: state.headerFormat,
      });
    }
  }

  const varIndices = extractTemplateVariableIndices(state.bodyText);
  const bodyComponent: Record<string, unknown> = {
    type: 'BODY',
    text: state.bodyText.trim(),
  };
  if (varIndices.length > 0) {
    bodyComponent.example = {
      body_text: [
        varIndices.map((idx) => state.bodyExamples[idx]?.trim() || `Ejemplo_${idx}`),
      ],
    };
  }
  components.push(bodyComponent);

  if (state.footerText.trim()) {
    components.push({
      type: 'FOOTER',
      text: state.footerText.trim().slice(0, 60),
    });
  }

  if (state.buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: state.buttons.map((b) => {
        if (b.type === 'URL') {
          return { type: 'URL', text: b.text.trim(), url: b.url?.trim() };
        }
        if (b.type === 'PHONE_NUMBER') {
          return {
            type: 'PHONE_NUMBER',
            text: b.text.trim(),
            phone_number: b.phoneNumber?.trim(),
          };
        }
        return { type: 'QUICK_REPLY', text: b.text.trim() };
      }),
    });
  }

  return components;
}

/** Mockup de Teléfono WhatsApp con Previsualización Reactiva en Vivo */
export function WhatsAppPhoneMockup({ state }: { state: TemplateBuilderState }) {
  const interpolatedBody = useMemo(() => {
    return state.bodyText.replace(/\{\{(\d+)\}\}/g, (_, numStr) => {
      const idx = Number(numStr);
      return state.bodyExamples[idx]?.trim() || `{{${idx}}}`;
    });
  }, [state.bodyText, state.bodyExamples]);

  return (
    <div className="mx-auto w-full max-w-[330px] rounded-[2.25rem] border-[6px] border-foreground/85 bg-card p-2.5 shadow-xl">
      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-chat-canvas">
        {/* Barra Superior Simulada */}
        <div className="flex items-center gap-2.5 bg-card px-3.5 py-2.5 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            WA
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              Vista Previa Oficial
            </p>
            <p className="text-[10px] text-muted-foreground">Cuenta de Empresa Verificada</p>
          </div>
        </div>

        {/* Lienzo de Burbuja */}
        <div className="min-h-[340px] space-y-1.5 p-3">
          <div className="max-w-[92%] rounded-2xl rounded-tl-xs bg-chat-incoming p-2.5 text-chat-incoming-foreground shadow-xs">
            {state.headerFormat === 'TEXT' && state.headerText && (
              <p className="mb-1 text-xs font-bold">{state.headerText}</p>
            )}
            {state.headerFormat !== 'NONE' && state.headerFormat !== 'TEXT' && (
              <div className="mb-2 flex h-28 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                {state.headerFormat === 'DOCUMENT' ? (
                  <FileText className="h-7 w-7" />
                ) : (
                  <ImageIcon className="h-7 w-7" />
                )}
              </div>
            )}

            <div className="text-xs leading-relaxed">
              <WhatsAppText
                text={interpolatedBody || 'Escribe el cuerpo de tu plantilla...'}
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-[10px] text-muted-foreground">
                {state.footerText}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">12:00</span>
            </div>
          </div>

          {/* Botones Interactivos Debajo de la Burbuja */}
          {state.buttons.length > 0 && (
            <div className="max-w-[92%] space-y-1">
              {state.buttons.map((btn, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-chat-incoming py-2 text-xs font-medium text-primary shadow-2xs"
                >
                  {btn.type === 'URL' && <ExternalLink className="h-3.5 w-3.5" />}
                  {btn.type === 'PHONE_NUMBER' && <Phone className="h-3.5 w-3.5" />}
                  {btn.type === 'QUICK_REPLY' && <Reply className="h-3.5 w-3.5" />}
                  <span>{btn.text || `Botón ${idx + 1}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Constructor Fullscreen en Portal z-[9999] */
export function TemplateBuilderModal({
  open,
  onClose,
  onSubmitTemplate,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitTemplate: (payload: {
    name: string;
    category: WabaCategory;
    language: string;
    components: Record<string, unknown>[];
  }) => Promise<void>;
}) {
  const [state, setState] = useState<TemplateBuilderState>({
    name: '',
    category: 'UTILITY',
    language: 'es',
    headerFormat: 'NONE',
    headerText: '',
    bodyText: 'Hola {{1}}, te escribimos respecto a tu solicitud.',
    bodyExamples: { 1: 'María' },
    footerText: '',
    buttons: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const varIndices = useMemo(
    () => extractTemplateVariableIndices(state.bodyText),
    [state.bodyText]
  );

  if (!open || typeof document === 'undefined') return null;

  const insertNextVariable = () => {
    const nextIdx = (varIndices[varIndices.length - 1] ?? 0) + 1;
    setState((prev) => ({
      ...prev,
      bodyText: `${prev.bodyText} {{${nextIdx}}}`,
      bodyExamples: { ...prev.bodyExamples, [nextIdx]: `Valor ${nextIdx}` },
    }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 sm:px-6">
        <div>
          <h2 className="font-headline text-base font-semibold">
            Constructor Oficial de Plantilla WABA
          </h2>
          <p className="text-xs text-muted-foreground">
            Se enviará a revisión automática en Meta Business Manager
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting || !state.name || !state.bodyText.trim()}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmitTemplate({
                  name: state.name,
                  category: state.category,
                  language: state.language,
                  components: buildMetaTemplateComponents(state),
                });
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            className="rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Enviando a Meta...' : 'Enviar a Aprobación'}
          </button>
        </div>
      </header>

      <div className="scrollbar-discreet flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 p-4 sm:p-6 lg:grid-cols-12">
          {/* Columna Formulario (7 cols) */}
          <div className="space-y-5 lg:col-span-7">
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Nombre (snake_case)
                </label>
                <input
                  type="text"
                  value={state.name}
                  onChange={(e) =>
                    setState({ ...state, name: sanitizeWabaTemplateName(e.target.value) })
                  }
                  placeholder="seguimiento_cotizacion"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-[16px] sm:text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Categoría Meta
                </label>
                <select
                  value={state.category}
                  onChange={(e) =>
                    setState({ ...state, category: e.target.value as WabaCategory })
                  }
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
                >
                  <option value="UTILITY">UTILITY (Seguimiento / Servicio)</option>
                  <option value="MARKETING">MARKETING (Promoción / Reactivación)</option>
                  <option value="AUTHENTICATION">AUTHENTICATION (Código OTP)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Idioma</label>
                <select
                  value={state.language}
                  onChange={(e) => setState({ ...state, language: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
                >
                  <option value="es">Español (es)</option>
                  <option value="es_MX">Español México (es_MX)</option>
                  <option value="en_US">English (en_US)</option>
                </select>
              </div>
            </div>

            {/* Cabecera Opcional */}
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cabecera (Opcional)
                </label>
                <select
                  value={state.headerFormat}
                  onChange={(e) =>
                    setState({
                      ...state,
                      headerFormat: e.target.value as WabaHeaderFormat,
                    })
                  }
                  className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs"
                >
                  <option value="NONE">Sin cabecera</option>
                  <option value="TEXT">Texto (máx. 60 chars)</option>
                  <option value="IMAGE">Imagen</option>
                  <option value="VIDEO">Video</option>
                  <option value="DOCUMENT">Documento PDF</option>
                </select>
              </div>
              {state.headerFormat === 'TEXT' && (
                <input
                  type="text"
                  maxLength={60}
                  value={state.headerText}
                  onChange={(e) => setState({ ...state, headerText: e.target.value })}
                  placeholder="Título destacado..."
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-sm"
                />
              )}
            </div>

            {/* Cuerpo Obligatorio + Variables {{N}} con Ejemplos */}
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cuerpo del Mensaje ({state.bodyText.length}/1024)
                </label>
                <button
                  type="button"
                  onClick={insertNextVariable}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Variable {`{{${(varIndices[varIndices.length - 1] ?? 0) + 1}}}`}
                </button>
              </div>

              <textarea
                rows={5}
                maxLength={1024}
                value={state.bodyText}
                onChange={(e) => setState({ ...state, bodyText: e.target.value })}
                className="w-full rounded-xl border border-input bg-background p-3 text-[16px] sm:text-sm"
              />

              {varIndices.length > 0 && (
                <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ejemplos obligatorios para revisión de Meta:
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {varIndices.map((idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-xs font-semibold text-primary">
                          {`{{${idx}}}`}
                        </span>
                        <input
                          type="text"
                          value={state.bodyExamples[idx] || ''}
                          onChange={(e) =>
                            setState({
                              ...state,
                              bodyExamples: {
                                ...state.bodyExamples,
                                [idx]: e.target.value,
                              },
                            })
                          }
                          placeholder={`Ejemplo para {{${idx}}}`}
                          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-[16px] sm:text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pie y Botones (hasta 3) */}
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <input
                type="text"
                maxLength={60}
                value={state.footerText}
                onChange={(e) => setState({ ...state, footerText: e.target.value })}
                placeholder="Pie de burbuja opcional (máx. 60 caracteres)"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-[16px] sm:text-xs"
              />

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Botones Interactivos ({state.buttons.length}/3)
                </span>
                <button
                  type="button"
                  disabled={state.buttons.length >= 3}
                  onClick={() =>
                    setState({
                      ...state,
                      buttons: [
                        ...state.buttons,
                        { type: 'QUICK_REPLY', text: 'Quiero más info' },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar botón
                </button>
              </div>

              {state.buttons.map((btn, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={btn.type}
                    onChange={(e) => {
                      const next = [...state.buttons];
                      next[i] = {
                        ...btn,
                        type: e.target.value as WabaTemplateButtonDraft['type'],
                      };
                      setState({ ...state, buttons: next });
                    }}
                    className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="QUICK_REPLY">Respuesta Rápida</option>
                    <option value="URL">Enlace URL</option>
                    <option value="PHONE_NUMBER">Llamar Teléfono</option>
                  </select>
                  <input
                    type="text"
                    maxLength={25}
                    value={btn.text}
                    onChange={(e) => {
                      const next = [...state.buttons];
                      next[i] = { ...btn, text: e.target.value };
                      setState({ ...state, buttons: next });
                    }}
                    placeholder="Texto del botón"
                    className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-[16px] sm:text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setState({
                        ...state,
                        buttons: state.buttons.filter((_, idx) => idx !== i),
                      })
                    }
                    className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Columna Derecha: Mockup Sticky */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-6">
              <WhatsAppPhoneMockup state={state} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Handler de Eliminación de 2 Niveles (Anti-Plantillas Fantasma) */
export async function deleteTemplateTwoTier({
  templateName,
  forceLocal,
  getIdToken,
}: {
  templateName: string;
  forceLocal: boolean;
  getIdToken: () => Promise<string>;
}): Promise<{ deleted: boolean; requiresForceLocal?: boolean; message?: string }> {
  const token = await getIdToken();
  const res = await fetch(
    `/api/crm/templates?name=${encodeURIComponent(templateName)}${
      forceLocal ? '&forceLocal=true' : ''
    }`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();
  if (res.status === 404 || data.code === 'REMOTE_TEMPLATE_NOT_FOUND') {
    return {
      deleted: false,
      requiresForceLocal: true,
      message:
        'La plantilla ya no existe en Meta Business Manager. ¿Deseas forzar el borrado local?',
    };
  }
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo eliminar la plantilla');
  }
  return { deleted: true };
}
```

---

## 5. Submódulo 5 — `Auto-Asignación` (`SettingsAutoAssign.tsx` — Horario Lunes–Domingo + *"Igualar Activos"* + Lote `/reassign`)

### 5.1 Sincronización 1-Clic de Horario y Cola Elegible Round-Robin
- **Botón `⚡ Auto-asignar ahora`**: Muestra badge con el conteo real de conversaciones comerciales sin asignar (`!isOperational && !isSupplier && !isInternal && !isCourier && (!assignedTo || assignedTo === 'unassigned')`) e invoca `POST /api/crm/auto-assign/reassign` con lock `isTriggering`.
- **Botón `Igualar Activos` (`handleSyncSchedule`)**: Toma `startTime` y `endTime` del primer día habilitado de la semana y los replica en todos los demás días habilitados en un solo clic.
- **Cola de Asesores Elegibles**: Filtra exclusivamente colaboradores que tengan **`crm.chats` + `crm.agent`**.

```tsx
'use client';

import React, { useState } from 'react';
import { Copy, Loader2, Save, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DayOfWeekKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface DayScheduleSlot {
  enabled: boolean;
  startTime: string; // "08:00"
  endTime: string;   // "17:30"
}

export interface AutoAssignConfig {
  enabled: boolean;
  assignableUserIds: string[];
  schedule: Record<DayOfWeekKey, DayScheduleSlot>;
  lastAssignedIndex?: number;
}

const ORDERED_DAYS: { key: DayOfWeekKey; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export interface EligibleAdvisorItem {
  uid: string;
  displayName: string;
  role: string;
  crmAvailability: boolean;
}

export function SettingsAutoAssign({
  initialConfig,
  eligibleAdvisors,
  unassignedCommercialCount,
  onSaveConfig,
  onTriggerBatchReassign,
}: {
  initialConfig: AutoAssignConfig;
  eligibleAdvisors: EligibleAdvisorItem[];
  unassignedCommercialCount: number;
  onSaveConfig: (next: AutoAssignConfig) => Promise<void>;
  onTriggerBatchReassign: () => Promise<{ assignedCount: number; reason?: string }>;
}) {
  const [config, setConfig] = useState<AutoAssignConfig>(initialConfig);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const handleSyncSchedule = () => {
    const firstActive = ORDERED_DAYS.find((d) => config.schedule[d.key]?.enabled);
    if (!firstActive) return;
    const { startTime, endTime } = config.schedule[firstActive.key];
    const nextSchedule = { ...config.schedule };
    for (const day of ORDERED_DAYS) {
      if (nextSchedule[day.key]?.enabled) {
        nextSchedule[day.key] = {
          ...nextSchedule[day.key],
          startTime,
          endTime,
        };
      }
    }
    setConfig((prev) => ({ ...prev, schedule: nextSchedule }));
  };

  const toggleAdvisor = (uid: string) => {
    setConfig((prev) => {
      const exists = prev.assignableUserIds.includes(uid);
      return {
        ...prev,
        assignableUserIds: exists
          ? prev.assignableUserIds.filter((id) => id !== uid)
          : [...prev.assignableUserIds, uid],
      };
    });
  };

  const activeCycleCount = eligibleAdvisors.filter((a) =>
    config.assignableUserIds.includes(a.uid)
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* CABECERA DE CONTROL */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="h-5 w-5 accent-primary"
          />
          <div>
            <p className="font-headline text-sm font-semibold text-foreground">
              Activar Motor Round-Robin Automático
            </p>
            <p className="text-xs text-muted-foreground">
              Reparte chats comerciales nuevos equitativamente dentro del horario hábil.
            </p>
          </div>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isTriggering || unassignedCommercialCount === 0}
            onClick={async () => {
              setIsTriggering(true);
              setStatusBanner(null);
              try {
                const res = await onTriggerBatchReassign();
                setStatusBanner(
                  res.reason
                    ? res.reason
                    : `Se asignaron ${res.assignedCount} conversaciones en lote.`
                );
              } finally {
                setIsTriggering(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
          >
            {isTriggering ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Zap className="h-3.5 w-3.5 text-primary" />
            )}
            <span>Auto-asignar ahora</span>
            {unassignedCommercialCount > 0 && (
              <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">
                {unassignedCommercialCount}
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              try {
                await onSaveConfig(config);
                setStatusBanner('Configuración de Auto-Asignación guardada.');
              } finally {
                setIsSaving(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            Guardar
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs text-foreground">
          {statusBanner}
        </div>
      )}

      {/* GRID 2 COLUMNAS: HORARIO COMERCIAL vs ASESORES ELEGIBLES */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna Izquierda: Horario Lunes a Domingo */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline text-sm font-semibold text-foreground">
                Horario Comercial Semanal
              </h3>
              <p className="text-xs text-muted-foreground">
                Fuera de estas ventanas los chats esperan en bandeja o los atiende el Agente IA.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncSchedule}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              title="Clonar hora del primer día activo a todos los demás días activos"
            >
              <Copy className="h-3.5 w-3.5 text-primary" />
              Igualar Activos
            </button>
          </div>

          <div className="space-y-2.5">
            {ORDERED_DAYS.map(({ key, label }) => {
              const slot = config.schedule[key] ?? {
                enabled: false,
                startTime: '08:00',
                endTime: '17:00',
              };
              return (
                <div
                  key={key}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2',
                    !slot.enabled && 'opacity-55'
                  )}
                >
                  <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={slot.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          schedule: {
                            ...config.schedule,
                            [key]: { ...slot, enabled: e.target.checked },
                          },
                        })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{label}</span>
                  </label>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      disabled={!slot.enabled}
                      value={slot.startTime}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          schedule: {
                            ...config.schedule,
                            [key]: { ...slot, startTime: e.target.value },
                          },
                        })
                      }
                      className="rounded-lg border border-input bg-card px-2 py-1 text-[16px] sm:text-xs"
                    />
                    <span className="text-xs text-muted-foreground">a</span>
                    <input
                      type="time"
                      disabled={!slot.enabled}
                      value={slot.endTime}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          schedule: {
                            ...config.schedule,
                            [key]: { ...slot, endTime: e.target.value },
                          },
                        })
                      }
                      className="rounded-lg border border-input bg-card px-2 py-1 text-[16px] sm:text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna Derecha: Cola de Asesores Elegibles (crm.chats + crm.agent) */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline text-sm font-semibold text-foreground">
                Asesores Elegibles en Rotación
              </h3>
              <p className="text-xs text-muted-foreground">
                Solo reciben chats quienes estén en ciclo y con estado Disponible.
              </p>
            </div>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {activeCycleCount} de {eligibleAdvisors.length} activos
            </span>
          </div>

          <div className="space-y-2">
            {eligibleAdvisors.map((advisor) => {
              const inCycle = config.assignableUserIds.includes(advisor.uid);
              return (
                <label
                  key={advisor.uid}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 hover:bg-accent/30"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={inCycle}
                      onChange={() => toggleAdvisor(advisor.uid)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {advisor.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">{advisor.role}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {inCycle && (
                      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        En ciclo
                      </span>
                    )}
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        advisor.crmAvailability
                          ? 'bg-success/15 text-success'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {advisor.crmAvailability ? 'Disponible' : 'Ausente'}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Submódulo 6 — `Marketing` (`SettingsMarketingImages.tsx` — Conversión `.webp`, Multi-Upload, Eliminación Masiva y `refresh_cache`)

### 6.1 Contrato de Activos Multimedia, Borrado Atómico y Puente JPEG
- **3 Pestañas de Tipo de Activo**:
  1. `image` (*Imágenes Marketing*, `accept="image/jpeg,image/png,image/webp"`, máx. `5 MB` → comprimidas automáticamente en cliente con `compressImageToWebp()` del Blueprint `01` antes de subir a Cloud Storage).
  2. `catalog` (*Catálogos PDF*, `accept="application/pdf"`, máx. `100 MB`).
  3. `datasheet` (*Fichas Técnicas PDF*, `accept="application/pdf"`, máx. `100 MB`).
- **Sincronización con Agente IA y Puente WhatsApp**:
  - Cada alta, edición de categorías o borrado masivo actualiza `crm_settings/marketing_images` (sanitizado con `removeUndefined()`) e invoca en segundo plano `POST /api/crm/ai/config` (`{ action: 'refresh_cache' }`).
  - Cuando un asesor o el Bot IA envía una imagen `.webp` hacia WhatsApp, `dualhook-client.ts` la canaliza automáticamente por el endpoint firmado `/api/crm/media/whatsapp-jpeg` (`sharp` en RAM, cero duplicados `.jpg` en Storage).

```tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { compressImageToWebp, removeUndefined } from '@/lib/utils/crm-sanitizers';

export type MarketingAssetKind = 'image' | 'catalog' | 'datasheet';
export type MarketingSortMode = 'newest' | 'name_asc' | 'name_desc' | 'category';

export interface MarketingAssetItem {
  id: string;
  kind: MarketingAssetKind;
  title: string;
  categories: string[];
  url: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;       // 5 MB
const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;  // 100 MB

export function SettingsMarketingImages({
  items,
  categories,
  onUploadProcessedFile,
  onPersistItemsAndCategories,
  onDeleteStoragePath,
  getIdToken,
}: {
  items: MarketingAssetItem[];
  categories: string[];
  onUploadProcessedFile: (
    file: File,
    kind: MarketingAssetKind
  ) => Promise<{ url: string; storagePath: string }>;
  onPersistItemsAndCategories: (
    nextItems: MarketingAssetItem[],
    nextCategories: string[]
  ) => Promise<void>;
  onDeleteStoragePath: (storagePath: string) => Promise<void>;
  getIdToken: () => Promise<string>;
}) {
  const [activeKind, setActiveKind] = useState<MarketingAssetKind>('image');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [sortMode, setSortMode] = useState<MarketingSortMode>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const triggerAiCacheRefresh = async () => {
    try {
      const token = await getIdToken();
      await fetch('/api/crm/ai/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'refresh_cache' }),
      });
    } catch {
      // No bloquea la UX si el motor IA está desactivado
    }
  };

  const visibleItems = useMemo(() => {
    const byKind = items.filter((item) => item.kind === activeKind);
    const byCat =
      activeCategory === 'ALL'
        ? byKind
        : byKind.filter((item) => item.categories.includes(activeCategory));

    return [...byCat].sort((a, b) => {
      if (sortMode === 'name_asc') return a.title.localeCompare(b.title);
      if (sortMode === 'name_desc') return b.title.localeCompare(a.title);
      if (sortMode === 'category') {
        return (a.categories[0] || '').localeCompare(b.categories[0] || '');
      }
      return b.createdAt - a.createdAt;
    });
  }, [items, activeKind, activeCategory, sortMode]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setFeedback(null);

    try {
      const maxBytes = activeKind === 'image' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
      const validFiles: File[] = [];
      let rejectedCount = 0;

      Array.from(fileList).forEach((file) => {
        if (file.size > maxBytes) {
          rejectedCount += 1;
        } else {
          validFiles.push(file);
        }
      });

      const createdAssets: MarketingAssetItem[] = [];
      for (const rawFile of validFiles) {
        const processedFile =
          activeKind === 'image' ? await compressImageToWebp(rawFile) : rawFile;
        const { url, storagePath } = await onUploadProcessedFile(
          processedFile,
          activeKind
        );
        const cleanTitle = rawFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
        createdAssets.push(
          removeUndefined({
            id: `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            kind: activeKind,
            title: cleanTitle,
            categories: activeCategory !== 'ALL' ? [activeCategory] : [],
            url,
            storagePath,
            mimeType: processedFile.type,
            sizeBytes: processedFile.size,
            createdAt: Date.now(),
          })
        );
      }

      if (createdAssets.length > 0) {
        await onPersistItemsAndCategories([...createdAssets, ...items], categories);
        void triggerAiCacheRefresh();
      }

      if (rejectedCount > 0) {
        setFeedback(
          `Se subieron ${createdAssets.length} archivos. ${rejectedCount} excedían el límite permitido.`
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || deletingBulk) return;
    setDeletingBulk(true);
    try {
      const toDelete = items.filter((i) => selectedIds.has(i.id));
      const remaining = items.filter((i) => !selectedIds.has(i.id));

      await Promise.allSettled(
        toDelete.map((asset) => onDeleteStoragePath(asset.storagePath))
      );
      await onPersistItemsAndCategories(remaining, categories);
      setSelectedIds(new Set());
      void triggerAiCacheRefresh();
    } finally {
      setDeletingBulk(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 sm:p-6">
      {/* 3 Pestañas de Tipo de Activo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-muted p-1">
          {(
            [
              { id: 'image', label: 'Imágenes Marketing' },
              { id: 'catalog', label: 'Catálogos PDF' },
              { id: 'datasheet', label: 'Fichas Técnicas' },
            ] as const
          ).map((tab) => {
            const count = items.filter((i) => i.kind === tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveKind(tab.id);
                  setSelectedIds(new Set());
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  activeKind === tab.id
                    ? 'bg-card text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as MarketingSortMode)}
            className="rounded-xl border border-input bg-card px-3 py-1.5 text-xs"
          >
            <option value="newest">Más recientes</option>
            <option value="name_asc">Nombre A–Z</option>
            <option value="name_desc">Nombre Z–A</option>
            <option value="category">Categoría</option>
          </select>

          <button
            type="button"
            onClick={() => {
              if (selectedIds.size === visibleItems.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(visibleItems.map((i) => i.id)));
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {selectedIds.size === visibleItems.length && visibleItems.length > 0
              ? 'Deseleccionar'
              : 'Seleccionar todo'}
          </button>
        </div>
      </div>

      {/* Zona Drag & Drop Multi-Archivo */}
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/60 p-6 text-center transition-colors hover:border-primary/60 hover:bg-accent/20">
        {uploading ? (
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-7 w-7 text-primary" />
        )}
        <p className="mt-2 text-sm font-semibold text-foreground">
          {activeKind === 'image'
            ? 'Arrastra o selecciona imágenes (conversión automática a WebP, máx. 5 MB)'
            : 'Arrastra o selecciona documentos PDF (máx. 100 MB)'}
        </p>
        <input
          type="file"
          multiple
          accept={
            activeKind === 'image'
              ? 'image/jpeg,image/png,image/webp'
              : 'application/pdf'
          }
          onChange={(e) => void handleFilesSelected(e.target.files)}
          className="hidden"
        />
      </label>

      {feedback && (
        <p className="rounded-xl bg-warning/15 px-3.5 py-2 text-xs text-warning">
          {feedback}
        </p>
      )}

      {/* Barra de Filtro por Categoría */}
      <div className="scrollbar-discreet flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory('ALL')}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
            activeCategory === 'ALL'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          Todas
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid de Activos */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visibleItems.map((asset) => {
          const isSelected = selectedIds.has(asset.id);
          return (
            <div
              key={asset.id}
              className={cn(
                'group relative overflow-hidden rounded-2xl border bg-card transition-all',
                isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'
              )}
            >
              <label className="absolute top-2.5 left-2.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg bg-background/85 backdrop-blur-xs">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {
                    const next = new Set(selectedIds);
                    if (isSelected) next.delete(asset.id);
                    else next.add(asset.id);
                    setSelectedIds(next);
                  }}
                  className="h-4 w-4 accent-primary"
                />
              </label>

              <div className="flex aspect-4/3 items-center justify-center bg-muted/40">
                {asset.kind === 'image' ? (
                  <img
                    src={asset.url}
                    alt={asset.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <FileText className="h-9 w-9 text-primary" />
                    <span className="text-[11px] font-medium uppercase">PDF</span>
                  </div>
                )}
              </div>

              <div className="p-3">
                <p className="truncate text-xs font-semibold text-foreground">
                  {asset.title}
                </p>
                <div className="mt-1.5 flex items-center gap-1">
                  {asset.categories[0] ? (
                    <span className="truncate rounded-md bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                      {asset.categories[0]}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      Sin categoría
                    </span>
                  )}
                  {asset.categories.length > 1 && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      +{asset.categories.length - 1}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra Flotante de Eliminación Masiva */}
      {selectedIds.size > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-lg items-center justify-between rounded-2xl border border-border bg-popover px-4 py-3 text-popover-foreground shadow-xl">
          <span className="text-xs font-semibold">
            {selectedIds.size} activos seleccionados
          </span>
          <button
            type="button"
            disabled={deletingBulk}
            onClick={() => void handleBulkDelete()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-3.5 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
          >
            {deletingBulk ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Eliminar seleccionados
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 7. Submódulos 2, 7 y 8 — Referencias Cruzadas Exactas
- **Submódulo 2 (`Automatizaciones` / `SettingsBot`)**: Implementación completa con los 5 subtabs en [`04-ai-automations-5-subtabs-spec.md`](./04-ai-automations-5-subtabs-spec.md).
- **Submódulos 7 y 8 (`Respuestas Rápidas` y `Etiquetas`)**: Implementación ejecutable completa en [`02-chat-workspace-tags-quickreplies.md`](./02-chat-workspace-tags-quickreplies.md).


---

## 8. Submódulo 8 (`SettingsTags`) con Edición Inline WCAG AAA y Puente Criptográfico WebP↔JPEG

### 8.1 Gestor de Etiquetas con Selector de 18 Tonos WCAG AAA y Edición Inline (`src/components/crm/settings/settings-tags.tsx`)
Consume `CRM_TAG_COLOR_OPTIONS`, `resolveTagColorClass` y `resolveTagDotClass` desde `src/lib/constants/crm-tag-colors.ts` (definido en `Blueprint 01`), permitiendo crear, editar nombre/color inline y eliminar con confirmación `AlertDialog`:

```tsx
// src/components/crm/settings/settings-tags.tsx
'use client';

import { useState } from 'react';
import { Tag as TagIcon, Plus, X, Loader2, Pencil, Check } from 'lucide-react';
import { collection, addDoc, deleteDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { CrmTag } from '@/lib/types/crm';
import { useCrmTags } from '@/hooks/crm/use-crm-tags';
import {
  CRM_TAG_COLOR_OPTIONS,
  resolveTagColorClass,
  resolveTagDotClass,
} from '@/lib/constants/crm-tag-colors';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function SettingsTags() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { tags, loading } = useCrmTags();

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(CRM_TAG_COLOR_OPTIONS[11].badgeClass);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<CrmTag | null>(null);

  const handleAddTag = async () => {
    if (!firestore || !newTagName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'crm_tags'), {
        name: newTagName.trim(),
        color: newTagColor,
        createdAt: serverTimestamp(),
      });
      toast({
        title: 'Etiqueta creada',
        description: `Se ha guardado la etiqueta "${newTagName.trim()}".`,
      });
      setNewTagName('');
    } catch (error: any) {
      toast({
        title: 'Error al crear etiqueta',
        description: error?.message || 'No se pudo guardar la etiqueta.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditingTag = (tag: CrmTag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(resolveTagColorClass(tag.color));
  };

  const handleSaveEdit = async () => {
    if (!firestore || !editingTagId || !editTagName.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await updateDoc(doc(firestore, 'crm_tags', editingTagId), {
        name: editTagName.trim(),
        color: editTagColor,
        updatedAt: serverTimestamp(),
      });
      toast({
        title: 'Etiqueta actualizada',
        description: `Se guardaron los cambios en "${editTagName.trim()}".`,
      });
      setEditingTagId(null);
    } catch (error: any) {
      toast({
        title: 'Error al editar etiqueta',
        description: error?.message || 'No se pudo actualizar la etiqueta.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!firestore || !tagToDelete) return;
    const target = tagToDelete;
    setTagToDelete(null);
    try {
      await deleteDoc(doc(firestore, 'crm_tags', target.id));
      toast({
        title: 'Etiqueta eliminada',
        description: `Se eliminó la etiqueta "${target.name}".`,
      });
    } catch (error: any) {
      toast({
        title: 'Error al eliminar etiqueta',
        description: error?.message || 'No se pudo eliminar la etiqueta.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="border-b border-border pb-5">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5">
          <TagIcon className="w-5 h-5 text-primary" />
          Etiquetas del CRM
        </h2>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          Clasifica conversaciones y contactos con contraste WCAG AAA en modo claro y oscuro.
        </p>
      </div>

      {/* Crear Nueva Etiqueta */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-2xs">
        <h3 className="font-semibold text-foreground mb-4">Crear Nueva Etiqueta</h3>
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <input
            type="text"
            placeholder="Nombre de la etiqueta..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            className="flex-1 px-4 py-2 rounded-xl border border-input bg-background text-foreground text-[16px] sm:text-sm"
          />
          <div className="grid grid-cols-9 gap-2 items-center w-fit">
            {CRM_TAG_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.hue}
                type="button"
                onClick={() => setNewTagColor(opt.badgeClass)}
                className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                  resolveTagColorClass(newTagColor) === opt.badgeClass
                    ? 'border-foreground scale-110 shadow-xs'
                    : 'border-transparent hover:scale-110'
                } ${opt.dotClass}`}
                title={opt.label}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddTag}
            disabled={!newTagName.trim() || isSubmitting}
            className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Añadir
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          Vista previa:
          <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border ${resolveTagColorClass(newTagColor)}`}>
            <span className={`w-2 h-2 rounded-full mr-2 ${resolveTagDotClass(newTagColor)}`} />
            {newTagName || 'Nombre de etiqueta'}
          </span>
        </div>
      </div>

      {/* Edición Inline */}
      {editingTagId && (
        <div className="bg-card p-5 rounded-2xl border border-primary/50 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Editar Etiqueta</h4>
            <button type="button" onClick={() => setEditingTagId(null)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <input
              type="text"
              value={editTagName}
              onChange={(e) => setEditTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              className="flex-1 w-full px-3.5 py-2 rounded-xl border border-input bg-background text-foreground text-[16px] sm:text-sm"
            />
            <div className="grid grid-cols-9 gap-1.5 items-center w-fit">
              {CRM_TAG_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.hue}
                  type="button"
                  onClick={() => setEditTagColor(opt.badgeClass)}
                  className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${
                    resolveTagColorClass(editTagColor) === opt.badgeClass
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-110'
                  } ${opt.dotClass}`}
                  title={opt.label}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={!editTagName.trim() || isSavingEdit}
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {isSavingEdit ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Catálogo de Etiquetas */}
      <div className="flex flex-wrap gap-3">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${resolveTagColorClass(tag.color)}`}
          >
            <span className={`w-2 h-2 rounded-full mr-2 ${resolveTagDotClass(tag.color)}`} />
            <span>{tag.name}</span>
            <button
              type="button"
              onClick={() => startEditingTag(tag)}
              className="ml-2 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
              title="Editar etiqueta"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setTagToDelete(tag)}
              className="ml-0.5 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
              title="Eliminar etiqueta"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <AlertDialog open={Boolean(tagToDelete)} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar etiqueta &ldquo;{tagToDelete?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la etiqueta del catálogo del CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Eliminar etiqueta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

### 8.2 Llavero Criptográfico Rotativo (`AES-256-GCM`) y Firma HMAC para Puente Multimedia (`src/lib/utils/crm-crypto.ts`)
Permite rotar `CRM_VAULT_MASTER_KEY` / `CRM_MASTER_KEY` sin dejar inaccesibles los secretos previamente cifrados en Firestore (`enc:v1:<ivHex>:<tagHex>:<cipherHex>`), y firma URLs temporales para el puente WebP→JPEG:

```typescript
// src/lib/utils/crm-crypto.ts
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ENCRYPTION_PREFIX = 'enc:v1:';

function derive256BitKey(secret: string): Buffer {
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex');
  return createHash('sha256').update(trimmed, 'utf8').digest();
}

function getCandidateKeyring(): Buffer[] {
  const candidates = [
    process.env.CRM_VAULT_MASTER_KEY,
    process.env.CRM_MASTER_KEY,
    process.env.CRM_CRON_SECRET,
    process.env.DUALHOOK_WEBHOOK_SECRET,
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  ];
  const seen = new Set<string>();
  const keys: Buffer[] = [];
  for (const raw of candidates) {
    if (!raw || !raw.trim()) continue;
    const k = derive256BitKey(raw);
    const hex = k.toString('hex');
    if (!seen.has(hex)) {
      seen.add(hex);
      keys.push(k);
    }
  }
  return keys;
}

export function encryptCrmSecret(plaintext: string): string {
  if (!plaintext) return '';
  if (plaintext.startsWith(ENCRYPTION_PREFIX)) return plaintext;
  const [primaryKey] = getCandidateKeyring();
  if (!primaryKey) throw new Error('CRM_VAULT_MASTER_KEY is required to encrypt secrets.');

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', primaryKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptCrmSecret(storedValue?: string | null): string {
  if (!storedValue) return '';
  const trimmed = storedValue.trim();
  if (!trimmed.startsWith(ENCRYPTION_PREFIX)) return trimmed;

  const parts = trimmed.slice(ENCRYPTION_PREFIX.length).split(':');
  if (parts.length !== 3) return '';
  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(cipherHex, 'hex');

  for (const key of getCandidateKeyring()) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      // Probar siguiente llave del llavero si hubo rotación de env vars
    }
  }
  return '';
}

export function signMediaBridgeToken(
  storagePath: string,
  ttlSeconds = 600
): { exp: number; sig: string } {
  const [primaryKey] = getCandidateKeyring();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac('sha256', primaryKey)
    .update(`wa-jpeg:${storagePath}:${exp}`, 'utf8')
    .digest('hex');
  return { exp, sig };
}

export function verifyMediaBridgeToken(
  storagePath: string,
  expRaw: string | number | null | undefined,
  sigRaw: string | null | undefined
): boolean {
  if (!storagePath || !expRaw || !sigRaw) return false;
  const exp = typeof expRaw === 'number' ? expRaw : Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  let actualBuf: Buffer;
  try {
    actualBuf = Buffer.from(String(sigRaw), 'hex');
  } catch {
    return false;
  }
  for (const key of getCandidateKeyring()) {
    const expectedHex = createHmac('sha256', key)
      .update(`wa-jpeg:${storagePath}:${exp}`, 'utf8')
      .digest('hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (actualBuf.length === expectedBuf.length && timingSafeEqual(actualBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}
```

### 8.3 Seguridad Anti-SSRF y Puente Dinámico WebP → JPEG para WhatsApp (`src/lib/utils/crm-media-security.ts` + `/api/crm/media/whatsapp-jpeg/route.ts`)
Como Meta Cloud API rechaza `image/webp` en `type: "image"` con error `131053`, todas las imágenes se almacenan en Firebase Storage como `.webp` (`~60%` de ahorro) y `dualhook-client.ts` las entrega a Meta a través del endpoint firmado `/api/crm/media/whatsapp-jpeg`:

```typescript
// src/lib/utils/crm-media-security.ts
const TRUSTED_WHATSAPP_MEDIA_HOST_SUFFIXES = [
  '.fbsbx.com',
  '.fbcdn.net',
  '.whatsapp.net',
  '.facebook.com',
  '.dualhook.com',
];

export function isTrustedWhatsappMediaUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':')) {
      return false;
    }
    return TRUSTED_WHATSAPP_MEDIA_HOST_SUFFIXES.some(
      (suffix) => host === suffix.slice(1) || host.endsWith(suffix)
    );
  } catch {
    return false;
  }
}

export function isAllowedWebpBridgeStoragePath(storagePath: string): boolean {
  if (!storagePath) return false;
  const clean = storagePath.trim();
  if (clean.includes('..') || clean.startsWith('/') || clean.includes('\\')) return false;
  const hasAllowedPrefix =
    clean.startsWith('crm_media/') ||
    clean.startsWith('crm_marketing/') ||
    clean.startsWith('marketing/') ||
    clean.startsWith('catalog/');
  return hasAllowedPrefix && /\.webp$/i.test(clean);
}

export function extractWebpStoragePathFromFirebaseUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.hostname === 'firebasestorage.googleapis.com') {
      const match = u.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)$/);
      if (!match?.[1]) return null;
      const decoded = decodeURIComponent(match[1]);
      return isAllowedWebpBridgeStoragePath(decoded) ? decoded : null;
    }
    if (u.hostname === 'storage.googleapis.com') {
      const parts = u.pathname.replace(/^\/+/, '').split('/');
      if (parts.length < 2) return null;
      const decoded = decodeURIComponent(parts.slice(1).join('/'));
      return isAllowedWebpBridgeStoragePath(decoded) ? decoded : null;
    }
    return null;
  } catch {
    return null;
  }
}
```

```typescript
// src/app/api/crm/media/whatsapp-jpeg/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { verifyMediaBridgeToken } from '@/lib/utils/crm-crypto';
import { isAllowedWebpBridgeStoragePath } from '@/lib/utils/crm-media-security';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const storagePath = searchParams.get('path') || '';
  const exp = searchParams.get('exp');
  const sig = searchParams.get('sig');

  if (!isAllowedWebpBridgeStoragePath(storagePath) || !verifyMediaBridgeToken(storagePath, exp, sig)) {
    return NextResponse.json({ error: 'Invalid or expired media token' }, { status: 403 });
  }

  const bucket = initializeFirebaseAdmin().storage.bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [webpBuffer] = await file.download();
  const jpegBuffer = await sharp(webpBuffer)
    .rotate()
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return new NextResponse(new Uint8Array(jpegBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(jpegBuffer.byteLength),
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  });
}
```


---

## 10. Submódulo 9 de Configuración: Mapeo 1-a-1 de Vendedores POS/ERP (`usePosSellerMapping`) y RBAC Puro Basado en Permisos (`crm.pos`) (`v4.18.3` → `v4.18.9`)

### 10.1 Mapeo 1-a-1 de Usuarios CRM ↔ Vendedores POS/ERP (`src/hooks/crm/use-pos-seller-mapping.ts` + `SettingsPosSellers`)
Cuando el Punto de Venta está activo, este submódulo permite vincular cada cuenta de asesor en Firebase (`users/{uid}`) con su respectivo `sellerId` en el POS o ERP externo (almacenado en `crm_settings/pos_seller_mapping`), incluyendo **Emparejamiento Automático por Similitud de Nombre (`autoMatchUsers`)** y un **Vendedor General de Respaldo (`defaultSellerId`)**:

```typescript
// src/hooks/crm/use-pos-seller-mapping.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { PosSeller } from '@/components/crm/right-panel/pos/pos-types';

export interface PosSellerMappingEntry {
  sellerId: string;
  sellerName: string;
  updatedAtMs: number;
}

export interface PosSellerMappingDoc {
  userMappings: Record<string, PosSellerMappingEntry>; // key = firebase uid
  defaultSellerId?: string | null;
  defaultSellerName?: string | null;
}

function normalizeNameForMatch(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function usePosSellerMapping() {
  const firestore = useFirestore();
  const [mappingDoc, setMappingDoc] = useState<PosSellerMappingDoc>({
    userMappings: {},
    defaultSellerId: null,
    defaultSellerName: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!firestore) return;
    const ref = doc(firestore, 'crm_settings', 'pos_seller_mapping');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setMappingDoc({
            userMappings: data?.userMappings || {},
            defaultSellerId: data?.defaultSellerId || null,
            defaultSellerName: data?.defaultSellerName || null,
          });
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [firestore]);

  const saveMappings = useCallback(
    async (next: PosSellerMappingDoc) => {
      if (!firestore) return;
      setSaving(true);
      try {
        await setDoc(
          doc(firestore, 'crm_settings', 'pos_seller_mapping'),
          {
            userMappings: next.userMappings,
            defaultSellerId: next.defaultSellerId || null,
            defaultSellerName: next.defaultSellerName || null,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } finally {
        setSaving(false);
      }
    },
    [firestore]
  );

  /**
   * Empareja automáticamente usuarios del CRM con vendedores del POS/ERP comparando
   * tokens normalizados sin tildes (NFD).
   */
  const autoMatchUsers = useCallback(
    (
      crmUsers: Array<{ uid: string; name: string; email?: string }>,
      posSellers: PosSeller[]
    ): Record<string, PosSellerMappingEntry> => {
      const nextMappings: Record<string, PosSellerMappingEntry> = {
        ...mappingDoc.userMappings,
      };
      const activeSellers = posSellers.filter((s) => s.status === 'active');

      for (const user of crmUsers) {
        if (nextMappings[user.uid]?.sellerId) continue;
        const userNorm = normalizeNameForMatch(user.name);
        if (!userNorm) continue;
        const userTokens = userNorm.split(' ').filter((t) => t.length >= 3);

        const match = activeSellers.find((seller) => {
          const sellerNorm = normalizeNameForMatch(seller.name);
          if (sellerNorm === userNorm) return true;
          return userTokens.length > 0 && userTokens.every((t) => sellerNorm.includes(t));
        });

        if (match) {
          nextMappings[user.uid] = {
            sellerId: String(match.id),
            sellerName: match.name,
            updatedAtMs: Date.now(),
          };
        }
      }

      return nextMappings;
    },
    [mappingDoc.userMappings]
  );

  /**
   * Resuelve el sellerId efectivo para un asesor (su mapeo 1-a-1 o el vendedor general de respaldo).
   */
  const resolveSellerForUser = useCallback(
    (uid?: string | null): { sellerId: string | null; isMapped: boolean } => {
      if (uid && mappingDoc.userMappings[uid]?.sellerId) {
        return {
          sellerId: String(mappingDoc.userMappings[uid].sellerId),
          isMapped: true,
        };
      }
      if (mappingDoc.defaultSellerId) {
        return {
          sellerId: String(mappingDoc.defaultSellerId),
          isMapped: false,
        };
      }
      return { sellerId: null, isMapped: false };
    },
    [mappingDoc]
  );

  return {
    mappingDoc,
    loading,
    saving,
    saveMappings,
    autoMatchUsers,
    resolveSellerForUser,
  };
}
```

---

### 10.2 RBAC Puro en 3 Planos con Catálogo Canónico (`CRM_PERMISSIONS`) y Cero Correos o Roles Quemados (`src/lib/constants/crm-permissions.ts` + `src/lib/services/crm-auth-guard.ts`)
Regla inquebrantable de seguridad y portabilidad:
- **Prohibido** quemar listas de correos (`OWNER_EMAILS`) o nombres de roles fijos (`['admin', 'developer', 'vendedor']`) para saltar validaciones en `crm-auth-guard.ts` o `useCrmPermissions`.
- Todo acceso se resuelve en **3 Planos de Autoridad**: (1) `decodedToken.platformDev === true` (Platform Developer / panel `/developer`), (2) `users/{uid}` (`isOwner === true || isAdmin === true`) o `roles/{roleId}.isAdminRole === true` (Client Owner/Admin), y (3) arreglos `allowedModules`, `adminModules` y `crmPermissions` normalizados desde `roles/{roleId}` + `users/{uid}`, acotados por `crm_system/tenant_license.enabledModules`. Contrato completo en [Blueprint 08](./08-rbac-roles-branded-invites-and-licensing.md).

```typescript
// Fragmento canónico en src/lib/constants/crm-permissions.ts (sincronizado con Blueprint 08)
export const CRM_PERMISSIONS = {
  CHATS: 'crm.chats',
  AGENT: 'crm.agent',
  DIRECTORY: 'crm.directory',
  SCHEDULING: 'crm.scheduling',
  POS: 'crm.pos', // Permiso dedicado para abrir y operar el Punto de Venta (POS)
  METRICS: 'crm.metrics',
  METRICS_ADMIN: 'crm.metrics.admin',
  WEB_LEADS: 'crm.webLeads',
  HELP_COPILOT: 'crm.helpCopilot',
  SETTINGS_CREDENTIALS: 'crm.settings.credentials',
  SETTINGS_FISCAL: 'crm.settings.fiscal',
  SETTINGS_GENERAL: 'crm.settings.general',
  SETTINGS_BRANDING: 'crm.settings.branding',
  SETTINGS_BOT: 'crm.settings.bot',
  SETTINGS_ROLES: 'crm.settings.roles',
  SETTINGS_TEMPLATES: 'crm.settings.templates',
  SETTINGS_AUTO_ASSIGN: 'crm.settings.autoAssign',
  SETTINGS_MARKETING: 'crm.settings.marketing',
  SETTINGS_QUICK_REPLIES: 'crm.settings.quickReplies',
  SETTINGS_TAGS: 'crm.settings.tags',
} as const;

const LEGACY_PERMISSION_ALIASES: Record<string, string> = {
  'crm.deliveries': CRM_PERMISSIONS.SCHEDULING,
  'crm.projects': CRM_PERMISSIONS.SCHEDULING,
  'crm.settings.connections': CRM_PERMISSIONS.SETTINGS_CREDENTIALS,
  'crm.settings.automations': CRM_PERMISSIONS.SETTINGS_BOT,
  'crm.settings.team': CRM_PERMISSIONS.SETTINGS_ROLES,
};

export function normalizeCrmPermissionKey(raw: string): string {
  return LEGACY_PERMISSION_ALIASES[raw] || raw;
}
```

```typescript
// Evaluación pura en src/lib/services/crm-auth-guard.ts (Sin OWNER_EMAILS ni strings de roles quemados)
const isPlatformDev = decodedToken.platformDev === true;
const isClientAdmin =
  userData.isOwner === true ||
  userData.isAdmin === true;

const roleId = typeof userData.role === 'string' ? userData.role.trim() : '';
const roleSnap = roleId ? await firestore.collection('roles').doc(roleId).get() : null;
const roleData = roleSnap?.exists ? roleSnap.data() || {} : {};
const hasAdminRoleDoc = roleData.isAdminRole === true;

if (isPlatformDev || isClientAdmin || hasAdminRoleDoc) {
  return {
    ok: true,
    uid,
    email,
    isAdmin: true,
    isPlatformDev,
    authTimeSeconds: Number(decodedToken.auth_time || 0),
  };
}

const userPerms = userData.permissions || {};
const adminModules: string[] = [
  ...(Array.isArray(userPerms.adminModules) ? userPerms.adminModules : []),
  ...(Array.isArray(roleData.adminModules) ? roleData.adminModules : []),
];
const allowedModules: string[] = [
  ...(Array.isArray(userPerms.allowedModules) ? userPerms.allowedModules : []),
  ...(Array.isArray(roleData.allowedModules) ? roleData.allowedModules : []),
];

const isCrmModuleAdmin = adminModules.includes('crm');
const hasCrmModuleAccess = isCrmModuleAdmin || allowedModules.includes('crm');
```
