/* Student Affairs views */
const StaffViews = {
  filters: { q: '', status: '', service: '' },

  dashboard() {
    const rows = API.report(), pend = API.pendingDocs();
    const col = rows.reduce((a, r) => a + r.paid, 0), out = rows.reduce((a, r) => a + r.unpaid, 0);
    return `<h1>${t('dashboard')}</h1>
      <div class="stats">
        <div class="stat"><b>${API.listStudents().length}</b><span>${t('totalStudents')}</span></div>
        <a class="stat ${pend.length ? 'hot' : ''}" href="#/staff/review"><b>${pend.length}</b><span>${t('pendingDocs')}</span></a>
        <div class="stat good"><b>${money(col)}</b><span>${t('totalCollected')}</span></div>
        <div class="stat warn"><b>${money(out)}</b><span>${t('totalOutstanding')}</span></div>
      </div>
      <h2>${t('review')}</h2>${this.queueList(pend.slice(0, 5))}
      ${pend.length > 5 ? `<a class="btn ghost" href="#/staff/review">${t('open')} →</a>` : ''}`;
  },

  /* ----- students list with search + tracking (FR10, US16) ----- */
  students() {
    const f = this.filters;
    return `<div class="row between"><h1>${t('students')}</h1><button class="btn primary" data-addstudent>＋ ${t('addStudent')}</button></div>
      <div class="filters">
        <input type="search" id="fq" placeholder="${esc(t('search'))}" value="${esc(f.q)}">
        <select id="fservice"><option value="">${t('filterService')}: ${t('allStatuses').split(' ')[0]}</option>
          ${SERVICES.map(k => `<option value="${k}" ${f.service === k ? 'selected' : ''}>${t('svc.' + k)}</option>`).join('')}</select>
        <select id="fstatus"><option value="">${t('allStatuses')}</option>
          ${['notstarted', 'pending', 'completed', 'rejected'].map(k => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${t('st.' + k)}</option>`).join('')}</select>
      </div>
      <div id="stuTable">${this.studentsTable()}</div>`;
  },
  studentsTable() {
    const f = this.filters, q = f.q.trim().toLowerCase();
    let list = API.listStudents().filter(s => !q || [s.fullName, s.id, s.username, s.nationality, s.email].some(v => v.toLowerCase().includes(q)));
    if (f.status) list = list.filter(s => (f.service ? [f.service] : SERVICES).some(k => API.serviceStatus(s, k) === f.status));
    else if (f.service) list = list.filter(() => true);
    if (!list.length) return `<div class="panel empty">${t('noResults')}</div>`;
    const k = f.service ? [f.service] : SERVICES;
    return `<div class="tablewrap"><table class="tbl"><thead><tr><th>${t('studentId')}</th><th>${t('fullName')}</th><th>${t('nationality')}</th>
      ${k.map(x => `<th>${ICONS[x]} ${t('svc.' + x)}</th>`).join('')}<th></th></tr></thead><tbody>
      ${list.map(s => `<tr><td>${esc(s.id)}</td><td><a href="#/staff/student/${esc(s.id)}">${esc(s.fullName)}</a></td><td>${esc(s.nationality)}</td>
        ${k.map(x => `<td>${badge(API.serviceStatus(s, x))}</td>`).join('')}
        <td><a class="btn sm" href="#/staff/student/${esc(s.id)}">${t('open')}</a></td></tr>`).join('')}</tbody></table></div>`;
  },

  /* ----- one student: record, services, add fee, schedule meeting ----- */
  student(id) {
    const s = API.getStudent(id); if (!s) return '<p>404</p>';
    const fees = API.feesOf(id), meets = API.meetingsOf(id), mail = API.notificationsOf(id).filter(n => n.email).slice(0, 6);
    return `<a class="back" href="#/staff/students">← ${t('back')}</a>
      <div class="row between"><h1>${esc(s.fullName)}</h1><button class="btn" data-editstudent="${esc(s.id)}">✏️ ${t('edit')}</button></div>
      <section class="panel"><h2>${t('studentRecord')}</h2><div class="kvgrid">
        ${[['studentId', s.id], ['username', s.username], ['email', s.email], ['phone', s.phone], ['nationality', s.nationality], ['passport', s.passportNumber], ['dob', s.dob], ['program', s.program]]
        .map(([k, v]) => `<div class="kv"><span>${t(k)}</span><b>${esc(v)}</b></div>`).join('')}</div></section>
      <section class="panel"><h2>${t('servicesStatus')}</h2>
        ${SERVICES.map(k => `<div class="kv"><span>${ICONS[k]} ${t('svc.' + k)}</span><b>${k !== 'medical' ? money(API.amountFor(s, k)) : ''}</b>${badge(API.serviceStatus(s, k))}</div>`).join('')}</section>
      <div class="two">
        <section class="panel"><h2>${t('addFee')}</h2>
          <form data-form="fee" data-sid="${esc(id)}" novalidate>
            <label>${t('feeName')}<input name="name"></label>
            <label>${t('amount')} (USD)<input name="amount" type="number" min="1" step="0.01"></label>
            <button class="btn primary">${t('addFee')}</button></form>
          ${fees.map(f => `<div class="kv"><span>${esc(f.name)}</span><b>${money(f.amount)}</b>${badge(f.status)}</div>`).join('')}</section>
        <section class="panel"><h2>${t('schedule')}</h2>
          <form data-form="meeting" data-sid="${esc(id)}" novalidate>
            <label>${t('date')}<input name="date" type="date" min="${new Date().toISOString().slice(0, 10)}"></label>
            <label>${t('time')}<input name="time" type="time"></label>
            <label>${t('purpose')}<input name="purpose"></label>
            <label>${t('location')}<input name="location"></label>
            <button class="btn primary">${t('schedule')}</button></form>
          ${meets.map(m => `<div class="kv"><span>${fmtDay(m.date)} ${esc(m.time)}</span><b>${esc(m.purpose)}</b></div>`).join('')}</section>
      </div>
      ${mail.length ? `<section class="panel"><h2>✉️ ${t('outbox')}</h2>${mail.map(n => `<div class="notif"><div>${esc(n.msg)}</div><small>${fmtDate(n.createdAt)}</small></div>`).join('')}</section>` : ''}`;
  },

  studentForm(id) {
    const s = id ? API.getStudent(id) : { fees: { enrollment: 1500, book: 300, residency: 200 } };
    const v = k => esc(s[k] ?? '');
    const inp = (n, label, type = 'text', extra = '') => `<label>${label}<input name="${n}" type="${type}" value="${v(n)}" ${extra}></label>`;
    openModal(`<h3>${id ? t('editStudent') : t('addStudent')}</h3>
      <form data-form="student" data-sid="${esc(id || '')}" novalidate>
        <div class="formgrid">
          ${inp('id', t('studentId'), 'text', id ? 'readonly' : '')}${inp('fullName', t('fullName'))}
          ${inp('username', t('username'))}${inp('password', t('defaultPw') + (id ? ' (—)' : ''), 'text', 'autocomplete="off"')}
          ${inp('email', t('email'), 'email')}${inp('phone', t('phone'))}
          ${inp('nationality', t('nationality'))}${inp('passportNumber', t('passport'))}
          ${inp('dob', t('dob'), 'date')}${inp('program', t('program'))}
        </div>
        <h4>${t('amountsSection')}</h4>
        <div class="formgrid3">
          <label>${t('svc.enrollment')}<input name="f_enrollment" type="number" min="0" value="${s.fees.enrollment}"></label>
          <label>${t('svc.book')}<input name="f_book" type="number" min="0" value="${s.fees.book}"></label>
          <label>${t('svc.residency')}<input name="f_residency" type="number" min="0" value="${s.fees.residency}"></label>
        </div>
        <div class="row end"><button type="button" class="btn ghost" data-close>${t('cancel')}</button><button class="btn primary">${t('save')}</button></div>
      </form>`, true);
  },

  /* ----- review queue (FR12) ----- */
  queueList(list) {
    if (!list.length) return `<div class="panel empty">${t('queueEmpty')}</div>`;
    return list.map(p => {
      const ref = esc(JSON.stringify(p.ref)), lbl = p.key === 'additional' ? p.label : t('svc.' + p.key);
      return `<section class="panel item"><div class="item-head"><h3>${esc(p.student.fullName)} <small>#${esc(p.student.id)}</small></h3>${badge('pending')}</div>
        <div class="kv"><span>${ICONS[p.key]} ${esc(lbl)}</span><b>${p.key !== 'medical' ? money(p.key === 'additional' ? p.rec.amount : p.student.fees[p.key]) : ''}</b></div>
        <div class="kv"><span>${t('submitted')}</span><b>${fmtDate(p.rec.doc.uploadedAt)}</b></div>
        <div class="row"><button class="btn ghost" data-reviewview='${ref}' data-sid="${esc(p.student.id)}">📎 ${esc(p.rec.doc.name)}</button>
          <button class="btn good" data-decide="approve" data-ref='${ref}' data-sid="${esc(p.student.id)}" data-label="${esc(lbl)}">✔ ${t('approve')}</button>
          <button class="btn bad" data-decide="reject" data-ref='${ref}' data-sid="${esc(p.student.id)}" data-label="${esc(lbl)}">✖ ${t('reject')}</button></div></section>`;
    }).join('');
  },
  review() { return `<h1>${t('review')}</h1>${this.queueList(API.pendingDocs())}`; },

  /* ----- reports (FR17) ----- */
  reports() {
    const rows = API.report(), sum = k => rows.reduce((a, r) => a + r[k], 0);
    return `<div class="row between"><h1>${t('reportTitle')}</h1><button class="btn" data-csv>⬇ ${t('exportCsv')}</button></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>${t('studentId')}</th><th>${t('fullName')}</th><th>${t('paid')}</th><th>${t('unpaid')}</th><th>${t('total')}</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r.student.id)}</td><td><a href="#/staff/student/${esc(r.student.id)}">${esc(r.student.fullName)}</a></td>
        <td class="ok">${money(r.paid)}</td><td class="${r.unpaid ? 'bad' : ''}">${money(r.unpaid)}</td><td>${money(r.total)}</td></tr>`).join('')}
      </tbody><tfoot><tr><th colspan="2">${t('total')}</th><th>${money(sum('paid'))}</th><th>${money(sum('unpaid'))}</th><th>${money(sum('total'))}</th></tr></tfoot></table></div>`;
  },

  /* ----- events ----- */
  handleClick(e) {
    let el;
    if ((el = e.target.closest('[data-addstudent]'))) { this.studentForm(); return true; }
    if ((el = e.target.closest('[data-editstudent]'))) { this.studentForm(el.dataset.editstudent); return true; }
    if ((el = e.target.closest('[data-reviewview]'))) {
      const ref = JSON.parse(el.dataset.reviewview), s = API.getStudent(el.dataset.sid);
      const rec = typeof ref === 'string' ? s.services[ref] : API.feesOf(s.id).find(f => f.id === ref.fee);
      viewDoc(rec.doc); return true;
    }
    if ((el = e.target.closest('[data-decide]'))) {
      const { sid, label } = el.dataset, ref = JSON.parse(el.dataset.ref);
      if (el.dataset.decide === 'approve') { API.decide(sid, ref, true, '', label); toast(t('approved')); App.render(); }
      else {
        openModal(`<h3>${t('reject')} – ${esc(label)}</h3><form data-form="reject" data-sid="${esc(sid)}" data-label="${esc(label)}" data-ref='${esc(JSON.stringify(ref))}' novalidate>
          <label>${t('reason')}<textarea name="reason" rows="3"></textarea></label>
          <div class="row end"><button type="button" class="btn ghost" data-close>${t('cancel')}</button><button class="btn bad">${t('reject')}</button></div></form>`);
      }
      return true;
    }
    if (e.target.closest('[data-csv]')) {
      downloadCSV('fees-report.csv', [['ID', 'Name', 'Paid (USD)', 'Unpaid (USD)', 'Total (USD)'], ...API.report().map(r => [r.student.id, r.student.fullName, r.paid, r.unpaid, r.total])]);
      return true;
    }
    return false;
  },
  handleInput(e) {
    if (e.target.id === 'fq') this.filters.q = e.target.value;
    else if (e.target.id === 'fservice') this.filters.service = e.target.value;
    else if (e.target.id === 'fstatus') this.filters.status = e.target.value;
    else return false;
    $('#stuTable').innerHTML = this.studentsTable(); return true;
  },

  /* form submit handlers – validate like the backend should */
  submit(form) {
    const kind = form.dataset.form, f = Object.fromEntries(new FormData(form)), sid = form.dataset.sid;
    clearErrs(form); let bad = false;
    const need = n => { if (!String(f[n] ?? '').trim()) { fieldErr(form, n, t('required')); bad = true; } };

    if (kind === 'student') {
      ['id', 'fullName', 'username', 'email', 'nationality', 'passportNumber', 'dob', 'program'].forEach(need);
      if (!sid) need('password');
      if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) { fieldErr(form, 'email', t('invalidEmail')); bad = true; }
      if (bad) return;
      const data = {
        id: f.id.trim(), username: f.username.trim(), password: f.password, fullName: f.fullName.trim(), email: f.email.trim(), phone: f.phone.trim(),
        nationality: f.nationality.trim(), passportNumber: f.passportNumber.trim(), dob: f.dob, program: f.program.trim(),
        fees: { enrollment: +f.f_enrollment || 0, book: +f.f_book || 0, residency: +f.f_residency || 0 }
      };
      try { API.saveStudent(data, sid || null); closeModal(); toast(sid ? t('studentSaved') : t('studentCreated')); App.render(); }
      catch (err) { toast(t(err.message), 'err'); }
    }
    if (kind === 'fee') {
      need('name'); const amt = parseFloat(f.amount);
      if (!(amt > 0)) { fieldErr(form, 'amount', t('amountInvalid')); bad = true; }
      if (bad) return;
      API.addFee(sid, f.name.trim(), amt); toast('✉️ ' + t('feeAdded')); App.render();
    }
    if (kind === 'meeting') {
      ['date', 'time', 'purpose'].forEach(need);
      if (f.date && f.time && new Date(f.date + 'T' + f.time) < new Date()) { fieldErr(form, 'date', t('pastDate')); bad = true; }
      if (bad) return;
      API.scheduleMeeting(sid, f.date, f.time, f.purpose.trim(), f.location.trim()); toast('✉️ ' + t('meetingSaved')); App.render();
    }
    if (kind === 'reject') {
      need('reason'); if (bad) return;
      API.decide(sid, JSON.parse(form.dataset.ref), false, f.reason.trim(), form.dataset.label);
      closeModal(); toast(t('rejectedDone')); App.render();
    }
  }
};
