// Shared pieces of the customer app.
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../ui/Icon';
import { StoreLogo, Avatar, useAction } from '../../ui/kit';
import { aed, km, ago, unitOf, dateShort } from '../../lib/format';
import { useSession } from '../../lib/session';
import { useCart } from '../../lib/cart';

export function StoreMeta({ branch, showDistance = true }) {
  if (!branch) return null;
  return (
    <div className="store-meta">
      <span className={branch.open ? 'open-txt' : 'closed-txt'}>{branch.hours_label}</span>
      <span className="prep-txt"><Icon name="prep" size={15} /> تحضير {branch.prep_minutes} د</span>
      {showDistance && branch.distance_m != null && <span className="row gap-4"><Icon name="pin" size={14} /> {km(branch.distance_m)}</span>}
    </div>
  );
}

export function StoreRow({ store, onFav }) {
  const { api } = useSession();
  const [run] = useAction();
  const toggle = (e) => {
    e.preventDefault();
    run(async () => { const r = await api.post(`/stores/${store.id}/favorite`); onFav && onFav(store.id, r.favorite); });
  };
  return (
    <Link to={`/app/store/${store.id}`} className="store-row card-press">
      <StoreLogo store={store} size={72} radius={16} />
      <div className="grow col gap-4">
        <div className="row-between">
          <span className="bold ellipsis" style={{ fontSize: 16 }}>{store.name}{store.branch && store.branches_count > 1 ? ` · ${store.branch.name}` : ''}</span>
          <button className="icon-btn plain" style={{ width: 36, height: 36, color: store.favorite ? '#D93A5B' : 'var(--muted)' }} onClick={toggle} aria-label={store.favorite ? 'إزالة من المفضلة' : 'أضف للمفضلة'}>
            <Icon name="heart" size={22} fill={store.favorite ? '#D93A5B' : 'none'} />
          </button>
        </div>
        <StoreMeta branch={store.branch} />
        {store.tags?.length > 0 && <div className="row gap-6 wrap">{store.tags.slice(0, 3).map((t) => <span key={t} className="tag">{t}</span>)}</div>}
      </div>
    </Link>
  );
}

export function StoryBubble({ to, image, name, seen, plus, avatarUser }) {
  return (
    <Link to={to} className="col" style={{ alignItems: 'center', gap: 6, width: 78, flex: 'none' }}>
      <span className={'ring' + (seen ? ' seen' : '')} style={plus ? { borderStyle: 'dashed', borderColor: 'var(--green)' } : undefined}>
        <span style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sand-2)', position: 'relative' }}>
          {image ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : avatarUser ? <Avatar user={avatarUser} size={64} /> : null}
          {plus && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: image ? 'rgba(15,76,58,.55)' : 'transparent', color: image ? '#fff' : 'var(--green)' }}><Icon name="camera" size={26} /></span>}
        </span>
      </span>
      <span className="xs semi ellipsis" style={{ maxWidth: 78 }}>{name}</span>
    </Link>
  );
}

export function LoyaltyMini({ card }) {
  const p = card.program;
  const pct = Math.min(100, Math.round((card.balance / p.goal) * 100));
  return (
    <Link to={`/app/store/${card.merchant.id}`} className="card card-press col" style={{ width: 260, flex: 'none', gap: 10 }}>
      <div className="row">
        <StoreLogo store={card.merchant} size={40} radius={10} />
        <div className="grow"><div className="bold ellipsis">{card.merchant.name}</div><div className="xs muted ellipsis">{p.reward_text}</div></div>
        <b className="green">{card.balance}/{p.goal}</b>
      </div>
      {p.type === 'stamps' && p.goal <= 10
        ? <div className="stamps" style={{ gridTemplateColumns: `repeat(${p.goal}, 1fr)` }}>{Array.from({ length: p.goal }, (_, i) => <span key={i} className={i < card.balance ? 'on' : ''} />)}</div>
        : <div className="bar"><span style={{ width: pct + '%' }} /></div>}
      <div className="row-between xs">
        {card.can_redeem ? <span className="pill green">المكافأة جاهزة</span> : <span className="muted">باقي {p.goal - card.balance} {unitOf(p)}</span>}
        {card.expires_at && <span className="danger semi">تنتهي {dateShort(card.expires_at)}</span>}
      </div>
    </Link>
  );
}

// Social post card (feed).
export function PostCard({ post, onChange }) {
  const { api } = useSession();
  const [run] = useAction();
  const nav = useNavigate();
  const cart = useCart();
  const like = () => run(async () => { const r = await api.post(`/social/posts/${post.id}/like`); onChange({ ...post, liked: r.liked, likes: r.likes }); });
  const save = () => run(async () => { const r = await api.post(`/social/posts/${post.id}/save`); onChange({ ...post, saved: r.saved }); });
  const share = async () => {
    const url = location.origin + `/app/social/post/${post.id}`;
    if (navigator.share) navigator.share({ title: 'Around', text: post.caption, url }).catch(() => {});
    else { await navigator.clipboard?.writeText(url); }
  };
  const reorder = () => {
    if (!post.merchant) return;
    run(async () => {
      const s = await api.get(`/stores/${post.merchant.id}`);
      const lines = post.items.map((i) => {
        const it = s.menu.flatMap((c) => c.items).find((x) => x.id === i.item_id && x.is_available);
        return it ? { item_id: it.id, name: it.name, price: it.price, qty: i.qty } : null;
      }).filter(Boolean);
      if (!lines.length) throw new Error('المنتجات غير متوفرة الحين');
      cart.load(s, s.branch.id, lines, post.id);
      nav('/app/checkout');
    });
  };
  return (
    <article className="post">
      <div className="row" style={{ padding: '12px 16px' }}>
        <Link to={`/app/social/user/${post.user.id}`} className="row grow">
          <Avatar user={post.user} size={40} />
          <div className="grow"><div className="bold">{post.user.username || post.user.name}</div><div className="xs muted">{ago(post.created_at)}</div></div>
        </Link>
      </div>
      <Link to={`/app/social/post/${post.id}`}><img className="post-img" src={post.image} alt={post.caption || 'صورة طلب'} loading="lazy" /></Link>
      <div className="post-actions">
        <button onClick={like} className={post.liked ? 'liked' : ''} aria-label="إعجاب"><Icon name="heart" fill={post.liked ? '#D93A5B' : 'none'} size={24} />{post.likes}</button>
        <Link to={`/app/social/post/${post.id}`} className="row gap-6 semi" aria-label="التعليقات"><Icon name="comment" size={24} />{post.comments}</Link>
        <button onClick={share} aria-label="مشاركة"><Icon name="share" size={23} /></button>
        <button onClick={save} style={{ marginInlineStart: 'auto' }} aria-label="حفظ"><Icon name="bookmark" size={23} fill={post.saved ? 'currentColor' : 'none'} /></button>
      </div>
      {post.caption && <p style={{ padding: '2px 16px 8px' }}><b>{post.user.username || post.user.name}</b> {post.caption}</p>}
      {post.merchant && (
        <div className="order-tag">
          <StoreLogo store={post.merchant} size={40} radius={10} />
          <div className="grow">
            <div className="bold small ellipsis">{post.merchant.name}</div>
            <div className="xs muted ellipsis">{post.items.map((i) => `${i.qty} × ${i.name}`).join('، ')}</div>
          </div>
          {!post.mine && post.items.length > 0 && <button className="btn btn-orange btn-sm" onClick={reorder}>اطلب نفسه</button>}
        </div>
      )}
    </article>
  );
}

export const money = aed;
