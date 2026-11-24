import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useLoad, useSocketEvent } from '../../lib/hooks';
import { aed, km, mapsLink, timeShort } from '../../lib/format';
import Icon, { Logo } from '../../ui/Icon';
import { Loader, ErrorBox, StoreLogo, Stars, useAction, useToast } from '../../ui/kit';
import { Back } from './Checkout';

const STEP = { new: 0, preparing: 1, ready: 2, delivered: 3 };
const LIVE = ['new', 'preparing', 'ready'];

export default function OrderPage() {
  const { id } = useParams();
  const { api, socket } = useSession();
  const toast = useToast();
  const [run, busy] = useAction();
  const { data: o, error, loading, reload, setData } = useLoad(() => api.get(`/orders/${id}`), [id]);
  const [geoState, setGeoState] = useState('idle'); // idle | tracking | denied | unsupported
  const [rating, setRating] = useState(0);
  const last = useRef(0);

  useSocketEvent(socket, 'order:update', (u) => { if (String(u.id) === String(id)) setData(u); });

  const live = o && LIVE.includes(o.status);
  const tracking = live && o.on_the_way_at && !o.arrived_at;

  // Share location while on the way; the server geofences arrival automatically.
  useEffect(() => {
    if (!tracking) return undefined;
    if (!navigator.geolocation) { setGeoState('unsupported'); return undefined; }
    setGeoState('tracking');
    const w = navigator.geolocation.watchPosition(
      (p) => {
        const now = Date.now();
        if (now - last.current < 8000) return;
        last.current = now;
        api.post(`/orders/${id}/location`, { lat: p.coords.latitude, lng: p.coords.longitude }).then(setData).catch(() => {});
      },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(w);
  }, [tracking, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !o) return <><Back title={`طلب رقم ${id}`} /><Loader /></>;
  if (error && !o) return <><Back title={`طلب رقم ${id}`} /><ErrorBox error={error} onRetry={reload} /></>;

  const step = STEP[o.status] ?? -1;
  const onTheWay = () => run(async () => setData(await api.post(`/orders/${o.id}/on-the-way`)));
  const arrived = () => run(async () => setData(await api.post(`/orders/${o.id}/arrived`)));
  const cancel = () => { if (confirm('تلغي الطلب؟ بنرجع لك المبلغ كامل.')) run(async () => setData(await api.post(`/orders/${o.id}/cancel`)), 'تم إلغاء الطلب'); };
  const rate = (n) => { setRating(n); run(async () => { await api.post(`/orders/${o.id}/rate`, { rating: n }); setData({ ...o, rating: n }); toast('شكراً على تقييمك', 'success'); }); };

  let headline, sub;
  if (o.status === 'new') { headline = 'بانتظار قبول الفرع'; sub = 'الفرع بيأكد طلبك خلال دقيقتين.'; }
  else if (o.status === 'preparing') { headline = o.arrived_at ? 'وصلت، طلبك يتجهز' : tracking ? `تصل بعد ${o.eta_minutes ?? '…'} دقيقة` : 'الفرع يحضّر طلبك'; sub = tracking ? 'نبّهنا الفرع إنك جاي.' : 'اضغط «أنا في الطريق» لما تتحرك، ونبلّغ الفرع قبل وصولك.'; }
  else if (o.status === 'ready') { headline = o.arrived_at ? 'وصلت! الموظف جاي لسيارتك' : 'طلبك جاهز'; sub = o.arrived_at ? 'خلك في السيارة، الطلب بيوصلك.' : 'تعال واستلمه من سيارتك.'; }
  else if (o.status === 'delivered') { headline = 'بالعافية!'; sub = `استلمت طلبك ${o.delivered_at ? 'الساعة ' + timeShort(o.delivered_at) : ''}`; }
  else if (o.status === 'rejected') { headline = 'اعتذر الفرع عن الطلب'; sub = `رجّعنا لك ${aed(o.total + o.gift_used)} بالكامل.`; }
  else { headline = 'الطلب ملغي'; sub = o.total + o.gift_used > 0 ? `رجّعنا لك ${aed(o.total + o.gift_used)}.` : ''; }

  return (
    <div style={{ paddingBottom: 130 }}>
      <Back title={`طلب رقم ${o.id}`} />
      <div className="pad col gap-18">
        <div className={'card col gap-14' + (o.arrived_at && live ? ' on-dark' : '')}>
          <div className="row-between">
            <div><h2 style={{ fontSize: 24, fontWeight: 700 }}>{headline}</h2>{sub && <p className="small" style={{ opacity: .85, marginTop: 4 }}>{sub}</p>}</div>
            {live && <Logo size={40} ink={o.arrived_at ? '#FFFFFF' : '#0C1D16'} />}
          </div>
          {step >= 0 && (
            <div className="steps">
              {['تم الدفع', 'قيد التحضير', 'جاهز', 'تم التسليم'].map((l, i) => <div key={l} className={i <= step ? 'done' : i === step + 1 ? 'now' : ''}>{l}</div>)}
            </div>
          )}
          {live && (o.on_the_way_at || o.arrived_at) && (
            <div className="row wrap gap-6">
              {tracking && o.distance_m != null && <span className="pill orange">{km(o.distance_m)} عن الفرع</span>}
              <span className={'pill ' + (o.arrived_at ? 'orange' : 'green')}>{o.queue_ahead === 0 ? 'ما قدامك أحد' : `قدامك ${o.queue_ahead} ${o.queue_ahead === 1 ? 'سيارة' : 'سيارات'}`}</span>
            </div>
          )}
          {geoState === 'denied' && tracking && o.distance_m == null && <p className="xs danger">ما قدرنا نوصل لموقعك. لما توصل اضغط «وصلت».</p>}
        </div>

        <div className="card col">
          <div className="row">
            <StoreLogo store={o.merchant} size={48} radius={12} />
            <div className="grow"><b>{o.merchant.name}</b><div className="small muted">فرع {o.branch.name} · {o.branch.city}</div></div>
            <a className="btn btn-light btn-sm" href={mapsLink(o.branch.lat, o.branch.lng)} target="_blank" rel="noreferrer"><Icon name="route" size={18} /> الاتجاهات</a>
          </div>
          <hr className="divider" />
          <div className="row wrap"><Icon name="car" color="var(--green)" size={26} /><div style={{ flex: '1 1 150px', minWidth: 0 }}><div className="semi">{o.car_label}</div></div><span className="plate">{o.plate_label}</span></div>
        </div>

        {o.status === 'delivered' && (
          <div className="card col center gap-14">
            <p className="bold">كيف كانت وقفتك؟</p>
            <Stars value={o.rating || rating} onChange={o.rating ? undefined : rate} />
            <Link to={`/app/post?order=${o.id}`} className="btn btn-orange btn-block"><Icon name="camera" /> صوّر طلبك وشاركه</Link>
          </div>
        )}

        <div className="card col gap-6">
          {o.items.map((i, k) => (
            <div key={k} className="row-between"><span>{i.qty} × {i.name}{i.is_gift ? ' (هدية)' : ''}</span><span>{aed(i.unit_price * i.qty)}</span></div>
          ))}
          <hr className="divider" />
          {o.gift_item_value > 0 && <div className="row-between green small"><span>هدية</span><span>− {aed(o.gift_item_value)}</span></div>}
          {o.reward_discount > 0 && <div className="row-between green small"><span>مكافأة الولاء</span><span>− {aed(o.reward_discount)}</span></div>}
          {o.gift_used > 0 && <div className="row-between green small"><span>رصيد الهدايا</span><span>− {aed(o.gift_used)}</span></div>}
          <div className="row-between bold"><span>المدفوع</span><span>{aed(o.total)}</span></div>
          {o.note && <p className="small muted">ملاحظة: {o.note}</p>}
        </div>
        {o.can_cancel && <button className="btn btn-danger btn-block" disabled={busy} onClick={cancel}>إلغاء الطلب</button>}
      </div>

      {live && !o.arrived_at && (
        <div className="floating-bar col gap-6">
          {!o.on_the_way_at
            ? <button className="btn btn-orange btn-lg btn-block" disabled={busy} onClick={onTheWay}>أنا في الطريق</button>
            : <button className="btn btn-lg btn-block" disabled={busy} onClick={arrived}>وصلت</button>}
        </div>
      )}
    </div>
  );
}
