import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useLoad } from '../../lib/hooks';
import { aed, ago } from '../../lib/format';
import Icon from '../../ui/Icon';
import { Avatar, Loader, Empty, useAction } from '../../ui/kit';
import { Back } from './Checkout';

export function More() {
  const { me, signOut } = useSession();
  const nav = useNavigate();
  const items = [
    ['/app/loyalty', 'star', 'الولاء والعضوية', `العضوية ${me.tier?.name || ''}`],
    ['/app/gifts', 'gift', 'الهدايا', `رصيدك ${aed(me.gift_balance)}`],
    ['/app/cars', 'car', 'سياراتي', 'عشان الفرع يعرفك'],
    ['/app/orders', 'orders', 'طلباتي', ''],
    [`/app/social/user/${me.id}`, 'crown', 'ملفي في Around Social', `${me.posts} منشور · ${me.followers} متابِع`],
    ['/app/notifications', 'bell', 'الإشعارات', me.unread_notifications ? `${me.unread_notifications} جديدة` : ''],
    ['/app/profile', 'user', 'تعديل الملف', '']
  ];
  return (
    <>
      <header className="topbar"><h1>المزيد</h1></header>
      <div className="pad col gap-14">
        <div className="card row">
          <Avatar user={me} size={56} />
          <div className="grow"><b style={{ fontSize: 18 }}>{me.name}</b><div className="small muted"><span className="ltr">{me.phone}</span>{me.username ? <> · <span className="ltr">@{me.username}</span></> : null}</div></div>
          <span className={'pill ' + (me.tier?.key === 'gold' || me.tier?.key === 'platinum' ? 'orange' : 'green')}>{me.tier?.name}</span>
        </div>
        <div className="card col" style={{ padding: 6 }}>
          {items.map(([to, icon, label, sub]) => (
            <Link key={to} to={to} className="row" style={{ padding: '12px 10px', borderRadius: 12 }}>
              <span className="thumb" style={{ width: 40, height: 40, background: 'var(--green-soft)', color: 'var(--green)' }}><Icon name={icon} /></span>
              <div className="grow"><div className="semi">{label}</div>{sub && <div className="xs muted">{sub}</div>}</div>
              <Icon name="back" size={18} style={{ transform: 'scaleX(-1)', color: 'var(--muted)' }} />
            </Link>
          ))}
        </div>
        <Link to="/join" className="card row" style={{ background: 'var(--sand-2)' }}><Icon name="store" color="var(--green)" /><span className="grow semi">عندك محل؟ انضم لـ Around</span></Link>
        <button className="btn btn-light btn-block" onClick={() => { signOut(); nav('/app'); }}><Icon name="logout" /> تسجيل خروج</button>
        <p className="center xs muted">Around · الإصدار 1.0</p>
      </div>
    </>
  );
}

const EMIRATES = ['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'أم القيوين', 'رأس الخيمة', 'الفجيرة'];
export function CarForm({ onSaved }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const [f, setF] = useState({ make: '', color: '', plate_emirate: 'أبوظبي', plate_code: '', plate_number: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = (e) => { e.preventDefault(); run(async () => onSaved(await api.post('/auth/cars', f)), 'أضفنا سيارتك'); };
  return (
    <form className="col gap-14" onSubmit={save}>
      <h2 style={{ fontSize: 20 }}>إضافة سيارة</h2>
      <div className="row">
        <label className="field grow"><span>النوع</span><input className="input" placeholder="تويوتا لاندكروزر" value={f.make} onChange={set('make')} required /></label>
        <label className="field" style={{ width: 120 }}><span>اللون</span><input className="input" placeholder="أبيض" value={f.color} onChange={set('color')} required /></label>
      </div>
      <div className="row">
        <label className="field grow"><span>الإمارة</span><select className="select" value={f.plate_emirate} onChange={set('plate_emirate')}>{EMIRATES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="field" style={{ width: 80 }}><span>الرمز</span><input className="input ltr" value={f.plate_code} onChange={set('plate_code')} maxLength={3} /></label>
        <label className="field" style={{ width: 110 }}><span>الرقم</span><input className="input ltr" inputMode="numeric" value={f.plate_number} onChange={(e) => setF({ ...f, plate_number: e.target.value.replace(/\D/g, '').slice(0, 5) })} required /></label>
      </div>
      <button className="btn btn-orange btn-block" disabled={busy}>حفظ السيارة</button>
    </form>
  );
}

export function Cars() {
  const { api } = useSession();
  const [run] = useAction();
  const { data, loading, setData } = useLoad(() => api.get('/auth/cars'), []);
  const [adding, setAdding] = useState(false);
  const del = (id) => run(async () => { await api.del('/auth/cars/' + id); setData((l) => l.filter((c) => c.id !== id)); });
  return (
    <>
      <Back title="سياراتي" />
      <div className="pad col gap-14">
        {loading ? <Loader /> : (data || []).map((c) => (
          <div key={c.id} className="card row">
            <Icon name="car" color="var(--green)" size={28} />
            <div className="grow"><div className="semi">{c.label}</div><span className="plate small">{c.plate}</span></div>
            <button className="icon-btn plain" onClick={() => del(c.id)} aria-label="حذف"><Icon name="trash" color="var(--danger)" /></button>
          </div>
        ))}
        {data && !data.length && !adding && <Empty icon="car" title="ما أضفت سيارة للحين" />}
        {adding ? <div className="card"><CarForm onSaved={(c) => { setData((l) => [...l, c]); setAdding(false); }} /></div>
          : <button className="btn btn-orange btn-block" onClick={() => setAdding(true)}><Icon name="plus" /> إضافة سيارة</button>}
      </div>
    </>
  );
}

export function Notifications() {
  const { api, refresh } = useSession();
  const { data, loading } = useLoad(async () => { const r = await api.get('/auth/notifications'); refresh(); return r; }, []);
  return (
    <>
      <Back title="الإشعارات" />
      <div className="pad col">
        {loading ? <Loader /> : !(data || []).length ? <Empty icon="bell" title="ما فيه إشعارات" /> : data.map((n) => (
          <Link key={n.id} to={n.link || '#'} className="card row" style={{ alignItems: 'flex-start', opacity: n.is_read ? 0.8 : 1 }}>
            <span className="thumb" style={{ width: 40, height: 40, background: 'var(--green-soft)', color: 'var(--green)' }}><Icon name="bell" /></span>
            <div className="grow"><div className="semi">{n.title}</div>{n.body && <div className="small muted">{n.body}</div>}<div className="xs muted">{ago(n.created_at)}</div></div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function EditProfile() {
  const { api, me, refresh } = useSession();
  const nav = useNavigate();
  const [run, busy] = useAction();
  const [name, setName] = useState(me.name || '');
  const [username, setUsername] = useState(me.username || '');
  const save = (e) => { e.preventDefault(); run(async () => { await api.patch('/auth/me', { name, username: username || null }); await refresh(); nav(-1); }, 'حفظنا التعديلات'); };
  const avatar = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append('image', f);
    run(async () => { await api.post('/auth/me/avatar', fd); await refresh(); }, 'تغيّرت صورتك');
  };
  return (
    <>
      <Back title="تعديل الملف" />
      <form className="pad col gap-14" onSubmit={save}>
        <label className="col center" style={{ alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Avatar user={me} size={96} /><span className="semi green small">تغيير الصورة</span>
          <input type="file" accept="image/*" hidden onChange={avatar} />
        </label>
        <label className="field"><span>الاسم</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} /></label>
        <label className="field"><span>اسم المستخدم</span>
          <div className="input-group"><span className="ltr muted">@</span><input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} maxLength={20} aria-label="اسم المستخدم" /></div>
        </label>
        <button className="btn btn-orange btn-block" disabled={busy}>حفظ</button>
      </form>
    </>
  );
}
