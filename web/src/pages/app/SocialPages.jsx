import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useLoad } from '../../lib/hooks';
import { ago } from '../../lib/format';
import Icon from '../../ui/Icon';
import { Avatar, Loader, ErrorBox, Empty, useAction, useToast } from '../../ui/kit';
import { PostCard } from './parts';
import { Back } from './Checkout';

export function UserProfile() {
  const { id } = useParams();
  const { api } = useSession();
  const [run, busy] = useAction();
  const [tab, setTab] = useState('posts');
  const { data: u, error, loading, reload, setData } = useLoad(() => api.get(`/social/users/${id}`), [id]);
  if (loading && !u) return <><Back /><Loader /></>;
  if (error && !u) return <><Back /><ErrorBox error={error} onRetry={reload} /></>;
  const follow = () => run(async () => {
    const r = await api.post(`/social/users/${u.id}/follow`);
    setData({ ...u, is_following: r.following, followers: u.followers + (r.following ? 1 : -1) });
  });
  const list = tab === 'saved' ? u.saved : u.posts;
  return (
    <>
      <Back title={u.username ? '@' + u.username : u.name}>{u.mine && <Link to="/app/profile" className="icon-btn" aria-label="تعديل"><Icon name="edit" /></Link>}</Back>
      <div className="pad col center" style={{ alignItems: 'center', gap: 10, paddingBottom: 16 }}>
        <Avatar user={u} size={92} />
        <h2 style={{ fontSize: 22 }}>{u.name}</h2>
        <div className="row" style={{ gap: 28 }}>
          <div className="col gap-4" style={{ alignItems: 'center' }}><b style={{ fontSize: 18 }}>{u.posts.length}</b><span className="small muted">منشور</span></div>
          <div className="col gap-4" style={{ alignItems: 'center' }}><b style={{ fontSize: 18 }}>{u.followers}</b><span className="small muted">متابِع</span></div>
          <div className="col gap-4" style={{ alignItems: 'center' }}><b style={{ fontSize: 18 }}>{u.following}</b><span className="small muted">يتابع</span></div>
        </div>
        {!u.mine && <button className={'btn ' + (u.is_following ? 'btn-light' : 'btn-orange')} style={{ minWidth: 180 }} disabled={busy} onClick={follow}>{u.is_following ? 'تتابعه' : 'تابِع'}</button>}
        {u.mine && <Link to="/app/post" className="btn btn-orange" style={{ minWidth: 180 }}><Icon name="camera" /> منشور جديد</Link>}
      </div>
      {u.mine && (
        <div className="seg" style={{ margin: '0 20px 12px' }}>
          <button className={tab === 'posts' ? 'on' : ''} onClick={() => setTab('posts')}>منشوراتي</button>
          <button className={tab === 'saved' ? 'on' : ''} onClick={() => setTab('saved')}>المحفوظة</button>
        </div>
      )}
      {list.length ? (
        <div className="grid3">{list.map((p) => <Link key={p.id} to={`/app/social/post/${p.id}`}><img src={p.image} alt={p.caption} loading="lazy" /></Link>)}</div>
      ) : <Empty icon="camera" title={tab === 'saved' ? 'ما حفظت شي للحين' : 'ما فيه منشورات'} />}
    </>
  );
}

export function PostPage() {
  const { id } = useParams();
  const { api, me } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [run, busy] = useAction();
  const post = useLoad(() => api.get(`/social/posts/${id}`), [id]);
  const comments = useLoad(() => api.get(`/social/posts/${id}/comments`), [id]);
  const [body, setBody] = useState('');
  if (post.loading && !post.data) return <><Back /><Loader /></>;
  if (post.error && !post.data) return <><Back /><ErrorBox error={post.error} /></>;
  const p = post.data;
  const send = (e) => {
    e.preventDefault();
    run(async () => {
      const c = await api.post(`/social/posts/${id}/comments`, { body });
      comments.setData((l) => [...(l || []), { ...c, created_at: new Date().toISOString() }]);
      post.setData({ ...p, comments: p.comments + 1 }); setBody('');
    });
  };
  const report = () => run(async () => { await api.post(`/social/posts/${id}/report`, { reason: 'محتوى غير لائق' }); toast('شكراً، بنراجع البلاغ', 'success'); });
  const remove = () => { if (confirm('تحذف المنشور؟')) run(async () => { await api.del(`/social/posts/${id}`); nav(-1); }, 'انحذف المنشور'); };
  return (
    <div style={{ paddingBottom: 100 }}>
      <Back title="منشور">
        {p.mine ? <button className="icon-btn" onClick={remove} aria-label="حذف"><Icon name="trash" /></button>
          : <button className="icon-btn" onClick={report} aria-label="إبلاغ"><Icon name="flag" /></button>}
      </Back>
      <PostCard post={p} onChange={post.setData} />
      <section className="pad col mt-14">
        <h2 className="bold">التعليقات</h2>
        {(comments.data || []).map((c) => (
          <div key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
            <Link to={`/app/social/user/${c.user_id}`}><Avatar user={c} size={34} /></Link>
            <div className="grow"><span className="bold">{c.username || c.name}</span> {c.body}<div className="xs muted">{ago(c.created_at)}</div></div>
          </div>
        ))}
        {comments.data && !comments.data.length && <p className="muted small">كن أول من يعلّق</p>}
      </section>
      <form onSubmit={send} className="floating-bar row">
        <Avatar user={me} size={36} />
        <input className="input grow" placeholder="اكتب تعليق…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} aria-label="تعليق" />
        <button className="btn btn-sm" disabled={busy || !body.trim()}>نشر</button>
      </form>
    </div>
  );
}
