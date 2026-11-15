# Blueprint 05 — `Directorio de Clientes` (`useCrmContacts` + `DirectoryLayout`) y `Métricas y Analíticas` (`calculateBusinessMinutes` + `MetricsLayout`)

> **Lectura Obligatoria**: Todo agente que implemente (`MODO A`/`B`) o audite (`MODO C`) el Directorio de Contactos o el Dashboard Analítico del CRM debe aplicar paginación bidireccional estricta por cursores (`0` uso de `offset`), prefijos N-Gram en nube, captura explícita de `failed-precondition`, cálculo de SLA en minutos hábiles según la zona horaria dinámica del negocio y series gráficas alimentadas exclusivamente por `hsl(var(--chart-1..5))` desde `src/app/globals.css`.

---

## 1. Generador N-Gram y Hook de Paginación Bidireccional (`src/hooks/crm/useCrmContacts.ts`)

### 1.1 Prefijos de Búsqueda Sin Tildes y Cursores `startAfter` / `endBefore`
- **Indexación `searchPrefixes`**: Al crear o editar un contacto (o recibir un webhook entrante), se persiste un arreglo deduplicado de prefijos (`2..18` caracteres) normalizados en NFD sin tildes para nombre, teléfono completo, teléfono local sin código de país y usuario del correo.
- **Paginación O(1)**: Usa `getCountFromServer()` (1 lectura agregada) + `startAfter(lastVisible)` (*Siguiente*) y `endBefore(firstVisible) + limitToLast(PAGE_SIZE)` (*Anterior*).
- **Captura Obligatoria de `failed-precondition`**: Extrae la URL autogenerada de Firebase Console para crear cualquier índice compuesto faltante en 1 clic.

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  DocumentData,
  endBefore,
  Firestore,
  getCountFromServer,
  getDocs,
  limit,
  limitToLast,
  orderBy,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from 'firebase/firestore';

export interface CrmContactRecord {
  id: string; // E.164 limpio o ID canónico sincronizado con crm_conversations
  name: string;
  phone: string;
  email?: string;
  assignedTo?: string | null;
  tags?: string[];
  isOperational?: boolean;
  searchPrefixes?: string[];
  updatedAt: number;
}

export function normalizeSearchToken(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function buildContactSearchPrefixes(input: {
  name?: string;
  phone?: string;
  email?: string;
  identificationNumber?: string;
  defaultCountryCode?: string;
}): string[] {
  const prefixes = new Set<string>();

  const pushTokenPrefixes = (token: string) => {
    const clean = normalizeSearchToken(token);
    if (!clean) return;
    const maxLen = Math.min(clean.length, 30);
    for (let i = 1; i <= maxLen; i += 1) {
      prefixes.add(clean.slice(0, i));
    }
  };

  if (input.name) {
    input.name
      .split(/\s+/)
      .filter(Boolean)
      .forEach((word) => pushTokenPrefixes(word));
    pushTokenPrefixes(input.name.replace(/\s+/g, ' '));
  }

  if (input.phone) {
    const digits = input.phone.replace(/\D/g, '');
    pushTokenPrefixes(digits);
    if (
      input.defaultCountryCode &&
      digits.startsWith(input.defaultCountryCode) &&
      digits.length > input.defaultCountryCode.length
    ) {
      pushTokenPrefixes(digits.slice(input.defaultCountryCode.length));
    }
  }

  if (input.email) {
    const [localPart] = input.email.split('@');
    if (localPart) pushTokenPrefixes(localPart);
    pushTokenPrefixes(input.email);
  }

  if (input.identificationNumber) {
    pushTokenPrefixes(input.identificationNumber);
    const idDigits = input.identificationNumber.replace(/\D/g, '');
    if (idDigits) pushTokenPrefixes(idDigits);
  }

  return Array.from(prefixes).slice(0, 500);
}

export function extractFirestoreIndexUrl(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/https:\/\/console\.firebase\.google\.com[^\s"]+/);
  return match ? match[0] : null;
}

const PAGE_SIZE = 24;

export function useCrmContacts({
  db,
  contactsCollectionPath,
  searchQuery,
  advisorFilter,
  tagFilter,
}: {
  db: Firestore;
  contactsCollectionPath: string; // ej. crmPaths(tenantId).contacts
  searchQuery: string;
  advisorFilter: string; // 'ALL' | 'UNASSIGNED' | uid
  tagFilter: string;     // 'ALL' | tagId
}) {
  const [contacts, setContacts] = useState<CrmContactRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [missingIndexUrl, setMissingIndexUrl] = useState<string | null>(null);

  const firstDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const buildBaseConstraints = useCallback((): QueryConstraint[] => {
    const constraints: QueryConstraint[] = [];
    const normalizedSearch = normalizeSearchToken(searchQuery).slice(0, 18);

    if (normalizedSearch) {
      constraints.push(where('searchPrefixes', 'array-contains', normalizedSearch));
    } else if (tagFilter !== 'ALL') {
      // Firestore admite un operador array-contains por consulta compuesta
      constraints.push(where('tags', 'array-contains', tagFilter));
    }

    if (advisorFilter === 'UNASSIGNED') {
      constraints.push(where('assignedTo', '==', null));
    } else if (advisorFilter !== 'ALL') {
      constraints.push(where('assignedTo', '==', advisorFilter));
    }

    constraints.push(orderBy('updatedAt', 'desc'));
    return constraints;
  }, [searchQuery, advisorFilter, tagFilter]);

  const loadPage = useCallback(
    async (direction: 'reset' | 'next' | 'prev') => {
      setLoading(true);
      setMissingIndexUrl(null);
      try {
        const colRef = collection(db, contactsCollectionPath);
        const base = buildBaseConstraints();

        if (direction === 'reset') {
          const countSnap = await getCountFromServer(query(colRef, ...base));
          setTotalCount(countSnap.data().count);
        }

        let pageQuery = query(colRef, ...base, limit(PAGE_SIZE));
        if (direction === 'next' && lastDocRef.current) {
          pageQuery = query(
            colRef,
            ...base,
            startAfter(lastDocRef.current),
            limit(PAGE_SIZE)
          );
        } else if (direction === 'prev' && firstDocRef.current) {
          pageQuery = query(
            colRef,
            ...base,
            endBefore(firstDocRef.current),
            limitToLast(PAGE_SIZE)
          );
        }

        const snap = await getDocs(pageQuery);
        if (!snap.empty) {
          firstDocRef.current = snap.docs[0];
          lastDocRef.current = snap.docs[snap.docs.length - 1];
        }

        let rows = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<CrmContactRecord, 'id'>) })
        );

        // Si hubo búsqueda N-Gram + filtro simultáneo de etiqueta, refinamos la etiqueta en memoria sobre la página
        if (normalizeSearchToken(searchQuery) && tagFilter !== 'ALL') {
          rows = rows.filter((r) => r.tags?.includes(tagFilter));
        }

        setContacts(rows);
        setPage((prev) =>
          direction === 'reset' ? 1 : direction === 'next' ? prev + 1 : Math.max(1, prev - 1)
        );
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'failed-precondition') {
          const url = extractFirestoreIndexUrl(err);
          console.error('[CRM Contacts] Falta índice compuesto en Firestore:', url || err);
          setMissingIndexUrl(url);
        } else {
          console.error('[CRM Contacts] Error cargando directorio:', err);
        }
      } finally {
        setLoading(false);
      }
    },
    [db, contactsCollectionPath, buildBaseConstraints, searchQuery, tagFilter]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPage('reset');
    }, 400);
    return () => clearTimeout(timer);
  }, [loadPage]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return {
    contacts,
    totalCount,
    page,
    totalPages,
    loading,
    missingIndexUrl,
    goNextPage: () => {
      if (page < totalPages) void loadPage('next');
    },
    goPrevPage: () => {
      if (page > 1) void loadPage('prev');
    },
  };
}
```

---

## 2. Vista `DirectoryLayout.tsx` (Dropdowns Propios `z-50`, Toggle Grid/Tabla y Salto 1-Clic al Chat)

```tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  MessageSquare,
  Search,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CRM_TAG_COLOR_PALETTE,
  getAdvisorBadgeColor,
} from '@/lib/constants/crm-palettes';
import type { CrmContactRecord } from '@/hooks/crm/useCrmContacts';

export interface DirectoryAdvisorOption {
  uid: string;
  displayName: string;
}

export interface DirectoryTagOption {
  id: string;
  name: string;
  colorKey: string;
}

export function DirectoryLayout({
  contacts,
  totalCount,
  page,
  totalPages,
  loading,
  advisors,
  tags,
  searchQuery,
  onSearchChange,
  advisorFilter,
  onAdvisorFilterChange,
  tagFilter,
  onTagFilterChange,
  onToggleContactTag,
  onOpenChat,
  onBackToChats,
  onNextPage,
  onPrevPage,
}: {
  contacts: CrmContactRecord[];
  totalCount: number;
  page: number;
  totalPages: number;
  loading: boolean;
  advisors: DirectoryAdvisorOption[];
  tags: DirectoryTagOption[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  advisorFilter: string;
  onAdvisorFilterChange: (val: string) => void;
  tagFilter: string;
  onTagFilterChange: (val: string) => void;
  onToggleContactTag: (contactId: string, tagId: string) => Promise<void>;
  onOpenChat: (contactId: string) => void;
  onBackToChats: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
}) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [openDropdown, setOpenDropdown] = useState<'advisor' | 'tag' | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocMouseDown = (ev: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(ev.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const resolveTagStyle = (colorKey: string) =>
    CRM_TAG_COLOR_PALETTE.find((c) => c.key === colorKey) ?? CRM_TAG_COLOR_PALETTE[0];

  const resolveAdvisorName = (uid?: string | null) => {
    if (!uid) return 'Sin asignar';
    return advisors.find((a) => a.uid === uid)?.displayName ?? 'Asesor';
  };

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Cabecera Sticky z-20 */}
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToChats}
            className="rounded-xl p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Users className="h-4 w-4 text-primary" />
          <h1 className="font-headline text-base font-semibold">
            Directorio de Clientes
          </h1>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {totalCount}
          </span>
        </div>

        {/* Conmutador Grid vs Tabla */}
        <div className="inline-flex rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              viewMode === 'grid'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground'
            )}
            aria-label="Vista tarjetas"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              viewMode === 'list'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground'
            )}
            aria-label="Vista tabla"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Barra de Buscador N-Gram + Dropdowns Propios z-50 */}
      <div
        ref={toolbarRef}
        className="flex flex-wrap items-center gap-2.5 border-b border-border bg-card/50 px-4 py-3"
      >
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, teléfono o correo..."
            className="w-full rounded-xl border border-input bg-background py-2 pr-3 pl-9 text-[16px] sm:text-xs"
          />
        </div>

        {/* Dropdown Propio Asesor (z-50) */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenDropdown(openDropdown === 'advisor' ? null : 'advisor')
            }
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <span>
              {advisorFilter === 'ALL'
                ? 'Todos los asesores'
                : advisorFilter === 'UNASSIGNED'
                  ? 'Sin asignar'
                  : resolveAdvisorName(advisorFilter)}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {openDropdown === 'advisor' && (
            <div className="absolute right-0 z-50 mt-1.5 w-56 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
              {[
                { id: 'ALL', label: 'Todos los asesores' },
                { id: 'UNASSIGNED', label: 'Sin asignar' },
                ...advisors.map((a) => ({ id: a.uid, label: a.displayName })),
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onAdvisorFilterChange(opt.id);
                    setOpenDropdown(null);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent"
                >
                  <span className="truncate">{opt.label}</span>
                  {advisorFilter === opt.id && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dropdown Propio Etiqueta (z-50) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenDropdown(openDropdown === 'tag' ? null : 'tag')}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <span>
              {tagFilter === 'ALL'
                ? 'Todas las etiquetas'
                : tags.find((t) => t.id === tagFilter)?.name || 'Etiqueta'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {openDropdown === 'tag' && (
            <div className="absolute right-0 z-50 mt-1.5 w-56 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl">
              <button
                type="button"
                onClick={() => {
                  onTagFilterChange('ALL');
                  setOpenDropdown(null);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent"
              >
                <span>Todas las etiquetas</span>
                {tagFilter === 'ALL' && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </button>
              {tags.map((t) => {
                const pal = resolveTagStyle(t.colorKey);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onTagFilterChange(t.id);
                      setOpenDropdown(null);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className={cn('h-2 w-2 rounded-full', pal.dotClass)} />
                      <span className="truncate">{t.name}</span>
                    </span>
                    {tagFilter === t.id && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cuerpo: Tarjetas Grid o Tabla */}
      <div className="scrollbar-discreet flex-1 overflow-y-auto p-4 sm:p-6">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contacts.map((c) => {
              const advColor = c.assignedTo
                ? getAdvisorBadgeColor(c.assignedTo)
                : null;
              return (
                <div
                  key={c.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {c.name || c.phone}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        +{c.phone}
                      </p>
                    </div>

                    <span
                      style={
                        advColor
                          ? {
                              backgroundColor: advColor.bgHex,
                              color: advColor.textHex,
                              borderColor: advColor.borderHex,
                            }
                          : undefined
                      }
                      className={cn(
                        'shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                        !advColor && 'border-border bg-muted text-muted-foreground'
                      )}
                    >
                      {resolveAdvisorName(c.assignedTo)}
                    </span>
                  </div>

                  {/* Píldoras de Etiquetas Sincronizadas Atómicamente */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(c.tags || []).map((tId) => {
                      const tagObj = tags.find((t) => t.id === tId);
                      if (!tagObj) return null;
                      const pal = resolveTagStyle(tagObj.colorKey);
                      return (
                        <button
                          key={tId}
                          type="button"
                          onClick={() => void onToggleContactTag(c.id, tId)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium',
                            pal.badgeClass
                          )}
                          title="Clic para quitar etiqueta (sincroniza contacto y chat)"
                        >
                          <span>{tagObj.name}</span>
                          <span>×</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-end border-t border-border pt-2.5">
                    <button
                      type="button"
                      onClick={() => onOpenChat(c.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Abrir Chat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Teléfono</th>
                  <th className="px-4 py-3 font-semibold">Responsable</th>
                  <th className="px-4 py-3 text-right font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-accent/20">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {c.name || 'Sin nombre'}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      +{c.phone}
                    </td>
                    <td className="px-4 py-3">{resolveAdvisorName(c.assignedTo)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenChat(c.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground"
                      >
                        Abrir Chat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación por Cursores */}
      <footer className="flex h-12 shrink-0 items-center justify-between border-t border-border bg-card px-4 text-xs">
        <span className="text-muted-foreground">
          Página <strong>{page}</strong> de <strong>{totalPages}</strong> ({totalCount}{' '}
          contactos)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={onPrevPage}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 font-medium disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={onNextPage}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 font-medium disabled:opacity-40"
          >
            Siguiente
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
```

---

## 3. Motor de Tiempo Hábil SLA Dinámico (`src/lib/utils/crm-business-hours.ts`)

### 3.1 Cálculo Exacto de Minutos Hábiles según `timezone` IANA, `schedule` Semanal y `closedDates`
Nunca penaliza al asesor por mensajes recibidos de madrugada, domingos o feriados configurados en `closedDates`.

```ts
import type { AutoAssignConfig, DayOfWeekKey } from '@/components/crm/settings/SettingsAutoAssign';

export type SlaBucketKey = '<5m' | '5-15m' | '15-30m' | '30-60m' | '>1h';

export const SLA_BUCKET_ORDER: readonly SlaBucketKey[] = [
  '<5m',
  '5-15m',
  '15-30m',
  '30-60m',
  '>1h',
] as const;

const WEEKDAY_MAP: Record<string, DayOfWeekKey> = {
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
  Sun: 'sunday',
};

function parseHhMmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function classifySlaBucket(businessMinutes: number): SlaBucketKey {
  if (businessMinutes < 5) return '<5m';
  if (businessMinutes <= 15) return '5-15m';
  if (businessMinutes <= 30) return '15-30m';
  if (businessMinutes <= 60) return '30-60m';
  return '>1h';
}

export function calculateBusinessMinutes({
  startMs,
  endMs,
  timezone,
  schedule,
  closedDates = [],
}: {
  startMs: number;
  endMs: number;
  timezone: string; // Leído dinámicamente desde crm_settings/general.timezone
  schedule: AutoAssignConfig['schedule'];
  closedDates?: string[]; // ["YYYY-MM-DD"]
}): number {
  if (endMs <= startMs) return 0;

  const closedSet = new Set(closedDates);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Iteración por pasos de 1 minuto con corte de seguridad a 14 días (20,160 min)
  const cappedEnd = Math.min(endMs, startMs + 14 * 24 * 60 * 60 * 1000);
  let billableMinutes = 0;

  for (let cursor = startMs; cursor < cappedEnd; cursor += 60_000) {
    const parts = formatter.formatToParts(new Date(cursor));
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }

    const isoDate = `${map.year}-${map.month}-${map.day}`;
    if (closedSet.has(isoDate)) continue;

    const dayKey = WEEKDAY_MAP[map.weekday || 'Mon'];
    const slot = dayKey ? schedule[dayKey] : undefined;
    if (!slot || !slot.enabled) continue;

    const currentMinuteOfDay =
      (Number(map.hour === '24' ? '0' : map.hour) || 0) * 60 +
      (Number(map.minute) || 0);
    const openMin = parseHhMmToMinutes(slot.startTime);
    const closeMin = parseHhMmToMinutes(slot.endTime);

    if (currentMinuteOfDay >= openMin && currentMinuteOfDay < closeMin) {
      billableMinutes += 1;
    }
  }

  return billableMinutes;
}
```

---

## 4. Dashboard Analítico `MetricsLayout.tsx` + `AnalyticsDrilldownModal` (`--chart-1..5` desde `globals.css`)

```tsx
'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BarChart3,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  classifySlaBucket,
  SLA_BUCKET_ORDER,
  type SlaBucketKey,
} from '@/lib/utils/crm-business-hours';

export interface AnalyticsConversationSample {
  id: string;
  contactName: string;
  contactPhone: string;
  assignedTo: string | null;
  assignedAdvisorName: string;
  isOperational: boolean;
  firstResponseBusinessMinutes: number | null;
  hasCtwaReferral: boolean;
  campaignHeadline?: string;
  lastMessagePreview: string;
}

const CHART_COLOR_VARS: Record<SlaBucketKey, string> = {
  '<5m': 'hsl(var(--chart-2))',
  '5-15m': 'hsl(var(--chart-1))',
  '15-30m': 'hsl(var(--chart-4))',
  '30-60m': 'hsl(var(--chart-3))',
  '>1h': 'hsl(var(--chart-5))',
};

export function MetricsLayout({
  hasMetricsAccess,
  canViewAllAdvisors,
  currentUserId,
  conversations,
  advisors,
  loading,
  onRefresh,
  onSelectChatFromDrilldown,
  onBackToChats,
}: {
  hasMetricsAccess: boolean;
  canViewAllAdvisors: boolean;
  currentUserId: string;
  conversations: AnalyticsConversationSample[];
  advisors: { uid: string; displayName: string }[];
  loading: boolean;
  onRefresh: () => void;
  onSelectChatFromDrilldown: (conversationId: string) => void;
  onBackToChats: () => void;
}) {
  const [selectedAdvisor, setSelectedAdvisor] = useState<string>('ALL');
  const [onlyCommercial, setOnlyCommercial] = useState<boolean>(true);
  const [drilldownBucket, setDrilldownBucket] = useState<SlaBucketKey | null>(null);

  const scopedRows = useMemo(() => {
    return conversations.filter((c) => {
      if (onlyCommercial && c.isOperational) return false;
      if (!canViewAllAdvisors) return c.assignedTo === currentUserId;
      if (selectedAdvisor !== 'ALL') return c.assignedTo === selectedAdvisor;
      return true;
    });
  }, [
    conversations,
    onlyCommercial,
    canViewAllAdvisors,
    currentUserId,
    selectedAdvisor,
  ]);

  const metrics = useMemo(() => {
    const bucketMap: Record<SlaBucketKey, AnalyticsConversationSample[]> = {
      '<5m': [],
      '5-15m': [],
      '15-30m': [],
      '30-60m': [],
      '>1h': [],
    };
    const frtValues: number[] = [];
    let ctwaCount = 0;
    let pendingCount = 0;

    for (const row of scopedRows) {
      if (row.hasCtwaReferral) ctwaCount += 1;
      if (row.firstResponseBusinessMinutes === null) {
        pendingCount += 1;
      } else {
        frtValues.push(row.firstResponseBusinessMinutes);
        bucketMap[classifySlaBucket(row.firstResponseBusinessMinutes)].push(row);
      }
    }

    frtValues.sort((a, b) => a - b);
    const medianFrt =
      frtValues.length > 0
        ? frtValues[Math.floor(frtValues.length / 2)]
        : 0;
    const within15m =
      bucketMap['<5m'].length + bucketMap['5-15m'].length;
    const slaCompliancePct =
      frtValues.length > 0 ? Math.round((within15m / frtValues.length) * 100) : 100;

    return {
      total: scopedRows.length,
      medianFrt,
      slaCompliancePct,
      pendingCount,
      ctwaCount,
      organicCount: scopedRows.length - ctwaCount,
      bucketMap,
    };
  }, [scopedRows]);

  if (!hasMetricsAccess) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-6 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <h2 className="mt-3 font-headline text-base font-semibold text-foreground">
          Acceso Restringido a Métricas
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Solicita el permiso <code>crm.metrics</code> a un administrador.
        </p>
      </div>
    );
  }

  const maxBucketCount = Math.max(
    1,
    ...SLA_BUCKET_ORDER.map((b) => metrics.bucketMap[b].length)
  );

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Cabecera */}
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToChats}
            className="rounded-xl p-2 text-muted-foreground hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <BarChart3 className="h-4 w-4 text-primary" />
          <h1 className="font-headline text-base font-semibold">
            Métricas y Analíticas CRM
          </h1>
          <span className="hidden rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary sm:inline">
            {canViewAllAdvisors
              ? 'Vista Administrador · Todo el Equipo'
              : 'Vista Personal'}
          </span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refrescar
        </button>
      </header>

      <div className="scrollbar-discreet flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {/* Segmentadores */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5">
          <div className="flex flex-wrap items-center gap-3">
            {canViewAllAdvisors && (
              <select
                value={selectedAdvisor}
                onChange={(e) => setSelectedAdvisor(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs"
              >
                <option value="ALL">Todo el equipo</option>
                {advisors.map((a) => (
                  <option key={a.uid} value={a.uid}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            )}

            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={onlyCommercial}
                onChange={(e) => setOnlyCommercial(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Solo Comerciales (excluir Operativo / Internos)
            </label>
          </div>
        </div>

        {/* KPIs Principales */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Conversaciones</p>
            <p className="mt-1 font-headline text-2xl font-bold">{metrics.total}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              Mediana 1.ª Respuesta Hábil
            </p>
            <p className="mt-1 font-headline text-2xl font-bold text-primary">
              {metrics.medianFrt} min
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Cumplimiento SLA (≤ 15m)</p>
            <p className="mt-1 font-headline text-2xl font-bold text-success">
              {metrics.slaCompliancePct}%
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              Origen Meta Ads CTWA / Orgánico
            </p>
            <p className="mt-1 font-headline text-2xl font-bold">
              {metrics.ctwaCount} / {metrics.organicCount}
            </p>
          </div>
        </div>

        {/* Gráfico Interactivo SLA (--chart-1..5 desde globals.css + Drilldown en 1 clic) */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="font-headline text-sm font-semibold text-foreground">
              Distribución de Primera Respuesta en Minutos Hábiles (Clic para inspeccionar chats)
            </h2>
            <p className="text-xs text-muted-foreground">
              Colores alimentados dinámicamente por <code>--chart-1..5</code> en <code>globals.css</code>.
            </p>
          </div>

          <div className="space-y-3">
            {SLA_BUCKET_ORDER.map((bucket) => {
              const count = metrics.bucketMap[bucket].length;
              const widthPct = Math.round((count / maxBucketCount) * 100);
              return (
                <button
                  key={bucket}
                  type="button"
                  onClick={() => setDrilldownBucket(bucket)}
                  className="group block w-full rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary"
                >
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Cubeta {bucket}
                    </span>
                    <span className="font-mono font-semibold text-muted-foreground group-hover:text-primary">
                      {count} chats →
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      style={{
                        width: `${Math.max(widthPct, count > 0 ? 4 : 0)}%`,
                        backgroundColor: CHART_COLOR_VARS[bucket],
                      }}
                      className="h-full rounded-full transition-all duration-300"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Modal Drill-Down en Portal z-[100] */}
      {drilldownBucket &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-xs">
            <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h3 className="font-headline text-base font-semibold text-foreground">
                    Detalle de Conversaciones · SLA {drilldownBucket}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Selecciona cualquier fila para abrir el hilo directamente en el workspace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrilldownBucket(null)}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="scrollbar-discreet divide-y divide-border overflow-y-auto">
                {metrics.bucketMap[drilldownBucket].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setDrilldownBucket(null);
                      onSelectChatFromDrilldown(item.id);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {item.contactName || item.contactPhone}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.lastMessagePreview}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-medium">
                        {item.assignedAdvisorName}
                      </span>
                      <span className="font-mono font-bold text-primary">
                        {item.firstResponseBusinessMinutes}m
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
```

---

## 5. Bloque Obligatorio de Índices Compuestos (`firestore.indexes.json`)

Todo proyecto aprovisionado con esta skill debe registrar estos índices compuestos para soportar el Directorio N-Gram, filtros por asesor/etiqueta y consultas analíticas por ventana temporal sin disparar `failed-precondition`:

```json
{
  "indexes": [
    {
      "collectionGroup": "crm_contacts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "searchPrefixes", "arrayConfig": "CONTAINS" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "crm_contacts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "assignedTo", "order": "ASCENDING" },
        { "fieldPath": "searchPrefixes", "arrayConfig": "CONTAINS" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "crm_contacts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "searchPrefixes", "arrayConfig": "CONTAINS" },
        { "fieldPath": "lastContactAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "crm_contacts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "crm_contacts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "assignedTo", "order": "ASCENDING" },
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "crm_conversations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "isOperational", "order": "ASCENDING" },
        { "fieldPath": "lastMessageAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "crm_conversations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "assignedTo", "order": "ASCENDING" },
        { "fieldPath": "lastMessageAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```


---

## 6. Directorio Resiliente con Paginación por Cursores y Fallback Pool en Memoria (`useCrmContacts.ts`)

Cuando un usuario combina múltiples filtros simultáneos en el Directorio (`selectedAdvisor` + `selectedTag`) o cuando un índice compuesto de Firestore aún se encuentra en estado `BUILDING` tras el primer despliegue (`err.code === 'failed-precondition'`), `useCrmContacts` evita pantallas rotas mediante:
1. **Búsqueda Bilingüe de Prefijos (`array-contains-any`)**: Consulta simultáneamente el prefijo normalizado sin tildes (`normalizeSearchText(q)`) y el prefijo en minúsculas original (`where('searchPrefixes', 'array-contains-any', [normalized, rawLower])`).
2. **Fallback Pool Automático en Memoria (`limit(300)`)**: Si la consulta compuesta con `orderBy('lastContactAt', 'desc')` lanza `failed-precondition`, captura la excepción, registra el enlace de creación del índice en consola y ejecuta la consulta base sin `orderBy` (`limit(300)`), ordenando y paginando en memoria (`filteredPool`) de forma transparente para el usuario.

---

## 7. Suite Ejecutiva Renovada (`v4.10.2`) de Métricas Omnicanal y Telemetría IA (Dual-Dashboard)

El módulo de **Métricas y Analíticas** (`MetricsLayout`) opera con dos tableros ejecutivos integrados bajo una barra unificada de filtros (`AnalyticsSlicers`):
- **Tab 1 — `Vista General & Equipo` (`activeTab === 'general'`)**: KPIs con deltas contra el periodo anterior (`DeltaBadge`), Distribución SLA Laboral, **Gráfico Dual de Horas Pico (`Llegaron` vs. `Contestados 1.ª vez`)**, Scorecard Comparativo de Asesores, Embudo Comercial por Etiquetas CRM y Panel de Atribución Meta Ads (Click-to-WhatsApp) con agrupación de creativos y renombrado inline.
- **Tab 2 — `Agente IA & Automatización` (`activeTab === 'ai'`)**: Franja de estado del motor en vivo, 6 KPIs de impacto y ROI IA (tasa de contención autónoma, handoffs y velocidad mediana de retoma humana, horas ahorradas 24/7, activos multimedia/audios, notas/auto-tags y latencia/éxito del LLM), Gráfico Apilado `24/7 Fuera de Horario` vs. `Respaldo SLA Hábil`, Embudo IA de 5 etapas, Ranking de Intenciones Comerciales y Tabla de Respaldo IA por Asesor.

### 7.1 Motor de Horario Comercial O(días) por Intersección de Intervalos (`src/lib/utils/crm-business-hours.ts`)
En lugar de iterar minuto a minuto (`O(minutos)`), `calculateBusinessMinutes` salta día por día (`O(días)`) intersectando el intervalo `[inboundAt, responseAt]` con la ventana hábil de cada día en la zona horaria IANA configurada (`timezone` desde `crm_settings/general`, ej. `'America/Costa_Rica'`):

```typescript
// src/lib/utils/crm-business-hours.ts
import type { CrmAiClosedDate } from '@/lib/types/crm-ai';

export type SLABucket = '<5m' | '5-15m' | '15-30m' | '30-60m' | '>1h';
export const SLA_BUCKETS: SLABucket[] = ['<5m', '5-15m', '15-30m', '30-60m', '>1h'];

export const SLA_BUCKET_COLORS: Record<SLABucket, string> = {
  '<5m': '#10b981',
  '5-15m': '#22c55e',
  '15-30m': '#f59e0b',
  '30-60m': '#f97316',
  '>1h': '#ef4444',
};

export interface DayScheduleWindow {
  openMinutes: number;  // ej. 8 * 60 = 480 (08:00)
  closeMinutes: number; // ej. 17 * 60 = 1020 (17:00)
}

export const DEFAULT_WEEKLY_WINDOWS: Record<number, DayScheduleWindow | null> = {
  0: null,                             // Domingo cerrado
  1: { openMinutes: 480, closeMinutes: 1020 }, // Lunes 08:00–17:00
  2: { openMinutes: 480, closeMinutes: 1020 },
  3: { openMinutes: 480, closeMinutes: 1020 },
  4: { openMinutes: 480, closeMinutes: 1020 },
  5: { openMinutes: 480, closeMinutes: 1020 },
  6: { openMinutes: 480, closeMinutes: 840 },  // Sábado 08:00–14:00
};

export function getTimezoneParts(date: Date, timeZone = 'America/Costa_Rica') {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(parts.hour === '24' ? '0' : parts.hour);
  const minute = Number(parts.minute);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    mmdd: `${parts.month}-${parts.day}`,
    dow: weekdayMap[parts.weekday] ?? 1,
    minutesOfDay: hour * 60 + minute,
    hour,
  };
}

export function isClosedHoliday(ymd: string, mmdd: string, closedDates?: CrmAiClosedDate[]): boolean {
  if (!closedDates || closedDates.length === 0) return false;
  return closedDates.some((d) => {
    const clean = (d.date || '').trim();
    return clean === ymd || clean === mmdd;
  });
}

/**
 * Calcula los minutos hábiles exactos entre inboundAt y responseAt en O(días)
 * intersectando la ventana de cada día calendario y excluyendo noches, domingos y feriados.
 */
export function calculateBusinessMinutes(
  inboundAt: Date | null,
  responseAt: Date | null,
  closedDates?: CrmAiClosedDate[],
  timeZone = 'America/Costa_Rica',
  weeklyWindows: Record<number, DayScheduleWindow | null> = DEFAULT_WEEKLY_WINDOWS
): number | null {
  if (!inboundAt || !responseAt) return null;
  const inMs = inboundAt.getTime();
  const outMs = responseAt.getTime();
  if (Number.isNaN(inMs) || Number.isNaN(outMs)) return null;
  if (outMs <= inMs) return 0;

  const maxSpanMs = 60 * 24 * 60 * 60 * 1000;
  const clampedOutMs = Math.min(outMs, inMs + maxSpanMs);

  let totalBizMinutes = 0;
  let cursorMs = inMs;

  while (cursorMs < clampedOutMs) {
    const cursorDate = new Date(cursorMs);
    const tz = getTimezoneParts(cursorDate, timeZone);
    const remainingDayMinutes = 24 * 60 - tz.minutesOfDay;
    const nextMidnightMs = cursorMs + remainingDayMinutes * 60_000;
    const sliceEndMs = Math.min(clampedOutMs, nextMidnightMs);

    const schedule = weeklyWindows[tz.dow];
    if (schedule && !isClosedHoliday(tz.ymd, tz.mmdd, closedDates)) {
      const sliceStartMin = tz.minutesOfDay + (cursorMs - cursorDate.setSeconds(0, 0)) / 60_000;
      const sliceDurationMin = (sliceEndMs - cursorMs) / 60_000;
      const sliceEndMin = sliceStartMin + sliceDurationMin;

      const overlapStart = Math.max(sliceStartMin, schedule.openMinutes);
      const overlapEnd = Math.min(sliceEndMin, schedule.closeMinutes);
      if (overlapEnd > overlapStart) {
        totalBizMinutes += overlapEnd - overlapStart;
      }
    }

    cursorMs = nextMidnightMs + 1000;
  }

  return Math.round(totalBizMinutes);
}

export function getSLABucket(minutes: number): SLABucket {
  if (minutes < 5) return '<5m';
  if (minutes < 15) return '5-15m';
  if (minutes < 30) return '15-30m';
  if (minutes < 60) return '30-60m';
  return '>1h';
}

export function formatMinutes(min: number | null): string {
  if (min === null || Number.isNaN(min)) return '—';
  if (min < 1) return '< 1m';
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
```

### 7.2 Endpoint Backend de Analíticas con Proyección `.select(...CONV_SELECT_FIELDS)`, SLA Omnicanal Móvil y Ventana Previa PoP (`src/app/api/crm/analytics/route.ts`)
Descarga únicamente los campos escalares requeridos (`.select(...CONV_SELECT_FIELDS)`) en paralelo para el periodo actual `[from, to]`, el periodo previo equivalente `[prevFrom, prevTo]`, las conversaciones activas (`lastMessageAt`) y la colección `crm_ai_telemetry`:

```typescript
// Campos proyectados en servidor (~75% ahorro en payload gRPC)
const CONV_SELECT_FIELDS = [
  'contactId', 'contactName', 'contactPhone', 'assignedTo', 'assignedToName',
  'status', 'unreadCount', 'createdAt', 'updatedAt', 'firstInboundAt',
  'firstResponseAt', 'firstAiResponseAt', 'lastMessageAt', 'lastCustomerMessageAt',
  'lastMessageSender', 'lastInteractionType', 'initiatedBy', 'lastReferral',
  'tagIds', 'isSupplier', 'isCourier', 'isInternal', 'isDistributor',
  'aiHandling', 'aiPausedByEscalation', 'aiEscalatedAt', 'firstEscalatedAt',
  'aiEscalationReason', 'humanTookOver', 'humanTookOverAt', 'aiTurnCount',
  'aiTotalTurns', 'aiTotalMediaSent', 'aiAudiosProcessed', 'aiSmartNotesCreated',
  'aiAutoTagsApplied', 'aiLastIntent', 'aiLastOutcome', 'aiLastExecutionMode',
  'serviceWindowExpiresAt',
] as const;
```
**Regla de Atribución Omnicanal (CRM Web + WhatsApp Business Móvil + IA)**:
1. `effectiveFirstHumanResponseAt`: Si `firstResponseAt` existe, se usa como respuesta Web (`replyChannel = 'web'`). Si no existe pero el asesor respondió desde el celular en modo coexistencia (`humanTookOverAt >= effectiveInboundAt` o `lastMessageSender === 'mobile'`), se acredita `effectiveFirstHumanResponseAt = humanTookOverAt || lastMessageAt` con `replyChannel = 'mobile'`.
2. `businessMinutes`: Se calcula con `calculateBusinessMinutes(effectiveInboundAt, effectiveFirstHumanResponseAt, closedDates, timezone)` exclusivamente para respuestas humanas (`web` o `mobile`).
3. `clientPerceivedMinutes`: Si `firstAiResponseAt` es anterior o igual a la primera respuesta humana, vale `0` (atención instantánea percibida por el cliente); de lo contrario, vale `businessMinutes`.
4. `attentionState`: Clasifica cada conversación en uno de 6 estados mutuamente excluyentes:
   - `'outbound'` (iniciado por asesor)
   - `'responded_human'` (atendido por asesor en Web o Móvil y sin espera urgente)
   - `'handled_ai'` (resuelto autónomamente por el Agente IA sin escalar)
   - `'waiting_escalated'` (pausado por escalación IA esperando retoma humana)
   - `'waiting_in_hours'` (cliente esperando en horario hábil)
   - `'waiting_after_hours'` (cliente escribió fuera de horario comercial)

### 7.3 Agregadores Puros: General (`crm-analytics-aggregator.ts`) e IA (`crm-ai-analytics-aggregator.ts`)
- **`computeGeneralAnalytics`**:
  - Calcula `totalNew`, `newDeltaPct` (vs. `prevConversations`), `totalActive` (unión deduplicada de nuevos + recurrentes activos), `returningActiveCount`, `aiParticipationPct`, `attentionRatePct`, `attentionDeltaPts`, `medianBizMin` (P50), `avgBizMin`, `clientPerceivedMedianMin`, `medianDeltaMin`, `slaCompliancePct` (`< 15m`), `slaComplianceDeltaPts`, `waitingTotal` (`waitingEscalated`, `waitingInHours`, `waitingAfterHours`) y `expiringWindowCount` (`<= 4h` para vencer ventana Meta 24h).
  - **Doble Serie de Volumen Horario (`volumeByHour`) y Diaria (`volumeByDay`) (`v4.10.2`)**:
    - Para cada franja `00:00..23:00` y cada día del rango, calcula dos contadores independientes sobre chats nuevos entrantes (`!c.isOutboundInitiated`):
      - `arrived`: conversaciones cuyo primer mensaje entrante (`firstInboundAt || createdAt`) ocurrió en esa hora/día.
      - `answered`: conversaciones cuya **primera respuesta efectiva** (`earliest(firstResponseAt, firstAiResponseAt)`) ocurrió en esa hora/día.
      - `conversations`: unión deduplicada de ambos conjuntos para abrir en `AnalyticsDrilldownModal` al hacer clic sobre cualquier punto del gráfico o sobre el badge de `peakHour`.
  - **Scorecard de Asesores (`advisorRows`)**: Incluye siempre el padrón completo de asesores (`catalogAdvisors`, incluso con `0` chats) más la fila `Sin asignar (Inbox)` (`__unassigned__`), con columnas `activeChats`, `newChats`, `attentionRatePct`, `medianBizMin`, `under15Pct`, `aiBackedChats` y `waitingChats`.
  - **Embudo de Etiquetas (`tagCounts`)**: Agrupa conversaciones activas por cada etiqueta de `crm_tags` y contabiliza las conversaciones activas sin etiquetar.
- **`computeAiAnalytics`**:
  - Filtra eventos de prueba (`executionMode !== 'test'`) a menos que el switch `includeTestAi` (`Incluir piloto Whitelist`) esté activo.
  - Calcula `aiConversationsCount` (+ `aiConversationsDeltaPct`), `coverageOfActivePct`, `autonomousResolvedCount` (`containmentRatePct`), `hybridAssistedCount`, `escalatedConversationsCount`, `retakenByHumanCount`, `pendingHumanTakeoverCount`, `medianHumanTakeoverMin` (`firstEscalatedAt` → `humanTookOverAt`), `estimatedHoursSaved` (`(totalAiTurns * 3.5 + (mediaCounts.total + audiosTranscribed + smartNotesCreated) * 1.5) / 60`), `mediaCounts` desglosado, `audiosTranscribed`, `smartNotesCreated`, `autoTagsAppliedCount`, `medianLatencyMs`, `engineSuccessRatePct`, el **Embudo IA de 5 etapas** (`Intervenidos por IA` → `Resueltos 100% por IA` → `Calificados y Escalados` → `Retomados por Asesor` → `Clasificados con Etiqueta`), el **Ranking de 11 Intenciones Comerciales** (`intentRanking`) y la **Tabla de Respaldo IA por Asesor** (`advisorSupport`).

### 7.4 Componentes Visuales Clave de la Suite Analítica (`v4.10.1` – `v4.10.2`)

#### A. Tarjetas KPI con Marca de Agua y Doble Zona Interactiva (`AnalyticsKpiCards` & `AnalyticsAiKpiCards`)
Cada tarjeta separa estrictamente dos zonas de clic para nunca bloquear la apertura del modal de conversaciones:
1. **Icono de Marca de Agua sin Caja (`w-[68px] h-[68px]`)**: Posicionado en `absolute -right-2.5 -bottom-2.5 pointer-events-none transition-transform duration-300 group-hover:scale-105` con opacidad sutil (`text-primary/10`).
2. **Zona Principal (`button` `z-10 w-full h-full p-4`)**: Al hacer clic en cualquier parte de la tarjeta, abre directamente `AnalyticsDrilldownModal` con la lista exacta de conversaciones de ese KPI.
3. **Zona Independiente `?` (`div` `absolute top-2.5 right-2.5 z-20` con `onClick={(e) => e.stopPropagation()}`)**: Despliega `MetricInfoPopover` con `title`, `description`, `formula`, `scheduleRule`, `benchmark` y botón de acción hacia el drilldown.

#### B. Tooltip Recharts de Alto Contraste Light/Dark (`AnalyticsChartTooltip` en `metric-info-popover.tsx`)
Cuando un `<Bar>` de Recharts delega colores a `<Cell>`, Recharts asigna color de texto inline `#000` al tooltip por defecto, haciéndolo ilegible sobre fondos oscuros. `AnalyticsChartTooltip` renderiza un contenedor propio (`bg-popover/95 border-border text-popover-foreground backdrop-blur-xs shadow-xl`) con punto de color dinámico (`entry.payload.color || entry.stroke || entry.fill`) y valores en `font-mono font-bold text-foreground tabular-nums`.

#### C. Gráfico Dual de Horas Pico: Llegados vs. Contestados 1.ª Vez (`src/components/crm/analytics/analytics-volume-chart.tsx`)
```tsx
// Estructura clave del AreaChart de doble curva (Llegaron vs. Contestados 1.ª vez)
<AreaChart
  data={data}
  onClick={(state: any) => {
    const rawIdx =
      typeof state?.activeTooltipIndex === 'number'
        ? state.activeTooltipIndex
        : typeof state?.activeIndex === 'number'
        ? state.activeIndex
        : undefined;
    handleOpenBucket(state?.activeLabel, rawIdx);
  }}
  style={{ cursor: onDrilldownList ? 'pointer' : 'default' }}
>
  <defs>
    <linearGradient id="volArrivedGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="var(--chart-1, #3b82f6)" stopOpacity={0.26} />
      <stop offset="95%" stopColor="var(--chart-1, #3b82f6)" stopOpacity={0} />
    </linearGradient>
    <linearGradient id="volAnsweredGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="var(--chart-2, #10b981)" stopOpacity={0.2} />
      <stop offset="95%" stopColor="var(--chart-2, #10b981)" stopOpacity={0} />
    </linearGradient>
  </defs>
  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#64748b" strokeOpacity={0.16} />
  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
  <Tooltip
    content={
      <AnalyticsChartTooltip
        seriesLabels={{
          arrived: 'Nuevos llegados',
          answered: 'Contestados (1.ª vez)',
        }}
      />
    }
  />
  <Area
    type="monotone"
    dataKey="arrived"
    name="arrived"
    stroke="var(--chart-1, #3b82f6)"
    strokeWidth={2.25}
    fill="url(#volArrivedGrad)"
  />
  <Area
    type="monotone"
    dataKey="answered"
    name="answered"
    stroke="var(--chart-2, #10b981)"
    strokeWidth={2.25}
    fill="url(#volAnsweredGrad)"
  />
</AreaChart>
```
En rangos de múltiples días (`7d`, `month`, `prev_month`), incluye un selector segmentado **`Por Hora` / `Por Día`** que permite ver el acumulado horario de horas pico (`00:00–23:00`) o la curva de evolución diaria, más un badge inferior interactivo con la **Hora Pico (`stats.peakHour`)**.

#### D. Panel de Atribución Meta Ads CTWA (`AnalyticsMarketingPanel` + `GET/PATCH /api/crm/analytics/marketing`)
- Cruza `crm_contacts` (`firstAdSourceId`, `interactedAdIds`), `crm_conversations` (`lastReferral.sourceId`) y `crm_meta_campaigns` dentro del rango `[from, to]` sin inflar campañas apagadas con mensajes orgánicos antiguos.
- Incluye switch **`Agrupar anuncios iguales` (`groupByCreative`)** para consolidar variantes A/B con el mismo titular, columna **`Asistidos IA` (`aiAssistedLeads`)** y edición inline (`PATCH /api/crm/analytics/marketing`) que actualiza el nombre personalizado en todos los `adIds` agrupados.

#### E. Modal Portal de Auditoría Directa (`AnalyticsDrilldownModal` en `createPortal(..., document.body)` `z-[100]`)
- Incluye buscador instantáneo por nombre, teléfono o asesor + chips rápidos por canal (`Todos`, `En espera`, `CRM Web`, `WA Móvil`, `Con IA`), badges de canal (`ReplyChannelBadge`), motivo de escalación IA y apertura directa del chat en el Inbox al hacer clic en cualquier fila.

### 7.5 Índices Compuestos Adicionales para Analíticas y Telemetría IA (`firestore.indexes.json`)
Agregar obligatoriamente junto a los índices del Directorio:
```json
[
  {
    "collectionGroup": "crm_conversations",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "assignedTo", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "crm_conversations",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "createdAt", "order": "DESCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "crm_ai_telemetry",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "assignedTo", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]
  }
]
```


---

## 8. Paginación Progresiva en Consultas `collectionGroup` de Agenda/Entregas y Proyectos con Fallback Resiliente (`v4.18.6`)

Para evitar descargar miles de documentos históricos en una sola lectura al abrir el Calendario Global de Agenda/Entregas y Eventos de Proyectos (`collectionGroup(firestore, 'deliveries')` y `collectionGroup(firestore, 'project_events')`), ambos hooks implementan **paginación reactiva incremental (`PAGE_SIZE = 100`)** con fallback automático si el índice compuesto aún se está construyendo (`failed-precondition`):

```typescript
// src/hooks/crm/use-crm-all-projects-events.ts — Patrón canónico de paginación progresiva collectionGroup
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collectionGroup,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { useFirestore } from '@/firebase';

const PAGE_SIZE = 100;

export function useCrmAllProjectsEvents(enabled = true) {
  const firestore = useFirestore();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitCount, setLimitCount] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!firestore || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let fallbackUnsub: (() => void) | null = null;

    const orderedQuery = query(
      collectionGroup(firestore, 'project_events'),
      orderBy('date', 'desc'),
      limit(limitCount)
    );

    const unsub = onSnapshot(
      orderedQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setEvents(list);
        setHasMore(snap.docs.length >= limitCount);
        setLoading(false);
      },
      (err: any) => {
        if (err?.code === 'failed-precondition' || String(err?.message || '').includes('index')) {
          const urlMatch = String(err?.message || '').match(/https:\/\/console\.firebase\.google\.com[^\s)]+/);
          if (urlMatch) {
            console.warn('[Firestore Index Required — Create in 1 click]:', urlMatch[0]);
          }
          // Fallback sin orderBy mientras el índice termina de compilar en Firebase
          const fallbackQuery = query(
            collectionGroup(firestore, 'project_events'),
            limit(limitCount)
          );
          fallbackUnsub = onSnapshot(fallbackQuery, (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));
            setEvents(list);
            setHasMore(snap.docs.length >= limitCount);
            setLoading(false);
          });
        } else {
          console.error('[useCrmAllProjectsEvents error]:', err);
          setLoading(false);
        }
      }
    );

    return () => {
      unsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [firestore, enabled, limitCount]);

  const loadMore = useCallback(() => {
    setLimitCount((prev) => prev + PAGE_SIZE);
  }, []);

  return { events, loading, hasMore, loadMore };
}
```
