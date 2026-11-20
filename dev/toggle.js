// DEV ONLY: dataset toggle for break-ui. Plain chrome, not part of the design under test.
(function () {
  const states = [['demo', 'Demo data'], ['worst', 'Worst case'], ['empty', 'Empty']];
  const cur = (new URLSearchParams(location.search).get('data')) || (document.cookie.match(/saqr_data=(\w+)/) || [])[1] || 'demo';
  const bar = document.createElement('div');
  bar.setAttribute('dir', 'ltr');
  bar.setAttribute('role', 'radiogroup');
  bar.setAttribute('aria-label', 'Dataset (dev only)');
  Object.assign(bar.style, { position: 'fixed', left: '50%', bottom: '12px', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', gap: '2px', padding: '3px', background: '#e5e5e5', borderRadius: '999px', font: '12px system-ui, sans-serif' });
  for (const [id, label] of states) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(id === cur));
    Object.assign(b.style, { border: 0, borderRadius: '999px', padding: '6px 12px', cursor: 'pointer', background: id === cur ? '#fff' : 'transparent', color: '#111', font: 'inherit' });
    b.addEventListener('click', () => {
      const u = new URL(location.href);
      u.searchParams.set('data', id);
      try { localStorage.removeItem('saqr_guardian'); } catch (e) { /* ignore */ }
      location.href = u.toString();
    });
    bar.appendChild(b);
  }
  document.body.appendChild(bar);
  // Worst case on the family page: load the pre-built circle with 13 alerts.
  if (cur === 'worst' && location.pathname === '/family') {
    try {
      if (!localStorage.getItem('saqr_guardian')) {
        fetch('/dev/worst-family').then((r) => r.json()).then((g) => { localStorage.setItem('saqr_guardian', JSON.stringify(g)); location.reload(); });
      }
    } catch (e) { /* ignore */ }
  }
})();
