import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useLoad, usePosition, posQuery } from '../../lib/hooks';
import Icon from '../../ui/Icon';
import { Loader, Empty, Avatar, catIcon } from '../../ui/kit';
import { StoreRow } from './parts';
import { km } from '../../lib/format';

// Discover stores (search, categories, map) + trending Around Social posts.
export default function Explore() {
  const { api } = useSession();
  const pos = usePosition();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const category = params.get('category') || '';
  const showMap = params.get('map') === '1';
  const input = useRef(null);

  useEffect(() => { if (params.get('focus')) input.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 250); return () => clearTimeout(t); }, [q]);

  const cats = useLoad(() => api.get('/categories'), []);
  const stores = useLoad(() => api.get(`/stores?${posQuery(pos)}&category=${category}&q=${encodeURIComponent(debounced)}`), [category, debounced, pos && pos.lat]);
  const trending = useLoad(() => api.get('/social/trending'), []);
  const users = useLoad(() => (debounced.length >= 2 ? api.get('/social/search?q=' + encodeURIComponent(debounced)) : Promise.resolve([])), [debounced]);

  const setCat = (c) => { const p = new URLSearchParams(params); if (c && c !== category) p.set('category', c); else p.delete('category'); p.delete('focus'); setParams(p, { replace: true }); };
  const toggleMap = () => { const p = new URLSearchParams(params); if (showMap) p.delete('map'); else p.set('map', '1'); setParams(p, { replace: true }); };
  const onFav = (id, fav) => stores.setData((l) => l.map((s) => (s.id === id ? { ...s, favorite: fav } : s)));

  return (
    <>
      <header className="topbar col" style={{ alignItems: 'stretch', gap: 12 }}>
        <div className="row-between"><h1>اكسبلور</h1><button className={'chip' + (showMap ? ' on' : '')} onClick={toggleMap}><Icon name="map" size={18} /> الخريطة</button></div>
        <label className="input-group" style={{ minHeight: 46 }}>
          <Icon name="search" size={20} color="var(--muted)" />
          <input ref={input} placeholder="ابحث عن محل، منتج، أو شخص" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" />
          {q && <button className="icon-btn plain" style={{ width: 30, height: 30 }} onClick={() => setQ('')} aria-label="مسح"><Icon name="close" size={18} /></button>}
        </label>
      </header>
      <div className="stack">
        <div className="hscroll">
          {(cats.data || []).map((c) => (
            <button key={c.key} className={'chip' + (category === c.key ? ' on' : '')} onClick={() => setCat(c.key)}>
              <Icon name={catIcon(c.key)} size={18} color={category === c.key ? 'var(--sand)' : 'var(--green)'} />{c.name}
            </button>
          ))}
        </div>

        {showMap && stores.data && <StoreMap stores={stores.data} pos={pos} />}

        {(users.data || []).length > 0 && (
          <section className="pad col">
            <h2 className="bold">أشخاص</h2>
            {users.data.map((u) => (
              <Link key={u.id} to={`/app/social/user/${u.id}`} className="card card-press row"><Avatar user={u} /><div><b>{u.name}</b>{u.username && <div className="small muted ltr">@{u.username}</div>}</div></Link>
            ))}
          </section>
        )}

        <section className="pad col">
          <h2 className="bold">{debounced ? 'نتائج البحث' : category ? (cats.data || []).find((c) => c.key === category)?.name : 'كل المحلات'}</h2>
          {stores.loading && !stores.data ? <Loader /> : (stores.data || []).length ? stores.data.map((s) => <StoreRow key={s.id} store={s} onFav={onFav} />)
            : <Empty icon="search" title="ما لقينا محلات">جرّب كلمة ثانية أو تصنيف ثاني.</Empty>}
        </section>

        {!debounced && !category && (trending.data || []).length > 0 && (
          <section>
            <div className="section-head"><h2 className="section-title"><Icon name="crown" color="var(--green)" /> الأكثر تفاعلاً هالأسبوع</h2></div>
            <div className="grid3">
              {trending.data.map((p) => <Link key={p.id} to={`/app/social/post/${p.id}`}><img src={p.image} alt={p.caption} loading="lazy" /></Link>)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

// Lightweight map: projects store positions around the user (no external map SDK needed).
function StoreMap({ stores, pos }) {
  const center = pos || (stores[0] && stores[0].branch) || { lat: 24.2075, lng: 55.7447 };
  const pts = useMemo(() => stores.filter((s) => s.branch && s.branch.distance_m < 30000), [stores]);
  const maxD = Math.max(2000, ...pts.map((s) => s.branch.distance_m));
  const proj = (b) => {
    const dx = (b.lng - center.lng) * 101000 * Math.cos(center.lat * Math.PI / 180);
    const dy = (b.lat - center.lat) * 111000;
    const r = 44 / maxD;
    return { left: `${50 + dx * r}%`, top: `${50 - dy * r}%` };
  };
  return (
    <div className="pad">
      <div style={{ position: 'relative', height: 280, borderRadius: 20, overflow: 'hidden', background: 'var(--ground-2)' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
          <circle cx="50%" cy="50%" r="30%" fill="none" stroke="#fff" strokeWidth="14" opacity=".6" />
          <line x1="0" y1="62%" x2="100%" y2="40%" stroke="#fff" strokeWidth="16" />
          <line x1="35%" y1="0" x2="45%" y2="100%" stroke="#fff" strokeWidth="12" />
        </svg>
        <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 18, height: 18, borderRadius: 9, background: '#2F80ED', border: '3px solid #fff', boxShadow: '0 0 0 6px rgba(47,128,237,.25)' }} aria-label="موقعك" />
        {pts.map((s) => (
          <Link key={s.id} to={`/app/store/${s.id}`} style={{ position: 'absolute', ...proj(s.branch), transform: 'translate(-50%,-100%)' }} aria-label={s.name}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', borderRadius: 999, padding: '4px 10px 4px 4px', boxShadow: '0 2px 8px rgba(0,0,0,.15)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: s.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{s.name.charAt(0)}</span>
              {s.name.split(' ')[0]} · {km(s.branch.distance_m)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
