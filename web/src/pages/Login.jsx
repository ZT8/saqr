import { useState } from 'react';
import { useSession } from '../lib/session';
import { useAction } from '../ui/kit';
import Icon, { Wordmark } from '../ui/Icon';

const ROLE_OF = { app: null, branch: ['staff', 'merchant'], merchant: ['merchant'], admin: ['admin'] };
const TITLES = {
  app: ['اطلب من سيارتك', 'وطلبك ينتظرك عند الباب'],
  branch: ['تطبيق الفرع', 'سجّل برقم هاتفك المسجل كموظف'],
  merchant: ['لوحة التاجر', 'سجّل برقم هاتف مالك المحل'],
  admin: ['إدارة Around', 'للمشرفين فقط']
};

export default function Login({ onDone, dark = false }) {
  const { area, api, signIn, signOut, me } = useSession();
  const [step, setStep] = useState(me && !me.name ? 'profile' : 'phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [err, setErr] = useState('');
  const [run, busy] = useAction();

  const requestCode = (e) => {
    e.preventDefault(); setErr('');
    run(async () => {
      const r = await api.post('/auth/otp/request', { phone });
      setDevCode(r.dev_code || null); setStep('code');
    });
  };
  const verify = (e) => {
    e.preventDefault(); setErr('');
    run(async () => {
      const r = await api.post('/auth/otp/verify', { phone, code });
      const roles = ROLE_OF[area];
      if (roles && !roles.includes(r.user.role)) { setErr('هذا الرقم ما عنده صلاحية على هذي الواجهة'); setStep('phone'); setCode(''); return; }
      await signIn(r.token);
      if (area === 'app' && r.is_new) setStep('profile'); else onDone && onDone();
    });
  };
  const saveProfile = (e) => {
    e.preventDefault();
    run(async () => {
      await api.patch('/auth/me', { name, username: username || null });
      await signIn(localStorage.getItem('around_token_app'));
      onDone && onDone();
    });
  };

  const [t1, t2] = TITLES[area];
  return (
    <div className="login">
      <div className="login-hero">
        <Wordmark size={30} ink="#fff" />
        <div className="login-orbit" aria-hidden="true">
          <i /><i /><i />
          <span className="login-sat"><Icon name="car" size={20} weight="fill" /></span>
        </div>
        <div className="login-copy">
          <h1>{t1}</h1>
          <p>{t2}</p>
        </div>
      </div>
      <div className="login-sheet">
        {step === 'phone' && (
          <form className="col gap-14" onSubmit={requestCode}>
            <label className="field"><span>رقم الهاتف</span>
              <div className="input-group">
                <span className="ltr semi muted">+971</span>
                <input inputMode="tel" autoComplete="tel" dir="ltr" placeholder="5X XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required aria-label="رقم الهاتف" />
              </div>
            </label>
            {err && <p className="danger small semi">{err}</p>}
            <button className="btn btn-orange btn-lg btn-block" disabled={busy || phone.replace(/\D/g, '').length < 9}>أرسل رمز التحقق</button>
            {me && <button type="button" className="btn btn-light btn-block" onClick={signOut}>تسجيل خروج</button>}
          </form>
        )}
        {step === 'code' && (
          <form className="col gap-14" onSubmit={verify}>
            <label className="field"><span>رمز التحقق المرسل إلى <span className="ltr">{phone}</span></span>
              <input className="input ltr" style={{ fontSize: 26, letterSpacing: '.6em', textAlign: 'center', width: '100%' }} inputMode="numeric" autoComplete="one-time-code"
                maxLength={4} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus required aria-label="رمز التحقق" />
            </label>
            {devCode && <p className="small muted center">وضع التطوير: الرمز هو <b className="ltr">{devCode}</b></p>}
            <button className="btn btn-orange btn-lg btn-block" disabled={busy || code.length !== 4}>تأكيد</button>
            <button type="button" className="btn btn-light btn-block" onClick={() => { setStep('phone'); setCode(''); }}>تغيير الرقم</button>
          </form>
        )}
        {step === 'profile' && (
          <form className="col gap-14" onSubmit={saveProfile}>
            <p className="bold" style={{ fontSize: 18 }}>أهلاً فيك! عرّفنا عليك</p>
            <label className="field"><span>اسمك</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} /></label>
            <label className="field"><span>اسم المستخدم (للهدايا والسوشال)</span>
              <div className="input-group"><span className="ltr muted">@</span>
                <input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} placeholder="username" maxLength={20} aria-label="اسم المستخدم" />
              </div>
            </label>
            <button className="btn btn-orange btn-lg btn-block" disabled={busy || !name.trim()}>ابدأ</button>
          </form>
        )}
      </div>
    </div>
  );
}
