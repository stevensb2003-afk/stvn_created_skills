---
name: steven-auth-and-password-ux
description: >
  Diseño e ingeniería UX de flujos de autenticación, login y creación de contraseñas sin fricción:
  jerarquía 1 CTA, eliminación de Confirm Password, estrategia Reward Early / Punish Late, chunking,
  medidor SVG perimetral (Closure), toggle sin saltos de layout (Zero-CLS) y transición Peak-End.
  Actívalo cuando el usuario escriba "/steven-auth-and-password-ux", "/auth-ux", "/password-ux",
  o pida diseñar/mejorar pantallas de login, registro, recuperación o inputs de contraseña.
---

# Authentication & Password Input UX

Las pantallas de login y creación de contraseña suelen arruinar la conversión con clichés AI slop (`"Welcome Back! 👋✨"`), grillas agresivas de `❌` rojos desde la primera tecla y botones OAuth mal jerarquizados. Este skill aplica ergonomía cognitiva, continuidad visual y feedback optimista en todo el flujo auth.

## 1. Jerarquía Visual del Login (Anti-Slop + Materialidad)

1. **1 Título específico + 1 CTA primario:** Usa identidad de producto real (`"Log in to Window Seat"`), nunca `"Welcome Back! 👋✨"` ni subtítulos obvios (`"Please enter your details"`). Mantén **un solo botón primario sólido**.
2. **Fila OAuth compacta e inferior:** Coloca Google / Apple / GitHub / SSO en una fila horizontal compacta y sobria debajo de un divisor `or`, nunca como 4 botones gigantes compitiendo en peso visual con el formulario principal.
3. **Passkeys y Gestores nativos:** Declara `autoComplete="username webauthn"`, `autoComplete="current-password"` o `autoComplete="new-password"` para integración nativa con Passkeys, 1Password e iCloud Keychain.
4. **Radios concéntricos reales:** Aplica `--inner-r: max(0px, calc(var(--outer-r) - var(--pad)))` entre la card externa y el input/botón interno (ej. card `32px`, padding `8px` -> controles `24px`).
5. **Sombras ambientales del entorno:** Tinta las sombras multi-capa con el tono del fondo (cielo, marca o grafito) en lugar de gris negro opaco.

---

## 2. Las 10 Reglas Cognitivas del Password Input

1. **Elimina `Confirm Password`:** Con un toggle visible de `Show / Hide` (`eyeball`) + flujo estándar de recuperación por correo, pedir la contraseña dos veces duplica fricción sin mejorar seguridad.
2. **Continuity Zero-CLS (`font-mono` `1ch`):** Al alternar entre texto oculto y texto plano (`password <-> text`), garantiza fuente monoespaciada idéntica y altura fija (`line-height` fijo) para que no cambie el ancho de línea ni haya saltos horizontales.
3. **Prohibida la lista roja agresiva (`❌` desde la tecla #1):** Elimina las 5 viñetas rojas encendidas desde que el usuario empieza a escribir; saturan cognitivamente (*Color Overdose*).
4. **Reward Early, Punish Late (Regla de oro de validación):**
   - **Mientras escribe (antes del primer `blur`/`submit`):** Muestra progreso calmo y constructivo (`"4 characters left"`, `"Strong password ✓"` al cumplir reglas).
   - **Al perder foco (`onBlur`) o enviar (`onSubmit`):** Muestra el error concreto en rojo únicamente si sigue inválida.
   - **Al corregir tras error:** Borra el estado de error **de inmediato al teclear** en cuanto la condición vuelve a cumplirse.
5. **Detección inline de contraseñas comunes / triviales:** Comprueba localmente contra una lista de contraseñas comunes/filtradas y secuencias repetitivas (`123456`, `password`, `aaaa`), alertando en lenguaje claro antes de golpear el backend.
6. **Chunking (Ley de Miller) + Generador con `Copy`:** Ofrece sugerencias criptográficamente seguras (`crypto.getRandomValues()`) agrupadas en bloques de 4 separados por guion (`4tdp-a3cV-Uqr2`) o *passphrases* legibles, con botón `Copy` de un toque.
7. **Gestalt Closure (Medidor perimetral en el borde):** Dibuja la fortaleza cerrando el perímetro del propio input mediante SVG `<rect pathLength={100} />` cuyo `stroke-dashoffset` progresa alrededor del borde (`0 -> 100`) en vez de añadir barras externas ruidosas.
8. **Redundancy Gain (Color + Forma + Texto):** Nunca comuniques fuerza o error únicamente con color; combina contorno progresivo + icono semántico + micro-texto claro (`aria-live="polite"`).
9. **Materialidad funcional en privacidad:** En inputs sensibles o toggle de ocultar PIN/tarjeta, usa lámina *fluted glass* o blur sutil físico al ocultar para reforzar sensación tangible de resguardo.
10. **Antropomorfismo empático (solo marca consumer):** Si el tono de producto lo admite, un avatar discreto puede cubrir o desviar la mirada al activar `Show password` (omitir en banca institucional o B2B enterprise).

---

## 3. Ciclo de Vida del Botón y Peak-End Rule

- **Transición explícita anti-doble envío:** Bloquea el botón mientras envía (`disabled={isSubmitting}`) y transiciona texto e icono in situ:
  - Registro: `Create account` -> `Creating account...` -> `✔ Account created`
  - Login: `Log in` -> `Signing in...` -> `✔ Signed in`
- **Peak-End Rule (Post-Auth):** El recuerdo final del registro ocurre justo al autenticarse. Sustituye el corte blanco repentino por una transición limpia (*Shared Element / Zoom*) hacia el artefacto real de bienvenida (pase, tablero o primer espacio de trabajo listo).

> Implementación completa en React + TypeScript + Tailwind (incluyendo `<CognitivePasswordInput />` con SVG `Closure`, *Reward Early / Punish Late*, generador `crypto.getRandomValues()`, `Zero-CLS font-mono` y `<AuthCardShell />`) en **[`./references/password-and-login-components.md`](./references/password-and-login-components.md)**.

---

## 4. Checklist de Auditoría Auth & Password

1. [ ] ¿El formulario tiene 1 título específico de marca, 1 botón primario y los botones OAuth compactos al pie?
2. [ ] ¿Se eliminó el campo redundante `Confirm Password` dejando un toggle accesible `Show/Hide`?
3. [ ] ¿Alternar entre `•` y texto plano mantiene exactamente el mismo ancho/altura (`font-mono`, zero CLS)?
4. [ ] ¿La validación sigue *Reward Early, Punish Late* (`onBlur`/`onSubmit` para errores, limpieza instantánea al corregir)?
5. [ ] ¿Detecta contraseñas comunes/triviales inline y ofrece generador con *Chunking* (`xxxx-xxxx-xxxx`) + botón `Copy`?
6. [ ] ¿El botón de envío deshabilita dobles clics y transiciona por `Creating... -> ✔ Created`?
7. [ ] ¿Se respetan `autoComplete` (`username webauthn`, `new-password`, `current-password`) y radios concéntricos?
