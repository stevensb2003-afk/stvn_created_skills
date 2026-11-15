# RBAC de 3 Planos, Constructor de Roles y Panel `/developer` de Licencias/Suscripciones

Este manual elimina por completo los correos quemados en código y la mezcla entre administradores del cliente y los dueños de la plataforma (tú y tu socio).

---

## 1. Arquitectura de 3 Planos de Autoridad

| Plano | Quién es | Cómo se identifica (Sin Hardcodes) | Qué puede hacer |
| :--- | :--- | :--- | :--- |
| **Plano 1: Platform Developer** | **Tú y tu socio** | Firebase Custom Claim `platformDev: true` (asignado vía Admin SDK al provisionar). | Encender/apagar módulos pagos en `tenant_license`, cambiar estado de suscripción (`active`/`suspended`), publicar avisos globales. **Nunca se confunde con roles del cliente.** |
| **Plano 2: Client Owner / Admin** | Dueño o Gerente de la empresa cliente | `users/{uid}.isOwner == true \|\| isAdmin == true` o rol con `isAdminRole == true`. | Crear roles dinámicos, invitar empleados, cambiar logo/colores, configurar llaves en Bóveda. **NO puede activar módulos no pagados.** |
| **Plano 3: Roles Dinámicos** | Vendedor, Logística, Supervisor, etc. | Documento `roles/{roleId}` creado desde el Frontend. | Solo lo que su arreglo `permissions[]` + `allowedModules[]` permita, siempre filtrado por `isModuleLicensed(mod)`. |

---

## 2. Constructor Dinámico de Roles (`roles/{roleId}`)

### Esquema del Documento
```typescript
// src/lib/types/roles.ts
export interface DynamicRoleDoc {
  id: string;
  name: string;               // Ej: "Ejecutivo de Ventas", "Despacho", "Supervisor"
  description: string;
  colorHue: string;           // Para badge visual en tabla de equipo
  isAdminRole: boolean;       // Si true, administra la configuración del cliente (nunca PlatformDev)
  isSystemDefault?: boolean;  // true en roles semilla; impide borrado accidental
  allowedModules: string[];   // Ej: ['crm', 'pos', 'scheduling']
  adminModules: string[];     // Ej: ['crm']
  permissions: string[];      // Permisos granulares exactos (ej: ['crm.chats', 'crm.pos', 'crm.directory'])
  createdAt: any;
  updatedAt: any;
}
```

### Reglas del UI (`SettingsRolesBuilder.tsx`)
1. Listar roles existentes mostrando cuántos usuarios activos pertenecen a cada uno (`userCount`).
2. Botón **"+ Nuevo Rol"** o **"Duplicar Rol"**: abre formulario con nombre, descripción, switch `Es Administrador de Espacio` y matriz agrupada de switches por módulo (*Mensajería*, *Directorio*, *Punto de Venta*, *Agenda*, *Métricas*, *Configuración*).
3. **Solo mostrar en la matriz módulos que el cliente tenga encendidos en `tenant_license`**.
4. **Protección al borrar:** Bloquear eliminación si `isSystemDefault === true` o si existe al menos 1 usuario activo con `user.role === roleId` (pedir reasignar usuarios primero).

---

## 3. Panel `/developer` y Contrato `crm_system/tenant_license`

```typescript
// src/lib/types/licensing.ts
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'suspended';

export interface TenantLicenseDoc {
  planTier: 'starter' | 'pro' | 'enterprise' | 'custom';
  subscriptionStatus: SubscriptionStatus;
  billingCycle: 'monthly' | 'annual' | 'lifetime';
  currentPeriodEndMs?: number | null;
  billingPortalUrl?: string;       // Link de Stripe / Tilopay para que el cliente pague
  graceMessage?: string;
  maxSeats: number;
  enabledModules: {
    core: boolean;                 // Bandeja + Contactos + Etiquetas
    whatsapp: boolean;
    meta_social: boolean;          // Instagram Direct + Messenger
    ai_agent: boolean;             // Bot de Ventas IA
    pos: boolean;                  // Punto de Venta
    scheduling: boolean;           // Agenda / Entregas
    analytics_pro: boolean;        // Métricas + ROI Meta Ads
    help_copilot: boolean;         // Copiloto IA de Ayuda Interna
  };
  updatedByUid?: string;
  updatedAt?: any;
}
```

### Endpoint Seguro para Actualizar Licencia (`POST /api/system/developer/license`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/firebase/server';

export async function POST(req: NextRequest) {
  const { auth, firestore } = initializeFirebaseAdmin();
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 });

  const decoded = await auth.verifyIdToken(token);
  if (decoded.platformDev !== true) {
    return NextResponse.json({ error: 'Exclusivo Platform Developer' }, { status: 403 });
  }

  const body = await req.json();
  await firestore.doc('crm_system/tenant_license').set(
    {
      planTier: body.planTier || 'pro',
      subscriptionStatus: body.subscriptionStatus || 'active',
      maxSeats: Number(body.maxSeats) > 0 ? Number(body.maxSeats) : 10,
      billingPortalUrl: body.billingPortalUrl || null,
      enabledModules: body.enabledModules || {},
      updatedByUid: decoded.uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
```

---

## 4. Manejo de Suscripciones (Etapa 1 Manual Remoto → Etapa 2 Webhook Automático)

### Comportamiento en UI según `subscriptionStatus`
- **`active` / `trialing`**: Operación 100% normal.
- **`past_due`**: Banner superior no bloqueante en ámbar: *"Tu suscripción presenta un pago pendiente. Regularízala para evitar interrupciones."* + botón hacia `billingPortalUrl`.
- **`suspended`**: `<SubscriptionSuspendedGate />` bloquea el acceso operativo de los usuarios del cliente mostrando estado amigable con botón de pago/soporte. **Los datos en Firestore permanecen intactos** y los usuarios con `platformDev === true` siguen entrando para administrar.

### Etapa 2: Webhook Automático de Cobro (`POST /api/system/license-webhook`)
Permite que **Stripe**, **Tilopay**, **Paddle** o tu futuro **Panel Central HQ** enciendan/suspendan módulos al instante mediante firma HMAC-SHA256:

```typescript
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/firebase/server';

export async function POST(req: NextRequest) {
  const secret = process.env.LICENSE_WEBHOOK_SECRET || '';
  if (!secret) {
    return NextResponse.json({ error: 'Webhook no configurado (fail-closed)' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-license-signature') || '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const { firestore } = initializeFirebaseAdmin();

  const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
  if (event.subscriptionStatus) patch.subscriptionStatus = event.subscriptionStatus;
  if (event.planTier) patch.planTier = event.planTier;
  if (typeof event.maxSeats === 'number') patch.maxSeats = event.maxSeats;
  if (event.enabledModules && typeof event.enabledModules === 'object') {
    patch.enabledModules = event.enabledModules;
  }

  await firestore.doc('crm_system/tenant_license').set(patch, { merge: true });
  return NextResponse.json({ ok: true, applied: Object.keys(patch) });
}
```

---

## 5. Reglas O(1) en `firestore.rules` (Candado Real en Base de Datos)

```javascript
function isPlatformDeveloper() {
  return request.auth != null &&
         request.auth.token.email_verified == true &&
         request.auth.token.get('platformDev', false) == true;
}

function getLicenseData() {
  return exists(/databases/$(database)/documents/crm_system/tenant_license)
    ? get(/databases/$(database)/documents/crm_system/tenant_license).data
    : { 'subscriptionStatus': 'active', 'enabledModules': {} };
}

function isSubscriptionOperational(licenseDoc) {
  return licenseDoc.get('subscriptionStatus', 'active') in ['active', 'trialing', 'past_due'];
}

function isModuleLicensed(licenseDoc, moduleKey) {
  return isSubscriptionOperational(licenseDoc) &&
         licenseDoc.get('enabledModules', {}).get(moduleKey, false) == true;
}

match /crm_system/tenant_license {
  allow read: if request.auth != null;
  allow write: if isPlatformDeveloper();
}

match /roles/{roleId} {
  allow read: if request.auth != null;
  allow write: if isPlatformDeveloper() || isClientOwnerOrAdmin();
}

match /crm_invitations/{inviteId} {
  allow read: if isPlatformDeveloper() || isClientOwnerOrAdmin();
  allow write: if false; // Exclusivo Admin SDK tras validar maxSeats y tokenHash SHA-256
}
```
