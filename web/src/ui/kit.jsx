import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon';

// ---------- toasts ----------
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = 'info') => {
    const id = Math.random();
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// Run an async action with a busy flag and error toast.
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) toast(okMsg, 'success'); return r; }
    catch (e) { toast(e.message || 'صار خطأ', 'error'); return undefined; }
    finally { setBusy(false); }
  }, [toast]);
  return [run, busy];
}

// ---------- overlays ----------
// User-initiated close plays a short exit (the way it came in); programmatic close is instant.
function useExit(open, onClose, ms) {
  const [out, setOut] = useState(false);
  useEffect(() => { if (open) setOut(false); }, [open]);
  const close = useCallback(() => { if (out) return; setOut(true); setTimeout(onClose, ms); }, [out, onClose, ms]);
  return [out, close];
}
export function Sheet({ open, onClose, children, label }) {
  const [out, close] = useExit(open, onClose, 200);
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, close]);
  if (!open) return null;
  return (
    <div className={'overlay' + (out ? ' out' : '')} onClick={close}>
      <div className={'sheet' + (out ? ' out' : '')} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}
export function Modal({ open, onClose, title, children }) {
  const [out, close] = useExit(open, onClose, 160);
  if (!open) return null;
  return (
    <div className={'overlay modal-wrap' + (out ? ' out' : '')} onClick={close}>
      <div className={'modal' + (out ? ' out' : '')} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 20 }}>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label="إغلاق"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- visuals ----------
// Store mark = its category icon on a tint of the store colour. Uploaded logo wins.
export function StoreLogo({ store, size = 56, radius }) {
  return (
    <div className="slogo" style={{ width: size, height: size, borderRadius: radius ? Math.max(radius, size * 0.3) : size * 0.3, '--c': store?.color || '#0C1D16' }}>
      {store?.logo ? <img src={store.logo} alt="" /> : <Icon name={catIcon(store?.category)} size={size * 0.5} weight="duotone" />}
    </div>
  );
}
// Person = photo, else a person icon on a tint whose hue is stable per name.
const hue = (s = '') => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
export function Avatar({ user, size = 40 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, '--h': hue(user?.username || user?.name) }}>
      {user?.avatar ? <img src={user.avatar} alt="" /> : <Icon name="user" size={size * 0.52} weight="fill" />}
    </div>
  );
}
const CAT_ICON = { coffee: 'coffee', burger: 'burger', bakery: 'bakery', juice: 'juice', dessert: 'dessert', grocery: 'grocery', pharmacy: 'pharmacy', restaurant: 'restaurant' };
export const catIcon = (c) => CAT_ICON[c] || 'store';
export function ItemThumb({ item, size = 84, category }) {
  return (
    <div className="thumb" style={{ width: size, height: size }}>
      {item?.image ? <img src={item.image} alt="" loading="lazy" /> : <Icon name={catIcon(category)} size={size * 0.4} stroke={1.5} />}
    </div>
  );
}
export function Empty({ icon = 'store', title, children, action }) {
  return (
    <div className="empty">
      <div className="em-icon"><Icon name={icon} size={30} /></div>
      {title && <p className="bold" style={{ color: 'var(--ink)', fontSize: 17 }}>{title}</p>}
      {children && <p className="small">{children}</p>}
      {action}
    </div>
  );
}
export const Loader = () => <div className="page-loader"><div className="spinner" aria-label="جاري التحميل" /></div>;
export function ErrorBox({ error, onRetry }) {
  return (
    <Empty icon="flag" title="ما قدرنا نحمّل الصفحة">
      {error?.message}
      {onRetry && <><br /><button className="btn btn-light btn-sm mt-8" onClick={onRetry}>حاول مرة ثانية</button></>}
    </Empty>
  );
}
export function Stars({ value = 0, onChange, size = 36 }) {
  return (
    <div className="row" style={{ gap: 4, direction: 'ltr', justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`${n} من 5`} onClick={() => onChange && onChange(n)}
          style={{ border: 0, background: 'none', padding: 2, color: '#E9A100' }}>
          <Icon name="star" size={size} fill={n <= value ? '#E9A100' : 'none'} color={n <= value ? '#E9A100' : 'var(--line-2)'} stroke={1.6} />
        </button>
      ))}
    </div>
  );
}


// ---------- animated number ----------
// Counts up from 0 on first show, then tweens between values on live updates.
// Reduced-motion users get the final value straight away.
export function Num({ v, f = (x) => String(x), dec = 0, dur = 900 }) {
  const target = Number(v) || 0;
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = target; setShown(target); return undefined; }
    const start = from.current;
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      const val = start + (target - start) * e;
      from.current = val;
      setShown(val);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  const val = dec ? Number(shown.toFixed(dec)) : Math.round(shown);
  return <span className="num">{f(val)}</span>;
}
