# `steven-rbac-invitations-licensing`

Sistema universal de **Roles Dinámicos RBAC (3 Planos)**, **Invitaciones corporativas branded por correo** (subdominio gestionado o cliente white-label) y **Panel `/developer`** de licenciamiento modular y webhooks de suscripción.

---

## 🧩 Capacidades Principales

* **Separación en 3 Planos:** Custom Claim `platformDev: true` (Agencia) vs `Client Owner/Admin` vs `roles/{roleId}` dinámico en Firestore (`SettingsRolesBuilder.tsx`).
* **Invitaciones Criptográficas (`POST /api/admin/invitations`):** token de 32 bytes almacenado únicamente como hash `SHA-256` (`tokenHash`) con expiración de 72h, control `maxSeats`, envío vía Resend Domains API (`SPF`/`DKIM`/`DMARC`) y ruta `/accept-invite`.
* **Blindaje Triple de Licencias (`crm_system/tenant_license`):** ocultamiento en UI + bloqueo `402/403` en API + regla `isModuleLicensed()` en `firestore.rules`, más `<SubscriptionSuspendedGate />` no destructivo.
* **Webhooks HMAC-SHA256:** integración automática para Stripe / Tilopay / Paddle / HQ.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Entrevista inicial `ask_question` y arquitectura en 2 bloques.
* [`references/email-templates-and-subdomain-dns.md`](./references/email-templates-and-subdomain-dns.md) — Plantillas HTML ejecutivas e infraestructura de subdominios de correo.
* [`references/developer-licensing-and-webhooks.md`](./references/developer-licensing-and-webhooks.md) — Panel `/developer`, flags y contratos de webhook HMAC.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-rbac-invitations-licensing
```

**Triggers:** `/steven-rbac-invitations-licensing`, `/roles-rbac`, `/invitaciones-correo`, `/panel-developer`, `controlar suscripciones`.
