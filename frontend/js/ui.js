/* Shared UI helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = { medical: '🩺', enrollment: '🎓', book: '📚', residency: '🛂', additional: '➕' };
const fmtDate = iso => iso ? new Date(iso).toLocaleString(LANG === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
const fmtDay = d => new Date(d + 'T00:00').toLocaleDateString(LANG === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' });
const money = n => n.toLocaleString(LANG === 'ar' ? 'ar-EG' : 'en-US') + ' ' + t('currency');
const badge = st => `<span class="badge b-${st}">${esc(t('st.' + st))}</span>`;

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 4200);
}

/* Modal: content is an HTML string; returns the element. Close with ESC / backdrop / [data-close]. */
function openModal(html, wide = false) {
  closeModal();
  const root = $('#modalRoot');
  root.innerHTML = `<div class="backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const bd = $('.backdrop', root);
  bd.addEventListener('mousedown', e => { if (e.target === bd) closeModal(); });
  root.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  const first = $('input,select,textarea', root); if (first) first.focus();
  return $('.modal', root);
}
function closeModal() { const r = $('#modalRoot'); if (r.innerHTML) { r.innerHTML = ''; if (window._blobUrl) { URL.revokeObjectURL(window._blobUrl); window._blobUrl = null; } } }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function fieldErr(form, name, msg) {
  const el = form.querySelector(`[name="${name}"]`); if (!el) return;
  el.classList.add('invalid');
  let m = el.parentElement.querySelector('.err'); if (!m) { m = document.createElement('div'); m.className = 'err'; el.parentElement.appendChild(m); }
  m.textContent = msg;
}
function clearErrs(form) { $$('.invalid', form).forEach(e => e.classList.remove('invalid')); $$('.err', form).forEach(e => e.remove()); }

/* View an uploaded document (data URL -> blob URL so PDFs render) */
async function viewDoc(doc) {
  const blob = await (await fetch(doc.dataUrl)).blob();
  window._blobUrl = URL.createObjectURL(blob);
  const body = doc.type === 'application/pdf'
    ? `<iframe class="docframe" src="${window._blobUrl}" title="${esc(doc.name)}"></iframe>`
    : `<img class="docimg" src="${window._blobUrl}" alt="${esc(doc.name)}">`;
  openModal(`<h3>${esc(doc.name)}</h3>${body}
    <div class="row end"><a class="btn ghost" target="_blank" rel="noopener" href="${window._blobUrl}">${t('openNewTab')}</a>
    <button class="btn" data-close>${t('close')}</button></div>`, true);
}

/* Printable paper (FR7) – rendered into #printArea, shown only by @media print */
function printPaper(student, key, label, amount) {
  const rows = [
    [t('studentName'), student.fullName], [t('studentId'), student.id], [t('nationality'), student.nationality],
    [t('passport'), student.passportNumber], [t('program'), student.program], [t('service'), label]
  ];
  if (key !== 'medical') rows.push([t('amountDue'), money(amount)]);
  $('#printArea').innerHTML = `
    <div class="paper">
      <div class="paper-head"><div class="logo">🏛️</div><div><h1>${t('uni')}</h1><div>${t('appName')}</div></div></div>
      <h2>${t('paperTitle')}</h2>
      <table>${rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</table>
      ${key === 'medical' ? `<p>${esc(t('medicalReq'))}</p>` : ''}
      <p class="note">${t('instructions')}</p>
      <div class="sigs"><div><div class="line"></div>${t('studentSign')}</div><div><div class="line"></div>${t('stampSign')}</div></div>
      <p class="small">${t('printedOn')}: ${fmtDate(nowISO())}</p>
    </div>`;
  setTimeout(() => window.print(), 50);
}

function downloadCSV(filename, rows) {
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function readFile(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
