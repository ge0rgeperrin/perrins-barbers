/**
 * The booking tripwire.
 *
 * server/schedulista.ts depends on three undocumented Schedulista endpoints. The
 * unit tests prove our own logic; this proves theirs has not moved. It runs
 * every morning in CI, so a change breaks a build rather than a customer's
 * booking.
 *
 *   npm run canary
 *
 * It never creates an appointment. The only POST it makes carries a deliberately
 * invalid CSRF token and must be rejected — which is itself the assertion.
 */
const BASE = 'https://www.schedulista.com/schedule/perrins1';
const SERVICE = '1074623634'; // David · Men's Haircut
const PROVIDER = '1074010081'; // David
const UA = 'PerrinsBarbershopSite-canary/1.0 (+https://perrinsbarbers.co.uk)';

const failures = [];
const check = (ok, description, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${description}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures.push(description);
};

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

let jar = '';
function absorb(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  if (!set.length) return;
  const pairs = new Map(jar ? jar.split('; ').map((c) => c.split('=').slice(0, 2)) : []);
  for (const header of set) {
    const [k, v] = header.split(';')[0].split('=');
    pairs.set(k, v);
  }
  jar = [...pairs].map(([k, v]) => `${k}=${v}`).join('; ');
}

/* 1 — availability ---------------------------------------------------- */

// Scan a fortnight so a quiet week does not fail the build.
let slots = [];
let usedDate = '';
for (let ahead = 1; ahead <= 14 && !slots.length; ahead++) {
  const date = stamp(new Date(Date.now() + ahead * 86_400_000));
  const res = await fetch(
    `${BASE}/available_times_json?service_id=${SERVICE}&provider_id=${PROVIDER}&date=${date}&time_zone=London`,
    { headers: { 'user-agent': UA, accept: 'application/json' } }
  );
  absorb(res);
  if (!res.ok) {
    check(false, 'available_times_json responds', `HTTP ${res.status} for ${date}`);
    break;
  }
  const body = await res.json().catch(() => null);
  if (!Array.isArray(body)) {
    check(false, 'available_times_json returns an array', typeof body);
    break;
  }
  if (body.length) {
    slots = body;
    usedDate = date;
  }
}

check(slots.length > 0, 'availability found within the next fortnight', usedDate);

if (slots.length) {
  const slot = slots[0];
  check(
    typeof slot.start_time === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}$/.test(slot.start_time),
    'slot.start_time keeps its ISO-with-offset shape',
    slot.start_time
  );
  check(
    String(slot.provider_id) === PROVIDER,
    'slot.provider_id matches the barber we asked for',
    String(slot.provider_id)
  );
}

/* 2 — the details form ------------------------------------------------ */

let token = '';
if (slots.length) {
  const query =
    `service_id=${SERVICE}&provider_id=${PROVIDER}` +
    `&date=${usedDate}&time=${encodeURIComponent(slots[0].start_time)}`;
  const res = await fetch(`${BASE}/reserve_appointment?${query}`, {
    headers: { cookie: jar, 'user-agent': UA },
  });
  absorb(res);
  const html = await res.text();

  check(res.ok, 'reserve_appointment serves the details form', `HTTP ${res.status}`);

  token = html.match(/name="authenticity_token"\s+value="([^"]+)"/)?.[1] ?? '';
  check(Boolean(token), 'the form carries an authenticity_token');

  for (const field of ['fname', 'lname', 'email', 'phone', 'service_id', 'provider_id', 'date', 'time']) {
    check(html.includes(`name="${field}"`), `the form still has a "${field}" field`);
  }

  check(
    /<form[^>]+method="post"/i.test(html) && html.includes('reserve_appointment'),
    'the form still posts back to reserve_appointment'
  );
}

/* 3 — forgery protection ---------------------------------------------- */

if (slots.length) {
  const query =
    `service_id=${SERVICE}&provider_id=${PROVIDER}` +
    `&date=${usedDate}&time=${encodeURIComponent(slots[0].start_time)}`;
  const res = await fetch(`${BASE}/reserve_appointment?${query}`, {
    method: 'POST',
    headers: {
      cookie: jar,
      'user-agent': UA,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      utf8: '✓',
      authenticity_token: 'canary-invalid-token',
      fname: 'Canary',
      lname: 'Canary',
      email: 'canary@example.invalid',
      phone: '',
      country: 'GB',
      service_id: SERVICE,
      provider_id: PROVIDER,
      date: usedDate,
      time: slots[0].start_time,
      commit: 'Schedule Appointment',
    }).toString(),
    redirect: 'manual',
  });

  // 422 is Rails rejecting the token. Anything else means either the endpoint
  // moved or forgery protection changed — both need a human to look.
  check(res.status === 422, 'an invalid CSRF token is still rejected with 422', `HTTP ${res.status}`);
}

/* --------------------------------------------------------------------- */

console.log();
if (failures.length) {
  console.error(
    `${failures.length} check(s) failed. Schedulista's booking flow has changed — ` +
      `server/schedulista.ts needs updating before it can book anything.`
  );
  process.exit(1);
}
console.log('Booking contract intact.');
