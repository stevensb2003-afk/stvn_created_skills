# `steven-auth-and-password-ux`

Diseño e ingeniería UX de flujos de **autenticación, login y creación de contraseñas sin fricción**, optimizado para conversión, accesibilidad y soporte nativo de Passkeys/gestores.

---

## 🎯 Reglas Principales

* **Jerarquía del Login:** 1 título de marca real, 1 CTA primario sólido, fila OAuth compacta al pie, `autoComplete="username webauthn"`, radios concéntricos y sombras ambientales teñidas.
* **10 Reglas Cognitivas del Password Input:**
  * Eliminación de `Confirm Password` + toggle `Show/Hide` **Zero-CLS (`font-mono` `1ch`)**.
  * **Reward Early, Punish Late:** sin viñetas rojas desde la tecla #1; errores al `onBlur`/`onSubmit` que desaparecen al instante al corregir.
  * Detección inline de contraseñas triviales, generador `crypto.getRandomValues()` con *Chunking* (`xxxx-xxxx-xxxx`) + `Copy`, medidor perimetral SVG *Closure* y redundancia Color + Forma + Texto.
* **Ciclo del Botón & Peak-End Rule:** `Creating account... -> ✔ Account created` y transición limpia post-auth.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Reglas visuales, 10 reglas cognitivas y checklist de auditoría.
* [`references/password-and-login-components.md`](./references/password-and-login-components.md) — Implementaciones completas (`<CognitivePasswordInput />` y `<AuthCardShell />`) en React + TypeScript + Tailwind.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-auth-and-password-ux
```

**Triggers:** `/steven-auth-and-password-ux`, `/auth-ux`, `/password-ux`.
