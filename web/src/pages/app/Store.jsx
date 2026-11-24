import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useLoad, usePosition, posQuery } from '../../lib/hooks';
import { useCart } from '../../lib/cart';
import { aed, km, unitOf, dateShort, mapsLink } from '../../lib/format';
import Icon from '../../ui/Icon';
import { StoreLogo, ItemThumb, Sheet, Loader, ErrorBox, Empty, useAction, useToast } from '../../ui/kit';
import { StoreMeta } from './parts';

export default function Store() {
  const { id } = useParams();
  const { api } = useSession();
  const pos = usePosition();
  const nav = useNavigate();
  const cart = useCart();
  const toast = useToast();
  const [run] = useAction();
  const { data: s, error, loading, reload, setData } = useLoad(() => api.get(`/stores/${id}?` + posQuery(pos)), [id, pos && pos.lat]);
  const myOrders = useLoad(() => api.get('/orders'), []);
  const [tab, setTab] = useState('menu');
  const [q, setQ] = useState('');
  const [item, setItem] = useState(null);
  const [qty, setQty] = useState(1);
  const [branchId, setBranchId] = useState(null);
  const [conflict, setConflict] = useState(null);

  const branch = useMemo(() => s && (s.branches.find((b) => b.id === (branchId || (cart.cart.merchant_id === s.id && cart.cart.branch_id))) || s.branches[0]), [s, branchId, cart.cart]);
  const inCart = s && cart.cart.merchant_id === s.id;
  const filtered = useMemo(() => {
    if (!s) return [];
    const needle = q.trim();
    return s.menu.map((c) => ({ ...c, items: c.items.filter((i) => !needle || i.name.includes(needle) || i.description.includes(needle)) })).filter((c) => c.items.length);
  }, [s, q]);

  if (loading && !s) return <Loader />;
  if (error && !s) return <ErrorBox error={error} onRetry={reload} />;

  const doAdd = (it, n) => { cart.add(s, branch.id, it, n); toast(`أضفنا ${it.name}`, 'success'); setItem(null); };
  const tryAdd = (it, n = 1) => {
    if (!it.is_available) return;
    if (!cart.canAdd(s.id)) { setConflict({ it, n }); return; }
    doAdd(it, n);
  };
  const toggleFav = () => run(async () => { const r = await api.post(`/stores/${s.id}/favorite`); setData({ ...s, favorite: r.favorite }); });
  const share = () => {
    const url = location.origin + `/app/store/${s.id}`;
    if (navigator.share) navigator.share({ title: s.name, url }).catch(() => {}); else { navigator.clipboard?.writeText(url); toast('نسخنا الرابط'); }
  };
  const storeOrders = (myOrders.data || []).filter((o) => o.merchant.id === s.id);

  return (
    <div style={{ paddingBottom: inCart ? 110 : 30 }}>
      <div style={{ position: 'relative', height: 190, background: s.cover ? `center/cover url(${s.cover})` : s.color }}>
        <div className="row" style={{ position: 'absolute', top: 14, insetInline: 16, gap: 10 }}>
          <button className="icon-btn" onClick={() => nav(-1)} aria-label="رجوع"><Icon name="back" /></button>
          <label className="input-group grow" style={{ minHeight: 44, background: 'rgba(255,255,255,.95)' }}>
            <Icon name="search" size={20} color="var(--muted)" />
            <input placeholder="ابحث في المنيو" value={q} onChange={(e) => { setQ(e.target.value); setTab('menu'); }} aria-label="ابحث في المنيو" />
          </label>
        </div>
        {!s.cover && <div style={{ position: 'absolute', bottom: -34, insetInlineStart: 20, borderRadius: 24, border: '4px solid var(--sand)', background: 'var(--sand)' }}><StoreLogo store={s} size={80} radius={20} /></div>}
        {s.stories.length > 0 && (
          <Link to={`/app/stories/${s.stories[0].user.id}?store=${s.id}`} aria-label="ستوريات المحل" style={{ position: 'absolute', bottom: 14, insetInlineEnd: 16 }} className="ring">
            <img src={s.stories[0].image} alt="" style={{ width: 62, height: 62, borderRadius: '50%', objectFit: 'cover' }} />
          </Link>
        )}
      </div>

      <div className="pad col" style={{ paddingTop: s.cover ? 16 : 40, gap: 8 }}>
        <div className="row-between">
          <h1 style={{ fontSize: 'clamp(21px, 6.4vw, 26px)', fontWeight: 600, overflowWrap: 'anywhere' }}>{s.name}</h1>
          <div className="row gap-4">
            <button className="icon-btn plain" onClick={toggleFav} aria-label="المفضلة" style={{ color: s.favorite ? '#D93A5B' : 'var(--ink)' }}><Icon name="heart" size={26} fill={s.favorite ? '#D93A5B' : 'none'} /></button>
            <button className="icon-btn plain" onClick={share} aria-label="مشاركة"><Icon name="share" size={24} /></button>
          </div>
        </div>
        <StoreMeta branch={branch} />
        {s.tags.length > 0 && <div className="row gap-6 wrap">{s.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
        {s.branches.length > 1 && (
          <div className="hscroll" style={{ padding: '4px 0' }}>
            {s.branches.map((b) => (
              <button key={b.id} className={'chip' + (b.id === branch.id ? ' on' : '')} onClick={() => { setBranchId(b.id); if (inCart) cart.setBranch(b.id); }}>
                فرع {b.name}{b.distance_m != null ? ` · ${km(b.distance_m)}` : ''}
              </button>
            ))}
          </div>
        )}
        {s.loyalty && (
          <div className="card row" style={{ gap: 12, marginTop: 4 }}>
            <span className="thumb" style={{ width: 44, height: 44, background: 'var(--orange-soft)', color: 'var(--orange-ink)' }}><Icon name="star" /></span>
            <div className="grow">
              <div className="bold small">{s.loyalty.program.reward_text}</div>
              <div className="xs muted">{s.loyalty.program.type === 'stamps' ? `كل منتج = ختم · ${s.loyalty.program.goal} أختام للمكافأة` : `كل درهم = نقطة · ${s.loyalty.program.goal} نقطة للمكافأة`}
                {s.loyalty.expires_at ? ` · تنتهي ${dateShort(s.loyalty.expires_at)}` : ''}</div>
            </div>
            {s.loyalty.can_redeem ? <span className="pill green">جاهزة</span> : <b className="green">{s.loyalty.balance}/{s.loyalty.program.goal}</b>}
          </div>
        )}
      </div>

      <div className="seg" style={{ margin: '16px 20px 6px', gridAutoColumns: '1fr' }} role="tablist">
        {[['menu', 'المنيو'], ['cart', `السلة${inCart && cart.count ? ` (${cart.count})` : ''}`], ['orders', 'طلباتي'], ['info', 'معلومات']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'menu' && (
        <div className="pad">
          {!q && s.top_items.length > 0 && (
            <section className="mt-14">
              <h2 className="bold" style={{ fontSize: 17, marginBottom: 4 }}>الأكثر طلباً</h2>
              {s.top_items.map((it) => <ItemRow key={'t' + it.id} it={it} category={s.category} onOpen={() => { setItem(it); setQty(1); }} onAdd={() => tryAdd(it)} />)}
            </section>
          )}
          {filtered.map((c) => (
            <section key={c.id} className="mt-14">
              <h2 className="bold" style={{ fontSize: 17, marginBottom: 4 }}>{c.name}</h2>
              {c.items.map((it) => <ItemRow key={it.id} it={it} category={s.category} onOpen={() => { setItem(it); setQty(1); }} onAdd={() => tryAdd(it)} />)}
            </section>
          ))}
          {!filtered.length && <Empty icon="search" title="ما لقينا شي بهذا الاسم" />}
        </div>
      )}

      {tab === 'cart' && (
        <div className="pad mt-14">
          {inCart && cart.cart.lines.length ? (
            <div className="card col">
              {cart.cart.lines.map((l) => (
                <div key={l.item_id} className="row-between">
                  <div><div className="semi">{l.name}</div><div className="small muted">{aed(l.price)}</div></div>
                  <div className="qty">
                    <button onClick={() => cart.setQty(l.item_id, l.qty - 1)} aria-label="إنقاص"><Icon name="minus" size={18} /></button>
                    <span>{l.qty}</span>
                    <button className="fill" onClick={() => cart.setQty(l.item_id, l.qty + 1)} aria-label="زيادة"><Icon name="plus" size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty icon="orders" title="السلة فاضية">أضف من المنيو وبنجهز طلبك لين توصل.</Empty>}
        </div>
      )}

      {tab === 'orders' && (
        <div className="pad mt-14 col">
          {storeOrders.length ? storeOrders.map((o) => (
            <Link key={o.id} to={`/app/orders/${o.id}`} className="card card-press row-between">
              <div><div className="bold">#{o.id} · {aed(o.subtotal)}</div><div className="small muted">{o.items.map((i) => `${i.qty} × ${i.name}`).join('، ')}</div></div>
              <span className={'pill ' + (o.status === 'delivered' ? 'green' : ['rejected', 'cancelled'].includes(o.status) ? 'gray' : 'orange')}>{o.status_label}</span>
            </Link>
          )) : <Empty icon="orders" title="ما طلبت من هذا المحل قبل" />}
        </div>
      )}

      {tab === 'info' && (
        <div className="pad mt-14 col">
          {s.branches.map((b) => (
            <div key={b.id} className="card col gap-6">
              <div className="row-between"><b>فرع {b.name}</b><span className="small muted">{b.city}</span></div>
              <StoreMeta branch={b} />
              <a className="btn btn-light btn-sm" style={{ alignSelf: 'flex-start' }} href={mapsLink(b.lat, b.lng)} target="_blank" rel="noreferrer"><Icon name="route" size={18} /> الاتجاهات</a>
            </div>
          ))}
        </div>
      )}

      {inCart && cart.count > 0 && (
        <div className="floating-bar">
          <Link to="/app/checkout" className="btn btn-orange btn-lg btn-block" style={{ justifyContent: 'space-between' }}>
            <span>عرض السلة · {cart.count} {cart.count === 1 ? 'منتج' : 'منتجات'}</span><span>{aed(cart.subtotal)}</span>
          </Link>
        </div>
      )}

      <Sheet open={!!item} onClose={() => setItem(null)} label={item?.name}>
        {item && (
          <div className="col gap-14">
            {item.image && <img src={item.image} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 18 }} />}
            <div><h2 style={{ fontSize: 22 }}>{item.name}</h2>{item.description && <p className="muted mt-8">{item.description}</p>}</div>
            <div className="row-between">
              <b style={{ fontSize: 20 }} className="green">{aed(item.price)}</b>
              <div className="qty">
                <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="إنقاص"><Icon name="minus" size={18} /></button>
                <span>{qty}</span>
                <button className="fill" onClick={() => setQty(Math.min(50, qty + 1))} aria-label="زيادة"><Icon name="plus" size={18} /></button>
              </div>
            </div>
            <button className="btn btn-orange btn-lg btn-block" disabled={!item.is_available || !branch.open} onClick={() => tryAdd(item, qty)}>
              {!item.is_available ? 'غير متوفر الحين' : !branch.open ? 'الفرع مغلق' : `أضف للسلة · ${aed(item.price * qty)}`}
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!conflict} onClose={() => setConflict(null)} label="سلة جديدة">
        <div className="col gap-14">
          <h2 style={{ fontSize: 20 }}>تبدأ سلة جديدة؟</h2>
          <p className="muted">سلتك فيها طلب من {cart.cart.merchant_name}. تقدر تطلب من محل واحد بكل طلب.</p>
          <button className="btn btn-orange btn-block" onClick={() => { cart.clear(); setTimeout(() => doAdd(conflict.it, conflict.n), 0); setConflict(null); }}>امسح السلة وأضف</button>
          <button className="btn btn-light btn-block" onClick={() => setConflict(null)}>إلغاء</button>
        </div>
      </Sheet>
    </div>
  );
}

function ItemRow({ it, onOpen, onAdd, category }) {
  return (
    <div className="item-row" style={{ opacity: it.is_available ? 1 : 0.5 }}>
      <button onClick={onOpen} className="grow col gap-4" style={{ border: 0, background: 'none', padding: 0, textAlign: 'right' }}>
        <span className="bold" style={{ fontSize: 16 }}>{it.name}</span>
        {it.description && <span className="small muted">{it.description}</span>}
        <span className="semi green mt-8">{it.is_available ? aed(it.price) : 'غير متوفر'}</span>
      </button>
      <div style={{ position: 'relative' }}>
        <ItemThumb item={it} size={92} category={category} />
        {it.is_available ? <button className="add-btn" onClick={onAdd} aria-label={`أضف ${it.name}`} style={{ position: 'absolute', bottom: -8, insetInlineStart: -8, boxShadow: '0 2px 8px rgba(0,0,0,.15)' }}><Icon name="plus" size={20} /></button> : null}
      </div>
    </div>
  );
}
