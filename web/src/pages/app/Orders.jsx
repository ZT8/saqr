import { Link } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useLoad, useSocketEvent } from '../../lib/hooks';
import { aed, ago } from '../../lib/format';
import { Loader, ErrorBox, Empty, StoreLogo } from '../../ui/kit';

const LIVE = ['new', 'preparing', 'ready'];

export default function Orders() {
  const { api, socket } = useSession();
  const { data, error, loading, reload, setData } = useLoad(() => api.get('/orders'), []);
  useSocketEvent(socket, 'order:update', (u) => setData((list) => (list || []).map((o) => (o.id === u.id ? u : o))));

  const live = (data || []).filter((o) => LIVE.includes(o.status));
  const past = (data || []).filter((o) => !LIVE.includes(o.status));
  return (
    <>
      <header className="topbar"><h1>طلباتي</h1></header>
      {loading && !data ? <Loader /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : !data.length ? (
        <Empty icon="orders" title="ما عندك طلبات للحين" action={<Link to="/app" className="btn btn-orange">اطلب الحين</Link>}>اطلب من أي محل، واستلم من سيارتك.</Empty>
      ) : (
        <div className="pad col gap-18">
          {live.length > 0 && <section className="col"><h2 className="bold">شغالة الحين</h2>{live.map((o) => <OrderCard key={o.id} o={o} />)}</section>}
          {past.length > 0 && <section className="col"><h2 className="bold">السابقة</h2>{past.map((o) => <OrderCard key={o.id} o={o} />)}</section>}
        </div>
      )}
    </>
  );
}

function OrderCard({ o }) {
  const tone = o.status === 'delivered' ? 'green' : ['rejected', 'cancelled'].includes(o.status) ? 'gray' : 'orange';
  return (
    <Link to={`/app/orders/${o.id}`} className="card card-press row" style={{ alignItems: 'flex-start' }}>
      <StoreLogo store={o.merchant} size={50} radius={12} />
      <div className="grow col gap-4">
        <div className="row-between"><b className="ellipsis">{o.merchant.name}</b><span className={'pill ' + tone}>{o.status_label}</span></div>
        <span className="small muted ellipsis">{o.items.map((i) => `${i.qty} × ${i.name}`).join('، ')}</span>
        <span className="small">#{o.id} · {aed(o.subtotal)} · {ago(o.created_at)}</span>
      </div>
    </Link>
  );
}
