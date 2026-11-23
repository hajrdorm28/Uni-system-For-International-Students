/* Student views: dashboard, service page, notifications */
const StudentViews = {
  dashboard(me) {
    const s = API.getStudent(me.id);
    const upcoming = API.meetingsOf(me.id).filter(m => m.date >= new Date().toISOString().slice(0, 10));
    const cards = SERVICES.map(k => {
      const st = API.serviceStatus(s, k), amt = API.amountFor(s, k);
      return `<a class="svc-card" href="#/student/service/${k}">
        <div class="svc-ico">${ICONS[k]}</div>
        <div class="svc-body"><h3>${t('svc.' + k)}</h3><p>${t('svc.' + k + '.desc')}</p>
        ${k !== 'medical' ? `<div class="amt">${money(amt)}</div>` : ''}</div>${badge(st)}</a>`;
    }).join('');
    return `<h1>${t('hello')}, ${esc(s.fullName.split(' ')[0])} 👋</h1>
      ${upcoming.length ? `<section class="panel info"><h2>📅 ${t('upcomingMeetings')}</h2>${upcoming.map(m =>
        `<div class="meet"><strong>${fmtDay(m.date)} · ${esc(m.time)}</strong> — ${esc(m.purpose)} ${m.location ? '· ' + esc(m.location) : ''}</div>`).join('')}</section>` : ''}
      <h2>${t('chooseService')}</h2><div class="svc-grid">${cards}</div>`;
  },

  service(me, key) {
    if (!SERVICES.includes(key)) return '<p>404</p>';
    const s = API.getStudent(me.id);
    const back = `<a class="back" href="#/student">← ${t('back')}</a>`;
    if (key === 'additional') {
      const fees = API.feesOf(me.id);
      return `${back}<h1>${ICONS[key]} ${t('svc.additional')}</h1>
        ${fees.length ? fees.map(f => this.itemBlock(s, 'additional', f.name, f.amount, f.status, f.reason, f.doc, { fee: f.id }, f.createdAt)).join('') : `<div class="panel empty">${t('noFees')}</div>`}`;
    }
    const r = s.services[key];
    return `${back}<h1>${ICONS[key]} ${t('svc.' + key)}</h1>
      ${this.itemBlock(s, key, t('svc.' + key), s.fees[key] || 0, r.status, r.reason, r.doc, key)}`;
  },

  itemBlock(s, key, label, amount, status, reason, doc, target, created) {
    const canUpload = status === 'notstarted' || status === 'rejected';
    const tgt = esc(JSON.stringify(target));
    return `<section class="panel item">
      <div class="item-head"><h2>${esc(label)}</h2>${badge(status)}</div>
      ${key !== 'medical' ? `<div class="kv"><span>${t('amountDue')}</span><b>${money(amount)}</b></div>` : `<p>${t('medicalReq')}</p>`}
      ${created ? `<div class="kv"><span>${t('date')}</span><b>${fmtDate(created)}</b></div>` : ''}
      ${status === 'rejected' ? `<div class="alert err-box">❌ ${t('rejectedReason')}: <b>${esc(reason)}</b></div>` : ''}
      <h3>${t('steps')}</h3>
      <ol class="steps"><li>${t('step1')}</li><li>${t('step2')}</li><li>${t('step3')}</li><li>${t('step4')}</li></ol>
      ${doc ? `<div class="docline">📎 ${t('uploaded')}: <b>${esc(doc.name)}</b> <small>(${fmtDate(doc.uploadedAt)})</small>
        <button class="btn ghost sm" data-viewdoc='${tgt}' data-key="${key}">${t('viewFile')}</button></div>` : ''}
      <div class="row">
        <button class="btn" data-print='${tgt}' data-key="${key}" data-label="${esc(label)}" data-amount="${amount}">🖨️ ${t('print')}</button>
        ${canUpload ? `<label class="btn primary">⬆️ ${status === 'rejected' ? t('reupload') : t('upload')}
          <input type="file" hidden accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" data-upload='${tgt}'></label>` : ''}
      </div></section>`;
  },

  notifications(me) {
    const list = API.notificationsOf(me.id);
    const html = `<h1>🔔 ${t('notifications')}</h1>
      <div class="row"><button class="btn ghost sm" data-markread>${t('markRead')}</button></div>
      ${list.length ? list.map(n => `<div class="notif ${n.read ? '' : 'unread'}"><div>${esc(n.msg)}</div>
        <small>${fmtDate(n.createdAt)} ${n.email ? '· ✉️ ' + t('viaEmail') : ''}</small></div>`).join('') : `<div class="panel empty">${t('noNotifs')}</div>`}
      <h2>📅 ${t('meetings')}</h2>
      ${API.meetingsOf(me.id).map(m => `<div class="notif"><b>${fmtDay(m.date)} · ${esc(m.time)}</b> — ${esc(m.purpose)} ${m.location ? '· ' + esc(m.location) : ''}</div>`).join('') || `<div class="panel empty">${t('noMeetings')}</div>`}`;
    return html;
  },

  /* event wiring shared with app.js (delegated on #app) */
  async handleClick(e, me) {
    const pr = e.target.closest('[data-print]');
    if (pr) { printPaper(API.getStudent(me.id), pr.dataset.key, pr.dataset.label, Number(pr.dataset.amount)); return true; }
    const vd = e.target.closest('[data-viewdoc]');
    if (vd) {
      const tg = JSON.parse(vd.dataset.viewdoc), s = API.getStudent(me.id);
      const rec = typeof tg === 'string' ? s.services[tg] : API.feesOf(me.id).find(f => f.id === tg.fee);
      viewDoc(rec.doc); return true;
    }
    if (e.target.closest('[data-markread]')) { API.markAllRead(me.id); App.render(); return true; }
    return false;
  },
  async handleChange(e, me) {
    const inp = e.target.closest('[data-upload]'); if (!inp || !inp.files[0]) return false;
    const file = inp.files[0], target = JSON.parse(inp.dataset.upload);
    try {
      API.uploadDocument(me.id, target, file, file.size <= 1.5 * 1024 * 1024 ? await readFile(file) : '');
      toast(t('uploadOk')); App.render();
    } catch (err) { toast(t(err.message) !== err.message ? t(err.message) : err.message, 'err'); inp.value = ''; }
    return true;
  }
};
