/*
 * Mock API layer (localStorage). Every function here maps to one backend endpoint.
 * When the real backend is ready, replace the body of each function with fetch(...)
 * (and make callers `await` them). Nothing outside this file touches localStorage data.
 *
 * NOTE: passwords are stored in plain text HERE ONLY because this is a mock.
 * The real backend must hash them (NFR Security).
 */
const SERVICES = ['medical', 'enrollment', 'book', 'residency', 'additional'];
const PAYABLE = ['enrollment', 'book', 'residency'];
const DB_KEY = 'uisys_db_v1', SESSION_KEY = 'uisys_session_v1';
const MAX_FILE = 1.5 * 1024 * 1024;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowISO = () => new Date().toISOString();

function emptyServices() {
  const o = {};
  ['medical', 'enrollment', 'book', 'residency'].forEach(k => o[k] = { status: 'notstarted', doc: null, reason: '', updatedAt: null });
  return o;
}

function seed() {
  const mk = (id, username, fullName, email, nat, passport, program, fees) => ({
    id, username, password: '1234', fullName, email, phone: '+20 100 000 ' + id.slice(-4), nationality: nat,
    passportNumber: passport, dob: '2002-05-14', program, fees, services: emptyServices()
  });
  const s1 = mk('2026001', 'student1', 'Ahmed Hassan Ali', 'ahmed@example.com', 'Sudan', 'P1234567', 'Pharmacy', { enrollment: 1500, book: 300, residency: 200 });
  const s2 = mk('2026002', 'student2', 'Amina Yusuf', 'amina@example.com', 'Nigeria', 'A7654321', 'Engineering', { enrollment: 1800, book: 350, residency: 200 });
  const s3 = mk('2026003', 'student3', 'Li Wei', 'liwei@example.com', 'China', 'G9988776', 'Medicine', { enrollment: 2500, book: 400, residency: 200 });
  s2.services.enrollment.status = 'pending';
  s2.services.enrollment.doc = { name: 'receipt-enrollment.png', type: 'image/png', size: 200, uploadedAt: nowISO(), dataUrl: SAMPLE_RECEIPT };
  s3.services.medical.status = 'completed';
  s3.services.enrollment.status = 'completed';
  return {
    staff: [{ id: 'staff1', username: 'staff', password: '1234', fullName: 'Mona Ibrahim (Student Affairs)', email: 'affairs@example.com' }],
    students: [s1, s2, s3],
    fees: [{ id: uid(), studentId: '2026001', name: 'Late registration fine', amount: 50, status: 'notstarted', doc: null, reason: '', createdAt: nowISO() }],
    meetings: [], notifications: [], resets: {}
  };
}
const SAMPLE_RECEIPT = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220"><rect width="100%" height="100%" fill="#fff" stroke="#999"/><text x="20" y="50" font-size="22" font-family="Arial">Payment Receipt (sample)</text><text x="20" y="100" font-size="16" font-family="Arial">Enrollment fees – 1800 USD</text><text x="20" y="150" font-size="16" font-family="Arial">Amina Yusuf – signed</text></svg>');

let DB = null;
function load() {
  if (DB) return DB;
  try { DB = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { DB = null; }
  if (!DB) { DB = seed(); save(); }
  return DB;
}
function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) { throw new Error('Storage is full. Clear data and try again.'); } }
function resetDemoData() { DB = seed(); save(); }

function notify(userId, msg, email = true) {
  load().notifications.unshift({ id: uid(), userId, msg, email, read: false, createdAt: nowISO() });
}

/* ---------- auth ---------- */
const API = {
  login(username, password) {
    const d = load(); username = (username || '').trim().toLowerCase();
    const u = d.staff.find(x => x.username === username && x.password === password)
      ? { ...d.staff.find(x => x.username === username), role: 'STAFF' }
      : (d.students.find(x => x.username.toLowerCase() === username && x.password === password)
        ? { ...d.students.find(x => x.username.toLowerCase() === username), role: 'STUDENT' } : null);
    if (!u) return null;
    const s = { id: u.id, role: u.role, name: u.fullName };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return s;
  },
  session() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } },
  logout() { localStorage.removeItem(SESSION_KEY); },
  requestReset(email) {
    const d = load(); email = (email || '').trim().toLowerCase();
    const st = d.students.find(s => s.email.toLowerCase() === email);
    if (!st) return null;
    const token = uid() + uid();
    d.resets[token] = { studentId: st.id, expires: Date.now() + 30 * 60 * 1000 };
    save(); return token;
  },
  checkReset(token) { const r = load().resets[token]; return !!r && r.expires > Date.now(); },
  doReset(token, pw) {
    const d = load(), r = d.resets[token];
    if (!r || r.expires < Date.now()) return false;
    d.students.find(s => s.id === r.studentId).password = pw; delete d.resets[token]; save(); return true;
  },

  /* ---------- student ---------- */
  getStudent(id) { return load().students.find(s => s.id === id) || null; },
  listStudents() { return load().students; },
  feesOf(id) { return load().fees.filter(f => f.studentId === id); },
  meetingsOf(id) { return load().meetings.filter(m => m.studentId === id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)); },
  notificationsOf(id) { return load().notifications.filter(n => n.userId === id); },
  markAllRead(id) { load().notifications.forEach(n => { if (n.userId === id) n.read = true; }); save(); },

  /** Status of a service for the dashboard ("additional" is derived from its fee items) */
  serviceStatus(student, key) {
    if (key !== 'additional') return student.services[key].status;
    const f = this.feesOf(student.id);
    if (!f.length) return 'none';
    if (f.some(x => x.status === 'rejected')) return 'rejected';
    if (f.some(x => x.status === 'notstarted')) return 'notstarted';
    if (f.some(x => x.status === 'pending')) return 'pending';
    return 'completed';
  },
  amountFor(student, key) {
    if (key === 'additional') return this.feesOf(student.id).reduce((a, f) => a + f.amount, 0);
    return student.fees[key] || 0;
  },

  /** target = service key, or {fee: feeId}. Validates type/size like the backend should. */
  uploadDocument(studentId, target, file, dataUrl) {
    if (!/^(application\/pdf|image\/(png|jpeg))$/.test(file.type)) throw new Error('badFile');
    if (file.size > MAX_FILE) throw new Error('fileBig');
    const d = load(), s = d.students.find(x => x.id === studentId);
    const rec = typeof target === 'string' ? s.services[target] : d.fees.find(f => f.id === target.fee);
    if (!rec || rec.status === 'pending' || rec.status === 'completed') throw new Error('locked');
    rec.doc = { name: file.name, type: file.type, size: file.size, uploadedAt: nowISO(), dataUrl };
    rec.status = 'pending'; rec.reason = ''; save();
  },

  /* ---------- staff ---------- */
  saveStudent(data, editingId) {
    const d = load();
    const dup = d.students.some(s => s.id !== editingId && (s.id === data.id || s.username.toLowerCase() === data.username.toLowerCase() || s.email.toLowerCase() === data.email.toLowerCase()));
    if (dup) throw new Error('dupStudent');
    if (editingId) {
      const s = d.students.find(x => x.id === editingId);
      if (!data.password) delete data.password; // blank = keep current password
      Object.assign(s, { ...data, id: editingId });
    } else {
      d.students.push({ ...data, services: emptyServices() });
    }
    save();
  },
  addFee(studentId, name, amount) {
    const d = load();
    d.fees.push({ id: uid(), studentId, name, amount, status: 'notstarted', doc: null, reason: '', createdAt: nowISO() });
    notify(studentId, `New additional fee: ${name} – ${amount} USD`); save();
  },
  scheduleMeeting(studentId, date, time, purpose, location) {
    const d = load(); d.meetings.push({ id: uid(), studentId, date, time, purpose, location });
    notify(studentId, `Meeting on ${date} at ${time} – ${purpose}${location ? ' (' + location + ')' : ''}`); save();
  },
  /** Everything uploaded and waiting */
  pendingDocs() {
    const d = load(), out = [];
    d.students.forEach(s => {
      Object.keys(s.services).forEach(k => { if (s.services[k].status === 'pending') out.push({ student: s, key: k, ref: k, rec: s.services[k], label: k }); });
    });
    d.fees.forEach(f => { if (f.status === 'pending') out.push({ student: d.students.find(s => s.id === f.studentId), key: 'additional', ref: { fee: f.id }, rec: f, label: f.name }); });
    return out.sort((a, b) => a.rec.doc.uploadedAt.localeCompare(b.rec.doc.uploadedAt));
  },
  decide(studentId, ref, approve, reason, label) {
    const d = load(), s = d.students.find(x => x.id === studentId);
    const rec = typeof ref === 'string' ? s.services[ref] : d.fees.find(f => f.id === ref.fee);
    rec.status = approve ? 'completed' : 'rejected'; rec.reason = approve ? '' : reason; rec.updatedAt = nowISO();
    notify(studentId, approve ? `Your document for "${label}" was approved.` : `Your document for "${label}" was rejected: ${reason}`);
    save();
  },
  /** Fees report rows: paid = completed items */
  report() {
    const d = load();
    return d.students.map(s => {
      let paid = 0, unpaid = 0;
      PAYABLE.forEach(k => { (s.services[k].status === 'completed' ? (paid += s.fees[k]) : (unpaid += s.fees[k])); });
      d.fees.filter(f => f.studentId === s.id).forEach(f => { f.status === 'completed' ? (paid += f.amount) : (unpaid += f.amount); });
      return { student: s, paid, unpaid, total: paid + unpaid };
    });
  }
};
