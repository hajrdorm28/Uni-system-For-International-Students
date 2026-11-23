# Front-end (static, no build step)

Open `index.html` in a browser, or run `npx serve frontend` / `python3 -m http.server -d frontend`.

**Demo accounts:** student `student1` / `1234` · staff `staff` / `1234`

## Structure
- `js/api.js`   – mock backend on localStorage. **Replace each function with a `fetch()` call** when the real API is ready (everything else only talks to `API.*`).
- `js/student.js`, `js/staff.js` – views per role. `js/app.js` – router, login/reset, inactivity timeout (15 min).
- `js/i18n.js`  – English + Arabic (RTL) strings. `css/styles.css` – styling + print layout.

## Covered requirements
FR1–FR17 and user stories 1–16 (sign in, reset password, service buttons with status, printable papers, PDF/PNG/JPG upload,
staff add/edit/search students, additional fees, approve/reject with reason, meetings, email-notification log, fees report + CSV).
Emails are simulated (shown in notifications / "Email sent"); passwords are plain text only inside the mock.
