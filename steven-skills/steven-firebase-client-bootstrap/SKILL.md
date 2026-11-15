---
name: steven-firebase-client-bootstrap
description: >
  Provisionador automatizado de proyectos Google Cloud + Firebase desde terminal/MCP para arquitecturas multi-cliente de 1 solo código base (ramas demo y main).
  Crea el proyecto GCP/Firebase, vincula facturación Blaze, activa todas las APIs necesarias, crea Cloud Firestore en modo Native, habilita Firebase Authentication (Email/Password y dominios autorizados), provisiona el bucket de Cloud Storage, registra la Web App SDK, crea y enlaza reCAPTCHA Enterprise + Firebase App Check, despliega reglas recicladas idénticas (firestore.rules, storage.rules, firestore.indexes.json), configura Custom Claims de Platform Developer y registra el nuevo proyecto en GitHub Actions (deploy/clients.manifest.json).
  Actívalo cuando el usuario escriba "/steven-firebase-client-bootstrap", "/nuevo-cliente", "/firebase-bootstrap", "créame un nuevo Firebase Project", "provisionar cliente nuevo" o "conectar nuevo proyecto Firebase a GitHub".
---

# Provisionador Automático Multi-Cliente Firebase + App Check + GitHub (`steven-firebase-client-bootstrap`)

Este skill elimina la creación manual clic-por-clic en Firebase Console cuando necesitas levantar tu ambiente **Demo** o dar de alta un **Cliente Nuevo** sobre tu modelo de **1 código base (`demo` → `main`) + 1 proyecto Firebase aislado por cliente**.

---

## 1. Principios de Arquitectura Multi-Cliente

1. **Reglas 100% Recicladas:** Todos tus clientes comparten exactamente los mismos archivos `firestore.rules`, `storage.rules` y `firestore.indexes.json` porque nunca quemas correos personales ni nombres de empresa en ellos (se gobiernan por roles dinámicos y Claims `platformDev: true`).
2. **2 Ramas Permanentes en GitHub (`demo` → `main`):**
   - Rama `demo`: conectada automáticamente a tu proyecto **Firebase Demo**.
   - Rama `main`: conectada al manifiesto `deploy/clients.manifest.json` para actualizar clientes de forma controlada.
3. **Automatización vs. 2 Clics Obligatorios de Google:**
   - **Automatizado al 100% por CLI/REST:** Proyecto GCP + Firebase + Facturación Blaze + 16 APIs + Firestore Native + Auth Email/Password + Dominios autorizados + Storage Bucket + Web App SDK + reCAPTCHA Enterprise + App Check + Despliegue de Reglas + Manifiesto GitHub.
   - **Únicos 2 pasos externos (si aplican):** (a) Pantalla de consentimiento Google OAuth externo en Cloud Console y (b) copiar los registros DNS (`A` / `TXT`) en el proveedor de dominio del cliente.

---

## 2. Flujo Interactivo Obligatorio (`ask_question`)

Antes de crear o mutar infraestructura en Google Cloud, pregunta siempre al usuario usando `ask_question`:

```json
{
  "questions": [
    {
      "question": "¿Para qué ambiente vas a provisionar este nuevo proyecto Firebase?",
      "is_multi_select": false,
      "options": [
        "(Recommended) Cliente Nuevo en Producción (conectado al despliegue desde rama main)",
        "Proyecto DEMO oficial de la agencia (conectado con auto-deploy a rama demo)",
        "Solo auditoría/verificación de un proyecto Firebase existente (--verify-only)"
      ]
    },
    {
      "question": "¿Deseas habilitar de una vez Firebase App Check (reCAPTCHA Enterprise) y desplegar las reglas recicladas del repositorio?",
      "is_multi_select": true,
      "options": [
        "(Recommended) Activar reCAPTCHA Enterprise + Firebase App Check automáticamente",
        "(Recommended) Desplegar firestore.rules, storage.rules e índices desde este repositorio",
        "(Recommended) Registrar el proyecto en deploy/clients.manifest.json para GitHub Actions"
      ]
    }
  ]
}
```

Además, solicita en texto plano (si no te lo dieron ya en el prompt):
1. **`PROJECT_ID`** deseado (6-30 caracteres en minúscula y guiones, ej. `crm-empresa-x`).
2. **Nombre visible** (ej. `CRM Empresa X`).
3. **Dominio(s)** del cliente (ej. `app.empresax.com`).
4. **Correos de Platform Developers** (tú y tu socio) para el Claim `platformDev: true`.

---

## 3. Ejecución Paso a Paso del Provisionador

### Paso 1: Simulación segura (`--dry-run`)
Ejecuta primero una vista previa para confirmar parámetros con el usuario:
```bash
node ~/.gemini/config/skills/steven-firebase-client-bootstrap/scripts/provision-firebase-project.mjs \
  --project "<PROJECT_ID>" \
  --display-name "<NOMBRE_VISIBLE>" \
  --domains "<DOMINIO_CLIENTE>" \
  --role "<demo|client>" \
  --dry-run
```

### Paso 2: Provisionamiento real automatizado
Tras confirmar los datos con el usuario, ejecuta:
```bash
node ~/.gemini/config/skills/steven-firebase-client-bootstrap/scripts/provision-firebase-project.mjs \
  --project "<PROJECT_ID>" \
  --display-name "<NOMBRE_VISIBLE>" \
  --domains "<DOMINIO_CLIENTE>" \
  --role "<demo|client>" \
  --manifest "deploy/clients.manifest.json" \
  --deploy-rules
```

> El script también genera `.env.client.<PROJECT_ID>.example` con las variables públicas del Web SDK (`NEXT_PUBLIC_FIREBASE_*` + `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`) listas para copiar en el entorno de Hosting/App Hosting del cliente.

### Paso 3: Conectar con GitHub (`demo` → `main`) y Semilla Día 0
Lee [`references/github-actions-demo-main-multiclient.md`](./references/github-actions-demo-main-multiclient.md) para:
1. Instalar `.github/workflows/deploy-demo.yml` y `.github/workflows/deploy-clients.yml` si el repo aún no los tiene.
2. Proteger `main` con `gh api` para impedir `git push` directo sin PR desde `demo`.
3. Correr `scripts/seed-tenant-day0.mjs` para inicializar `/config/branding`, `/config/tenant_license`, `/config/announcements` y los Custom Claims `platformDev: true`.

---

## 4. Verificación Obligatoria Post-Creación

Ejecuta siempre el modo `--verify-only` al terminar y presenta el resultado al usuario junto con los enlaces de los 1–2 pasos manuales finales (DNS y OAuth externo si usa Google Sign-In):

```bash
node ~/.gemini/config/skills/steven-firebase-client-bootstrap/scripts/provision-firebase-project.mjs \
  --project "<PROJECT_ID>" \
  --verify-only
```
