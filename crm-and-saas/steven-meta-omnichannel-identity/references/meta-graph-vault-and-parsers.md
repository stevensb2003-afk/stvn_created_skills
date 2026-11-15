# Meta Graph v25.0 (Messenger + Instagram Direct): Bóveda Frontend, Auto-Discovery y Parsers

> **Cero Intermediarios de Pago para IG y Messenger:** A diferencia de WhatsApp (donde Dualhook habilita la Coexistencia móvil), **Instagram Direct** y **Facebook Messenger** soportan coexistencia móvil + Business Suite + CRM de forma nativa directamente sobre `https://graph.facebook.com/v25.0`.

---

## 1. Guía Reproducible por Cliente: Cómo Obtener las Llaves en Meta (Paso a Paso)

Entrega estos 4 pasos claros a tu cliente (o configúralos con él en una llamada de 10 minutos):

### Paso 1: Vincular Instagram y Encender el Interruptor Crítico en el Celular
1. La cuenta de Instagram debe ser **Profesional (Empresa o Creador)** y estar vinculada a la Página de Facebook dentro del mismo **Meta Business Portfolio**.
2. **Interruptor Obligatorio en la App Móvil de Instagram (si está apagado, no llega ningún mensaje):**
   - Abrir Instagram → Menú `☰` → **Configuración y actividad** → **Mensajes y respuestas a historias** → **Controles de mensajes**.
   - En **Herramientas conectadas**, encender **"Permitir acceso a los mensajes"**.

### Paso 2: Crear App Única de Negocios en Meta for Developers
1. Ir a `https://developers.facebook.com/apps` → **Crear app** → Caso de uso **Otro** → Tipo **Negocios**.
2. En **Configuración de la app → Básica**: copiar el **`App Secret`** (Clave secreta de la aplicación).
3. Agregar los productos **Messenger** e **Instagram**.

### Paso 3: Generar el Token Sin Caducidad (`System User Token`)
1. Ir a **Configuración del Negocio (`business.facebook.com/settings/system-users`)** → **Usuarios del sistema** → Agregar (Rol: **Administrador**).
2. En **Asignar activos**: darle Control Total sobre la **Página de Facebook**, la **Cuenta de Instagram** y la **App de Meta**.
3. Pulsar **Generar nuevo token** → Caducidad: **`Nunca`** → Marcar estos **8 permisos**:
   - `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `pages_manage_engagement`, `pages_show_list`
   - `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`

### Paso 4: Pegar en la Bóveda Frontend (1-Token Auto-Discovery)
El administrador del cliente entra a **Configuración → Conexiones y APIs → Tarjeta Meta Social (IG & FB)** y pega únicamente:
1. **`Meta App Secret`**
2. **`System User Token`** (temporal en memoria para autodescubrir)

---

## 2. Endpoint 1-Token Auto-Discovery & Auto-Suscripción (`POST /api/crm/admin/meta-social/discover`)

Este endpoint evita que el usuario tenga que usar `curl` o buscar IDs numéricos manualmente. Recibe `appSecret` y `systemUserToken` (o selecciona una página descubierta), deriva el **Page Access Token perpetuo**, extrae `pageId` e `igAccountId`, cifra todo en la Bóveda Write-Only (`crm_secrets/integrations`) y suscribe los webhooks de la Página automáticamente:

```typescript
// src/app/api/crm/admin/meta-social/discover/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyCrmRequestAuth } from '@/lib/services/crm-auth-guard';
import {
  saveMetaSocialVaultCredentials,
} from '@/lib/services/crm-credentials-vault';

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyCrmRequestAuth(req, 'crm.settings.credentials');
    if (Date.now() / 1000 - caller.authTimeSeconds > 900) {
      return NextResponse.json({ error: 'Sesión reciente requerida (< 15 min). Reautentícate.' }, { status: 401 });
    }

    const body = await req.json();
    const appSecret = String(body.appSecret || '').trim();
    const systemUserToken = String(body.systemUserToken || '').trim();
    const selectedPageId = String(body.selectedPageId || '').trim();

    if (!appSecret || !systemUserToken) {
      return NextResponse.json({ error: 'App Secret y System User Token son obligatorios.' }, { status: 400 });
    }

    // 1. Autodescubrir Páginas de Facebook y cuentas de Instagram Business vinculadas
    const url = `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(systemUserToken)}`;
    const fbRes = await fetch(url);
    const fbJson = await fbRes.json();

    if (!fbRes.ok || !Array.isArray(fbJson.data)) {
      return NextResponse.json(
        { error: fbJson?.error?.message || 'No se pudieron listar las páginas de Meta.' },
        { status: 400 }
      );
    }

    const pages = fbJson.data.map((p: any) => ({
      pageId: String(p.id),
      pageName: String(p.name),
      pageAccessToken: String(p.access_token || ''),
      igAccountId: p.instagram_business_account?.id ? String(p.instagram_business_account.id) : null,
      igUsername: p.instagram_business_account?.username ? String(p.instagram_business_account.username) : null,
    }));

    // Si hay varias páginas y no eligió una aún, devolver lista segura (sin exponer tokens)
    const chosen = selectedPageId
      ? pages.find((p: any) => p.pageId === selectedPageId)
      : pages.length === 1
        ? pages[0]
        : null;

    if (!chosen) {
      return NextResponse.json({
        requiresSelection: true,
        pages: pages.map(({ pageAccessToken: _omit, ...safe }) => safe),
      });
    }

    // 2. Suscribir automáticamente los webhooks de la Página de Facebook (Messenger + Feed)
    const subRes = await fetch(
      `https://graph.facebook.com/v25.0/${chosen.pageId}/subscribed_apps`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscribed_fields: [
            'messages',
            'messaging_postbacks',
            'message_echoes',
            'message_deliveries',
            'message_reads',
            'message_reactions',
            'feed',
          ],
          access_token: chosen.pageAccessToken,
        }),
      }
    );

    if (!subRes.ok) {
      const errText = await subRes.text();
      return NextResponse.json({ error: `Falló suscripción de webhooks en Meta: ${errText}` }, { status: 400 });
    }

    // 3. Guardar cifrado con AES-256-GCM + AAD=tenantId en la Bóveda Write-Only
    await saveMetaSocialVaultCredentials(caller.tenantId, {
      appSecret,
      pageAccessToken: chosen.pageAccessToken,
      pageId: chosen.pageId,
      pageName: chosen.pageName,
      igAccountId: chosen.igAccountId || '',
      igUsername: chosen.igUsername || '',
    });

    return NextResponse.json({
      ok: true,
      pageId: chosen.pageId,
      pageName: chosen.pageName,
      igAccountId: chosen.igAccountId,
      igUsername: chosen.igUsername,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error en descubrimiento Meta' }, { status: err.statusCode || 500 });
  }
}
```

---

## 3. Enrutamiento del Webhook Unificado & Firma `X-Hub-Signature-256`

En `POST /api/crm/webhook` (y `/webhook/[tenantId]`):
1. Leer `rawBody = await req.text()` antes de `JSON.parse`.
2. Si `body.object === 'whatsapp_business_account'` → validar firma contra `creds.dualhook.webhookSecret` y ejecutar parser WhatsApp.
3. Si `body.object === 'instagram' || body.object === 'page'` → validar firma `x-hub-signature-256` contra `creds.metaSocial.appSecret` usando `crypto.timingSafeEqual`, y procesar cada `entry[].messaging[]`:
   - `message.is_echo === true`: guardar como `direction: 'outbound'`, `senderType: 'mobile'`, activar `humanTookOver: true`.
   - `message.reply_to?.story`: guardar `storyContext` (URL de la historia e ID) para previsualizar en la burbuja del CRM.
   - `message.attachments[]`: soportar `story_mention`, `image`, `video`, `audio`, `file`. Descargar con la URL firmada de Meta y comprimir fotos a `.webp` en Storage.
   - `referral.ad_id`: registrar atribución publicitaria en `crm_settings/meta_campaigns`.

---

## 4. Cliente Saliente Meta Social (`src/lib/services/meta-social-client.ts`)

```typescript
import { resolveCrmIntegrations } from '@/lib/services/crm-credentials-vault';
import { buildSignedWhatsappJpegUrl } from '@/lib/services/crm-crypto';

export type SocialChannelSource = 'instagram' | 'facebook';

export async function sendMetaSocialMessage(params: {
  tenantId?: string;
  source: SocialChannelSource;
  recipientScopedId: string; // IGSID o PSID
  text?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  storagePath?: string;
  externalMediaUrl?: string;
  lastInboundAtMs?: number;
}) {
  const { metaSocial } = await resolveCrmIntegrations(params.tenantId || 'default');
  if (!metaSocial?.pageAccessToken || !metaSocial?.pageId) {
    throw new Error('Credenciales de Meta Social (IG/FB) no configuradas en la Bóveda.');
  }

  // Ventana Meta: 0-24h RESPONSE; 24h-7d aplica tag HUMAN_AGENT
  const elapsedMs = params.lastInboundAtMs ? Date.now() - params.lastInboundAtMs : 0;
  const useHumanAgentTag = elapsedMs > 24 * 3600 * 1000 && elapsedMs <= 7 * 24 * 3600 * 1000;

  let messagePayload: Record<string, any>;
  if (params.mediaType && (params.storagePath || params.externalMediaUrl)) {
    const mediaUrl =
      params.mediaType === 'image' && params.storagePath?.endsWith('.webp')
        ? buildSignedWhatsappJpegUrl(params.storagePath, params.tenantId || 'default')
        : params.externalMediaUrl || '';
    messagePayload = {
      attachment: {
        type: params.mediaType,
        payload: { url: mediaUrl, is_reusable: true },
      },
    };
  } else {
    messagePayload = { text: params.text || '' };
  }

  const body: Record<string, any> = {
    recipient: { id: params.recipientScopedId },
    messaging_type: useHumanAgentTag ? 'MESSAGE_TAG' : 'RESPONSE',
    ...(useHumanAgentTag ? { tag: 'HUMAN_AGENT' } : {}),
    message: messagePayload,
  };

  const endpoint =
    params.source === 'instagram' && metaSocial.igAccountId
      ? `https://graph.facebook.com/v25.0/${metaSocial.igAccountId}/messages`
      : `https://graph.facebook.com/v25.0/${metaSocial.pageId}/messages`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${metaSocial.pageAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Meta Social Send Error (${res.status}): ${json?.error?.message || 'Error desconocido'}`);
  }
  return { messageId: json.message_id || '', recipientId: json.recipient_id || params.recipientScopedId };
}
```
