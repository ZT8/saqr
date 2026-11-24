// Formatting helpers (Arabic UI, Latin digits as commonly used in the UAE).
export const aed = (fils) => {
  const v = (fils || 0) / 100;
  const n = Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n + '\u00A0د.إ';
};

export const km = (m) => (m == null ? '' : m < 1000 ? `${m} م` : `${(m / 1000).toFixed(1)} كم`);

const toDate = (s) => (s instanceof Date ? s : new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z')));

export function ago(s) {
  const sec = Math.max(1, Math.round((Date.now() - toDate(s).getTime()) / 1000));
  if (sec < 60) return 'الحين';
  const m = Math.round(sec / 60);
  if (m < 60) return m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين' : `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : `قبل ${h} ساعات`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? 'أمس' : `قبل ${d} يوم`;
  return dateShort(s);
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export function dateShort(s) {
  const d = typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : toDate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function timeShort(s) {
  return toDate(s).toLocaleTimeString('ar-AE-u-nu-latn', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dubai' });
}

export const unitOf = (program) => (program && program.type === 'points' ? 'نقطة' : 'ختم');

export function initials(name) { return (name || '؟').trim().charAt(0); }

export const mapsLink = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
