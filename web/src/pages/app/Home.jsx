import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useLoad, usePosition, posQuery } from '../../lib/hooks';
import { useCart } from '../../lib/cart';
import { aed, dateShort } from '../../lib/format';
import Icon, { Logo } from '../../ui/Icon';
import { Avatar, StoreLogo, Loader, ErrorBox, useAction, catIcon } from '../../ui/kit';
import { StoreRow, StoryBubble, LoyaltyMini, StoreMeta } from './parts';

// Home banners: scroll-snap carousel, advances every 5s (paused while touched or when motion is reduced), counts one view per banner and a click on tap.
function BannerCarousel({ banners, api, nav }) {
  const box = useRef(null);
  const seen = useRef(new Set());
  const [i, setI] = useState(0);
  const idx = Math.min(i, Math.max(0, banners.length - 1));
  const go = (n) => { const el = box.current; if (el) el.scrollTo({ left: -n * el.clientWidth, behavior: 'smooth' }); };
  useEffect(() => {
    if (banners.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let held = false;
    const el = box.current;
    const hold = () => { held = true; }; const free = () => { held = false; };
    el.addEventListener('pointerdown', hold); el.addEventListener('pointerup', free); el.addEventListener('pointerleave', free);
    const t = setInterval(() => { if (!held) go((idx + 1) % banners.length); }, 5000);
    return () => { clearInterval(t); el.removeEventListener('pointerdown', hold); el.removeEventListener('pointerup', free); el.removeEventListener('pointerleave', free); };
  }, [idx, banners.length]);
  useEffect(() => {
    const b = banners[idx];
    if (b && !seen.current.has(b.id)) { seen.current.add(b.id); api.post(`/banners/${b.id}/view`).catch(() => {}); }
  }, [idx, banners]);
  if (!banners.length) return null;
  const onScroll = (e) => { const el = e.currentTarget; setI(Math.round(Math.abs(el.scrollLeft) / el.clientWidth)); };
  const tap = (b) => { api.post(`/banners/${b.id}/click`).catch(() => {}); if (b.merchant_id) nav(`/app/store/${b.merchant_id}`); };
  return (
    <div className="pad col gap-6">
      <div ref={box} onScroll={onScroll} style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', borderRadius: 24, gap: 0 }}>
        {banners.map((b) => (
          <button key={b.id} onClick={() => tap(b)} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', position: 'relative', border: 0, padding: 0, background: 'var(--accent-soft)', aspectRatio: '2 / 1', cursor: b.merchant_id ? 'pointer' : 'default' }}>
            <img src={b.image} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(12,29,22,.65), transparent 55%)' }} />
            <span style={{ position: 'absolute', insetInline: 16, bottom: 14, color: '#fff', textAlign: 'right' }}><b style={{ fontSize: 18, display: 'block' }}>{b.title}</b>{b.subtitle && <span className="small" style={{ opacity: .9 }}>{b.subtitle}</span>}</span>
          </button>
        ))}
      </div>
      {banners.length > 1 && <div className="row" style={{ justifyContent: 'center', gap: 6 }}>{banners.map((b, n) => <button key={b.id} aria-label={`بنر ${n + 1}`} onClick={() => go(n)} style={{ width: n === idx ? 18 : 6, height: 6, borderRadius: 3, border: 0, padding: 0, background: n === idx ? 'var(--deep)' : 'var(--line)', transition: 'width 200ms cubic-bezier(0.23,1,0.32,1), background 200ms' }} />)}</div>}
    </div>
  );
}

export default function Home() {
  const { api, me } = useSession();
  const pos = usePosition();
  const nav = useNavigate();
  const cart = useCart();
  const [run] = useAction();
  const { data, error, loading, reload, setData } = useLoad(() => api.get('/home?' + posQuery(pos)), [pos && pos.lat]);

  const onFav = (id, fav) => setData((d) => {
    const all = [...d.near];
    const s = all.find((x) => x.id === id); if (s) s.favorite = fav;
    return { ...d, near: all, favorites: all.filter((x) => x.favorite) };
  });
  const reorder = (q) => run(async () => {
    const r = await api.get(`/orders/${q.order_id}/reorder`);
    if (!r.lines.length) throw new Error('المنتجات غير متوفرة الحين');
    cart.load(q.store, q.store.branch.id, r.lines.map((l) => ({ item_id: l.item_id, name: l.name, price: l.price, qty: l.qty })));
    nav('/app/checkout');
  });

  return (
    <>
      <header className="topbar" style={{ paddingTop: 16 }}>
        <Link to="/app/explore?focus=1" className="input-group grow" style={{ minHeight: 46, color: 'var(--muted)' }}>
          <Icon name="search" size={20} /> <span className="ellipsis">ابحث عن محل أو منتج</span>
        </Link>
        <Link to="/app/explore?map=1" className="icon-btn plain" aria-label="الخريطة"><Icon name="map" color="var(--green)" /></Link>
        <Link to="/app/gifts" className="icon-btn plain" aria-label="الهدايا"><Icon name="gift" color="var(--green)" />{me.gifts_waiting > 0 && <span className="badge-dot">{me.gifts_waiting}</span>}</Link>
        <Link to="/app/notifications" className="icon-btn plain" aria-label="الإشعارات"><Icon name="bell" color="var(--green)" />{me.unread_notifications > 0 && <span className="badge-dot">{me.unread_notifications}</span>}</Link>
        <Link to="/app/more" aria-label="حسابي"><Avatar user={me} size={42} /></Link>
      </header>

      {loading && !data ? <Loader /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : (
        <div className="stack">
          <div className="hscroll" style={{ paddingTop: 2 }}>
            {data.categories.map((c) => (
              <Link key={c.key} to={`/app/explore?category=${c.key}`} className="chip"><Icon name={catIcon(c.key)} size={18} color="var(--green)" />{c.name}</Link>
            ))}
          </div>

          <BannerCarousel banners={data.banners || []} api={api} nav={nav} />

          {data.active_orders.length > 0 && (
            <div className="pad col gap-6">
              {data.active_orders.map((o) => (
                <Link key={o.id} to={`/app/orders/${o.id}`} className="card card-press row" style={{ background: 'var(--green)', color: 'var(--sand)' }}>
                  <Logo size={30} ink="#FFFFFF" />
                  <div className="grow"><div className="bold">طلب رقم {o.id} · {o.merchant_name}</div>
                    <div className="small" style={{ opacity: .9 }}>{o.status === 'ready' ? 'طلبك جاهز، اضغط «أنا في الطريق»' : o.status === 'preparing' ? 'قيد التحضير' : 'بانتظار قبول الفرع'}</div></div>
                  <Icon name="back" style={{ transform: 'scaleX(-1)' }} />
                </Link>
              ))}
            </div>
          )}

          <section>
            <div className="section-head"><h2 className="section-title"><Icon name="crown" color="var(--green)" /> Around Social</h2><Link to="/app/social">الكل</Link></div>
            <div className="hscroll">
              <StoryBubble to="/app/post" name="منشور جديد" plus avatarUser={me} image={me.avatar} />
              {data.stories.map((s) => (
                <StoryBubble key={s.user_id} to={`/app/stories/${s.user_id}`} image={s.cover} name={s.username || s.name} seen={!s.unseen} />
              ))}
            </div>
          </section>

          {data.quick.length > 0 && (
            <section>
              <div className="section-head"><h2 className="section-title"><Icon name="orders" color="var(--green)" /> اطلب بسرعة</h2><Link to="/app/orders">طلباتي</Link></div>
              <div className="hscroll">
                {data.quick.map((q) => q.store && (
                  <div key={q.order_id} className="card row" style={{ width: 320, flex: 'none', gap: 12, alignItems: 'stretch' }}>
                    <StoreLogo store={q.store} size={76} radius={14} />
                    <div className="grow col gap-4">
                      <div className="bold ellipsis">{q.store.name}</div>
                      <StoreMeta branch={q.store.branch} showDistance={false} />
                      <div className="small semi">{aed(q.total)} · {q.count} منتج · {dateShort(q.date)}</div>
                      <button className="btn btn-orange btn-sm" style={{ alignSelf: 'flex-start' }} disabled={!q.store.branch.open} onClick={() => reorder(q)}>اطلب نفس الطلب</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data.favorites.length > 0 && (
            <section>
              <div className="section-head"><h2 className="section-title"><Icon name="heart" color="var(--green)" /> المفضلة</h2></div>
              <div className="pad col">{data.favorites.map((s) => <StoreRow key={s.id} store={s} onFav={onFav} />)}</div>
            </section>
          )}

          {data.loyalty.length > 0 && (
            <section>
              <div className="section-head"><h2 className="section-title"><Icon name="star" color="var(--green)" /> بطاقات الولاء</h2><Link to="/app/loyalty">الكل</Link></div>
              <div className="hscroll">{data.loyalty.map((c) => <LoyaltyMini key={c.merchant.id} card={c} />)}</div>
            </section>
          )}

          {data.newest.length > 0 && (
            <section>
              <div className="section-head"><h2 className="section-title"><Icon name="bell" color="var(--green)" /> جديد في Around</h2></div>
              <div className="hscroll">
                {data.newest.map((s) => (
                  <Link key={s.id} to={`/app/store/${s.id}`} className="card card-press col" style={{ width: 170, flex: 'none', gap: 8 }}>
                    <StoreLogo store={s} size={60} />
                    <div className="bold ellipsis">{s.name}</div>
                    <span className={'xs ' + (s.branch.open ? 'open-txt' : 'closed-txt')}>{s.branch.hours_label}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="section-head"><h2 className="section-title"><Icon name="store" color="var(--green)" /> محلات قريبة منك</h2></div>
            <div className="pad col">{data.near.map((s) => <StoreRow key={s.id} store={s} onFav={onFav} />)}</div>
          </section>
        </div>
      )}
    </>
  );
}
