import { useSession } from '../../lib/session';
import { useLoad } from '../../lib/hooks';
import { dateShort } from '../../lib/format';
import { Logo } from '../../ui/Icon';
import { Loader, Empty } from '../../ui/kit';
import { LoyaltyMini } from './parts';
import { Back } from './Checkout';

export default function Loyalty() {
  const { api } = useSession();
  const { data, loading } = useLoad(() => api.get('/loyalty'), []);
  if (loading || !data) return <><Back title="الولاء" /><Loader /></>;
  const t = data.tier;
  const dark = t.key === 'bronze' || t.key === 'platinum';
  return (
    <>
      <Back title="الولاء" />
      <div className="pad col gap-18" style={{ paddingBottom: 30 }}>
        <div className={'tier-card tier-' + t.key}>
          <div className="row-between">
            <div><div className="small semi" style={{ opacity: .85 }}>عضوية Around</div><div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>العضوية {t.name}</div></div>
            <Logo size={40} ink={dark ? '#FFFFFF' : '#0B1410'} />
          </div>
          <div className="col gap-6">
            <div className="bar"><span style={{ width: t.progress + '%' }} /></div>
            <span className="small semi">{t.next ? `باقي ${t.next.remaining} ${t.next.remaining === 1 ? 'طلب' : 'طلبات'} على العضوية ${t.next.name}` : 'أعلى عضوية في Around'}</span>
          </div>
          <div className="row-between xs semi" style={{ opacity: .9 }}><span>سارية حتى {dateShort(t.valid_until)}</span><span>{t.orders} طلب هالسنة</span></div>
        </div>
        <p className="small muted">المستوى يتحدد حسب عدد طلباتك خلال السنة. كل محل له برنامج نقاط خاص فيه، والمكافآت يحددها المحل نفسه.</p>
        <h2 className="bold">نقاطك عند المحلات</h2>
        {data.cards.length ? <div className="col">{data.cards.map((c) => <div key={c.merchant.id} style={{ display: 'flex' }}><LoyaltyMini card={c} /></div>)}</div>
          : <Empty icon="star" title="ما عندك نقاط للحين">اطلب من المحلات اللي عندها برنامج ولاء وتبدأ تجمع.</Empty>}
      </div>
    </>
  );
}
