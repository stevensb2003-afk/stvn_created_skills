---
name: steven-ui-craft-anti-slop
description: >
  Auditoría y reconstrucción visual para eliminar clichés de "AI slop", calibrar microtipografía,
  color perceptual OKLCH, radios concéntricos, sombras ambientales, superficies no planas y tarjetas
  técnicas Neo-Brutalistas. Actívalo cuando el usuario escriba "/steven-ui-craft-anti-slop", "/unslop",
  "/pulir-ui", o pida limpiar diseño genérico de IA, mejorar contraste, tipografía, jerarquía visual o elegir texturas de fondo.
---

# UI Craft & Anti-AI Slop

Elimina la estética genérica generada por IA (*badges* vacíos, gradientes púrpura, esferas 3D decorativas, texto deslavado y cajas rígidas) reemplazándola por geometría óptica exacta, color perceptual `OKLCH`, jerarquía intencional y materialidad con propósito.

## 1. Las 20 Reglas Anti-AI Slop (`DON'T` / `DO`)

### Copy, Tipografía y Clichés
1. **Sin badges de relleno:** `DON'T` apilar pills `"✨ NEW · Now GA →"` sobre cada hero. `DO` entrar directo con el titular principal.
2. **Sin etiquetas redundantes:** `DON'T` poner un eyebrow `"FAQ"` encima de *"Questions, answered."*. `DO` eliminar etiquetas que duplican al H2.
3. **Sin cursivas aleatorias:** `DON'T` italiar una palabra suelta del titular por estética (`Small studio. *Wide-open* thinking.`). `DO` reservar cursiva para énfasis semántico real.
4. **Monospace restringido:** `DON'T` redactar párrafos de producto en `monospace`. `DO` limitarlo a código, comandos CLI, hashes y métricas técnicas.
5. **Titulares con resultado concreto:** `DON'T` usar eslóganes vacíos (*"Curiosity, meet clarity"*). `DO` enunciar el resultado observable (*"Cited answers from papers"*).
6. **Contraste editorial legible:** `DON'T` usar gris pálido sobre blanco para párrafos o subtítulos. `DO` garantizar contraste WCAG AA `>= 4.5:1` (`>= 3:1` en display grande).
7. **Cero huérfanas ni viudas (`text-wrap`):** `DON'T` dejar una palabra suelta en la última línea del H1 (`"...scales with / you"`). `DO` aplicar `text-wrap: balance` en títulos y `text-wrap: pretty` en párrafos.

### Jerarquía, Layout y Sistema de Diseño
8. **Coherencia de Design System:** `DON'T` mezclar botones de gradiente púrpura IA (`✨`) con controles neutros. `DO` gobernar superficies y acentos desde tokens semánticos del sistema.
9. **Producto real > decoración 3D:** `DON'T` insertar orbes, mallas o cristales 3D abstractos en el hero. `DO` mostrar el producto real respondiendo con datos reales.
10. **Jerarquía asimétrica de features:** `DON'T` repetir grids idénticos de 3 columnas iguales. `DO` escalar la capacidad principal (`2×` ancho o alto) sobre las secundarias.
11. **Agrupar con aire, no con líneas:** `DON'T` encerrar cada ítem o feature en bordes de caja redundantes. `DO` agrupar por proximidad espacial y `gap` limpio.
12. **Un solo CTA primario por vista:** `DON'T` pintar todas las tarjetas de pricing con botones sólidos iguales. `DO` resaltar únicamente el plan recomendado y dejar los demás en `outline`.
13. **Color de acento intencional:** `DON'T` dejar el 100% de la interfaz en blanco/negro neutro sin foco visual. `DO` aplicar el color de acento al CTA principal (`Save changes`).
14. **Iconografía uniforme:** `DON'T` usar emojis 3D dispares como iconos de UI. `DO` usar iconos vectoriales lineales del mismo set y grosor de trazo (`stroke-width` y `viewBox="0 0 24 24"`). *(Complementar con `steven-pictogrammers-icon-lib` `--style outline` y tokens `--primary`/`--secondary`/`--tertiary` de `steven-whitelabel-theming-banners`)*.
15. **Cero halos neón:** `DON'T` rodear cards destacadas con glows rosa o violeta difusos. `DO` diferenciar mediante borde limpio o elevación ambiental calibrada y badge sobrio.

### Precisión Óptica y Estados de Interfaz
16. **Radios concéntricos matemáticos:** `DO` calcular esquinas anidadas con `inner_radius = max(0px, outer_radius - padding)` para mantener grosor visual constante en las curvas.
17. **Alineación óptica > geométrica:** `DON'T` centrar un triángulo `▶` por su caja rectangular. `DO` compensar su centro de masa desplazando `+1.5px` a `+2px` hacia la derecha (`translateX(2px)`).
18. **Cifras tabulares (`tabular-nums`):** `DO` aplicar `font-variant-numeric: tabular-nums` en contadores, tablas financieras, relojes y precios dinámicos.
19. **Estados estructurales de carga y vacío:** `DON'T` mostrar tablas en blanco durante carga ni vistas vacías rotas. `DO` renderizar *skeleton screens* con altura fija y *empty states* con icono + CTA claro.
20. **Feedback táctil y confirmación:** `DO` responder al clic con compresión rápida (`scale(0.96)–scale(0.97)`) y transición explícita de estado (`"ADD TO CART"` -> `"ADDED ✓"`).

---

## 2. Tokens Exactos de Microtipografía, Color y Ergonomía

| Eje | Regla / Fórmula Exacta | Aplicación Obligatoria |
|---|---|---|
| **Line Length (Measure)** | `max-width: 60ch`–`65ch` (`45ch–75ch` máx.) | Todo bloque de lectura continua o descripción |
| **Leading (Interlineado)** | `1.1–1.2` en H1–H3 · `1.5–1.6` en cuerpo | Ajustar por densidad; títulos compactos, cuerpo aireado |
| **Kerning & Tracking** | Display grande: `-0.02em` a `-0.03em`; **Tracking positivo `+0.05em` a `+0.15em` solo en ALL-CAPS** | Nunca abrir tracking en minúsculas o cursivas |
| **x-height** | Priorizar sans con `x-height` media/alta (`Inter`, `Plus Jakarta Sans`, `Geist`) en `11–14px` | Mejora legibilidad en badges, tablas y UI móvil |
| **Color Perceptual (`OKLCH`)** | `oklch(L C H)` mantiene luminosidad `L` constante al rotar `H` (`±20deg`) | Evita que un hover amarillo/cian brille distinto a un azul |
| **Tinted Neutrals** | Inyectar croma sutil `C = 0.008–0.02` del tono base en grises/fondos | Nunca `#000000` ni `#FFFFFF` puro estéril |
| **Radios Concéntricos** | `--inner-r: max(0px, calc(var(--outer-r) - var(--pad)))` | Ej. Card `32px`, padding `8px` -> botón/input `24px` |
| **Touch Target & Safe Area** | Mínimo `44×44px` (`48×48px` CTA móvil) + `env(safe-area-inset-bottom)` | Botones táctiles y barras fijas bajo muesca/barra iOS |
| **CLS & Afforance** | `CLS < 0.05`; controles interactivos distinguibles sin depender de `:hover` | Reservar alto de imágenes (`aspect-ratio`) y skeletons |

---

## 3. Componentes Duros y Patrones de Densidad

- **Combobox (`> 8–10` ítems):** Sustituir `<select>` largos o radios interminables por un combobox con búsqueda instantánea y navegación por teclado (`↑/↓/Enter`).
- **Progressive Disclosure:** Mantener visibles únicamente los campos primarios; mover opciones avanzadas (*filtros extra, webhooks, tokens*) detrás de un disclosure o acordeón explícito.
- **Sombras Ambientales Teñidas (Environment-Tinted Shadows):** Derivar el color `rgba`/`oklch` de las sombras multi-capa desde el color del fondo o cielo adyacente (ej. tarjetas sobre fondo azul cielo usan sombra azulada fría suave en capas `4px`, `12px`, `28px`, nunca gris sucio al 25%).
- **Tarjetas Técnicas Neo-Brutalistas (Comparativas / Código / Benchmarks):** Cuando la pieza sea educativa, de documentación o ingeniería técnica, el contraste deliberado reemplaza al minimalismo suave:
  - Contorno sólido `2px solid currentColor` y sombra dura con trama *halftone* desplazada (`+6px, +6px`).
  - Pares de tarjetas comparativas (`MÍNIMO` vs `EXTRAS`, `BEFORE` vs `AFTER`) para mostrar código mínimo viable frente a opciones de producción.
  - Barras comparativas de ancho proporcional con relleno rayado a `45°` (`repeating-linear-gradient(45deg, ...)`) y badge numérico de relación (`÷ 3`, `−72%`, `3.4×`).

---

## 4. Selección Rápida de Superficies (No Planas)

Nunca dejar el fondo en un `#FFFFFF` o `#0F172A` plano sin intención si la sección soporta atmósfera. Consulta **[`./references/surfaces-and-backgrounds-catalog.md`](./references/surfaces-and-backgrounds-catalog.md)** para ver las **22 fórmulas CSS/SVG completas**, pero usa esta guía de enrutamiento inicial:

| Vertical / Producto | Superficies Recomendadas | Regla Crítica de Legibilidad |
|---|---|---|
| **DevTools / Observabilidad / CLI** | `Speckled graphite`, `Square-dot grids`, `Blueprint grids`, `ASCII & pixels` | Opacidad de trama `0.03–0.12`, texto sobre contenedor opaco si es denso |
| **Fintech / Editorial / Docs / Notas** | `Paper`, `Grainy gradients`, `Contour lines`, `Stippled gradients` | Neutros cálidos (`C <= 0.015`), `max-width: 65ch`, contraste `>= 4.5:1` |
| **Diseño / Video / Audio / Hardware** | `Fluted glass`, `Halftone`, `Lens distortion`, `Iridescent shapes`, `Thermal` | Aislar texto encima en tarjeta con `backdrop-filter` o fondo sólido |
| **Viajes / Clima / Bienestar / Bio** | `Cloud sky`, `Water ripples`, `Single-hue landscapes`, `Felt`, `Impressionist` | Degradado protector detrás del titular y sombra ambiental del mismo tono |

---

## 5. Checklist de Auditoría Pre-Entrega

1. [ ] ¿Se eliminaron los pills de relleno, eyebrows duplicados, cursivas decorativas y orbes 3D sin función?
2. [ ] ¿El `monospace` aparece únicamente en código, CLI, hashes o cifras técnicas?
3. [ ] ¿Los títulos usan `text-wrap: balance`, `leading 1.1–1.2` y no dejan palabras huérfanas?
4. [ ] ¿Los números dinámicos/precios declaran `font-variant-numeric: tabular-nums`?
5. [ ] ¿Se respeta `inner_radius = outer_radius - padding` en cards anidadas e inputs?
6. [ ] ¿Todos los triángulos/iconos asimétricos (`▶`) están centrados ópticamente (`+1.5px–2px`)?
7. [ ] ¿Los targets móviles miden al menos `44×44px` y respetan `env(safe-area-inset-bottom)`?
8. [ ] ¿Solo hay un CTA primario sólido por vista o tabla de precios, con contraste WCAG AA `>= 4.5:1`?
9. [ ] ¿Los grises y sombras incorporan croma del entorno (`C = 0.008–0.02` en `OKLCH`) y nunca glows neón?
10. [ ] ¿Existen *skeleton screens* de altura fija (`CLS < 0.05`), *empty states* accionables y `<Combobox>` para listas largas?
