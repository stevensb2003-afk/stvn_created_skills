---
name: steven-agentic-ai-interface-ux
description: >
  Arquitectura UX para interfaces de chat e IA agéntica: empty states de reconocimiento sobre recuerdo,
  Labor Illusion con tiempos reales, citas verificables origin-aware, streaming Zero-CLS, brushing & linking
  entre prosa y gráficas, y aprobación Human-in-the-Loop (HITL) con Undo optimista. Actívalo cuando el
  usuario escriba "/steven-agentic-ai-interface-ux", "/ai-ux", "/chat-ux", o diseñe copilotos, chats IA o agentes.
---

# Agentic AI Interface UX

Las interfaces de IA fallan cuando copian burbujas genéricas de chat con avatares robot y degradados púrpura sin mostrar fuentes ni control humano. El patrón ganador convierte la conversación en **espacio de trabajo confiable, verificable y sin saltos visuales**.

## 1. Los 7 Patrones Esenciales de UI Agéntica

### 1. Empty State: *Recognition over Recall*
- **Anti-slop:** Nunca mostrar pantalla en blanco con `"How can I help you today? ✨"` y una esfera 3D vacía.
- **Solución:** Título específico del dominio + **`3–4` prompt chips accionables** con verbos y casos concretos para disparar con un solo clic (demostrando qué herramientas sabe usar el agente).

### 2. Atmósfera Cálida y Granulada (Anti-Plástico)
- Sustituye fondos negro-púrpura neón por superficies cálidas (neutros tintados o shader sutil naranja-lavanda claro) con **Film Grain del `6%–8%`** (`feTurbulence`, `pointer-events: none`) para dar calidez táctil y evitar *color banding*.

### 3. *Labor Illusion* (Visibilidad Calibrada de Pasos)
- Mostrar los pasos intermedios del agente (`Thinking · 1.6s`, `Read 24 runs · 1.2s`, `Checked index · 0.4s`) aumenta la confianza percibida y hace tolerables latencias largas.
- **Regla:** Colapsar por defecto al finalizar en una línea resumen (`Thought for 1.6s · 2 tools`), desplegable bajo demanda (*Progressive Disclosure*) para no inundar el hilo con JSON crudo.

### 4. Citas Verificables *Origin-Aware* (`[1]`, `[2]`)
- Toda afirmación factual, métrica o extracción debe enlazar a superíndices numéricos con `tabular-nums`.
- Al hacer clic o hover, el popover de fuente **nace desde la posición exacta del chip `[n]`** (`scale(0.95) -> 1`, `200ms ease-out`), mostrando título, extracto literal y enlace al registro origen.

### 5. Streaming *Zero-CLS* + Smart Auto-Scroll
- **Zero-CLS:** Reservar altura mínima o placeholder estructural mientras llegan los primeros tokens y evitar saltos cuando se inyectan tarjetas/tablas intermedias (`CLS < 0.05`).
- **Auto-scroll inteligente:** Seguir el stream **solo mientras el usuario esté al fondo** (`distFromBottom <= 48px`). Si el usuario hace scroll hacia arriba para leer el inicio, desactivar el auto-scroll al instante y mostrar botón flotante `"↓ Jump to latest"`.

### 6. *Brushing & Linking* Bidireccional (Texto <-> Datos)
- Conectar entidades o cifras mencionadas dentro de la respuesta del agente con el gráfico/tabla adjunta mediante un `highlightedEntityId` compartido:
  - Hover sobre `"Checkout API (+42%)"` en el texto -> ilumina esa barra/serie en la gráfica y atenúa las demás.
  - Hover sobre la barra en la gráfica -> subraya el tramo correspondiente del texto explicativo.

### 7. *Human-in-the-Loop* (HITL) + Ejecución Optimista con `Undo`
- Ningún agente ejecuta cambios irreversibles o externos en silencio (enviar emails, borrar filas, crear tickets, cobrar).
- Presentar tarjeta de intención previa con los parámetros exactos y dos decisiones claras: secundario **`Not now`** y primario **`Add` / `Approve`**.
- Al confirmar, aplicar **`0ms` Optimistic UI** mostrando estado ejecutado y barra temporal con **`Undo`** antes de consolidar o revertir limpiamente ante error.

---

## 2. Código y Patrones Listos para Usar

> Implementaciones completas en React + TypeScript + Tailwind para `<LaborIllusionSteps />`, `<OriginAwareCitation />`, `useSmartStreamScroll()`, `<BrushingLinkReport />` y `<AgentActionConfirmationCard />` en **[`./references/agentic-ui-patterns-and-code.md`](./references/agentic-ui-patterns-and-code.md)**.

---

## 3. Checklist de Auditoría AI / Chat UX

1. [ ] ¿El empty state evita orbes 3D/robots cliché y ofrece `3–4` prompts accionables reales?
2. [ ] ¿Se visibiliza el progreso de herramientas (*Labor Illusion* con tiempos en `tabular-nums`) y se colapsa al terminar?
3. [ ] ¿Las citas `[1]` despliegan popover *origin-aware* con extracto real del documento fuente?
4. [ ] ¿El streaming mantiene `CLS < 0.05` y deja de arrastrar el scroll en cuanto el usuario sube a leer?
5. [ ] ¿Las respuestas con métricas enlazan bidireccionalmente texto y gráfico (*Brushing & Linking*)?
6. [ ] ¿Toda acción mutante pasa por tarjeta HITL (`Not now` / `Confirm`) con feedback `0ms` optimista y opción real de `Undo`?
