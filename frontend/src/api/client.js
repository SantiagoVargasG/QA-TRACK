const TOKEN_KEY = 'qa_tracker_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
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

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: esFormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
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

  const res = await fetch(`/api${path}`, { headers });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.blob();
}

export { apiFetch, apiFetchBlob, getToken, setToken };
