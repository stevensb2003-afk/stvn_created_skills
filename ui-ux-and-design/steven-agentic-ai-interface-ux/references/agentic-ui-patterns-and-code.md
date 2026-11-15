# Patrones React/TypeScript para Interfaces Agénticas y Chat IA

Componentes reutilizables correspondientes a `steven-agentic-ai-interface-ux`. Diseñados para accesibilidad, zero CLS durante streaming y sincronización bidireccional texto-datos.

---

## 1. `<LaborIllusionSteps />` (Pasos Colapsables con Tiempo en `tabular-nums`)

```tsx
"use client";

import React, { useState } from "react";

export interface AgentStep {
  id: string;
  label: string;
  durationSec: number;
  status: "running" | "done" | "error";
  detail?: string;
}

export function LaborIllusionSteps({ steps }: { steps: AgentStep[] }) {
  const [expanded, setExpanded] = useState(false);
  const allDone = steps.every((s) => s.status === "done");
  const totalSec = steps.reduce((acc, s) => acc + s.durationSec, 0);

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3 py-2 text-xs text-neutral-700">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex min-h-[36px] w-full items-center justify-between gap-3 text-left font-medium"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 rounded-full ${
              allDone ? "bg-emerald-500" : "animate-pulse bg-amber-500"
            }`}
          />
          {allDone
            ? `Completed ${steps.length} checks`
            : steps[steps.length - 1]?.label ?? "Working..."}
        </span>
        <span className="tabular-nums text-neutral-500">
          {totalSec.toFixed(1)}s {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1.5 border-t border-neutral-200/70 pt-2">
          {steps.map((step) => (
            <li key={step.id} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-800">{step.label}</span>
                <span className="tabular-nums text-neutral-500">
                  {step.durationSec.toFixed(1)}s
                </span>
              </div>
              {step.detail && (
                <p className="font-mono text-[11px] text-neutral-500">{step.detail}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## 2. `<OriginAwareCitation />` (Popover Anclado al Trigger)

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

export interface CitationSource {
  index: number;
  title: string;
  snippet: string;
  url: string;
}

export function OriginAwareCitation({ source }: { source: CitationSource }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={`Ver fuente ${source.index}: ${source.title}`}
        className="mx-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-neutral-200/80 px-1 text-[11px] font-semibold tabular-nums text-neutral-800 transition-colors hover:bg-neutral-900 hover:text-white"
      >
        {source.index}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={source.title}
          style={{ transformOrigin: "bottom left" }}
          className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-lg transition duration-200 ease-out"
        >
          <p className="text-xs font-semibold text-neutral-900">{source.title}</p>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-neutral-600">
            “{source.snippet}”
          </p>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs font-medium text-neutral-900 underline underline-offset-4"
          >
            Abrir fuente origen →
          </a>
        </div>
      )}
    </span>
  );
}
```

---

## 3. `useSmartStreamScroll()` (Auto-Scroll Respetuoso + Zero-CLS)

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mantiene el scroll pegado al fondo durante el streaming SOLO si el usuario no ha subido.
 * Desengancha de inmediato ante scroll manual y expone `jumpToLatest()`.
 */
export function useSmartStreamScroll(streamDependency: unknown) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoPinned, setIsAutoPinned] = useState(true);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAutoPinned(distanceFromBottom <= 48);
  }, []);

  useEffect(() => {
    if (!isAutoPinned) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [streamDependency, isAutoPinned]);

  const jumpToLatest = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setIsAutoPinned(true);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  return {
    scrollContainerRef,
    handleScroll,
    showJumpButton: !isAutoPinned,
    jumpToLatest,
  };
}
```

---

## 4. `<BrushingLinkReport />` (Sincronía Bidireccional Prosa <-> Gráfico)

```tsx
"use client";

import React, { useState } from "react";

export interface MetricItem {
  id: string;
  label: string;
  value: number;
  summaryText: string;
}

export function BrushingLinkReport({ items }: { items: MetricItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const maxVal = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-2">
      {/* Columna Prosa */}
      <div className="space-y-2 text-sm leading-relaxed text-neutral-700">
        {items.map((item) => {
          const highlighted = activeId === item.id;
          const dimmed = activeId !== null && !highlighted;
          return (
            <p
              key={item.id}
              onMouseEnter={() => setActiveId(item.id)}
              onMouseLeave={() => setActiveId(null)}
              className={`cursor-pointer rounded-lg px-2 py-1 transition-opacity duration-150 ${
                highlighted ? "bg-amber-50 text-neutral-950" : dimmed ? "opacity-45" : "opacity-100"
              }`}
            >
              <strong className="font-semibold text-neutral-950">{item.label}:</strong>{" "}
              {item.summaryText}
            </p>
          );
        })}
      </div>

      {/* Columna Gráfica acoplada */}
      <div className="flex flex-col justify-center gap-2.5" role="list" aria-label="Métricas vinculadas">
        {items.map((item) => {
          const highlighted = activeId === item.id;
          const dimmed = activeId !== null && !highlighted;
          const pct = Math.round((item.value / maxVal) * 100);
          return (
            <div
              key={item.id}
              role="listitem"
              onMouseEnter={() => setActiveId(item.id)}
              onMouseLeave={() => setActiveId(null)}
              className={`cursor-pointer space-y-1 transition-opacity duration-150 ${
                dimmed ? "opacity-40" : "opacity-100"
              }`}
            >
              <div className="flex justify-between text-xs font-medium text-neutral-800">
                <span>{item.label}</span>
                <span className="tabular-nums">{item.value} ms</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full transition-colors duration-150"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: highlighted ? "oklch(0.62 0.19 35)" : "oklch(0.28 0.02 250)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 5. `<AgentActionConfirmationCard />` (HITL + 0ms Optimista + `Undo`)

```tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

export function AgentActionConfirmationCard({
  title,
  summary,
  onCommit,
  onUndoServer,
}: {
  title: string;
  summary: string;
  onCommit: () => Promise<void>;
  onUndoServer?: () => Promise<void>;
}) {
  const [state, setState] = useState<"pending" | "applied" | "dismissed" | "error">("pending");
  const commitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current);
    };
  }, []);

  const handleConfirm = () => {
    setState("applied"); // 0ms Optimistic UI
    // Ventana de gracia de 4s para Undo antes de confirmar irrevocablemente o revertir
    commitTimerRef.current = window.setTimeout(async () => {
      try {
        await onCommit();
      } catch {
        setState("error");
      }
    }, 4000);
  };

  const handleUndo = async () => {
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
      setState("pending");
      return;
    }
    setState("pending");
    await onUndoServer?.();
  };

  if (state === "dismissed") return null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-950">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600">{summary}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {state === "pending" && (
          <>
            <button
              type="button"
              onClick={() => setState("dismissed")}
              className="min-h-[40px] rounded-xl border border-neutral-200 px-3.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="min-h-[40px] rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white hover:bg-neutral-800"
            >
              Add
            </button>
          </>
        )}

        {state === "applied" && (
          <div className="flex w-full items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <span className="font-medium">Applied ✓</span>
            <button
              type="button"
              onClick={handleUndo}
              className="font-semibold underline underline-offset-4"
            >
              Undo
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="flex w-full items-center justify-between rounded-xl bg-red-50 px-3 py-2 text-xs text-red-900">
            <span>Could not save action.</span>
            <button
              type="button"
              onClick={() => setState("pending")}
              className="font-semibold underline underline-offset-4"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```
