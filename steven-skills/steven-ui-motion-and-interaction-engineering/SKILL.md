---
name: steven-ui-motion-and-interaction-engineering
description: >
  Ingeniería cuantitativa de animaciones UI, curvas físicas, duraciones exactas, principios Disney en interfaces,
  leyes psicológicas de UX y microinteracciones optimistas de 0ms. Actívalo cuando el usuario escriba
  "/steven-ui-motion-and-interaction-engineering", "/motion-ui", "/animar-ui", o pida hacer una UI más fluida,
  arreglar transiciones robóticas, animar modales/tabs/popovers o construir microinteracciones en React/Motion/CSS.
---

# UI Motion & Interaction Engineering

Toda transición UI existe para aclarar **causa, origen espacial y respuesta del sistema**, nunca para hacer esperar al usuario. Este skill define exactamente qué no animar, qué milisegundos usar y cómo combinar física interrumpible con leyes cognitivas de UX.

## 1. Compuertas Obligatorias Antes de Animar (`Pre-Flight`)

1. **Frequency of Use (Emil Kowalski) — `0ms` en flujos repetitivos:** Nunca animes la apertura de herramientas de uso continuo (`Cmd+K`, paletas de comandos, cambio rápido de tabs en IDE o menús contextuales ejecutados decenas de veces por sesión). Allí `duration: 0ms` se siente más rápido y profesional.
2. **Umbral de Doherty (`< 400ms`) + Optimistic UI (`0ms`):** En acciones frecuentes (Like, Guardar, Archivar, Toggle), actualiza la UI al **instante (`0ms`)** antes de la respuesta de red; revierte limpiamente con notificación si la petición falla. Prohibido bloquear con spinners acciones sub-segundo.
3. **Respeto a `prefers-reduced-motion`:** Toda animación de desplazamiento/zoom debe degradar automáticamente a fades instantáneos (`<= 1ms` o simple opacidad corta) bajo `@media (prefers-reduced-motion: reduce)`.
4. **Propiedades GPU-Safe únicamente:** Anima `transform`, `opacity`, `clip-path` y `filter` corto (`<= 2px`). Evita animar `width`, `height`, `top`, `left` o `margin` para mantener `60/120 fps` sin *layout thrashing*.

---

## 2. Tabla Cuantitativa de Física, Curvas y Tiempos Exactos

| Interacción / Elemento | Curva / Spring | Duración / Parámetro Exacto | Regla de Ejecución |
|---|---|---|---|
| **Entradas estándar** | `ease-out` `cubic-bezier(0.22, 1, 0.36, 1)` | `200ms–250ms` | Llega rápido al foco y frena con suavidad |
| **Salidas / Cierres** | `ease-in` o `ease-out` corta | **`20%` más corta** (`250ms -> 200ms`, `200ms -> 160ms`) | El usuario ya decidió irse; despeja la pantalla rápido |
| **Movimientos en pantalla** | `ease-in-out` `cubic-bezier(0.65, 0, 0.35, 1)` | `250ms–300ms` | De un punto visible a otro dentro del mismo viewport |
| **Dropdowns & Popovers** | `ease-out` | `150ms–250ms` (`200ms` ideal); `scale(0.95) -> 1` | **Origin-aware:** fijar `transform-origin` al trigger tanto al abrir como al cerrar |
| **Stagger de listas** | `ease-out` | **`30ms–40ms`** entre ítems (**techo `< 250ms`** totales) | Nunca obligar a esperar ítems inferiores más de `250ms` |
| **Follow-through secundario** | `ease-out` | **`+50ms`** de retardo tras el contenedor | Badges, iconos auxiliares o subtítulos aterrizan justo después |
| **Press Feedback (Tap)** | Linear/Out rápido | `scale(0.96)`–`scale(0.97)` en `100ms–150ms` | Confirma contacto táctil antes de soltar el dedo |
| **Switches / Knobs** | Spring rápido | Estiramiento **`~12%`** (`scaleX(1.12)`) al deslizar | *Squash & Stretch* sutil sin exageración caricaturesca |
| **Everyday UI Springs** | Critically Damped | `stiffness: 420, damping: 32, mass: 0.8` | Sin rebote (*wobble*) innecesario en modales, drawers o menús diarios |
| **Drag & Gestos Directos** | **`1:1` sin tween** + *Interruptible* | Al soltar hereda velocidad; *rubber-banding* en límites | Ningún retardo artificial mientras el dedo arrastra la tarjeta |
| **Arcos 2D** | X e Y con easing distinto | Desplazamiento oblicuo con curva suave (`~32px` arc) | Evita trayectorias robóticas en línea recta diagonal |
| **Icon Morphing** | Blur + Scale + Opacity | `scale(0.6->1)` + `opacity(0->1)` + `blur(2px->0)` (`180ms`) | Reemplaza cortes secos (`copy -> check`, `menu -> X`) |
| **Tab Indicator / Masks** | `clip-path` o `layoutId` | `inset(...)` con transición suave (`220ms`) | Revela estado activo sin recalcular el texto interno |
| **Profundidad 3D** | `perspective: 800px` | En contenedor padre de flips/tarjetas inclinables | Garantiza perspectiva realista al rotar en X/Y |
| **Confirmación puntual** | Pulse único | `pulse once` en éxito; **overlap** entre estado viejo/nuevo | Nunca dejar animaciones en bucle infinito distrayendo la lectura |

---

## 3. Las 7 Leyes Psicológicas de UX + Principios Disney Aplicados

1. **Ley de Fitts:** Minimiza la distancia entre el foco actual y el siguiente CTA (`~483ms -> 230ms` al acercar controles contextuales) y garantiza áreas táctiles de **`44×44px` mínimo** (`24×24px` solo desktop denso, expandido con padding invisible).
2. **Ley de Hick:** Reduce opciones primarias visibles (`16 -> 4` categorías/planes máximo). Si superan **`8–10` ítems**, usa `<Combobox>` buscable o *Progressive Disclosure*.
3. **Ley de Miller (Chunking):** Divide cadenas largas en bloques cognitivos de 4 dígitos (`4532 0151 8920 3412` o códigos `4tdp-a3cV-Uqr2`).
4. **Ley de Postel (Input Tolerante):** Sé estricto en lo que emites y tolerante en lo que recibes: interpreta fechas parciales (`"15 ja"` -> `15 Jan`), espacios extra o formatos telefónicos sin exigir plantilla rígida al usuario.
5. **Ley de Jakob:** Respeta convenciones ubicacionales universales (marca arriba izquierda, búsqueda/perfil arriba derecha, carrito y cierre modal donde el usuario los espera).
6. **Staging + Overlap (Disney):** Guía la atención oscureciendo sutilmente el fondo detrás del modal y **solapa** los estados de salida/entrada (`crossfade` con desplazamiento corto) en lugar de esperar un vacío entre pantallas.
7. **Feedback de Error por Rechazo Físico:** En entradas inválidas al enviar (*submit*), aplica un micro-*shake* horizontal corto (`±6px`, `240ms`, 2 oscilaciones) + foco automático en el campo erróneo.

---

## 4. Receta de Microinteracción Social (Ej. Botón Like)

Cuando diseñes una acción emocional de alta frecuencia (Like, Favorito, Reacción), desacopla la economía diaria para dar **micro-recompensa sin fricción**:
- **Sin caja pesada:** Elimina bordes rectangulares innecesarios alrededor del botón; deja icono limpio + contador.
- **Estado activo semántico vivo:** Transiciona a carmesí real (`oklch(0.63 0.24 25)` / `#EF4444`), nunca gris oscuro apagado.
- **Curva de overshoot controlada:** El icono hace `1.0 -> 0.85 (squash) -> 1.28 (overshoot) -> 1.0`.
- **Odómetro vertical numérico:** El contador gira verticalmente hacia arriba al incrementar (`-100% -> 0% -> +100%`) usando `tabular-nums`.
- **Respaldo multimodal:** Activa un estallido radial breve (`6–8` partículas suaves en `300ms`), soporta *double-tap* directo sobre la foto y opcionalmente emite un pop sintetizado de `~50ms` vía Web Audio API tras interacción del usuario.

> Implementaciones completas en React + TypeScript + Motion + CSS listos para copiar en **[`./references/optimistic-ui-and-microinteraction-recipes.md`](./references/optimistic-ui-and-microinteraction-recipes.md)**.

---

## 5. Checklist de Auditoría de Movimiento

1. [ ] ¿Tienen `0ms` de animación los comandos de altísima frecuencia (`Cmd+K`, navegación de teclado, tabs de trabajo)?
2. [ ] ¿Todas las acciones tipo toggle/like actualizan a `0ms` optimista sin mostrar spinners?
3. [ ] ¿Las salidas duran un `20%` menos que las entradas (`250ms -> 200ms`) y los staggers suman `< 250ms`?
4. [ ] ¿Los dropdowns y popovers nacen desde `scale(0.95)` con `transform-origin` anclado al botón disparador?
5. [ ] ¿Los springs cotidianos son *critically damped* (sin rebote infantil en modales/menús)?
6. [ ] ¿Todos los gestos de arrastre siguen el puntero `1:1` con *rubber-banding* e interrupción limpia?
7. [ ] ¿Está declarado `@media (prefers-reduced-motion: reduce)` degradando transformaciones a fades?
8. [ ] ¿Cumplen áreas de toque (`>= 44×44px`), Ley de Hick (`<= 4` opciones primarias) y Ley de Postel en inputs flexibles?
