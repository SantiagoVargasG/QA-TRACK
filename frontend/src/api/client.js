const TOKEN_KEY = 'qa_tracker_token';

// En producción, VITE_API_URL apunta al backend remoto (ej. Render)
// En desarrollo, usa /api (proxy configurado en vite.config.js)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Decodifica el payload de un JWT sin validar la firma (eso ya lo hizo el backend al
// emitirlo) solo para leer `exp` y decidir si conviene ni intentar usarlo. Nunca se usa
// para autorizar nada en el cliente.
function decodificarPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function tokenExpirado(token) {
  const payload = decodificarPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

// Interceptor global de 401: cualquier request autenticado que reciba 401 (token vencido o
// revocado en el servidor) dispara este callback una sola vez registrado por AuthContext al
// montar. No se dispara para llamadas con auth:false (login/registro), donde un 401/400 es
// simplemente "credenciales inválidas", no "tu sesión expiró".
let manejador401 = null;
function registrarManejador401(fn) {
  manejador401 = fn;
}

async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  // FormData (evidencias multipart) no lleva Content-Type manual ni JSON.stringify: el
  // navegador arma el boundary correcto si se lo dejamos poner a él.
  const esFormData = body instanceof FormData;
  const headers = esFormData ? {} : { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: esFormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (auth && res.status === 401 && manejador401) manejador401();
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}

// Para evidencias (imágenes/video): un <img>/<video> no puede mandar el header
// Authorization, así que se descarga el archivo autenticado y se expone como object URL.
async function apiFetchBlob(path) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!res.ok) {
    if (res.status === 401 && manejador401) manejador401();
    throw new Error(`Error ${res.status}`);
  }
  return res.blob();
}

export { apiFetch, apiFetchBlob, getToken, setToken, tokenExpirado, registrarManejador401 };
