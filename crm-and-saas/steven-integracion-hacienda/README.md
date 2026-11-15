# `steven-integracion-hacienda` — Facturación Electrónica Costa Rica (v4.4 / TRIBU-CR)

Arquitecto e integrador nativo de **Facturación Electrónica del Ministerio de Hacienda de Costa Rica (`MH-DGT-RES-0027-2024`, XML v4.4, TRIBU-CR)** en **Node.js / TypeScript puro**, sin dependencias de PHP legado ni licencias virales AGPLv3.

---

## 🛡️ Las 7 Leyes de Hierro

1. **Outbox Transaccional `PRE_SAVED`:** toda venta se guarda localmente antes de transmitir a Hacienda.
2. **Consecutivo rechazado = quemado (`TipoDocIR="10"`):** nunca se reutiliza un consecutivo rechazado por DGT.
3. **Factura aceptada solo se anula con Nota de Crédito (`03`).**
4. **Aritmética `BigInt` a 5 decimales (`x 100_000n`)** (cero floats).
5. **Validación XSD v4.4 local obligatoria** antes de enviar.
6. **Cero fuga de secretos:** Modo A (`.env` servidor) o Modo B (Bóveda Frontend Write-Only `AES-256-GCM + HKDF + AAD`).
7. **TLS estricto y cache OIDC** con `refresh_token`.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Protocolo completo, inventario de activos y flujo de implementación.
* [`references/`](./references/) — **7 guías (`01` a `07`):** Protocolo DGT v4.4/OAuth, Esquemas XML y cálculos, Firma `XAdES-EPES` + `.p12`, `.env` vs Bóveda AES-256-GCM, Outbox/Rechazos/Alertas UX, Auditoría `CRLibre/API_Hacienda` y Guía E2E POS/CRM/Crédito/Webhooks.
* [`scripts/`](./scripts/) — `preflight-and-drift-sentinel.mjs`, `sign-and-validate-v44.mjs` (8 tipos de comprobante v4.4), `generate-lab-p12.mjs`.
* [`resources/`](./resources/) — Esquemas XSD oficiales v4.4 (`resources/xsd/v4.4/`) y `xmldsig-core-schema.xsd`.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-integracion-hacienda
```

**Triggers:** `/steven-integracion-hacienda`, `/hacienda-cr`, `/factura-electronica-cr`, `integrar Hacienda`, `TRIBU-CR`, `facturación electrónica Costa Rica`.
