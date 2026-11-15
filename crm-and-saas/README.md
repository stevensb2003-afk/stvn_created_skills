# 🧩 CRM Omnicanal, SaaS, RBAC & Facturación Costa Rica (`crm-and-saas/`)

Skills de **código y arquitectura de producto/backend** para construir plataformas CRM, SaaS multi-cliente, módulos extensibles, RBAC dinámico, mensajería omnicanal (WhatsApp + Instagram + Messenger), documentación BRD para IA y facturación electrónica de Costa Rica (v4.4 / TRIBU-CR).

## 📦 Instalación de esta Categoría

```bash
./install.sh --category crm-and-saas
```

## 🗂️ Skills Incluidas (6 Skills)

| Carpeta / Skill | Propósito |
| :--- | :--- |
| [`steven-waba-dualhook-connection`](./steven-waba-dualhook-connection/) | Skill maestra v5.2 autocontenida: CRM Omnicanal (WhatsApp Dualhook + IG + Messenger), POS 4 modos, Hacienda CR v4.4, SaaS `/developer` y auditoría forense. |
| [`steven-module-architect`](./steven-module-architect/) | Escáner arquitectónico y protocolo guiado para agregar nuevos módulos respetando tokens CSS, RBAC, licenciamiento y docs IA. |
| [`steven-rbac-invitations-licensing`](./steven-rbac-invitations-licensing/) | Roles dinámicos en 3 planos (`platformDev` / Owner / `roles/{roleId}`), invitaciones SHA-256 por subdominio, `/developer` y webhooks HMAC. |
| [`steven-meta-omnichannel-identity`](./steven-meta-omnichannel-identity/) | Integración nativa Meta Graph v25.0 (Instagram Direct + Facebook Messenger), Auto-Discovery 1-Token y unificación 360°. |
| [`steven-integracion-hacienda`](./steven-integracion-hacienda/) | Motor standalone en Node.js para Facturación Electrónica Costa Rica DGT v4.4 / TRIBU-CR (`XAdES-EPES` + XSD v4.4, cero PHP/AGPL). |
| [`steven-brd-docs-bootstrap`](./steven-brd-docs-bootstrap/) | Generador y actualizador de bases documentales BRD multi-rol (`/*_ai_agent_docs/`) con EGM y compilador de coordenadas `Lxxx-Lyyy`. |
