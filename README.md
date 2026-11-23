# International Students - Printing module

Prints student papers from templates stored in the database. Pick a student, pick a template,
get a print-ready A4 HTML page. Every print is recorded in `print_log`.

Stack: .NET 10 (ASP.NET Core MVC), MySQL 8 via MySqlConnector. The student portal (`frontend/` in the
GitHub repo) is served by this app from `wwwroot`, so browser and API share one address and no CORS setup is needed.

## Setup

1. The module uses your existing `uni_international` database. It creates and alters nothing.
   Replace the password in `db/printing_app_grants.sql`, then run it as an admin account.
2. Put your settings in user-secrets (never commit them):

   ```
   cd src/InternationalStudents.Printing
   dotnet user-secrets set "ConnectionStrings:UniversityDb" "Server=localhost;Port=3306;Database=uni_international;User ID=printing_app;Password=YOUR_PASSWORD;CharSet=utf8mb4;SslMode=Preferred;"
   dotnet user-secrets set "Institution:UniversityName" "Kafr El-Sheikh University"
   dotnet user-secrets set "Institution:TimeZoneId" "Africa/Cairo"
   ```
   In Development the admin key is `dev-admin-key-change-me-123456` (appsettings.Development.json).
   Elsewhere set `Security__AdminApiKey`; the app refuses to start with the placeholder.
3. From the repository root: `dotnet restore`, `dotnet build`, `dotnet run --project src/InternationalStudents.Printing`
4. Open http://localhost:5080 and sign in as `staff` / `1234` (the portal's demo account).
5. Open **Print papers** in the top menu, enter the printing key (Development: `dev-admin-key-change-me-123456`)
   and the id of an ADMIN or ADVISOR row in `user` (e.g. 1), click Connect, pick a student and a template, Generate, Print.

`http://localhost:5080/printing-test/` is a minimal page that exercises only the API, handy when debugging the backend alone.

## Frontend

`wwwroot/` (except `printing-test/`) is a copy of the repo's `frontend/` folder (commit 9fcddb7) plus the printing page.
Only printing talks to this server; sign-in, uploads, fees, meetings, notifications and password reset still run on the
portal's localStorage mock (`js/api.js`) until backends exist for them. The student "Print paper" buttons also still use
the mock: the server cannot know which student is signed in until sign-in moves to the backend.

The changes to the team's files are in `frontend-print-integration.patch` (apply in the repo root with
`git apply frontend-print-integration.patch`): new `js/printing.js` and `css/printing.css`, plus 2 lines in `index.html`
and 3 in `js/app.js`. To take newer frontend work, copy the repo's `frontend/` over `wwwroot/` again (keep `printing-test/`),
or merge the patch into the repo's `frontend/` so both stay identical.

## Endpoints (all need `X-Admin-Key`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/templates` | Active templates (`print_template.is_active = 1`) |
| GET | `/api/students?search=&limit=&offset=` | Name (partial) or student number |
| GET | `/print/{studentId}/{templateCode}` | Also needs `X-Admin-User-Id`; returns HTML; writes `print_log` |

Errors are RFC 7807 JSON: 400 bad/missing header, 401 bad key, 403 requester is not ADMIN/ADVISOR,
404 unknown template or student, 422 template cannot be filled, 503 database unreachable.

## How a paper is built

1. `print_template.body_html` is the page; `{{placeholders}}` are filled from `template_field`.
2. `source_entity` / `source_column` are looked up in a fixed whitelist (no dynamic SQL):
   - USER: id, full_name, email, phone (never password_hash)
   - STUDENT: user_id, nationality, passport_number, date_of_birth, status
   - PAYMENT: id, amount, purpose, status, paid_at, from the student's PENDING payments whose
     purpose equals `print_template.payment_purpose`. `amount` is the SUM of those rows.
   - SYSTEM: university_name (config), document_no (the `print_log.reference_no`), current_date
3. `format_string` is applied (.NET format strings: `N2`, `dd MMM yyyy`). A missing value uses
   `default_value`, else fails if `is_required = 1`.
4. Values are HTML-encoded; the template HTML itself is trusted. Scripts are blocked by CSP.
5. A `print_log` row is written before the paper is returned (SUCCESS or FAILED with the reason).

To add a paper (Book Fees, Residency Fees, ...), insert rows into `print_template` and
`template_field`. No code change is needed.

## Decisions to confirm

- Access control is a stand-in (shared key + staff user id header). Replace `ApiKeyMiddleware`
  with the real sign-in module; `GenerateAsync` already takes the requesting user id.
- "Staff" means `user.role` of ADMIN or ADVISOR.
- Several pending payments of one purpose print as one summed amount.
- `current_date` uses `Institution:TimeZoneId` (default UTC).
