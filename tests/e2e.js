// End-to-end test of the whole backend against a THROWAWAY local MongoDB database.
// PhonePe and MSG91 are faked and ALL other outbound HTTP is blocked, so nothing real is ever contacted.
//
// Requirements: MongoDB running on 127.0.0.1:27017. Uses (and drops) the database "dds_refactor_test" only.
// Run from the repo root:   npm test
const path = require('path');
const BACKEND = path.resolve(__dirname, '..');
const r = require('module').createRequire(path.join(BACKEND, 'app.js'));

// Dummy values for everything external, so no real service can ever be reached by this test
// (dotenv never overrides variables that are already set).
process.env.DANCE_DISTRICT_DB_URL = 'mongodb://127.0.0.1:27017/dds_refactor_test';
process.env.DANCE_DISTRICT_PORT = '4099';
process.env.DANCE_DISTRICT_JWT_SECRET = 'e2e-test-secret';
process.env.CLIENT_ID = 'e2e-dummy-client';
process.env.CLIENT_SECRET = 'e2e-dummy-secret';
process.env.PHONEPE_ENV = 'SANDBOX';
process.env.MSG91_AUTHKEY = 'e2e-dummy-key';
process.env.WHATSAPP_NUMBER = '0000000000';
process.env.ENABLE_CRON = 'false';

// ---- fakes (installed before the app is loaded) ----
const phonepe = require(path.join(BACKEND, 'services/phonepe'));
const whatsapp = require(path.join(BACKEND, 'services/whatsapp'));
const calls = { pay: [], wa: [] };
let nextState = 'COMPLETED';
phonepe.createCheckout = async (args) => { calls.pay.push(args); return `https://fake-phonepe/checkout/${args.merchantOrderId}`; };
phonepe.getOrderStatus = async (id) => ({ state: nextState, orderId: id });
void whatsapp;

const mongoose = r('mongoose');
const axios = r('axios');
// Block ALL outbound HTTP from the app: MSG91 calls are recorded and answered locally, anything else throws.
const isLocal = (url) => String(url).startsWith('http://127.0.0.1:4099');
const realPost = axios.post.bind(axios);
const realGet = axios.get.bind(axios);
axios.post = async (url, body, opts) => {
  if (isLocal(url)) return realPost(url, body, opts);
  if (String(url).startsWith('https://api.msg91.com/')) {
    const t = body?.payload?.template;
    calls.wa.push({ name: t?.name || 'text', to: t?.to_and_components?.[0]?.to, components: t?.to_and_components?.[0]?.components, authkey: opts?.headers?.authkey });
    return { data: { status: 'success', hasError: false, request_id: 'fake' } };
  }
  throw new Error(`BLOCKED outbound POST in test: ${url}`);
};
axios.get = async (url, opts) => {
  if (isLocal(url)) return realGet(url, opts);
  throw new Error(`BLOCKED outbound GET in test: ${url}`);
};
const bcrypt = r('bcryptjs');
const jwt = r('jsonwebtoken');

require(path.join(BACKEND, 'app.js'));

const BASE = 'http://127.0.0.1:4099/api/';
const api = axios.create({ baseURL: BASE, validateStatus: () => true, maxRedirects: 0 });
let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } };

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { const res = await api.get('health'); if (res.status === 200) return; } catch (e) { /* not up yet */ }
    await new Promise((res) => setTimeout(res, 200));
  }
  throw new Error('server did not start');
}

(async () => {
  await waitForServer();
  const db = mongoose.connection.db;
  if (db.databaseName !== 'dds_refactor_test') throw new Error('REFUSING: not the test DB');
  await db.dropDatabase();

  const User = require(path.join(BACKEND, 'models/Users'));
  const MembershipBooking = require(path.join(BACKEND, 'models/MembershipBooking'));
  const MembershipPlan = require(path.join(BACKEND, 'models/MembershipPlans'));
  const Workshop = require(path.join(BACKEND, 'models/Workshops'));
  const WorkshopBooking = require(path.join(BACKEND, 'models/WorkshopBooking'));

  // ---------------------------------------------------------------- auth
  console.log('\nAuth');
  const admin = await User.create({ first_name: 'admin', last_name: 'one', email_data: { temp_email_id: 'admin@test.local' }, password: await bcrypt.hash('Admin@1234', 12), role: 'ADMIN' });
  const member = await User.create({ first_name: 'mem', last_name: 'ber', email_data: { temp_email_id: 'member@test.local' }, password: await bcrypt.hash('Member@1234', 12), role: 'USER' });

  let res = await api.post('user/login', { email: 'admin@test.local', password: 'Admin@1234' });
  check('admin login 200', res.status === 200 && res.data.data.access_token, res.data);
  const ADMIN = { headers: { Authorization: res.data.data.access_token } };
  res = await api.post('user/login', { email: 'member@test.local', password: 'Member@1234' });
  const USER = { headers: { Authorization: res.data.data.access_token } };
  res = await api.post('user/login', { email: 'nobody@test.local', password: 'x' });
  check('unknown email -> 404 (was 204)', res.status === 404, res.status);
  res = await api.post('user/login', { email: 'admin@test.local', password: 'wrong' });
  check('wrong password -> 401', res.status === 401);

  res = await api.get('enquire');
  check('admin list without token -> 401', res.status === 401, res.status);
  res = await api.get('enquire', USER);
  check('admin list as USER -> 403', res.status === 403, res.status);
  res = await api.get('enquire', ADMIN);
  check('admin list as ADMIN -> 200', res.status === 200, res.status);
  res = await api.get('enquire', { headers: { Authorization: `Bearer ${ADMIN.headers.Authorization}` } });
  check('"Bearer " prefix accepted', res.status === 200, res.status);
  const forged = jwt.sign({ uid: admin.id, role: 'ADMIN' }, 'wrong-secret');
  res = await api.get('enquire', { headers: { Authorization: forged } });
  check('forged token -> 401', res.status === 401, res.status);
  res = await api.post('user/register-token', { first_name: 'x', last_name: 'y', email_id: 'h@x.y', password: 'Hack@1234', role: 'ADMIN' });
  check('public admin self-registration blocked -> 401', res.status === 401, res.status);
  res = await api.get(`user/${member.id}`, USER);
  check('user can read own profile', res.status === 200, res.status);
  res = await api.get(`user/${admin.id}`, USER);
  check("user cannot read someone else's profile -> 403", res.status === 403, res.status);
  res = await api.get(`user/${member.id}`, ADMIN);
  check('admin can read any profile', res.status === 200, res.status);
  for (const [m, u] of [['post', 'workshop'], ['delete', 'membership-plan/000000000000000000000000'], ['post', 'bulk-messages/send-text'], ['post', 'renewal-alerts/send-bulk'], ['get', 'rental-contact'], ['get', 'demoClass/demo-bookings'], ['post', 'media'], ['get', 'membership-plan/bookings/all']]) {
    res = await api[m](u);
    check(`${m.toUpperCase()} ${u} requires login`, res.status === 401, res.status);
  }

  // ------------------------------------------------------- public + misc
  console.log('\nPublic endpoints & misc');
  for (const u of ['membership-plan', 'workshop', 'class-type', 'media/videos', '']) {
    res = await api.get(u);
    check(`GET /api/${u} public 200`, res.status === 200, [res.status, res.data]);
  }
  res = await api.get('does-not-exist');
  check('unknown route -> 404 JSON', res.status === 404 && res.data.message === 'Not Found', res.data);
  res = await api.post('media', {}, ADMIN);
  check('media upload without file -> 415 (was crash)', res.status === 415, [res.status, res.data]);
  res = await api.post('enquire', { name: 'Lead', phone_number: 9876543210, purpose: 'Classes' });
  check('public enquiry still works', res.status === 201, res.status);
  res = await api.post('demoClass/demo-bookings', { plan: new mongoose.Types.ObjectId().toString(), name: 'Demo', age: 20, mobile_number: '9876543210', gender: 'Male' });
  check('public demo booking still works', res.status === 201, res.status);
  res = await api.get('membership-plan/bookings', ADMIN);
  check('GET membership-plan/bookings reachable (was shadowed by /:id)', res.status !== 400, [res.status, res.data]);

  // ------------------------------------------------------- membership
  console.log('\nMembership booking');
  res = await api.post('class-type', { title: 'Hip Hop', level: 'ALL' }, ADMIN);
  check('admin creates class type', res.status === 201, [res.status, res.data]);
  const classTypeId = res.data.data?.id || res.data.data?._id || res.data.id;
  res = await api.post('membership-plan', {
    name: 'Hip Hop Adults', dance_type: classTypeId, prices: { monthly: 2500, quarterly: 7000 }, plan_for: 'ADULT',
    batches: [
      { schedule: [{ day: 'MONDAY', start_time: '18:00', end_time: '19:00' }], capacity: 10 },
      { schedule: [{ day: 'TUESDAY', start_time: '18:00', end_time: '19:00' }], capacity: 5 }
    ]
  }, ADMIN);
  check('admin creates plan', res.status === 201, [res.status, res.data]);
  let plan = await MembershipPlan.findOne({ name: 'Hip Hop Adults' }).lean();
  const [batchA, batchB] = plan.batches.map((b) => b._id.toString());

  res = await api.post('membership-plan/booking', { planId: plan._id.toString(), batch_id: batchA, billing_interval: 'monthly', name: 'Priya Rao', age: 25, mobile_number: '9876500001', gender: 'Female' });
  check('public booking -> 201 with checkout URL', res.status === 201 && res.data.checkoutPageUrl, [res.status, res.data]);
  const bookingId = res.data.booking.id || res.data.booking._id;
  const pay1 = calls.pay.at(-1);
  check('charged plan price + ₹500 registration', pay1.amountInRupees === 3000, pay1);
  check('PhonePe returns to bysahitya API', pay1.statusPath === 'membership-plan/check-status');

  nextState = 'COMPLETED';
  const waBefore = calls.wa.length;
  res = await api.get(`membership-plan/check-status?merchantOrderId=${bookingId}`);
  check('check-status redirects to success page on bysahitya domain', res.status === 302 && res.headers.location === 'https://www.thedancedistrictbysahitya.in/payment-success', [res.status, res.headers.location]);
  let bk = await MembershipBooking.findById(bookingId).lean();
  check('booking COMPLETED with user attached', bk.paymentResult.status === 'COMPLETED' && bk.user, bk.paymentResult);
  check('phonepeResponse now stored (was dropped by schema)', bk.paymentResult.phonepeResponse?.state === 'COMPLETED');
  const autoUser = await User.findById(bk.user).lean();
  check('member account created (USER, phone)', autoUser && autoUser.role === 'USER' && autoUser.phone_data.phone_number === '9876500001');
  plan = await MembershipPlan.findById(plan._id).lean();
  check('batch A seat taken (10 -> 9)', plan.batches[0].capacity === 9, plan.batches[0].capacity);
  check('one WhatsApp confirmation', calls.wa.length === waBefore + 1 && calls.wa.at(-1).name === 'membership_confirmation');

  res = await api.get(`membership-plan/check-status?merchantOrderId=${bookingId}`);
  plan = await MembershipPlan.findById(plan._id).lean();
  check('repeat check-status: success redirect, no double seat/WhatsApp', res.status === 302 && plan.batches[0].capacity === 9 && calls.wa.length === waBefore + 1, [plan.batches[0].capacity, calls.wa.length - waBefore]);

  console.log('\nMembership renewal');
  await MembershipBooking.updateOne({ _id: bookingId }, { end_date: new Date(Date.now() + 60 * 864e5) });
  res = await api.post(`membership-plan/${bookingId}/renew`, { planId: plan._id.toString(), batchId: batchB, billing_interval: 'quarterly' });
  check('renewal 60 days early -> 400 not due', res.status === 400, [res.status, res.data]);

  const endBefore = new Date(Date.now() + 10 * 864e5);
  await MembershipBooking.updateOne({ _id: bookingId }, { end_date: endBefore });
  res = await api.post(`membership-plan/${bookingId}/renew`, { planId: plan._id.toString(), batchId: batchB, billing_interval: 'quarterly', userId: admin.id });
  check('renewal within window (no userId needed) -> 201', res.status === 201 && res.data.checkoutPageUrl, [res.status, res.data]);
  const pay2 = calls.pay.at(-1);
  check('renewal charges quarterly price, no registration fee', pay2.amountInRupees === 7000, pay2);
  bk = await MembershipBooking.findById(bookingId).lean();
  check('userId from request body ignored', String(bk.user) === String(autoUser._id));
  check('membership untouched until paid', bk.paymentResult.status === 'COMPLETED' && String(bk.batchId) === batchA && bk.billing_interval === 'monthly' && bk.pending_renewal?.merchant_order_id === pay2.merchantOrderId, bk);

  nextState = 'FAILED';
  res = await api.get(`membership-plan/check-status?merchantOrderId=${pay2.merchantOrderId}`);
  bk = await MembershipBooking.findById(bookingId).lean();
  check('failed renewal -> failure page, member stays COMPLETED & unchanged', res.headers.location?.endsWith('/payment-failure') && bk.paymentResult.status === 'COMPLETED' && String(bk.batchId) === batchA && !bk.pending_renewal, bk);

  res = await api.post(`membership-plan/${bookingId}/renew`, { planId: plan._id.toString(), batchId: batchB, billing_interval: 'quarterly' });
  const pay3 = calls.pay.at(-1);
  nextState = 'COMPLETED';
  res = await api.get(`membership-plan/check-status?merchantOrderId=${pay3.merchantOrderId}`);
  bk = await MembershipBooking.findById(bookingId).lean();
  const expectedEnd = new Date(endBefore); expectedEnd.setMonth(expectedEnd.getMonth() + 3);
  check('paid renewal applied: batch B, quarterly', String(bk.batchId) === batchB && bk.billing_interval === 'quarterly' && !bk.pending_renewal, bk);
  check('early renewal extends from current end date (+3 months)', Math.abs(new Date(bk.end_date) - expectedEnd) < 5000, [bk.end_date, expectedEnd]);
  plan = await MembershipPlan.findById(plan._id).lean();
  check('batch B seat taken (5 -> 4)', plan.batches[1].capacity === 4, plan.batches[1].capacity);
  const endAfter = bk.end_date;
  res = await api.get(`membership-plan/check-status?merchantOrderId=${pay3.merchantOrderId}`);
  bk = await MembershipBooking.findById(bookingId).lean();
  plan = await MembershipPlan.findById(plan._id).lean();
  check('repeat renewal check-status changes nothing', String(bk.end_date) === String(endAfter) && plan.batches[1].capacity === 4);

  console.log('\nRenewal reminders');
  const waRenewBefore = calls.wa.length;
  res = await api.post('renewal-alerts/send-bulk', {}, ADMIN);
  const reminder = calls.wa.slice(waRenewBefore).find((c) => c.name === 'renewal');
  check('bulk renewal alerts run', res.status === 200, [res.status, res.data]);
  // bk now ends ~3 months out, so make it due and send one
  await MembershipBooking.updateOne({ _id: bookingId }, { end_date: new Date(Date.now() + 5 * 864e5) });
  res = await api.post(`renewal-alerts/send/${bookingId}`, {}, ADMIN);
  const r2 = calls.wa.at(-1);
  check('single renewal alert sent', res.status === 200 && r2.name === 'renewal', [res.status, res.data]);
  check('renewal link uses bysahitya domain', r2.components.body_3.value === `https://www.thedancedistrictbysahitya.in/renewalform/${bookingId}`, r2.components.body_3);
  check('real studio contact number (not placeholder)', r2.components.body_4.value === '+91 8073139244', r2.components.body_4);
  void reminder;

  // ---------------------------------------------------------- workshops
  console.log('\nWorkshop booking');
  const day = new Date(Date.now() + 7 * 864e5);
  res = await api.post('workshop', {
    title: 'Bollywood Bootcamp', date: day.toISOString(),
    batches: [{ name: 'Morning', start_time: day.toISOString(), end_time: new Date(+day + 36e5).toISOString(), capacity: 5, pricing: { early_bird: { price: 500, capacity_limit: 1 }, regular: { price: 800 } } }]
  }, ADMIN);
  check('admin creates workshop', res.status === 201, [res.status, res.data]);
  const ws = await Workshop.findOne({ title: 'Bollywood Bootcamp' }).lean();
  const wb = ws.batches[0]._id.toString();
  const wbody = { workshopId: ws._id.toString(), batchIds: [wb], name: 'Arjun', age: 22, mobile_number: '9876500002', gender: 'Male' };

  res = await api.post('workshop/book', { ...wbody, price: 1 });
  check('tampered price rejected -> 409', res.status === 409 && res.data.expectedPrice === 500, [res.status, res.data]);
  res = await api.post('workshop/book', { ...wbody, batchIds: [wb, wb], price: 1000 });
  check('duplicate batch rejected -> 400', res.status === 400, res.status);
  res = await api.post('workshop/book', { ...wbody, price: 500 });
  check('early-bird booking -> 201', res.status === 201 && res.data.checkoutPageUrl, [res.status, res.data]);
  const wBookingId = res.data.bookingId;
  check('charged ₹500 + ₹50 fee (fee added once)', calls.pay.at(-1).amountInRupees === 550, calls.pay.at(-1));

  nextState = 'COMPLETED';
  const waW = calls.wa.length;
  res = await api.get(`workshop/check-status?merchantOrderId=${wBookingId}`);
  let wbk = await WorkshopBooking.findById(wBookingId).lean();
  let wsDoc = await Workshop.findById(ws._id).lean();
  check('workshop check-status -> success redirect', res.headers.location === 'https://www.thedancedistrictbysahitya.in/payment-success', res.headers.location);
  check('booking CONFIRMED, tier EARLY_BIRD', wbk.status === 'CONFIRMED' && wbk.pricing_details[0].pricing_tier === 'EARLY_BIRD', wbk);
  check('seat 5 -> 4, early-bird 1 -> 0', wsDoc.batches[0].capacity === 4 && wsDoc.batches[0].pricing.early_bird.capacity_limit === 0, wsDoc.batches[0]);
  check('one workshop WhatsApp', calls.wa.length === waW + 1 && calls.wa.at(-1).name === 'workshop_confirmation');
  res = await api.get(`workshop/check-status?merchantOrderId=${wBookingId}`);
  wsDoc = await Workshop.findById(ws._id).lean();
  check('repeat workshop check-status: no double seat/WhatsApp', wsDoc.batches[0].capacity === 4 && calls.wa.length === waW + 1);

  res = await api.post('workshop/book', { ...wbody, price: 500 });
  check('early-bird sold out -> stale 500 price rejected (409, expects 800)', res.status === 409 && res.data.expectedPrice === 800, [res.status, res.data]);
  res = await api.post('workshop/book', { ...wbody, price: 800 });
  check('regular booking -> 201, charged ₹850', res.status === 201 && calls.pay.at(-1).amountInRupees === 850, [res.status, calls.pay.at(-1)]);
  nextState = 'FAILED';
  res = await api.get(`workshop/check-status?merchantOrderId=${res.data.bookingId}`);
  check('failed workshop payment -> failure page', res.headers.location?.endsWith('/payment-failure'), res.headers.location);

  res = await api.post('workshop/manual-booking', { workshopId: ws._id.toString(), name: 'Walk In', age: 30, mobile_number: '9876500003', gender: 'Other', payment_status: 'COMPLETED' }, ADMIN);
  check('manual booking without batch -> 201 (was TypeError)', res.status === 201, [res.status, res.data]);
  wsDoc = await Workshop.findById(ws._id).lean();
  check('manual paid booking takes a seat (4 -> 3)', wsDoc.batches[0].capacity === 3, wsDoc.batches[0].capacity);

  // ----------------------------------------------------- admin listing
  console.log('\nAdmin listings');
  for (const u of ['membership-plan/bookings/all', `workshop/${ws._id}/bookings`, 'rental-contact', 'demoClass/demo-bookings', 'user/coaches', 'class-session']) {
    res = await api.get(u, ADMIN);
    check(`GET ${u} as admin -> 200`, res.status === 200, [res.status, res.data]);
  }

  await db.dropDatabase();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error('HARNESS ERROR', e);
  try { if (mongoose.connection.db?.databaseName === 'dds_refactor_test') await mongoose.connection.db.dropDatabase(); } catch (er) { /* ignore */ }
  process.exit(2);
});
