# AGENTS.md — Dance District Backend (`dance_district`)

Guidance for AI agents and developers working on this repo. Read it fully before making changes.

> **Start here:** §0 (current production status and open items) and §12 (how to deploy). Both are kept up to date.
The frontend is a separate repo at `../TDD_frontend_v1` (it has its own `AGENTS.md`). Most backend changes also need a frontend change, so check both sides before you finish.

---

## 0. Current status (last updated 2026-11-21)

**Production is live** at https://www.thedancedistrictbysahitya.in (and the bare domain), on the AWS server described in §12. Both repos are on `main` and deployed:

| | Status |
|---|---|
| Website, API, admin dashboard | ✅ Live, serving the production Atlas DB |
| HTTPS | ✅ Let's Encrypt for `www` and the bare domain, auto-renews (certbot.timer) |
| WhatsApp renewal reminders | ✅ ON (`ENABLE_CRON=true`), daily 10:56 IST, sent 7 days before, 1 day before and on the expiry day |
| WhatsApp booking confirmations | ✅ Code active; they only fire after a successful payment |
| **Online payments** | ❌ **No live gateway.** The server `.env` has PhonePe **TEST** credentials (`CLIENT_ID=TEST-…`), so "Pay" fails and leaves `paymentResult.status: 'initiated'` records (harmless; real members are `COMPLETED`). The owner is getting a gateway: either live PhonePe keys (only `.env` changes needed) or another gateway (write a new service next to `services/phonepe.js` plus the two `check-status` handlers). The PhonePe SDK also logs a "Client Not Found" error at startup because of the test keys; that's expected |
| **Uploaded photos** | ❌ Lost with the old server. `Media` documents point to files that don't exist (images 404 / "No Image"). **The client is re-uploading** them via the admin dashboard (edit each workshop and plan) |
| Old server `13.203.196.222` (AWS Mumbai, other account) | Dead/blocked and unreachable. It must never run again with its cron, or reminders would be sent twice |

**Open to-dos for the owner** (remind them if they're still open):
1. **Rotate the MongoDB Atlas password and the MSG91 auth key.** Both GitHub repos are **public**, and older commits contain them in source. Consider making the repos private.
2. MongoDB Atlas → Network Access: the server connected without a confirmed allow-list entry, so `0.0.0.0/0` may be open. Restrict it to `13.54.85.27/32`.
3. Add live payment gateway credentials when available.
4. Optional: ask the AWS Organization admin to allow `ap-south-1` (Mumbai) for lower latency (see §12).

**History of the 2026-11 refactor** (so you don't redo it): folders renamed (`controlers` → `controllers`, `modals` → `models`), `config/` + `services/` added, every admin route locked with `isAdmin`, idempotent payment returns, pending renewals, server-side workshop pricing, email removed (WhatsApp only), hardcoded secrets and URLs removed, PhonePe SDK vendored, e2e test suite added (`npm test`).

## 1. What this is

REST API for **The Dance District by Sahitya**, a dance studio in Bengaluru. It handles:

- **Membership plans**: dance classes sold monthly, quarterly, half-yearly or yearly, with batches (weekly schedules). People book online and renew through **PhonePe**, and admins can book or renew manually.
- **Workshops**: one-off events with batches and tiered pricing (early bird / regular / on the spot), paid through PhonePe.
- **Class types** (dance styles), **class sessions** and enrollments.
- **Leads**: enquiries, demo-class bookings, rental contacts.
- **WhatsApp** messages through **MSG91** (confirmations, renewal reminders, bulk campaigns). This is the only channel to customers; there is no email.
- **Media uploads** (images are converted to WebP with `sharp`), served from `/api/assets`.
- **Admin auth** with JWT.

Live site and API: `https://www.thedancedistrictbysahitya.in` (API under `/api/`). All public URLs come from `config/` (§5).

## 2. Tech stack

| Concern | Choice |
|---|---|
| Runtime | Node.js, **CommonJS** (`require` / `module.exports`). Do not use ESM `import` |
| Framework | **Express 5**: rejected async handlers go to the central error handler in `app.js` |
| DB | **MongoDB Atlas** via **Mongoose 8** |
| Validation | `express-validator` in route files, plus manual checks in controllers |
| Auth | `jsonwebtoken`, `bcryptjs` |
| Payments | `pg-sdk-node` 2.0.2 (PhonePe Standard Checkout), **vendored** at `vendor/pg-sdk-node-2.0.2.tgz` and wrapped in `services/phonepe.js` |
| Messaging | MSG91 WhatsApp API, wrapped in `services/whatsapp.js` |
| Uploads | `multer` (disk) and `sharp`; optional Ghostscript (`gs`) to compress PDFs |
| Scheduling | `node-cron` inside the API process, timezone `Asia/Kolkata` |
| Security | `helmet`, `cors` (allow-list from config), 10 MB body limit |

There is no TypeScript and no test framework. Match the style (2- vs 4-space indentation) of the file you edit.

## 3. Commands

```bash
npm install
cp .env.example .env      # then fill in values (see §11)
npm run dev               # nodemon app.js
npm start                 # node app.js (production)
npm run fix-quarterly-end-dates   # one-off migration, WRITES TO THE CONFIGURED DB
```

### Testing
```bash
npm test          # tests/e2e.js: 77 end-to-end checks (needs MongoDB on 127.0.0.1:27017)
npm run routes    # scripts/list-routes.js: every route + its auth middleware (set CLIENT_ID=x CLIENT_SECRET=x)
```
- `npm test` boots the real app on port **4099** against the throwaway DB **`dds_refactor_test`** (dropped before and after) with **dummy credentials**. PhonePe and MSG91 are faked, and **every other outbound HTTP call is blocked**. It covers auth/roles, public endpoints, membership booking + idempotent `check-status`, pending renewals (fail and success), the reminder template, workshop server-side pricing (409 on stale price), idempotent workshop confirmation, manual bookings and admin listings. **Run it after every backend change and extend it when you add behaviour.** If it reports "HARNESS ERROR … databaseName", something else is already listening on port 4099.
- For a routing change, save `npm run routes` output before and after and `diff` them.
- Always `node --check` the files you touched.
- Never point experiments at the production Atlas DB. For manual testing use a local DB (`DANCE_DISTRICT_DB_URL=mongodb://127.0.0.1:27017/<scratch_db>`), dummy `CLIENT_ID` / `CLIENT_SECRET` / `MSG91_AUTHKEY`, `PHONEPE_ENV=SANDBOX` and `ENABLE_CRON=false`.
- **Testing the built frontend:** in `../TDD_frontend_v1`, run `npm run build && npx vite preview` (port 4173, proxies `/api` to `localhost:4044`) with this backend running locally. Always check the **production bundle** in a browser before deploying frontend changes; a dev-only check once missed a bug that broke every API call in production.
- To look at real data locally: `mongodump` the production DB (**read-only**), `mongorestore` it into a separate local DB (e.g. `dds_local_preview`), run with dummy keys and cron off, and **delete the dump and the DB afterwards** (they contain customer PII).

## 4. Directory layout

```
app.js                    # Entry: ensures upload dirs, cron jobs, middleware, routes, 404 + error handler, DB connect + listen
config/index.js           # ALL env-dependent values (URLs, secrets, fees, CORS). The only place that reads process.env
services/
  phonepe.js              # createCheckout({ merchantOrderId, amountInRupees, statusPath }), getOrderStatus(id)
  whatsapp.js             # formatPhoneNumber, sendTemplate, sendText, sendMembershipConfirmation,
                          #   sendWorkshopConfirmation, sendRenewalReminder, getDeliveryReport
authentication/is-auth.js # isAuth, isAdmin, isSelfOrAdmin(param) middleware (default export = isAuth)
routes/<Feature>/index.js       # Express routers: validators + auth middleware + controller
controllers/<Feature>/index.js  # Request handlers (business logic)
models/<Model>/index.js         # Mongoose schemas
cronJobs/renewalAlerts.js       # sendDailyRenewalAlerts(), findBookingsDueForRenewal(); also runnable standalone
utils/
  statusCodes.js          # STATUS.SUCCESS, CREATED, BAD_REQUEST, UNAUTHORISED, FORBIDDEN, NOT_FOUND (404), ...
  messages.js             # MESSAGE.* strings
  validations.js          # validateName / validatePassword / ... (async, return { status })
  functions.js            # getInternalEmailFromPhone()
  constants.js            # allowedFileTypes (upload whitelist), size limits
scripts/                  # one-off maintenance scripts (see §10) + list-routes.js (npm run routes)
tests/e2e.js              # end-to-end test suite (npm test), see §3
vendor/                   # pg-sdk-node-2.0.2.tgz (vendored PhonePe SDK, see §8)
assets/                   # uploaded files, served at /api/assets/* (runtime data, see §9)
.env.example              # every supported env var
```

Folder casing is mixed (`media`, `mediaType` vs `ClassTypes`). Production runs on Linux, which is case-sensitive, so `require` paths must match exactly.

## 5. Configuration (`config/index.js`)

- **Never read `process.env` anywhere else, and never hardcode a URL, key, phone number or fee.** Add the value to `config/`, document it in `.env.example`, and import `config`.
- Required env vars (the app refuses to start without them): `DANCE_DISTRICT_DB_URL`, `DANCE_DISTRICT_JWT_SECRET`, `CLIENT_ID`, `CLIENT_SECRET`.
- `config.urls`: `frontend`, `publicApi`, `paymentSuccess`, `paymentFailure`, `renewalForm(bookingId)`. The defaults are the bysahitya domain.
- `config.fees`: `membershipRegistration` (₹500, first booking only) and `workshopProcessing` (₹50).
- `config.studio`: `contactNumber` and `address`, which are used in WhatsApp templates.
- `config.corsOrigins`: the allowed browser origins. Same-origin requests and requests without an Origin header (PhonePe redirects, curl) are always allowed.
- `config.enableCron`: set `ENABLE_CRON=false` on all but one instance if you ever run more than one.

## 6. Request flow and conventions

All routes are mounted under `/api/` in `app.js`:

| Mount | Router / controller folder |
|---|---|
| `/api/user` | `User` |
| `/api/media-type` | `mediaType` |
| `/api/media` | `media` |
| `/api/class-type` | `ClassTypes` |
| `/api/workshop` | `Workshops` |
| `/api/class-session` | `ClassSessions` |
| `/api/membership-plan` | `MembershipPlans` |
| `/api/bulk-messages` | `BulkMessages` |
| `/api/renewal-alerts` | `RenewalAlerts` |
| `/api/rental-contact` | `RentalContact` |
| `/api/enquire` | `Enquire` |
| `/api/demoClass` | `DemoClass` |
| `/api/assets/*` | static files from `assets/` |
| `/api/health` | `{status:'ok'}` (503 if the DB is down); use it for load-balancer health checks |

Unknown `/api/*` paths return `404 {message:'Not Found'}`. Uncaught errors return `500 {message:'Internal Server Error'}` and are logged.

### Adding a feature
1. **Model**: `models/<Name>/index.js`. Use `new Schema({...}, { timestamps: true })` with the standard `toJSON` transform (`ret.id = ret._id; delete ret._id; delete ret.__v;`). Register it with `mongoose.model('<uniquelowercasename>', schema)`. **Model names must be unique** (`booking` is taken by WorkshopBooking).
2. **Controller**: `controllers/<Name>/index.js`, using `exports.fn = async (req, res) => { try { … } catch (err) { … } }`.
3. **Router**: `routes/<Name>/index.js`. Put auth middleware first, then validators, then the handler. **Declare static paths before param paths** (`/bookings` before `/:id`).
4. **Mount** it in `app.js`.
5. **Frontend**: call it through the frontend's API client (see its `AGENTS.md`).

### Response shapes (no single convention, so don't "normalize" existing ones)
- Older modules (User, ClassTypes, media) return `{ message, data }` using `STATUS` / `MESSAGE`.
- Newer modules (MembershipPlans, Workshops, DemoClass) return `{ error }` on failure, and on success either the raw document or `{ success, data }`.
- The frontend parses these exact shapes. If you change one, update every consumer in `../TDD_frontend_v1/src` (search for the path).

### Data conventions
- Enums are UPPER_CASE, **except `billing_interval`**, which is lowercase: `monthly | quarterly | half_yearly | yearly` (it matches the `plan.prices` keys). Normalize input with `normalizeBillingInterval()`. The interval-to-months maps live in `controllers/MembershipPlans` (`INTERVAL_TO_MONTHS`) and `models/MembershipBooking` (`INTERVAL_TO_MONTHS`, `NORMALIZE_INTERVAL`); keep them in sync.
- Gender: `'Male' | 'Female' | 'Other'`.
- Membership batch times are `"HH:MM"` strings. Workshop batch times are `Date`s.
- Money is stored in **rupees**. `services/phonepe` converts to paise.
- Phones are strings (except `Enquire` and `RentalContact`, where `phone_number` is a Number). Format with `whatsapp.formatPhoneNumber()` (`+91XXXXXXXXXX`).
- Public forms collect phone, not email. `getInternalEmailFromPhone()` produces `<digits>@member.thedancedistrict.local` placeholders. Never send mail to them.
- Mongoose strict mode **silently drops fields that aren't in the schema**, including in `findByIdAndUpdate`. Declare new fields in the model.

## 7. Authentication and authorization

- `POST /api/user/login` takes `{ email, password }`. It looks up `email_data.temp_email_id` and returns `{ data: { access_token, refresh_token, user_id, name, email, role } }`. An unknown email returns 404 and a wrong password returns 401.
- JWT payload: **`{ uid, role }`**, signed with `config.jwt.secret`.
- Clients send the token in the `Authorization` header, **raw** (the frontend does this). A `Bearer ` prefix is also accepted.
- Middleware (`authentication/is-auth.js`). Each one verifies the signature and expiry and sets `req.user = { id, role }` and `req.userId`:
  - `isAuth`: any logged-in user.
  - `isAdmin`: role `ADMIN` only (403 otherwise).
  - `isSelfOrAdmin('paramName')`: the user's own record (`req.params[paramName] === req.user.id`) or an admin.
- **Every admin endpoint must use `isAdmin` in its route.** Some controllers also call `jwt.decode()` for role checks; that's redundant but harmless, because the route has already verified the token. Don't rely on `jwt.decode` alone, since it doesn't verify anything.
- **Public on purpose** (keep these public): `POST user/login`; `GET membership-plan`, `GET membership-plan/:id`, `POST membership-plan/booking`, `GET membership-plan/check-status`, `POST membership-plan/:id/renew`; `GET workshop`, `GET workshop/:id`, `POST workshop/book`, `GET workshop/check-status`; `GET class-type*`; `GET class-session`; `POST enquire`, `POST rental-contact`, `POST demoClass/demo-bookings`; `GET media/videos`.
- Roles: `ADMIN`, `COACH`, `USER`. `User.role` defaults to `'ADMIN'`, so always set the role explicitly. New users (any role) can only be created by an admin through `POST user/register-token` or `POST user/add-coach`.
- Members auto-created on their first paid membership get role `USER` and the password `<FirstName>@123`.

## 8. Core business flows

### Membership booking (public)
1. `POST /membership-plan/booking` with `{ planId, batch_id, billing_interval, name, age, mobile_number, gender }`. Price = `plan.prices[interval]` + `config.fees.membershipRegistration`. This creates a `MembershipBooking` (`paymentResult.status: 'initiated'`, no user yet) and returns `{ booking, checkoutPageUrl }`. **merchantOrderId = booking `_id`.**
2. PhonePe sends the browser to `GET /membership-plan/check-status?merchantOrderId=…`. On `COMPLETED`, the handler finds or creates the user by phone, sets `user` and `paymentResult.status = 'COMPLETED'`, takes a batch seat (atomic `$inc`), sends the WhatsApp `membership_confirmation` template, and **redirects** to `config.urls.paymentSuccess`. On any other state it marks `FAILED` and redirects to `paymentFailure`.
3. **Idempotent**: `paymentResult.processed_order_id` records the applied order, and a repeat visit just redirects to success. The claim is atomic (`findOneAndUpdate` on `processed_order_id ≠ id`) and is released if processing throws.

### Membership renewal
- The customer opens the WhatsApp link `/renewalform/<bookingId>` and the frontend calls `POST /membership-plan/<bookingId>/renew` with `{ planId, batchId, billing_interval }`.
- Renewal is allowed once `end_date` is within `RENEWAL_WINDOW_DAYS` (30). It charges `plan.prices[interval]` with **no registration fee**. If the plan has no price for that interval, it returns 400.
- **The member comes from the booking, never from the request body.** For legacy bookings without `user`, the user is found or created by phone.
- **Nothing changes until payment succeeds**: the request only stores `pending_renewal { plan, batchId, billing_interval, merchant_order_id }`. merchantOrderId = `ORDER_<timestamp>_<bookingId>`, and the `ORDER_` prefix is how `check-status` recognises a renewal.
- On `COMPLETED`, it applies the pending plan, batch and interval and sets `end_date = max(current end_date, now) + interval`. Early renewals don't lose days. `start_date` never changes, `renewal_date = now`, and a seat is taken in the new batch. On failure or abandonment it only clears `pending_renewal`, so the paid membership stays `COMPLETED`.
- Admin manual renewal: `POST /renew-manual/:id` sets dates and status directly and clears any `pending_renewal`.
- `discontinued` flags a member who stopped coming: `PATCH /booking/:id/discontinued` toggles it and `PATCH /booking/:id/reactivate` clears it.

### Renewal reminders
- A daily cron at **10:56 IST** runs `sendDailyRenewalAlerts()`. Each paid member (`paymentResult.status: 'COMPLETED'`, has a `user`) gets **exactly three reminders**: when their `end_date` falls on the India-time calendar day **7 days ahead, 1 day ahead, and on the expiry day** (`REMINDER_DAYS_BEFORE_EXPIRY = [7, 1, 0]` in `cronJobs/renewalAlerts.js`). The template is `renewal` (name, end date, `config.urls.renewalForm(id)`, studio contact). Because selection is by calendar day, the cron must run **once per day**: a second run on the same day would resend.
- Admins can trigger it manually: `POST /renewal-alerts/send-bulk` sends today's due reminders (same 7/1/0 rule, so don't run it on a day the cron already ran), and `POST /renewal-alerts/send/:bookingId` sends one member's reminder (allowed from 30 days before to 2 days after expiry).

### Workshop booking (public)
1. `POST /workshop/book` with `{ workshopId, batchIds[], name, age, mobile_number, gender, price }`.
2. **The server computes the price.** `getBatchTicketPrice()` gives the early-bird price while `pricing.early_bird.capacity_limit > 0`, otherwise the regular price. This **must match `getBatchPrice()` in the frontend's `src/pages/WorkshopDetails.jsx`**. If the client's `price` differs, the response is `409 { error, expectedPrice }`. Each batch can appear only once. The charge is tickets + `config.fees.workshopProcessing`.
3. `GET /workshop/check-status` works like the membership one: idempotent (already `CONFIRMED` means redirect to success; concurrent requests are blocked by an atomic `paymentResult.processing` claim). It takes one seat and one early-bird slot per batch (`decrementBatchSeats`), sets `CONFIRMED`, sends the WhatsApp `workshop_confirmation` template, and redirects. On failure it sets `status: 'FAILED'`.
4. Admin manual booking: `POST /workshop/manual-booking` (if no batch is given, it uses the first one; a paid booking takes a seat).

### WhatsApp templates (MSG91, namespace in `services/whatsapp.js`)
`membership_confirmation` (5 body params), `workshop_confirmation` (6), `renewal` (4), `junaid_shariff_workshop` (bulk video campaign, `en_GB`). The template text and buttons live in the MSG91 dashboard. If you change the number or order of params here, the template must change too.

### Media upload
`POST /api/media` (admin, multipart field **`media`**, ≤100 MB, mimetypes from `utils/constants.allowedFileTypes`; an unsupported or missing file returns 415). Images become WebP under `assets/images/{full,thumb}/{high_res,low_res}/`. PDFs are compressed with Ghostscript **if `gs` is installed** (it's run through `execFileSync`, never a shell string); otherwise the original is stored. The response includes the media `id`, which other documents reference (`User.media[]`, `Workshop.media[]`, `MembershipPlan.image`).

## 9. Operational notes and gotchas

1. **Uploaded files are runtime data.** The production `assets/` folder (especially `assets/images/full/*`) exists only on the server, not in git. When migrating servers, **copy `assets/` across**. Use persistent storage (an EBS volume or S3) in production. `app.js` creates missing upload directories at startup and `chdir`s to the repo root, because upload paths are relative.
2. **Model name `booking`** belongs to `models/WorkshopBooking`. Don't register another model with that name.
3. **Secrets**: they live only in `.env` (git-ignored). Older commits contain the MongoDB password, the MSG91 key and an unrelated SMTP password in source, so **they must be rotated**. Never put secrets in code, logs or docs.
4. **Don't log request headers or bodies**: they contain tokens and passwords.
5. **Only one instance may run the cron jobs** (otherwise every reminder is sent twice); see `ENABLE_CRON`.
6. The 01:01 cleanup cron empties `assets/district_issues` and a few other legacy scratch folders (left over from a template project). Missing folders are skipped and errors are logged, never thrown.
7. When PhonePe reports a payment as `COMPLETED` but the workshop was cancelled or the batch is gone, the booking is marked `FAILED`. **The customer has paid and needs a manual refund.** Check the logs for `capacityOk` failures.
8. Large legacy controllers (`MembershipPlans` ≈ 2.3k lines) mix old and new styles. Keep changes surgical and follow the patterns in the function you're editing.
9. Unused or partial features: class sessions and enrollments plus the USER dashboard endpoints exist, but the frontend USER dashboard isn't routed. The COACH UI is hidden. `create-users-for-bookings` is a one-off admin migration.

### PhonePe SDK is vendored
PhonePe publishes the SDK at an **unversioned URL** whose contents change. On 2026-11-21 it served a 2.0.4 tarball with **no code in it**, which fails the lockfile integrity check and would break payments. The working 2.0.2 is committed as `vendor/pg-sdk-node-2.0.2.tgz` and referenced as `file:vendor/...`. To upgrade, download a specific version, check that the tarball contains `dist/`, test checkout in `PHONEPE_ENV=SANDBOX`, then replace the vendored file.

## 10. Scripts (`scripts/`)

These are one-off maintenance and debug scripts. Most connect to `mongodb://127.0.0.1:27017/dance_district` (local). `fixQuarterlyEndDates.js` and `cronJobs/renewalAlerts.js` use `config.dbUrl`, which **in production is the live DB**. Read a script fully before you run it, run it from the repo root, and never run a DB-writing script against production without the owner's approval. `mongoScript.js` is meant for mongosh, not Node.

## 11. Environment variables

See `.env.example` for the full list with defaults. Required: `DANCE_DISTRICT_DB_URL`, `DANCE_DISTRICT_JWT_SECRET`, `CLIENT_ID`, `CLIENT_SECRET`. Usually also set: `MSG91_AUTHKEY`, `WHATSAPP_NUMBER`, `DANCE_DISTRICT_PORT`, the token TTLs, and `FRONTEND_URL` / `PUBLIC_API_URL` if the domain changes.

## 12. Production deployment and operations

### Infrastructure
| Item | Value |
|---|---|
| AWS account | `533047842523` (part of an AWS Organization, management account `642504869186`) |
| **Region** | **`ap-southeast-2` (Sydney)**. A service control policy **denies EC2 in every other region**, including Mumbai `ap-south-1` |
| Local AWS CLI profile | `dancedistrict` (IAM user `dancedistrict-deploy`, `AmazonEC2FullAccess`). The profile's default region is `ap-south-1`, so **always pass `--region ap-southeast-2`** or `export AWS_PROFILE=dancedistrict AWS_REGION=ap-southeast-2`. In zsh, pass flags literally, not through an unquoted `$VAR` |
| EC2 instance | `i-03bbdbd2fe70dbd00`, Name `dancedistrict-prod`, t3.small, Ubuntu 24.04, 30 GB gp3 encrypted (`DeleteOnTermination=false`), 2 GB swap, timezone Asia/Kolkata |
| Public IP | Elastic IP **`13.54.85.27`** |
| Security group | `sg-09b2e071ec7a3a427` (`dancedistrict-web`): 80/443 open to all; **SSH 22 only from `106.51.188.170/32`** (the owner's office IP at setup time). If SSH times out, the owner's IP has probably changed, so add the new one: `aws ec2 authorize-security-group-ingress --group-id sg-09b2e071ec7a3a427 --protocol tcp --port 22 --cidr <ip>/32 --region ap-southeast-2 --profile dancedistrict` |
| SSH | `ssh -i ~/.ssh/dancedistrict-sydney.pem ubuntu@13.54.85.27` (the key exists only on the owner's Mac) |
| DNS | Registrar/DNS at **Spaceship** (`launch1/2.spaceship.net`). `@` and `www` → A `13.54.85.27` |
| Database | MongoDB Atlas (unchanged), via `DANCE_DISTRICT_DB_URL` in the server `.env` |

### Layout on the server
```
/srv/dancedistrict/backend    # git clone of this repo (main); .env here (chmod 600, never committed)
/srv/dancedistrict/frontend   # git clone of TDD_frontend_v1 (main); nginx serves its committed dist/
/etc/nginx/sites-available/dancedistrict   # site config (symlinked in sites-enabled)
```
- **nginx:** serves `frontend/dist` with an SPA fallback (`try_files … /index.html`), `/assets/` cached 7 days, `/api/` proxied to `127.0.0.1:4044`, `client_max_body_size 110m`. Certbot added the 443 server block and the port-80 → https redirects (`# managed by Certbot`).
- **PM2:** one process, **`dancedistrict-api`** (`app.js`, `--max-memory-restart 700M`), started on boot by the `pm2-ubuntu` systemd unit (`pm2 save` after any process change). Only **one** instance may run, because the cron jobs live in-process.
- **TLS:** certificate name `www.thedancedistrictbysahitya.in` covers both hostnames. It renews through `certbot.timer`. `/usr/local/bin/dd-apex-cert.sh` was a one-off helper and its cron entry has removed itself.
- Ghostscript is installed, so PDF uploads are compressed.
- **The server `.env`** = the owner's local `.env` plus `ENABLE_CRON=true` (and a comment). To change a value: `nano /srv/dancedistrict/backend/.env`, then `pm2 restart dancedistrict-api --update-env`. **Never print it or copy it into chat or logs.** Secrets should be entered by the owner, not typed by an agent.

### Deploying
Backend (after pushing to `main`):
```bash
ssh -i ~/.ssh/dancedistrict-sydney.pem ubuntu@13.54.85.27 \
  'cd /srv/dancedistrict/backend && git pull && npm ci --omit=dev && pm2 restart dancedistrict-api && sleep 4 && curl -s localhost:4044/api/health'
```
Frontend: build locally, check the production bundle (§3), **commit `dist/`**, push, then:
```bash
ssh -i ~/.ssh/dancedistrict-sydney.pem ubuntu@13.54.85.27 'cd /srv/dancedistrict/frontend && git pull'
```
(No restart needed; nginx serves the new files immediately.)

After any deploy, verify: `curl https://www.thedancedistrictbysahitya.in/api/health` returns `{"status":"ok"}`, key pages return 200, and an admin endpoint without a token returns 401. Load the changed page in a browser on the live domain.

### Operations cheatsheet (on the server)
```bash
pm2 status                                   # process state + restart count
pm2 logs dancedistrict-api --lines 100       # app logs (…/.pm2/logs/dancedistrict-api-{out,error}.log)
sudo tail -f /var/log/nginx/access.log       # traffic (bots probe /api/graphql etc.; ignore those)
sudo nginx -t && sudo systemctl reload nginx # after editing the nginx config
sudo certbot certificates                    # cert domains + expiry
df -h /                                      # disk (uploads live under backend/assets/)
```
- **Uploaded files** live in `/srv/dancedistrict/backend/assets/` on the EBS root volume, **not in git**. Snapshot the volume before risky server work. If you ever move servers, copy `assets/` across.
- Git-tracked thumbnails under `assets/images/thumb/` would conflict with `git pull` only if both sides change the same file; uploads use UUID filenames, so that doesn't happen in practice.
- **Before changing anything that affects reminders or payments, check how many real customers it will touch.** Query the production DB read-only from the server (`findBookingsDueForRenewal(date)` in `cronJobs/renewalAlerts.js` accepts a date for previewing a run).

## 13. Checklist before you finish a change

- [ ] No `process.env` outside `config/`. No hardcoded URLs, keys, fees or phone numbers.
- [ ] New routes: correct auth (`isAdmin` for admin, public only if the public site needs it), static paths before `/:id`, validators in place.
- [ ] Existing response shapes are unchanged, or every frontend consumer is updated.
- [ ] New schema fields are declared in the model.
- [ ] Payment, WhatsApp and seat logic stay idempotent. No double charge, double seat or double message on repeat requests.
- [ ] Workshop price rules are still identical to the frontend's `getBatchPrice()`.
- [ ] `node --check` passes and **`npm test` passes** (extend `tests/e2e.js` for new behaviour).
- [ ] Deployed per §12 if the owner asked for it, verified on the live domain, and §0 updated if the status changed.
- [ ] This file (and the frontend `AGENTS.md`, if the API contract changed) is updated.
