// Dev-only data switch. It only appears when the server exposes /api/dev/dataset,
// which is never mounted with NODE_ENV=production. The choice lives in the URL (?data=worst).
import { useEffect, useState } from 'react';

const LABELS = { demo: 'Demo data', worst: 'Worst case', empty: 'Empty' };

export default function DevData() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.self !== window.top) return;
    fetch('/api/dev/dataset').then((r) => (r.ok ? r.json() : null)).then(async (s) => {
      if (!s) return;
      const wanted = new URLSearchParams(location.search).get('data');
      if (wanted && s.options.includes(wanted) && wanted !== s.current) {
        await fetch('/api/dev/dataset/' + wanted, { method: 'POST' });
        location.reload();
        return;
      }
      setState(s);
    }).catch(() => {});
  }, []);

  if (!state) return null;
  const pick = async (name) => {
    setBusy(true);
    await fetch('/api/dev/dataset/' + name, { method: 'POST' });
    const u = new URL(location.href);
    u.searchParams.set('data', name);
    location.replace(u);
  };
  return (
    <div style={S.wrap} dir="ltr" aria-label="Dev data switch">
      {state.options.map((o) => (
        <button key={o} type="button" disabled={busy} onClick={() => pick(o)}
          style={{ ...S.seg, ...(state.current === o ? S.on : null) }}>{LABELS[o] || o}</button>
      ))}
    </div>
  );
}

const S = {
  wrap: { position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', gap: 2,
    padding: 3, background: '#e5e5e5', borderRadius: 999, font: '12px system-ui, sans-serif', boxShadow: '0 1px 3px rgba(0,0,0,.15)' },
  seg: { border: 0, background: 'transparent', padding: '5px 10px', borderRadius: 999, color: '#444', cursor: 'pointer', font: 'inherit' },
  on: { background: '#fff', color: '#111' },
};
