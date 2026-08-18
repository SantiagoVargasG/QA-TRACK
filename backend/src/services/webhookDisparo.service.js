// Envío saliente de webhooks: fetch nativo, timeout y reintentos configurables por env var
// (con los defaults del PRD: 10s de timeout, reintentos a los 5s y 15s) para poder acortarlos
// en tests sin cambiar el comportamiento por defecto en producción.
const TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS || 10000);
const REINTENTOS_MS = (process.env.WEBHOOK_REINTENTOS_MS || '5000,15000')
  .split(',')
  .map(Number);

const TITULOS_EVENTO = {
  hu_reportada: 'Historia reportada',
  prueba_reportada: 'Prueba reportada',
};

function valorLegible(valor, clave) {
  if (Array.isArray(valor)) {
    // Caso especial: modulos (array de {nombre, historias: [...]})
    if (clave === 'modulos' && valor.length > 0 && valor[0].historias) {
      return valor
        .map((mod) => {
          const hus = mod.historias.map((h) => `${h.codigo}: ${h.texto}`).join('; ');
          return `${mod.nombre} — ${hus}`;
        })
        .join('\n');
    }
    // Array genérico de valores primitivos
    return valor
      .map((v) => (v && typeof v === 'object' ? Object.values(v).join(' — ') : String(v)))
      .join('; ');
  }
  return String(valor);
}

// Card compacta específica para hu_reportada (decisión post-MVP: nada de texto largo).
// Encabezado "[Proyecto] · HU-N: título", una línea de estado con emoji, y — solo si está
// rechazada — una lista breve de los criterios rechazados con su último comentario. El botón
// "Abrir HU" linkea al deep link armado en webhookService.reportarHistoria (url_hu).
function formatearGoogleChatHuReportada(contexto) {
  const aprobada = contexto.resultado === 'aprobada';
  const widgets = [{ decoratedText: { text: aprobada ? '✅ Aprobada' : '❌ Rechazada' } }];

  if (!aprobada && contexto.criterios_rechazados?.length > 0) {
    const texto = contexto.criterios_rechazados
      .map((c) => `• ${c.criterio}${c.comentario ? `: ${c.comentario}` : ''}`)
      .join('\n');
    widgets.push({ textParagraph: { text: texto } });
  }

  if (contexto.url_hu) {
    widgets.push({
      buttonList: { buttons: [{ text: 'Abrir HU', onClick: { openLink: { url: contexto.url_hu } } }] },
    });
  }

  return {
    cardsV2: [
      {
        cardId: `hu_reportada-${Date.now()}`,
        card: {
          header: { title: `[${contexto.proyecto}] · ${contexto.hu}` },
          sections: [{ widgets }],
        },
      },
    ],
  };
}

// Formato mínimo pero válido de Google Chat para el resto de los eventos (hoy solo
// prueba_reportada): un cardsV2 básico (título + campos clave), sin plantillas complejas
// (decisión tomada al planificar el proyecto — ver CLAUDE.md).
function formatearGoogleChat(contexto) {
  if (contexto.evento === 'hu_reportada') return formatearGoogleChatHuReportada(contexto);

  const widgets = Object.entries(contexto)
    .filter(([clave, valor]) => clave !== 'evento' && valor !== undefined && valor !== '')
    .map(([clave, valor]) => ({ decoratedText: { topLabel: clave, text: valorLegible(valor, clave) } }));

  return {
    cardsV2: [
      {
        cardId: `${contexto.evento}-${Date.now()}`,
        card: {
          header: { title: TITULOS_EVENTO[contexto.evento] || contexto.evento },
          sections: [{ widgets }],
        },
      },
    ],
  };
}

// El proveedor genérico envía el contexto tal cual, como POST JSON plano (PRD sección 7.4).
function formatearGenerico(contexto) {
  return contexto;
}

async function enviarUnaVez(url, cuerpo) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`respuesta HTTP ${res.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// No lanza al llamador si todos los intentos fallan más allá de lo que el propio caller
// decida capturar — cada webhook se envía independientemente de los demás y nunca bloquea
// la operación del usuario que disparó el evento (se llama sin await desde donde corresponda).
async function enviarConReintentos(webhook, contexto) {
  const cuerpo = webhook.proveedor === 'google_chat' ? formatearGoogleChat(contexto) : formatearGenerico(contexto);
  const intentos = REINTENTOS_MS.length + 1;
  let ultimoError;

  for (let intento = 0; intento < intentos; intento += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await enviarUnaVez(webhook.url, cuerpo);
      console.log(`[webhooks] "${webhook.nombre}" (${webhook._id}) entregado — evento ${contexto.evento}`);
      return;
    } catch (err) {
      ultimoError = err;
      if (intento < intentos - 1) {
        // eslint-disable-next-line no-await-in-loop
        await esperar(REINTENTOS_MS[intento]);
      }
    }
  }

  console.error(
    `[webhooks] "${webhook.nombre}" (${webhook._id}) falló tras ${intentos} intentos — evento ${contexto.evento}:`,
    ultimoError.message,
  );
  throw ultimoError;
}

module.exports = { enviarConReintentos, formatearGoogleChat, formatearGenerico };
