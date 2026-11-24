import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from '../../lib/session';
import { useLoad, useSocketEvent } from '../../lib/hooks';
import { aed, ago, dateShort } from '../../lib/format';
import Icon, { Logo } from '../../ui/Icon';
import { Loader, ErrorBox, Empty, Modal, StoreLogo, useAction } from '../../ui/kit';
import { Bars } from '../merchant/MerchantApp';
import Login from '../Login';

const NAV = [['', 'chart', 'نظرة عامة'], ['merchants', 'store', 'التجار'], ['orders', 'orders', 'الطلبات'], ['reports', 'flag', 'البلاغات'], ['users', 'users', 'المستخدمين']];
const CAT = { coffee: 'قهوة', burger: 'برجر', restaurant: 'مطعم', bakery: 'مخبز', juice: 'عصائر', dessert: 'حلويات', grocery: 'بقالة', pharmacy: 'صيدلية' };

function Overview() {
  const { api, socket } = useSession();
  const { data, loading, error, reload } = useLoad(() => api.get('/admin/overview'), []);
  useSocketEvent(socket, 'order:new', reload);
  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="muted small">طلبات اليوم (مسلّمة)</span><b>{data.today.orders}</b></div>
        <div className="kpi"><span className="muted small">قيمة الطلبات اليوم</span><b>{aed(data.today.gmv)}</b></div>
        <div className="kpi"><span className="muted small">إيراد Around اليوم</span><b>{aed(data.today.revenue)}</b></div>
        <div className="kpi"><span className="muted small">طلبات شغالة الحين</span><b>{data.live}</b></div>
        <div className="kpi"><span className="muted small">التجار</span><b>{data.merchants.active}<span className="small muted"> نشط · {data.merchants.pending} بانتظار</span></b></div>
        <div className="kpi"><span className="muted small">العملاء</span><b>{data.customers}</b></div>
        <div className="kpi" style={data.open_reports ? { background: 'var(--danger-soft)' } : undefined}><span className="muted small">بلاغات مفتوحة</span><b>{data.open_reports}</b></div>
      </div>
      <div className="grid-2">
        <div className="card col"><h2 className="bold">الطلبات آخر 14 يوم</h2>{data.days.length ? <Bars rows={data.days} value={(r) => r.orders} label="الطلبات اليومية" /> : <p className="muted">—</p>}</div>
        <div className="card col"><h2 className="bold">إيراد Around (د.إ)</h2>{data.days.length ? <Bars rows={data.days} value={(r) => Math.round(r.revenue / 100)} label="الإيراد اليومي" /> : <p className="muted">—</p>}</div>
      </div>
    </>
  );
}

function Merchants() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const { data, loading, reload } = useLoad(() => api.get('/admin/merchants'), []);
  const [edit, setEdit] = useState(null);
  const [adding, setAdding] = useState(null);
  const appsQ = useLoad(() => api.get('/admin/applications'), []);
  const { socket } = useSession();
  useSocketEvent(socket, 'merchant:applied', appsQ.reload);
  if (loading && !data) return <Loader />;
  const apps = appsQ.data || [];
  const decide = (a, action) => run(async () => { await api.post('/admin/applications/' + a.id + '/' + action, {}); appsQ.reload(); reload(); }, action === 'approve' ? 'تم اعتماد المحل، يقدر يدخل من التطبيق' : 'تم رفض الطلب');
  const setStatus = (m, status) => run(async () => { await api.patch('/admin/merchants/' + m.id, { status }); reload(); }, status === 'active' ? 'تم اعتماد المحل' : 'تم التحديث');
  const saveEdit = (e) => { e.preventDefault(); run(async () => { await api.patch('/admin/merchants/' + edit.id, { commission_pct: edit.commission_pct }); setEdit(null); reload(); }, 'حفظنا العمولة'); };
  const create = (e) => { e.preventDefault(); run(async () => { await api.post('/admin/merchants', adding); setAdding(null); reload(); }, 'أضفنا التاجر'); };
  return (
    <>
      <button className="btn btn-orange" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding({ name: '', category: 'coffee', owner_phone: '', owner_name: '', commission_pct: 7 })}><Icon name="plus" /> تاجر جديد</button>
      {apps.length > 0 && (
        <div className="col"><h2 className="bold">طلبات انضمام من الموقع ({apps.length})</h2>
          {apps.map((a) => (
            <div key={a.id} className="card row wrap" style={{ border: '2px solid var(--accent)' }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <b className="ellipsis" dir="auto">{a.business_name}</b>
                <div className="small muted">{CAT[a.category]} · {a.city} · {a.area} · {a.branches} فرع · {a.contact_name} · <span className="ltr">{a.phone}</span> · {ago(a.created_at)}</div>
                {a.note && <div className="small" style={{ overflowWrap: 'anywhere' }}>{a.note}</div>}
              </div>
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => decide(a, 'reject')}>رفض</button>
              <button className="btn btn-sm" disabled={busy} onClick={() => decide(a, 'approve')}>اعتماد</button>
            </div>
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>المحل</th><th>النشاط</th><th>المالك</th><th>الفروع</th><th>طلبات مسلّمة</th><th>إيراد Around</th><th>العمولة</th><th>الحالة</th><th /></tr></thead>
          <tbody>
            {data.map((m) => (
              <tr key={m.id}>
                <td><div className="row"><StoreLogo store={m} size={34} radius={8} /><b>{m.name}</b></div></td>
                <td>{CAT[m.category]}</td><td className="small">{m.owner_name}<br /><span className="ltr muted">{m.owner_phone}</span></td>
                <td>{m.branches}</td><td>{m.delivered}</td><td>{aed(m.revenue)}</td><td>{m.commission_pct}%</td>
                <td><span className={'pill ' + (m.status === 'active' ? 'green' : m.status === 'pending' ? 'orange' : 'red')}>{m.status === 'active' ? 'نشط' : m.status === 'pending' ? 'بانتظار' : 'موقوف'}</span></td>
                <td className="row">
                  <button className="btn btn-sm btn-light" onClick={() => setEdit({ ...m })}>العمولة</button>
                  {m.status === 'active' ? <button className="btn btn-sm btn-danger" onClick={() => setStatus(m, 'suspended')}>إيقاف</button> : <button className="btn btn-sm" onClick={() => setStatus(m, 'active')}>تفعيل</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`عمولة ${edit?.name || ''}`}>
        {edit && <form className="col gap-14" onSubmit={saveEdit}><label className="field"><span>العمولة %</span><input className="input ltr" type="number" step="0.5" min="0" max="50" value={edit.commission_pct} onChange={(e) => setEdit({ ...edit, commission_pct: e.target.value })} /></label><button className="btn btn-orange" disabled={busy}>حفظ</button></form>}
      </Modal>
      <Modal open={!!adding} onClose={() => setAdding(null)} title="تاجر جديد">
        {adding && (
          <form className="col gap-14" onSubmit={create}>
            <label className="field"><span>اسم المحل</span><input className="input" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} required /></label>
            <label className="field"><span>النشاط</span><select className="select" value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })}>{Object.entries(CAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <div className="row"><label className="field grow"><span>اسم المالك</span><input className="input" value={adding.owner_name} onChange={(e) => setAdding({ ...adding, owner_name: e.target.value })} /></label>
              <label className="field grow"><span>هاتف المالك</span><input className="input ltr" value={adding.owner_phone} onChange={(e) => setAdding({ ...adding, owner_phone: e.target.value })} required /></label></div>
            <label className="field"><span>العمولة %</span><input className="input ltr" type="number" step="0.5" value={adding.commission_pct} onChange={(e) => setAdding({ ...adding, commission_pct: e.target.value })} /></label>
            <button className="btn btn-orange" disabled={busy}>إضافة</button>
          </form>
        )}
      </Modal>
    </>
  );
}

function Orders() {
  const { api, socket } = useSession();
  const [live, setLive] = useState(false);
  const { data, loading, reload } = useLoad(() => api.get('/admin/orders' + (live ? '?live=1' : '')), [live]);
  useSocketEvent(socket, 'order:new', reload);
  return (
    <>
      <div className="row"><button className={'chip' + (!live ? ' on' : '')} onClick={() => setLive(false)}>كل الطلبات</button><button className={'chip' + (live ? ' on' : '')} onClick={() => setLive(true)}>الشغالة الحين</button></div>
      {loading && !data ? <Loader /> : (
        <div className="table-wrap"><table className="t">
          <thead><tr><th>الطلب</th><th>المحل</th><th>الفرع</th><th>العميل</th><th>القيمة</th><th>المدفوع</th><th>العمولة</th><th>الحالة</th><th>الوقت</th></tr></thead>
          <tbody>{data.map((o) => (
            <tr key={o.id}><td className="bold">#{o.id}</td><td>{o.merchant.name}</td><td>{o.branch.name}</td><td>{o.customer.name}</td><td>{aed(o.subtotal)}</td><td>{aed(o.total)}</td><td>{aed(o.commission)}</td>
              <td><span className={'pill ' + (o.status === 'delivered' ? 'green' : ['rejected', 'cancelled'].includes(o.status) ? 'gray' : 'orange')}>{o.status_label}</span></td><td className="small muted">{ago(o.created_at)}</td></tr>
          ))}</tbody></table>{!data.length && <Empty icon="orders" title="ما فيه طلبات" />}</div>
      )}
    </>
  );
}

function Reports() {
  const { api, socket } = useSession();
  const [run, busy] = useAction();
  const { data, loading, reload } = useLoad(() => api.get('/admin/reports'), []);
  useSocketEvent(socket, 'report:new', reload);
  if (loading && !data) return <Loader />;
  const act = (r, a) => run(async () => { await api.post(`/admin/reports/${r.post_id}/${a}`); reload(); }, a === 'remove' ? 'انحذف المنشور' : 'تم تجاهل البلاغ');
  return !data.length ? <Empty icon="flag" title="ما فيه بلاغات مفتوحة" /> : (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
      {data.map((r) => (
        <div key={r.id} className="card col" style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
          <img src={r.image} alt={r.caption} style={{ aspectRatio: '4/5', objectFit: 'cover', width: '100%' }} />
          <div className="col gap-6" style={{ padding: 12 }}>
            <b>{r.author}</b>{r.caption && <p className="small">{r.caption}</p>}
            <span className="pill red" style={{ alignSelf: 'flex-start' }}>{r.count} بلاغ · {r.reason}</span>
            <span className="xs muted">آخر بلاغ من {r.reporter} · {ago(r.created_at)}</span>
            <div className="row"><button className="btn btn-sm btn-light grow" disabled={busy} onClick={() => act(r, 'dismiss')}>تجاهل</button><button className="btn btn-sm btn-danger grow" disabled={busy} onClick={() => act(r, 'remove')}>حذف المنشور</button></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Users() {
  const { api } = useSession();
  const [q, setQ] = useState('');
  const { data, loading } = useLoad(() => api.get('/admin/users?q=' + encodeURIComponent(q)), [q]);
  const ROLE = { customer: 'عميل', staff: 'موظف', merchant: 'تاجر', admin: 'أدمن' };
  return (
    <>
      <input className="input" style={{ maxWidth: 360 }} placeholder="ابحث بالاسم أو الهاتف" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" />
      {loading && !data ? <Loader /> : (
        <div className="table-wrap"><table className="t"><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الهاتف</th><th>النوع</th><th>طلبات</th><th>التسجيل</th></tr></thead>
          <tbody>{data.map((u) => <tr key={u.id}><td className="semi">{u.name || '—'}</td><td className="ltr">{u.username ? '@' + u.username : '—'}</td><td className="ltr">{u.phone}</td><td>{ROLE[u.role]}</td><td>{u.orders}</td><td className="small muted">{dateShort(u.created_at)}</td></tr>)}</tbody></table></div>
      )}
    </>
  );
}

function Shell() {
  const { me, ready, signOut } = useSession();
  if (!ready) return <Loader />;
  if (!me || me.role !== 'admin') return <Login dark />;
  const page = (p, el) => <><div className="console-head"><h1>{NAV.find((n) => n[0] === p)[2]}</h1></div>{el}</>;
  return (
    <div className="console">
      <nav className="side" aria-label="أقسام الإدارة">
        <div className="brand"><Logo size={30} ink="#FFFFFF" /><b style={{ fontSize: 17 }}>إدارة Around</b></div>
        {NAV.map(([p, icon, label]) => <NavLink key={p} to={'/admin' + (p ? '/' + p : '')} end={!p} className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={icon} size={20} />{label}</NavLink>)}
        <button className="nav" onClick={signOut} style={{ marginTop: 'auto' }}><Icon name="logout" size={20} />خروج</button>
      </nav>
      <main className="console-main">
        <Routes>
          <Route index element={page('', <Overview />)} />
          <Route path="merchants" element={page('merchants', <Merchants />)} />
          <Route path="orders" element={page('orders', <Orders />)} />
          <Route path="reports" element={page('reports', <Reports />)} />
          <Route path="users" element={page('users', <Users />)} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function AdminApp() {
  return <SessionProvider area="admin"><Shell /></SessionProvider>;
}
