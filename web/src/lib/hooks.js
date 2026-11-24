import { useCallback, useEffect, useRef, useState } from 'react';

// Load data from the API with loading/error state and a reload function.
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  const run = useCallback(async () => {
    try {
      const data = await fn();
      if (alive.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (alive.current) setState((s) => ({ data: s.data, error: e, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { alive.current = true; run(); return () => { alive.current = false; }; }, [run]);
  return { ...state, reload: run, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

// Device position (once), falling back to null if the user declines.
let cachedPos = null;
export function usePosition() {
  const [pos, setPos] = useState(cachedPos);
  useEffect(() => {
    if (cachedPos || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => { cachedPos = { lat: p.coords.latitude, lng: p.coords.longitude }; setPos(cachedPos); },
      () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);
  return pos;
}
export const posQuery = (pos) => (pos ? `lat=${pos.lat}&lng=${pos.lng}` : '');

export function useSocketEvent(socket, event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (d) => ref.current(d);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
