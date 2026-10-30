// HomeHancer Admin prototype server.
// - Serves /public with clean URLs (/bookings -> public/bookings/index.html, *.html -> 301 to clean URL)
// - Razorpay server-side endpoints: config, orders, signature verify, refunds, webhooks
// No dependencies: node >= 18.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 4300;
const PUBLIC = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA, 'razorpay.json');
const WEBHOOK_FILE = path.join(DATA, 'webhooks.json');

fs.mkdirSync(DATA, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp'
};

// Detail routes rewritten to a shared page: /bookings/HH10423 -> public/booking/index.html
const DYNAMIC = [{ re: /^\/bookings\/[A-Za-z0-9-]+\/?$/, file: 'booking/index.html' }];

// ---------- Razorpay config (server-side; secrets never leave this process unmasked) ----------
const DEFAULT_CONFIG = {
  enabled: true,
  mode: 'test',
  test: { keyId: process.env.RZP_TEST_KEY_ID || '', keySecret: process.env.RZP_TEST_KEY_SECRET || '' },
  live: { keyId: process.env.RZP_LIVE_KEY_ID || '', keySecret: process.env.RZP_LIVE_KEY_SECRET || '' },
  webhookSecret: process.env.RZP_WEBHOOK_SECRET || '',
  merchantId: '',
  checkout: {
    businessName: 'HomeHancer', logoUrl: 'https://homehancer.co.in/icons/Icon-192.png', themeColor: '#C8287C',
    currency: 'INR', methods: { upi: true, card: true, netbanking: true, wallet: true, emi: false, paylater: false },
    autoCapture: true, timeoutMinutes: 15, retry: true, prefill: true
  },
  rules: {
    defaultPaymentMode: 'prepaid', advanceType: 'percent', advanceValue: 20,
    platformFeeEnabled: true, platformFeeType: 'flat', platformFeeValue: 29,
    gatewayFeeBorneBy: 'platform', minOnlineAmount: 99, maxOnlineAmount: 200000, cashOnService: true
  },
  webhookEvents: {
    'payment.authorized': true, 'payment.captured': true, 'payment.failed': true, 'order.paid': true,
    'refund.created': true, 'refund.processed': true, 'refund.failed': true, 'payment_link.paid': false,
    'transfer.processed': false, 'payout.processed': false, 'payout.failed': false
  },
  refunds: { speed: 'normal', autoRefundOnCancel: true, partialAllowed: true, requireFinanceApproval: true },
  route: { enabled: false, defaultCommission: 18, holdUntilCompleted: true },
  payouts: { enabled: false, accountNumber: '', mode: 'IMPS', schedule: 'weekly' },
  invoice: { gstin: '24AABCH1234F1Z5', prefix: 'HH/2026-27/', nextNumber: 1043, gstOnFee: 18, gstOnService: 18, sac: '9987' },
  alerts: { email: 'finance@homehancer.co.in', onPaymentFailed: true, onWebhookFailed: true }
};

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function deepMerge(base, extra) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' ? deepMerge(base[k], v) : v;
  }
  return out;
}
function getConfig() { return deepMerge(DEFAULT_CONFIG, readJSON(CONFIG_FILE, {})); }
function mask(s) { return s ? '••••••••' + s.slice(-4) : ''; }
function publicConfig(c) {
  return {
    ...c,
    test: { keyId: c.test.keyId, keySecret: mask(c.test.keySecret), hasSecret: !!c.test.keySecret },
    live: { keyId: c.live.keyId, keySecret: mask(c.live.keySecret), hasSecret: !!c.live.keySecret },
    webhookSecret: mask(c.webhookSecret), hasWebhookSecret: !!c.webhookSecret
  };
}
function activeKeys(c = getConfig()) { return c.mode === 'live' ? c.live : c.test; }

// ---------- Razorpay REST helper ----------
function razorpay(method, apiPath, body) {
  const { keyId, keySecret } = activeKeys();
  if (!keyId || !keySecret) return Promise.reject(Object.assign(new Error('Add your Razorpay Key ID and Key Secret on the Razorpay page first.'), { status: 400 }));
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: 'api.razorpay.com', path: '/v1' + apiPath, method,
      auth: `${keyId}:${keySecret}`,
      headers: { 'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) }
    }, res => {
      let data = '';
      res.on('data', d => (data += d));
      res.on('end', () => {
        let json; try { json = JSON.parse(data); } catch { json = { raw: data }; }
        if (res.statusCode >= 400) {
          const msg = json.error?.description || `Razorpay returned HTTP ${res.statusCode}`;
          reject(Object.assign(new Error(msg), { status: res.statusCode, details: json }));
        } else resolve(json);
      });
    });
    req.on('error', err => reject(Object.assign(new Error('Could not reach api.razorpay.com: ' + err.message), { status: 502 })));
    if (payload) req.write(payload);
    req.end();
  });
}

function hmac(secret, text) { return crypto.createHmac('sha256', secret).update(text).digest('hex'); }
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- Webhook processing ----------
function logWebhook(entry) {
  const log = readJSON(WEBHOOK_FILE, []);
  log.unshift(entry);
  writeJSON(WEBHOOK_FILE, log.slice(0, 200));
}
function processWebhook(rawBody, signature, eventId, source) {
  const c = getConfig();
  let event = {};
  try { event = JSON.parse(rawBody); } catch {}
  const log = readJSON(WEBHOOK_FILE, []);
  const duplicate = eventId && log.some(e => e.eventId === eventId && e.status === 'processed');
  const valid = !!c.webhookSecret && !!signature && safeEqual(hmac(c.webhookSecret, rawBody), signature);
  const entity = event.payload?.payment?.entity || event.payload?.refund?.entity || event.payload?.order?.entity || {};
  const entry = {
    id: 'wh_' + crypto.randomBytes(6).toString('hex'),
    eventId: eventId || null,
    event: event.event || 'unknown',
    receivedAt: new Date().toISOString(),
    source,
    signatureValid: valid,
    subscribed: c.webhookEvents[event.event] !== false,
    status: !valid ? 'rejected' : duplicate ? 'duplicate' : 'processed',
    entityId: entity.id || null,
    amount: entity.amount || null,
    bookingId: entity.notes?.booking_id || null,
    payload: event
  };
  logWebhook(entry);
  return entry;
}

// ---------- HTTP plumbing ----------
function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, { 'Content-Type': isObj ? 'application/json' : 'text/plain; charset=utf-8', ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', d => { data += d; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;
  const raw = req.method === 'POST' ? await readBody(req) : '';
  let body = {};
  if (raw && url.pathname !== '/api/razorpay/webhook') { try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Request body is not valid JSON.' }); } }

  switch (route) {
    case 'GET /api/health':
      return send(res, 200, { ok: true, server: 'homehancer-admin', time: new Date().toISOString() });

    case 'GET /api/razorpay/config':
      return send(res, 200, publicConfig(getConfig()));

    case 'POST /api/razorpay/config': {
      const current = readJSON(CONFIG_FILE, {});
      // Masked or empty secrets mean "keep the stored value".
      for (const m of ['test', 'live']) {
        if (body[m] && (!body[m].keySecret || body[m].keySecret.startsWith('••'))) delete body[m].keySecret;
      }
      if (!body.webhookSecret || String(body.webhookSecret).startsWith('••')) delete body.webhookSecret;
      delete body.hasWebhookSecret;
      if (body.test) delete body.test.hasSecret;
      if (body.live) delete body.live.hasSecret;
      const next = deepMerge(current, body);
      const merged = deepMerge(DEFAULT_CONFIG, next);
      if (merged.mode === 'live' && (!merged.live.keyId.startsWith('rzp_live_') || !merged.live.keySecret)) {
        return send(res, 400, { error: 'Live mode needs a Live Key ID starting with rzp_live_ and its Key Secret.' });
      }
      writeJSON(CONFIG_FILE, next);
      return send(res, 200, publicConfig(getConfig()));
    }

    case 'POST /api/razorpay/test-connection': {
      try {
        await razorpay('GET', '/payments?count=1');
        const c = getConfig();
        return send(res, 200, { ok: true, mode: c.mode, keyId: activeKeys(c).keyId });
      } catch (e) { return send(res, e.status || 500, { ok: false, error: e.message }); }
    }

    case 'POST /api/razorpay/orders': {
      const amount = Math.round(Number(body.amount));
      if (!Number.isFinite(amount) || amount < 100) return send(res, 400, { error: 'Amount must be at least ₹1 (100 paise).' });
      try {
        const c = getConfig();
        const order = await razorpay('POST', '/orders', {
          amount, currency: c.checkout.currency, receipt: String(body.receipt || '').slice(0, 40),
          notes: body.notes || {}, payment_capture: c.checkout.autoCapture ? 1 : 0
        });
        return send(res, 200, { order, keyId: activeKeys(c).keyId, checkout: c.checkout });
      } catch (e) { return send(res, e.status || 500, { error: e.message }); }
    }

    case 'POST /api/razorpay/verify': {
      const { razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: s } = body;
      const { keySecret } = activeKeys();
      if (!o || !p || !s) return send(res, 400, { valid: false, error: 'order_id, payment_id and signature are all required.' });
      const expected = hmac(keySecret, `${o}|${p}`);
      return send(res, 200, { valid: safeEqual(expected, s) });
    }

    case 'POST /api/razorpay/refund': {
      if (!body.paymentId) return send(res, 400, { error: 'paymentId is required.' });
      try {
        const c = getConfig();
        const refund = await razorpay('POST', `/payments/${encodeURIComponent(body.paymentId)}/refund`, {
          ...(body.amount ? { amount: Math.round(body.amount) } : {}), speed: body.speed || c.refunds.speed,
          notes: body.notes || {}
        });
        return send(res, 200, { refund });
      } catch (e) { return send(res, e.status || 500, { error: e.message }); }
    }

    // Razorpay calls this. Point your dashboard webhook at https://<your-domain>/api/razorpay/webhook
    case 'POST /api/razorpay/webhook': {
      const entry = processWebhook(raw, req.headers['x-razorpay-signature'], req.headers['x-razorpay-event-id'], 'razorpay');
      return send(res, entry.status === 'rejected' ? 400 : 200, { status: entry.status });
    }

    case 'GET /api/razorpay/webhooks':
      return send(res, 200, readJSON(WEBHOOK_FILE, []));

    case 'POST /api/razorpay/webhooks/clear':
      writeJSON(WEBHOOK_FILE, []);
      return send(res, 200, { ok: true });

    // Builds a realistic payload, signs it with the stored webhook secret (or a wrong one) and runs it through the real handler.
    case 'POST /api/razorpay/webhooks/simulate': {
      const c = getConfig();
      if (!c.webhookSecret) return send(res, 400, { error: 'Save a Webhook Secret first, then simulate.' });
      const ev = body.event || 'payment.captured';
      const amount = Math.round(Number(body.amount) || 49900);
      const id = (p) => p + '_' + crypto.randomBytes(7).toString('base64url').slice(0, 14);
      const payment = { id: body.paymentId || id('pay'), entity: 'payment', amount, currency: 'INR', status: ev === 'payment.failed' ? 'failed' : ev === 'payment.authorized' ? 'authorized' : 'captured', order_id: id('order'), method: 'upi', notes: { booking_id: body.bookingId || 'HH10421' } };
      const payload = { entity: 'event', account_id: 'acc_demo', event: ev, contains: [], created_at: Math.floor(Date.now() / 1000), payload: {} };
      if (ev.startsWith('refund.')) { payload.contains = ['refund', 'payment']; payload.payload.refund = { entity: { id: id('rfnd'), amount, payment_id: payment.id, status: ev.split('.')[1], notes: payment.notes } }; payload.payload.payment = { entity: payment }; }
      else if (ev === 'order.paid') { payload.contains = ['payment', 'order']; payload.payload.payment = { entity: payment }; payload.payload.order = { entity: { id: payment.order_id, amount, status: 'paid', notes: payment.notes } }; }
      else { payload.contains = ['payment']; payload.payload.payment = { entity: payment }; }
      const rawBody = JSON.stringify(payload);
      const signature = body.tamper ? hmac('wrong_secret', rawBody) : hmac(c.webhookSecret, rawBody);
      const eventId = body.eventId || id('evt');
      const entry = processWebhook(rawBody, signature, eventId, 'simulator');
      return send(res, 200, entry);
    }
  }
  return send(res, 404, { error: `No API route for ${route}` });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.includes('\0')) return send(res, 400, 'Bad path');

  // /bookings.html or /bookings/index.html -> /bookings
  if (/\.html$/.test(p)) {
    const clean = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1') || '/';
    return send(res, 301, '', { Location: clean + url.search });
  }

  let file = path.join(PUBLIC, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden');

  const dyn = DYNAMIC.find(d => d.re.test(p));
  if (dyn) file = path.join(PUBLIC, dyn.file);
  else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  else if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';

  fs.readFile(file, (err, data) => {
    if (err) {
      return fs.readFile(path.join(PUBLIC, '404.html'), (e2, page) => send(res, 404, page || 'Not found', { 'Content-Type': 'text/html; charset=utf-8' }));
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Server error: ' + e.message });
  }
}).listen(PORT, () => console.log(`HomeHancer Admin running at http://localhost:${PORT}`));
