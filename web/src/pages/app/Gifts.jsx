import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useLoad } from '../../lib/hooks';
import { useCart } from '../../lib/cart';
import { aed, ago, dateShort } from '../../lib/format';
import Icon, { Logo } from '../../ui/Icon';
import { Loader, Empty, StoreLogo, useAction } from '../../ui/kit';
import { Back } from './Checkout';

const DESIGNS = { green: 'gc-green', orange: 'gc-orange', sand: 'gc-sand' };

function GiftCard({ g, compact }) {
  return (
    <div className={'gift-card ' + DESIGNS[g.design || 'green']} style={compact ? { minHeight: 150 } : undefined}>
      <div className="row-between">
        <span className="semi small">هدية من {g.sender?.name || 'Around'}</span>
        <Logo size={30} ink={g.design === 'green' ? '#FFFFFF' : '#0B1410'} />
      </div>
      <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{g.kind === 'item' ? `${g.item?.name} عليّ` : aed(g.amount)}</span>
      {g.message ? <span className="small" style={{ opacity: .95 }}>«{g.message}»</span> : <span />}
    </div>
  );
}

export function Gifts() {
  const { api, me } = useSession();
  const nav = useNavigate();
  const cart = useCart();
  const [run] = useAction();
  const [tab, setTab] = useState('received');
  const received = useLoad(() => api.get('/gifts/received'), []);
  const sent = useLoad(() => api.get('/gifts/sent'), []);
  const list = tab === 'received' ? received : sent;

  const use = (g) => run(async () => {
    const s = await api.get(`/stores/${g.merchant.id}`);
    cart.useGift(s, s.branch.id, g.id);
    nav('/app/checkout');
  });

  return (
    <>
      <Back title="الهدايا" />
      <div className="pad col gap-18">
        <div className="card row" style={{ background: 'var(--orange-soft)' }}>
          <Icon name="wallet" color="var(--orange-ink)" size={28} />
          <div className="grow"><div className="small orange-ink semi">رصيد الهدايا</div><b style={{ fontSize: 22 }}>{aed(me.gift_balance)}</b></div>
          <span className="xs orange-ink">ينخصم تلقائياً عند الدفع</span>
        </div>
        <Link to="/app/gifts/send" className="card card-press col center" style={{ background: 'var(--green)', color: 'var(--sand)', alignItems: 'center', gap: 8, padding: 24 }}>
          <Icon name="gift" size={40} />
          <b style={{ fontSize: 20 }}>أرسل هدية</b>
          <span className="small" style={{ opacity: .9 }}>مبلغ، أو مشروب وأكل من محله المفضل، لأي رقم هاتف أو حساب</span>
        </Link>
        <div className="seg">
          <button className={tab === 'received' ? 'on' : ''} onClick={() => setTab('received')}>وصلتني</button>
          <button className={tab === 'sent' ? 'on' : ''} onClick={() => setTab('sent')}>أرسلتها</button>
        </div>
        {list.loading && !list.data ? <Loader /> : !(list.data || []).length ? <Empty icon="gift" title={tab === 'received' ? 'ما وصلتك هدايا للحين' : 'ما أرسلت هدايا للحين'} /> : (
          <div className="col gap-14">
            {list.data.map((g) => (
              <div key={g.id} className="col gap-6">
                <Link to={`/app/gifts/${g.id}`}><GiftCard g={g} compact /></Link>
                <div className="row-between small">
                  <span className="muted">{tab === 'sent' ? `إلى ${g.recipient?.name || g.recipient_phone}` : ago(g.created_at)}{g.kind === 'item' ? ` · ${g.merchant.name}` : ''}</span>
                  {tab === 'received' && g.kind === 'item' && (g.status === 'sent'
                    ? <button className="btn btn-orange btn-sm" onClick={() => use(g)}>استخدم الهدية</button>
                    : <span className="pill gray">مستخدمة</span>)}
                  {tab === 'received' && g.kind === 'amount' && <span className="pill green">انضافت لرصيدك</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function GiftView() {
  const { id } = useParams();
  const { api } = useSession();
  const { data: g, loading } = useLoad(() => api.get(`/gifts/${id}`), [id]);
  if (loading || !g) return <><Back title="هدية" /><Loader /></>;
  return (
    <>
      <Back title="هدية" />
      <div className="pad col gap-14">
        <GiftCard g={g} />
        <div className="card col gap-6 small">
          <div className="row-between"><span className="muted">من</span><b>{g.sender.name}</b></div>
          <div className="row-between"><span className="muted">إلى</span><b>{g.recipient?.name || <span className="ltr">{g.recipient_phone}</span>}</b></div>
          {g.kind === 'item' && <div className="row-between"><span className="muted">المحل</span><b>{g.merchant.name}</b></div>}
          <div className="row-between"><span className="muted">صالحة حتى</span><b>{g.expires_at ? dateShort(g.expires_at) : '—'}</b></div>
        </div>
        <Link to="/app/gifts" className="btn btn-light btn-block">كل الهدايا</Link>
      </div>
    </>
  );
}

export function SendGift() {
  const { api } = useSession();
  const nav = useNavigate();
  const [run, busy] = useAction();
  const [kind, setKind] = useState('item');
  const [amount, setAmount] = useState(50);
  const [design, setDesign] = useState('green');
  const [by, setBy] = useState('phone');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');
  const [storeId, setStoreId] = useState(null);
  const [itemId, setItemId] = useState(null);
  const [method, setMethod] = useState('apple_pay');
  const [done, setDone] = useState(null);
  const stores = useLoad(() => api.get('/stores'), []);
  const sid = storeId || (stores.data && stores.data[0] && stores.data[0].id);
  const store = useLoad(() => (sid ? api.get(`/stores/${sid}`) : Promise.resolve(null)), [sid]);
  const items = useMemo(() => (store.data ? store.data.menu.flatMap((c) => c.items).filter((i) => i.is_available) : []), [store.data]);
  const item = items.find((i) => i.id === itemId) || items[0];
  const price = kind === 'item' ? (item ? item.price : 0) : amount * 100;

  const send = (e) => {
    e.preventDefault();
    run(async () => {
      const g = await api.post('/gifts', {
        kind, amount, item_id: item?.id, message: msg, design, payment_method: method,
        recipient_phone: by === 'phone' ? to : undefined, recipient_username: by === 'user' ? to : undefined
      });
      setDone(g);
    });
  };

  if (done) return (
    <div className="pad col center" style={{ minHeight: '90dvh', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ width: 88, height: 88, borderRadius: 44, background: 'var(--green)', color: 'var(--sand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={42} /></div>
      <h2 style={{ fontSize: 24 }}>وصلت هديتك</h2>
      <p className="muted" style={{ maxWidth: 320 }}>
        {done.kind === 'item' ? `أهديته ${done.item.name} من ${done.merchant.name}. يطلبه متى ما بغى ويستلمه من سيارته.` : `أرسلت له ${aed(done.amount)} يستخدمها في أي محل على Around.`}
        {done.delivered_to === 'sms' ? ' ما عنده Around للحين، فأرسلنا له رابط برسالة نصية.' : ''}
      </p>
      <button className="btn btn-block" onClick={() => nav('/app/gifts', { replace: true })}>تم</button>
    </div>
  );

  return (
    <form onSubmit={send} style={{ paddingBottom: 110 }}>
      <Back title="أرسل هدية" />
      <div className="pad col gap-14">
        <div className="seg">
          <button type="button" className={kind === 'item' ? 'on' : ''} onClick={() => setKind('item')}>مشروب أو أكل</button>
          <button type="button" className={kind === 'amount' ? 'on' : ''} onClick={() => setKind('amount')}>مبلغ</button>
        </div>

        <div className={'gift-card ' + DESIGNS[design]}>
          <div className="row-between">
            <span className="semi small">هدية من Around</span>
            <div className="row gap-6">
              {Object.keys(DESIGNS).map((d) => (
                <button key={d} type="button" onClick={() => setDesign(d)} aria-label="لون البطاقة" className={DESIGNS[d]}
                  style={{ width: 26, height: 26, borderRadius: 13, border: design === d ? '3px solid currentColor' : '2px solid rgba(128,128,128,.5)', padding: 0 }} />
              ))}
            </div>
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{kind === 'item' ? `${item?.name || '…'} عليّ` : aed(amount * 100)}</span>
          <span className="small">{msg ? `«${msg}»` : ' '}</span>
        </div>

        {kind === 'item' ? (
          <>
            <div className="hscroll" style={{ padding: 0 }}>
              {(stores.data || []).map((s) => (
                <button type="button" key={s.id} className={'chip' + (s.id === sid ? ' on' : '')} onClick={() => { setStoreId(s.id); setItemId(null); }}>
                  {s.name}
                </button>
              ))}
            </div>
            <div className="col gap-6">
              {items.map((i) => (
                <button type="button" key={i.id} onClick={() => setItemId(i.id)} className="card row" style={{ padding: 12, border: item && item.id === i.id ? '2px solid var(--green)' : '1px solid var(--line)', textAlign: 'right' }}>
                  {store.data && <StoreLogo store={store.data} size={36} radius={10} />}
                  <span className="grow semi">{i.name}</span><b className="green">{aed(i.price)}</b>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[25, 50, 100, 200].map((n) => <button type="button" key={n} className={'chip' + (amount === n ? ' on' : '')} style={{ justifyContent: 'center', height: 46 }} onClick={() => setAmount(n)}>{n} د.إ</button>)}
          </div>
        )}

        <div className="col gap-6">
          <span className="semi small">لمين الهدية؟</span>
          <div className="row">
            <div className="seg" style={{ flex: 'none' }}>
              <button type="button" className={by === 'phone' ? 'on' : ''} onClick={() => { setBy('phone'); setTo(''); }}>هاتف</button>
              <button type="button" className={by === 'user' ? 'on' : ''} onClick={() => { setBy('user'); setTo(''); }}>حساب</button>
            </div>
            <label className="input-group grow">
              <span className="ltr muted semi">{by === 'phone' ? '+971' : '@'}</span>
              <input dir="ltr" inputMode={by === 'phone' ? 'tel' : 'text'} placeholder={by === 'phone' ? '5X XXX XXXX' : 'username'} value={to} onChange={(e) => setTo(e.target.value)} required aria-label={by === 'phone' ? 'رقم الهاتف' : 'اسم المستخدم'} />
            </label>
          </div>
        </div>
        <label className="field"><span>رسالتك</span><textarea className="textarea" rows={2} maxLength={120} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="اكتب له كلمتين…" /></label>
        <div className="seg">{[['apple_pay', 'Apple Pay'], ['google_pay', 'Google Pay'], ['card', 'بطاقة']].map(([k, l]) => <button type="button" key={k} className={method === k ? 'on' : ''} onClick={() => setMethod(k)}>{l}</button>)}</div>
        <p className="xs muted">الهدية صالحة 6 شهور. الدفع في وضع تجريبي.</p>
      </div>
      <div className="floating-bar"><button className="btn btn-orange btn-lg btn-block" disabled={busy || !to.trim() || !price}>أرسل الهدية · {aed(price)}</button></div>
    </form>
  );
}
