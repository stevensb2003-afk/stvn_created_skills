/**
 * dgt-error-humanizer.mjs
 * Traductor Determinista de Errores Crudos de Hacienda (DGT / XSD / PKI / Red)
 * + Detector Reactivo y Proactivo de Obsolescencia Normativa para Alertas Visuales.
 */

export function humanizeDgtError(rawMessage = '', context = {}) {
  const msg = String(rawMessage || '');
  const lower = msg.toLowerCase();

  // 1. Obsolescencia de Catálogo CABYS / Tarifa IVA
  if (lower.includes('cabys') || lower.includes('tarifa del impuesto no corresponde')) {
    return {
      code: 'DGT_CABYS_OBSOLESCENCE',
      severity: 'obsolescence',
      isObsolescenceAlert: true,
      canRetrySameClave: false,
      title: 'Código CABYS desactualizado o con tarifa IVA modificada por Hacienda',
      friendlyMessage:
        'Tu venta sigue guardada de forma segura en el sistema (no se perdió nada). Hacienda rechazó este intento porque el código CABYS de uno de los ítems cambió de clasificación o requiere otra tarifa de IVA en el catálogo vigente.',
      suggestedAction:
        'Usa el buscador CABYS en vivo para actualizar el código de 13 dígitos y su tarifa oficial, y luego pulsa "Corregir y Re-emitir" (el sistema generará un nuevo consecutivo referenciando el rechazado con TipoDocIR=10).',
      visualBanner: {
        tone: 'amber',
        badge: 'CATÁLOGO DESACTUALIZADO',
        headline: 'Actualización detectada en el Catálogo CABYS del BCCR / Hacienda',
      },
    };
  }

  // 2. Obsolescencia / Desalineación de Actividad Económica (CIIU4 / TRIBU-CR)
  if (lower.includes('codigoactividad') || lower.includes('actividad económica') || lower.includes('actividad economica') || lower.includes('ciiu')) {
    return {
      code: 'DGT_ACTIVITY_MISMATCH',
      severity: 'obsolescence',
      isObsolescenceAlert: true,
      canRetrySameClave: false,
      title: 'Actividad Económica no inscrita o actualizada a CIIU4 en TRIBU-CR',
      friendlyMessage:
        'Tu registro comercial está intacto y pre-guardado. Hacienda indicó que el código de actividad económica de 6 dígitos enviado ya no coincide con el padrón activo del emisor o receptor en TRIBU-CR.',
      suggestedAction:
        'Consulta el Padrón de Hacienda en vivo por número de cédula para sincronizar el código CIIU4 actual de 6 dígitos y pulsa "Corregir y Re-emitir".',
      visualBanner: {
        tone: 'amber',
        badge: 'PADRÓN DESACTUALIZADO',
        headline: 'Sincronización requerida de Actividad Económica CIIU4 (TRIBU-CR)',
      },
    };
  }

  // 3. Llave Criptográfica (.p12) Vencida o Revocada o Política XAdES Desactualizada
  if (lower.includes('certificado') || lower.includes('vencid') || lower.includes('revoca') || lower.includes('politica de firma') || lower.includes('sigpolicyhash')) {
    return {
      code: 'DGT_CERT_OR_POLICY_OUTDATED',
      severity: 'obsolescence',
      isObsolescenceAlert: true,
      canRetrySameClave: false,
      title: 'Llave Criptográfica (.p12) vencida/revocada o Política de Firma actualizada',
      friendlyMessage:
        'Tranquilo: la venta quedó pre-guardada en el CRM sin pérdida de datos. Hacienda rechazó la firma digital porque la Llave Criptográfica .p12 expiró/fue revocada en TRIBU-CR o cambió la política criptográfica.',
      suggestedAction:
        'Genera una nueva Llave Criptográfica (.p12) en el portal TRIBU-CR, súbela en la pestaña "Bóveda & Credenciales" y re-emite la orden pendiente.',
      visualBanner: {
        tone: 'red',
        badge: 'ACCIÓN CRÍTICA REQUERIDA',
        headline: 'Renovación obligatoria de Llave Criptográfica (.p12) o Política DGT',
      },
    };
  }

  // 4. Deriva de Esquema XML / Namespace Desactualizado
  if (lower.includes('namespace') || lower.includes('esquema') || lower.includes('version 4.3') || lower.includes('schemas validity error')) {
    return {
      code: 'DGT_SCHEMA_VALIDATION_ERROR',
      severity: 'error',
      isObsolescenceAlert: lower.includes('namespace') || lower.includes('version'),
      canRetrySameClave: Boolean(context.isLocalPreValidation),
      title: context.isLocalPreValidation
        ? 'Validación preventiva local detuvo el envío (0 consecutivos quemados)'
        : 'Estructura XML rechazada por cambio de regla de esquema en Hacienda',
      friendlyMessage: context.isLocalPreValidation
        ? `Nuestro validador XSD v4.4 detectó un campo incompleto antes de contactar a Hacienda, por lo que no se quemó ningún consecutivo. Detalle técnico: ${msg}`
        : `Tu orden sigue guardada en firme, pero Hacienda rechazó el formato estructural del XML: ${msg}`,
      suggestedAction:
        'Revisa el campo señalado en el formulario de la orden y vuelve a emitir.',
      visualBanner: lower.includes('namespace') || lower.includes('version')
        ? {
            tone: 'red',
            badge: 'NORMATIVA XML ACTUALIZADA',
            headline: 'Hacienda exige actualización de versión de esquema XSD',
          }
        : null,
    };
  }

  // 5. Idempotencia: Clave ya recibida previamente
  if (lower.includes('ya fue recibido anteriormente')) {
    return {
      code: 'DGT_DUPLICATE_CLAVE_IDEMPOTENT',
      severity: 'warning',
      isObsolescenceAlert: false,
      canRetrySameClave: true,
      title: 'Comprobante ya recibido por Hacienda (Protección Anti-Duplicado)',
      friendlyMessage:
        'Este comprobante ya había ingresado a los servidores de Hacienda en un intento previo. No debes emitir otra factura nueva.',
      suggestedAction:
        'Consulta únicamente el estado de la Clave actual (GET /recepcion/{clave}) para descargar su respuesta oficial.',
      visualBanner: null,
    };
  }

  // 6. Caída de Hacienda / Sin Internet / HTTP 5xx / 429 -> Cola de Contingencia
  if (lower.includes('timeout') || lower.includes('503') || lower.includes('502') || lower.includes('429') || lower.includes('sin internet') || lower.includes('contingencia')) {
    return {
      code: 'DGT_NETWORK_CONTINGENCY',
      severity: 'warning',
      isObsolescenceAlert: false,
      canRetrySameClave: true,
      title: 'Intermitencia en servidores de Hacienda — Venta asegurada en Cola de Contingencia',
      friendlyMessage:
        'La venta está 100% guardada y firmada en tu sistema. Los servidores del Ministerio de Hacienda no respondieron a tiempo, por lo que quedó en cola segura para reintento automático con la MISMA Clave.',
      suggestedAction:
        'No vuelvas a cobrar al cliente. Puedes reintentar el envío de esta misma Clave cuando Hacienda restablezca el servicio.',
      visualBanner: {
        tone: 'amber',
        badge: 'MODO CONTINGENCIA ACTIVO',
        headline: 'Intermitencia temporal en Ministerio de Hacienda: pre-guardado activo sin pérdida de ventas',
      },
    };
  }

  // Fallback amigable general
  return {
    code: 'DGT_GENERAL_REJECTION',
    severity: 'error',
    isObsolescenceAlert: false,
    canRetrySameClave: false,
    title: 'Observación reportada por el Ministerio de Hacienda',
    friendlyMessage: `Tu registro en el CRM sigue pre-guardado e intacto. Motivo indicado por Hacienda: ${msg || 'Error de validación fiscal.'}`,
    suggestedAction: 'Corrige el dato observado en la orden y pulsa "Corregir y Re-emitir" para enviar un nuevo consecutivo con referencia TipoDocIR=10.',
    visualBanner: null,
  };
}

export function buildProactiveVisualAlerts({ settingsStatus, sentinelReport, activeBannerFromRejections }) {
  const alerts = [];

  const certHealth = settingsStatus?.credentialsHealth;
  if (certHealth) {
    if (certHealth.certAlertLevel === 'CRITICAL_EXPIRED') {
      alerts.push({
        id: 'cert-expired',
        tone: 'red',
        badge: 'LLAVE .P12 VENCIDA',
        title: `La Llave Criptográfica .p12 venció hace ${Math.abs(certHealth.certDaysRemaining)} días`,
        detail: 'Las nuevas ventas se pre-guardarán en Contingencia para no detener tu operación. Descarga una nueva llave en TRIBU-CR y súbela en Bóveda & Credenciales.',
      });
    } else if (certHealth.certAlertLevel === 'URGENT' || certHealth.certAlertLevel === 'WARNING') {
      alerts.push({
        id: 'cert-expiring',
        tone: 'amber',
        badge: 'PREVENCIÓN .P12',
        title: `Tu Llave Criptográfica .p12 vence en ${certHealth.certDaysRemaining} días`,
        detail: 'Renueva con anticipación tu certificado tributario en TRIBU-CR para evitar interrupciones.',
      });
    }
  }

  const pol = sentinelReport?.checks?.signaturePolicyDrift;
  if (pol && pol.ok === false && pol.liveSha256) {
    alerts.push({
      id: 'policy-drift',
      tone: 'red',
      badge: 'ACTUALIZACIÓN NORMATIVA DGT',
      title: 'El Ministerio de Hacienda actualizó el PDF oficial de Política de Firma XAdES-EPES',
      detail: `Hash esperado: ${pol.expectedSha256} | Nuevo hash detectado en vivo: ${pol.liveSha256}.`,
    });
  }

  if (activeBannerFromRejections) {
    alerts.push({
      id: 'reactive-obsolescence',
      tone: activeBannerFromRejections.tone,
      badge: activeBannerFromRejections.badge,
      title: activeBannerFromRejections.headline,
      detail: 'Se detectó un rechazo reciente asociado a datos o catálogos desactualizados. Revisa la bandeja de órdenes pre-guardadas.',
    });
  }

  return alerts;
}
