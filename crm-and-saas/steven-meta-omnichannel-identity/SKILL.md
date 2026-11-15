---
name: steven-meta-omnichannel-identity
description: >
  Integrador maestro de Meta Graph API v25.0 (Facebook Messenger + Instagram Direct) y Unificación de Identidad Omnicanal (WhatsApp + Instagram + Messenger) para cualquier CRM.
  Incluye guía externa paso a paso para clientes, auto-descubrimiento con 1 solo token (POST /api/crm/admin/meta-social/discover) que extrae Page Access Token perpetuo + Page ID + IG Account ID y suscribe webhooks automáticamente, bóveda cifrada AES-256-GCM Write-Only, manejo de ventanas 24h vs 7d HUMAN_AGENT, respuestas/menciones en Stories, detección automática de teléfonos y fusión transaccional de clientes entre canales (Vista 360°).
  Actívalo cuando el usuario escriba "/steven-meta-omnichannel-identity", "/meta-omnicanal", "/instagram-messenger", "vincular instagram y messenger", "unificar cliente whatsapp instagram" o solicite integrar canales Meta desde el frontend.
---

# Meta Omnicanal (WhatsApp + Instagram + Messenger) e Identidad Unificada (`steven-meta-omnichannel-identity`)

Este skill permite conectar **Instagram Direct** y **Facebook Messenger** sin intermediarios de pago (directo con `graph.facebook.com/v25.0`) usando un flujo fácil desde el Frontend, y unificar en un solo historial a los clientes que escriben por múltiples canales.

---

## 1. Entrevista Inicial (`ask_question`)

```json
{
  "questions": [
    {
      "question": "¿Qué canales y capacidades omnicanal deseas habilitar en este proyecto?",
      "is_multi_select": true,
      "options": [
        "(Recommended) Instagram Direct (DMs, Respuestas/Menciones a Historias, Ecos móviles)",
        "(Recommended) Facebook Messenger (DMs de Página, Ecos Business Suite, Anuncios)",
        "(Recommended) Descubrimiento Automático 1-Token desde Bóveda Frontend Write-Only",
        "(Recommended) Unificación de Identidad Omnicanal (Vincular WA + IG + FB en un solo cliente + Vista 360°)"
      ]
    }
  ]
}
```

---

## 2. Implementación en 2 Bloques

### Bloque A — Conexión Meta Graph v25.0, Auto-Discovery y Parsers
Lee [`references/meta-graph-vault-and-parsers.md`](./references/meta-graph-vault-and-parsers.md) para:
1. Guiar al cliente en los 4 pasos externos de Meta Business Portfolio (incluyendo el interruptor obligatorio *"Permitir acceso a los mensajes"* en la app de Instagram y el `System User Token` sin caducidad).
2. Implementar `POST /api/crm/admin/meta-social/discover` para descubrir páginas y cuentas IG automáticamente con solo pegar `App Secret` + `System User Token`, guardar en la Bóveda cifrada y suscribir webhooks vía API.
3. Enrutar el webhook unificado (`whatsapp_business_account`, `instagram`, `page`) con firma `X-Hub-Signature-256` y enviar mensajes respetando ventanas `24h` vs `7d HUMAN_AGENT`.

### Bloque B — Grafo de Identidad y Vista 360°
Lee [`references/omnichannel-identity-merge-and-ui.md`](./references/omnichannel-identity-merge-and-ui.md) para:
1. Indexar `channelKeys: string[]` (`wa:+506...`, `ig:...`, `fb:...`) en `crm_contacts` para búsqueda `O(1)`.
2. Detectar números telefónicos en mensajes de IG/FB y sugerir vinculación en 1 clic desde `ChatHeader` (sin fusiones destructivas silenciosas).
3. Implementar `mergeOmnichannelContacts` transaccional + **Vista 360° Unificada** + selector de canal en `ChatInput`.
