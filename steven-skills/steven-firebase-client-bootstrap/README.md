# `steven-firebase-client-bootstrap`

Provisionador automatizado de proyectos **Google Cloud + Firebase** desde CLI/REST para arquitecturas multi-cliente de **1 solo código base** con flujo de 2 ramas (`demo` → `main`) y reglas de seguridad 100% recicladas.

---

## ⚙️ Qué Automatiza

* Creación/vinculación de `PROJECT_ID`, activación de APIs Cloud requeridas y vinculación de facturación Blaze.
* Creación de **Cloud Firestore** en modo `FIRESTORE_NATIVE`, **Authentication** (Email/Password y dominios autorizados) y bucket de **Cloud Storage**.
* Registro de **Web App SDK**, **reCAPTCHA Enterprise + Firebase App Check** y generación de `.env.client.<PROJECT_ID>.example`.
* Despliegue de reglas recicladas (`firestore.rules`, `storage.rules`, `firestore.indexes.json`) y registro en `deploy/clients.manifest.json` para GitHub Actions.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Principios multi-cliente, flujo interactivo `ask_question`, ejecución `--dry-run` / real y verificación `--verify-only`.
* [`references/github-actions-demo-main-multiclient.md`](./references/github-actions-demo-main-multiclient.md) — Workflows `deploy-demo.yml`, `deploy-clients.yml`, protección de `main` y seed Día 0.
* [`scripts/provision-firebase-project.mjs`](./scripts/provision-firebase-project.mjs) — Script CLI automatizado.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-firebase-client-bootstrap
```

**Triggers:** `/steven-firebase-client-bootstrap`, `/nuevo-cliente`, `/firebase-bootstrap`, `provisionar cliente nuevo`.
