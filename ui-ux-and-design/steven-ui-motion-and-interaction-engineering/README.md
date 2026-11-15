# `steven-ui-motion-and-interaction-engineering`

Ingeniería cuantitativa de **animaciones UI**, curvas físicas, duraciones exactas, **principios Disney** aplicados a interfaces, **7 leyes psicológicas de UX** (Fitts, Hick, Miller, Postel, Jakob, Staging + Overlap, rechazo físico) y microinteracciones optimistas de **`0ms`**.

---

## 🎯 Puntos Clave

* **`0ms` en herramientas repetitivas** (`Cmd+K`, paletas de comandos, tabs frecuentes) y **Optimistic UI (`0ms`)** bajo el umbral de Doherty (`< 400ms`).
* **Tabla cuantitativa exacta:** entradas `200–250ms` (`cubic-bezier(0.22, 1, 0.36, 1)`), salidas `20%` más cortas, dropdowns *origin-aware* (`scale(0.95) -> 1`), staggers `< 250ms` y springs *critically damped* (`stiffness: 420, damping: 32, mass: 0.8`).
* **Solo propiedades GPU-Safe** (`transform`, `opacity`, `clip-path`) + soporte obligatorio a `prefers-reduced-motion`.

---

## 📂 Contenido de esta Carpeta

* [`SKILL.md`](./SKILL.md) — Compuertas pre-flight, tabla cuantitativa de física, leyes UX y checklist.
* [`references/optimistic-ui-and-microinteraction-recipes.md`](./references/optimistic-ui-and-microinteraction-recipes.md) — Recetas listas para copiar en React + TypeScript + Motion + CSS.

## 🚀 Instalación y Triggers

```bash
./install.sh --skill steven-ui-motion-and-interaction-engineering
```

**Triggers:** `/steven-ui-motion-and-interaction-engineering`, `/motion-ui`, `/animar-ui`.
