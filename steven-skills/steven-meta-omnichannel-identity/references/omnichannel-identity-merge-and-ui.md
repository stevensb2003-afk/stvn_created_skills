# Unificación de Identidad Omnicanal (WhatsApp + Instagram + Messenger) y Vista 360°

Cuando un mismo cliente escribe hoy por Instagram (`@carlos_cr`), mañana por Messenger y luego por WhatsApp (`+506 8888-7777`), el CRM debe **vincular esos 3 canales bajo un mismo perfil de contacto**, sin duplicar clientes ni perder historial.

---

## 1. Esquema de Identidad Unificada en `crm_contacts/{contactId}`

```typescript
// Extensión de CrmContact en src/lib/types/crm.ts
export type CrmChannelSource = 'whatsapp' | 'instagram' | 'facebook';

export interface CrmOmnichannelIdentityFields {
  phone?: string | null;             // E.164: "+50688887777"
  igScopedId?: string | null;        // IGSID numérico
  igUsername?: string | null;        // "@carlos_cr"
  fbPsid?: string | null;            // PSID numérico de Messenger
  fbProfileName?: string | null;
  avatarUrl?: string | null;
  // Arreglo indexado con array-contains para resolución O(1) en el webhook:
  // ['wa:+50688887777', 'ig:17841400...', 'fb:928173...']
  channelKeys: string[];
  linkedConversationIds?: {
    whatsapp?: string;
    instagram?: string;
    facebook?: string;
  };
  mergedFromContactIds?: string[];
}
```

### Resolución en `getOrCreateOmnichannelContact`
Al llegar un webhook:
- Para WhatsApp construye `key = 'wa:' + e164Phone`.
- Para Instagram construye `key = 'ig:' + igScopedId`.
- Para Messenger construye `key = 'fb:' + fbPsid`.
- Consulta `crm_contacts.where('channelKeys', 'array-contains', key).limit(1)`. Si ya está vinculado a un cliente existente, el webhook carga automáticamente la ficha maestra del cliente con todas sus etiquetas, notas, historial POS y asesor asignado (`ownerId`).

---

## 2. Detección Automática de Teléfono + Sugerencia de Vinculación en 1 Clic

Cuando un cliente de **Instagram** o **Messenger** escribe un mensaje de texto con su número telefónico (ej. *"Claro, mi WhatsApp es 8888-7777"*):
1. El parser extrae dígitos candidatos (`/\b(?:\+?\d[\d\s-]{6,14}\d)\b/g`) y los normaliza usando `getPhoneLookupVariants`.
2. Si existe un contacto previo en `crm_contacts` con ese teléfono:
   - **Nunca fusiona silenciosamente** (para evitar errores si alguien escribe el número de un tercero o familiar).
   - Graba en la conversación social `suggestedMergeContact: { contactId, contactName, phone }`.
3. `ChatHeader` muestra una píldora discreta accionable:
   > 🔗 **Posible coincidencia con WhatsApp: Carlos Mora (+506 8888-7777)** — `[Vincular Perfiles]`

---

## 3. Transacción Atómica de Fusión (`mergeOmnichannelContactsTransaction`)

Permite fusionar manualmente (desde el modal *"Vincular Identidad Omnicanal"* en `ChatHeader` / `CrmRightPanel`) o desde el banner de sugerencia automática, conservando **el 100% de mensajes, notas, citas, etiquetas y documentos POS**:

```typescript
// src/lib/services/crm-identity-merge.ts
import { FieldValue } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { crmPaths } from '@/lib/utils/crm-paths';
import { generateSearchPrefixes } from '@/lib/utils/search-helpers';

export async function mergeOmnichannelContacts(params: {
  tenantId?: string;
  primaryContactId: string;
  secondaryContactId: string;
  actorUid: string;
}) {
  const { firestore } = initializeFirebaseAdmin();
  const paths = crmPaths(params.tenantId || 'default');
  if (params.primaryContactId === params.secondaryContactId) {
    throw new Error('No puedes vincular un contacto consigo mismo.');
  }

  const primaryRef = firestore.doc(`${paths.contacts}/${params.primaryContactId}`);
  const secondaryRef = firestore.doc(`${paths.contacts}/${params.secondaryContactId}`);

  // 1. Fusionar campos del contacto maestro dentro de runTransaction
  await firestore.runTransaction(async (tx) => {
    const [pSnap, sSnap] = await Promise.all([tx.get(primaryRef), tx.get(secondaryRef)]);
    if (!pSnap.exists || !sSnap.exists) {
      throw new Error('Uno de los contactos no existe.');
    }

    const p = pSnap.data()!;
    const s = sSnap.data()!;

    const mergedChannelKeys = Array.from(
      new Set([...(p.channelKeys || []), ...(s.channelKeys || [])])
    );
    const mergedTags = Array.from(new Set([...(p.tagIds || []), ...(s.tagIds || [])]));
    const mergedLinkedConvs = {
      ...(s.linkedConversationIds || {}),
      ...(p.linkedConversationIds || {}),
    };

    const finalPhone = p.phone || s.phone || null;
    const finalName = p.name || s.name || s.fbProfileName || s.igUsername || 'Cliente';
    const finalIgUsername = p.igUsername || s.igUsername || null;

    tx.update(primaryRef, {
      name: finalName,
      phone: finalPhone,
      email: p.email || s.email || null,
      company: p.company || s.company || null,
      igScopedId: p.igScopedId || s.igScopedId || null,
      igUsername: finalIgUsername,
      fbPsid: p.fbPsid || s.fbPsid || null,
      fbProfileName: p.fbProfileName || s.fbProfileName || null,
      avatarUrl: p.avatarUrl || s.avatarUrl || null,
      channelKeys: mergedChannelKeys,
      tagIds: mergedTags,
      linkedConversationIds: mergedLinkedConvs,
      mergedFromContactIds: Array.from(
        new Set([...(p.mergedFromContactIds || []), params.secondaryContactId])
      ),
      searchPrefixes: generateSearchPrefixes(
        `${finalName} ${finalIgUsername || ''}`,
        finalPhone || '',
        p.email || s.email || '',
        p.company || s.company || ''
      ),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(secondaryRef, {
      mergedIntoContactId: params.primaryContactId,
      archivedByMerge: true,
      channelKeys: [], // Libera keys para que webhooks apunten al primario
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  // 2. Reasignar conversaciones y subcolecciones (notes, schedules) en lotes <= 450
  const convsSnap = await firestore
    .collection(paths.conversations)
    .where('contactId', '==', params.secondaryContactId)
    .get();

  const notesSnap = await secondaryRef.collection('notes').get();
  const schedulesSnap = await secondaryRef.collection('schedules').get();

  const ops: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  for (const c of convsSnap.docs) {
    ops.push((b) => b.update(c.ref, {
      contactId: params.primaryContactId,
      suggestedMergeContact: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }));
  }
  for (const n of notesSnap.docs) {
    ops.push((b) => b.set(primaryRef.collection('notes').doc(n.id), n.data()));
  }
  for (const sc of schedulesSnap.docs) {
    ops.push((b) => b.set(primaryRef.collection('schedules').doc(sc.id), sc.data()));
  }

  for (let i = 0; i < ops.length; i += 400) {
    const batch = firestore.batch();
    for (const fn of ops.slice(i, i + 400)) fn(batch);
    await batch.commit();
  }

  return { ok: true, primaryContactId: params.primaryContactId, migratedItems: ops.length };
}
```

---

## 4. UI Omnicanal y Línea de Tiempo Unificada 360°

1. **Filtro de Canal en `ChatSidebar`:** Chips rápidos `Todos` | `WhatsApp` | `Instagram` | `Messenger` (consulta en memoria o `where('source', '==', channel)` respaldado por índice compuesto `(source ASC, lastMessageAt DESC)`).
2. **Píldoras de Canales Vinculados en `ChatHeader`:**
   - Si el contacto tiene WhatsApp + Instagram + Messenger vinculados, el header muestra las 3 insignias de canal con indicador activo y un botón **"Vista 360° (Unificada)"**.
   - Al activar **Vista 360°**, el chat combina cronológicamente los mensajes de las conversaciones vinculadas del cliente mostrando en cada burbuja una pequeña insignia del canal de origen (*WA*, *IG*, *FB*).
   - Botón **"+ Vincular Canal"** para unir otro chat existente de Instagram/Messenger/WhatsApp en 2 clics.
3. **Selector de Canal de Respuesta en `ChatInput`:** Permite responder por el canal activo o cambiar entre los canales vinculados mostrando la regla de ventana viva (`WhatsApp: Activo 24h / Plantilla` | `Instagram: Activo 7d` | `Messenger: Activo 24h / 7d`).
