# `steven-oauth-verifier`

Protocolo universal de ingeniería para conexión, verificación de dominios personalizados, auditoría forense y blindaje de **Google OAuth 2.0** sobre **Google Cloud Platform** y **Firebase (App Hosting y Classic Hosting)**.

---

## 🔍 Qué Cubre

* **Modo A (Día Cero) & Modo B (Auditoría Forense):** autodetecta configuraciones existentes (`firebase.json`, `apphosting.yaml`, `next.config.*`, `authDomain`).
* **Ciclo completo DNS → Firebase → OAuth:**
  * Adquisición y DNS (`Cloudflare` / `nic.cr`).
  * Vinculación en App Hosting vs Classic Hosting + SSL administrado.
  * Verificación obligatoria en **Google Search Console (DNS TXT)** + Google Public DNS Flush Cache.
  * Pantalla de consentimiento OAuth en GCP, prevención de fugas `*.firebaseapp.com` y proxy rewrites en Next.js.
  * **Cumplimiento legal Costa Rica:** requisitos de Términos y Privacidad bajo **Ley N° 8968** (Protección de Datos) y **Ley N° 7472** (Protección al Consumidor).
  * Auditoría de scopes sensibles (Calendar, Drive, Gmail, YouTube, Sheets) y matriz RCA de errores comunes.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Guía secuencial Fases 0–7, checklist de auditoría forense y matriz de troubleshooting.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-oauth-verifier
```

**Triggers:** `/steven-oauth-verifier`, `/oauth-verifier`, `/oauth-audit`, `/oauth-setup`, `/google-oauth`.
