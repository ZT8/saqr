import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, Link } from 'react-router-dom';
import { SessionProvider, useSession } from '../../lib/session';
import { useLoad, useSocketEvent } from '../../lib/hooks';
import { aed, ago, dateShort } from '../../lib/format';
import Icon, { Logo } from '../../ui/Icon';
import { Loader, ErrorBox, Empty, Modal, ItemThumb, StoreLogo, useAction, useToast } from '../../ui/kit';
import Login from '../Login';

const NAV = [
  ['', 'chart', 'نظرة عامة'], ['orders', 'orders', 'الطلبات'], ['menu', 'menu', 'المنيو'], ['branches', 'store', 'الفروع'],
  ['loyalty', 'star', 'برنامج الولاء'], ['stories', 'crown', 'الستوريات'], ['staff', 'users', 'الموظفين'],
  ['settlement', 'wallet', 'التسويات'], ['profile', 'settings', 'ملف المحل']
];

export function Bars({ rows, value, label }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <div className="bars-chart" role="img" aria-label={label}>
      {rows.map((r) => <div key={r.d} title={`${r.d}: ${value(r)}`}><span className="semi" style={{ color: 'var(--ink)' }}>{value(r) || ''}</span><i style={{ height: `${(value(r) / max) * 100}%` }} /><span>{r.d.slice(8)}</span></div>)}
    </div>
  );
}

function Overview() {
  const { api, socket } = useSession();
  const { data, loading, error, reload } = useLoad(() => api.get('/merchant/overview'), []);
  useSocketEvent(socket, 'order:new', reload);
  useSocketEvent(socket, 'order:update', reload);
  if (loading && !data) return <Loader />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <>
      <div className="kpis">
        <div className="kpi"><span className="muted small">طلبات اليوم (مسلّمة)</span><b>{data.today.orders}</b></div>
        <div className="kpi"><span className="muted small">مبيعات اليوم</span><b>{aed(data.today.sales)}</b></div>
        <div className="kpi"><span className="muted small">انتظار العميل بعد وصوله</span><b>{data.today.avg_wait_min ? `${data.today.avg_wait_min} د` : '—'}</b></div>
        <div className="kpi"><span className="muted small">التقييم (30 يوم)</span><b>{data.rating.avg ?? '—'}<span className="small muted"> / 5 · {data.rating.count} تقييم</span></b></div>
        <div className="kpi" style={{ background: 'var(--green)', color: 'var(--sand)' }}><span className="small" style={{ opacity: .85 }}>طلبات شغالة الحين</span><b>{data.live}</b><Link to="/branch" className="small semi" style={{ textDecoration: 'underline' }}>افتح تطبيق الفرع</Link></div>
      </div>
      <div className="grid-2">
        <div className="card col"><h2 className="bold">المبيعات آخر 14 يوم</h2>{data.days.length ? <Bars rows={data.days} value={(r) => Math.round(r.sales / 100)} label="المبيعات اليومية بالدرهم" /> : <p className="muted">ما فيه مبيعات للحين</p>}</div>
        <div className="card col"><h2 className="bold">الأكثر طلباً (30 يوم)</h2>
          {data.top.length ? data.top.map((t, i) => <div key={t.name} className="row-between"><span>{i + 1}. {t.name}</span><b>{t.qty}</b></div>) : <p className="muted">—</p>}</div>
      </div>
      <OrdersTable orders={data.recent} title="آخر الطلبات" />
    </>
  );
}

function OrdersTable({ orders, title }) {
  return (
    <div className="table-wrap">
      {title && <h2 className="bold" style={{ padding: '12px 8px 0' }}>{title}</h2>}
      <table className="t">
        <thead><tr><th>الطلب</th><th>الفرع</th><th>العميل</th><th>المنتجات</th><th>المبلغ</th><th>الحالة</th><th>الوقت</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="bold">#{o.id}</td><td>{o.branch.name}</td><td>{o.customer.name}</td>
              <td className="small">{o.items.map((i) => `${i.qty}× ${i.name}`).join('، ')}</td>
              <td>{aed(o.subtotal - o.reward_discount)}</td>
              <td><span className={'pill ' + (o.status === 'delivered' ? 'green' : ['rejected', 'cancelled'].includes(o.status) ? 'gray' : 'orange')}>{o.status_label}</span></td>
              <td className="small muted">{ago(o.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && <Empty icon="orders" title="ما فيه طلبات" />}
    </div>
  );
}

function Orders() {
  const { api, socket } = useSession();
  const [status, setStatus] = useState('');
  const { data, loading, reload } = useLoad(() => api.get('/merchant/orders' + (status ? '?status=' + status : '')), [status]);
  useSocketEvent(socket, 'order:update', reload);
  useSocketEvent(socket, 'order:new', reload);
  return (
    <>
      <div className="row wrap">{[['', 'الكل'], ['new', 'جديد'], ['preparing', 'قيد التحضير'], ['ready', 'جاهز'], ['delivered', 'تم التسليم'], ['rejected', 'مرفوض'], ['cancelled', 'ملغي']].map(([k, l]) =>
        <button key={k} className={'chip' + (status === k ? ' on' : '')} onClick={() => setStatus(k)}>{l}</button>)}</div>
      {loading && !data ? <Loader /> : <OrdersTable orders={data || []} />}
    </>
  );
}

function Menu() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const { data, loading, reload } = useLoad(() => api.get('/merchant/menu'), []);
  const profile = useLoad(() => api.get('/merchant/profile'), []);
  const [edit, setEdit] = useState(null);
  const [newCat, setNewCat] = useState('');
  if (loading && !data) return <Loader />;
  const addCat = (e) => { e.preventDefault(); run(async () => { await api.post('/merchant/categories', { name: newCat }); setNewCat(''); reload(); }); };
  const delCat = (c) => { if (confirm(`تحذف قسم ${c.name}؟ المنتجات بتبقى بدون قسم.`)) run(async () => { await api.del('/merchant/categories/' + c.id); reload(); }); };
  const toggle = (it) => run(async () => { await api.patch('/merchant/items/' + it.id, { is_available: it.is_available ? 0 : 1 }); reload(); });
  const groups = [...data.categories.map((c) => ({ ...c, items: data.items.filter((i) => i.category_id === c.id) })), { id: null, name: 'بدون قسم', items: data.items.filter((i) => !i.category_id) }].filter((g) => g.id || g.items.length);
  return (
    <>
      <div className="row wrap">
        <button className="btn btn-orange" onClick={() => setEdit({ category_id: data.categories[0]?.id || '', is_available: 1, is_top: 0 })}><Icon name="plus" /> منتج جديد</button>
        <form className="row wrap" onSubmit={addCat}><input className="input" style={{ width: 200 }} placeholder="اسم قسم جديد" value={newCat} onChange={(e) => setNewCat(e.target.value)} required /><button className="btn btn-light" disabled={busy}>إضافة قسم</button></form>
      </div>
      {groups.map((g) => (
        <div key={g.id ?? 'none'} className="table-wrap">
          <div className="row-between" style={{ padding: '12px 8px 0' }}><h2 className="bold">{g.name}</h2>{g.id && <button className="btn btn-sm btn-danger" onClick={() => delCat(g)}>حذف القسم</button>}</div>
          <table className="t">
            <thead><tr><th /><th>المنتج</th><th>السعر</th><th>الأكثر طلباً</th><th>متوفر</th><th /></tr></thead>
            <tbody>
              {g.items.map((it) => (
                <tr key={it.id}>
                  <td style={{ width: 64 }}><ItemThumb item={it} size={48} category={profile.data?.category} /></td>
                  <td><div className="semi">{it.name}</div><div className="xs muted">{it.description}</div></td>
                  <td>{aed(it.price)}</td>
                  <td>{it.is_top ? <span className="pill orange">مميز</span> : '—'}</td>
                  <td><button className={'switch' + (it.is_available ? ' on' : '')} onClick={() => toggle(it)} aria-pressed={!!it.is_available} aria-label={`توفر ${it.name}`} /></td>
                  <td><button className="btn btn-sm btn-light" onClick={() => setEdit({ ...it, price: it.price / 100 })}>تعديل</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!g.items.length && <p className="muted small" style={{ padding: 12 }}>ما فيه منتجات في هذا القسم</p>}
        </div>
      ))}
      <ItemEditor item={edit} categories={data.categories} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />
    </>
  );
}

function ItemEditor({ item, categories, onClose, onSaved }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [f, setF] = useState(null);
  const [file, setFile] = useState(null);
  useEffect(() => { setF(item ? { ...item } : null); setFile(null); }, [item]);
  if (!item || !f) return null;
  const save = (e) => {
    e.preventDefault();
    const fd = new FormData();
    ['name', 'description', 'price', 'category_id'].forEach((k) => fd.append(k, f[k] ?? ''));
    fd.append('is_available', f.is_available ? '1' : '0'); fd.append('is_top', f.is_top ? '1' : '0');
    if (file) fd.append('image', file);
    run(async () => { f.id ? await api.patch('/merchant/items/' + f.id, fd) : await api.post('/merchant/items', fd); onSaved(); }, 'تم الحفظ');
  };
  const del = () => { if (confirm('تحذف المنتج؟')) run(async () => { await api.del('/merchant/items/' + f.id); onSaved(); }); };
  return (
    <Modal open onClose={onClose} title={f.id ? 'تعديل منتج' : 'منتج جديد'}>
      <form className="col gap-14" onSubmit={save}>
        <label className="field"><span>الاسم</span><input className="input" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label className="field"><span>الوصف</span><input className="input" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <div className="row">
          <label className="field grow"><span>السعر (د.إ)</span><input className="input ltr" type="number" step="0.5" min="0.5" value={f.price ?? ''} onChange={(e) => setF({ ...f, price: e.target.value })} required /></label>
          <label className="field grow"><span>القسم</span><select className="select" value={f.category_id || ''} onChange={(e) => setF({ ...f, category_id: e.target.value })}><option value="">بدون قسم</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <label className="field"><span>الصورة</span><input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} style={{ paddingTop: 10 }} /></label>
        <div className="row-between"><span className="semi">متوفر</span><button type="button" className={'switch' + (f.is_available ? ' on' : '')} onClick={() => setF({ ...f, is_available: f.is_available ? 0 : 1 })} aria-label="متوفر" /></div>
        <div className="row-between"><span className="semi">يظهر في «الأكثر طلباً»</span><button type="button" className={'switch' + (f.is_top ? ' on' : '')} onClick={() => setF({ ...f, is_top: f.is_top ? 0 : 1 })} aria-label="مميز" /></div>
        <div className="row">{f.id && <button type="button" className="btn btn-danger" onClick={del}>حذف</button>}<button className="btn btn-orange grow" disabled={busy}>حفظ</button></div>
      </form>
    </Modal>
  );
}

function Branches() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const { data, loading, reload } = useLoad(() => api.get('/merchant/branches'), []);
  const [edit, setEdit] = useState(null);
  if (loading && !data) return <Loader />;
  const save = (e) => { e.preventDefault(); run(async () => { edit.id ? await api.patch('/merchant/branches/' + edit.id, edit) : await api.post('/merchant/branches', edit); setEdit(null); reload(); }, 'حفظنا الفرع'); };
  const here = () => navigator.geolocation?.getCurrentPosition((p) => setEdit({ ...edit, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }));
  return (
    <>
      <button className="btn btn-orange" style={{ alignSelf: 'flex-start' }} onClick={() => setEdit({ name: '', area: '', city: 'العين', lat: '', lng: '', open_time: '07:00', close_time: '23:00', prep_minutes: 10 })}><Icon name="plus" /> فرع جديد</button>
      <div className="grid-2">
        {data.map((b) => (
          <div key={b.id} className="card col gap-6">
            <div className="row-between"><b style={{ fontSize: 18 }}>فرع {b.name}</b><span className={'pill ' + (b.is_open ? 'green' : 'red')}>{b.is_open ? 'مفتوح' : 'مغلق مؤقتاً'}</span></div>
            <span className="muted small">{b.area} · {b.city}</span>
            <span className="small">الدوام {b.open_time} إلى {b.close_time} · التحضير {b.prep_minutes} د</span>
            <span className="xs muted ltr">{b.lat.toFixed(5)}, {b.lng.toFixed(5)}</span>
            <div className="row"><button className="btn btn-sm btn-light" onClick={() => setEdit(b)}>تعديل</button><Link className="btn btn-sm" to={`/branch`}>تطبيق الفرع</Link></div>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'تعديل الفرع' : 'فرع جديد'}>
        {edit && (
          <form className="col gap-14" onSubmit={save}>
            <div className="row"><label className="field grow"><span>اسم الفرع</span><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required /></label>
              <label className="field grow"><span>المنطقة</span><input className="input" value={edit.area} onChange={(e) => setEdit({ ...edit, area: e.target.value })} required /></label></div>
            <label className="field"><span>المدينة</span><input className="input" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} required /></label>
            <div className="row"><label className="field grow"><span>خط العرض</span><input className="input ltr" value={edit.lat} onChange={(e) => setEdit({ ...edit, lat: e.target.value })} required /></label>
              <label className="field grow"><span>خط الطول</span><input className="input ltr" value={edit.lng} onChange={(e) => setEdit({ ...edit, lng: e.target.value })} required /></label></div>
            <button type="button" className="btn btn-light btn-sm" style={{ alignSelf: 'flex-start' }} onClick={here}><Icon name="pin" size={18} /> استخدم موقعي الحالي</button>
            <div className="row"><label className="field grow"><span>يفتح</span><input className="input ltr" type="time" value={edit.open_time} onChange={(e) => setEdit({ ...edit, open_time: e.target.value })} /></label>
              <label className="field grow"><span>يسكر</span><input className="input ltr" type="time" value={edit.close_time} onChange={(e) => setEdit({ ...edit, close_time: e.target.value })} /></label>
              <label className="field grow"><span>التحضير (د)</span><input className="input ltr" type="number" min="1" max="120" value={edit.prep_minutes} onChange={(e) => setEdit({ ...edit, prep_minutes: e.target.value })} /></label></div>
            <button className="btn btn-orange" disabled={busy}>حفظ</button>
          </form>
        )}
      </Modal>
    </>
  );
}

function LoyaltySettings() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const { data, loading } = useLoad(() => api.get('/merchant/loyalty'), []);
  const profile = useLoad(() => api.get('/merchant/profile'), []);
  const [f, setF] = useState(null);
  if (loading || !data) return <Loader />;
  const v = f || { ...data, reward_value: data.reward_value / 100 };
  const stamps = v.type === 'stamps';
  const set = (patch) => setF({ ...v, ...patch });
  const save = () => run(async () => { await api.put('/merchant/loyalty', v); }, 'حفظنا البرنامج');
  const EXP = [[3, '3 شهور'], [6, '6 شهور'], [12, 'سنة'], [0, 'بدون انتهاء']];
  return (
    <>
      <p className="muted" style={{ maxWidth: 760 }}>أنت تحدد كيف يجمع عملاؤك النقاط، وش يكسبون، ومتى تنتهي. Around تعرض برنامجك وتحسب النقاط تلقائياً، وتكلفة المكافأة عليك.</p>
      <div className="kpis">
        <div className="kpi"><span className="muted small">أعضاء عندهم رصيد</span><b>{data.stats.members}</b></div>
        <div className="kpi"><span className="muted small">جاهزين للمكافأة</span><b>{data.stats.ready}</b></div>
        <div className="kpi"><span className="muted small">مكافآت استُخدمت (30 يوم)</span><b>{data.stats.redeemed_30d}</b></div>
      </div>
      <div className="grid-2">
        <div className="card col gap-18">
          <div className="row-between"><h2 className="bold">برنامج الولاء</h2><button className={'switch' + (v.active ? ' on' : '')} onClick={() => set({ active: v.active ? 0 : 1 })} aria-label="تفعيل البرنامج" aria-pressed={!!v.active} /></div>
          <div className="row">
            {[['stamps', 'أختام', 'كل منتج = ختم'], ['points', 'نقاط', 'كل درهم = نقطة']].map(([k, l, d]) => (
              <button key={k} className="card grow col gap-4" style={{ textAlign: 'right', border: v.type === k ? '2px solid var(--green)' : '1px solid var(--line)', background: v.type === k ? 'var(--green-soft)' : 'var(--white)' }} onClick={() => set({ type: k, goal: k === 'stamps' ? 10 : 300 })}>
                <b>{l}</b><span className="small muted">{d}</span>
              </button>
            ))}
          </div>
          <label className="field"><span>{stamps ? 'عدد الأختام للمكافأة' : 'النقاط المطلوبة للمكافأة'}</span><input className="input ltr" type="number" min="2" value={v.goal} onChange={(e) => set({ goal: e.target.value })} /></label>
          <label className="field"><span>المكافأة (يشوفها العميل)</span><input className="input" value={v.reward_text} onChange={(e) => set({ reward_text: e.target.value })} maxLength={80} /></label>
          <label className="field"><span>أقصى خصم للمكافأة (د.إ) · 0 = سعر أرخص منتج في الطلب</span><input className="input ltr" type="number" min="0" value={v.reward_value} onChange={(e) => set({ reward_value: e.target.value })} /></label>
          <div className="field"><span>صلاحية النقاط (من آخر طلب)</span><div className="row wrap">{EXP.map(([n, l]) => <button key={n} className={'chip' + (Number(v.expiry_months) === n ? ' on' : '')} onClick={() => set({ expiry_months: n })}>{l}</button>)}</div></div>
          <button className="btn btn-orange" disabled={busy} onClick={save}>حفظ البرنامج</button>
        </div>
        <div className="col">
          <span className="muted small semi">كيف يشوفه العميل</span>
          <div className="card col" style={{ opacity: v.active ? 1 : .45, gap: 10 }}>
            <div className="row">{profile.data && <StoreLogo store={profile.data} size={44} radius={12} />}<div className="grow"><b>{profile.data?.name}</b><div className="xs muted">{v.reward_text}</div></div><b className="green">{stamps ? `3/${v.goal}` : `120/${v.goal}`}</b></div>
            {stamps && v.goal <= 12 ? <div className="stamps" style={{ gridTemplateColumns: `repeat(${v.goal}, 1fr)` }}>{Array.from({ length: Number(v.goal) || 0 }, (_, i) => <span key={i} className={i < 3 ? 'on' : ''} />)}</div>
              : <div className="bar"><span style={{ width: Math.min(100, (120 / (v.goal || 1)) * 100) + '%' }} /></div>}
            <div className="row-between xs"><span className="muted">{stamps ? 'كل منتج = ختم' : 'كل درهم = نقطة'}</span>{Number(v.expiry_months) ? <span className="danger semi">تنتهي بعد {EXP.find((x) => x[0] === Number(v.expiry_months))[1]} من آخر طلب</span> : <span className="muted">ما تنتهي</span>}</div>
          </div>
        </div>
      </div>
    </>
  );
}

function Stories() {
  const { api, socket } = useSession();
  const [run] = useAction();
  const { data, loading, setData, reload } = useLoad(() => api.get('/merchant/stories'), []);
  useSocketEvent(socket, 'post:new', reload);
  if (loading && !data) return <Loader />;
  const pin = (p) => run(async () => { const r = await api.post(`/merchant/stories/${p.id}/pin`); setData((l) => l.map((x) => (x.id === p.id ? { ...x, pinned: r.pinned } : x))); });
  return (
    <>
      <p className="muted">ستوريات نزّلها عملاؤك من طلبات حقيقية. ثبّت أحلاها عشان تطلع في صفحة محلك.</p>
      {!data.length ? <Empty icon="crown" title="ما فيه ستوريات للحين" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
          {data.map((p) => (
            <div key={p.id} className="card col" style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
              <img src={p.image} alt={p.caption} style={{ aspectRatio: '4/5', objectFit: 'cover', width: '100%' }} />
              <div className="col gap-6" style={{ padding: 12 }}>
                <div className="row-between small"><b>{p.user.username || p.user.name}</b><span className="muted">{ago(p.created_at)}</span></div>
                {p.caption && <p className="small">{p.caption}</p>}
                <span className="xs muted">{p.likes} إعجاب · {p.orders_from} طلب منها</span>
                <button className={'btn btn-sm ' + (p.pinned ? '' : 'btn-ghost')} onClick={() => pin(p)}>{p.pinned ? 'مثبّتة في صفحة المحل' : 'ثبّتها في صفحة المحل'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Staff() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const { data, loading, reload } = useLoad(() => api.get('/merchant/staff'), []);
  const branches = useLoad(() => api.get('/merchant/branches'), []);
  const [f, setF] = useState({ name: '', phone: '', branch_id: '' });
  if (loading && !data) return <Loader />;
  const add = (e) => { e.preventDefault(); run(async () => { await api.post('/merchant/staff', { ...f, branch_id: f.branch_id || branches.data?.[0]?.id }); setF({ name: '', phone: '', branch_id: '' }); reload(); }, 'أضفنا الموظف'); };
  const remove = (u) => { if (confirm(`تشيل ${u.name}؟`)) run(async () => { await api.del('/merchant/staff/' + u.id); reload(); }); };
  return (
    <>
      <form className="card row wrap" onSubmit={add} style={{ alignItems: 'flex-end' }}>
        <label className="field grow"><span>الاسم</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label className="field grow"><span>رقم الهاتف</span><input className="input ltr" placeholder="05XXXXXXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required /></label>
        <label className="field grow"><span>الفرع</span><select className="select" value={f.branch_id} onChange={(e) => setF({ ...f, branch_id: e.target.value })}>{(branches.data || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <button className="btn btn-orange" disabled={busy}>إضافة موظف</button>
      </form>
      <p className="small muted">الموظف يدخل تطبيق الفرع (<span className="ltr">/branch</span>) برقم هاتفه ويشوف طلبات فرعه بس.</p>
      <div className="table-wrap"><table className="t"><thead><tr><th>الاسم</th><th>الهاتف</th><th>الفرع</th><th /></tr></thead>
        <tbody>{data.map((u) => <tr key={u.id}><td className="semi">{u.name}</td><td className="ltr">{u.phone}</td><td>{u.branch_name}</td><td><button className="btn btn-sm btn-danger" onClick={() => remove(u)}>إزالة</button></td></tr>)}</tbody></table>
        {!data.length && <Empty icon="users" title="ما فيه موظفين" />}
      </div>
    </>
  );
}

function Settlement() {
  const { api } = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const { data, loading } = useLoad(() => api.get(`/merchant/settlement?from=${from}&to=${to}`), [from, to]);
  return (
    <>
      <div className="row wrap">
        <label className="field"><span>من</span><input className="input ltr" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field"><span>إلى</span><input className="input ltr" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {loading || !data ? <Loader /> : (
        <div className="kpis">
          <div className="kpi"><span className="muted small">طلبات مسلّمة</span><b>{data.orders}</b></div>
          <div className="kpi"><span className="muted small">إجمالي المبيعات</span><b>{aed(data.gross)}</b></div>
          <div className="kpi"><span className="muted small">عمولة Around ({data.commission_pct}%)</span><b>{aed(data.commission)}</b></div>
          <div className="kpi" style={{ background: 'var(--green)', color: 'var(--sand)' }}><span className="small" style={{ opacity: .85 }}>صافي مستحق لك</span><b>{aed(data.net)}</b><span className="xs" style={{ opacity: .85 }}>{dateShort(data.from)} إلى {dateShort(data.to)}</span></div>
        </div>
      )}
      <p className="small muted">التحويل لحسابك البنكي أسبوعياً بعد خصم العمولة. قيمة الهدايا ومكافآت الولاء محسوبة في الإجمالي.</p>
    </>
  );
}

function Profile() {
  const { api } = useSession();
  const [run, busy] = useAction();
  const toast = useToast();
  const { data, loading, reload } = useLoad(() => api.get('/merchant/profile'), []);
  const [f, setF] = useState(null);
  if (loading || !data) return <Loader />;
  const v = f || { name: data.name, color: data.color, tags: data.tags.join('، ') };
  const save = (e) => { e.preventDefault(); run(async () => { await api.patch('/merchant/profile', { ...v, tags: v.tags.split(/[،,]/).map((x) => x.trim()).filter(Boolean) }); reload(); }, 'حفظنا التعديلات'); };
  const upload = (field) => (e) => { const file = e.target.files?.[0]; if (!file) return; const fd = new FormData(); fd.append('image', file); run(async () => { await api.post('/merchant/profile/' + field, fd); reload(); toast('رفعنا الصورة', 'success'); }); };
  return (
    <form className="card col gap-14" style={{ maxWidth: 620 }} onSubmit={save}>
      <div className="row"><StoreLogo store={data} size={72} radius={18} /><div className="col gap-6">
        <label className="btn btn-sm btn-light">تغيير الشعار<input type="file" accept="image/*" hidden onChange={upload('logo')} /></label>
        <label className="btn btn-sm btn-light">صورة الغلاف<input type="file" accept="image/*" hidden onChange={upload('cover')} /></label></div></div>
      <label className="field"><span>اسم المحل</span><input className="input" value={v.name} onChange={(e) => setF({ ...v, name: e.target.value })} required /></label>
      <label className="field"><span>التصنيفات (افصل بفاصلة)</span><input className="input" value={v.tags} onChange={(e) => setF({ ...v, tags: e.target.value })} /></label>
      <label className="field"><span>لون المحل</span><input type="color" value={v.color} onChange={(e) => setF({ ...v, color: e.target.value })} style={{ width: 80, height: 44, border: 0, background: 'none' }} /></label>
      <span className="small muted">الحالة: {data.status === 'active' ? 'معتمد' : data.status === 'pending' ? 'بانتظار اعتماد Around' : 'موقوف'} · العمولة {data.commission_pct}%</span>
      <button className="btn btn-orange" disabled={busy}>حفظ</button>
    </form>
  );
}

function Shell() {
  const { me, ready, signOut, api } = useSession();
  const profile = useLoad(() => (me && me.role === 'merchant' ? api.get('/merchant/profile') : Promise.resolve(null)), [me && me.id]);
  if (!ready) return <Loader />;
  if (!me || me.role !== 'merchant') return <Login dark />;
  const title = (p) => (NAV.find((n) => n[0] === p) || NAV[0])[2];
  const page = (p, el) => <><div className="console-head"><h1>{title(p)}</h1></div>{el}</>;
  return (
    <div className="console">
      <nav className="side" aria-label="أقسام اللوحة">
        <div className="brand"><Logo size={30} ink="#FFFFFF" /><div className="col" style={{ gap: 0 }}><b style={{ fontSize: 17 }}>Around للتجار</b><span className="xs" style={{ opacity: .8 }}>{profile.data?.name}</span></div></div>
        {NAV.map(([p, icon, label]) => <NavLink key={p} to={'/merchant' + (p ? '/' + p : '')} end={!p} className={({ isActive }) => (isActive ? 'active' : '')}><Icon name={icon} size={20} />{label}</NavLink>)}
        <button className="nav" onClick={signOut} style={{ marginTop: 'auto' }}><Icon name="logout" size={20} />خروج</button>
      </nav>
      <main className="console-main">
        {profile.data?.status === 'pending' && <div className="card row" style={{ background: 'var(--orange-soft)' }}><Icon name="clock" color="var(--orange-ink)" /><span className="semi">محلك بانتظار اعتماد فريق Around. جهّز المنيو والفروع، وبنفعّل المحل بعد المراجعة.</span></div>}
        {profile.data?.status === 'suspended' && <div className="card row" style={{ background: 'var(--danger-soft)' }}><Icon name="flag" color="var(--danger)" /><span className="semi">المحل موقوف مؤقتاً. تواصل مع فريق Around.</span></div>}
        <Routes>
          <Route index element={page('', <Overview />)} />
          <Route path="orders" element={page('orders', <Orders />)} />
          <Route path="menu" element={page('menu', <Menu />)} />
          <Route path="branches" element={page('branches', <Branches />)} />
          <Route path="loyalty" element={page('loyalty', <LoyaltySettings />)} />
          <Route path="stories" element={page('stories', <Stories />)} />
          <Route path="staff" element={page('staff', <Staff />)} />
          <Route path="settlement" element={page('settlement', <Settlement />)} />
          <Route path="profile" element={page('profile', <Profile />)} />
          <Route path="*" element={<Navigate to="/merchant" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function MerchantApp() {
  return <SessionProvider area="merchant"><Shell /></SessionProvider>;
}
