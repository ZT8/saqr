import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useCart } from '../../lib/cart';
import { ago } from '../../lib/format';
import Icon from '../../ui/Icon';
import { Avatar, StoreLogo, Loader, useAction, useToast } from '../../ui/kit';

const DURATION = 5000;

// Full-screen stories (tap right/left, auto-advance, hold to pause), with
// like, report, and "order the same" from the attached order.
export default function StoryViewer() {
  const { userId } = useParams();
  const [params] = useSearchParams();
  const storeId = params.get('store');
  const { api } = useSession();
  const nav = useNavigate();
  const cart = useCart();
  const toast = useToast();
  const [run] = useAction();
  const [stories, setStories] = useState(null);
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState(false);
  const started = useRef(Date.now());
  const elapsed = useRef(0);

  useEffect(() => {
    run(async () => {
      const list = storeId ? (await api.get(`/stores/${storeId}`)).stories : await api.get(`/social/stories/${userId}`);
      if (!list.length) { nav(-1); return; }
      setStories(list);
    });
  }, [userId, storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => (window.history.length > 1 ? nav(-1) : nav('/app'));
  const go = (d) => {
    elapsed.current = 0; started.current = Date.now(); setProgress(0);
    setI((x) => { const n = x + d; if (n < 0) return 0; if (n >= stories.length) { close(); return x; } return n; });
  };

  useEffect(() => { if (stories && stories[i]) api.post(`/social/posts/${stories[i].id}/view`).catch(() => {}); }, [stories, i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!stories || paused || menu) return undefined;
    started.current = Date.now();
    const t = setInterval(() => {
      const p = (elapsed.current + Date.now() - started.current) / DURATION;
      if (p >= 1) { clearInterval(t); go(1); } else setProgress(p);
    }, 50);
    return () => { clearInterval(t); elapsed.current += Date.now() - started.current; };
  }, [stories, i, paused, menu]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stories) return <div className="story"><Loader /></div>;
  const s = stories[i];
  const like = () => run(async () => { const r = await api.post(`/social/posts/${s.id}/like`); setStories((l) => l.map((x) => (x.id === s.id ? { ...x, liked: r.liked, likes: r.likes } : x))); });
  const report = () => run(async () => { await api.post(`/social/posts/${s.id}/report`, { reason: 'محتوى غير لائق' }); setMenu(false); toast('شكراً، بنراجع البلاغ', 'success'); });
  const reorder = () => run(async () => {
    const st = await api.get(`/stores/${s.merchant.id}`);
    const all = st.menu.flatMap((c) => c.items);
    const lines = s.items.map((x) => all.find((it) => it.id === x.item_id && it.is_available) && { ...all.find((it) => it.id === x.item_id), qty: x.qty })
      .filter(Boolean).map((it) => ({ item_id: it.id, name: it.name, price: it.price, qty: it.qty }));
    if (!lines.length) throw new Error('المنتجات غير متوفرة الحين');
    cart.load(st, st.branch.id, lines, s.id);
    nav('/app/checkout');
  });

  return (
    <div className="story">
      <div className="story-inner" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
        <img className="story-img" src={s.image} alt={s.caption || 'ستوري'} />
        <div className="story-shade" />
        <button className="story-tap" style={{ right: 0 }} onClick={() => go(-1)} aria-label="السابق" />
        <button className="story-tap" style={{ left: 0 }} onClick={() => go(1)} aria-label="التالي" />

        <div style={{ position: 'relative', zIndex: 3, padding: '14px 14px 0' }} className="col gap-14">
          <div className="story-bars">{stories.map((x, k) => <span key={x.id}><i style={{ width: k < i ? '100%' : k === i ? `${progress * 100}%` : 0 }} /></span>)}</div>
          <div className="row">
            <Link to={`/app/social/user/${s.user.id}`} className="row grow"><Avatar user={s.user} size={38} /><div><b>{s.user.username || s.user.name}</b><div className="xs" style={{ opacity: .85 }}>{ago(s.created_at)}</div></div></Link>
            <button className="cam-tool" onClick={() => setMenu(!menu)} aria-label="خيارات"><Icon name="more" /></button>
            <button className="cam-tool" onClick={close} aria-label="إغلاق"><Icon name="close" /></button>
          </div>
          {menu && (
            <div className="card col" style={{ alignSelf: 'flex-end', color: 'var(--ink)', padding: 6, minWidth: 200 }}>
              {!s.mine && <button className="btn btn-sm" style={{ background: 'none', color: 'var(--danger)', justifyContent: 'flex-start' }} onClick={report}><Icon name="flag" size={18} /> إبلاغ عن محتوى</button>}
              <button className="btn btn-sm" style={{ background: 'none', color: 'var(--ink)', justifyContent: 'flex-start' }} onClick={() => setMenu(false)}>إلغاء</button>
            </div>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 3, marginTop: 'auto', padding: '0 14px 28px' }} className="col gap-14">
          {s.caption && <p style={{ fontSize: 17, fontWeight: 600 }}>{s.caption}</p>}
          {s.merchant && (
            <div className="card col" style={{ color: 'var(--ink)', background: 'rgba(246,241,231,.97)' }}>
              <div className="row"><StoreLogo store={s.merchant} size={40} radius={10} /><div className="grow"><b className="ellipsis">{s.merchant.name}</b><div className="xs muted ellipsis">{s.items.map((x) => `${x.qty} × ${x.name}`).join('، ')}</div></div></div>
              {!s.mine && s.items.length > 0 && <button className="btn btn-orange" onClick={reorder}>اطلب نفس الطلب</button>}
            </div>
          )}
          <div className="row">
            <button onClick={like} aria-label="إعجاب" className="row gap-6" style={{ border: 0, background: 'none', color: '#fff', fontWeight: 700, padding: 0, minHeight: 44 }}>
              <Icon name="heart" size={28} fill={s.liked ? '#FF4D6A' : 'none'} color={s.liked ? '#FF4D6A' : '#fff'} /> {s.likes}
            </button>
            <span className="xs" style={{ opacity: .85 }}>ستوري من طلب حقيقي عبر Around</span>
          </div>
        </div>
      </div>
    </div>
  );
}
