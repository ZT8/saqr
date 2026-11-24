import { useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SessionProvider, useSession } from '../../lib/session';
import { CartProvider } from '../../lib/cart';
import { useSocketEvent } from '../../lib/hooks';
import { useToast, Loader } from '../../ui/kit';
import Icon from '../../ui/Icon';
import Login from '../Login';
import Home from './Home';
import Store from './Store';
import Checkout from './Checkout';
import OrderPage from './Order';
import Orders from './Orders';
import Social from './Social';
import Explore from './Explore';
import PostComposer from './PostComposer';
import StoryViewer from './StoryViewer';
import { UserProfile, PostPage } from './SocialPages';
import { Gifts, SendGift, GiftView } from './Gifts';
import Loyalty from './Loyalty';
import { More, Cars, Notifications, EditProfile } from './More';

const TABS = [
  { to: '/app', icon: 'home', label: 'الرئيسية', end: true },
  { to: '/app/orders', icon: 'orders', label: 'طلباتي' },
  { to: '/app/explore', icon: 'explore', label: 'اكسبلور' },
  { to: '/app/social', icon: 'social', label: 'سوشال' },
  { to: '/app/more', icon: 'more', label: 'المزيد' }
];

function Shell() {
  const { me, ready, socket } = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => { document.body.classList.add('app-body'); return () => document.body.classList.remove('app-body'); }, []);
  useSocketEvent(socket, 'notification', (n) => toast(n.title, 'success'));
  useSocketEvent(socket, 'order:update', (o) => {
    if (o.status === 'ready' && !loc.pathname.includes('/orders/' + o.id)) toast(`طلبك رقم ${o.id} جاهز`, 'success');
  });

  if (!ready) return <Loader />;
  if (!me || !me.name) return <div className="app"><Login onDone={() => nav('/app')} /></div>;
  const fullScreen = /\/app\/(post|stories)/.test(loc.pathname);
  const showTabs = !fullScreen && TABS.some((t) => (t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to))) && !/\/orders\/\d+/.test(loc.pathname);

  return (
    <div className={'app' + (showTabs ? ' with-tabs' : '')}>
      <main className={showTabs ? 'app-main' : ''}>
        <div key={loc.pathname} className="page-in">
        <Routes>
          <Route index element={<Home />} />
          <Route path="store/:id" element={<Store />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderPage />} />
          <Route path="explore" element={<Explore />} />
          <Route path="social" element={<Social />} />
          <Route path="social/user/:id" element={<UserProfile />} />
          <Route path="social/post/:id" element={<PostPage />} />
          <Route path="stories/:userId" element={<StoryViewer />} />
          <Route path="post" element={<PostComposer />} />
          <Route path="gifts" element={<Gifts />} />
          <Route path="gifts/send" element={<SendGift />} />
          <Route path="gifts/:id" element={<GiftView />} />
          <Route path="loyalty" element={<Loyalty />} />
          <Route path="more" element={<More />} />
          <Route path="cars" element={<Cars />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<EditProfile />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
        </div>
      </main>
      {showTabs && (
        <nav className="tabbar" aria-label="القائمة الرئيسية">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {({ isActive }) => (<><Icon name={t.icon} size={24} weight={isActive ? 'fill' : 'regular'} />{t.label}</>)}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

export default function CustomerApp() {
  return (
    <SessionProvider area="app">
      <CartProvider><Shell /></CartProvider>
    </SessionProvider>
  );
}
