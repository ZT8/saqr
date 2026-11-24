// API client. Each area (customer app, branch, merchant, admin) keeps its own session,
// so the same browser can be signed in as a customer and as staff at the same time.
import { io } from 'socket.io-client';

const KEY = (area) => `around_token_${area}`;

export function getToken(area) { return localStorage.getItem(KEY(area)); }
export function setToken(area, t) { t ? localStorage.setItem(KEY(area), t) : localStorage.removeItem(KEY(area)); }

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function api(area) {
  const call = async (method, path, body) => {
    const headers = {};
    const token = getToken(area);
    if (token) headers.Authorization = 'Bearer ' + token;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let res;
    try { res = await fetch('/api' + path, { method, headers, body: payload }); }
    catch { throw new ApiError(0, 'ما فيه اتصال بالإنترنت'); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { setToken(area, null); window.dispatchEvent(new CustomEvent('around:logout', { detail: area })); }
    if (!res.ok) throw new ApiError(res.status, data.error || 'صار خطأ، حاول مرة ثانية');
    return data;
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b ?? {}),
    put: (p, b) => call('PUT', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p) => call('DELETE', p)
  };
}

const sockets = {};
export function socketFor(area) {
  const token = getToken(area);
  if (!token) return null;
  const s = sockets[area];
  if (s && s.auth && s.auth.token === token) return s;
  if (s) s.disconnect();
  sockets[area] = io({ auth: { token }, transports: ['websocket', 'polling'] });
  return sockets[area];
}
export function closeSocket(area) { if (sockets[area]) { sockets[area].disconnect(); delete sockets[area]; } }
