import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../../lib/session';
import { useLoad } from '../../lib/hooks';
import Icon from '../../ui/Icon';
import { useAction, useToast } from '../../ui/kit';

const W = 1080, H = 1350;
const LENSES = [['none', 'عادي'], ['store', 'المحل'], ['around', 'Around']];

// Snapchat/Instagram-style camera: live viewfinder, lenses, flash, flip, gallery;
// then an editor with text + store sticker, and publish to story / explore.
export default function PostComposer() {
  const { api } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [run, busy] = useAction();
  const video = useRef(null);
  const shot = useRef(null);      // captured photo (full res)
  const preview = useRef(null);   // composed preview canvas
  const fileInput = useRef(null);
  const stream = useRef(null);
  const [mode, setMode] = useState('camera');
  const [facing, setFacing] = useState('environment');
  const [camError, setCamError] = useState('');
  const [torch, setTorch] = useState(false);
  const [lens, setLens] = useState('store');
  const [text, setText] = useState('');
  const [showText, setShowText] = useState(true);
  const [sticker, setSticker] = useState(true);
  const [inExplore, setInExplore] = useState(true);
  const [orderId, setOrderId] = useState(params.get('order') ? Number(params.get('order')) : null);
  const orders = useLoad(() => api.get('/orders'), []);
  const delivered = (orders.data || []).filter((o) => o.status === 'delivered').slice(0, 10);
  const order = delivered.find((o) => o.id === orderId) || null;

  useEffect(() => { if (!orderId && delivered[0]) setOrderId(delivered[0].id); }, [delivered.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera lifecycle
  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => {
    if (mode !== 'camera') return undefined;
    let cancelled = false;
    (async () => {
      setCamError('');
      if (!navigator.mediaDevices?.getUserMedia) { setCamError('الكاميرا غير مدعومة في هذا المتصفح'); return; }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
      } catch { setCamError('ما قدرنا نفتح الكاميرا. اسمح بالوصول أو اختر صورة من الألبوم'); }
    })();
    return () => { cancelled = true; stop(); };
  }, [mode, facing]);

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0];
    const caps = track?.getCapabilities ? track.getCapabilities() : {};
    if (caps.torch) { await track.applyConstraints({ advanced: [{ torch: !torch }] }).catch(() => {}); setTorch(!torch); }
    else { setTorch(!torch); toast(torch ? 'الفلاش مطفأ' : 'الفلاش يشتغل وقت التصوير'); }
  };

  const drawCover = (ctx, src, sw, sh) => {
    const r = Math.max(W / sw, H / sh), dw = sw * r, dh = sh * r;
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  };
  const capture = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    if (torch && facing === 'user') { document.body.style.background = '#fff'; await new Promise((r) => setTimeout(r, 120)); }
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (facing === 'user') { ctx.translate(W, 0); ctx.scale(-1, 1); }
    drawCover(ctx, v, v.videoWidth, v.videoHeight);
    document.body.style.background = '';
    shot.current = c; stop(); setMode('edit');
  };
  const fromFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      drawCover(c.getContext('2d'), img, img.naturalWidth, img.naturalHeight);
      shot.current = c; stop(); setMode('edit'); URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };

  // Compose final image: photo + lens frame + sticker + text.
  const compose = useCallback((canvas) => {
    if (!shot.current || !canvas) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(shot.current, 0, 0);
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (lens === 'around') {
      ctx.strokeStyle = '#0C1D16'; ctx.lineWidth = 36; ctx.strokeRect(18, 18, W - 36, H - 36);
      roundRect(ctx, W - 300, H - 150, 250, 86, 43, '#0C1D16');
      ctx.fillStyle = '#FFFFFF'; ctx.font = '700 44px "Readex Pro Variable"'; ctx.fillText('Around', W - 175, H - 107);
      ctx.fillStyle = '#CFF03A'; ctx.beginPath(); ctx.arc(W - 262, H - 107, 12, 0, Math.PI * 2); ctx.fill();
    }
    if (sticker && order && lens !== 'none') {
      const label = `طلبي من ${order.merchant.name}`;
      let size = 48;
      do { ctx.font = `700 ${size}px "Readex Pro Variable"`; size -= 2; } while (ctx.measureText(label).width > W - 240 && size > 24);
      const w = ctx.measureText(label).width + 90;
      ctx.save(); ctx.translate(W / 2, H * 0.3); ctx.rotate(-0.06);
      roundRect(ctx, -w / 2, -54, w, 108, 28, '#FFFFFF');
      ctx.fillStyle = '#0B1410'; ctx.fillText(label, 0, 2);
      ctx.restore();
    }
    if (showText && text.trim()) {
      let ts = 54;
      do { ctx.font = `600 ${ts}px "Readex Pro Variable"`; ts -= 2; } while (ctx.measureText(text.trim()).width > W - 80 && ts > 26);
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, H * 0.62 - 60, W, 120);
      ctx.fillStyle = '#fff'; ctx.fillText(text.trim().slice(0, 60), W / 2, H * 0.62);
    }
  }, [lens, sticker, order, showText, text]);

  useEffect(() => { if (mode === 'edit') { document.fonts?.ready.then(() => compose(preview.current)); compose(preview.current); } }, [mode, compose]);

  const publish = () => run(async () => {
    const c = document.createElement('canvas'); compose(c);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
    const fd = new FormData();
    fd.append('image', blob, 'story.jpg');
    fd.append('caption', text.trim());
    if (order) fd.append('order_id', String(order.id));
    fd.append('in_explore', inExplore ? '1' : '0');
    fd.append('attach_order', sticker ? '1' : '0');
    await api.post('/social/posts', fd);
    toast('نشرنا ستوريك', 'success');
    nav('/app/social', { replace: true });
  });

  const close = () => { stop(); window.history.length > 1 ? nav(-1) : nav('/app'); };

  return (
    <div className="cam">
      <div className="cam-inner">
        {mode === 'camera' ? (
          <>
            <video ref={video} playsInline muted style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none', background: '#111' }} />
            {lens === 'around' && <div style={{ position: 'absolute', inset: 0, border: '12px solid #0C1D16', pointerEvents: 'none' }} />}
            {lens === 'store' && order && <div style={{ position: 'absolute', top: '28%', left: '50%', transform: 'translateX(-50%) rotate(-3deg)', background: '#FFFFFF', color: '#0B1410', borderRadius: 12, padding: '8px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}>طلبي من {order.merchant.name}</div>}
            {camError && (
              <div className="col center" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 }}>
                <Icon name="camera" size={44} /><p>{camError}</p>
                <button className="btn btn-orange" onClick={() => fileInput.current.click()}>اختر من الألبوم</button>
              </div>
            )}
            <div className="row-between" style={{ position: 'absolute', top: 16, insetInline: 14 }}>
              <button className="cam-tool" onClick={close} aria-label="إغلاق"><Icon name="close" /></button>
              <span className="pill orange">صوّر طلبك</span>
            </div>
            <div className="col" style={{ position: 'absolute', top: 76, right: 14, gap: 14 }}>
              <button className={'cam-tool' + (torch ? ' on' : '')} onClick={toggleTorch} aria-label="الفلاش" aria-pressed={torch}><Icon name="flash" /></button>
              <button className="cam-tool" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label="قلب الكاميرا"><Icon name="flip" /></button>
            </div>
            <div className="col" style={{ position: 'absolute', bottom: 0, insetInline: 0, alignItems: 'center', gap: 16, paddingBottom: 'calc(30px + env(safe-area-inset-bottom))' }}>
              <div className="row" style={{ gap: 12 }}>
                {LENSES.map(([k, l]) => <button key={k} className={'lens' + (lens === k ? ' on' : '')} onClick={() => setLens(k)}>{l}</button>)}
              </div>
              <div className="row-between" style={{ width: '100%', padding: '0 36px' }}>
                <button className="cam-tool" style={{ borderRadius: 12, border: '2px solid #fff' }} onClick={() => fileInput.current.click()} aria-label="من الألبوم"><Icon name="image" /></button>
                <button className="shutter" onClick={capture} disabled={!!camError} aria-label="التقاط"><span /></button>
                <span style={{ width: 44 }} />
              </div>
            </div>
          </>
        ) : (
          <>
            <canvas ref={preview} className="preview" />
            <div className="row-between" style={{ position: 'absolute', top: 16, insetInline: 14 }}>
              <button className="cam-tool" onClick={() => setMode('camera')} aria-label="إعادة التصوير"><Icon name="back" /></button>
              {order && <span className="pill orange ellipsis" style={{ maxWidth: 220 }}>#{order.id} · {order.merchant.name}</span>}
            </div>
            <div className="col" style={{ position: 'absolute', top: 76, right: 14, gap: 14 }}>
              <button className={'cam-tool' + (showText ? ' on' : '')} onClick={() => setShowText(!showText)} aria-label="نص" aria-pressed={showText}><b>Aa</b></button>
              <button className={'cam-tool' + (sticker ? ' on' : '')} onClick={() => setSticker(!sticker)} aria-label="ملصق المحل" aria-pressed={sticker}><Icon name="sticker" /></button>
              <button className={'cam-tool' + (lens === 'around' ? ' on' : '')} onClick={() => setLens(lens === 'around' ? 'store' : 'around')} aria-label="إطار Around"><Icon name="image" /></button>
            </div>
            <div className="col" style={{ position: 'absolute', bottom: 0, insetInline: 0, gap: 10, padding: '14px 14px calc(26px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, rgba(0,0,0,.75), rgba(0,0,0,0))' }}>
              {delivered.length > 1 && (
                <div className="row" style={{ gap: 6, overflowX: 'auto' }}>
                  {delivered.map((o) => <button key={o.id} className={'chip' + (o.id === orderId ? ' on' : '')} style={{ color: o.id === orderId ? undefined : 'var(--ink)' }} onClick={() => setOrderId(o.id)}>{o.merchant.name} #{o.id}</button>)}
                </div>
              )}
              <input className="input" placeholder="اكتب شي عن طلبك…" value={text} maxLength={60} onChange={(e) => setText(e.target.value)} style={{ background: 'rgba(255,255,255,.95)' }} aria-label="النص" />
              <div className="row">
                <span className="chip on">قصتي</span>
                <button className={'chip' + (inExplore ? ' on' : '')} style={{ color: inExplore ? undefined : 'var(--ink)' }} onClick={() => setInExplore(!inExplore)} aria-pressed={inExplore}>اكسبلور</button>
                <button className="icon-btn" style={{ marginInlineStart: 'auto', width: 58, height: 58, borderRadius: 29, background: 'var(--orange)' }} disabled={busy} onClick={publish} aria-label="نشر"><Icon name="send" size={26} /></button>
              </div>
            </div>
          </>
        )}
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={fromFile} />
      </div>
    </div>
  );
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
