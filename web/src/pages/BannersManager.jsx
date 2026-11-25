import { useState } from 'react';
import { useSession } from '../lib/session';
import { useLoad } from '../lib/hooks';
import { Loader, Empty, Modal, useAction } from '../ui/kit';
import Icon from '../ui/Icon';

const STATUS = { pending: ['بانتظار الموافقة', 'orange'], active: ['معتمد', 'green'], rejected: ['مرفوض', 'red'] };

// Shared by the merchant panel (base = /merchant/banners) and the admin panel (base = /admin/banners/own).
export default function BannersManager({ base, review = false }) {
  const { api } = useSession();
  const [run, busy] = useAction();
  const { data, loading, reload } = useLoad(() => api.get(base), [base]);
  const queue = useLoad(() => (review ? api.get('/admin/banners/review') : Promise.resolve([])), [review]);
  const [edit, setEdit] = useState(null);
  const [file, setFile] = useState(null);
  if (loading && !data) return <Loader />;

  const open = (b) => { setFile(null); setEdit(b || { title: '', subtitle: '', starts_at: '', ends_at: '', is_active: 1, sort: 0 }); };
  const save = (e) => {
    e.preventDefault();
    const fd = new FormData();
    ['title', 'subtitle', 'starts_at', 'ends_at', 'sort'].forEach((k) => fd.append(k, edit[k] ?? ''));
    fd.append('is_active', edit.is_active ? '1' : '0');
    if (file) fd.append('image', file);
    run(async () => { edit.id ? await api.patch(`${base}/${edit.id}`, fd) : await api.post(base, fd); setEdit(null); reload(); }, 'تم الحفظ');
  };
  const del = (b) => { if (confirm('تحذف البنر؟')) run(async () => { await api.del(`${base}/${b.id}`); reload(); }); };
  const decide = (b, action) => run(async () => { await api.post(`/admin/banners/${b.id}/${action}`); queue.reload(); }, action === 'approve' ? 'اعتمدنا البنر' : 'رفضنا البنر');
  const ctr = (b) => (b.views ? ((b.clicks / b.views) * 100).toFixed(1) + '%' : '—');

  return (
    <>
      <p className="muted">{review ? 'بنرات Around تطلع أعلى الصفحة الرئيسية في التطبيق.' : 'بنراتك تطلع في الصفحة الرئيسية للتطبيق وتفتح صفحة محلك. كل بنر جديد أو معدّل ينتظر موافقة Around.'} الأفضل صورة عريضة (مثلاً 1200×600).</p>
      {review && (queue.data || []).length > 0 && (
        <div className="table-wrap">
          <h2 className="bold" style={{ padding: '12px 8px 0' }}>بنرات التجار بانتظار الموافقة</h2>
          <table className="t"><tbody>
            {queue.data.map((b) => (
              <tr key={b.id}>
                <td style={{ width: 120 }}><img src={b.image} alt="" style={{ width: 110, aspectRatio: '2/1', objectFit: 'cover', borderRadius: 12 }} /></td>
                <td><div className="semi">{b.title}</div><div className="xs muted">{b.owner_name}{b.subtitle ? ' · ' + b.subtitle : ''}</div></td>
                <td><div className="row"><button className="btn btn-sm" disabled={busy} onClick={() => decide(b, 'approve')}>اعتماد</button><button className="btn btn-sm btn-danger" disabled={busy} onClick={() => decide(b, 'reject')}>رفض</button></div></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
      <button className="btn btn-orange" style={{ alignSelf: 'flex-start' }} onClick={() => open()}><Icon name="plus" /> بنر جديد</button>
      {!data.length ? <Empty icon="image" title="ما فيه بنرات للحين" /> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th /><th>البنر</th><th>الحالة</th><th>الفترة</th><th>مشاهدات</th><th>نقرات</th><th>نسبة النقر</th><th /></tr></thead>
            <tbody>
              {data.map((b) => (
                <tr key={b.id}>
                  <td style={{ width: 120 }}><img src={b.image} alt="" style={{ width: 110, aspectRatio: '2/1', objectFit: 'cover', borderRadius: 12 }} /></td>
                  <td><div className="semi">{b.title}</div><div className="xs muted">{b.subtitle}{b.link_name ? ` · يفتح ${b.link_name}` : ''}</div></td>
                  <td><span className={'pill ' + (b.is_active ? STATUS[b.status][1] : 'gray')}>{b.is_active ? STATUS[b.status][0] : 'متوقف'}</span></td>
                  <td className="small">{b.starts_at || '—'} ← {b.ends_at || 'مفتوح'}</td>
                  <td>{b.views}</td><td>{b.clicks}</td><td>{ctr(b)}</td>
                  <td><div className="row"><button className="btn btn-sm btn-light" onClick={() => open(b)}>تعديل</button><button className="btn btn-sm btn-danger" onClick={() => del(b)}>حذف</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'تعديل البنر' : 'بنر جديد'}>
        {edit && (
          <form className="col gap-14" onSubmit={save}>
            <label className="field"><span>العنوان</span><input className="input" maxLength={60} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required /></label>
            <label className="field"><span>سطر تحت العنوان (اختياري)</span><input className="input" maxLength={100} value={edit.subtitle} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} /></label>
            <label className="field"><span>الصورة {edit.id ? '(اتركها فاضية لو ما تبي تغيّرها)' : ''}</span><input className="input" type="file" accept="image/*" required={!edit.id} onChange={(e) => setFile(e.target.files[0])} style={{ paddingTop: 10 }} /></label>
            <div className="row"><label className="field grow"><span>يبدأ</span><input className="input ltr" type="date" value={edit.starts_at || ''} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value })} /></label>
              <label className="field grow"><span>ينتهي</span><input className="input ltr" type="date" value={edit.ends_at || ''} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></label>
              <label className="field" style={{ width: 90 }}><span>الترتيب</span><input className="input ltr" type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value })} /></label></div>
            <div className="row-between"><span className="semi">شغّال</span><button type="button" className={'switch' + (edit.is_active ? ' on' : '')} onClick={() => setEdit({ ...edit, is_active: edit.is_active ? 0 : 1 })} aria-label="شغّال" /></div>
            <button className="btn btn-orange" disabled={busy}>حفظ</button>
          </form>
        )}
      </Modal>
    </>
  );
}
