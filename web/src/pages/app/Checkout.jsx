import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useLoad } from '../../lib/hooks';
import { useCart } from '../../lib/cart';
import { aed } from '../../lib/format';
import Icon from '../../ui/Icon';
import { Loader, Empty, Sheet, StoreLogo, useAction } from '../../ui/kit';
import { StoreMeta } from './parts';
import { CarForm } from './More';

const METHODS = [['apple_pay', 'Apple Pay'], ['google_pay', 'Google Pay'], ['card', 'بطاقة']];

export default function Checkout() {
  const { api, me, refresh } = useSession();
  const cart = useCart();
  const nav = useNavigate();
  const [run, busy] = useAction();
  const store = useLoad(() => (cart.cart.merchant_id ? api.get(`/stores/${cart.cart.merchant_id}`) : Promise.resolve(null)), [cart.cart.merchant_id]);
  const cars = useLoad(() => api.get('/auth/cars'), []);
  const gifts = useLoad(() => api.get('/gifts/received'), []);
  const [carId, setCarId] = useState(null);
  const [method, setMethod] = useState('apple_pay');
  const [card, setCard] = useState({ number: '', exp: '', cvc: '' });
  const [useBalance, setUseBalance] = useState(true);
  const [redeem, setRedeem] = useState(false);
  const [note, setNote] = useState('');
  const [addCar, setAddCar] = useState(false);

  useEffect(() => { if (cars.data && !carId && cars.data[0]) setCarId(cars.data[0].id); }, [cars.data, carId]);

  if (!cart.cart.merchant_id) return (
    <div><Back /><Empty icon="orders" title="السلة فاضية" action={<Link className="btn btn-orange" to="/app">تصفح المحلات</Link>}>اختر محل وأضف طلبك.</Empty></div>
  );
  if (store.loading || !store.data || cars.loading) return <><Back /><Loader /></>;

  const s = store.data;
  const branch = s.branches.find((b) => b.id === cart.cart.branch_id) || s.branches[0];
  const itemGifts = (gifts.data || []).filter((g) => g.kind === 'item' && g.status === 'sent' && g.merchant.id === s.id);
  const gift = itemGifts.find((g) => g.id === cart.cart.gift_id) || null;
  const giftValue = gift ? gift.amount : 0;
  const subtotal = cart.subtotal + giftValue;
  let remaining = cart.subtotal;
  const loyalty = s.loyalty;
  const canRedeem = loyalty && loyalty.can_redeem && cart.subtotal > 0;
  const reward = redeem && canRedeem ? Math.min(loyalty.program.reward_value || Math.min(...cart.cart.lines.map((l) => l.price)), remaining) : 0;
  remaining -= reward;
  const balance = me.gift_balance || 0;
  const fromBalance = useBalance ? Math.min(balance, remaining) : 0;
  remaining -= fromBalance;
  const total = remaining;

  const place = () => run(async () => {
    if (!carId) throw new Error('أضف سيارتك عشان الفرع يعرفك');
    const o = await api.post('/orders', {
      branch_id: branch.id, car_id: carId, items: cart.cart.lines.map((l) => ({ item_id: l.item_id, qty: l.qty })),
      gift_id: gift ? gift.id : undefined, use_gift_balance: fromBalance > 0, redeem_reward: reward > 0,
      payment_method: method, card: method === 'card' ? { number: card.number } : undefined, note, source_post_id: cart.cart.source_post_id || undefined
    });
    cart.clear();
    refresh();
    nav(`/app/orders/${o.id}`, { replace: true });
  });

  return (
    <div style={{ paddingBottom: 120 }}>
      <Back title="تأكيد الطلب" />
      <div className="pad col gap-18">
        <div className="card col">
          <div className="row"><StoreLogo store={s} size={44} radius={12} /><div className="grow"><b>{s.name}</b><div className="small muted">فرع {branch.name}</div></div></div>
          <StoreMeta branch={branch} />
          <hr className="divider" />
          {cart.cart.lines.map((l) => (
            <div key={l.item_id} className="row-between">
              <div className="grow"><div className="semi">{l.name}</div><div className="small muted">{aed(l.price)}</div></div>
              <div className="qty">
                <button onClick={() => cart.setQty(l.item_id, l.qty - 1)} aria-label="إنقاص"><Icon name="minus" size={18} /></button>
                <span>{l.qty}</span>
                <button className="fill" onClick={() => cart.setQty(l.item_id, l.qty + 1)} aria-label="زيادة"><Icon name="plus" size={18} /></button>
              </div>
            </div>
          ))}
          {gift && (
            <div className="row-between" style={{ background: 'var(--orange-soft)', padding: '10px 12px', borderRadius: 12 }}>
              <div className="row"><Icon name="gift" color="var(--orange-ink)" /><div><div className="semi">{gift.item.name}</div><div className="xs orange-ink">هدية من {gift.sender.name}</div></div></div>
              <button className="btn btn-sm btn-light" onClick={cart.clearGift}>إزالة</button>
            </div>
          )}
          <Link to={`/app/store/${s.id}`} className="semi green small">+ أضف منتجات</Link>
        </div>

        {!gift && itemGifts.length > 0 && (
          <button className="card row" style={{ border: '2px dashed var(--orange)', textAlign: 'right' }} onClick={() => cart.useGift(s, branch.id, itemGifts[0].id)}>
            <Icon name="gift" color="var(--orange-ink)" /><span className="grow semi">عندك هدية هنا: {itemGifts[0].item.name}. أضفها للطلب</span>
          </button>
        )}

        <section className="col">
          <div className="row-between"><h2 className="bold" style={{ fontSize: 17 }}>سيارتك</h2><button className="semi green" style={{ border: 0, background: 'none' }} onClick={() => setAddCar(true)}>+ إضافة سيارة</button></div>
          {(cars.data || []).length === 0 && <button className="card row" style={{ border: '2px dashed var(--line)' }} onClick={() => setAddCar(true)}><Icon name="car" color="var(--green)" /> <span className="semi">أضف سيارتك عشان الموظف يعرفك</span></button>}
          {(cars.data || []).map((c) => (
            <button key={c.id} onClick={() => setCarId(c.id)} className="card row" style={{ border: carId === c.id ? '2px solid var(--green)' : '1px solid var(--line)', textAlign: 'right' }}>
              <Icon name="car" color="var(--green)" size={26} />
              <div className="grow"><div className="semi">{c.label}</div><div className="small muted">{c.plate}</div></div>
              <span style={{ width: 22, height: 22, borderRadius: 11, border: carId === c.id ? '7px solid var(--green)' : '2px solid #C9C2B3' }} />
            </button>
          ))}
        </section>

        {(canRedeem || balance > 0) && (
          <section className="card col">
            {canRedeem && (
              <div className="row-between">
                <div><div className="semi">استخدم مكافأة الولاء</div><div className="small muted">{loyalty.program.reward_text}</div></div>
                <button className={'switch' + (redeem ? ' on' : '')} onClick={() => setRedeem(!redeem)} aria-pressed={redeem} aria-label="استخدم المكافأة" />
              </div>
            )}
            {canRedeem && balance > 0 && <hr className="divider" />}
            {balance > 0 && (
              <div className="row-between">
                <div><div className="semi">رصيد الهدايا</div><div className="small muted">متوفر {aed(balance)}</div></div>
                <button className={'switch' + (useBalance ? ' on' : '')} onClick={() => setUseBalance(!useBalance)} aria-pressed={useBalance} aria-label="استخدم رصيد الهدايا" />
              </div>
            )}
          </section>
        )}

        {total > 0 && (
          <section className="col">
            <h2 className="bold" style={{ fontSize: 17 }}>طريقة الدفع</h2>
            <div className="seg">{METHODS.map(([k, l]) => <button key={k} className={method === k ? 'on' : ''} onClick={() => setMethod(k)}>{l}</button>)}</div>
            {method === 'card' && (
              <div className="card col">
                <label className="field"><span>رقم البطاقة</span><input className="input ltr" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} /></label>
                <div className="row">
                  <label className="field grow"><span>الانتهاء</span><input className="input ltr" placeholder="MM/YY" autoComplete="cc-exp" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} /></label>
                  <label className="field grow"><span>CVC</span><input className="input ltr" inputMode="numeric" autoComplete="cc-csc" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} /></label>
                </div>
              </div>
            )}
            <p className="xs muted">الدفع في وضع تجريبي: ما فيه خصم حقيقي لين نربط بوابة الدفع.</p>
          </section>
        )}

        <label className="field"><span>ملاحظة للفرع (اختياري)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="مثلاً: بدون سكر" /></label>

        <section className="card col gap-6">
          <Line label="المجموع" value={aed(subtotal)} />
          {giftValue > 0 && <Line label="هدية" value={'− ' + aed(giftValue)} green />}
          {reward > 0 && <Line label="مكافأة الولاء" value={'− ' + aed(reward)} green />}
          {fromBalance > 0 && <Line label="من رصيد الهدايا" value={'− ' + aed(fromBalance)} green />}
          <hr className="divider" />
          <Line label="تدفع الحين" value={aed(total)} bold />
          <p className="xs muted">شامل ضريبة القيمة المضافة · بدون رسوم توصيل</p>
        </section>
      </div>

      <div className="floating-bar">
        <button className="btn btn-orange btn-lg btn-block" disabled={busy || !branch.open || (!cart.cart.lines.length && !gift)} onClick={place}>
          {!branch.open ? 'الفرع مغلق الحين' : busy ? 'جاري الدفع…' : total > 0 ? `ادفع ${aed(total)}` : 'أكّد الطلب'}
        </button>
      </div>

      <Sheet open={addCar} onClose={() => setAddCar(false)} label="إضافة سيارة">
        <CarForm onSaved={(c) => { cars.setData((x) => [...(x || []), c]); setCarId(c.id); setAddCar(false); }} />
      </Sheet>
    </div>
  );
}

function Line({ label, value, bold, green }) {
  return <div className="row-between" style={{ fontWeight: bold ? 700 : 500, fontSize: bold ? 17 : 15 }}><span>{label}</span><span className={green ? 'green' : ''}>{value}</span></div>;
}

export function Back({ title, children }) {
  const nav = useNavigate();
  return (
    <div className="back-row">
      <button className="icon-btn" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/app'))} aria-label="رجوع"><Icon name="back" /></button>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
