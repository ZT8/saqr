import { useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { api } from '../../lib/api';
import Icon, { Wordmark } from '../../ui/Icon';
import { useAction } from '../../ui/kit';
import './site.css';

function Nav({ dark }) {
  return (
    <nav className={'s-nav' + (dark ? ' dark' : '')}>
      <Link to="/" aria-label="Around"><Wordmark size={26} /></Link>
      <div className="row">
        <Link to="/join" className="btn btn-sm btn-orange">انضم كتاجر <Icon name="arrow" size={18} /></Link>
      </div>
    </nav>
  );
}

// The one live thing: the product's real arrival maths (ETA = metres / 500 per minute, arrival confirmed at 80 m).
function Radius() {
  const [m, setM] = useState(1800);
  const eta = Math.max(1, Math.round(m / 500));
  const here = m <= 80;
  const steps = ['تم الدفع', 'قيد التحضير', 'جاهز', 'تم التسليم'];
  const now = here ? 3 : m < 400 ? 2 : 1;
  return (
    <div className="radius" aria-live="polite">
      <div className="radius-fig" aria-hidden="true">
        <svg viewBox="0 0 320 320">
          {[150, 108, 66].map((r) => <circle key={r} cx="160" cy="160" r={r} fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="2" />)}
          <circle cx="160" cy="160" r="30" fill="var(--deep)" />
        </svg>
        <span className="radius-store"><Icon name="coffee" size={26} color="#fff" /></span>
        <span className="radius-car" style={{ '--d': Math.min(1, m / 6000) }}><Icon name="car" size={24} weight="fill" /></span>
      </div>
      <div className="radius-info">
        <div className="radius-eta"><b>{here ? 'وصلت' : eta}</b>{!here && <span>{eta === 1 ? 'دقيقة' : eta === 2 ? 'دقيقتين' : eta <= 10 ? 'دقائق' : 'دقيقة'}</span>}</div>
        <div className="steps" style={{ width: '100%' }}>
          {steps.map((s, i) => <div key={s} className={i < now ? 'done' : i === now ? 'now' : ''}>{s}</div>)}
        </div>
        <label className="radius-range">
          <span className="small">بعدك عن الفرع: <b className="ltr">{m >= 1000 ? (m / 1000).toFixed(1) + ' كم' : m + ' م'}</b></span>
          <input type="range" min="40" max="6000" step="20" value={m} onChange={(e) => setM(Number(e.target.value))} aria-label="بعدك عن الفرع" />
        </label>
      </div>
    </div>
  );
}

// Static preview of the app (no live app, no sign-in on the website).
function PhoneMock() {
  return (
    <div className="phone-frame" role="img" aria-label="شكل تتبع الطلب في تطبيق Around">
      <div className="pm">
        <div className="row-between"><Wordmark size={20} ink="#0B1410" /><span className="avatar" style={{ width: 30, height: 30, '--h': 150 }}><Icon name="user" size={16} weight="fill" /></span></div>
        <div className="pm-card pm-dark">
          <span className="small">طلب رقم 24 · سدرة كافيه</span>
          <b className="pm-eta">٣ دقايق</b>
          <div className="pm-steps"><i className="on" /><i className="on" /><i className="on" /><i /></div>
          <span className="small">جاهز بعد وصولك</span>
        </div>
        <div className="pm-card"><div className="row"><Icon name="car" size={22} /><b>سيارتك: أبيض · 12345</b></div></div>
        <div className="pm-card row-between"><div className="row"><Icon name="coffee" size={22} weight="duotone" /><b>لاتيه × 2</b></div><span className="ltr small">28.00 د.إ</span></div>
        <div className="pm-card row-between"><div className="row"><Icon name="bakery" size={22} weight="duotone" /><b>كرواسون × 1</b></div><span className="ltr small">12.00 د.إ</span></div>
        <div className="pm-card row-between"><b>المجموع</b><b className="ltr">40.00 د.إ</b></div>
        <div className="pm-btn">أنا وصلت</div>
      </div>
    </div>
  );
}


const STEP_NAMES = ['اطلب', 'سوق', 'استلم'];
function StepPill({ at }) {
  return (
    <div className="pm-pill" aria-hidden="true">
      {STEP_NAMES.map((n, i) => (
        <span key={n} className={i < at ? 'done' : i === at ? 'now' : ''}>{i < at ? <Icon name="check" size={13} /> : <i />}{n}</span>
      ))}
    </div>
  );
}

function MockOrder() {
  return (
    <div className="pm">
      <StepPill at={0} />
      <div className="pm-store"><span className="pm-logo"><Icon name="coffee" size={26} weight="duotone" /></span>
        <div><b>سدرة كافيه</b><div className="row small"><span className="pm-open">مفتوح</span><span className="muted"><bdi>30</bdi> دقيقة</span><span className="muted"><bdi>3</bdi> كم</span></div></div></div>
      <div className="pm-card"><div className="row-between"><b>طلبك</b><span className="small muted">مسح السلة</span></div>
        <div className="row-between small"><span>لاتيه × 2</span><span className="ltr">28.00 د.إ</span></div>
        <div className="row-between small"><span>كرواسون × 1</span><span className="ltr">12.00 د.إ</span></div>
        <div className="row-between"><b>المجموع</b><b className="ltr">40.00 د.إ</b></div></div>
      <div className="pm-card row-between"><div className="row"><Icon name="car" size={20} /><span className="small">أبيض · 12345</span></div><Icon name="back" size={16} /></div>
      <div className="pm-card row-between"><div className="row"><Icon name="card" size={20} /><span className="small">بطاقة</span></div><Icon name="back" size={16} /></div>
      <div className="pm-btn">تأكيد الطلب · 40.00 د.إ</div>
    </div>
  );
}

function MockDrive() {
  return (
    <div className="pm pm-map">
      <StepPill at={1} />
      <div className="row pm-chips"><span className="pm-chip"><Icon name="route" size={16} /> المسافة <b><bdi>4</bdi> كم</b></span><span className="pm-chip"><Icon name="clock" size={16} /> توصل بعد <b><bdi>14</bdi> دقيقة</b></span></div>
      <svg className="pm-svg" viewBox="0 0 260 300" aria-hidden="true">
        <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round"><path d="M-10 70 L270 40" /><path d="M-10 190 L270 150" /><path d="M60 -10 L110 310" /><path d="M190 -10 L160 310" /></g>
        <path d="M70 80 L170 60 L180 120 L150 200 L170 250" fill="none" stroke="#0C1D16" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="70" cy="80" r="9" fill="#CFF03A" stroke="#0C1D16" strokeWidth="3" />
        <circle cx="170" cy="250" r="18" fill="#EBF7B8" /><circle cx="170" cy="250" r="7" fill="#0C1D16" />
      </svg>
      <div className="pm-sheet"><div className="row-between"><div className="row"><span className="pm-ico"><Icon name="clock" size={20} /></span><div><b>وقت الجاهزية</b><div className="small muted">متى يجهز طلبك</div></div></div><b className="pm-big"><bdi>26</bdi> دقيقة</b></div></div>
    </div>
  );
}

function MockCollect() {
  return (
    <div className="pm">
      <StepPill at={2} />
      <div className="pm-card pm-dark"><span className="small">وصلت للفرع</span><b className="pm-eta">الموظف طالع لك</b><div className="pm-steps"><i className="on" /><i className="on" /><i className="on" /><i /></div></div>
      <div className="pm-card"><div className="row-between"><div className="row"><span className="pm-ico"><Icon name="clock" size={20} /></span><b>وقت الجاهزية</b></div><b><bdi>1</bdi> دقيقة</b></div>
        <div className="row-between"><div className="row"><span className="pm-ico pm-ico-b"><Icon name="car" size={20} /></span><b>السيارات قبلك</b></div><b>0</b></div></div>
      <div className="pm-card"><b>سدرة كافيه</b><span className="small muted">العين · الجيمي</span></div>
      <div className="pm-card row-between"><b>منطقة الوقوف ومعلومات المحل</b><Icon name="back" size={16} /></div>
      <div className="pm-card row-between"><b>طلبك</b><Icon name="back" size={16} /></div>
    </div>
  );
}

const HOW = [
  ['اطلب', 'اطلب من مطعمك أو بقالتك أو محلك المفضل. اطلب قبل لا تطلع، ويكون الطلب جاهز في وقته.', MockOrder],
  ['سوق', 'يوصلك الاتجاه ووقت جاهزية الطلب، والمحل يشوف كم باقي لك عشان يكون الطلب جاهز لما توصل.', MockDrive],
  ['استلم', 'المحل يعرف إنك وصلت تلقائياً. تشوف كم سيارة قدامك ومتى يجهز طلبك، وموظف يطلع لك الطلب لين السيارة.', MockCollect],
];

function How() {
  return (
    <section className="s-how" id="how">
      <h2>ثلاث خطوات، وما تنزل من سيارتك</h2>
      <div className="s-how-grid stagger">
        {HOW.map(([t, d, Mock]) => (
          <article key={t} className="s-how-col">
            <h3>{t}</h3><p>{d}</p>
            <div className="phone-frame" role="img" aria-label={'شاشة ' + t + ' في تطبيق Around'}><Mock /></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Landing() {
  return (
    <div className="site">
      <section className="s-hero">
        <Nav dark />
        <div className="s-hero-in">
          <div className="s-hero-copy">
            <h1>طلبك يوصل<br />قبلك</h1>
            <p>اطلب من أي محل وأنت في الطريق. نتابع وصولك، ونجهّز الطلب لحظة توصل، وتستلم من سيارتك بدون ما تنزل.</p>
            <div className="row wrap">
              <Link to="/join" className="btn btn-orange btn-lg">سجّل محلك <Icon name="arrow" size={20} /></Link>
            </div>
            <div className="row wrap s-stores" aria-label="التطبيق قريباً">
              <span className="s-store"><Icon name="phone" size={20} /> App Store · قريباً</span>
              <span className="s-store"><Icon name="phone" size={20} /> Google Play · قريباً</span>
            </div>
          </div>
          <div className="s-phone-wrap">
            <PhoneMock />
          </div>
        </div>
      </section>

      <How />

      <section className="s-live">
        <div className="s-live-copy">
          <h2>كل ما قربت،<br />قرّب طلبك</h2>
          <p>التطبيق يحسب وقت وصولك من موقعك الحقيقي ويبلّغ الفرع. وأول ما تصير على بعد ٨٠ متر، يظهر للموظف رقم لوحتك ولون سيارتك، ويطلع لك.</p>
        </div>
        <Radius />
      </section>

      <section className="s-bento">
        <article className="b-track">
          <div><h3>تدفع مرة وحدة، وتتابع كل شي</h3><p>الطلب يتحول لحظياً من الدفع إلى التحضير إلى الجاهز، وتشوف كم سيارة قدامك.</p></div>
          <div className="b-frag">
            <div className="row-between"><b>#2841</b><span className="pill orange">قيد التحضير</span></div>
            <div className="steps"><div className="done">تم الدفع</div><div className="now">قيد التحضير</div><div>جاهز</div><div>تم التسليم</div></div>
            <div className="row small muted"><Icon name="clock" size={18} /> جاهز خلال ٨ دقائق · سيارتين قدامك</div>
          </div>
        </article>
        <article className="b-gift">
          <div><h3>أهدِ مشروب أو مبلغ</h3><p>لأي رقم هاتف، مع رسالة منك. إذا ما عنده حساب، نرسل له رابط.</p></div>
          <div className="gift-card gc-orange b-frag-flat">
            <div className="row-between"><span className="semi small">هدية من سارة</span><Icon name="gift" size={26} /></div>
            <div><div style={{ fontSize: 34, fontWeight: 600 }}>٥٠ د.إ</div><p className="small">«مبروك الوظيفة الجديدة»</p></div>
          </div>
        </article>
        <article className="b-loyal">
          <div><h3>ولاء بمستويات</h3><p>برونزية، فضية، ذهبية، وبلاتينية. وكل محل يحدد نقاطه ومكافآته.</p></div>
          <div className="b-tiers">
            <div className="tier-card tier-gold b-frag-flat">
              <div className="row-between"><b>العضوية الذهبية</b><Icon name="crown" size={26} weight="fill" /></div>
              <div className="bar"><span style={{ width: '64%' }} /></div>
              <span className="small">باقي ٦ طلبات للبلاتينية</span>
            </div>
            <div className="tier-card tier-platinum b-frag-flat">
              <div className="row-between"><b>العضوية البلاتينية</b><Icon name="medal" size={26} weight="fill" /></div>
              <span className="small">أعلى مستوى، وتتجدد كل سنة</span>
            </div>
          </div>
        </article>
        <article className="b-social">
          <div><h3>صوّر طلبك وشاركه</h3><p>ستوري وبوست من طلب حقيقي، ومن يشوفه يطلب نفسه بضغطة.</p></div>
          <div className="b-post">
            <div className="row"><span className="avatar" style={{ width: 36, height: 36, '--h': 150 }}><Icon name="user" size={19} weight="fill" /></span><b>sara.ain</b></div>
            <div className="b-photo"><Icon name="coffee" size={64} weight="duotone" /></div>
            <div className="row-between"><span className="row small"><Icon name="heart" size={20} weight="fill" color="#E0364F" /> 128</span><span className="btn btn-sm btn-orange">اطلبه نفسه</span></div>
          </div>
        </article>
      </section>

      <section className="s-merchants">
        <div className="s-m-copy">
          <h2>عندك محل؟<br />خل زبائنك يطلبون وهم جايين</h2>
          <p>لوحة تدير فيها المنيو والفروع والولاء والتسوية، وتطبيق للفرع يستقبل الطلبات لحظياً وينبّه الموظف لما توصل سيارة.</p>
          <Link to="/join" className="btn btn-orange btn-lg">انضم إلى Around <Icon name="arrow" size={20} /></Link>
        </div>
        <ul className="s-m-list">
          {[['store', 'لوحة التاجر', 'منيو، فروع، موظفين، ستوريات، وبرنامج الولاء الخاص بك.'], ['bell', 'تطبيق الفرع', 'طلبات حية بصوت تنبيه، ولوحة عملاء وصلوا.'], ['wallet', 'تسوية واضحة', 'مبيعاتك وعمولة المنصة لكل طلب، بدون رسوم خفية.']].map(([i, t, d]) => (
            <li key={t}><Icon name={i} size={28} color="var(--accent)" /><div><b>{t}</b><p>{d}</p></div></li>
          ))}
        </ul>
      </section>

      <footer className="s-foot">
        <div className="row-between wrap">
          <span className="small">© Around · الإمارات العربية المتحدة</span>
          <Link to="/join" className="small">انضم كتاجر</Link>
        </div>
        <div className="s-foot-mark" aria-hidden="true"><Wordmark size={200} /></div>
      </footer>
    </div>
  );
}

const CATS = [['coffee', 'قهوة'], ['restaurant', 'مطعم'], ['burger', 'برجر'], ['bakery', 'مخبز'], ['juice', 'عصائر'], ['dessert', 'حلويات'], ['grocery', 'بقالة'], ['pharmacy', 'صيدلية']];
const CITIES = ['أبوظبي', 'العين', 'دبي', 'الشارقة', 'عجمان', 'أم القيوين', 'رأس الخيمة', 'الفجيرة'];

function Join() {
  const client = api('public');
  const [run, busy] = useAction();
  const [f, setF] = useState({ business_name: '', category: 'coffee', contact_name: '', phone: '', city: 'العين', area: '', branches: 1, note: '' });
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => { e.preventDefault(); run(async () => { await client.post('/join', f); setDone(true); }); };
  return (
    <div className="site s-join">
      <Nav />
      <div className="s-join-in">
        <div className="s-join-copy">
          <h1>انضم إلى Around</h1>
          <p>سجّل محلك، ونراجع بياناتك ونتواصل معك. بعد الاعتماد تدخل من تطبيق Around برقم هاتفك وتضيف المنيو.</p>
        </div>
        {done ? (
          <div className="card col center" style={{ alignItems: 'center', gap: 14, padding: 32 }}>
            <span className="em-icon" style={{ background: 'var(--accent)', width: 68, height: 68, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={34} /></span>
            <h2 style={{ fontSize: 24 }}>وصلنا طلبك</h2>
            <p className="muted">فريق Around بيراجع بياناتك ويتواصل معك.</p>
            <Link to="/" className="btn">الرجوع للرئيسية</Link>
          </div>
        ) : (
          <form className="card col gap-14" onSubmit={submit}>
            <label className="field"><span>اسم المحل</span><input className="input" value={f.business_name} onChange={set('business_name')} required maxLength={60} /></label>
            <label className="field"><span>نوع النشاط</span><select className="select" value={f.category} onChange={set('category')}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <div className="row wrap">
              <label className="field grow"><span>المدينة</span><select className="select" value={f.city} onChange={set('city')}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field grow"><span>منطقة الفرع</span><input className="input" value={f.area} onChange={set('area')} required maxLength={40} /></label>
            </div>
            <label className="field"><span>عدد الفروع</span><input className="input" type="number" min="1" max="50" inputMode="numeric" value={f.branches} onChange={set('branches')} /></label>
            <label className="field"><span>اسمك</span><input className="input" value={f.contact_name} onChange={set('contact_name')} required maxLength={40} /></label>
            <label className="field"><span>رقم الهاتف</span><div className="input-group"><span className="ltr muted">+971</span><input dir="ltr" inputMode="tel" placeholder="5X XXX XXXX" value={f.phone} onChange={set('phone')} required aria-label="رقم الهاتف" /></div></label>
            <label className="field"><span>ملاحظة (اختياري)</span><textarea className="input" rows={3} maxLength={300} value={f.note} onChange={set('note')} /></label>
            <button className="btn btn-orange btn-lg" disabled={busy}>أرسل الطلب</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Site() {
  return (
    <Routes>
      <Route path="/join" element={<Join />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
