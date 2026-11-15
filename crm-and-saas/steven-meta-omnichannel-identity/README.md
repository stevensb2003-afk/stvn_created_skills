# `steven-meta-omnichannel-identity`

Integrador maestro de **Meta Graph API v25.0** (**Instagram Direct** + **Facebook Messenger**) sin intermediarios de pago, con **Auto-Discovery 1-Token** y **Unificación de Identidad Omnicanal 360°** junto a WhatsApp Business.

---

## 🔄 Bloques de Implementación

* **Bloque A — Conexión Meta Graph v25.0 & Auto-Discovery:**
  * Guía externa paso a paso para clientes en Meta Business Portfolio (incluyendo *"Permitir acceso a los mensajes"* en Instagram y `System User Token` sin caducidad).
  * Endpoint `POST /api/crm/admin/meta-social/discover` que autodescubre Page ID + IG Account ID + Page Access Token perpetuo en bóveda `AES-256-GCM` Write-Only y suscribe webhooks vía API.
  * Router unificado (`whatsapp_business_account`, `instagram`, `page`) con firma `X-Hub-Signature-256` y ventanas `24h` vs `7d HUMAN_AGENT`.
* **Bloque B — Grafo de Identidad y Vista 360°:**
  * Indexación `O(1)` mediante `channelKeys: string[]` (`wa:+506...`, `ig:...`, `fb:...`).
  * Detección automática de teléfonos en mensajes IG/FB con sugerencia de vinculación en 1 clic (`mergeOmnichannelContacts` transaccional).

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Entrevista inicial y flujo en 2 bloques.
* [`references/meta-graph-vault-and-parsers.md`](./references/meta-graph-vault-and-parsers.md) — Contratos Graph API, bóveda y parsers de eventos/Stories.
* [`references/omnichannel-identity-merge-and-ui.md`](./references/omnichannel-identity-merge-and-ui.md) — Unificación transaccional y selector de canal en UI.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-meta-omnichannel-identity
```

**Triggers:** `/steven-meta-omnichannel-identity`, `/meta-omnicanal`, `/instagram-messenger`, `vincular instagram y messenger`.
