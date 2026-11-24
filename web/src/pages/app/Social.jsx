import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../lib/session';
import Icon from '../../ui/Icon';
import { Loader, Empty, Avatar, useAction } from '../../ui/kit';
import { PostCard, StoryBubble } from './parts';
import { useLoad } from '../../lib/hooks';

export default function Social() {
  const { api, me } = useSession();
  const [tab, setTab] = useState('foryou');
  const [posts, setPosts] = useState(null);
  const [next, setNext] = useState(null);
  const [run, busy] = useAction();
  const home = useLoad(() => api.get('/home'), []);

  useEffect(() => {
    setPosts(null);
    run(async () => { const r = await api.get('/social/feed?tab=' + tab); setPosts(r.posts); setNext(r.next); });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const more = () => run(async () => { const r = await api.get(`/social/feed?tab=${tab}&offset=${next}`); setPosts((p) => [...p, ...r.posts]); setNext(r.next); });
  const update = (np) => setPosts((list) => list.map((p) => (p.id === np.id ? np : p)));

  return (
    <>
      <header className="topbar col" style={{ alignItems: 'stretch', gap: 10, paddingBottom: 0 }}>
        <div className="row-between">
          <h1>Around Social</h1>
          <div className="row gap-4">
            <Link to="/app/notifications" className="icon-btn plain" aria-label="الإشعارات"><Icon name="bell" /></Link>
            <Link to={`/app/social/user/${me.id}`} aria-label="ملفي"><Avatar user={me} size={38} /></Link>
          </div>
        </div>
        <div className="row" role="tablist" style={{ borderBottom: '1px solid var(--line)' }}>
          {[['following', 'أتابعهم'], ['foryou', 'لك']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              style={{ flex: 1, border: 0, background: 'none', padding: '10px 0 12px', fontWeight: 700, fontSize: 16, color: tab === k ? 'var(--green)' : 'var(--muted)', borderBottom: tab === k ? '3px solid var(--green)' : '3px solid transparent' }}>{l}</button>
          ))}
        </div>
      </header>

      {home.data && (
        <div className="hscroll" style={{ padding: '14px 20px 10px', background: 'var(--white)' }}>
          <StoryBubble to="/app/post" name="منشور جديد" plus avatarUser={me} image={me.avatar} />
          {home.data.stories.map((s) => <StoryBubble key={s.user_id} to={`/app/stories/${s.user_id}`} image={s.cover} name={s.username || s.name} seen={!s.unseen} />)}
        </div>
      )}

      {!posts ? <Loader /> : !posts.length ? (
        <Empty icon="crown" title={tab === 'following' ? 'تابع ناس عشان تشوف طلباتهم' : 'ما فيه منشورات للحين'} action={<Link to="/app/post" className="btn btn-orange"><Icon name="camera" /> صوّر طلبك</Link>} />
      ) : (
        <div style={{ marginTop: 10 }}>
          {posts.map((p) => <PostCard key={p.id} post={p} onChange={update} />)}
          {next && <div className="pad mt-14"><button className="btn btn-light btn-block" disabled={busy} onClick={more}>عرض المزيد</button></div>}
        </div>
      )}
    </>
  );
}
