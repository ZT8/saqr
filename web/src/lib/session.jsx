// Per-area session (customer app / branch / merchant / admin).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, socketFor, closeSocket } from './api';

const Ctx = createContext(null);

export function SessionProvider({ area, children }) {
  const client = useMemo(() => api(area), [area]);
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(!getToken(area));
  const [socket, setSocket] = useState(null);

  const refresh = useCallback(async () => {
    if (!getToken(area)) { setMe(null); setReady(true); return null; }
    try { const m = await client.get('/auth/me'); setMe(m); return m; }
    catch { setMe(null); return null; }
    finally { setReady(true); }
  }, [area, client]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onOut = (e) => { if (e.detail === area) { setMe(null); closeSocket(area); setSocket(null); } };
    window.addEventListener('around:logout', onOut);
    return () => window.removeEventListener('around:logout', onOut);
  }, [area]);
  useEffect(() => { setSocket(me ? socketFor(area) : null); }, [me && me.id, area]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    area, api: client, me, ready, socket, refresh,
    async signIn(token) { setToken(area, token); return refresh(); },
    signOut() { setToken(area, null); closeSocket(area); setSocket(null); setMe(null); }
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
