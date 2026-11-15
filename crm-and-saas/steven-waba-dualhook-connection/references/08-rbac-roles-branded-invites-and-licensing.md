# Blueprint 08 — RBAC en 3 Planos, Constructor Dinámico de Roles, Invitaciones Branded por Subdominio y Panel `/developer` de Licencias

> **Lectura Obligatoria**: Todo agente que construya o audite roles, invitaciones de equipo, licenciamiento de módulos o suscripciones DEBE aplicar este contrato unificado sin correos personales ni roles quemados.

---

## 1. Arquitectura de 3 Planos de Autoridad (Sin Colisiones)

| Plano | Quién Pertenece | Identificación Canónica | Alcance Máximo |
| :--- | :--- | :--- | :--- |
| **Plano 1: Platform Developer** | Tú y tu socio (agencia dueña del software) | Firebase Custom Claim `request.auth.token.platformDev === true` (asignado vía Admin SDK al provisionar). | Activa/desactiva módulos en `crm_system/tenant_license`, cambia `subscriptionStatus`, publica avisos globales. |
| **Plano 2: Client Owner / Admin** | Dueño o Gerente de la empresa cliente | `users/{uid}.isOwner === true \|\| isAdmin === true` o rol con `isAdminRole === true`. | Crea roles dinámicos, invita miembros, edita marca/colores, gestiona Bóveda. **Nunca puede habilitar módulos no licenciados.** |
| **Plano 3: Roles Dinámicos** | Asesores, Supervisores, Logística, etc. | Documento `roles/{roleId}` creado desde UI. | Evalúa `permissions[]` y `allowedModules[]` acotado siempre por `isModuleLicensed()`. |

---

## 2. Catálogo Único Canónico de Permisos (`CRM_PERMISSIONS`)

Resuelve el drift histórico unificando todas las claves con compatibilidad hacia atrás (`normalizeCrmPermissionKey`):

```typescript
// src/lib/constants/crm-permissions.ts
export const CRM_PERMISSIONS = {
  CHATS: 'crm.chats',
  AGENT: 'crm.agent',
  DIRECTORY: 'crm.directory',
  SCHEDULING: 'crm.scheduling',
  POS: 'crm.pos',
  CATALOG: 'crm.catalog',
  CATALOG_ADMIN: 'crm.catalog.admin',
  PRICING: 'crm.pricing',
  PRICING_ADMIN: 'crm.pricing.admin',
  B2B: 'crm.b2b',
  B2B_ADMIN: 'crm.b2b.admin',
  PAYMENTS: 'crm.payments',
  CASH: 'crm.cash',
  CASH_ADMIN: 'crm.cash.admin',
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

export type CrmPermission = (typeof CRM_PERMISSIONS)[keyof typeof CRM_PERMISSIONS];

const LEGACY_PERMISSION_ALIASES: Record<string, CrmPermission> = {
  'crm.deliveries': CRM_PERMISSIONS.SCHEDULING,
  'crm.projects': CRM_PERMISSIONS.SCHEDULING,
  'crm.settings.connections': CRM_PERMISSIONS.SETTINGS_CREDENTIALS,
  'crm.settings.automations': CRM_PERMISSIONS.SETTINGS_BOT,
  'crm.settings.team': CRM_PERMISSIONS.SETTINGS_ROLES,
};

export function normalizeCrmPermissionKey(raw: string): CrmPermission | string {
  return LEGACY_PERMISSION_ALIASES[raw] || raw;
}
```

---

## 3. Constructor Dinámico de Roles (`SettingsRolesBuilder` → `roles/{roleId}`)

```typescript
// src/lib/types/crm-roles.ts
export interface CrmRoleDefinition {
  id: string;
  name: string;
  description: string;
  colorHue: string;
  isAdminRole: boolean;
  isSystemDefault?: boolean;
  allowedModules: string[];
  adminModules: string[];
  crmPermissions: string[];
  updatedAt: any;
}
```

Reglas en UI (`SettingsRolesBuilder.tsx`):
- Lista los roles desde `roles/*`, permitiendo crear, clonar y editar permisos por categoría.
- Oculta automáticamente los checkboxes de permisos pertenecientes a módulos apagados en `crm_system/tenant_license` (ej. si `pos: false`, no muestra `crm.pos`).
- Bloquea la eliminación si `isSystemDefault === true` o si existen usuarios asignados al rol.

---

## 4. Invitaciones Corporativas por Correo con Subdominio (`crm_invitations` + `/accept-invite`)

### A. Envío de Invitación (`POST /api/crm/admin/invitations`)
1. Valida `verifyCrmRequestAuth(req, 'crm.settings.roles')` y verifica `activeUsersCount < license.maxSeats`.
2. Genera `rawToken = crypto.randomBytes(32).toString('base64url')` y guarda **únicamente** `tokenHash = sha256(rawToken)` en `crm_invitations/{id}` con `expiresAtMs = Date.now() + 72 * 3600 * 1000`.
3. Construye HTML ejecutivo corporativo (usando `crm_settings/branding.logoUrl`, `businessName`, `primaryHex` y `roleName`, con asunto `"${inviterName} te invitó a unirte a ${businessName} como ${roleName}"`).
4. Envía mediante la tarjeta **`transactionalEmail`** de la Bóveda Write-Only (Resend / Postmark):
   - **Modo Subdominio Agencia (Default):** `from: "${businessName} <notificaciones@mail.${agencyDomain}>"` con `reply_to: caller.email` (`0` pasos DNS por cliente).
   - **Modo Subdominio Cliente (White-Label):** `from: "${businessName} <notificaciones@notify.${clientDomain}>"` con verificación DNS (`SPF` / `DKIM` / `DMARC`) vía Resend Domains API (`POST https://api.resend.com/domains`).

### B. Aceptación (`/accept-invite` → `POST /api/crm/invitations/accept`)
- Verifica `tokenHash` con `crypto.timingSafeEqual`, vigencia `< 72h` y `status === 'pending'`.
- Permite unirse con **Google Sign-In** (verificando coincidencia de correo) o creando contraseña vía Firebase Admin (`emailVerified: true`).
- En transacción atómica crea `users/{uid}` con el `roleId` asignado y marca `status: 'accepted'`.

---

## 5. Módulo `/developer`, Licencias (`crm_system/tenant_license`) y Suscripciones

```typescript
// src/lib/types/crm-licensing.ts
export interface CrmTenantLicense {
  planTier: 'starter' | 'pro' | 'enterprise' | 'custom';
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'suspended';
  billingPortalUrl?: string;
  maxSeats: number;
  enabledModules: {
    core: boolean;
    whatsapp: boolean;
    meta_social: boolean;
    ai_agent: boolean;
    pos: boolean;
    hacienda_cr: boolean;
    scheduling: boolean;           // Entregas locales, visitas técnicas, proyectos y garantías (Blueprint 12)
    catalog_master: boolean;       // Catálogo Maestro + Plantillas Excel + Edición Masiva (Blueprint 13)
    web_catalog: boolean;          // Exposición en Página Web + Ofertas + Revalidación (Blueprint 13)
    pricing_approvals: boolean;    // Escalas B2C + Aprobaciones Gerenciales + Campana Push (Blueprint 14)
    b2b_wholesale_portal: boolean; // Distribuidores B2B + Portal Mayorista Autoservicio (Blueprint 14)
    web_leads: boolean;            // Bandeja de Prospectos Web B2B/B2C (Blueprint 14)
    cash_reconciliation: boolean;  // Links de Pago + Caja Bimoneda + Conciliación Transferencias (Blueprint 14)
    analytics_pro: boolean;
    help_copilot: boolean;
  };
  updatedAt?: any;
}
```

### Rutas Protegidas y Webhook de Pagos
1. **`POST /api/crm/developer/license`**: Verifica estrictamente `decodedToken.platformDev === true`. Permite a ti y tu socio prender/apagar cualquier módulo o cambiar `subscriptionStatus` en vivo desde `/developer`.
2. **`POST /api/crm/system/license-webhook`**: Endpoint HMAC-SHA256 (*fail-closed* si falta `CRM_LICENSE_WEBHOOK_SECRET`) compatible con **Stripe**, **Tilopay**, **Paddle** o tu **HQ Admin** para automatizar activaciones y suspensiones al procesar un cobro.
3. **Resiliencia ante Falta de Pago:**
   - `past_due`: Banner ámbar no bloqueante con link de pago.
   - `suspended`: `<SubscriptionSuspendedGate />` detiene el acceso operativo sin borrar datos del cliente (`platformDev` sigue teniendo acceso administrativo).
