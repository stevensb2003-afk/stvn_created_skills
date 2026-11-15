---
name: steven-rbac-invitations-licensing
description: >
  Sistema universal de Roles Dinámicos RBAC (3 planos: Platform Developer, Client Owner/Admin y Custom Roles), Invitaciones corporativas por correo electrónico con subdominio propio/agencia y Panel /developer de Licencias, Feature Flags y Suscripciones remotas.
  Implementa tokens de invitación SHA-256 con expiración de 72h, plantillas HTML ejecutivas adaptadas al branding del cliente, envío por subdominio gestionado o white-label (Resend Domains API SPF/DKIM/DMARC), constructor visual de roles en firestore, panel oculto /developer protegido por Custom Claim platformDev:true y webhook HMAC-SHA256 para automatizar pagos con Stripe/Tilopay/HQ.
  Actívalo cuando el usuario escriba "/steven-rbac-invitations-licensing", "/roles-rbac", "/invitaciones-correo", "/panel-developer", "controlar suscripciones", "activar y desactivar módulos", o solicite crear un sistema profesional de roles e invitaciones por correo.
---

# RBAC Dinámico, Invitaciones Branded y Control Remoto de Suscripciones (`steven-rbac-invitations-licensing`)

Este skill permite dotar a **cualquier plataforma B2B** de un gobierno de accesos profesional sin quemar correos personales en el código, con invitaciones de equipo presentables y control remoto de los módulos que cada cliente paga.

---

## 1. Entrevista Inicial Obligatoria (`ask_question`)

```json
{
  "questions": [
    {
      "question": "¿Cómo deseas enviar las invitaciones por correo electrónico a los usuarios del cliente?",
      "is_multi_select": false,
      "options": [
        "(Recommended) Subdominio de Agencia gestionado (ej. notificaciones@mail.tuagencia.com — 0 configuración DNS por cliente)",
        "Subdominio White-Label por cada cliente (ej. notify.cliente.com con verificación DNS SPF/DKIM/DMARC desde UI)",
        "Híbrido (arrancar con subdominio de agencia y ofrecer subdominio propio como opción premium)"
      ]
    },
    {
      "question": "¿Cómo gestionarás las suscripciones y activación de módulos a distancia?",
      "is_multi_select": false,
      "options": [
        "(Recommended) Etapa 1: Panel /developer exclusivo (platformDev) para encender/apagar módulos y suspender por falta de pago",
        "Etapa 2: Panel /developer + Webhook automático (Stripe / Tilopay / Paddle / HQ) para activar o suspender al pagar"
      ]
    }
  ]
}
```

---

## 2. Arquitectura de Implementación Paso a Paso

### Bloque A — Constructor de Roles Dinámicos e Invitaciones Branded
Lee [`references/email-templates-and-subdomain-dns.md`](./references/email-templates-and-subdomain-dns.md) para implementar:
1. **`roles/{roleId}` Dinámico:** CRUD visual (`SettingsRolesBuilder.tsx`) para que el Admin de cada cliente cree roles ilimitados eligiendo únicamente entre los módulos que su licencia tiene encendidos.
2. **Invitaciones Criptográficas (`POST /api/admin/invitations`):** Genera token de 32 bytes, persiste **solo su `SHA-256` (`tokenHash`)** en `crm_invitations` con vencimiento a 72h, valida límite de usuarios (`maxSeats`) y envía correo HTML corporativo con logo, color primario del cliente y `Reply-To` al administrador.
3. **Ruta Pública `/accept-invite`:** Permite entrar en 1 clic con Google o crear contraseña verificada.

### Bloque B — Módulo `/developer`, Feature Flags y Suscripciones
Lee [`references/developer-licensing-and-webhooks.md`](./references/developer-licensing-and-webhooks.md) para implementar:
1. **Separación en 3 Planos:** `platformDev: true` (Custom Claim exclusivo de ustedes) vs `Client Owner/Admin` vs `Custom Roles`.
2. **Documento Maestro `crm_system/tenant_license`:** Controla `subscriptionStatus` (`active`, `trialing`, `past_due`, `suspended`), `maxSeats` y `enabledModules`.
3. **Blindaje Triple (UI + Backend + Rules):** Un módulo desactivado en `/developer` desaparece del menú, devuelve `402/403` en los endpoints y queda bloqueado por `isModuleLicensed()` en `firestore.rules`.
4. **Modo Suspensión No Destructivo:** `<SubscriptionSuspendedGate />` bloquea el uso ante falta de pago sin borrar jamás los datos del cliente.
