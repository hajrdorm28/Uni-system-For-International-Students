/* App shell: router, auth screens, layout, inactivity timeout */
const IDLE_MS = 15 * 60 * 1000; // NFR: sessions expire after inactivity
let idleTimer = null;

const App = {
  me: null,

  /* navigate then render exactly once (hashchange renders when the hash really changes) */
  go(h) { if (location.hash === h) this.render(); else location.hash = h; },

  render() {
    this.me = API.session();
    const hash = location.hash.replace(/^#/, '') || '/';
    const [, a, b, c] = hash.split('/');           // /student/service/medical -> a=student b=service c=medical
    const app = $('#app');

    // --- public routes ---
    if (a === 'forgot') return app.innerHTML = this.shell(this.forgotView(), false);
    if (a === 'reset') return app.innerHTML = this.shell(this.resetView(b), false);
    if (!this.me) {
      if (a && a !== 'login') { location.hash = '#/login'; return; }
      return app.innerHTML = this.shell(this.loginView(), false);
    }

    // --- role guard (FR4) ---
    const home = this.me.role === 'STAFF' ? '#/staff' : '#/student';
    if (!a || a === 'login' || (a === 'student' && this.me.role !== 'STUDENT') || (a === 'staff' && this.me.role !== 'STAFF')) {
      location.hash = home; return;
    }

    let body = '';
    if (a === 'student') {
      if (b === 'service') body = StudentViews.service(this.me, c);
      else if (b === 'notifications') body = StudentViews.notifications(this.me);
      else body = StudentViews.dashboard(this.me);
    } else {
      if (b === 'students') body = StaffViews.students();
      else if (b === 'student') body = StaffViews.student(c);
      else if (b === 'review') body = StaffViews.review();
      else if (b === 'reports') body = StaffViews.reports();
      else if (b === 'print') body = PrintingViews.page();
      else body = StaffViews.dashboard();
    }
    app.innerHTML = this.shell(body, true, a, b);
    if (a === 'staff' && b === 'print') PrintingViews.mount();
    window.scrollTo(0, 0);
    this.armIdle();
  },

  nav(role, a, b) {
    const link = (h, label, on) => `<a href="${h}" class="${on ? 'on' : ''}">${label}</a>`;
    if (role === 'STUDENT') {
      const unread = API.notificationsOf(this.me.id).filter(n => !n.read).length;
      return link('#/student', '🏠 ' + t('dashboard'), b !== 'notifications') +
        link('#/student/notifications', `🔔 ${t('notifications')}${unread ? ` <span class="dot">${unread}</span>` : ''}`, b === 'notifications');
    }
    const pend = API.pendingDocs().length;
    return link('#/staff', '🏠 ' + t('dashboard'), !b) + link('#/staff/students', '👥 ' + t('students'), b === 'students' || b === 'student') +
      link('#/staff/review', `📝 ${t('review')}${pend ? ` <span class="dot">${pend}</span>` : ''}`, b === 'review') + link('#/staff/reports', '📊 ' + t('reports'), b === 'reports') +
      link('#/staff/print', '🖨️ ' + t('printPapers'), b === 'print');
  },

  shell(body, authed, a, b) {
    return `<header class="top"><div class="brand"><span class="logo">🏛️</span><div><b>${t('uni')}</b><small>${t('appName')}</small></div></div>
        <nav>${authed ? this.nav(this.me.role, a, b) : ''}</nav>
        <div class="tools"><button class="btn ghost sm" data-lang>${t('lang')}</button>
          ${authed ? `<span class="who">${esc(this.me.name)}</span><button class="btn ghost sm" data-logout>${t('signOut')}</button>` : ''}</div></header>
      <main class="${authed ? '' : 'auth-main'}">${body}</main><footer>${t('footer')} <a href="#" data-resetdemo>↺ reset demo data</a></footer>`;
  },

  /* ---------- auth screens ---------- */
  loginView() {
    const msg = sessionStorage.getItem('uisys_flash'); sessionStorage.removeItem('uisys_flash');
    return `<div class="auth-card"><h1>${t('signIn')}</h1>
      ${msg ? `<div class="alert info-box">${esc(t(msg))}</div>` : ''}
      <form data-form="login" novalidate>
        <label>${t('username')}<input name="username" autocomplete="username" autofocus></label>
        <label>${t('password')}<input name="password" type="password" autocomplete="current-password"></label>
        <div class="err" id="loginErr"></div>
        <button class="btn primary block">${t('signIn')}</button></form>
      <p class="center"><a href="#/forgot">${t('forgot')}</a></p>
      <div class="demo"><b>${t('demoAccounts')}</b><br>${t('student')}: <code>student1</code> / <code>1234</code><br>${t('staff')}: <code>staff</code> / <code>1234</code></div></div>`;
  },
  forgotView() {
    return `<div class="auth-card"><h1>${t('resetTitle')}</h1><p>${t('resetIntro')}</p>
      <form data-form="forgot" novalidate><label>${t('email')}<input name="email" type="email" autofocus></label>
      <div id="forgotOut"></div><button class="btn primary block">${t('sendLink')}</button></form>
      <p class="center"><a href="#/login">${t('backToLogin')}</a></p></div>`;
  },
  resetView(token) {
    if (!API.checkReset(token)) return `<div class="auth-card"><div class="alert err-box">${t('linkExpired')}</div><p class="center"><a href="#/forgot">${t('resetTitle')}</a></p></div>`;
    return `<div class="auth-card"><h1>${t('resetTitle')}</h1><form data-form="reset" data-token="${esc(token)}" novalidate>
      <label>${t('newPassword')}<input name="pw" type="password" autofocus></label>
      <label>${t('confirmPassword')}<input name="pw2" type="password"></label>
      <button class="btn primary block">${t('saveNewPassword')}</button></form></div>`;
  },

  /* ---------- inactivity ---------- */
  armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { API.logout(); sessionStorage.setItem('uisys_flash', 'sessionExpired'); this.go('#/login'); }, IDLE_MS);
  },

  /* ---------- events ---------- */
  init() {
    window.addEventListener('hashchange', () => { closeModal(); this.render(); });

    document.addEventListener('click', async e => {
      if (this.me) this.armIdle();
      if (e.target.closest('[data-lang]')) { setLang(LANG === 'en' ? 'ar' : 'en'); return this.render(); }
      if (e.target.closest('[data-logout]')) { API.logout(); return this.go('#/login'); }
      if (e.target.closest('[data-resetdemo]')) { e.preventDefault(); if (confirm('Reset demo data?')) { resetDemoData(); API.logout(); this.go('#/login'); } return; }
      if (!this.me) return;
      if (this.me.role === 'STUDENT') await StudentViews.handleClick(e, this.me);
      else StaffViews.handleClick(e);
    });
    document.addEventListener('change', async e => {
      if (this.me && this.me.role === 'STUDENT') await StudentViews.handleChange(e, this.me);
      if (this.me && this.me.role === 'STAFF') StaffViews.handleInput(e);
    });
    document.addEventListener('input', e => { if (this.me && this.me.role === 'STAFF') StaffViews.handleInput(e); });

    document.addEventListener('submit', e => {
      const form = e.target.closest('[data-form]'); if (!form) return;
      e.preventDefault();
      const k = form.dataset.form, f = Object.fromEntries(new FormData(form));
      if (k === 'login') {
        const s = API.login(f.username, f.password);
        if (!s) { $('#loginErr').textContent = t('badLogin'); return; }
        this.go(s.role === 'STAFF' ? '#/staff' : '#/student');
      } else if (k === 'forgot') {
        const tok = API.requestReset(f.email), out = $('#forgotOut');
        out.innerHTML = tok
          ? `<div class="alert ok-box">✉️ ${t('resetSent')}<br><small>${t('demoLink')}:</small><br><a href="#/reset/${tok}">${t('resetTitle')}</a></div>`
          : `<div class="alert err-box">${t('emailNotFound')}</div>`;
      } else if (k === 'reset') {
        clearErrs(form);
        if (f.pw.length < 4) return fieldErr(form, 'pw', t('pwShort'));
        if (f.pw !== f.pw2) return fieldErr(form, 'pw2', t('pwMismatch'));
        if (API.doReset(form.dataset.token, f.pw)) { sessionStorage.setItem('uisys_flash', 'pwChanged'); this.go('#/login'); }
        else { this.go('#/forgot'); }
      } else if (this.me && this.me.role === 'STAFF') StaffViews.submit(form);
    });

    this.render();
  }
};
App.init();
