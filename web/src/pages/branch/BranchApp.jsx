import { useEffect, useRef, useState } from 'react';
import { SessionProvider, useSession } from '../../lib/session';
import { useLoad, useSocketEvent } from '../../lib/hooks';
import { aed, ago } from '../../lib/format';
import Icon, { Logo } from '../../ui/Icon';
import { Loader, ErrorBox, Modal, useAction } from '../../ui/kit';
import Login from '../Login';

const LIVE = ['new', 'preparing', 'ready'];

// Short chime with WebAudio so new orders are heard in a busy kitchen.
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175, 1568].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.3);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.16); o.stop(ctx.currentTime + i * 0.16 + 0.32);
    });
  } catch { /* audio not available */ }
}

function Board() {
  const { api, me, socket, signOut } = useSession();
  const [branchId, setBranchId] = useState(null);
  const q = branchId ? `?branch_id=${branchId}` : '';
  const { data, error, loading, reload, setData } = useLoad(() => api.get('/branch/board' + q), [branchId]);
  const [run, busy] = useAction();
  const [itemsOpen, setItemsOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [, tick] = useState(0);
  const items = useLoad(() => (itemsOpen ? api.get('/branch/items' + q) : Promise.resolve(null)), [itemsOpen, branchId]);
  const soundRef = useRef(sound); soundRef.current = sound;

  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (socket && me.role === 'merchant' && data) socket.emit('branch:watch', data.branch.id); }, [socket, data && data.branch.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const upsert = (o) => setData((d) => {
    if (!d || o.branch.id !== d.branch.id) return d;
    const others = d.orders.filter((x) => x.id !== o.id);
    return LIVE.includes(o.status) ? { ...d, orders: [...others, o].sort((a, b) => a.id - b.id) } : { ...d, orders: others, done_today: [o, ...d.done_today.filter((x) => x.id !== o.id)] };
  });
  useSocketEvent(socket, 'order:new', (o) => { upsert(o); if (soundRef.current) chime(); });
  useSocketEvent(socket, 'order:update', upsert);
  useSocketEvent(socket, 'customer:arrived', () => { if (soundRef.current) chime(); });

  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  const act = (o, action) => run(async () => upsert(await api.post(`/branch/orders/${o.id}/${action}${q}`)));
  const toggleOpen = () => run(async () => { const b = await api.post('/branch/toggle-open' + q); setData({ ...data, branch: { ...data.branch, ...b } }); });
  const toggleItem = (it) => run(async () => { const r = await api.post(`/branch/items/${it.id}/toggle${q}`); items.setData((l) => l.map((x) => (x.id === it.id ? { ...x, is_available: r.is_available } : x))); });

  const orders = data.orders;
  const newOnes = orders.filter((o) => o.status === 'new');
  const arrived = orders.filter((o) => o.arrived_at).sort((a, b) => a.arrived_at.localeCompare(b.arrived_at));
  const coming = orders.filter((o) => !o.arrived_at && o.on_the_way_at).sort((a, b) => (a.eta_minutes ?? 99) - (b.eta_minutes ?? 99));
  const cols = [['طلبات جديدة', 'new', 'orange'], ['قيد التحضير', 'preparing', 'dark'], ['جاهز · بانتظار العميل', 'ready', 'gray']];

  return (
    <div className="board">
      <header className="board-head">
        <Logo size={34} ink="#FFFFFF" />
        <div className="col" style={{ gap: 0 }}>
          <b style={{ fontSize: 18 }}>{data.merchant.name} · فرع {data.branch.name}</b>
          <span className="small" style={{ opacity: .85 }}>طلبات شغالة: {orders.length} · تم تسليمها اليوم: {data.done_today.filter((o) => o.status === 'delivered').length}</span>
        </div>
        {data.branches.length > 1 && (
          <select className="select" style={{ width: 'auto', minHeight: 40, background: 'rgba(246,241,231,.12)', color: 'var(--sand)', border: '1px solid rgba(246,241,231,.4)' }}
            value={data.branch.id} onChange={(e) => setBranchId(Number(e.target.value))} aria-label="الفرع">
            {data.branches.map((b) => <option key={b.id} value={b.id} style={{ color: '#000' }}>{b.name}</option>)}
          </select>
        )}
        <div className="row wrap" style={{ marginInlineStart: 'auto' }}>
          <button className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(246,241,231,.4)' }} onClick={() => { setSound(!sound); if (!sound) chime(); }}>{sound ? 'الصوت شغال' : 'الصوت مقفل'}</button>
          <button className="btn btn-sm" style={{ background: 'transparent', border: '1px solid rgba(246,241,231,.4)' }} onClick={() => setItemsOpen(true)}>إيقاف صنف</button>
          <button className="btn btn-sm" style={{ background: data.branch.is_open ? 'var(--sand)' : 'var(--danger)', color: data.branch.is_open ? 'var(--green)' : '#fff' }} disabled={busy} onClick={toggleOpen}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: data.branch.is_open ? 'var(--ok)' : '#fff' }} />{data.branch.is_open ? 'الفرع مفتوح' : 'الفرع مغلق'}
          </button>
          <button className="btn btn-sm" style={{ background: 'transparent' }} onClick={signOut} aria-label="خروج"><Icon name="logout" /></button>
        </div>
      </header>
      {newOnes.length > 0 && <div className="board-alert"><Icon name="bell" /> طلب جديد #{newOnes[0].id} · اقبله بسرعة{newOnes.length > 1 ? ` (و${newOnes.length - 1} غيره)` : ''}</div>}

      <div className="board-body">
        <section className="arrivals" aria-label="العملاء">
          <h2 className="bold" style={{ fontSize: 17 }}>العملاء وصلوا وجايين</h2>
          {arrived.map((o) => (
            <div key={o.id} className="arrived-card">
              <div className="row-between"><span className="pill" style={{ background: 'var(--orange)', color: 'var(--ink)' }}>وصل {ago(o.arrived_at)}</span><b>#{o.id}</b></div>
              <span className="big-plate">{o.plate_label}</span>
              <span>{o.car_label} · {o.customer.name}</span>
              <button className="btn" style={{ background: o.status === 'ready' ? 'var(--sand)' : 'rgba(246,241,231,.2)', color: o.status === 'ready' ? 'var(--green)' : 'var(--sand)' }}
                disabled={busy || o.status !== 'ready'} onClick={() => act(o, 'deliver')}>{o.status === 'ready' ? 'تم التسليم للسيارة' : 'الطلب لسه ما جهز'}</button>
            </div>
          ))}
          {coming.map((o) => (
            <div key={o.id} className="card row" style={{ padding: 12 }}>
              <div className="col center" style={{ width: 54, height: 54, borderRadius: 14, background: 'var(--orange-soft)', color: 'var(--orange-ink)', alignItems: 'center', justifyContent: 'center', gap: 0, flex: 'none' }}>
                <b style={{ fontSize: 18, lineHeight: 1 }}>{o.eta_minutes ?? '؟'}</b><span className="xs semi">دقيقة</span></div>
              <div className="grow"><b>#{o.id} · {o.plate_label}</b><div className="small muted">{o.car_label}</div></div>
            </div>
          ))}
          {!arrived.length && !coming.length && <p className="small muted">لما يضغط العميل «أنا في الطريق» يطلع هنا مع وقت وصوله.</p>}
        </section>

        {cols.map(([title, status, tone]) => {
          const list = orders.filter((o) => o.status === status);
          return (
            <section key={status} className="board-col" aria-label={title}>
              <div className="row-between"><h2 className="bold" style={{ fontSize: 16 }}>{title}</h2><span className={'pill ' + tone}>{list.length}</span></div>
              {list.map((o) => (
                <div key={o.id} className={'ocard' + (o.status === 'new' ? ' new' : o.arrived_at ? ' here' : '')}>
                  <div className="row-between"><b style={{ fontSize: 18 }}>#{o.id}</b><span className="small muted">{ago(o.created_at)}</span></div>
                  {o.items.map((i, k) => <div key={k} className="semi">{i.qty} × {i.name}{i.is_gift ? ' (هدية)' : ''}</div>)}
                  {o.note && <div className="small" style={{ background: 'var(--orange-soft)', padding: '4px 8px', borderRadius: 8 }}>ملاحظة: {o.note}</div>}
                  <div className="row-between small"><span className="muted">{o.plate_label}</span>
                    <b className={o.arrived_at ? 'green' : ''}>{o.arrived_at ? 'وصل' : o.on_the_way_at ? `يوصل بعد ${o.eta_minutes ?? '…'} د` : 'ما تحرك للحين'}</b></div>
                  <div className="row">
                    {status === 'new' && <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => { if (confirm(`ترفض الطلب رقم ${o.id}؟ بنرجع المبلغ للعميل.`)) act(o, 'reject'); }}>رفض</button>}
                    {status === 'new' && <button className="btn btn-sm grow" disabled={busy} onClick={() => act(o, 'accept')}>قبول</button>}
                    {status === 'preparing' && <button className="btn btn-sm btn-orange grow" disabled={busy} onClick={() => act(o, 'ready')}>جاهز</button>}
                    {status === 'ready' && <button className="btn btn-sm btn-light grow" disabled={busy} onClick={() => act(o, 'deliver')}>تم التسليم</button>}
                  </div>
                  <span className="xs muted">{aed(o.subtotal)} · {o.customer.name}</span>
                </div>
              ))}
              {!list.length && <p className="small muted center" style={{ padding: 20 }}>ما فيه</p>}
            </section>
          );
        })}
      </div>

      <Modal open={itemsOpen} onClose={() => setItemsOpen(false)} title="توفر الأصناف">
        {!items.data ? <Loader /> : (
          <div className="col">
            {items.data.map((it) => (
              <div key={it.id} className="row-between" style={{ padding: '6px 0' }}>
                <span className={it.is_available ? 'semi' : 'muted'}>{it.name}</span>
                <button className={'switch' + (it.is_available ? ' on' : '')} onClick={() => toggleItem(it)} aria-pressed={!!it.is_available} aria-label={it.name} />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Gate() {
  const { me, ready } = useSession();
  if (!ready) return <Loader />;
  if (!me || !['staff', 'merchant'].includes(me.role)) return <Login dark />;
  return <Board />;
}

export default function BranchApp() {
  return <SessionProvider area="branch"><Gate /></SessionProvider>;
}
