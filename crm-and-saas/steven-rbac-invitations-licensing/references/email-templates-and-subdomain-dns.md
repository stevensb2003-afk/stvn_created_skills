# Invitaciones por Correo con Marca del Cliente y Subdominios (Zero-Placeholder)

Esta guía implementa invitaciones corporativas de equipo seguras (`SHA-256` + expiración `72h`), pantalla pública `/accept-invite` y envío desde subdominio profesional (`notificaciones@mail.<agencia>.com` por defecto o `notify.<cliente>.com` para clientes white-label).

---

## 1. Arquitectura de Subdominios de Correo (2 Modos)

Para evitar que los correos caigan en Spam sin complicar al cliente el Día 1:

| Modo | Remitente (`From`) | Configuración DNS | Cuándo usarlo |
| :--- | :--- | :--- | :--- |
| **Modo 1 — Subdominio de Agencia (Default)** | `"Nombre Empresa Cliente <notificaciones@mail.tuagencia.com>"` + `Reply-To: admin@cliente.com` | **0 DNS para el cliente.** Solo verificas `mail.tuagencia.com` una vez en Resend / Postmark. | Arranque inmediato en 10 segundos al dar de alta clientes. |
| **Modo 2 — Subdominio White-Label del Cliente** | `"Nombre Empresa <notificaciones@notify.cliente.com>"` | El cliente agrega los registros `SPF`, `DKIM` y `DMARC` en su dominio. El backend usa la API de Resend Domains (`POST /domains`) para mostrar los registros exactos y un botón **"Verificar DNS"**. | Clientes corporativos que piden 100% su propio dominio de correo. |

> **Regla de Oro de Seguridad:** La API Key de Resend/Postmark vive cifrada en la tarjeta **`transactionalEmail`** de la Bóveda Write-Only (`crm_secrets/integrations`) con fallback a `process.env.TRANSACTIONAL_EMAIL_API_KEY`. Jamás se expone al navegador.

---

## 2. Esquema de Colección `crm_invitations/{inviteId}`

```typescript
// src/lib/types/invitations.ts
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface CrmInvitationDoc {
  id: string;
  tenantId: string;
  email: string;                 // Normalizado a minúsculas
  inviteeName: string;
  roleId: string;                // Referencia a roles/{roleId}
  roleName: string;
  customPermissions?: string[];  // Opcional si sobrescribe permisos del rol
  tokenHash: string;             // SHA-256 hex del rawToken (jamás guardar rawToken en DB)
  invitedByUid: string;
  invitedByName: string;
  invitedByEmail: string;
  status: InvitationStatus;
  expiresAtMs: number;           // Date.now() + 72 * 3600 * 1000
  acceptedUid?: string;
  acceptedAt?: any;
  createdAt: any;
  updatedAt: any;
}
```

---

## 3. Plantilla HTML Ejecutiva Compatible con Gmail / Outlook (`buildTeamInvitationEmailHtml`)

```typescript
// src/lib/email/invitation-template.ts
export interface InvitationEmailTemplateInput {
  businessName: string;
  logoUrl?: string;
  primaryColorHex?: string; // Ej: '#0EA5E9'
  inviterName: string;
  inviteeName: string;
  roleName: string;
  acceptUrl: string;
  expiresInHours?: number;
  supportEmail?: string;
}

function escapeHtml(raw: string): string {
  return (raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildTeamInvitationEmail(input: InvitationEmailTemplateInput): {
  subject: string;
  html: string;
  text: string;
} {
  const brand = escapeHtml(input.businessName || 'Plataforma CRM');
  const inviter = escapeHtml(input.inviterName || 'Un administrador');
  const invitee = escapeHtml(input.inviteeName || 'hola');
  const role = escapeHtml(input.roleName || 'Colaborador');
  const accent = /^#[0-9a-fA-F]{6}$/.test(input.primaryColorHex || '')
    ? input.primaryColorHex!
    : '#0284C7';
  const hours = input.expiresInHours ?? 72;
  const safeUrl = input.acceptUrl;
  const logoHtml = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${brand}" width="140" style="max-height:44px;width:auto;display:block;border:0;" />`
    : `<span style="font-size:20px;font-weight:700;color:#0F172A;letter-spacing:-0.02em;">${brand}</span>`;

  const subject = `${input.inviterName} te invitó a unirte a ${input.businessName} como ${input.roleName}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F1F5F9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;">
          <tr>
            <td style="height:6px;background-color:${accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 16px 32px;border-bottom:1px solid #F1F5F9;">
              ${logoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 12px 0;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${accent};">
                Invitación de Acceso
              </p>
              <h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.3;font-weight:700;color:#0F172A;">
                Hola ${invitee}, ya tienes acceso a ${brand}
              </h1>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#334155;">
                <strong>${inviter}</strong> te invitó a integrarte al espacio de trabajo de <strong>${brand}</strong> con el rol asignado:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;width:100%;">
                <tr>
                  <td style="padding:14px 18px;">
                    <span style="display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748B;">Rol Asignado</span>
                    <strong style="display:block;margin-top:4px;font-size:15px;color:#0F172A;">${role}</strong>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:${accent};">
                    <a href="${escapeHtml(safeUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">
                      Aceptar Invitación e Ingresar
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px 0;font-size:13px;line-height:1.5;color:#64748B;">
                Por seguridad, este enlace es personal, de un solo uso y caduca automáticamente en <strong>${hours} horas</strong>.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94A3B8;word-break:break-all;">
                Si el botón no abre, copia y pega este enlace:<br />
                <a href="${escapeHtml(safeUrl)}" style="color:${accent};">${escapeHtml(safeUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background-color:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;color:#64748B;">
              Enviado de forma segura por <strong>${brand}</strong>${input.supportEmail ? ` · Soporte: ${escapeHtml(input.supportEmail)}` : ''}.
              Si no esperabas esta invitación, puedes ignorar este correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hola ${input.inviteeName || ''},`,
    ``,
    `${input.inviterName} te invitó a unirte a ${input.businessName} con el rol: ${input.roleName}.`,
    `Acepta tu invitación en el siguiente enlace (válido por ${hours} horas):`,
    safeUrl,
    ``,
    `Si no esperabas este correo, puedes ignorarlo.`,
  ].join('\n');

  return { subject, html, text };
}
```

---

## 4. Endpoints Completos (`POST /api/admin/invitations` y `POST /api/invitations/accept`)

### A. Crear Invitación + Enviar Correo (`src/app/api/admin/invitations/route.ts`)

```typescript
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { verifyCrmRequestAuth } from '@/lib/services/crm-auth-guard';
import { resolveCrmIntegrations } from '@/lib/services/crm-credentials-vault';
import { buildTeamInvitationEmail } from '@/lib/email/invitation-template';

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyCrmRequestAuth(req, 'crm.settings.roles');
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const inviteeName = String(body.inviteeName || '').trim();
    const roleId = String(body.roleId || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Correo electrónico inválido.' }, { status: 400 });
    }
    if (!roleId) {
      return NextResponse.json({ error: 'Debes seleccionar un rol válido.' }, { status: 400 });
    }

    const { firestore } = initializeFirebaseAdmin();

    // 1. Verificar límite de asientos (seats) de la licencia
    const licenseSnap = await firestore.doc('crm_system/tenant_license').get();
    const maxSeats = Number(licenseSnap.data()?.maxSeats || 50);
    const activeUsersSnap = await firestore.collection('users').where('isActive', '!=', false).count().get();
    if (activeUsersSnap.data().count >= maxSeats) {
      return NextResponse.json(
        { error: `Límite de ${maxSeats} usuarios alcanzado en el plan actual.` },
        { status: 402 }
      );
    }

    // 2. Validar existencia del rol dinámico
    const roleSnap = await firestore.doc(`roles/${roleId}`).get();
    if (!roleSnap.exists) {
      return NextResponse.json({ error: 'El rol seleccionado no existe.' }, { status: 404 });
    }
    const roleData = roleSnap.data()!;

    // 3. Generar token criptográfico de 32 bytes (solo el hash SHA-256 se guarda en DB)
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAtMs = Date.now() + 72 * 3600 * 1000;

    // 4. Revocar invitaciones pendientes previas del mismo correo
    const prevSnap = await firestore
      .collection('crm_invitations')
      .where('email', '==', email)
      .where('status', '==', 'pending')
      .get();

    const batch = firestore.batch();
    for (const docSnap of prevSnap.docs) {
      batch.update(docSnap.ref, { status: 'revoked', updatedAt: FieldValue.serverTimestamp() });
    }

    const inviteRef = firestore.collection('crm_invitations').doc();
    batch.set(inviteRef, {
      id: inviteRef.id,
      tenantId: caller.tenantId,
      email,
      inviteeName: inviteeName || email.split('@')[0],
      roleId,
      roleName: roleData.name || roleId,
      customPermissions: Array.isArray(body.customPermissions) ? body.customPermissions : null,
      tokenHash,
      invitedByUid: caller.uid,
      invitedByName: caller.displayName,
      invitedByEmail: caller.email,
      status: 'pending',
      expiresAtMs,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    // 5. Leer branding y enviar vía proveedor transaccional (Resend / Postmark)
    const brandingSnap = await firestore.doc('crm_settings/branding').get();
    const branding = brandingSnap.data() || {};
    const businessName = branding.businessName || 'Mi Empresa';
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const acceptUrl = `${appOrigin}/accept-invite?id=${inviteRef.id}&token=${rawToken}`;

    const emailPayload = buildTeamInvitationEmail({
      businessName,
      logoUrl: branding.logoUrl || '',
      primaryColorHex: branding.primaryHex || '#0284C7',
      inviterName: caller.displayName,
      inviteeName: inviteeName || email.split('@')[0],
      roleName: roleData.name || roleId,
      acceptUrl,
      supportEmail: caller.email,
    });

    const integrations = await resolveCrmIntegrations(caller.tenantId);
    const mailCfg = integrations.transactionalEmail;
    let emailSent = false;

    if (mailCfg?.apiKey && mailCfg?.fromEmail) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mailCfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${businessName} <${mailCfg.fromEmail}>`,
          to: [email],
          reply_to: caller.email,
          subject: emailPayload.subject,
          html: emailPayload.html,
          text: emailPayload.text,
        }),
      });
      emailSent = resendRes.ok;
    }

    return NextResponse.json({
      ok: true,
      invitationId: inviteRef.id,
      emailSent,
      // Si aún no configuran Resend, devolver acceptUrl solo una vez al admin que la creó
      manualFallbackUrl: emailSent ? undefined : acceptUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al invitar' }, { status: err.statusCode || 500 });
  }
}
```

### B. Aceptar Invitación (`src/app/api/invitations/accept/route.ts`)

1. Valida `id` y `token` calculando `sha256(token)` y comparando con `crypto.timingSafeEqual`.
2. Comprueba `status === 'pending'` y `Date.now() <= expiresAtMs`.
3. Permite 2 caminos en `/accept-invite`:
   - **Con Google Sign-In (`idToken`)**: Verifica que `decoded.email.toLowerCase() === invite.email`.
   - **Con Contraseña nueva (`password`)**: Crea/actualiza el usuario en Firebase Auth con `emailVerified: true` usando Admin SDK.
4. En `runTransaction`: marca la invitación como `status: 'accepted'`, crea `users/{uid}` con `role: invite.roleId` y `isActive: true` (sin hardcodear roles).

### C. Automatización DNS de Subdominio Cliente en Resend (`POST /api/admin/email-domain`)

Cuando un cliente elige **Modo 2 (Subdominio Propio `notify.cliente.com`)**:
- El servidor llama `POST https://api.resend.com/domains` con `{ name: "notify.cliente.com" }` usando `transactionalEmail.apiKey`.
- Guarda el `domainId` en `crm_settings/email_domain` y muestra en UI la tabla exacta de registros `TXT` (`SPF`), `CNAME` (`DKIM`) y `TXT` (`DMARC`) para copiar y pegar.
- El botón **"Verificar DNS"** llama `POST https://api.resend.com/domains/${domainId}/verify` y actualiza el estado a `verified`.
