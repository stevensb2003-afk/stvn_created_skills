# Blueprint 02 — Workspace de Chat, Ciclo Completo de Etiquetas (`Tags` en 5 Puntos), Parser JSX `<WhatsAppText />` y Respuestas Rápidas (`/atajo`)

> **Lectura Obligatoria**: Todo agente que construya o audite la bandeja de conversaciones, cabecera del chat, barra de escritura, etiquetas o respuestas rápidas debe implementar el código y contratos exactos de este manual consumiendo exclusivamente tokens semánticos de `src/app/globals.css` y `crmPaths(tenantId)`.

---

## 1. Ciclo Completo de Etiquetas (`Tags`) — Conectado de Punta a Punta en 5 Puntos

### 1.1 Servicio Atómico Dual: `toggleTagAtomically` (`writeBatch` Conversación ↔ Contacto)
Toda asignación o remoción de etiqueta (desde `ChatHeader`, `DirectoryLayout`, `EditContactModal` o Auto-Tagging del Bot IA) **DEBE** pasar por esta transacción en lote para que el chat y el directorio nunca diverjan:

```typescript
// src/lib/services/crm-tag-sync.ts
import { Firestore, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { crmPaths } from '@/lib/utils/crm-paths';

export async function toggleTagAtomically(params: {
  firestore: Firestore;
  tenantId?: string;
  tagId: string;
  currentTagIds: string[];
  conversationId?: string | null;
  contactId?: string | null;
}): Promise<{ nextTagIds: string[]; added: boolean }> {
  const { firestore, tenantId = 'default', tagId, currentTagIds, conversationId, contactId } = params;
  const paths = crmPaths(tenantId);
  const exists = currentTagIds.includes(tagId);
  const nextTagIds = exists
    ? currentTagIds.filter((id) => id !== tagId)
    : Array.from(new Set([...currentTagIds, tagId]));

  const batch = writeBatch(firestore);
  if (conversationId) {
    batch.update(doc(firestore, paths.conversationsCol, conversationId), {
      tagIds: nextTagIds,
      updatedAt: serverTimestamp(),
    });
  }
  if (contactId) {
    batch.update(doc(firestore, paths.contactsCol, contactId), {
      tagIds: nextTagIds,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return { nextTagIds, added: !exists };
}
```

### 1.2 Punto 1 — Administración y Paleta de 18 Colores (`SettingsTags.tsx`)
```tsx
// src/components/crm/settings/settings-tags.tsx
'use client';

import { useState, useEffect } from 'react';
import { Tag as TagIcon, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { CrmTag } from '@/lib/types/crm';
import { CRM_TAG_COLOR_PALETTE } from '@/lib/constants/crm-tag-colors';
import { crmPaths } from '@/lib/utils/crm-paths';
import { useToast } from '@/hooks/use-toast';

export function SettingsTags({ tenantId = 'default' }: { tenantId?: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const paths = crmPaths(tenantId);

  const [tags, setTags] = useState<CrmTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CRM_TAG_COLOR_PALETTE[11].badgeClass);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, paths.tagsCol), orderBy('name', 'asc'));
    return onSnapshot(q, (snap) => {
      setTags(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || '',
          color: d.data().color || CRM_TAG_COLOR_PALETTE[0].badgeClass,
          createdAt: d.data().createdAt,
        }))
      );
      setLoading(false);
    });
  }, [firestore, paths.tagsCol]);

  const handleCreate = async () => {
    const clean = newName.trim();
    if (!firestore || !clean || isSubmitting) return;
    if (tags.some((t) => t.name.toLowerCase() === clean.toLowerCase())) {
      toast({ title: 'Etiqueta duplicada', description: 'Ya existe una etiqueta con ese nombre.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, paths.tagsCol), {
        name: clean,
        color: newColor,
        createdAt: serverTimestamp(),
      });
      setNewName('');
      toast({ title: 'Etiqueta creada', description: `"${clean}" lista para usar en chats y filtros.` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    const clean = editName.trim();
    if (!firestore || !clean) return;
    await updateDoc(doc(firestore, paths.tagsCol, id), { name: clean, color: editColor });
    setEditingId(null);
    toast({ title: 'Etiqueta actualizada' });
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    await deleteDoc(doc(firestore, paths.tagsCol, id));
    setConfirmDeleteId(null);
    toast({ title: 'Etiqueta eliminada' });
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <TagIcon className="w-5 h-5 text-primary" /> Etiquetas de Conversación y Clientes
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Clasifica chats en vivo, filtra bandejas con selección múltiple y permite auto-clasificación del Agente IA.
        </p>
      </div>

      {/* Creador con Paleta de 18 Colores + Vista Previa en Vivo */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input
            type="text"
            maxLength={32}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nombre de la etiqueta (ej. Cotización Pendiente, VIP)..."
            className="flex-1 rounded-xl border border-input bg-background px-3.5 py-2 text-[16px] sm:text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSubmitting || !newName.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear Etiqueta
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {CRM_TAG_COLOR_PALETTE.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setNewColor(preset.badgeClass)}
              className={`w-6 h-6 rounded-full ${preset.dotClass} transition-transform cursor-pointer ${
                newColor === preset.badgeClass ? 'ring-2 ring-ring ring-offset-2 ring-offset-card scale-110' : 'opacity-80 hover:opacity-100'
              }`}
              aria-label={`Color ${preset.id}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Vista previa en vivo:</span>
          <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${newColor}`}>
            {newName.trim() || 'Etiqueta de ejemplo'}
          </span>
        </div>
      </div>

      {/* Lista Editable */}
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        {loading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : tags.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Aún no hay etiquetas creadas.</p>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className="p-3.5 px-4 flex items-center justify-between gap-3">
              {editingId === tag.id ? (
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-lg border border-input bg-background px-2.5 py-1 text-[16px] sm:text-xs text-foreground"
                  />
                  <div className="flex items-center gap-1">
                    {CRM_TAG_COLOR_PALETTE.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditColor(p.badgeClass)}
                        className={`w-4 h-4 rounded-full ${p.dotClass} ${editColor === p.badgeClass ? 'ring-2 ring-ring' : ''}`}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => handleSaveEdit(tag.id)} className="p-1.5 text-success hover:bg-accent rounded-lg">
                    <Check className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:bg-accent rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${tag.color}`}>
                    {tag.name}
                  </span>
                  <div className="flex items-center gap-1">
                    {confirmDeleteId === tag.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDelete(tag.id)}
                          className="px-2.5 py-1 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg bg-muted text-muted-foreground text-xs"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(tag.id);
                            setEditName(tag.name);
                            setEditColor(tag.color);
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(tag.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

### 1.3 Punto 2 — Píldoras Activas + Dropdown Inline `+ Etiqueta` (`z-40`) en `ChatHeader`
```tsx
// Subcomponente integrado dentro de src/components/crm/chat-header.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { CrmTag } from '@/lib/types/crm';

interface ChatHeaderTagsBarProps {
  allTags: CrmTag[];
  activeTagIds: string[];
  onToggleTag: (tagId: string) => void;
}

export function ChatHeaderTagsBar({ allTags, activeTagIds, onToggleTag }: ChatHeaderTagsBarProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const activeTags = activeTagIds
    .map((id) => allTags.find((t) => t.id === id))
    .filter((t): t is CrmTag => Boolean(t));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeTags.map((tag) => (
        <span
          key={tag.id}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${tag.color}`}
        >
          {tag.name}
          <button
            type="button"
            onClick={() => onToggleTag(tag.id)}
            aria-label={`Quitar ${tag.name}`}
            className="hover:opacity-70 cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}

      <div ref={popoverRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full border border-border bg-muted/60 hover:bg-accent text-muted-foreground hover:text-foreground text-[10px] font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-2.5 h-2.5" /> Etiqueta
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1.5 w-52 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-1.5 z-40 scrollbar-discreet">
            {allTags.length === 0 ? (
              <p className="p-2 text-[11px] text-muted-foreground text-center">
                Crea etiquetas en Configuración CRM → Etiquetas
              </p>
            ) : (
              allTags.map((tag) => {
                const selected = activeTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggleTag(tag.id)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-accent transition-colors cursor-pointer"
                  >
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold truncate ${tag.color}`}>
                      {tag.name}
                    </span>
                    {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```
- **Puntos 4 y 5 del Ciclo de Etiquetas**: `ChatListItem` renderiza hasta `3` píldoras compactas + `+N`; `DirectoryLayout` (`ContactCard` / `DirectoryTableRow`) usa el mismo `toggleTagAtomically`; y `ChatFilterPanel` pasa `allTags` a `ChatFilterMultiSelect` (`z-[150]`) para filtrar conversaciones por múltiples etiquetas en simultáneo.

---

## 2. Parser Seguro JSX `<WhatsAppText />` (Cero `dangerouslySetInnerHTML`)

```tsx
// src/lib/utils/whatsapp-parser.tsx
import React, { ReactNode } from 'react';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_REGEX = /https?:\/\/[^\s]+/g;
const BOLD_REGEX = /\*(.*?)\*/g;
const ITALIC_REGEX = /_(.*?)_/g;
const STRIKE_REGEX = /~(.*?)~/g;
const MONO_REGEX = /```([\s\S]*?)```/g;

export interface WhatsAppTextProps {
  text: string;
  isUs?: boolean;
  onEmailClick?: (e: React.MouseEvent, email: string) => void;
}

function parseSegment(
  text: string,
  regex: RegExp,
  renderMatch: (match: string, idx: number) => ReactNode
): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = [];
  let lastIndex = 0;
  const localRegex = new RegExp(regex.source, regex.flags);
  let m: RegExpExecArray | null;

  while ((m = localRegex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    parts.push(renderMatch(m[1] !== undefined ? m[1] : m[0], m.index));
    lastIndex = localRegex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

function walkNodes(
  nodes: (string | ReactNode)[],
  regex: RegExp,
  renderMatch: (match: string, idx: number) => ReactNode
): (string | ReactNode)[] {
  const out: (string | ReactNode)[] = [];
  for (const n of nodes) {
    if (typeof n === 'string') out.push(...parseSegment(n, regex, renderMatch));
    else out.push(n);
  }
  return out;
}

export function WhatsAppText({ text, onEmailClick }: WhatsAppTextProps) {
  if (!text) return null;
  let nodes: (string | ReactNode)[] = [text];

  nodes = walkNodes(nodes, MONO_REGEX, (m, i) => (
    <code key={`m-${i}`} className="font-code bg-foreground/10 rounded px-1 py-0.5 text-[0.9em]">{m}</code>
  ));
  nodes = walkNodes(nodes, BOLD_REGEX, (m, i) => <strong key={`b-${i}`} className="font-semibold">{m}</strong>);
  nodes = walkNodes(nodes, ITALIC_REGEX, (m, i) => <em key={`i-${i}`} className="italic">{m}</em>);
  nodes = walkNodes(nodes, STRIKE_REGEX, (m, i) => <del key={`s-${i}`} className="line-through opacity-80">{m}</del>);
  nodes = walkNodes(nodes, URL_REGEX, (m, i) => (
    <a
      key={`u-${i}`}
      href={m}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="underline font-medium text-info hover:opacity-80"
    >
      {m}
    </a>
  ));
  nodes = walkNodes(nodes, EMAIL_REGEX, (m, i) => (
    <span
      key={`e-${i}`}
      onClick={(e) => {
        if (onEmailClick) {
          e.stopPropagation();
          onEmailClick(e, m);
        }
      }}
      className="underline decoration-dashed cursor-pointer font-medium"
      title="Clic para vincular correo al contacto"
    >
      {m}
    </span>
  ));

  return (
    <p className="text-sm whitespace-pre-wrap break-words leading-snug">
      {nodes.map((n, idx) => <React.Fragment key={idx}>{n}</React.Fragment>)}
    </p>
  );
}
```

---

## 3. Ciclo Completo de Respuestas Rápidas (`/atajo`)

### 3.1 Interpolador Canónico y Popup Flotante `QuickRepliesPopup.tsx` (`z-50`)
```tsx
// src/components/crm/quick-replies-popup.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export interface QuickReplyItem {
  id: string;
  shortcut: string;
  title: string;
  body: string;
}

export function interpolateQuickReplyVariables(
  rawBody: string,
  ctx: { clientName?: string; phone?: string; email?: string; agentName?: string }
): string {
  const firstName = (ctx.clientName || '').trim().split(/\s+/)[0] || 'hola';
  return rawBody
    .replace(/\{\{nombre_cliente\}\}/gi, firstName)
    .replace(/\{\{telefono\}\}/gi, ctx.phone || '')
    .replace(/\{\{correo\}\}/gi, ctx.email || '')
    .replace(/\{\{agente\}\}/gi, ctx.agentName || 'Asesor');
}

interface QuickRepliesPopupProps {
  replies: QuickReplyItem[];
  selectedIndex: number;
  query: string;
  onSelect: (reply: QuickReplyItem) => void;
  onHoverIndex: (index: number) => void;
}

export function QuickRepliesPopup({
  replies,
  selectedIndex,
  query,
  onSelect,
  onHoverIndex,
}: QuickRepliesPopupProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div className="absolute bottom-full left-2 right-2 max-w-sm mb-2 max-h-72 overflow-y-auto bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl z-50 scrollbar-discreet">
      {replies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 text-muted-foreground">
          <Search className="w-5 h-5 mb-2 opacity-40" />
          <p className="text-xs text-center">
            No hay atajos para <span className="font-semibold text-primary">/{query}</span>
          </p>
        </div>
      ) : (
        <>
          {replies.map((qr, idx) => (
            <button
              key={qr.id}
              type="button"
              ref={(el) => { itemRefs.current[idx] = el; }}
              onClick={() => onSelect(qr)}
              onMouseEnter={() => onHoverIndex(idx)}
              className={`w-full text-left px-4 py-2.5 border-b border-border/60 last:border-0 border-l-2 transition-colors cursor-pointer ${
                idx === selectedIndex
                  ? 'bg-primary/15 border-l-primary'
                  : 'border-l-transparent hover:bg-accent/50'
              }`}
            >
              <div className="font-code font-bold text-xs text-primary">/{qr.shortcut}</div>
              <div className="text-xs text-foreground font-semibold mt-0.5">{qr.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {qr.body}
              </div>
            </button>
          ))}
          <div className="sticky bottom-0 px-3 py-1.5 bg-popover border-t border-border text-center">
            <p className="text-[10px] text-muted-foreground">↑↓ navegar · Enter insertar · Esc cerrar</p>
          </div>
        </>
      )}
    </div>
  );
}
```

### 3.2 Editor Enriquecido `RichTextEditor.tsx` para Crear Respuestas Rápidas
Envuelve selección (`selectionStart`..`selectionEnd`) con `*` (negrita), `_` (cursiva), `~` (tachado), `` ``` `` (monoespaciado), inyecta `{{nombre_cliente}}`, `{{telefono}}`, `{{correo}}`, `{{agente}}` y renderiza debajo una burbuja de vista previa real con `bg-chat-outbound text-chat-outbound-foreground` y `<WhatsAppText />`. El campo `/shortcut` sanitiza siempre con `val.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase()`.

---

## 4. Guardián de Ventana 24h Meta y Modo Nota Interna en `ChatInput`

```tsx
// Lógica obligatoria en src/components/crm/chat-input.tsx
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const expiresAtMs = conversation.serviceWindowExpiresAt
  ? Number(conversation.serviceWindowExpiresAt)
  : 0;
const is24hWindowOpen = Boolean(conversation.isServiceWindowOpen && expiresAtMs > Date.now());

// Si !is24hWindowOpen && !isInternalNoteMode:
// 1. Bloquear envío de texto libre/multimedia hacia Dualhook (Meta rechazaría con 131047 Re-engagement message).
// 2. Renderizar barra de acción limpia con dos botones:
//    - "Enviar Plantilla WABA Oficial" (abre TemplateSendModal con TemplateVariableDropdown)
//    - "Escribir Nota Interna Privada" (activa isInternalNoteMode = true usando bg-chat-internal-note,
//      guardando en Firestore con isInternalNote: true sin llamar a Dualhook).
```

### Arquitectura Completa del Workspace (`100dvh`)
1. **`ChatSidebar`**: Switch *Disponible/Ausente* (`crmAvailability`), accesos directos RBAC (`Agenda` si `schedulingModule.enabled`, `Directorio`, `Métricas`, `Sin asignar`, `Configuración`), buscador N-Gram + `ChatFilterPanel` y **4 pestañas fijas** (`Inbox`, `Míos`, `Todos`, `Operativo` con `≤ 4` sub-píldoras dinámicas servidas por 1 solo listener `isOperational == true`).
2. **`ChatHeader`**: Retorno móvil `←`, avatar, nombre/teléfono copiable, origen CTWA Meta Ads, badge de asesor con `getAdvisorBadgeColor`, botón **`Tomar Conversación`** (o `TransferChatModal`), `ChatHeaderTagsBar` (`z-40`) y `ChatContextualToolbar` → `CrmRightPanel`.
3. **`MessageList`**: Scroll infinito (`50 + 50`), *Target Window Mode* al saltar desde buscador, `ImageGridBubble` → `MediaLightboxModal` (`z-[100]`), `VoiceNotePlayer` (`1x / 1.5x / 2x`), `AdReferralPreview`, `SharedContactCard`, `LocationBubble`, reacciones, citas y notas internas `bg-chat-internal-note`.


---

## 5. Envío Nativo de Imágenes/Multimedia CON Texto (Sin Separar) + Cola Secuencial FIFO por Conversación

En WhatsApp nativo, cuando un usuario adjunta 1 o varias fotos/documentos y escribe un texto en el compositor, **el texto viaja unido como `caption` nativo debajo del archivo multimedia** (no como un mensaje de texto separado, ni adelantándose a la imagen por diferencias de peso de subida).

### 5.1 Cola FIFO por Conversación y Reloj Monotónico (`src/hooks/crm/use-crm-send-queue.ts`)
Evita dos fallos críticos en producción:
1. **Colisión de sesión en Meta Cloud API (`502 Bad Gateway / #131000`)** cuando se disparan múltiples `POST /messages` concurrentes al mismo teléfono destinatario.
2. **Desorden visual optimista** cuando se encolan varios archivos en el mismo milisegundo (`Date.now()`).

```typescript
// src/hooks/crm/use-crm-send-queue.ts
const conversationChains = new Map<string, Promise<void>>();
const conversationLastTs = new Map<string, number>();

const INTER_MESSAGE_GAP_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Asigna un timestamp estrictamente creciente por conversación (+5ms en empates)
 * para garantizar el orden determinista de burbujas optimistas y persistidas.
 */
export function allocateMonotonicTimestampMs(conversationId: string): number {
  const now = Date.now();
  const prev = conversationLastTs.get(conversationId) ?? 0;
  const next = now > prev ? now : prev + 5;
  conversationLastTs.set(conversationId, next);
  return next;
}

/**
 * Encola tareas de envío de forma estrictamente secuencial (FIFO) por conversación
 * sin bloquear la interfaz del compositor.
 */
export function enqueueConversationSend<T>(
  conversationId: string,
  task: () => Promise<T>,
  gapAfterMs: number = INTER_MESSAGE_GAP_MS
): Promise<T> {
  const prevChain = conversationChains.get(conversationId) ?? Promise.resolve();

  let resultResolver!: (val: T) => void;
  let resultRejecter!: (err: unknown) => void;
  const resultPromise = new Promise<T>((resolve, reject) => {
    resultResolver = resolve;
    resultRejecter = reject;
  });

  const nextChain = prevChain
    .catch(() => {})
    .then(async () => {
      try {
        const res = await task();
        resultResolver(res);
      } catch (err) {
        resultRejecter(err);
      }
      if (gapAfterMs > 0) {
        await sleep(gapAfterMs);
      }
    });

  conversationChains.set(conversationId, nextChain);
  nextChain.finally(() => {
    if (conversationChains.get(conversationId) === nextChain) {
      conversationChains.delete(conversationId);
    }
  });

  return resultPromise;
}
```

### 5.2 Fusión de Staging (Marketing + Archivos Locales) y Despacho con `caption` Nativo (`ChatArea` + `ChatInput`)
Reglas obligatorias del motor de envío unificado (`handleSendWithMarketing`):
1. **Unificación de Bandeja (`unifiedQueue`)**: Combina primero los activos seleccionados de la Galería de Marketing (`image`, `catalog`, `spec_sheet`, respetando `item.editedFile` si el asesor anotó o recortó la imagen en `ImageEditorModal`) y luego los archivos locales adjuntados/arrastrados/pegados (`stagedFiles`, hasta `10` por lote).
2. **Asignación del `caption` (Opción A — Paridad WhatsApp)**:
   - Si hay **`1` archivo + texto**: ese único archivo recibe `caption = trimmedText` y `replyTo` (si había cita activa). **Cero** mensajes de texto separados.
   - Si hay **`N` archivos + texto**: los archivos `0 .. N-2` se envían **sin `caption`** (para que las fotos consecutivas `< 60s` se agrupen en un álbum `ImageGridBubble`), y el **último archivo (`N-1`) lleva `caption = trimmedText`** debajo de su burbuja (solo si el último adjunto fuera `audio` o `sticker`, que no soportan `caption` en Meta API, se envía un mensaje de texto posterior).
3. **Ruteo Automático de GIFs y Guarda de Audio WebM**:
   - Todo archivo `.gif` (`file.type === 'image/gif' || /\.gif$/i.test(file.name)`) se clasifica como `type: 'video'` para que la Cloud Function `compressAndSendVideo` lo transcodifique con FFmpeg a MP4 H.264 sin audio (ya que Meta Cloud API rechaza `image/gif` en `type: 'image'` con error `131053`).
   - Todo archivo `audio/webm` se rechaza preventivamente en cliente antes de subir a Storage, exigiendo grabación en `audio/ogg; codecs=opus` o `audio/mp4`.
4. **Preservación de `clientCreatedAtMs` en `POST /api/crm/messages/send`**:
   - El endpoint recibe `clientCreatedAtMs` (generado por `allocateMonotonicTimestampMs`) y, si está dentro de una ventana de `±5 min` respecto al reloj del servidor (`Math.abs(Date.now() - clientCreatedAtMs) < 300_000`), persiste `createdAt: Timestamp.fromMillis(clientCreatedAtMs)` en Firestore para que el orden de las burbujas nunca cambie tras el ACK del servidor.

```typescript
// Fragmento ejecutable de despacho unificado con caption nativo (src/components/crm/chat-area.tsx)
const handleSendUnifiedBatch = async (
  rawText: string,
  localFiles: File[] = [],
  stagedMarketingItems: MarketingItem[] = []
) => {
  const trimmedText = rawText.trim();
  const currentReply = replyingTo;
  if (currentReply) setReplyingTo(null);

  type QueuedMediaJob =
    | { kind: 'marketing_EditedFile'; file: File; mediaType: 'image' }
    | { kind: 'marketing_Url'; url: string; mediaType: 'image' | 'document'; filename: string }
    | { kind: 'local_File'; file: File; mediaType: 'image' | 'video' | 'audio' | 'document' };

  const jobs: QueuedMediaJob[] = [];

  for (const item of stagedMarketingItems) {
    if (item.editedFile) {
      jobs.push({ kind: 'marketing_EditedFile', file: item.editedFile, mediaType: 'image' });
    } else {
      const isDoc = item.type === 'catalog' || item.type === 'spec_sheet';
      const safeName = item.name.replace(/[^\w\s.-]/g, '').trim() || 'Documento';
      jobs.push({
        kind: 'marketing_Url',
        url: item.imageUrl,
        mediaType: isDoc ? 'document' : 'image',
        filename: isDoc ? (safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`) : safeName,
      });
    }
  }

  for (const file of localFiles) {
    const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
    const mediaType = isGif
      ? 'video'
      : file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
      ? 'audio'
      : 'document';
    jobs.push({ kind: 'local_File', file, mediaType });
  }

  // Caso 1: Solo texto (sin adjuntos)
  if (jobs.length === 0) {
    if (trimmedText) {
      await onSendMessage(trimmedText, currentReply || undefined);
    }
    return;
  }

  // Caso 2: 1..N adjuntos + texto opcional -> el último adjunto compatible lleva el caption nativo
  const lastJob = jobs[jobs.length - 1];
  const lastSupportsCaption =
    lastJob.mediaType === 'image' ||
    lastJob.mediaType === 'video' ||
    lastJob.mediaType === 'document';
  const attachCaptionToLast = Boolean(trimmedText) && lastSupportsCaption;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const isFirst = i === 0;
    const isLast = i === jobs.length - 1;
    const captionForThisItem = isLast && attachCaptionToLast ? trimmedText : undefined;
    const replyForThisItem = isFirst ? currentReply || undefined : undefined;

    if (job.kind === 'marketing_Url') {
      await onSendMediaByUrl(
        job.url,
        job.mediaType,
        job.filename,
        captionForThisItem,
        replyForThisItem
      );
    } else {
      await onSendMedia(job.file, job.mediaType, captionForThisItem, replyForThisItem);
    }
  }

  // Fallback exclusivo si el último adjunto fue audio/sticker y había texto
  if (trimmedText && !attachCaptionToLast) {
    await onSendMessage(trimmedText);
  }
};
```

### 5.3 Regla de Agrupación de Álbum (`isGroupableAlbumImage`) vs. Burbuja con Caption (`MessageList` + `MessageBubbleMedia`)
- En `MessageList.tsx`, solo se agrupan en `ImageGridBubble` (ventana `< 60_000 ms`, mismo `senderId`) las imágenes que **NO tienen `caption` de usuario ni `replyTo`**:
  ```typescript
  const SYSTEM_PLACEHOLDERS = new Set(['📷 Imagen', '🎥 Video', '🎵 Audio', '🎵 Nota de voz', '📄 Documento', '🏷️ Sticker', '[image]', '[media]']);
  export function isSystemPlaceholder(text?: string | null): boolean {
    if (!text || !text.trim()) return true;
    return SYSTEM_PLACEHOLDERS.has(text.trim());
  }
  export function isGroupableAlbumImage(msg: Message): boolean {
    return msg.type === 'image' && isSystemPlaceholder(msg.text) && !msg.replyTo;
  }
  ```
- Si una imagen tiene `caption` real (`!isSystemPlaceholder(msg.text)`), se renderiza en su propio `MessageBubbleMedia` mostrando la imagen arriba y el `<WhatsAppText text={msg.text} />` integrado debajo dentro de la misma burbuja.
- En documentos (`type === 'document'` / `'pdf'`), `MessageBubbleMedia` suprime el `caption` si coincide con `media.filename` (`msg.text.trim() === msg.media?.filename?.trim()`) para no repetir el nombre del PDF dos veces.

---

## 6. Motor Dual de Lectura de Historial Profundo, Anclaje de Scroll y Búsqueda Híbrida Intra-Chat

### 6.1 Hook Dual `useCrmMessages(conversationId, targetMessageId)` (`src/hooks/crm/use-crm-messages.ts`)
Resuelve la lectura fluida de conversaciones con miles de mensajes combinando dos modos automáticos:
1. **Modo Normal (`!targetMessageId` o `loadedIdsRef.current.has(targetMessageId)`)**:
   - Si el usuario salta desde el buscador a un `targetMessageId` que **ya está cargado en RAM** (`loadedIdsRef.current.has(targetMessageId)`), el hook **NO** desmonta la lista ni hace lecturas adicionales: permanece en Modo Normal y hace scroll instantáneo al nodo DOM.
   - Suscripción en vivo `onSnapshot` con `orderBy('createdAt', 'desc'), limit(limitCount)` (bloques de `50` mensajes).
2. **Modo Ventana Objetivo (`targetMessageId` fuera de RAM)**:
   - Lee el documento objetivo (`getDoc`), descarga en paralelo `30` mensajes anteriores (`orderBy('createdAt', 'desc'), startAt(targetSnap), limit(31)`) y `30` posteriores (`orderBy('createdAt', 'asc'), startAt(targetSnap), limit(31)`).
   - Abre un listener `onSnapshot` delta en vivo (`where('createdAt', '>', newestTimestamp)`) para que cualquier mensaje nuevo entrante o saliente se agregue al final sin perder la vista histórica.
   - Permite seguir subiendo hacia atrás con `loadMore` basado en cursor (`startAfter(targetOldestDocRef.current), limit(50)`), y volver al presente con `resetToRecent()`.
3. **Hidratación O(N) de Citas (`replyTo`)**:
   - Al transformar los documentos, construye mapas `byId` y `byWaId` en memoria para inyectar automáticamente `mediaUrl`, `text` y `type` en cualquier mensaje que cite (`context.quotedMessageId` / `context.quotedWaMessageId`) a otro mensaje de la ventana.

### 6.2 Anclaje de Scroll sin Saltos (`useLayoutEffect`) en `MessageList.tsx`
Cuando el usuario sube al tope (`scrollTop <= 120`) y se anteponen `50` mensajes antiguos al inicio del array, el navegador desplazaría la vista bruscamente si no se compensa `scrollHeight` antes del repintado:

```tsx
// Patrón obligatorio de anclaje pre-paint en src/components/crm/message-list.tsx
const containerRef = useRef<HTMLDivElement>(null);
const prePrependRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
const prevFirstMsgIdRef = useRef<string | null>(null);

const triggerLoadMore = useCallback(() => {
  const el = containerRef.current;
  if (!el || isLoadingMore || !hasMore) return;
  prePrependRef.current = {
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
  };
  onLoadMore();
}, [isLoadingMore, hasMore, onLoadMore]);

useLayoutEffect(() => {
  const el = containerRef.current;
  const firstId = messages[0]?.id ?? null;
  if (
    el &&
    prePrependRef.current &&
    firstId &&
    prevFirstMsgIdRef.current &&
    firstId !== prevFirstMsgIdRef.current
  ) {
    const { scrollTop: prevTop, scrollHeight: prevHeight } = prePrependRef.current;
    const heightDelta = el.scrollHeight - prevHeight;
    if (heightDelta > 0) {
      el.scrollTop = prevTop + heightDelta;
    }
    prePrependRef.current = null;
  }
  prevFirstMsgIdRef.current = firstId;
}, [messages]);
```
Además, cuando se busca un `targetMessageId` que quedó agrupado dentro de un `ImageGridBubble`, cada celda del álbum expone `data-sub-message-id={subMsg.id}` para que `MessageList` pueda localizarla (`querySelector('[data-message-id="..."], [data-sub-message-id="..."]')`), centrarla en pantalla y aplicarle el anillo de resaltado temporal.

### 6.3 Búsqueda Híbrida Intra-Chat (`ChatInSearchBar` + `GET /api/crm/messages/search`)
- **En RAM (`0 ms`)**: Filtra inmediatamente los mensajes ya cargados en `messages` (normalizando tildes con `normalizeSearchText`).
- **En Servidor (`260 ms` debounce + `AbortController`)**: Llama a `GET /api/crm/messages/search?conversationId=${chatId}&q=${query}`, que escanea hasta `3,000` mensajes de la subcolección (`orderBy('createdAt', 'desc'), limit(3000)`) buscando coincidencias sin tildes en `body`, `media.filename`, `location.name` y `location.address`.
- **Fusión Cronológica**: Combina IDs locales y remotos sin duplicados, ordenados de más antiguo a más reciente, posicionando el cursor en la coincidencia más reciente (`N de N`) y permitiendo navegar con `Enter` (anterior) y `Shift+Enter` (siguiente).

---

## 7. Listeners Singleton Compartidos (`useCrmConversations` con `unreadMap`, `useCrmTags`, `useQuickReplies` y `crm-phone.ts`)

### 7.1 Normalización E.164 Parametrizada White-Label (`src/lib/utils/crm-phone.ts`)
Evita duplicar contactos o conversaciones cuando un teléfono llega como `88888888`, `50688888888`, `0050688888888` o `+50688888888`:

```typescript
// src/lib/utils/crm-phone.ts
export function stripPhoneDigits(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  return String(rawPhone).replace(/[^\d]/g, '');
}

export function normalizeE164Phone(
  rawPhone?: string | null,
  defaultCountryCallingCode = '506',
  localPhoneLength = 8
): string {
  if (!rawPhone) return '';
  const trimmed = String(rawPhone).trim();
  if (!trimmed) return '';

  let digits = stripPhoneDigits(trimmed);
  if (!digits) return '';

  if (!trimmed.startsWith('+') && digits.startsWith('00') && digits.length >= 10) {
    digits = digits.slice(2);
  }
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === localPhoneLength) return `+${defaultCountryCallingCode}${digits}`;
  if (
    digits.startsWith(defaultCountryCallingCode) &&
    digits.length === defaultCountryCallingCode.length + localPhoneLength
  ) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export function getPhoneVariants(
  rawPhone?: string | null,
  defaultCountryCallingCode = '506',
  localPhoneLength = 8
): string[] {
  const normalized = normalizeE164Phone(rawPhone, defaultCountryCallingCode, localPhoneLength);
  if (!normalized) return [];
  const digits = stripPhoneDigits(normalized);
  const variants = new Set<string>();
  const fullLen = defaultCountryCallingCode.length + localPhoneLength;

  if (digits.startsWith(defaultCountryCallingCode) && digits.length === fullLen) {
    const local = digits.slice(defaultCountryCallingCode.length);
    variants.add(`+${defaultCountryCallingCode}${local}`);
    variants.add(`${defaultCountryCallingCode}${local}`);
    variants.add(local);
  } else if (digits.length === localPhoneLength) {
    variants.add(`+${defaultCountryCallingCode}${digits}`);
    variants.add(`${defaultCountryCallingCode}${digits}`);
    variants.add(digits);
  } else {
    variants.add(`+${digits}`);
    variants.add(digits);
  }
  return Array.from(variants);
}
```

### 7.2 Arquitectura de Mapas Singleton en `useCrmConversations`, `useCrmTags` y `useQuickReplies`
1. **Mapas Dedicados en `useCrmConversations`**:
   - Mantiene listeners `onSnapshot` compartidos a nivel de módulo (`inboxMap`, `assignedMap`, `operationalMap` / divisiones, `recentMap` [admin `limit(300)`], **`unreadMap` [admin `where('unreadCount', '>', 0), limit(300)` — garantiza que ningún chat sin leer quede oculto aunque tenga más de 300 chats recientes encima]**, `taggedMap` y `onDemandMap`).
   - `fetchConversation({ id, phone, contactId })` busca **primero en `mergedChatsMap` en RAM (`0` lecturas Firestore)** cruzando `getPhoneVariants(phone)`; solo si no está en memoria consulta Firestore con todas las variantes y lo inyecta en `onDemandMap`.
2. **Singletons `useCrmTags` y `useQuickReplies`**:
   - Ambos hooks usan un `Set` de suscriptores a nivel de módulo (`tagSubscribers`, `qrSubscribers`) y una única suscripción `onSnapshot` compartida, evitando abrir decenas de listeners duplicados cuando se montan múltiples tarjetas o modales.


---

## 8. Pipeline Completo de Audio en el Chat: Grabación WASM OGG Opus Saliente, Barra de Pre-Escucha y Reproductor Visual `VoiceNotePlayer` (Enviado y Recibido)

### 8.1 Hook de Grabación Nativa en Navegador `useAudioRecorder.ts` (`OpusMediaRecorder` WASM `audio/ogg; codecs=opus` + Bloqueo de `audio/webm`)
Meta Cloud API rechaza notas de voz en formato `audio/webm` con error `131053`. Para garantizar que todo audio grabado desde cualquier navegador (Chrome, Edge, Firefox, Safari macOS/iOS) sea 100% compatible como nota de voz nativa en WhatsApp:
1. Prioriza **`opus-media-recorder` WASM** cargando `/opus-media-recorder/OggOpusEncoder.wasm` y `/opus-media-recorder/encoderWorker.umd.js` desde `/public/`, produciendo un archivo real `audio/ogg` con códec Opus.
2. En Safari iOS (si el worker WASM no estuviera disponible), hace fallback a `audio/mp4` (`m4a`).
3. Bloquea de raíz cualquier salida `audio/webm` mostrando un mensaje claro al usuario antes de intentar subir a Firebase Storage.

```typescript
// src/hooks/crm/use-audio-recorder.ts
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error';

export interface AudioRecorderResult {
  state: RecordingState;
  durationSeconds: number;
  audioFile: File | null;
  audioUrl: string | null;
  errorMessage: string | null;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
  resetRecorder: () => void;
}

export function useAudioRecorder(): AudioRecorderResult {
  const [state, setState] = useState<RecordingState>('idle');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const cleanupAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
      setAudioUrl(null);
    }
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    cleanupAudioUrl();
    setAudioFile(null);
    chunksRef.current = [];
    setState('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let recorder: any = null;
      let preferredMime = 'audio/ogg';

      try {
        const OpusMediaRecorder = (await import('opus-media-recorder')).default;
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const workerOptions = {
          OggOpusEncoderWasmPath: `${origin}/opus-media-recorder/OggOpusEncoder.wasm`,
          WebMOpusEncoderWasmPath: `${origin}/opus-media-recorder/WebMOpusEncoder.wasm`,
          encoderWorkerFactory: () => new Worker(`${origin}/opus-media-recorder/encoderWorker.umd.js`),
        };
        recorder = new OpusMediaRecorder(stream, { mimeType: 'audio/ogg;codecs=opus' }, workerOptions);
        preferredMime = 'audio/ogg';
      } catch (err) {
        console.warn('[useAudioRecorder] OpusMediaRecorder load error, fallback to native:', err);
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          preferredMime = 'audio/ogg;codecs=opus';
        } else if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')) {
          preferredMime = 'audio/mp4';
        } else {
          releaseStream();
          stopTimer();
          setErrorMessage(
            'Tu navegador solo produjo audio WebM (no compatible con notas de voz de WhatsApp). Recarga la página para activar el codificador OGG Opus o usa Safari/Chrome actualizado.'
          );
          setState('error');
          return;
        }
        recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      }

      mediaRecorderRef.current = recorder;

      recorder.onerror = (event: any) => {
        console.error('[useAudioRecorder] Recorder runtime error:', event);
        releaseStream();
        stopTimer();
        setErrorMessage('Ocurrió un error al codificar la nota de voz. Intenta grabar nuevamente.');
        setState('error');
      };

      recorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mime = preferredMime.includes('ogg')
          ? 'audio/ogg'
          : preferredMime.includes('mp4')
          ? 'audio/mp4'
          : preferredMime;

        if (mime.includes('webm')) {
          releaseStream();
          stopTimer();
          setErrorMessage('Formato de audio WebM no compatible con WhatsApp Cloud API.');
          setState('error');
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = mime.includes('ogg') ? 'ogg' : 'm4a';
        const file = new File([blob], `nota_voz_${Date.now()}.${ext}`, { type: mime });
        const url = URL.createObjectURL(blob);

        setAudioFile(file);
        setAudioUrl(url);
        setState('stopped');
        releaseStream();
        stopTimer();
      };

      recorder.start(250);
      setState('recording');
      setDurationSeconds(0);

      timerRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      releaseStream();
      stopTimer();
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Permiso de micrófono denegado. Actívalo en la configuración del navegador.'
          : 'No se pudo acceder al micrófono.';
      setErrorMessage(msg);
      setState('error');
    }
  }, [releaseStream, stopTimer, cleanupAudioUrl]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      try {
        mediaRecorderRef.current.pause();
      } catch (err) {
        console.error('[pauseRecording error]:', err);
      }
      stopTimer();
      setState('paused');
    }
  }, [state, stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'paused') {
      try {
        mediaRecorderRef.current.resume();
      } catch (err) {
        console.error('[resumeRecording error]:', err);
      }
      setState('recording');
      timerRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    }
  }, [state]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      stopTimer();
      mediaRecorderRef.current.stop();
    }
  }, [stopTimer]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    releaseStream();
    stopTimer();
    cleanupAudioUrl();
    chunksRef.current = [];
    setAudioFile(null);
    setDurationSeconds(0);
    setErrorMessage(null);
    setState('idle');
  }, [releaseStream, stopTimer, cleanupAudioUrl]);

  const resetRecorder = useCallback(() => {
    cleanupAudioUrl();
    chunksRef.current = [];
    setAudioFile(null);
    setDurationSeconds(0);
    setErrorMessage(null);
    setState('idle');
  }, [cleanupAudioUrl]);

  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, [stopTimer, releaseStream]);

  return {
    state,
    durationSeconds,
    audioFile,
    audioUrl,
    errorMessage,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    resetRecorder,
  };
}
```

### 8.2 Barra Interactiva de Grabación y Pre-Escucha antes de Enviar (`src/components/crm/audio-record-bar.tsx`)
Cuando el asesor presiona el ícono de micrófono (`Mic`) en `ChatInput`, el compositor muta a `AudioRecordBar`, permitiendo pausar, reanudar, detener para pre-escuchar la nota de voz con scrubber interactivo, descartar (`Trash2`) o despachar (`Send`):

```tsx
// src/components/crm/audio-record-bar.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, Pause, Play, Square, Mic, Send, AlertCircle, X } from 'lucide-react';
import { RecordingState } from '@/hooks/crm/use-audio-recorder';

interface AudioRecordBarProps {
  state: RecordingState;
  durationSeconds: number;
  audioUrl: string | null;
  errorMessage: string | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
  onReset: () => void;
  onSend: () => void;
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function AudioRecordBar({
  state,
  durationSeconds,
  audioUrl,
  errorMessage,
  onPause,
  onResume,
  onStop,
  onCancel,
  onReset,
  onSend,
  disabled = false,
}: AudioRecordBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (state !== 'stopped') {
      setIsPlaying(false);
      setPlaybackTime(0);
    }
  }, [state]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('[AudioRecordBar] Playback error:', err));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setPlaybackTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setPlaybackTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlaybackTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  if (state === 'error') {
    return (
      <div className="p-3 bg-destructive/10 border-t border-border">
        <div className="flex items-center gap-3 bg-card border border-destructive/30 rounded-xl p-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive flex-1">{errorMessage || 'Error en la grabación de audio'}</p>
          <button
            type="button"
            onClick={onReset}
            className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (state === 'requesting') {
    return (
      <div className="p-3 bg-card border-t border-border">
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-2xl p-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
          </span>
          <span className="text-sm font-medium text-foreground flex-1">Accediendo al micrófono...</span>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-full transition-colors"
            title="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (state === 'stopped') {
    return (
      <div className="p-3 bg-card border-t border-border">
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            className="hidden"
          />
        )}
        <div className="flex items-center gap-3 bg-muted/50 border border-border rounded-2xl p-2.5 shadow-xs">
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors flex-shrink-0"
            title="Descartar audio"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={disabled}
            className="p-2 text-primary-foreground bg-primary hover:opacity-90 rounded-full transition-opacity flex-shrink-0 shadow-xs"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <div className="flex-1 flex flex-col justify-center min-w-0">
            <input
              type="range"
              min={0}
              max={durationSeconds || 1}
              step={0.1}
              value={playbackTime}
              onChange={handleSeek}
              disabled={disabled}
              className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground font-mono mt-1">
              <span>{formatDuration(playbackTime)}</span>
              <span>{formatDuration(durationSeconds)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSend}
            disabled={disabled}
            className="p-2.5 text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 rounded-full transition-opacity flex-shrink-0 shadow-xs"
            title="Enviar nota de voz"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>
    );
  }

  const isPaused = state === 'paused';

  return (
    <div className="p-3 bg-card border-t border-border">
      <div
        className={`flex items-center gap-3 rounded-2xl p-2.5 border transition-all ${
          isPaused
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-destructive/10 border-destructive/30 shadow-xs'
        }`}
      >
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors flex-shrink-0"
          title="Cancelar y descartar"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <div className="flex-1 flex items-center gap-2.5 overflow-hidden">
          {isPaused ? (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
          ) : (
            <span className="relative flex h-3 w-3 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
            </span>
          )}

          <span className="text-sm font-mono font-semibold text-foreground">
            {formatDuration(durationSeconds)}
          </span>

          {!isPaused ? (
            <div className="flex items-center gap-0.5 h-4 ml-1">
              <span className="w-0.5 h-2 bg-destructive/70 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
              <span className="w-0.5 h-3.5 bg-destructive rounded-full animate-[pulse_0.4s_ease-in-out_infinite]" />
              <span className="w-0.5 h-2.5 bg-destructive/70 rounded-full animate-[pulse_0.7s_ease-in-out_infinite]" />
              <span className="w-0.5 h-4 bg-destructive rounded-full animate-[pulse_0.5s_ease-in-out_infinite]" />
              <span className="w-0.5 h-1.5 bg-destructive/70 rounded-full animate-[pulse_0.8s_ease-in-out_infinite]" />
            </div>
          ) : (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Pausado
            </span>
          )}
        </div>

        {isPaused ? (
          <button
            type="button"
            onClick={onResume}
            className="p-2 text-destructive hover:bg-amber-500/15 rounded-full transition-colors flex-shrink-0"
            title="Reanudar grabación"
          >
            <Mic className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className="p-2 text-destructive hover:bg-destructive/15 rounded-full transition-colors flex-shrink-0"
            title="Pausar grabación"
          >
            <Pause className="w-5 h-5" />
          </button>
        )}

        <button
          type="button"
          onClick={onStop}
          className="p-2 text-white bg-destructive hover:opacity-90 rounded-full transition-opacity flex-shrink-0 shadow-xs"
          title="Finalizar y revisar"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  );
}
```

### 8.3 Reproductor Visual de Notas de Voz en Burbujas Enviadas y Recibidas (`src/components/crm/voice-note-player.tsx`)
Renderiza cualquier mensaje `type === 'audio'` (tanto notas de voz enviadas desde el CRM/móvil `isUs === true` como notas de voz recibidas del cliente `isUs === false`). Si por alguna razón un audio histórico aún no tenía `mediaUrl` en Storage, presenta el botón de descarga bajo demanda; cuando `mediaUrl` está disponible, despliega el reproductor con Play/Pause, scrubber de línea de tiempo, contador `currentTime / duration` y selector de velocidad (`1x` / `1.5x` / `2x`):

```tsx
// src/components/crm/voice-note-player.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';

interface VoiceNotePlayerProps {
  mediaUrl?: string;
  isUs: boolean;
  onDownload?: () => void;
  downloading?: boolean;
}

const PLAYBACK_RATES = [1, 1.5, 2] as const;

export function VoiceNotePlayer({ mediaUrl, isUs, onDownload, downloading }: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [rateIdx, setRateIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!mediaUrl) return;
    const audio = new Audio(mediaUrl);
    audio.preload = 'metadata';
    audio.playbackRate = PLAYBACK_RATES[rateIdx];
    audioRef.current = audio;

    const setAudioData = () => {
      if (isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    const onError = () => {
      console.warn('[VoiceNotePlayer Error]:', audio.error, mediaUrl);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('durationchange', setAudioData);
    audio.addEventListener('canplay', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('durationchange', setAudioData);
      audio.removeEventListener('canplay', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, [mediaUrl]);

  const togglePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        audioRef.current.playbackRate = PLAYBACK_RATES[rateIdx];
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('[VoiceNotePlayer play error]:', err);
        setIsPlaying(false);
      }
    }
  };

  const cycleRate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (rateIdx + 1) % PLAYBACK_RATES.length;
    setRateIdx(nextIdx);
    if (audioRef.current) {
      audioRef.current.playbackRate = PLAYBACK_RATES[nextIdx];
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const newTime = (Number(e.target.value) / 100) * duration;
    audioRef.current.currentTime = newTime;
    setProgress(Number(e.target.value));
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (!mediaUrl && onDownload) {
    return (
      <div
        className={`flex items-center gap-3 w-52 h-14 rounded-full px-2 py-1 cursor-pointer transition-colors duration-150 ease-out ${
          isUs
            ? 'bg-black/15 hover:bg-black/25 text-chat-outbound-foreground'
            : 'bg-muted hover:bg-muted/80 text-foreground'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onDownload();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDownload();
          }
        }}
        aria-label="Descargar nota de voz"
      >
        <button
          type="button"
          aria-label="Descargar nota de voz"
          className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full ${
            isUs ? 'bg-white text-primary' : 'bg-primary text-primary-foreground'
          }`}
        >
          <Download className="w-5 h-5" />
        </button>
        <div className="flex flex-col flex-1">
          <span className="text-xs font-medium opacity-90">
            {downloading ? 'Descargando 2do plano...' : 'Descargar audio'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 w-64 h-14 rounded-full px-2 py-1 my-1 ${
        isUs ? 'bg-black/15 text-chat-outbound-foreground' : 'bg-muted text-foreground'
      }`}
      onClick={(e) => e.stopPropagation()}
      style={{ '--thumb-bg': isUs ? '#ffffff' : 'hsl(var(--primary))' } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={togglePlayPause}
        aria-label={isPlaying ? 'Pausar nota de voz' : 'Reproducir nota de voz'}
        className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full transition-transform duration-150 ease-out motion-safe:active:scale-95 shadow-xs ${
          isUs ? 'bg-white text-primary hover:opacity-90' : 'bg-primary text-primary-foreground hover:opacity-90'
        }`}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </button>

      <div className="flex flex-col flex-1 gap-1 min-w-0">
        <div className="flex items-center h-4 group">
          <input
            type="range"
            min="0"
            max="100"
            aria-label="Línea de tiempo de la nota de voz"
            value={isNaN(progress) ? 0 : progress}
            onChange={handleSeek}
            className="w-full h-1.5 appearance-none rounded-full outline-none cursor-pointer transition-all duration-150 ease-out"
            style={{
              background: `linear-gradient(to right, ${
                isUs ? '#fff' : 'hsl(var(--primary))'
              } ${progress}%, ${isUs ? 'rgba(255,255,255,0.3)' : 'rgba(148,163,184,0.35)'} ${progress}%)`,
            }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] font-medium opacity-80 mt-0.5">
          <span>
            {isPlaying || currentTime > 0
              ? formatTime(currentTime)
              : duration > 0
              ? formatTime(duration)
              : '0:00'}
          </span>
          {duration > 0 && <span>{formatTime(duration)}</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={cycleRate}
        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 transition-colors ${
          isUs
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-background hover:bg-accent text-foreground border border-border'
        }`}
        title="Cambiar velocidad de reproducción"
      >
        {PLAYBACK_RATES[rateIdx]}x
      </button>
    </div>
  );
}
```


---

## 9. Suite Completa de Componentes Visuales de Burbujas, Ubicaciones GPS, Contactos Compartidos, Anuncios CTWA, Álbumes, Lightbox, Editor de Imágenes y Stickers

### 9.1 Burbuja Maestra `MessageBubble.tsx` y Renderizador Multimedia/GPS `MessageBubbleMedia.tsx`
Estos dos componentes trabajan en conjunto para desplegar todos los tipos de mensajes de WhatsApp (`text`, `image`, `video`, `audio`, `document`, `sticker`, `location`, `contacts`, `template`, `revoke` y `system`), integrando:
1. **Ubicaciones GPS (`location`) y Links de Mapas (`Google Maps` / `Waze`)**:
   - Cuando `message.type === 'location'` (recibida del cliente o enviada desde el móvil `smb_message_echoes` / `[location desde móvil]`), `MessageBubbleMedia` renderiza la tarjeta visual del mapa con `MapPin` animado, nombre/dirección y enlace directo a `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`.
   - Además, `MessageBubble` detecta tanto coordenadas nativas como cualquier enlace `google.com/maps`, `maps.app.goo.gl` o `waze.com` en el texto y habilita en el menú `⋮` (y en clic derecho sobre el mapa/link) la acción **"Agregar a Agenda / Entregas"** (`onAddDelivery(mapUrlToSend)`).
2. **Detección Automática de Correos Electrónicos**:
   - Extrae cualquier correo en el mensaje con `EMAIL_REGEX` y permite guardarlo en 1 clic directamente en el perfil del contacto (`saveEmailToContact`).
3. **Insignias de Canal (`Bot` / `Smartphone` Móvil / `Monitor` Web), Citas, Reenviados (`CornerUpRight`), Mensajes Eliminados (`[Mensaje revoke]`) y Píldora de Reacciones (`message.reactions`)**.

```tsx
// src/components/crm/message-bubble.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Message } from '@/lib/types/crm';
import {
  Bot,
  FileText,
  Smartphone,
  Monitor,
  MapPin,
  Mail,
  Copy,
  AlertCircle,
  Forward,
  CornerUpRight,
  Sticker,
  Ban,
  Clock,
} from 'lucide-react';
import { useCrmActions } from '@/hooks/crm/use-crm-actions';
import { useCrmStickers } from '@/hooks/crm/use-crm-stickers';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppText } from '@/lib/utils/whatsapp-parser';
import { MediaLightboxModal } from './media-lightbox-modal';
import { TemplatePreview } from './template-preview';
import { QuotedMessagePreview } from './quoted-message-preview';
import { MessageBubbleMedia } from './message-bubble-media';
import { AdReferralPreview } from './ad-referral-preview';
import { SharedContactCard } from './shared-contact-card';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const SYSTEM_GENERATED_TEXTS = new Set([
  '📷 Foto',
  '📷 Foto (Móvil)',
  '📷 Imagen',
  '🎥 Video',
  '🎥 Video (Móvil)',
  '🎵 Nota de voz',
  '🎵 Nota de voz (Móvil)',
  '🎵 Audio',
  '📄 Documento',
  '📄 Documento (Móvil)',
  '🏷️ Sticker',
  '📍 Ubicación',
  '📍 Ubicación (Móvil)',
]);

export const isSystemPlaceholder = (text?: string): boolean => {
  if (!text) return true;
  if (SYSTEM_GENERATED_TEXTS.has(text)) return true;
  const clean = text.trim().toLowerCase();
  if (clean === '[location desde móvil]') return true;
  return /^\[(image|video|audio|document|sticker|file|archivo|foto|location)\]$/i.test(clean);
};

export const isForwardedAudioPlaceholder = (text?: string): boolean => {
  if (!text) return false;
  const clean = text.trim().toLowerCase();
  return clean === 'audio message' || clean === 'audio message omitted' || clean === 'audio omitido';
};

interface MessageBubbleProps {
  message: Message;
  contactId?: string;
  conversationId?: string;
  scheduleActionLabel?: string;
  onAddDelivery?: (url: string) => void;
  onReply?: (msg: Message) => void;
  onForward?: (msg: Message) => void;
  onScrollToMessage?: (replyTo: NonNullable<Message['replyTo']>) => void;
}

export function MessageBubble({
  message,
  contactId,
  conversationId,
  scheduleActionLabel = 'Agregar a Agenda',
  onAddDelivery,
  onReply,
  onForward,
  onScrollToMessage,
}: MessageBubbleProps) {
  const { downloadMedia, deleteMedia, saveEmailToContact } = useCrmActions();
  const { saveExistingMediaAsSticker, stickers } = useCrmStickers();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [linkMenu, setLinkMenu] = useState<{ x: number; y: number; url: string } | null>(null);
  const [showDotMenu, setShowDotMenu] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; type: 'image' | 'video'; caption?: string } | null>(null);

  const dotMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dotMenuRef.current && !dotMenuRef.current.contains(event.target as Node)) {
        setShowDotMenu(false);
      }
    };
    if (showDotMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDotMenu]);

  const isSystem = message.senderId === 'system';
  const isUs = message.senderId === 'user' || message.senderId === 'bot';
  const isBot = message.senderId === 'bot';

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleDownload = async () => {
    if (!message.media?.mediaId) return;
    setDownloading(true);
    try {
      await downloadMedia(message.chatId, message.id, message.media.mediaId);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!message.media?.storagePath) return;
    try {
      await deleteMedia(message.chatId, message.id, message.media.storagePath);
      setShowMenu(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSticker = async () => {
    const url = message.mediaUrl || message.media?.url || null;
    if (!url) return;
    const alreadySaved = stickers.some((s) => s.url === url);
    if (alreadySaved) {
      toast({ title: 'Sticker ya guardado', description: 'Este sticker ya está en tu biblioteca.' });
      setShowDotMenu(false);
      return;
    }
    const result = await saveExistingMediaAsSticker(url, 'Sticker de chat');
    if (result) {
      toast({ title: '⭐ Sticker guardado', description: 'Disponible para todos los agentes.' });
    } else {
      toast({ title: 'Error al guardar sticker', variant: 'destructive' });
    }
    setShowDotMenu(false);
  };

  useEffect(() => {
    if (message.type === 'sticker' && !message.mediaUrl && message.media?.mediaId && !downloading) {
      handleDownload();
    }
  }, [message.type, message.mediaUrl, message.media?.mediaId]);

  if (isSystem) {
    return (
      <div className="flex w-full justify-center my-3">
        <span className="px-3 py-1 bg-muted text-muted-foreground rounded-lg text-xs font-medium text-center">
          {message.text}
        </span>
      </div>
    );
  }

  const isForwardedAudio = isForwardedAudioPlaceholder(message.text);
  const isAudio = message.type === 'audio' || isForwardedAudio;

  const detectedEmails = message.text ? Array.from(new Set(message.text.match(EMAIL_REGEX) || [])) : [];
  const mapLinks = message.text
    ? message.text.match(/https?:\/\/(www\.)?(google\.com\/maps|maps\.app\.goo\.gl|maps\.google\.com|waze\.com)[^\s]*/g) || []
    : [];
  const isNativeLocation =
    message.type === 'location' &&
    message.location &&
    (message.location.latitude !== 0 || message.location.longitude !== 0);
  const mapUrlToSend = isNativeLocation
    ? `https://www.google.com/maps/search/?api=1&query=${message.location!.latitude},${message.location!.longitude}`
    : mapLinks[0] || null;

  const handleSaveEmail = async (email: string) => {
    if (!contactId || !conversationId) return;
    const ok = await saveEmailToContact(contactId, conversationId, email);
    if (ok) {
      toast({ title: '✅ Correo guardado', description: `${email} guardado en el perfil del cliente.` });
    } else {
      toast({ title: 'Error al guardar correo', variant: 'destructive' });
    }
    setShowDotMenu(false);
  };

  const renderText = () => {
    if (message.type === 'template' && message.templateComponents && message.templateComponents.length > 0) {
      return (
        <div className="w-full min-w-[240px] max-w-[340px]">
          <TemplatePreview components={message.templateComponents} bodyText={message.text} isChatMessage={true} className="!p-0" />
        </div>
      );
    }

    if (message.text?.trim() === '[Mensaje revoke]') {
      return <span className="text-xs italic text-muted-foreground">Este mensaje fue eliminado por el remitente.</span>;
    }

    if (
      !message.text ||
      isSystemPlaceholder(message.text) ||
      message.type === 'sticker' ||
      isAudio ||
      message.type === 'location' ||
      message.type === 'image' ||
      message.type === 'video' ||
      message.type === 'document' ||
      message.type === 'contacts'
    ) {
      return null;
    }

    if (message.type === 'template') {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1 mb-1">
            <FileText className="w-3 h-3 opacity-80 shrink-0" />
            <span className="text-[10px] opacity-75 font-medium uppercase tracking-wide">
              {message.templateName || 'Plantilla'}
            </span>
          </div>
          <WhatsAppText
            text={message.text}
            isUs={isUs}
            onLinkContextMenu={(e, url) => setLinkMenu({ x: e.clientX, y: e.clientY, url })}
            onEmailClick={(_e, email) => handleSaveEmail(email)}
          />
        </div>
      );
    }

    return (
      <WhatsAppText
        text={message.text}
        isUs={isUs}
        onLinkContextMenu={(e, url) => setLinkMenu({ x: e.clientX, y: e.clientY, url })}
        onEmailClick={(_e, email) => handleSaveEmail(email)}
      />
    );
  };

  return (
    <>
      {lightbox && (
        <MediaLightboxModal
          url={lightbox.url}
          type={lightbox.type}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      )}
      <div
        className={`flex w-full mb-4 ${isUs ? 'justify-end' : 'justify-start'} group`}
        onClick={() => {
          setShowMenu(false);
          setLinkMenu(null);
          setShowDotMenu(false);
        }}
      >
        <div className={`flex items-end gap-1.5 max-w-[75%] ${isUs ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Botón contextual 3 puntos (⋮) */}
          <div className="relative flex-shrink-0 self-center" ref={dotMenuRef}>
            <button
              type="button"
              aria-label="Más acciones del mensaje"
              onClick={(e) => {
                e.stopPropagation();
                setShowDotMenu(!showDotMenu);
              }}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-150 ease-out"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>

            {showDotMenu && (
              <div
                className={`absolute bottom-full mb-1 ${
                  isUs ? 'right-0' : 'left-0'
                } w-52 bg-popover text-popover-foreground rounded-xl shadow-xl border border-border py-1 z-50 animate-in fade-in zoom-in-95 duration-100`}
                onClick={(e) => e.stopPropagation()}
              >
                {detectedEmails.length > 0 &&
                  detectedEmails.map((email) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => handleSaveEmail(email)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="truncate">
                        Guardar <strong>{email}</strong>
                      </span>
                    </button>
                  ))}
                {mapUrlToSend && onAddDelivery && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddDelivery(mapUrlToSend);
                      toast({ title: 'Ubicación seleccionada', description: 'Se ha precargado en el panel lateral.' });
                      setShowDotMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors border-b border-border"
                  >
                    <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    {scheduleActionLabel}
                  </button>
                )}
                {onReply && (
                  <button
                    type="button"
                    onClick={() => {
                      onReply(message);
                      setShowDotMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors border-b border-border"
                  >
                    <svg className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Responder
                  </button>
                )}
                {onForward && (
                  <button
                    type="button"
                    onClick={() => {
                      onForward(message);
                      setShowDotMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors border-b border-border"
                  >
                    <Forward className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    Reenviar mensaje
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(message.text || '');
                    setShowDotMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  Copiar texto
                </button>
                {message.type === 'sticker' && (message.mediaUrl || message.media?.url) && (
                  <button
                    type="button"
                    onClick={handleSaveSticker}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-accent transition-colors border-t border-border"
                  >
                    <Sticker className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    Guardar en stickers
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={`flex flex-col ${isUs ? 'items-end' : 'items-start'}`}>
            {isUs && (isBot || message.senderName || message.isAdminIntervention) && (
              <div className="flex items-center gap-1 mb-1 mr-1">
                <span className="text-xs text-muted-foreground flex items-center">
                  {isBot && <Bot className="w-3 h-3 mr-1 text-primary" />}
                  {message.senderType === 'mobile' && (
                    <span title="Enviado desde móvil">
                      <Smartphone className="w-3 h-3 mr-1" />
                    </span>
                  )}
                  {message.senderType !== 'mobile' && !isBot && (
                    <span title="Enviado desde CRM">
                      <Monitor className="w-3 h-3 mr-1" />
                    </span>
                  )}
                  {message.isAdminIntervention && <span className="font-normal opacity-75 mr-1">Admin:</span>}
                  {isBot ? message.senderName || 'Agente IA' : message.senderName || (message.isAdminIntervention ? 'Administrador' : '')}
                </span>
              </div>
            )}

            <div
              className={`relative rounded-2xl transition-colors ${
                message.type === 'sticker' || message.type === 'template' || message.type === 'contacts'
                  ? 'p-0 bg-transparent shadow-none border-0'
                  : message.isRevoked || message.text?.trim() === '[Mensaje revoke]'
                  ? `px-3 py-1.5 bg-muted/80 text-muted-foreground border border-border ${
                      isUs ? 'rounded-br-sm' : 'rounded-bl-sm'
                    } shadow-xs`
                  : isUs
                  ? 'px-4 py-2 bg-chat-outbound text-chat-outbound-foreground rounded-br-sm shadow-xs'
                  : 'px-4 py-2 bg-chat-inbound text-chat-inbound-foreground border border-border rounded-bl-sm shadow-xs'
              }`}
            >
              {(message.forwarded || isForwardedAudio) && (
                <div
                  className={`flex items-center gap-1 text-[11px] italic font-medium mb-1.5 ${
                    isUs ? 'opacity-80' : 'text-muted-foreground'
                  }`}
                >
                  <CornerUpRight className="w-3 h-3" />
                  <span>Reenviado</span>
                </div>
              )}

              {message.replyTo && (
                <QuotedMessagePreview
                  replyTo={message.replyTo}
                  isUs={isUs}
                  onClick={onScrollToMessage ? () => onScrollToMessage(message.replyTo!) : undefined}
                />
              )}

              {message.referral && <AdReferralPreview referral={message.referral} isUs={isUs} />}

              {(message.isRevoked || message.text?.trim() === '[Mensaje revoke]') && (
                <div className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground mb-1 select-none">
                  <Ban className="w-3 h-3 opacity-70 shrink-0" />
                  <span className="italic">user deleted from WhatsApp</span>
                </div>
              )}

              {renderText()}

              {(message.type === 'contacts' || (message.sharedContacts && message.sharedContacts.length > 0)) && (
                <div className="space-y-2">
                  {message.sharedContacts && message.sharedContacts.length > 0 ? (
                    message.sharedContacts.map((sc, idx) => <SharedContactCard key={idx} contact={sc} isUs={isUs} />)
                  ) : (
                    <SharedContactCard
                      contact={{
                        formattedName: message.text?.replace(/^👤 Contacto( compartido)?:?\s*/i, '') || 'Contacto',
                        phones: [],
                      }}
                      isUs={isUs}
                    />
                  )}
                </div>
              )}

              <MessageBubbleMedia
                message={message}
                isUs={isUs}
                isAudio={isAudio}
                downloading={downloading}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onOpenLightbox={(url, type, caption) => setLightbox({ url, type, caption })}
                onOpenMapMenu={(url, x, y) => setLinkMenu({ x, y, url })}
                showMenu={showMenu}
                setShowMenu={setShowMenu}
              />

              <div
                className={`flex items-center justify-end text-[10px] mt-1 gap-1 ${
                  message.type === 'sticker' || message.type === 'template' || message.type === 'contacts'
                    ? 'text-muted-foreground'
                    : isUs
                    ? 'opacity-80'
                    : 'text-muted-foreground'
                }`}
              >
                {formatTime(message.timestamp)}
                {isUs && message.status && (
                  <span className="ml-1 inline-flex items-center">
                    {message.status === 'sending' && <Clock className="w-3 h-3 opacity-75" />}
                    {message.status === 'sent' && '✓'}
                    {message.status === 'delivered' && '✓✓'}
                    {message.status === 'read' && <span className="text-sky-400 font-bold">✓✓</span>}
                    {message.status === 'failed' && (
                      <span title="Error de envío">
                        <AlertCircle className="w-3 h-3 text-destructive inline-block" />
                      </span>
                    )}
                  </span>
                )}
              </div>

              {message.reactions && message.reactions.length > 0 && (
                <div
                  className={`absolute -bottom-2.5 ${
                    isUs ? 'right-2' : 'left-2'
                  } bg-card border border-border rounded-full px-1.5 py-0.5 shadow-xs flex items-center gap-1 z-10`}
                  title={message.reactions.map((r) => `${r.emoji} ${r.senderPhone || ''}`).join(', ')}
                >
                  {Array.from(new Set(message.reactions.map((r) => r.emoji))).map((emoji, idx) => (
                    <span key={idx} className="text-xs leading-none select-none">
                      {emoji}
                    </span>
                  ))}
                  {message.reactions.length > 1 && (
                    <span className="text-[10px] text-muted-foreground font-medium leading-none">
                      {message.reactions.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {linkMenu && onAddDelivery && (
          <div
            className="fixed z-50 bg-popover text-popover-foreground rounded-lg shadow-xl border border-border w-56 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{ top: linkMenu.y, left: linkMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full text-left px-4 py-3 text-sm hover:bg-accent flex items-center transition-colors"
              onClick={() => {
                onAddDelivery(linkMenu.url);
                setLinkMenu(null);
              }}
            >
              <MapPin className="w-4 h-4 mr-3 text-primary" />
              <span className="font-medium">{scheduleActionLabel}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
```

```tsx
// src/components/crm/message-bubble-media.tsx
'use client';

import {
  Image as ImageIcon,
  Video,
  FileText,
  MapPin,
  Loader2,
  Download,
  MoreVertical,
  Trash,
  AlertCircle,
} from 'lucide-react';
import { Message } from '@/lib/types/crm';
import { WhatsAppText } from '@/lib/utils/whatsapp-parser';
import { VoiceNotePlayer } from './voice-note-player';
import { isSystemPlaceholder } from './message-bubble';

interface MessageBubbleMediaProps {
  message: Message;
  isUs: boolean;
  isAudio: boolean;
  downloading: boolean;
  onDownload: () => void;
  onDelete: () => void;
  onOpenLightbox: (url: string, type: 'image' | 'video', caption?: string) => void;
  onOpenMapMenu: (url: string, x: number, y: number) => void;
  showMenu: boolean;
  setShowMenu: (show: boolean) => void;
}

export function MessageBubbleMedia({
  message,
  isUs,
  isAudio,
  downloading,
  onDownload,
  onDelete,
  onOpenLightbox,
  onOpenMapMenu,
  showMenu,
  setShowMenu,
}: MessageBubbleMediaProps) {
  const hasMedia = message.media;
  const isDownloaded = !!message.media?.url;

  if (isAudio) {
    return (
      <VoiceNotePlayer
        mediaUrl={message.mediaUrl}
        isUs={isUs}
        onDownload={onDownload}
        downloading={downloading || message.media?.isDownloading}
      />
    );
  }

  const isLegacyMobileLocation = message.text?.trim().toLowerCase() === '[location desde móvil]';
  if (message.type === 'text' && !isLegacyMobileLocation) return null;

  const rawCaption = message.text && !isSystemPlaceholder(message.text) ? message.text.trim() : '';
  const isDuplicateDocFilename =
    (message.type === 'document' || (message.type as string) === 'pdf') &&
    Boolean(rawCaption) &&
    (rawCaption === message.media?.filename?.trim() || rawCaption === (message.media as any)?.fileName?.trim());
  const mediaCaption = rawCaption && !isDuplicateDocFilename ? rawCaption : undefined;

  const renderCaption = (caption?: string) =>
    caption ? (
      <div
        className={`mt-1.5 px-1 text-xs leading-snug max-w-[232px] break-words ${
          isUs ? 'text-chat-outbound-foreground' : 'text-foreground'
        }`}
      >
        <WhatsAppText text={caption} isUs={isUs} />
      </div>
    ) : null;

  if (hasMedia && !isDownloaded && message.media?.mediaId) {
    if (message.type === 'sticker') {
      return (
        <div className="w-28 h-28 flex flex-col items-center justify-center bg-black/5 rounded-2xl border border-dashed border-border animate-pulse my-1">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mb-1.5" />
          <span className="text-[10px] text-muted-foreground font-medium">Sticker...</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col">
        <div
          role="button"
          onClick={onDownload}
          className={`flex items-center justify-center gap-2 p-3 my-1 rounded-xl cursor-pointer transition-colors duration-150 ease-out border shadow-xs ${
            isUs
              ? 'bg-white/15 hover:bg-white/25 border-white/20 text-white'
              : 'bg-card hover:bg-accent border-border text-foreground'
          }`}
        >
          <div
            className={`p-2 rounded-full ${
              downloading || message.media?.isDownloading ? 'animate-bounce' : ''
            } ${isUs ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
          >
            <Download className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">
            {downloading || message.media?.isDownloading ? 'Descargando en 2do plano...' : 'Descargar Archivo'}
          </span>
        </div>
        {renderCaption(mediaCaption)}
      </div>
    );
  }

  const effectiveType = isLegacyMobileLocation ? 'location' : message.type;

  const renderContent = () => {
    switch (effectiveType) {
      case 'sticker':
        if (message.mediaUrl) {
          return (
            <div
              className="relative my-1 cursor-pointer select-none max-w-[160px] max-h-[160px]"
              onClick={() => window.open(message.mediaUrl!, '_blank')}
              role="button"
              tabIndex={0}
              aria-label="Ver sticker"
            >
              <img
                src={message.mediaUrl}
                alt="Sticker"
                loading="lazy"
                decoding="async"
                className="w-36 h-36 object-contain hover:scale-105 transition-transform duration-150 ease-out drop-shadow-sm"
              />
            </div>
          );
        }
        return (
          <div className="w-28 h-28 flex flex-col items-center justify-center bg-black/5 rounded-2xl border border-dashed border-border animate-pulse my-1">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mb-1.5" />
            <span className="text-[10px] text-muted-foreground font-medium">Sticker...</span>
          </div>
        );

      case 'image': {
        if (message.mediaUrl) {
          return (
            <div className="flex flex-col mt-1">
              <div
                className="relative w-48 h-48 sm:w-56 sm:h-56 aspect-square rounded-xl overflow-hidden shadow-xs border border-black/5 group-hover:shadow-md transition-shadow duration-200 ease-out cursor-zoom-in bg-black/5"
                onClick={() => onOpenLightbox(message.mediaUrl!, 'image', mediaCaption)}
                role="button"
                tabIndex={0}
                aria-label="Ver imagen en pantalla completa"
              >
                <img
                  src={message.mediaUrl}
                  alt={mediaCaption || 'Imagen adjunta'}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200 ease-out"
                />
              </div>
              {renderCaption(mediaCaption)}
            </div>
          );
        }
        return (
          <div className="flex flex-col">
            <div className="mt-2 mb-1 flex items-center bg-black/5 dark:bg-white/10 rounded-lg p-2">
              {message.status === 'sending' ? (
                <Loader2 className="w-5 h-5 mr-2 text-muted-foreground animate-spin" />
              ) : (
                <ImageIcon className="w-5 h-5 mr-2 text-muted-foreground" />
              )}
              <span className="text-sm italic">{message.status === 'sending' ? 'Enviando imagen...' : 'Imagen'}</span>
            </div>
            {renderCaption(mediaCaption)}
          </div>
        );
      }

      case 'video': {
        if (message.mediaUrl) {
          return (
            <div className="flex flex-col mt-1">
              <div
                className="relative w-48 h-48 sm:w-56 sm:h-56 aspect-square rounded-xl overflow-hidden shadow-xs border border-black/5 group-hover:shadow-md transition-shadow duration-200 ease-out cursor-zoom-in bg-black/5"
                onClick={() => onOpenLightbox(message.mediaUrl!, 'video', mediaCaption)}
                role="button"
                tabIndex={0}
                aria-label="Ver video"
              >
                <video src={message.mediaUrl} className="w-full h-full object-cover pointer-events-none" preload="metadata" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors duration-150">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-slate-800 ml-1" />
                  </div>
                </div>
              </div>
              {renderCaption(mediaCaption)}
            </div>
          );
        }
        return (
          <div className="flex flex-col">
            <div className="mt-2 mb-1 flex items-center bg-black/5 dark:bg-white/10 rounded-lg p-2">
              {message.status === 'sending' ? (
                <Loader2 className="w-5 h-5 mr-2 text-muted-foreground animate-spin" />
              ) : message.status === 'failed' ? (
                <AlertCircle className="w-5 h-5 mr-2 text-destructive" />
              ) : (
                <Video className="w-5 h-5 mr-2 text-muted-foreground" />
              )}
              <span className="text-sm italic">
                {message.status === 'sending'
                  ? message.media?.isProcessing
                    ? 'Procesando video...'
                    : 'Enviando video...'
                  : message.status === 'failed'
                  ? 'Error al enviar video'
                  : 'Video'}
              </span>
            </div>
            {renderCaption(mediaCaption)}
          </div>
        );
      }

      case 'document':
      case 'pdf':
        return (
          <div className="flex flex-col">
            <div
              className="mt-2 mb-1 flex items-center bg-black/5 dark:bg-white/10 rounded-lg p-3 cursor-pointer"
              onClick={() => message.mediaUrl && window.open(message.mediaUrl, '_blank')}
            >
              <FileText className="w-6 h-6 mr-3 text-destructive shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">
                  {message.media?.filename || (message.media as any)?.fileName || 'Documento'}
                </span>
              </div>
            </div>
            {renderCaption(mediaCaption)}
          </div>
        );

      case 'location': {
        const loc = message.location;
        const hasCoords = Boolean(loc && (loc.latitude !== 0 || loc.longitude !== 0));
        const searchFallback = loc?.name || loc?.address;
        const mapUrl = hasCoords
          ? `https://www.google.com/maps/search/?api=1&query=${loc!.latitude},${loc!.longitude}`
          : searchFallback
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchFallback)}`
          : null;

        return (
          <div
            className={`mt-2 mb-1 flex flex-col rounded-xl overflow-hidden shadow-xs border border-border w-64 transition-shadow duration-150 ease-out group/map ${
              mapUrl ? 'cursor-pointer hover:shadow-md' : ''
            }`}
            onClick={() => mapUrl && window.open(mapUrl, '_blank')}
            onContextMenu={(e) => {
              if (!mapUrl) return;
              e.preventDefault();
              e.stopPropagation();
              onOpenMapMenu(mapUrl, e.clientX, e.clientY);
            }}
          >
            <div className="bg-muted h-24 flex items-center justify-center relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }}
              />
              <MapPin className="w-8 h-8 text-destructive animate-bounce relative z-10 drop-shadow-sm" />
            </div>
            <div className="p-3 bg-card flex flex-col">
              <span className="text-sm font-semibold text-foreground line-clamp-1">
                {loc?.name || (isUs ? 'Ubicación compartida' : 'Ubicación recibida')}
              </span>
              {(loc?.address || !hasCoords) && (
                <span className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                  {loc?.address ||
                    (message.senderType === 'mobile' || isLegacyMobileLocation
                      ? 'Enviada desde WhatsApp Móvil'
                      : 'Ubicación de WhatsApp')}
                </span>
              )}
              {mapUrl && (
                <div className="mt-2 pt-2 border-t border-border font-medium text-[11px] text-primary flex items-center gap-1">
                  Ver en Google Maps <span className="ml-auto">→</span>
                </div>
              )}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      className="relative group"
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
    >
      {renderContent()}
      {isDownloaded && (
        <button
          type="button"
          aria-label="Opciones del archivo adjunto"
          className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 ease-out"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      )}

      {showMenu && isDownloaded && (
        <div className="absolute top-8 right-2 bg-popover text-popover-foreground rounded-lg shadow-xl border border-border z-10 w-48 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-accent flex items-center transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              window.open(message.mediaUrl, '_blank');
              setShowMenu(false);
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Guardar en dispositivo
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center border-t border-border transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash className="w-4 h-4 mr-2" />
            Eliminar de Storage
          </button>
        </div>
      )}
    </div>
  );
}
```

---

### 9.2 Tarjeta de Contacto Compartido (`SharedContactCard.tsx`) y Modal Anti-Duplicados (`SaveSharedContactModal.tsx`)
Cuando un cliente o asesor comparte un contacto vCard (`message.type === 'contacts'`), `SharedContactCard` despliega su nombre, empresa/cargo, teléfonos copiables y dos botones: **"Guardar en CRM"** (que abre `SaveSharedContactModal` consultando `/api/crm/conversations/check` para evitar duplicados) e **"Iniciar Chat"** (que abre la conversación directamente con `CustomEvent('crm:select-chat')`):

```tsx
// src/components/crm/shared-contact-card.tsx
'use client';

import { useState } from 'react';
import { User, Phone, Mail, Copy, Check, MessageSquare, UserPlus } from 'lucide-react';
import { CrmSharedContact } from '@/lib/types/crm';
import { useToast } from '@/hooks/use-toast';
import { SaveSharedContactModal } from './save-shared-contact-modal';

interface SharedContactCardProps {
  contact: CrmSharedContact;
  isUs: boolean;
}

export function SharedContactCard({ contact, isUs }: SharedContactCardProps) {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedConversationId, setSavedConversationId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const primaryPhone = contact.phones?.[0]?.phone || contact.phones?.[0]?.waId || '';
  const subtitle = [contact.org?.company, contact.org?.title].filter(Boolean).join(' • ');

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    toast({ title: 'Copiado', description: `${text} copiado al portapapeles.` });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveOrOpen = (action: 'save' | 'chat') => {
    if (!primaryPhone) {
      toast({
        title: 'Sin número',
        description: 'El contacto no contiene un número telefónico válido.',
        variant: 'destructive',
      });
      return;
    }

    if (savedConversationId && action === 'chat') {
      window.dispatchEvent(new CustomEvent('crm:select-chat', { detail: { chatId: savedConversationId } }));
      return;
    }

    setShowSaveModal(true);
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-150 overflow-hidden w-full max-w-[280px] sm:max-w-[320px] ${
        isUs
          ? 'bg-chat-outbound border-white/20 text-chat-outbound-foreground shadow-xs'
          : 'bg-card border-border text-foreground shadow-xs'
      }`}
    >
      <div className="p-3 sm:p-3.5 flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
            isUs ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary border border-primary/20'
          }`}
        >
          {contact.formattedName ? contact.formattedName.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-sm truncate leading-tight">{contact.formattedName || 'Contacto'}</h4>
          {subtitle ? (
            <p className={`text-[11px] truncate mt-0.5 ${isUs ? 'opacity-80' : 'text-muted-foreground'}`}>{subtitle}</p>
          ) : (
            <span className={`text-[10px] font-medium tracking-wide uppercase ${isUs ? 'opacity-75' : 'text-muted-foreground'}`}>
              Contacto compartido
            </span>
          )}
        </div>
      </div>

      <div
        className={`px-3 sm:px-3.5 py-2 border-t space-y-1.5 text-xs ${
          isUs ? 'border-white/15 bg-black/10' : 'border-border bg-muted/30'
        }`}
      >
        {contact.phones?.map((p, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Phone className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <a
                href={`tel:${p.phone || p.waId}`}
                className="truncate font-mono text-[11px] hover:underline"
                title="Llamar"
              >
                {p.phone || p.waId}
              </a>
              {p.type && (
                <span className="text-[9px] px-1.5 py-0.2 rounded border border-border opacity-75">{p.type}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleCopy(p.phone || p.waId || '', idx)}
              className="p-1 rounded-md hover:bg-black/10 transition-colors"
              title="Copiar número"
            >
              {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}

        {contact.emails &&
          contact.emails.map((e, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs truncate">
              <Mail className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <a href={`mailto:${e.email}`} className="truncate text-[11px] hover:underline">
                {e.email}
              </a>
            </div>
          ))}
      </div>

      <div className={`p-2 border-t flex gap-1.5 ${isUs ? 'border-white/15 bg-black/15' : 'border-border bg-card'}`}>
        <button
          type="button"
          onClick={() => handleSaveOrOpen('save')}
          disabled={isSaved}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isSaved
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
              : isUs
              ? 'bg-white/20 hover:bg-white/30 text-white active:scale-95'
              : 'bg-primary hover:opacity-90 text-primary-foreground shadow-xs active:scale-95'
          }`}
        >
          {isSaved ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Guardado</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>Guardar en CRM</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSaveOrOpen('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isUs ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-muted hover:bg-accent text-foreground'
          } active:scale-95`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <span>Iniciar Chat</span>
        </button>
      </div>

      {showSaveModal && (
        <SaveSharedContactModal
          initialName={contact.formattedName || 'Contacto'}
          phone={primaryPhone}
          onClose={() => setShowSaveModal(false)}
          onSaved={(convId, openChat) => {
            setIsSaved(true);
            setSavedConversationId(convId);
            if (openChat) {
              window.dispatchEvent(new CustomEvent('crm:select-chat', { detail: { chatId: convId } }));
            }
          }}
        />
      )}
    </div>
  );
}
```

---

### 9.3 Componentes de Enriquecimiento de Burbuja: `AdReferralPreview.tsx`, `QuotedMessagePreview.tsx`, `TemplatePreview.tsx` y `WhatsAppText` (`whatsapp-parser.tsx`)

```tsx
// src/components/crm/ad-referral-preview.tsx
'use client';

import { useState } from 'react';
import { CrmMessageReferral } from '@/lib/types/crm';
import { Megaphone, ExternalLink } from 'lucide-react';

interface AdReferralPreviewProps {
  referral: CrmMessageReferral;
  isUs?: boolean;
}

export function AdReferralPreview({ referral, isUs = false }: AdReferralPreviewProps) {
  const [imageError, setImageError] = useState(false);

  const previewImage = referral.imageUrl || referral.thumbnailUrl;
  const headline = referral.headline || 'Publicidad de Meta';
  const bodyText = referral.body;
  const sourceLabel = referral.sourceType === 'post' ? 'Publicación' : 'Anuncio';

  return (
    <div
      className={`w-full rounded-xl overflow-hidden mb-2 border transition-all text-left ${
        isUs ? 'bg-black/20 border-white/20 text-white' : 'bg-muted/60 border-border text-foreground'
      }`}
    >
      <div
        className={`flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold border-b ${
          isUs ? 'bg-black/20 border-white/15 text-white/90' : 'bg-muted border-border text-muted-foreground'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          <Megaphone className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">Respondió a un {sourceLabel}</span>
        </span>

        {referral.sourceUrl && (
          <a
            href={referral.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-1 hover:underline ml-2 shrink-0 ${
              isUs ? 'text-white/90 hover:text-white' : 'text-primary'
            }`}
            title="Ver anuncio original"
          >
            <span>Ver</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="p-2.5 flex gap-3 items-start">
        {previewImage && !imageError && (
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-muted border border-border">
            <img
              src={previewImage}
              alt={headline}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
              loading="lazy"
              decoding="async"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-xs font-bold leading-snug line-clamp-2">{headline}</p>
          {bodyText && (
            <p className={`text-[11px] mt-1 line-clamp-3 leading-relaxed ${isUs ? 'opacity-85' : 'text-muted-foreground'}`}>
              {bodyText}
            </p>
          )}
          {referral.sourceId && (
            <span className={`text-[9px] mt-1.5 block font-mono ${isUs ? 'opacity-70' : 'text-muted-foreground'}`}>
              ID: {referral.sourceId}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

```tsx
// src/components/crm/quoted-message-preview.tsx
import { Message } from '@/lib/types/crm';
import { Image as ImageIcon, Video, Mic, FileText, MapPin } from 'lucide-react';

interface QuotedMessagePreviewProps {
  replyTo: NonNullable<Message['replyTo']>;
  isUs: boolean;
  onClick?: () => void;
}

export function QuotedMessagePreview({ replyTo, isUs, onClick }: QuotedMessagePreviewProps) {
  if (!replyTo) return null;

  const renderIcon = () => {
    switch (replyTo.type) {
      case 'image':
        return <ImageIcon className="w-3 h-3 shrink-0" />;
      case 'video':
        return <Video className="w-3 h-3 shrink-0" />;
      case 'audio':
        return <Mic className="w-3 h-3 shrink-0" />;
      case 'document':
        return <FileText className="w-3 h-3 shrink-0" />;
      case 'location':
        return <MapPin className="w-3 h-3 shrink-0" />;
      default:
        return replyTo.mediaUrl ? <ImageIcon className="w-3 h-3 shrink-0" /> : null;
    }
  };

  const getPreviewText = () => {
    if (replyTo.text && !/^\[(image|foto|video|audio|document|sticker)\]$/i.test(replyTo.text.trim())) {
      return replyTo.text;
    }
    switch (replyTo.type) {
      case 'image':
        return 'Foto';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Nota de voz';
      case 'document':
        return 'Documento';
      case 'location':
        return 'Ubicación';
      case 'sticker':
        return 'Sticker';
      default:
        return replyTo.mediaUrl ? 'Foto' : 'Mensaje';
    }
  };

  return (
    <div
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`mb-2 p-2 rounded-lg border-l-4 text-xs transition-opacity hover:opacity-90 flex items-center justify-between gap-2 overflow-hidden ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isUs
          ? 'bg-black/15 border-white/60 text-chat-outbound-foreground'
          : 'bg-muted/70 border-primary text-foreground'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[11px] mb-0.5 opacity-90 truncate text-primary">
          {replyTo.senderName || 'Mensaje citado'}
        </div>
        <div className="line-clamp-2 text-[11px] opacity-80 flex items-center gap-1.5 break-words whitespace-pre-wrap">
          {renderIcon()}
          <span className="truncate">{getPreviewText()}</span>
        </div>
      </div>

      {replyTo.mediaUrl && (
        <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-black/10 border border-border">
          <img src={replyTo.mediaUrl} alt="Miniatura" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        </div>
      )}
    </div>
  );
}
```

```tsx
// src/components/crm/template-preview.tsx
'use client';

import React from 'react';
import { WhatsAppTemplateComponent, WhatsAppTemplateButton } from '@/lib/types/crm';
import { Image as ImageIcon, FileText, Video, ExternalLink, Phone, MessageSquare } from 'lucide-react';

interface TemplatePreviewProps {
  components: WhatsAppTemplateComponent[];
  variableValues?: Record<string, string>;
  className?: string;
  isChatMessage?: boolean;
  bodyText?: string;
}

export function TemplatePreview({
  components,
  variableValues = {},
  className = '',
  isChatMessage = false,
  bodyText,
}: TemplatePreviewProps) {
  const replaceVars = (text?: string) => {
    if (!text) return '';
    let result = text;
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (matches) {
      matches.forEach((m) => {
        const key = m.replace(/[\{\}]/g, '');
        const val = variableValues[key] || m;
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
      });
    }
    return result;
  };

  const header = components?.find((c) => c.type?.toUpperCase() === 'HEADER');
  const body = components?.find((c) => c.type?.toUpperCase() === 'BODY');
  const footer = components?.find((c) => c.type?.toUpperCase() === 'FOOTER');
  const buttonsComp = components?.find((c) => c.type?.toUpperCase() === 'BUTTONS');

  const buttonsList: WhatsAppTemplateButton[] = buttonsComp?.buttons ?? [];
  const quickReplies = buttonsList.filter((b) => b.type === 'QUICK_REPLY');
  const ctaButtons = buttonsList.filter((b) => b.type === 'URL' || b.type === 'PHONE_NUMBER');

  const containerClasses = isChatMessage
    ? `w-full ${className}`
    : `bg-muted/60 p-3 sm:p-4 rounded-xl border border-border flex flex-col justify-start w-full ${className}`;

  const cardClasses = isChatMessage
    ? 'bg-card text-foreground rounded-2xl border border-border shadow-xs w-full overflow-hidden'
    : 'bg-card text-foreground rounded-2xl rounded-tl-xs shadow-xs max-w-[92%] sm:max-w-[85%] overflow-hidden';

  return (
    <div className={containerClasses}>
      <div className={cardClasses}>
        {header && (
          <div className="px-3 pt-3 pb-1">
            {(!header.format || header.format === 'TEXT') && header.text && (
              <p className="font-bold text-sm">{replaceVars(header.text)}</p>
            )}
            {header.format === 'IMAGE' && (
              <div className="w-full h-28 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                <ImageIcon className="w-7 h-7" />
              </div>
            )}
            {header.format === 'VIDEO' && (
              <div className="w-full h-28 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                <Video className="w-7 h-7" />
              </div>
            )}
            {header.format === 'DOCUMENT' && (
              <div className="w-full bg-muted rounded-lg flex items-center gap-2 p-3 text-muted-foreground">
                <FileText className="w-6 h-6 shrink-0" />
                <span className="text-xs">Documento adjunto</span>
              </div>
            )}
          </div>
        )}

        <div className={`px-3 ${!header ? 'pt-3' : 'pt-1'} pb-2`}>
          <p className="text-xs whitespace-pre-wrap leading-relaxed font-sans">
            {bodyText || replaceVars(body?.text || '(Sin texto en el cuerpo)')}
          </p>
        </div>

        {footer?.text && (
          <div className="px-3 pb-1">
            <p className="text-[10px] text-muted-foreground">{replaceVars(footer.text)}</p>
          </div>
        )}

        <div className="px-3 pb-2 text-[10px] text-right text-muted-foreground">Plantilla Oficial</div>

        {ctaButtons.length > 0 && (
          <div className="border-t border-border">
            {ctaButtons.map((btn, idx) => (
              <div
                key={idx}
                className="w-full py-2.5 px-3 text-center text-primary font-medium text-xs border-b border-border last:border-0 flex items-center justify-center gap-1.5"
              >
                {btn.type === 'URL' && <ExternalLink className="w-3.5 h-3.5 shrink-0" />}
                {btn.type === 'PHONE_NUMBER' && <Phone className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{btn.text}</span>
              </div>
            ))}
          </div>
        )}

        {quickReplies.length > 0 && (
          <div className="border-t border-border px-2 py-2 flex flex-wrap gap-1.5">
            {quickReplies.map((btn, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary/40 text-primary text-xs font-medium"
              >
                <MessageSquare className="w-3 h-3 shrink-0" />
                <span>{btn.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

```tsx
// src/lib/utils/whatsapp-parser.tsx
import React, { ReactNode } from 'react';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_REGEX = /https?:\/\/[^\s]+/g;

const BOLD_REGEX = /\*(.*?)\*/g;
const ITALIC_REGEX = /_(.*?)_/g;
const STRIKE_REGEX = /~(.*?)~/g;
const MONO_REGEX = /```([\s\S]*?)```/g;

export interface WhatsAppTextProps {
  text: string;
  isUs?: boolean;
  onLinkContextMenu?: (e: React.MouseEvent, url: string) => void;
  onEmailClick?: (e: React.MouseEvent, email: string) => void;
}

function parseText(
  text: string,
  regex: RegExp,
  renderMatch: (match: string, i: number) => ReactNode
): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = [];
  let lastIndex = 0;

  const localRegex = new RegExp(regex.source, regex.flags);
  let match;

  while ((match = localRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const textToRender = match[1] !== undefined ? match[1] : match[0];
    parts.push(renderMatch(textToRender, match.index));
    lastIndex = localRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function processNodes(
  nodes: (string | ReactNode)[],
  regex: RegExp,
  renderMatch: (match: string, i: number) => ReactNode
): (string | ReactNode)[] {
  const result: (string | ReactNode)[] = [];
  nodes.forEach((node) => {
    if (typeof node === 'string') {
      result.push(...parseText(node, regex, renderMatch));
    } else {
      result.push(node);
    }
  });
  return result;
}

export const WhatsAppText: React.FC<WhatsAppTextProps> = ({
  text,
  isUs,
  onLinkContextMenu,
  onEmailClick,
}) => {
  if (!text) return null;

  let nodes: (string | ReactNode)[] = [text];

  nodes = processNodes(nodes, MONO_REGEX, (match, i) => (
    <code key={`mono-${i}`} className="font-mono bg-black/10 rounded px-1 py-0.5 text-[0.9em]">
      {match}
    </code>
  ));

  nodes = processNodes(nodes, BOLD_REGEX, (match, i) => (
    <strong key={`bold-${i}`} className="font-semibold">
      {match}
    </strong>
  ));

  nodes = processNodes(nodes, ITALIC_REGEX, (match, i) => (
    <em key={`italic-${i}`} className="italic">
      {match}
    </em>
  ));

  nodes = processNodes(nodes, STRIKE_REGEX, (match, i) => (
    <del key={`strike-${i}`} className="line-through opacity-80">
      {match}
    </del>
  ));

  nodes = processNodes(nodes, URL_REGEX, (match, i) => (
    <a
      key={`url-${i}`}
      href={match}
      target="_blank"
      rel="noopener noreferrer"
      className={`underline ${isUs ? 'text-white hover:opacity-80' : 'text-primary hover:opacity-80'}`}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        if (onLinkContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onLinkContextMenu(e, match);
        }
      }}
    >
      {match}
    </a>
  ));

  nodes = processNodes(nodes, EMAIL_REGEX, (match, i) => (
    <span
      key={`email-${i}`}
      className={`inline-flex items-center gap-0.5 underline decoration-dashed cursor-pointer ${
        isUs ? 'text-white hover:opacity-80' : 'text-primary hover:opacity-80'
      }`}
      onClick={(e) => {
        if (onEmailClick) {
          e.stopPropagation();
          onEmailClick(e, match);
        }
      }}
      title="Clic para guardar como correo del cliente"
    >
      {match}
    </span>
  ));

  return (
    <p className="text-sm whitespace-pre-wrap break-words leading-snug">
      {nodes.map((node, index) => (
        <React.Fragment key={index}>{node}</React.Fragment>
      ))}
    </p>
  );
};
```


---

### 9.4 Mosaicos de Álbum (`ImageGridBubble.tsx`) y Visor Fullscreen en Portal (`MediaLightboxModal.tsx`)
Cuando un cliente o asesor envía `2` o más imágenes seguidas sin caption individual, `MessageList` las agrupa en `ImageGridBubble` (`2` lado a lado, `3` asimétricas `1+2`, `4` en `2×2`, o `5+` con overlay `+{remaining}`). Cada celda conserva `data-sub-message-id` y `data-sub-wa-message-id` para que el buscador intra-chat o las citas `replyTo` puedan hacer scroll directo a la miniatura exacta:

```tsx
// src/components/crm/image-grid-bubble.tsx
'use client';

import { useState } from 'react';
import { Message } from '@/lib/types/crm';
import { MediaLightboxModal, LightboxItem } from './media-lightbox-modal';
import { QuotedMessagePreview } from './quoted-message-preview';
import { isSystemPlaceholder } from './message-bubble';
import { WhatsAppText } from '@/lib/utils/whatsapp-parser';

interface ImageGridBubbleProps {
  messages: Message[];
  isUs: boolean;
  onReply?: (msg: Message) => void;
  onScrollToMessage?: (replyTo: NonNullable<Message['replyTo']>) => void;
}

function buildCaption(text?: string): string | undefined {
  if (!text) return undefined;
  if (isSystemPlaceholder(text)) return undefined;
  const clean = text.trim();
  return clean || undefined;
}

export function ImageGridBubble({ messages, isUs, onReply, onScrollToMessage }: ImageGridBubbleProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const validMessages = messages.filter((m) => m.mediaUrl && m.type === 'image');
  const count = validMessages.length;
  if (count === 0) return null;

  const galleryItems: LightboxItem[] = validMessages.map((m) => ({
    url: m.mediaUrl!,
    type: 'image',
    caption: buildCaption(m.text),
  }));

  const open = (index: number) => setLightboxIndex(index);

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const lastMsg = validMessages[validMessages.length - 1];

  const renderGrid = () => {
    if (count === 2) {
      return (
        <div className="grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden">
          {validMessages.map((m, i) => (
            <ImageThumb key={m.id} id={m.id} waMessageId={m.waMessageId} url={m.mediaUrl!} onClick={() => open(i)} />
          ))}
        </div>
      );
    }

    if (count === 3) {
      return (
        <div className="flex gap-0.5 rounded-xl overflow-hidden" style={{ height: 200 }}>
          <ImageThumb
            id={validMessages[0].id}
            waMessageId={validMessages[0].waMessageId}
            url={validMessages[0].mediaUrl!}
            onClick={() => open(0)}
            className="flex-[2]"
          />
          <div className="flex flex-col gap-0.5 flex-1">
            <ImageThumb
              id={validMessages[1].id}
              waMessageId={validMessages[1].waMessageId}
              url={validMessages[1].mediaUrl!}
              onClick={() => open(1)}
              className="flex-1"
            />
            <ImageThumb
              id={validMessages[2].id}
              waMessageId={validMessages[2].waMessageId}
              url={validMessages[2].mediaUrl!}
              onClick={() => open(2)}
              className="flex-1"
            />
          </div>
        </div>
      );
    }

    if (count === 4) {
      return (
        <div className="grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden">
          {validMessages.map((m, i) => (
            <ImageThumb
              key={m.id}
              id={m.id}
              waMessageId={m.waMessageId}
              url={m.mediaUrl!}
              onClick={() => open(i)}
              className="h-[96px]"
            />
          ))}
        </div>
      );
    }

    const remaining = count - 3;
    return (
      <div className="grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden">
        {validMessages.slice(0, 3).map((m, i) => (
          <ImageThumb
            key={m.id}
            id={m.id}
            waMessageId={m.waMessageId}
            url={m.mediaUrl!}
            onClick={() => open(i)}
            className="h-[96px]"
          />
        ))}
        <div
          data-sub-message-id={validMessages[3].id}
          data-sub-wa-message-id={validMessages[3].waMessageId}
          data-message-id={validMessages[3].id}
          className="relative h-[96px] cursor-pointer transition-all duration-300"
          onClick={() => open(3)}
          role="button"
          tabIndex={0}
          aria-label={`Ver ${remaining + 1} imágenes más`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') open(3);
          }}
        >
          <img src={validMessages[3].mediaUrl!} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            <span className="text-white text-2xl font-bold drop-shadow-lg">+{remaining}</span>
          </div>
        </div>
      </div>
    );
  };

  const sharedCaption = buildCaption(validMessages.find((m) => buildCaption(m.text))?.text);

  return (
    <>
      {lightboxIndex !== null && (
        <MediaLightboxModal items={galleryItems} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      <div className={`flex w-full mb-4 ${isUs ? 'justify-end' : 'justify-start'} group`}>
        <div className={`flex items-end gap-1.5 max-w-[75%] ${isUs ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`flex flex-col ${isUs ? 'items-end' : 'items-start'}`}>
            {isUs && (validMessages[0].senderId === 'bot' || validMessages[0].senderType === 'bot' || validMessages[0].senderName) && (
              <div className="flex items-center gap-1 mb-1 mr-1">
                <span className="text-xs text-muted-foreground">
                  {validMessages[0].senderId === 'bot' || validMessages[0].senderType === 'bot'
                    ? validMessages[0].senderName || 'Agente IA'
                    : validMessages[0].senderName}
                </span>
              </div>
            )}

            <div
              className={`relative rounded-2xl overflow-hidden shadow-xs flex-1 ${
                isUs ? 'bg-chat-outbound rounded-br-sm' : 'bg-chat-inbound border border-border rounded-bl-sm'
              }`}
              style={{ minWidth: 160, maxWidth: 280 }}
            >
              {validMessages[0].replyTo && (
                <div className="px-2 pt-2">
                  <QuotedMessagePreview
                    replyTo={validMessages[0].replyTo}
                    isUs={isUs}
                    onClick={onScrollToMessage ? () => onScrollToMessage(validMessages[0].replyTo!) : undefined}
                  />
                </div>
              )}
              <div className="p-1">{renderGrid()}</div>

              {sharedCaption && (
                <div
                  className={`px-3 pb-1 text-xs leading-snug break-words ${
                    isUs ? 'text-chat-outbound-foreground' : 'text-foreground'
                  }`}
                >
                  <WhatsAppText text={sharedCaption} isUs={isUs} />
                </div>
              )}

              <div
                className={`flex items-center justify-end text-[10px] px-2 pb-1.5 gap-1 ${
                  isUs ? 'opacity-80 text-chat-outbound-foreground' : 'text-muted-foreground'
                }`}
              >
                {formatTime(lastMsg.timestamp)}
                {isUs && lastMsg.status && (
                  <span>
                    {lastMsg.status === 'sent' && '✓'}
                    {lastMsg.status === 'delivered' && '✓✓'}
                    {lastMsg.status === 'read' && <span className="text-sky-300 font-bold">✓✓</span>}
                  </span>
                )}
              </div>
            </div>
          </div>

          {onReply && (
            <button
              type="button"
              title="Responder a este grupo"
              onClick={() => onReply(validMessages[0])}
              className="p-1.5 self-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function ImageThumb({
  url,
  id,
  waMessageId,
  onClick,
  className = '',
}: {
  url: string;
  id?: string;
  waMessageId?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div
      data-sub-message-id={id}
      data-sub-wa-message-id={waMessageId}
      data-message-id={id}
      className={`relative overflow-hidden cursor-zoom-in bg-black/5 transition-all duration-300 ${className}`}
      style={{ minHeight: 96 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      <img
        src={url}
        alt="Imagen adjunta"
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover hover:scale-105 transition-transform duration-200 ease-out"
      />
    </div>
  );
}
```

```tsx
// src/components/crm/media-lightbox-modal.tsx
'use client';

import { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LightboxItem {
  url: string;
  type: 'image' | 'video';
  caption?: string;
}

interface MediaLightboxModalProps {
  url?: string;
  type?: 'image' | 'video';
  caption?: string;
  items?: LightboxItem[];
  initialIndex?: number;
  onClose: () => void;
}

export function MediaLightboxModal({
  url,
  type,
  caption,
  items,
  initialIndex = 0,
  onClose,
}: MediaLightboxModalProps) {
  const gallery: LightboxItem[] =
    items && items.length > 0
      ? items
      : url
      ? [{ url, type: type || 'image', caption }]
      : [];

  const [currentIndex, setCurrentIndex] = useState(
    Math.min(initialIndex, Math.max(gallery.length - 1, 0))
  );

  const isGallery = gallery.length > 1;
  const current = gallery[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % gallery.length);
  }, [gallery.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + gallery.length) % gallery.length);
  }, [gallery.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (isGallery && e.key === 'ArrowRight') goNext();
      if (isGallery && e.key === 'ArrowLeft') goPrev();
    },
    [onClose, isGallery, goNext, goPrev]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleDownload = () => {
    if (!current) return;
    const a = document.createElement('a');
    a.href = current.url;
    a.download =
      current.type === 'video'
        ? 'video.mp4'
        : /\.webp(\?|%|$)/i.test(current.url)
        ? 'imagen.webp'
        : 'imagen.jpg';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  if (!current || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1">
          {isGallery && (
            <span className="text-white/60 text-sm font-medium tabular-nums">
              {currentIndex + 1} / {gallery.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Descargar"
            onClick={handleDownload}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Cerrar visor"
            onClick={onClose}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isGallery && (
        <button
          type="button"
          aria-label="Imagen anterior"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white transition-colors"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}

      <div
        key={currentIndex}
        className="relative flex flex-col items-center justify-center max-w-[90vw] max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {current.type === 'image' ? (
          <img
            src={current.url}
            alt={current.caption || 'Imagen adjunta'}
            loading="eager"
            decoding="async"
            className="max-w-[88vw] max-h-[82vh] object-contain rounded-lg shadow-2xl select-none"
            draggable={false}
          />
        ) : (
          <video src={current.url} controls autoPlay className="max-w-[88vw] max-h-[82vh] rounded-lg shadow-2xl" />
        )}

        {current.caption && (
          <div className="mt-3 max-w-[88vw] text-center">
            <p className="text-white/90 text-sm leading-snug line-clamp-3 drop-shadow">{current.caption}</p>
          </div>
        )}

        {isGallery && (
          <div className="flex items-center gap-1.5 mt-4">
            {gallery.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ver imagen ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(i);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-150 ${
                  i === currentIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {isGallery && (
        <button
          type="button"
          aria-label="Siguiente imagen"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white transition-colors"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      )}
    </div>,
    document.body
  );
}
```

---

### 9.5 Editor de Imágenes en Memoria antes de Enviar (`ImageEditorModal.tsx` + `ImageEditorToolbar.tsx`)
Permite al asesor anotar con lápiz libre (7 colores, 3 grosores), hacer zoom/pan táctil o recortar con máscara de regla de tercios cualquier imagen adjunta o activo de Marketing antes de enviarlo por WhatsApp, exportando un nuevo `File` `.webp` (`quality = 0.85`) sin alterar el activo original en Storage:

```tsx
// src/components/crm/image-editor-toolbar.tsx
'use client';

import { X, Undo2, Trash2, Check, Pencil, Hand, Crop, ChevronLeft, ChevronRight } from 'lucide-react';

export const EDITOR_COLORS = ['#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#000000'];
export const EDITOR_STROKES = [3, 6, 12];
export const EDITOR_MIN_SCALE = 1;
export const EDITOR_MAX_SCALE = 5;

export type EditorTool = 'hand' | 'pen' | 'crop';
export type CropHandle = 'tl' | 'tr' | 'bl' | 'br' | 'move' | null;
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function hitHandle(mx: number, my: number, crop: CropRect, r = 14): CropHandle {
  const { x, y, w, h } = crop;
  if (Math.hypot(mx - x, my - y) < r) return 'tl';
  if (Math.hypot(mx - (x + w), my - y) < r) return 'tr';
  if (Math.hypot(mx - x, my - (y + h)) < r) return 'bl';
  if (Math.hypot(mx - (x + w), my - (y + h)) < r) return 'br';
  if (mx > x && mx < x + w && my > y && my < y + h) return 'move';
  return null;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function ImageEditorCropOverlay({
  crop,
  canvasWidth,
  canvasHeight,
}: {
  crop: CropRect;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const { x, y, w, h } = crop;
  return (
    <svg
      width={canvasWidth}
      height={canvasHeight}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      preserveAspectRatio="none"
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <mask id="cm">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#cm)" />
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="6 3" />
      {[1, 2].map((i) => (
        <line key={`v${i}`} x1={x + (w * i) / 3} y1={y} x2={x + (w * i) / 3} y2={y + h} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      ))}
      {[1, 2].map((i) => (
        <line key={`h${i}`} x1={x} y1={y + (h * i) / 3} x2={x + w} y2={y + (h * i) / 3} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      ))}
      {[
        { cx: x, cy: y },
        { cx: x + w, cy: y },
        { cx: x, cy: y + h },
        { cx: x + w, cy: y + h },
      ].map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={8} fill="white" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      ))}
    </svg>
  );
}

export function ImageEditorTopBar({
  isMulti,
  currentIndex,
  totalCount,
  loading,
  onPrev,
  onNext,
  onSave,
  onClose,
}: {
  isMulti: boolean;
  currentIndex: number;
  totalCount: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 bg-zinc-900/95 gap-3">
      <button type="button" onClick={onClose} className="text-white/60 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer">
        <X className="w-5 h-5" />
      </button>

      {isMulti ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrev} disabled={currentIndex === 0} className="text-white/60 hover:text-white disabled:opacity-25 p-1 cursor-pointer">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white text-xs font-medium tabular-nums min-w-[40px] text-center">
            {currentIndex + 1} / {totalCount}
          </span>
          <button type="button" onClick={onNext} disabled={currentIndex === totalCount - 1} className="text-white/60 hover:text-white disabled:opacity-25 p-1 cursor-pointer">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <span className="text-white/50 text-sm">Editar imagen</span>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={loading}
        className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer"
      >
        <Check className="w-4 h-4" />
        Guardar
      </button>
    </div>
  );
}

export function ImageEditorToolSelector({
  tool,
  scale,
  onSelectTool,
  onResetZoom,
}: {
  tool: EditorTool;
  scale: number;
  onSelectTool: (t: EditorTool) => void;
  onResetZoom: () => void;
}) {
  return (
    <div className="flex-shrink-0 flex items-center justify-center gap-1 py-2 bg-zinc-900/80">
      {(
        [
          { id: 'hand', Icon: Hand, label: 'Ver' },
          { id: 'pen', Icon: Pencil, label: 'Dibujar' },
          { id: 'crop', Icon: Crop, label: 'Recortar' },
        ] as const
      ).map(({ id, Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelectTool(id)}
          className={`flex flex-col items-center gap-0.5 px-5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            tool === id ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
      {scale > 1 && (
        <button
          type="button"
          onClick={onResetZoom}
          className="ml-3 text-white/40 hover:text-white text-[10px] px-2 py-1 rounded-lg border border-white/20 transition-colors cursor-pointer"
        >
          {Math.round(scale * 100)}% ✕
        </button>
      )}
    </div>
  );
}

export function ImageEditorBottomToolbar({
  tool,
  color,
  strokeIdx,
  scale,
  canApplyCrop,
  canUndo,
  onSelectColor,
  onSelectStroke,
  onApplyCrop,
  onUndo,
  onClear,
}: {
  tool: EditorTool;
  color: string;
  strokeIdx: number;
  scale: number;
  canApplyCrop: boolean;
  canUndo: boolean;
  onSelectColor: (c: string) => void;
  onSelectStroke: (idx: number) => void;
  onApplyCrop: () => void;
  onUndo: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex-shrink-0 bg-zinc-900/95 px-4 pt-3 pb-4" style={{ minHeight: 110 }}>
      <div className="flex items-center justify-center min-h-[36px] mb-2">
        {tool === 'pen' && (
          <div className="flex items-center gap-2.5">
            {EDITOR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onSelectColor(c)}
                className="rounded-full transition-transform flex-shrink-0 cursor-pointer"
                style={{
                  width: 26,
                  height: 26,
                  backgroundColor: c,
                  border: color === c ? '3px solid #007AFF' : '2px solid rgba(255,255,255,0.3)',
                  transform: color === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        )}
        {tool === 'crop' && canApplyCrop && (
          <button
            type="button"
            onClick={onApplyCrop}
            className="bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold px-5 py-1.5 rounded-full transition-opacity cursor-pointer"
          >
            Aplicar recorte
          </button>
        )}
        {tool === 'hand' && (
          <p className="text-white/30 text-xs">
            {scale > 1
              ? 'Arrastra para mover · Rueda / pellizca para zoom'
              : 'Rueda del ratón o pellizca para hacer zoom'}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {tool === 'pen' &&
            EDITOR_STROKES.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => onSelectStroke(i)}
                className={`flex items-center justify-center transition-opacity cursor-pointer ${
                  strokeIdx === i ? 'opacity-100' : 'opacity-35'
                }`}
                style={{ width: 36, height: 36 }}
              >
                <div className="rounded-full bg-white" style={{ width: s + 4, height: s + 4 }} />
              </button>
            ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="text-white/60 hover:text-white disabled:opacity-25 p-2.5 rounded-xl transition-colors cursor-pointer"
            title="Deshacer (Ctrl+Z)"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="text-white/60 hover:text-red-400 p-2.5 rounded-xl transition-colors cursor-pointer"
            title="Restaurar imagen original"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### 9.6 Menú de Adjuntos, Staging Bar con Edición Inline y Biblioteca Singleton de Stickers WebP (`ChatAttachmentMenu.tsx` + `useCrmStickers.ts`)
- **`ChatAttachmentMenu` + `ChatStagedAttachmentBar`**: Gestiona el botón de clip (`Paperclip`) con opciones de Documento/Archivo, Tomar Foto (`capture="environment"`) y Grabar Video, más la barra de archivos en staging que permite editar cualquier imagen con `ImageEditorModal` antes de enviarla.
- **`useCrmStickers`**: Hook singleton con `onSnapshot` compartido sobre `crm_stickers`, conversión automática de cualquier imagen a `512×512` `image/webp` (`imageToStickerWebp`) y guardado directo de stickers recibidos en el chat (`saveExistingMediaAsSticker`).

```typescript
// src/hooks/crm/use-crm-stickers.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useFirestore, useStorage, useUser } from '@/firebase';
import { CrmSticker } from '@/lib/types/crm';
import { imageToStickerWebp } from '@/lib/utils/image-to-webp';

let sharedStickers: CrmSticker[] = [];
let sharedLoading = true;
let activeUnsub: (() => void) | null = null;
const subscribers = new Set<(stickers: CrmSticker[], loading: boolean) => void>();

export function useCrmStickers() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const [stickers, setStickers] = useState<CrmSticker[]>(sharedStickers);
  const [loading, setLoading] = useState(sharedLoading);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const handler = (newStickers: CrmSticker[], newLoading: boolean) => {
      setStickers(newStickers);
      setLoading(newLoading);
    };
    subscribers.add(handler);

    if (firestore && !activeUnsub) {
      const q = query(collection(firestore, 'crm_stickers'), orderBy('createdAt', 'desc'));
      activeUnsub = onSnapshot(
        q,
        (snap) => {
          sharedStickers = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CrmSticker, 'id'>) }));
          sharedLoading = false;
          subscribers.forEach((sub) => sub(sharedStickers, sharedLoading));
        },
        (err) => {
          console.error('[useCrmStickers shared listener error]:', err);
          sharedLoading = false;
          subscribers.forEach((sub) => sub(sharedStickers, sharedLoading));
        }
      );
    }

    return () => {
      subscribers.delete(handler);
      if (subscribers.size === 0 && activeUnsub) {
        activeUnsub();
        activeUnsub = null;
      }
    };
  }, [firestore]);

  const uploadCustomSticker = useCallback(
    async (file: File, name?: string): Promise<CrmSticker | null> => {
      if (!firestore || !storage || !user) return null;
      setUploading(true);
      try {
        const webpFile = await imageToStickerWebp(file);
        const storagePath = `crm_stickers/${Date.now()}_${user.uid}.webp`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, webpFile, { contentType: 'image/webp' });
        const url = await getDownloadURL(storageRef);

        const docRef = await addDoc(collection(firestore, 'crm_stickers'), {
          name: name || file.name.replace(/\.[^.]+$/, ''),
          url,
          storagePath,
          mimeType: 'image/webp',
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          createdByName: user.displayName || user.email || 'Agente',
        });

        return { id: docRef.id, url, storagePath, mimeType: 'image/webp', createdBy: user.uid };
      } catch (err) {
        console.error('[useCrmStickers] uploadCustomSticker error:', err);
        return null;
      } finally {
        setUploading(false);
      }
    },
    [firestore, storage, user]
  );

  const saveExistingMediaAsSticker = useCallback(
    async (url: string, name?: string): Promise<CrmSticker | null> => {
      if (!firestore || !user) return null;
      const exists = stickers.some((s) => s.url === url);
      if (exists) return stickers.find((s) => s.url === url) || null;

      try {
        const docRef = await addDoc(collection(firestore, 'crm_stickers'), {
          name: name || 'Sticker',
          url,
          mimeType: 'image/webp',
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          createdByName: user.displayName || user.email || 'Agente',
        });
        return { id: docRef.id, url, mimeType: 'image/webp', createdBy: user.uid };
      } catch (err) {
        console.error('[useCrmStickers] saveExistingMediaAsSticker error:', err);
        return null;
      }
    },
    [firestore, user, stickers]
  );

  const deleteSticker = useCallback(
    async (stickerId: string, storagePath?: string): Promise<boolean> => {
      if (!firestore) return false;
      try {
        await deleteDoc(doc(firestore, 'crm_stickers', stickerId));
        if (storagePath && storage) {
          await deleteObject(ref(storage, storagePath)).catch(() => {});
        }
        return true;
      } catch (err) {
        console.error('[useCrmStickers] deleteSticker error:', err);
        return false;
      }
    },
    [firestore, storage]
  );

  return { stickers, loading, uploading, uploadCustomSticker, saveExistingMediaAsSticker, deleteSticker };
}
```


---

### 9.7 Modales Complementarios del Chat (`ImageEditorModal`, `SaveSharedContactModal`, `ChatAttachmentMenu` y `EmojiStickerPicker`)

#### 1. `src/components/crm/image-editor-modal.tsx` (Editor Canvas 2D con Lápiz, Recorte Regla de Tercios, Undo Stack, Zoom y Exportación `.webp`)

```tsx
// src/components/crm/image-editor-modal.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  EDITOR_COLORS,
  EDITOR_STROKES,
  EDITOR_MIN_SCALE,
  EDITOR_MAX_SCALE,
  type EditorTool,
  type CropHandle,
  type CropRect,
  hitHandle,
  clamp,
  ImageEditorTopBar,
  ImageEditorToolSelector,
  ImageEditorBottomToolbar,
  ImageEditorCropOverlay,
} from './image-editor-toolbar';

export interface EditorImageSource {
  file?: File;
  url?: string;
  name: string;
}

interface Props {
  images: EditorImageSource[];
  initialIndex?: number;
  onSave: (index: number, editedFile: File) => void;
  onClose: () => void;
}

export function ImageEditorModal({ images, initialIndex = 0, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [tool, setTool] = useState<EditorTool>('pen');
  const [color, setColor] = useState(EDITOR_COLORS[0]);
  const [strokeIdx, setStrokeIdx] = useState(1);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [crop, setCrop] = useState<CropRect | null>(null);

  const cropDragging = useRef<{
    handle: CropHandle;
    startCrop: CropRect;
    startMx: number;
    startMy: number;
  } | null>(null);

  const drawing = useRef(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const loadedKey = useRef<string>('');
  const handDrag = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const getKey = (src: EditorImageSource) =>
    src.file ? `file:${src.file.name}:${src.file.size}` : `url:${src.url}`;

  const loadImage = useCallback(async (src: EditorImageSource) => {
    const newKey = getKey(src);
    if (loadedKey.current === newKey) return;
    loadedKey.current = newKey;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setLoading(true);
    setUndoStack([]);
    setCrop(null);
    setScale(1);
    setPan({ x: 0, y: 0 });

    try {
      let objectUrl: string;
      if (src.file) {
        objectUrl = URL.createObjectURL(src.file);
      } else if (src.url) {
        const res = await fetch(src.url);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
      } else {
        setLoading(false);
        return;
      }

      const img = new window.Image();
      img.onload = () => {
        imgRef.current = img;
        const wrapper = wrapperRef.current;
        const maxW = wrapper ? wrapper.clientWidth : window.innerWidth;
        const maxH = wrapper ? wrapper.clientHeight : window.innerHeight - 160;
        const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        canvas.width = Math.round(img.naturalWidth * ratio);
        canvas.height = Math.round(img.naturalHeight * ratio);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        setLoading(false);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setLoading(false);
      };
      img.src = objectUrl;
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (images[currentIndex]) loadImage(images[currentIndex]);
  }, [currentIndex, images, loadImage]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const snap = next.pop()!;
      canvasRef.current?.getContext('2d')?.putImageData(snap, 0, 0);
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft' && images.length > 1) {
        setCurrentIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'ArrowRight' && images.length > 1) {
        setCurrentIndex((i) => Math.min(images.length - 1, i + 1));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images.length, onClose, handleUndo]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setScale((s) => clamp(s * factor, EDITOR_MIN_SCALE, EDITOR_MAX_SCALE));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    let prevDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        prevDist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        if (prevDist > 0) {
          setScale((s) => clamp(s * (dist / prevDist), EDITOR_MIN_SCALE, EDITOR_MAX_SCALE));
        }
        prevDist = dist;
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  useEffect(() => {
    if (scale <= EDITOR_MIN_SCALE) setPan({ x: 0, y: 0 });
  }, [scale]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    setUndoStack((prev) => [...prev.slice(-19), ctx.getImageData(0, 0, canvas.width, canvas.height)]);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (loading) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === 'hand') {
      handDrag.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      return;
    }

    const pos = getPos(e);

    if (tool === 'crop') {
      const handle = crop ? hitHandle(pos.x, pos.y, crop) : null;
      if (crop && handle) {
        cropDragging.current = { handle, startCrop: { ...crop }, startMx: pos.x, startMy: pos.y };
      } else {
        const initial = { x: pos.x, y: pos.y, w: 0, h: 0 };
        setCrop(initial);
        cropDragging.current = { handle: 'br', startCrop: initial, startMx: pos.x, startMy: pos.y };
      }
      return;
    }

    drawing.current = true;
    saveSnapshot();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, EDITOR_STROKES[strokeIdx] / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (loading) return;

    if (tool === 'hand' && handDrag.current && scale > 1) {
      setPan({
        x: handDrag.current.panX + (e.clientX - handDrag.current.startX),
        y: handDrag.current.panY + (e.clientY - handDrag.current.startY),
      });
      return;
    }

    if (tool === 'crop' && cropDragging.current && canvasRef.current) {
      const pos = getPos(e);
      const { handle, startCrop, startMx, startMy } = cropDragging.current;
      const dx = pos.x - startMx;
      const dy = pos.y - startMy;
      let { x, y, w, h } = startCrop;
      const cw = canvasRef.current.width;
      const ch = canvasRef.current.height;
      if (handle === 'move') { x += dx; y += dy; }
      else if (handle === 'br') { w += dx; h += dy; }
      else if (handle === 'tl') { x += dx; y += dy; w -= dx; h -= dy; }
      else if (handle === 'tr') { w += dx; y += dy; h -= dy; }
      else if (handle === 'bl') { x += dx; w -= dx; h += dy; }
      x = clamp(x, 0, cw);
      y = clamp(y, 0, ch);
      w = clamp(w, 10, cw - x);
      h = clamp(h, 10, ch - y);
      setCrop({ x, y, w, h });
      return;
    }

    if (tool === 'pen' && drawing.current) {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = EDITOR_STROKES[strokeIdx];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    drawing.current = false;
    handDrag.current = null;
    cropDragging.current = null;
    if (tool === 'pen') {
      canvasRef.current?.getContext('2d')?.beginPath();
    }
  };

  const handleClear = () => {
    if (!canvasRef.current || !imgRef.current) return;
    saveSnapshot();
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.drawImage(imgRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    setCrop(null);
  };

  const handleApplyCrop = useCallback(() => {
    if (!crop || !canvasRef.current) return;
    const { x, y, w, h } = crop;
    if (w < 5 || h < 5) return;
    saveSnapshot();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(x, y, w, h);
    canvas.width = w;
    canvas.height = h;
    ctx.putImageData(imageData, 0, 0);
    setCrop(null);
  }, [crop, saveSnapshot]);

  const handleSave = () => {
    if (loading || !canvasRef.current) return;
    if (crop && crop.w > 5 && crop.h > 5) handleApplyCrop();
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const base = images[currentIndex]?.name?.replace(/\.[^.]+$/, '') || 'imagen';
        onSave(currentIndex, new File([blob], `${base}_editada.webp`, { type: 'image/webp' }));
      },
      'image/webp',
      0.85
    );
  };

  if (typeof document === 'undefined') return null;

  const canvas = canvasRef.current;
  const canvasCursor = tool === 'hand' ? (scale > 1 ? 'grab' : 'default') : 'crosshair';
  const transform =
    scale > 1
      ? `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px)`
      : `scale(${scale})`;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ touchAction: 'none' }}>
      <ImageEditorTopBar
        isMulti={images.length > 1}
        currentIndex={currentIndex}
        totalCount={images.length}
        loading={loading}
        onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        onNext={() => setCurrentIndex((i) => Math.min(images.length - 1, i + 1))}
        onSave={handleSave}
        onClose={onClose}
      />

      <ImageEditorToolSelector
        tool={tool}
        scale={scale}
        onSelectTool={setTool}
        onResetZoom={() => {
          setScale(1);
          setPan({ x: 0, y: 0 });
        }}
      />

      <div
        ref={wrapperRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative bg-[#111]"
        style={{ touchAction: 'none' }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        <div
          style={{
            transform,
            transformOrigin: 'center center',
            transition: 'transform 0.04s linear',
            position: 'relative',
            display: 'inline-block',
            lineHeight: 0,
          }}
        >
          <canvas
            ref={canvasRef}
            className="block max-w-full max-h-full"
            style={{ cursor: canvasCursor, touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {tool === 'crop' && crop && canvas && (
            <ImageEditorCropOverlay crop={crop} canvasWidth={canvas.width} canvasHeight={canvas.height} />
          )}
        </div>
      </div>

      <ImageEditorBottomToolbar
        tool={tool}
        color={color}
        strokeIdx={strokeIdx}
        scale={scale}
        canApplyCrop={Boolean(crop && crop.w > 5 && crop.h > 5)}
        canUndo={undoStack.length > 0}
        onSelectColor={setColor}
        onSelectStroke={setStrokeIdx}
        onApplyCrop={handleApplyCrop}
        onUndo={handleUndo}
        onClear={handleClear}
      />
    </div>,
    document.body
  );
}
```

#### 2. `src/components/crm/save-shared-contact-modal.tsx` (Guardado Anti-Duplicados de Contacto Compartido con Clasificación de Grupo)

```tsx
// src/components/crm/save-shared-contact-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Phone, User, Check, Loader2, AlertTriangle, MessageSquare, Store } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { CheckContactResult } from '@/app/actions/crm-chat-actions';
import { useToast } from '@/hooks/use-toast';

interface SaveSharedContactModalProps {
  initialName: string;
  phone: string;
  onClose: () => void;
  onSaved: (conversationId: string, openChat: boolean) => void;
}

export function SaveSharedContactModal({
  initialName,
  phone,
  onClose,
  onSaved,
}: SaveSharedContactModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName || '');
  const [contactType, setContactType] = useState<'client' | 'supplier' | 'courier' | 'internal'>('client');
  const [isDistributor, setIsDistributor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [existingContact, setExistingContact] = useState<CheckContactResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function check() {
      if (!phone) {
        setIsChecking(false);
        return;
      }
      setIsChecking(true);
      try {
        const token = await getAuth().currentUser?.getIdToken();
        const checkRes = await fetch('/api/crm/conversations/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ phone }),
        });

        if (!checkRes.ok) {
          throw new Error('Error al verificar contacto');
        }

        const result: CheckContactResult = await checkRes.json();

        if (isMounted) {
          if (result?.exists) {
            setExistingContact(result);
            if (result.name) setName(result.name);
            if (result.category) setContactType(result.category);
            if (result.isDistributor !== undefined) setIsDistributor(result.isDistributor);
          } else {
            setExistingContact(null);
          }
        }
      } catch (err) {
        console.error('Error checking existing contact:', err);
      } finally {
        if (isMounted) setIsChecking(false);
      }
    }
    check();
    return () => {
      isMounted = false;
    };
  }, [phone]);

  const handleSave = async (openChat: boolean = false) => {
    if (!phone) {
      toast({
        title: 'Sin número',
        description: 'No hay un número válido para guardar.',
        variant: 'destructive',
      });
      return;
    }

    if (existingContact?.exists) {
      toast({
        title: 'Contacto ya registrado',
        description: 'Este contacto ya se encuentra en el CRM y no se duplicará.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const response = await fetch('/api/crm/conversations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          phone,
          name: name.trim() || phone,
          assignedTo: null,
          assignedToName: null,
          contactType,
          isDistributor: contactType === 'client' ? isDistributor : false,
          preventDuplicate: true,
        }),
      });

      const res = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(res?.error || 'Error de red al guardar el contacto');
      }

      if (res?.success && res?.conversationId) {
        toast({
          title: 'Contacto guardado',
          description: `${name || phone} registrado con éxito en el CRM.`,
        });
        onSaved(res.conversationId, openChat);
        onClose();
      } else if (res?.alreadyExists) {
        toast({
          title: 'Contacto ya existe',
          description: 'Este contacto ya existía en la base de datos.',
          variant: 'destructive',
        });
        if (res.conversationId) {
          setExistingContact({
            exists: true,
            conversationId: res.conversationId,
            name: res.contactName,
            phone,
          });
        }
      } else {
        throw new Error(res?.error || 'Error al guardar');
      }
    } catch (err: any) {
      toast({
        title: 'Error al guardar',
        description: err.message || 'No se pudo registrar el contacto.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/40">
          <h3 className="font-semibold text-foreground flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4 text-primary" />
            Guardar Contacto en CRM
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isChecking && (
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 p-2.5 rounded-xl border border-primary/20">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Verificando si el contacto ya existe en el CRM...</span>
            </div>
          )}

          {existingContact?.exists && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-200 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-100 text-sm">
                  Contacto ya registrado
                </p>
                <p className="text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
                  Este número ya existe en el CRM registrado como:{' '}
                  <strong className="font-semibold text-amber-950 dark:text-amber-50">
                    {existingContact.name || phone}
                  </strong>{' '}
                  ({existingContact.phone || phone}).
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Para evitar duplicados en la base de datos, no se guardará de nuevo. Puedes ir directamente al chat existente.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Nombre del Contacto
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={existingContact?.exists || isChecking}
                placeholder="Nombre o empresa..."
                className="w-full pl-9 pr-3 py-2 bg-background border border-input text-foreground rounded-xl text-[16px] sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Teléfono
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={phone}
                disabled
                className="w-full pl-9 pr-3 py-2 bg-muted border border-border text-muted-foreground rounded-xl text-sm font-mono cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              ¿A qué grupo pertenece?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={existingContact?.exists || isChecking}
                onClick={() => setContactType('client')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                  existingContact?.exists ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                } ${
                  contactType === 'client'
                    ? 'bg-primary/10 border-primary text-primary shadow-2xs font-bold'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>🛒</span> Cliente
              </button>
              <button
                type="button"
                disabled={existingContact?.exists || isChecking}
                onClick={() => setContactType('supplier')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                  existingContact?.exists ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                } ${
                  contactType === 'supplier'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-500 dark:text-emerald-300 shadow-2xs font-bold'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>🏭</span> Proveedor
              </button>
              <button
                type="button"
                disabled={existingContact?.exists || isChecking}
                onClick={() => setContactType('courier')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                  existingContact?.exists ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                } ${
                  contactType === 'courier'
                    ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-950/50 dark:border-purple-500 dark:text-purple-300 shadow-2xs font-bold'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>🚚</span> Encomienda
              </button>
              <button
                type="button"
                disabled={existingContact?.exists || isChecking}
                onClick={() => setContactType('internal')}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                  existingContact?.exists ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                } ${
                  contactType === 'internal'
                    ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-950/50 dark:border-sky-500 dark:text-sky-300 shadow-2xs font-bold'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>👥</span> Equipo Interno
              </button>
            </div>

            {contactType === 'client' && (
              <button
                type="button"
                disabled={existingContact?.exists || isChecking}
                onClick={() => setIsDistributor((prev) => !prev)}
                className={`mt-2.5 w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                  existingContact?.exists ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                } ${
                  isDistributor
                    ? 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2.5 text-left">
                  <Store className={`w-4 h-4 shrink-0 ${isDistributor ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-xs font-semibold leading-tight">Es Distribuidor</p>
                    <p className="text-[10px] opacity-75 leading-tight mt-0.5">Cliente que compra al por mayor / aliado B2B</p>
                  </div>
                </div>
                <span
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                    isDistributor
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-input bg-background'
                  }`}
                >
                  {isDistributor && <Check className="w-3 h-3 stroke-[3]" />}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border bg-muted/40 flex items-center justify-end gap-2">
          {existingContact?.exists ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              {existingContact.conversationId && (
                <button
                  type="button"
                  onClick={() => {
                    onSaved(existingContact.conversationId!, true);
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Abrir Chat Existente
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSubmitting || isChecking}
                className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Guardar en CRM
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### 3. `src/components/crm/chat-attachment-menu.tsx` (Menú de Adjuntos, `ChatStagedAttachmentBar` con botón `Pencil` de edición de imagen, `ChatReplyQuoteBanner`, `ChatExpiredWindowBanner` y `ChatEmojiButton`)

```tsx
// src/components/crm/chat-attachment-menu.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Paperclip, File as FileIcon, Camera, Video, Pencil, X, Clock, FileText, Smile } from 'lucide-react';
import { CrmMessageType, Message } from '@/lib/types/crm';
import { isGifImageFile, isRasterImageFile } from '@/lib/utils/image-to-webp';
import { ImageEditorModal } from './image-editor-modal';
import { EmojiStickerPicker } from './emoji-sticker-picker';

export function resolveAttachmentMessageType(file: File): CrmMessageType {
  // WhatsApp Cloud API rejects image/gif on type="image" (Error 131053) — route through FFmpeg video pipeline
  if (isGifImageFile(file)) return 'video';
  if (isRasterImageFile(file)) return 'image';
  if (file.type.startsWith('video/') || /\.(mp4|mov|3gp|avi|mkv|m4v)$/i.test(file.name)) return 'video';
  if (file.name.toLowerCase().endsWith('.webm') || file.type.includes('webm') || file.type === '') {
    return 'document';
  }
  const isMetaSupportedAudio =
    ['audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/amr'].some((m) =>
      file.type.toLowerCase().startsWith(m)
    ) || /\.(ogg|opus|mp3|m4a|aac|amr)$/i.test(file.name);
  if (isMetaSupportedAudio) return 'audio';
  return 'document';
}

function formatFileSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function getAttachmentTypeLabel(file: File): string {
  if (isGifImageFile(file)) return 'GIF (Video)';
  if (isRasterImageFile(file)) return 'Imagen';
  if (file.type.startsWith('video/') || /\.(mp4|mov|3gp|avi|mkv|m4v)$/i.test(file.name)) return 'Video';
  if (file.type.startsWith('audio/') && !file.type.includes('webm') && !/\.webm$/i.test(file.name)) return 'Audio';
  return 'Documento';
}

interface ChatAttachmentMenuProps {
  disabled: boolean;
  isWindowExpired: boolean;
  onSelectFiles: (files: File[]) => void;
}

export function ChatAttachmentMenu({
  disabled,
  isWindowExpired,
  onSelectFiles,
}: ChatAttachmentMenuProps) {
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showAttachMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showAttachMenu]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    if (selected.length > 0) onSelectFiles(selected);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    e.target.value = '';
  };

  return (
    <>
      <input
        type="file"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip"
      />
      <input
        type="file"
        ref={photoInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
      />
      <input
        type="file"
        ref={videoInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept="video/*"
        capture="environment"
      />

      <div className="relative" ref={attachMenuRef}>
        <button
          type="button"
          onClick={() => setShowAttachMenu((v) => !v)}
          disabled={disabled}
          className={`p-1.5 sm:p-2 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer ${
            showAttachMenu
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          title={isWindowExpired ? 'Ventana de 24h cerrada' : 'Adjuntar...'}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {showAttachMenu && (
          <div className="absolute bottom-full left-0 mb-2 w-52 bg-popover rounded-xl shadow-xl border border-border py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                fileInputRef.current?.click();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors text-left cursor-pointer"
            >
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <FileIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span>Documento / Archivo</span>
                <span className="text-[10px] text-muted-foreground font-normal">PDF, Fotos, Audio...</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                photoInputRef.current?.click();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-700 dark:hover:text-rose-300 transition-colors text-left cursor-pointer"
            >
              <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex-shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span>Tomar Foto</span>
                <span className="text-[10px] text-muted-foreground font-normal">Abre cámara para fotos</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAttachMenu(false);
                videoInputRef.current?.click();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors text-left cursor-pointer"
            >
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span>Grabar Video</span>
                <span className="text-[10px] text-muted-foreground font-normal">Abre cámara para video</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

interface ChatStagedAttachmentBarProps {
  attachments: File[];
  hasReplyAbove: boolean;
  onReplaceFile: (index: number, file: File) => void;
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
}

export function ChatStagedAttachmentBar({
  attachments,
  hasReplyAbove,
  onReplaceFile,
  onRemoveFile,
  onClearAll,
}: ChatStagedAttachmentBarProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const editingFile = editingIndex !== null ? attachments[editingIndex] : null;
  const canEditSelected = Boolean(editingFile && isRasterImageFile(editingFile));

  return (
    <>
      <div
        className={`flex flex-col gap-1.5 px-3 py-2 bg-primary/10 border-b border-primary/20 ${
          !hasReplyAbove ? 'rounded-t-2xl' : ''
        } animate-in slide-in-from-bottom-2 duration-150 relative overflow-hidden`}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
        {attachments.length > 1 && (
          <div className="flex items-center justify-between pl-2">
            <span className="text-[11px] font-semibold text-primary">
              {attachments.length} archivos adjuntos listos
            </span>
            <button
              type="button"
              onClick={onClearAll}
              className="text-[11px] font-medium text-muted-foreground hover:text-destructive cursor-pointer"
            >
              Quitar todos
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 pl-2 max-h-28 overflow-y-auto">
          {attachments.map((file, idx) => {
            const canEditImage = isRasterImageFile(file);
            return (
              <div
                key={`${file.name}-${file.size}-${idx}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-card/90 border border-primary/20 min-w-0 max-w-full sm:max-w-[260px]"
              >
                <div className="p-1 rounded-md bg-primary/15 text-primary flex-shrink-0">
                  <FileIcon className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium text-foreground text-xs truncate">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatFileSize(file.size)} • {getAttachmentTypeLabel(file)}
                  </span>
                </div>
                {canEditImage && (
                  <button
                    type="button"
                    onClick={() => setEditingIndex(idx)}
                    className="p-1 text-primary hover:text-primary/80 rounded-full hover:bg-primary/15 flex-shrink-0 cursor-pointer"
                    title="Editar imagen"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveFile(idx)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted flex-shrink-0 cursor-pointer"
                  title="Quitar archivo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {editingIndex !== null && editingFile && canEditSelected && (
        <ImageEditorModal
          images={[{ file: editingFile, name: editingFile.name }]}
          initialIndex={0}
          onSave={(_idx, editedFile) => {
            onReplaceFile(editingIndex, editedFile);
            setEditingIndex(null);
          }}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </>
  );
}

export function ChatReplyQuoteBanner({
  replyingTo,
  onCancel,
}: {
  replyingTo?: Message | null;
  onCancel?: () => void;
}) {
  if (!replyingTo) return null;
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b border-primary/20 rounded-t-2xl animate-in slide-in-from-bottom-2 duration-150 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      <div className="flex flex-col text-xs pl-2 truncate">
        <span className="font-semibold text-primary text-[11px]">
          Respondiendo a {replyingTo.senderName || (replyingTo.senderId === 'user' ? 'Ti' : 'Cliente')}
        </span>
        <span className="text-muted-foreground line-clamp-1 text-[11px]">
          {replyingTo.text || (replyingTo.mediaUrl ? '📷 Archivo adjunto' : 'Mensaje')}
        </span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted flex-shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ChatExpiredWindowBanner({ onOpenTemplate }: { onOpenTemplate: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 mb-2 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-amber-900 shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1.5 rounded-xl bg-amber-100/80 text-amber-700 shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold leading-tight">Ventana de 24 horas cerrada</p>
          <p className="text-[11px] text-amber-700/90 leading-tight mt-0.5">
            Para reabrir el chat, debes enviar una plantilla oficial de WhatsApp verificada por Meta.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenTemplate}
        className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shrink-0 shadow-xs transition-colors cursor-pointer"
      >
        <FileText className="w-3.5 h-3.5" />
        <span>Enviar Plantilla</span>
      </button>
    </div>
  );
}

export function ChatEmojiButton({
  disabled,
  onEmojiSelect,
  onSendSticker,
}: {
  disabled: boolean;
  onEmojiSelect: (emoji: string) => void;
  onSendSticker: (stickerUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={`p-1.5 sm:p-2 rounded-full transition-colors flex-shrink-0 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer ${
          open
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
        title="Emojis y Stickers"
      >
        <Smile className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <EmojiStickerPicker
            onEmojiSelect={onEmojiSelect}
            onSendSticker={(url) => {
              onSendSticker(url);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
```

#### 4. `src/components/crm/emoji-sticker-picker.tsx` (Selector Dual de Emojis con `localStorage` Recientes + Catálogo de Stickers `.webp` Compartidos del Equipo)

```tsx
// src/components/crm/emoji-sticker-picker.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Smile, Sticker, Search, Trash2, X, Upload, Loader2 } from 'lucide-react';
import { useCrmStickers } from '@/hooks/crm/use-crm-stickers';
import { CrmSticker } from '@/lib/types/crm';
import { useUser } from '@/firebase';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Caras',
    emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠'],
  },
  {
    label: 'Gestos',
    emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💪','🦾','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👁️','👅','👄'],
  },
  {
    label: 'Personas',
    emojis: ['🧑','👦','👧','👨','👩','🧓','👴','👵','🧕','👮','🕵️','💂','🥷','👷','🤴','👸','👰','🤵','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🧞','🧟','💆','💇','🚶','🧍','🧎','🏃','💃','🕺','👫','👬','👭','👨‍👩‍👦','👨‍👩‍👧','👨‍👩‍👧‍👦','👩‍👧','👩‍👦'],
  },
  {
    label: 'Animales',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🦆','🐧','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🦎','🐍','🐊','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈'],
  },
  {
    label: 'Comida',
    emojis: ['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍑','🍒','🍍','🥭','🍅','🥥','🥝','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🥗','🍜','🍝','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍡','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🍯','🧃','🥤','🍵','☕','🫖','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉'],
  },
  {
    label: 'Viajes',
    emojis: ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🚚','🚛','🚜','🛵','🏍️','🚲','🛴','🛺','🚁','🛸','✈️','🛩️','🚀','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','🚂','🚃','🚄','🚅','🚆','🚇','🚊','🚉','⛺','🏕️','🏞️','🗻','🏔️','🗾','🌋','🏝️','🏜️','🏟️','🏛️','🏗️','🧱','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏭','🏯','🏰','🗼','🗽','🗿','🗺️','🌐'],
  },
  {
    label: 'Objetos',
    emojis: ['💡','🔦','🕯️','🪔','📱','💻','🖥️','🖨️','⌨️','🖱️','💾','📀','📸','📷','📹','🎥','📞','☎️','📺','📻','🎙️','🎛️','⏰','⌚','⏱️','⏲️','📡','🔋','🔌','🔧','🔨','⚙️','🪛','🪜','🧲','💊','💉','🩺','🩹','🩻','🔬','🔭','📚','📖','📓','📔','📒','📕','📗','📘','📙','📄','📜','📃','📑','📊','📈','📉','🗒️','🗃️','📁','📂','🗂️','📌','📍','✂️','🖇️','📎','🖊️','✒️','🖋️','📝','✏️','🔏','🔐','🔑','🗝️'],
  },
  {
    label: 'Símbolos',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','✡️','🔯','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','🔞','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','🔱','⚜️','🔰','♻️','✅','🈯','💹','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅'],
  },
];

const RECENT_KEY = 'crm_emoji_recents';
const MAX_RECENTS = 24;

function getRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentEmoji(emoji: string) {
  try {
    const prev = getRecentEmojis().filter((e) => e !== emoji);
    localStorage.setItem(RECENT_KEY, JSON.stringify([emoji, ...prev].slice(0, MAX_RECENTS)));
  } catch {}
}

interface StickerCardProps {
  sticker: CrmSticker;
  currentUserId?: string;
  isModuleAdmin?: boolean;
  onSend: (url: string) => void;
  onDelete: (id: string, storagePath?: string) => void;
}

function StickerCard({ sticker, currentUserId, isModuleAdmin, onSend, onDelete }: StickerCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canDelete = isModuleAdmin || sticker.createdBy === currentUserId;

  return (
    <div className="relative group aspect-square">
      <button
        type="button"
        onClick={() => onSend(sticker.url)}
        className="w-full h-full flex items-center justify-center p-1 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors"
        title={sticker.name || 'Sticker'}
      >
        <img
          src={sticker.url}
          alt={sticker.name || 'Sticker'}
          className="w-full h-full object-contain drop-shadow-sm"
          loading="lazy"
          decoding="async"
        />
      </button>

      {canDelete && (
        <div className="absolute -top-1 -right-1 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {confirmDelete ? (
            <div className="flex gap-1 bg-popover rounded-full shadow-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => { onDelete(sticker.id, sticker.storagePath); setConfirmDelete(false); }}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold hover:bg-destructive/90 transition-colors"
                title="Confirmar eliminación"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                title="Cancelar"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-popover border border-border shadow-sm text-muted-foreground hover:text-destructive transition-colors"
              title="Eliminar sticker"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface EmojiStickerPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onSendSticker: (url: string) => void;
  onClose: () => void;
  isModuleAdmin?: boolean;
}

export function EmojiStickerPicker({
  onEmojiSelect,
  onSendSticker,
  onClose,
  isModuleAdmin = false,
}: EmojiStickerPickerProps) {
  const { user } = useUser();
  const { stickers, loading: stickersLoading, uploading, uploadCustomSticker, deleteSticker } = useCrmStickers();
  const [tab, setTab] = useState<'emoji' | 'sticker'>('emoji');
  const [search, setSearch] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [activeCat, setActiveCat] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentEmojis(getRecentEmojis());
  }, []);

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [tab]);

  const handleEmoji = useCallback(
    (emoji: string) => {
      onEmojiSelect(emoji);
      addRecentEmoji(emoji);
      setRecentEmojis(getRecentEmojis());
    },
    [onEmojiSelect]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await uploadCustomSticker(file);
  };

  const handleSendSticker = (url: string) => {
    onSendSticker(url);
    onClose();
  };

  const visibleEmojis = search
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.includes(search))
    : EMOJI_CATEGORIES[activeCat]?.emojis ?? [];

  return (
    <div
      className="flex flex-col bg-popover rounded-2xl shadow-2xl border border-border overflow-hidden"
      style={{ width: 'min(380px, 96vw)', height: 'min(440px, 70vh)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center border-b border-border px-2 pt-2 gap-1 shrink-0">
        <button
          type="button"
          onClick={() => { setTab('emoji'); setSearch(''); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            tab === 'emoji'
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Smile className="w-4 h-4" />
          Emojis
        </button>
        <button
          type="button"
          onClick={() => { setTab('sticker'); setSearch(''); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            tab === 'sticker'
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Sticker className="w-4 h-4" />
          Stickers
          {stickers.length > 0 && (
            <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-px text-[10px] font-bold">
              {stickers.length}
            </span>
          )}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-2 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/60 rounded-xl border border-border">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'emoji' ? 'Buscar emoji...' : 'Buscar sticker...'}
            className="flex-1 bg-transparent text-[16px] sm:text-xs text-foreground placeholder-muted-foreground border-none outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {tab === 'emoji' ? (
        <>
          {!search && (
            <div className="flex gap-0.5 px-2 py-1 overflow-x-auto scrollbar-none shrink-0 border-b border-border/60">
              {recentEmojis.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveCat(-1)}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    activeCat === -1
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Recientes
                </button>
              )}
              {EMOJI_CATEGORIES.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveCat(i)}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    activeCat === i
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-2 py-1">
            <div className="grid grid-cols-8 gap-0.5">
              {(search
                ? visibleEmojis
                : activeCat === -1
                ? recentEmojis
                : EMOJI_CATEGORIES[activeCat]?.emojis ?? []
              ).map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => handleEmoji(emoji)}
                  className="w-9 h-9 flex items-center justify-center text-xl rounded-lg hover:bg-muted active:bg-muted/80 transition-colors select-none"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {search && visibleEmojis.length === 0 && (
              <p className="text-center text-xs text-muted-foreground mt-8">Sin resultados para "{search}"</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-2 py-1.5 border-b border-border/60 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Subir nuevo sticker
                </>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {stickersLoading ? (
              <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-xs">Cargando stickers...</span>
              </div>
            ) : stickers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
                <Sticker className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs font-medium text-foreground">Sin stickers aún</p>
                <p className="text-[11px] mt-0.5 text-muted-foreground">Sube el primero o guarda uno desde un chat</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {stickers
                  .filter((s) => !search || (s.name || '').toLowerCase().includes(search.toLowerCase()))
                  .map((sticker) => (
                    <StickerCard
                      key={sticker.id}
                      sticker={sticker}
                      currentUserId={user?.uid}
                      isModuleAdmin={isModuleAdmin}
                      onSend={handleSendSticker}
                      onDelete={deleteSticker}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```


---

## 10. Refinamiento Visual de `ChatHeader`, Documentos PDF Multilínea sin Scroll Horizontal, `ChatContextualToolbar` con POS, `EditContactModal` y Pila de Navegación Móvil `useCrmMobileBackLayer` (`v4.11.0` → `v4.18.9`)

### 10.1 `ChatHeader` Refinado: Edición en 1 Clic (`Pencil`), 5 Categorías de Contacto, Badge `Lead` vs `Cliente #ID` y Fila Única de Etiquetas sin Recorte (`src/components/crm/chat-header.tsx`)
Reglas críticas de arquitectura visual en `ChatHeader`:
1. **Nombre y Avatar Clicables con Indicador `Pencil`**: Al hacer clic sobre el avatar o el nombre del contacto se abre `EditContactModal`, mostrando un ícono `Pencil` sutil en hover para que el asesor edite el nombre, grupo o perfil fiscal sin buscar menús ocultos.
2. **Subtítulo con Teléfono + 5 Categorías + Estado POS (`Lead` vs `Cliente #ID`)**: Muestra simultáneamente el teléfono, el badge de grupo (`🛒 Cliente`, `🏪 Distribuidor`, `🏭 Proveedor`, `🚚 Encomienda`, `👥 Equipo Interno`) y el estado en el Punto de Venta (`Lead` en ámbar o `Cliente #ID` en esmeralda).
3. **Fila Única Horizontal de Etiquetas con Botón `+ Etiqueta` Fuera de `overflow-x-auto`**: Para que el menú desplegable (`absolute left-0 top-full z-50`) de `+ Etiqueta` **jamás sea recortado por el contenedor con scroll horizontal en móvil**, el botón `+ Etiqueta` y su popover se montan dentro de un `<div className="relative shrink-0" ref={tagMenuRef}>` hermano **fuera** del `<div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap min-w-0 flex-1">` que contiene los chips de etiquetas:

```tsx
// Fragmento canónico de src/components/crm/chat-header.tsx — Subtítulo de Categorías + Barra de Etiquetas Anti-Recorte
<div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
  <span className="truncate font-mono text-[11px]">{contactPhone}</span>

  {/* 5 Categorías de Contacto */}
  {contact?.category === 'supplier' ? (
    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
      🏭 Proveedor
    </span>
  ) : contact?.category === 'courier' ? (
    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300">
      🚚 Encomienda
    </span>
  ) : contact?.category === 'internal' ? (
    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300">
      👥 Equipo Interno
    </span>
  ) : contact?.isDistributor ? (
    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
      🏪 Distribuidor
    </span>
  ) : (
    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-primary/10 text-primary">
      🛒 Cliente
    </span>
  )}

  {/* Badge en vivo Lead vs Cliente POS */}
  {(!contact?.category || contact?.category === 'client') &&
    (contact?.posClientId ? (
      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
        Cliente #{contact.posClientId}
      </span>
    ) : (
      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25">
        Lead
      </span>
    ))}
</div>

{/* Barra Inferior de Etiquetas en Fila Única: el botón "+ Etiqueta" vive FUERA de overflow-x-auto */}
<div className="px-3 sm:px-4 py-1.5 border-t border-border/60 bg-muted/25 flex items-center gap-1.5 min-w-0">
  {/* 1. Contenedor shrink-0 FUERA del scroll horizontal para que el dropdown z-50 nunca se recorte */}
  <div className="relative shrink-0" ref={tagMenuRef}>
    <button
      type="button"
      onClick={() => setShowTagMenu((v) => !v)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
    >
      <Plus className="w-3 h-3" />
      <span>Etiqueta</span>
    </button>

    {showTagMenu && (
      <div className="absolute left-0 top-full mt-1.5 w-56 max-h-64 overflow-y-auto rounded-xl bg-popover border border-border shadow-xl z-50 p-1.5 space-y-0.5">
        {availableTags.map((tag) => {
          const isAssigned = activeTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleToggleTag(tag.id)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${resolveTagDotClass(tag.color)}`} />
                <span className="truncate font-medium text-foreground">{tag.name}</span>
              </span>
              {isAssigned && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
            </button>
          );
        })}
      </div>
    )}
  </div>

  {/* 2. Tira desplazable horizontalmente en 1 sola fila para los chips de etiquetas activas */}
  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap min-w-0 flex-1">
    {assignedTags.map((tag) => (
      <span
        key={tag.id}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${resolveTagColorClass(
          tag.color
        )}`}
      >
        <span>{tag.name}</span>
        <button
          type="button"
          onClick={() => handleToggleTag(tag.id)}
          className="hover:opacity-75 cursor-pointer"
          aria-label={`Quitar etiqueta ${tag.name}`}
        >
          <X className="w-3 h-3" />
        </button>
      </span>
    ))}
  </div>
</div>
```

---

### 10.2 Visualización de Documentos PDF Multilínea sin Desbordamiento Horizontal y Deduplicación de Nombre (`MessageBubbleMedia` + `MessageBubble`)
Para evitar que documentos PDF con nombres largos o guiones bajos (`Cotizacion_Proyecto_Remodelacion_Completa_Cliente_2026_Final.pdf`) provoquen scroll horizontal raro en la burbuja o repitan el nombre del archivo dos veces:
1. **Ancho Acotado + Envoltura Multilínea (`line-clamp-2 break-words [overflow-wrap:anywhere]`)**: En `src/components/crm/message-bubble-media.tsx`, la tarjeta del documento usa `w-full max-w-[225px] sm:max-w-[270px] min-w-0 overflow-hidden` y el título del archivo aplica `line-clamp-2 break-words [overflow-wrap:anywhere] leading-snug` para partirse limpiamente hasta en **2 líneas** sin jamás ensanchar la burbuja.
2. **Badge Dinámico de Extensión (`extLabel`)**: Extrae la extensión real (`PDF`, `DOCX`, `XLSX`, `ZIP`, etc.) y la muestra en una insignia compacta junto a `"Tocá para abrir documento"`.
3. **Deduplicación Automática `isDuplicateDocFilename` en `MessageBubble`**: Cuando WhatsApp o el POS envía un documento cuyo `body` es idéntico a `message.media.filename` (o al marcador `'📄 Documento'`), `MessageBubble` suprime el `renderCaption` inferior para no mostrar dos veces el mismo nombre de archivo:

```tsx
// 1. En src/components/crm/message-bubble.tsx — Supresión de caption duplicado en documentos PDF
const rawCaption = (message.body || '').trim();
const isDefaultDocPlaceholder = /^📄\s*Documento$/i.test(rawCaption);
const isDuplicateDocFilename =
  message.type === 'document' &&
  Boolean(
    rawCaption &&
      (isDefaultDocPlaceholder ||
        (message.media?.filename &&
          rawCaption.toLowerCase() === message.media.filename.trim().toLowerCase()))
  );
const mediaCaption = isDuplicateDocFilename ? '' : rawCaption;
```

```tsx
// 2. En src/components/crm/message-bubble-media.tsx — Tarjeta de Documento PDF Multilínea sin Scroll Horizontal
if (message.type === 'document') {
  const docFilename =
    message.media?.filename?.trim() ||
    (message.body && !/^📄\s*Documento$/i.test(message.body.trim())
      ? message.body.trim()
      : 'Documento.pdf');
  const extMatch = docFilename.match(/\.([a-zA-Z0-9]{2,5})$/);
  const extLabel = extMatch ? extMatch[1].toUpperCase() : 'PDF';

  return (
    <div className="space-y-1.5 min-w-0">
      {mediaUrl ? (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background/70 hover:bg-background/95 border border-border/70 transition-colors w-full max-w-[225px] sm:max-w-[270px] min-w-0 overflow-hidden group"
        >
          <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 flex flex-col items-center justify-center shrink-0 mt-0.5">
            <FileText className="w-4 h-4" />
            <span className="text-[8px] font-extrabold leading-none mt-0.5">{extLabel}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-semibold text-foreground line-clamp-2 break-words [overflow-wrap:anywhere] leading-snug group-hover:text-primary transition-colors"
              title={docFilename}
            >
              {docFilename}
            </p>
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              Tocá para abrir documento
            </span>
          </div>
        </a>
      ) : (
        <button
          type="button"
          onClick={handleManualDownload}
          disabled={downloading}
          className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background/60 hover:bg-background/90 border border-border/70 transition-colors w-full max-w-[225px] sm:max-w-[270px] min-w-0 overflow-hidden text-left cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Download className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-semibold text-foreground line-clamp-2 break-words [overflow-wrap:anywhere] leading-snug"
              title={docFilename}
            >
              {docFilename}
            </p>
            <span className="text-[10px] text-primary font-medium block mt-0.5">
              {downloading ? 'Descargando documento...' : `Descargar ${extLabel}`}
            </span>
          </div>
        </button>
      )}
      {mediaCaption && renderCaption(mediaCaption)}
    </div>
  );
}
```

---

### 10.3 `ChatContextualToolbar` Compacta con Punto de Venta (`POS`) y Divisores Verticales (`src/components/crm/chat-contextual-toolbar.tsx`)
La barra contextual sobre el input del chat distribuye equitativamente (`flex-1`) las herramientas operativas del asesor con divisores verticales (`h-5 w-px bg-border`), mostrando únicamente íconos en móvil (`hidden sm:inline`) para evitar desbordamientos y ocultando `POS` automáticamente si el rol no tiene el permiso `crm.pos`:

```tsx
// src/components/crm/chat-contextual-toolbar.tsx
'use client';

import { Fragment } from 'react';
import {
  StickyNote,
  Truck,
  FolderKanban,
  CreditCard,
  ShoppingCart,
  Image as ImageIcon,
} from 'lucide-react';

export type RightPanelTab =
  | 'notes'
  | 'delivery'
  | 'projects'
  | 'payment'
  | 'pos'
  | null;

interface ChatContextualToolbarProps {
  activeTab: RightPanelTab;
  onSelectTab: (tab: Exclude<RightPanelTab, null>) => void;
  onOpenMarketingPicker: () => void;
  canUsePos?: boolean;
  deliveryLabel?: string;
}

export function ChatContextualToolbar({
  activeTab,
  onSelectTab,
  onOpenMarketingPicker,
  canUsePos = true,
  deliveryLabel = 'Entrega',
}: ChatContextualToolbarProps) {
  const items = [
    { id: 'notes' as const, label: 'Notas', icon: StickyNote, visible: true },
    { id: 'delivery' as const, label: deliveryLabel, icon: Truck, visible: true },
    { id: 'projects' as const, label: 'Proyectos', icon: FolderKanban, visible: true },
    { id: 'payment' as const, label: 'Cobro', icon: CreditCard, visible: true },
    { id: 'pos' as const, label: 'POS', icon: ShoppingCart, visible: canUsePos },
  ].filter((item) => item.visible);

  return (
    <div className="flex items-center border-t border-border bg-card/90 px-1.5 py-1 select-none shrink-0">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <Fragment key={item.id}>
            {idx > 0 && <div className="h-5 w-px bg-border/70 shrink-0 mx-0.5" />}
            <button
              type="button"
              onClick={() => onSelectTab(item.id)}
              title={item.label}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-w-0 ${
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline truncate">{item.label}</span>
            </button>
          </Fragment>
        );
      })}

      <div className="h-5 w-px bg-border/70 shrink-0 mx-0.5" />
      <button
        type="button"
        onClick={onOpenMarketingPicker}
        title="Catálogo y Marketing"
        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer min-w-0"
      >
        <ImageIcon className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline truncate">Marketing</span>
      </button>
    </div>
  );
}
```

---

### 10.4 Modal Bottom-Sheet de Edición de Contacto con Detección de Cambios (`hasChanges`) y Conversión `Lead → Cliente Facturable POS` (`src/components/crm/edit-contact-modal.tsx`)
Cuando el asesor toca el nombre en `ChatHeader` o pulsa **"Convertir a Cliente"** desde el POS:
- Se abre `EditContactModal` con diseño **Bottom-Sheet en móvil (`items-end sm:items-center rounded-t-2xl sm:rounded-2xl`)**.
- Compara el estado actual contra el inicial (`hasChanges`) para habilitar el botón **"Guardar Cambios"** únicamente cuando hay modificaciones reales.
- Incluye un acordeón inline para vincular o crear al contacto como **Cliente Facturable en el POS/ERP** (con búsqueda por cédula/RUC/NIT, sugerencia de clientes existentes para evitar duplicados en el ERP y validación de correo/ubicación fiscal).

---

### 10.5 Pila Jerárquica de Navegación Móvil para el Botón Físico "Atrás" (`src/hooks/crm/use-crm-mobile-back.ts`)
En dispositivos Android e iOS PWA, presionar el gesto o botón físico "Atrás" mientras se tiene abierto el panel del `POS`, `Notas`, `EditContactModal`, `MarketingPicker` o un sub-tab de `Configuración` no debe sacar al usuario de la ruta `/crm` ni cerrar toda la conversación de golpe. El hook `useCrmMobileBackLayer` mantiene una **pila LIFO global sobre `window.history.pushState`** que intercepta `popstate` y cierra únicamente la capa superior activa:

```typescript
// src/hooks/crm/use-crm-mobile-back.ts
'use client';

import { useEffect, useRef } from 'react';

type BackCloseHandler = () => void;

interface BackLayerEntry {
  id: symbol;
  onClose: BackCloseHandler;
}

const activeStack: BackLayerEntry[] = [];
let ignorePopCount = 0;
let listenerAttached = false;

function ensureGlobalPopstateListener() {
  if (listenerAttached || typeof window === 'undefined') return;
  listenerAttached = true;

  window.addEventListener('popstate', () => {
    if (ignorePopCount > 0) {
      ignorePopCount--;
      return;
    }
    const topEntry = activeStack.pop();
    if (topEntry) {
      topEntry.onClose();
    }
  });
}

/**
 * Registra una capa modal, drawer o vista móvil en la pila jerárquica del botón "Atrás".
 * Orden de cierre en móvil (< 768px):
 * 1.º Sub-modal abierto (ej. EditContactModal, MarketingPicker, Lightbox)
 * 2.º Panel derecho abierto (POS, Notas, Entrega, Proyectos, Cobro)
 * 3.º Conversación activa (vuelve a la lista de chats de ChatSidebar)
 */
export function useCrmMobileBackLayer(isActive: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;
    const isMobileViewport = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobileViewport) return;

    ensureGlobalPopstateListener();

    const entryId = Symbol('crm-mobile-back-layer');
    const entry: BackLayerEntry = {
      id: entryId,
      onClose: () => onCloseRef.current(),
    };

    activeStack.push(entry);
    window.history.pushState({ crmBackLayer: true }, '');

    return () => {
      const idx = activeStack.findIndex((item) => item.id === entryId);
      if (idx !== -1) {
        activeStack.splice(idx, 1);
        ignorePopCount++;
        window.history.back();
      }
    };
  }, [isActive]);
}
```
