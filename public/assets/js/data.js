// Seed data. Deterministic so every fresh load looks the same.
// Stored in localStorage by app.js; "Reset sample data" in the user menu rebuilds it.

// The panel's calendar is pinned to APP_TODAY, so all records, charts and new entries stay in April 2026.
(function () {
  const RealDate = Date, APP_TODAY = new RealDate(2026, 3, 25), r = new RealDate();
  const offset = Math.round((APP_TODAY - new RealDate(r.getFullYear(), r.getMonth(), r.getDate())) / 864e5) * 864e5;
  window.Date = class extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + offset); }
    static now() { return RealDate.now() + offset; }
  };
})();

(function () {
  let seed = 20261030;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
  const id = (p, n = 14) => p + '_' + Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[int(0, 55)]).join('');
  const DAY = 864e5;
  const now = new Date(); now.setMinutes(0, 0, 0);
  const LAST_DAY = new Date(2026, 3, 30, 12);
  const daysAgo = (d, h = int(8, 20)) => { const t = new Date(now.getTime() - d * DAY); t.setHours(h, pick([0, 15, 30, 45]), 0, 0); return (t > LAST_DAY ? LAST_DAY : t).toISOString(); };

  const categories = [
    { id: 'plumbing', name: 'Plumbing', active: true, commission: 18 },
    { id: 'electrical', name: 'Electrical', active: true, commission: 18 },
    { id: 'carpentry', name: 'Carpentry', active: true, commission: 20 },
    { id: 'ac', name: 'AC Repair', active: true, commission: 15 },
    { id: 'renovation', name: 'Renovation', active: true, commission: 12 },
    { id: 'appliance', name: 'Appliance Repair', active: false, commission: 18 }
  ];

  const services = [
    ['plumbing', 'Tap / mixer repair', 199, 49, 30], ['plumbing', 'Leakage fixing', 349, 49, 45], ['plumbing', 'Bathroom fitting installation', 899, 49, 90],
    ['plumbing', 'Water tank cleaning', 1199, 0, 120], ['plumbing', 'Blockage removal', 449, 49, 60],
    ['electrical', 'Switch / socket replacement', 149, 49, 20], ['electrical', 'Fan installation', 299, 49, 40], ['electrical', 'MCB / fuse repair', 349, 49, 45],
    ['electrical', 'House wiring (per room)', 2499, 0, 240], ['electrical', 'Inverter installation', 699, 49, 60],
    ['carpentry', 'Door lock repair', 249, 49, 30], ['carpentry', 'Furniture assembly', 599, 49, 90], ['carpentry', 'Hinge / channel repair', 299, 49, 40],
    ['carpentry', 'Modular wardrobe repair', 1499, 0, 180],
    ['ac', 'AC service (split)', 599, 0, 60], ['ac', 'AC gas refill', 2499, 0, 90], ['ac', 'AC installation', 1499, 0, 120], ['ac', 'AC uninstallation', 699, 0, 60],
    ['renovation', 'Wall painting (per room)', 4999, 0, 480], ['renovation', 'Tile repair & regrouting', 2999, 0, 300], ['renovation', 'Waterproofing consultation', 499, 0, 60]
  ].map(([catId, name, basePrice, visitCharge, duration], i) => ({
    id: 'SVC' + String(101 + i), catId, name, basePrice, visitCharge, duration, gst: 18, active: true,
    description: `${name} by verified HomeHancer professionals. Spare parts billed separately at MRP.`
  }));

  const zones = [
    ['Satellite', '380015'], ['Bopal', '380058'], ['Prahlad Nagar', '380015'], ['Vastrapur', '380015'], ['Navrangpura', '380009'],
    ['Maninagar', '380008'], ['Gota', '382481'], ['Chandkheda', '382424'], ['Thaltej', '380059'], ['SG Highway', '380054'],
    ['Naranpura', '380013'], ['Ghatlodia', '380061'], ['Nikol', '382350'], ['Vastral', '382418']
  ].map(([name, pin], i) => ({ id: 'Z' + (i + 1), name, pincodes: pin, active: i < 12, surge: i === 9 ? 10 : 0, city: 'Ahmedabad', lat: 23.0225 + rnd() * .1 - .05, lng: 72.5714 + rnd() * .1 - .05 }));

  const first = ['Aarav', 'Vivaan', 'Diya', 'Ananya', 'Krish', 'Ishaan', 'Riya', 'Meera', 'Kavya', 'Rohan', 'Nisha', 'Harsh', 'Pooja', 'Jay', 'Hetal', 'Darshan', 'Foram', 'Kunal', 'Mitali', 'Parth', 'Sneha', 'Yash', 'Bhavna', 'Chirag', 'Dhruvi', 'Nirav', 'Tanvi', 'Urvi', 'Vishal', 'Zeel'];
  const last = ['Patel', 'Shah', 'Mehta', 'Desai', 'Joshi', 'Trivedi', 'Parikh', 'Modi', 'Vyas', 'Bhatt', 'Pandya', 'Rana', 'Chauhan', 'Thakkar', 'Soni'];
  const phone = () => '+91 ' + pick(['98', '97', '99', '94', '81', '70', '63']) + int(100, 999) + ' ' + int(10000, 99999);

  const customers = Array.from({ length: 48 }, (_, i) => {
    const f = first[i % first.length], l = pick(last);
    const zone = pick(zones.slice(0, 12));
    return {
      id: 'C' + (2001 + i), name: `${f} ${l}`, phone: phone(), email: `${f}.${l}${i}`.toLowerCase() + '@gmail.com',
      zone: zone.name, address: `${int(1, 120)}, ${pick(['Shivalik', 'Safal', 'Sun', 'Shaligram', 'Sobo', 'Iscon', 'Goyal', 'Shilp'])} ${pick(['Residency', 'Heights', 'Park', 'Platinum', 'Avenue'])}, ${zone.name}, Ahmedabad ${zone.pincodes}`,
      joined: daysAgo(int(5, 400)), wallet: pick([0, 0, 0, 50, 100, 150]), status: i === 7 ? 'blocked' : 'active', referralCode: f.toUpperCase().slice(0, 4) + int(10, 99)
    };
  });

  const partnerNames = ['Ramesh Prajapati', 'Suresh Vaghela', 'Mahesh Solanki', 'Imran Shaikh', 'Dinesh Parmar', 'Vijay Makwana', 'Kalpesh Rathod', 'Salim Qureshi', 'Jignesh Panchal', 'Mukesh Chavda', 'Anil Gohil', 'Hitesh Mistry', 'Rakesh Dabhi', 'Arif Pathan', 'Bharat Zala', 'Nilesh Barot', 'Pravin Darji', 'Sanjay Thakor', 'Ketan Luhar', 'Farhan Memon'];
  const skillFor = ['plumbing', 'plumbing', 'electrical', 'ac', 'electrical', 'carpentry', 'plumbing', 'ac', 'carpentry', 'electrical', 'renovation', 'carpentry', 'ac', 'electrical', 'renovation', 'plumbing', 'carpentry', 'ac', 'electrical', 'plumbing'];
  const partners = partnerNames.map((name, i) => {
    const status = i < 15 ? (i === 11 ? 'suspended' : 'active') : 'pending';
    const z = [zones[i % 12].name, zones[(i + 3) % 12].name, zones[(i + 7) % 12].name];
    return {
      id: 'P' + (301 + i), name, phone: phone(), email: name.split(' ')[0].toLowerCase() + '.' + (301 + i) + '@partners.homehancer.co.in',
      skills: [skillFor[i], ...(i % 4 === 0 ? [pick(['electrical', 'plumbing'])] : [])].filter((v, j, a) => a.indexOf(v) === j),
      zones: z, experience: int(2, 15), rating: status === 'pending' ? 0 : +(3.9 + rnd() * 1.05).toFixed(1), jobs: 0,
      status, online: status === 'active' && rnd() > .35, commission: null, joined: daysAgo(status === 'pending' ? int(0, 6) : int(40, 500)),
      kyc: status === 'pending'
        ? { aadhaar: pick(['submitted', 'verified']), pan: 'submitted', bank: pick(['submitted', 'missing']), police: pick(['missing', 'submitted']) }
        : { aadhaar: 'verified', pan: 'verified', bank: 'verified', police: 'verified' },
      bank: { holder: name, account: 'XXXX' + int(1000, 9999), ifsc: pick(['HDFC0001234', 'SBIN0004321', 'ICIC0005678', 'KKBK0002468']), upi: name.split(' ')[0].toLowerCase() + '@okhdfcbank' },
      linkedAccount: status === 'active' ? id('acc', 14) : '', applicationNote: status === 'pending' ? 'Applied via Join Us page' : ''
    };
  });
  const activePartners = partners.filter(p => p.status === 'active');

  const statuses = ['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'cancelled'];
  const methods = ['upi', 'upi', 'upi', 'card', 'netbanking', 'wallet'];
  // Failure reasons follow the error fields Razorpay returns: code, source, step, reason.
  const FAILURES = [
    { code: 'BAD_REQUEST_ERROR', source: 'customer', step: 'payment_authentication', reason: 'payment_cancelled', description: 'Customer closed the checkout before paying', advice: 'Send the payment link again or call the customer.', methods: ['upi', 'card', 'netbanking', 'wallet'] },
    { code: 'BAD_REQUEST_ERROR', source: 'customer', step: 'payment_authentication', reason: 'payment_timeout', description: 'Customer did not approve the request in time', advice: 'Ask the customer to retry and approve the request within the time limit.', methods: ['upi', 'netbanking'] },
    { code: 'BAD_REQUEST_ERROR', source: 'customer', step: 'payment_authorization', reason: 'incorrect_pin', description: 'Wrong UPI PIN entered', advice: 'Ask the customer to retry with the correct PIN or use another UPI app.', methods: ['upi'] },
    { code: 'BAD_REQUEST_ERROR', source: 'customer', step: 'payment_authorization', reason: 'insufficient_funds', description: 'Not enough balance in the account', advice: 'Ask the customer to use another account or pay by another method.', methods: ['upi', 'card', 'netbanking', 'wallet'] },
    { code: 'BAD_REQUEST_ERROR', source: 'customer', step: 'payment_authentication', reason: 'incorrect_otp', description: 'Wrong OTP entered on the bank page', advice: 'Ask the customer to retry and enter the latest OTP.', methods: ['card'] },
    { code: 'GATEWAY_ERROR', source: 'issuer', step: 'payment_authorization', reason: 'card_declined', description: 'Card declined by the issuing bank', advice: 'Ask the customer to contact the bank or use another card.', methods: ['card'] },
    { code: 'GATEWAY_ERROR', source: 'bank', step: 'payment_authorization', reason: 'bank_technical_error', description: 'Bank servers were not responding', advice: 'No customer error. Ask the customer to retry in a few minutes.', methods: ['upi', 'card', 'netbanking'] },
    { code: 'SERVER_ERROR', source: 'gateway', step: 'payment_initiation', reason: 'gateway_technical_error', description: 'Temporary error at the payment gateway', advice: 'No customer error. Retry, and check Razorpay status if it continues.', methods: ['upi', 'card', 'netbanking', 'wallet'] }
  ];
  window.HH_FAILURES = FAILURES;
  const failureFor = (method) => { const { methods: _, ...e } = pick(FAILURES.filter(f => f.methods.includes(method))); return e; };
  const instrumentFor = (cust, method) => method === 'upi' ? cust.name.split(' ')[0].toLowerCase() + int(10, 99) + pick(['@okhdfcbank', '@oksbi', '@ybl', '@paytm', '@okicici'])
    : method === 'card' ? pick(['Visa', 'Mastercard', 'RuPay']) + ' •••• ' + int(1000, 9999) + ' · ' + pick(['HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank'])
    : method === 'netbanking' ? pick(['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Kotak Bank', 'Bank of Baroda'])
    : pick(['Paytm Wallet', 'Mobikwik', 'Freecharge']);
  const bookings = [], transactions = [];
  for (let i = 0; i < 150; i++) {
    const n = 150 - i;
    const d = i < 12 ? -int(0, 3) : Math.floor(Math.pow(rnd(), .85) * 60); // first 12 are upcoming / today
    const svc = pick(services);
    const cust = pick(customers);
    let status;
    if (d < 0) status = pick(['pending', 'confirmed', 'assigned', 'assigned']);
    else if (d === 0) status = pick(['assigned', 'in_progress', 'in_progress', 'completed', 'pending']);
    else if (d <= 1) status = pick(['completed', 'completed', 'in_progress', 'cancelled']);
    else status = pick(statuses);
    const qty = svc.basePrice < 500 ? int(1, 3) : 1;
    const subtotal = svc.basePrice * qty;
    const coupon = rnd() < .18 ? pick(['FIRST100', 'MONSOON15', 'ACCOOL']) : '';
    const discount = coupon === 'FIRST100' ? 100 : coupon === 'MONSOON15' ? Math.min(Math.round(subtotal * .15), 300) : coupon === 'ACCOOL' && svc.catId === 'ac' ? 150 : 0;
    const platformFee = 29;
    const taxable = subtotal + svc.visitCharge - discount + platformFee;
    const gst = Math.round(taxable * .18);
    const total = taxable + gst;
    const payMode = rnd() < .72 ? 'online' : 'cash';
    const partner = ['pending', 'confirmed'].includes(status) ? null : pick(activePartners.filter(p => p.skills.includes(svc.catId)).length ? activePartners.filter(p => p.skills.includes(svc.catId)) : activePartners);
    const created = daysAgo(Math.max(d, 0) + int(0, 2));
    const slot = new Date(now.getTime() - d * DAY); slot.setHours(pick([9, 11, 13, 15, 17, 19]), 0, 0, 0);
    let payStatus = 'pending';
    if (payMode === 'online') payStatus = status === 'cancelled' ? pick(['refunded', 'refunded', 'failed']) : (rnd() < .06 ? 'failed' : 'paid');
    else payStatus = status === 'completed' ? 'paid' : 'pending';
    const bId = 'HH' + (10272 + n);
    const timeline = [{ at: created, text: 'Booking created by customer (Android app)', by: 'system' }];
    if (payMode === 'online' && payStatus !== 'pending') timeline.push({ at: created, text: payStatus === 'failed' ? 'Payment failed: UPI request declined' : `Payment received ₹${total.toLocaleString('en-IN')} via ${'Razorpay'}`, by: 'razorpay' });
    if (!['pending'].includes(status)) timeline.push({ at: created, text: 'Booking confirmed', by: 'Operations' });
    if (partner) timeline.push({ at: created, text: `Assigned to ${partner.name}`, by: pick(['Auto-assign', 'Neha (Ops)']) });
    if (['in_progress', 'completed'].includes(status)) timeline.push({ at: slot.toISOString(), text: 'Partner started job (OTP verified)', by: partner?.name || 'partner' });
    if (status === 'completed') timeline.push({ at: new Date(slot.getTime() + svc.duration * 6e4).toISOString(), text: 'Job marked complete with photos', by: partner?.name || 'partner' });
    if (status === 'cancelled') timeline.push({ at: created, text: 'Cancelled: ' + pick(['Customer not available', 'Booked by mistake', 'Found another provider', 'Partner unavailable']), by: pick(['Customer', 'Operations']) });
    const b = {
      id: bId, customerId: cust.id, serviceId: svc.id, catId: svc.catId, qty, zone: cust.zone, address: cust.address,
      slot: slot.toISOString(), status, partnerId: partner?.id || null, payMode, payStatus, coupon,
      price: { subtotal, visit: svc.visitCharge, discount, platformFee, gst, total }, createdAt: created, timeline,
      notes: rnd() < .15 ? pick(['Gate code 4521. Call before arriving.', 'Customer prefers Gujarati-speaking technician.', 'Parking in basement B2.']) : '',
      source: pick(['Android app', 'Android app', 'iOS app', 'Website'])
    };
    bookings.push(b);
    const tryAttempt = (at, method, error, orderId, ip) => ({ id: id('pay'), orderId, bookingId: bId, customerId: cust.id, amount: total, method, instrument: instrumentFor(cust, method), device: b.source, ip, status: 'failed', fee: 0, tax: 0, createdAt: at, source: 'test', refunds: [], error });
    if (payMode === 'online' && payStatus === 'pending' && rnd() < .15) {
      const m = pick(methods);
      transactions.push(tryAttempt(created, m, failureFor(m), id('order'), `103.${int(10, 250)}.${int(1, 250)}.${int(1, 250)}`));
    }
    if (payMode === 'online' && payStatus !== 'pending') {
      const fee = Math.round(total * .02 * 100) / 100;
      const method = pick(methods), orderId = id('order'), ip = `103.${int(10, 250)}.${int(1, 250)}.${int(1, 250)}`;
      const earlier = payStatus === 'failed' ? int(0, 1) : rnd() < .12 ? 1 : 0;
      for (let i = earlier; i > 0; i--) { const m = pick(methods); transactions.push(tryAttempt(new Date(new Date(created).getTime() - i * int(120, 420) * 1000).toISOString(), m, failureFor(m), orderId, ip)); }
      const tx = {
        id: id('pay'), orderId, bookingId: bId, customerId: cust.id, amount: total, method, instrument: instrumentFor(cust, method), device: b.source, ip, ...(payStatus === 'failed' ? { error: failureFor(method) } : {}),
        status: payStatus === 'failed' ? 'failed' : payStatus === 'refunded' ? 'refunded' : 'captured', fee: payStatus === 'failed' ? 0 : fee,
        tax: payStatus === 'failed' ? 0 : Math.round(fee * .18 * 100) / 100, createdAt: created, source: 'test', refunds: []
      };
      if (payStatus === 'refunded') tx.refunds.push({ id: id('rfnd'), amount: total, status: 'processed', speed: 'normal', at: daysAgo(Math.max(d - 1, 0)), reason: 'Booking cancelled' });
      transactions.push(tx);
    }
  }
  bookings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const p of partners) p.jobs = bookings.filter(b => b.partnerId === p.id && b.status === 'completed').length + (p.status === 'active' ? int(20, 140) : 0);

  // Weekly payouts for the last 4 weeks
  const payouts = [];
  activePartners.forEach((p, i) => {
    for (let w = 0; w < 4; w++) {
      const jobs = int(4, 16), gross = jobs * int(450, 900), comm = Math.round(gross * .18);
      payouts.push({
        id: 'PO' + (5000 + i * 4 + w), partnerId: p.id, period: `Week ${44 - w}`, periodEnd: daysAgo(w * 7 + 2, 23), jobs, gross, commission: comm,
        tds: Math.round((gross - comm) * .01), net: gross - comm - Math.round((gross - comm) * .01),
        status: w === 0 ? (i % 5 === 0 ? 'failed' : 'pending') : w === 1 && i % 3 === 0 ? 'processing' : 'paid',
        utr: w === 0 ? '' : 'UTR' + int(100000000, 999999999), mode: pick(['IMPS', 'UPI']), at: daysAgo(w * 7)
      });
    }
  });

  const coupons = [
    { code: 'FIRST100', desc: '₹100 off on first booking', type: 'flat', value: 100, minOrder: 299, maxDiscount: 100, usageLimit: 5000, perUser: 1, used: 1843, validFrom: daysAgo(120).slice(0, 10), validTo: daysAgo(-60).slice(0, 10), scope: 'all', active: true },
    { code: 'MONSOON15', desc: '15% off on plumbing & waterproofing', type: 'percent', value: 15, minOrder: 499, maxDiscount: 300, usageLimit: 2000, perUser: 2, used: 612, validFrom: daysAgo(90).slice(0, 10), validTo: daysAgo(10).slice(0, 10), scope: 'plumbing', active: true },
    { code: 'ACCOOL', desc: '₹150 off AC service', type: 'flat', value: 150, minOrder: 599, maxDiscount: 150, usageLimit: 1500, perUser: 1, used: 1102, validFrom: daysAgo(60).slice(0, 10), validTo: daysAgo(-30).slice(0, 10), scope: 'ac', active: true },
    { code: 'SUMMER250', desc: '₹250 off on renovation above ₹2,999', type: 'flat', value: 250, minOrder: 2999, maxDiscount: 250, usageLimit: 800, perUser: 1, used: 96, validFrom: daysAgo(5).slice(0, 10), validTo: daysAgo(-15).slice(0, 10), scope: 'renovation', active: true },
    { code: 'SOCIETY10', desc: '10% off for partner housing societies', type: 'percent', value: 10, minOrder: 0, maxDiscount: 500, usageLimit: 0, perUser: 5, used: 341, validFrom: daysAgo(200).slice(0, 10), validTo: daysAgo(-160).slice(0, 10), scope: 'all', active: false }
  ];

  const reviewTexts = [
    [5, 'Technician arrived on time and fixed the leakage in 30 minutes. Very professional.'],
    [5, 'AC is cooling like new. Explained everything clearly and cleaned up after.'],
    [4, 'Good work, but came 20 minutes late. Would book again.'],
    [5, 'Polite and skilled. Wore shoe covers inside the house, appreciated.'],
    [3, 'Work was fine but spare part price felt high compared to market.'],
    [2, 'Had to call twice. The fan still makes noise after installation.'],
    [5, 'Booked at 9 am, technician came by 11. Excellent service.'],
    [4, 'Neat job on the wardrobe channels. Fair pricing.'],
    [1, 'Technician did not show up and nobody informed me.'],
    [5, 'Very happy with the tank cleaning, sent before and after photos.']
  ];
  const completed = bookings.filter(b => b.status === 'completed');
  const reviews = completed.slice(0, 26).map((b, i) => {
    const [rating, text] = reviewTexts[i % reviewTexts.length];
    return { id: 'R' + (801 + i), bookingId: b.id, customerId: b.customerId, partnerId: b.partnerId, serviceId: b.serviceId, rating, text, status: i < 3 ? 'pending' : rating <= 1 && i % 2 ? 'hidden' : 'published', reply: i % 4 === 1 ? 'Thank you for the kind words! See you again.' : '', at: b.slot };
  });

  const tickets = [
    ['Refund not received for cancelled booking', 'high', 'open', 'Payments'],
    ['Technician asked for extra cash', 'urgent', 'in_progress', 'Operations'],
    ['Want to reschedule AC service', 'normal', 'resolved', 'Support'],
    ['Fan still noisy after installation', 'normal', 'open', 'Operations'],
    ['Invoice GST number incorrect', 'low', 'in_progress', 'Payments'],
    ['App shows payment failed but money debited', 'high', 'open', 'Payments'],
    ['How to add second address?', 'low', 'resolved', 'Support'],
    ['Partner damaged bathroom tile', 'urgent', 'open', 'Operations']
  ].map(([subject, priority, status, team], i) => {
    const b = bookings[5 + i * 7];
    return {
      id: 'T' + (6101 + i), subject, priority, status, team, customerId: b.customerId, bookingId: b.id, assignee: status === 'open' ? '' : pick(['Neha Shah', 'Karan Joshi', 'Priya Desai']),
      at: daysAgo(int(0, 6)), messages: [{ from: 'customer', text: subject + '. Please help, booking ' + b.id + '.', at: daysAgo(int(1, 6)) }, ...(status !== 'open' ? [{ from: 'agent', text: 'Hi, we are looking into this and will update you within 24 hours.', at: daysAgo(0) }] : [])]
    };
  });

  const blogs = [
    ['5 signs your AC needs servicing before summer', 'ac-servicing-signs', 'published'],
    ['How to prevent water leakage during monsoon in Ahmedabad', 'monsoon-leakage-prevention', 'published'],
    ['Electrical safety checklist for the summer peak', 'summer-electrical-safety', 'published'],
    ['Choosing the right paint finish for Gujarat weather', 'paint-finish-guide', 'draft'],
    ['Modular kitchen hinges: repair or replace?', 'kitchen-hinges-repair', 'scheduled']
  ].map(([title, slug, status], i) => ({ id: 'B' + (i + 1), title, slug, status, author: pick(['HomeHancer Team', 'Neha Shah']), at: daysAgo(i * 9 + 2), metaTitle: title + ' | HomeHancer', metaDesc: 'Expert tips from HomeHancer professionals in Ahmedabad.', body: 'Write the article here…', views: status === 'published' ? int(300, 4200) : 0 }));

  const pages = [
    ['About Us', 'aboutUs'], ['Contact Us', 'contactUs'], ['Privacy Policy', 'privacyPolicy'], ['Terms & Conditions', 'termsAndConditions'], ['Help & Support', 'helpSupport'], ['Join Us (Partner signup)', 'joinUs']
  ].map(([title, slug], i) => ({ id: 'PG' + (i + 1), title, slug, updated: daysAgo(int(3, 90)), metaTitle: title + ' | HomeHancer', metaDesc: '', body: '' }));

  const banners = [
    { id: 'BN1', title: 'Summer deep-clean & repair week', placement: 'Home hero', active: true, from: daysAgo(5).slice(0, 10), to: daysAgo(-10).slice(0, 10), link: '/services/renovation' },
    { id: 'BN2', title: 'AC service from ₹599', placement: 'Home carousel', active: true, from: daysAgo(40).slice(0, 10), to: daysAgo(-20).slice(0, 10), link: '/services/ac' },
    { id: 'BN3', title: 'Become a HomeHancer partner', placement: 'Partner app', active: false, from: daysAgo(90).slice(0, 10), to: daysAgo(30).slice(0, 10), link: '/joinUs' }
  ];

  const templates = [
    ['booking_confirmed', 'sms', 'Booking confirmed', 'Hi {customer_name}, your {service_name} booking {booking_id} is confirmed for {slot}. - HomeHancer'],
    ['booking_confirmed', 'whatsapp', 'Booking confirmed', 'Hi {customer_name} 👋 Your booking *{booking_id}* for *{service_name}* is confirmed on {slot}.'],
    ['partner_assigned', 'push', 'Technician assigned', '{partner_name} will visit you on {slot}. Share OTP {otp} when the job starts.'],
    ['payment_received', 'email', 'Payment received: {booking_id}', 'Dear {customer_name},\n\nWe received ₹{amount} for booking {booking_id}. Your invoice {invoice_no} is attached.\n\nTeam HomeHancer'],
    ['payment_failed', 'sms', 'Payment failed', 'Payment of ₹{amount} for {booking_id} failed. Retry here: {payment_link}'],
    ['refund_processed', 'email', 'Refund processed: {booking_id}', 'Your refund of ₹{amount} has been processed. It will reach your account in 5-7 working days.'],
    ['job_completed', 'whatsapp', 'Job completed', 'Your {service_name} is complete. Rate {partner_name}: {review_link}'],
    ['new_job_partner', 'push', 'New job near you', 'New {service_name} job in {zone} on {slot}. Accept within 5 minutes.']
  ].map(([event, channel, subject, body], i) => ({ id: 'NT' + (i + 1), event, channel, subject, body, active: i !== 4 || true }));

  const admins = [
    { id: 'A1', name: 'Himanshu Babariya', email: 'admin@homehancer.co.in', role: 'Super Admin', status: 'active', twoFA: true, lastLogin: daysAgo(0, 9) },
    { id: 'A2', name: 'Neha Shah', email: 'neha@homehancer.co.in', role: 'Operations', status: 'active', twoFA: true, lastLogin: daysAgo(0, 10) },
    { id: 'A3', name: 'Karan Joshi', email: 'karan@homehancer.co.in', role: 'Support', status: 'active', twoFA: false, lastLogin: daysAgo(1) },
    { id: 'A4', name: 'Priya Desai', email: 'priya@homehancer.co.in', role: 'Finance', status: 'active', twoFA: true, lastLogin: daysAgo(0, 11) },
    { id: 'A5', name: 'Rahul Mehta', email: 'rahul@homehancer.co.in', role: 'Content Editor', status: 'invited', twoFA: false, lastLogin: null }
  ];
  const modules = ['Dashboard', 'Bookings', 'Customers', 'Partners', 'Services', 'Payments', 'Payouts', 'Coupons', 'Reviews', 'Support', 'Content', 'Zones', 'Reports', 'Notifications', 'Admin users', 'Settings', 'Razorpay'];
  const roleDef = (view, edit) => Object.fromEntries(modules.map(m => [m, { view: view.includes(m) || view === '*', edit: edit.includes(m) || edit === '*' }]));
  const roles = {
    'Super Admin': roleDef('*', '*'),
    'Operations': roleDef(['Dashboard', 'Bookings', 'Customers', 'Partners', 'Services', 'Zones', 'Reviews', 'Support', 'Reports'], ['Bookings', 'Partners', 'Zones', 'Support']),
    'Finance': roleDef(['Dashboard', 'Bookings', 'Payments', 'Payouts', 'Coupons', 'Reports', 'Razorpay'], ['Payments', 'Payouts', 'Razorpay']),
    'Support': roleDef(['Dashboard', 'Bookings', 'Customers', 'Reviews', 'Support'], ['Support', 'Reviews']),
    'Content Editor': roleDef(['Dashboard', 'Content', 'Notifications', 'Coupons'], ['Content'])
  };

  const audit = [
    ['Neha Shah', 'Assigned booking ' + bookings[3].id + ' to ' + activePartners[2].name],
    ['Priya Desai', 'Approved refund of ₹' + (transactions.find(t => t.status === 'refunded')?.amount || 799) + ' on ' + (transactions.find(t => t.status === 'refunded')?.bookingId || 'HH10380')],
    ['Himanshu Babariya', 'Changed Razorpay checkout methods'],
    ['Karan Joshi', 'Resolved ticket T6103'],
    ['Neha Shah', 'Approved partner KYC for ' + activePartners[6].name],
    ['Himanshu Babariya', 'Created coupon SUMMER250'],
    ['Priya Desai', 'Marked payout PO5005 as paid']
  ].map(([admin, action], i) => ({ at: daysAgo(Math.floor(i / 2), 18 - i), admin, action, ip: '103.21.' + int(10, 250) + '.' + int(2, 250) }));

  const settings = {
    business: { name: 'HomeHancer', legalName: 'HomeHancer Services Pvt. Ltd.', gstin: '24AABCH1234F1Z5', pan: 'AABCH1234F', phone: '+91 79 4000 1234', whatsapp: '+91 98250 12345', email: 'support@homehancer.co.in', address: '4th Floor, Shivalik Shilp, Iscon Cross Road, Ahmedabad 380015', website: 'https://homehancer.co.in', hours: '08:00 – 21:00, all days' },
    booking: { slotLength: 120, firstSlot: '08:00', lastSlot: '19:00', leadTimeHours: 2, maxPerSlotPerPartner: 1, autoAssign: true, assignRadiusKm: 8, partnerAcceptMinutes: 5, otpOnStart: true, photosOnComplete: true },
    cancellation: { freeBeforeHours: 2, lateFee: 99, partnerNoShowCredit: 100, refundTo: 'source' },
    commission: { default: 18, tdsPercent: 1 },
    tax: { gstPercent: 18, sac: '9987', invoicePrefix: 'HH/2026-27/', placeOfSupply: 'Gujarat (24)' },
    app: { maintenance: false, minAndroid: '2.4.0', minIOS: '2.4.0', latest: '2.6.1', forceUpdate: false },
    integrations: { mapsKey: 'AIzaSy••••••••R12UI', sms: 'MSG91', email: 'Amazon SES', whatsapp: 'Gupshup', push: 'Firebase' }
  };

  const notifications = [
    { at: daysAgo(0, 11), text: 'Payment failed on ' + (transactions.find(t => t.status === 'failed')?.bookingId || bookings[2].id), href: '/payments', kind: 'bad' },
    { at: daysAgo(0, 10), text: partners.filter(p => p.status === 'pending').length + ' partner applications waiting for KYC review', href: '/partners', kind: 'warn' },
    { at: daysAgo(0, 9), text: 'Ticket T6108 marked urgent: partner damaged bathroom tile', href: '/support', kind: 'bad' },
    { at: daysAgo(1, 18), text: 'Weekly payouts ready: ' + payouts.filter(p => p.status === 'pending').length + ' partners', href: '/payouts', kind: 'info' }
  ];

  window.HH_SEED = { version: 5, categories, services, zones, customers, partners, bookings, transactions, payouts, coupons, reviews, tickets, blogs, pages, banners, templates, admins, roles, modules, audit, settings, notifications, webhooksLocal: [] };
})();
