// Envío saliente de webhooks: fetch nativo, timeout y reintentos configurables por env var
// (con los defaults del PRD: 10s de timeout, reintentos a los 5s y 15s) para poder acortarlos
// en tests sin cambiar el comportamiento por defecto en producción.
const TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS || 10000);
const REINTENTOS_MS = (process.env.WEBHOOK_REINTENTOS_MS || '5000,15000')
  .split(',')
  .map(Number);

const TITULOS_EVENTO = {
  criterio_aprobado: 'Criterio aprobado',
  criterio_rechazado: 'Criterio rechazado',
  caso_solucionado: 'Caso marcado como solucionado',
  caso_cerrado: 'Caso cerrado',
  prueba_reportada: 'Prueba reportada',
};

function valorLegible(valor) {
  if (Array.isArray(valor)) {
    return valor
      .map((v) => (v && typeof v === 'object' ? Object.values(v).join(' — ') : String(v)))
      .join('; ');
  }
  return String(valor);
}

// Formato mínimo pero válido de Google Chat: un mensaje de texto simple con un cardsV2
// básico (título + campos clave), sin plantillas complejas (decisión tomada al planificar
// el proyecto — ver CLAUDE.md).
function formatearGoogleChat(contexto) {
  const widgets = Object.entries(contexto)
    .filter(([clave, valor]) => clave !== 'evento' && valor !== undefined && valor !== '')
    .map(([clave, valor]) => ({ decoratedText: { topLabel: clave, text: valorLegible(valor) } }));

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
