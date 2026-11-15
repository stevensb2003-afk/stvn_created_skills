# `steven-project-deploy`

Protocolo universal de despliegue, control de versiones **SemVer** y **Version Gate reactivo** para aplicaciones web (`Next.js`, `Vite`, `React`, `Angular`) sobre **Firebase App Hosting (SSR)** y **Firebase Classic Hosting (Static)** + **GitHub**.

---

## 🛡️ Qué Resuelve

* Elimina pantallas blancas por mismatch de chunks JS y bloqueos pasivos de Service Workers mediante arquitectura **Version Gate** (`/config/app_version` + purga atómica de `window.caches`).
* **Anti-bucle infinito:**
  * En **App Hosting (SSR):** actualiza `/config/app_version` únicamente en `src/instrumentation.ts` al arrancar el contenedor en producción (nunca antes del `git push`).
  * En **Classic Hosting (Static):** actualiza mediante hook `"postdeploy"` en `firebase.json` o CI/CD.
  * **Handshake previo en cliente (`VersionGateOverlay`):** verifica `/api/version` o `/version.json` con `no-store` antes de recargar.
* **Anti-cruce de proyectos:** prohíbe `firebase deploy` sin `--project` y valida coincidencia estricta entre `.firebaserc` y `firebase-tools use`.
* **Sección 6 Multi-Cliente (`demo` → `main`):** actualización coordinada del banner global de novedades.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Manifiesto técnico, matriz SSR vs Static, Iron Laws, flujo operativo completo y checklist Día 0.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-project-deploy
```

**Triggers:** `/steven-project-deploy`, `/project-deploy`, `/deploy`, `desplegar`, `lanzar release`.
