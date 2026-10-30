(function () {
  const { db, esc, inr, badge, customer, service, partner, category, date, time, opt } = HH;
  const view = HH.shell({
    title: 'Bookings', subtitle: 'Every job booked from the app and website',
    actions: `<button class="btn" id="exportBtn">${HH.icon('download')}Export CSV</button><button class="btn btn-primary" id="newBtn">${HH.icon('plus')}New booking</button>`
  });
  view.innerHTML = `<section class="card" id="tbl"></section>`;

  const t = HH.table(document.getElementById('tbl'), {
    rows: () => db.bookings,
    tabs: {
      items: [['all', 'All'], ['pending', 'Needs action'], ['upcoming', 'Upcoming'], ['in_progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']],
      match: (b, k) => k === 'all' || (k === 'pending' ? ['pending', 'confirmed'].includes(b.status) : k === 'upcoming' ? ['confirmed', 'assigned'].includes(b.status) && new Date(b.slot) > new Date() : b.status === k)
    },
    search: { placeholder: 'Booking ID, customer, phone', fields: b => [b.id, customer(b.customerId).name, customer(b.customerId).phone, partner(b.partnerId)?.name] },
    filters: [
      { label: 'Category', options: db.categories.map(c => [c.id, c.name]), value: b => b.catId },
      { label: 'Zone', options: db.zones.map(z => z.name), value: b => b.zone },
      { label: 'Payment', options: [['paid', 'Paid'], ['pending', 'Unpaid'], ['failed', 'Failed'], ['refunded', 'Refunded']], value: b => b.payStatus },
      { label: 'Mode', options: [['online', 'Online'], ['cash', 'Cash']], value: b => b.payMode }
    ],
    defaultSort: 'created',
    columns: [
      { key: 'id', label: 'Booking', sort: b => b.id, render: b => `<a href="/bookings/${b.id}" class="cell-main">${b.id}</a><div class="cell-sub">${b.source}</div>` },
      { key: 'customer', label: 'Customer', sort: b => customer(b.customerId).name, render: b => `<div class="cell-main">${esc(customer(b.customerId).name)}</div><div class="cell-sub">${esc(b.zone)}</div>` },
      { key: 'service', label: 'Service', render: b => `<div>${esc(service(b.serviceId).name)}${b.qty > 1 ? ` × ${b.qty}` : ''}</div><div class="cell-sub">${esc(category(b.catId).name)}</div>` },
      { key: 'slot', label: 'Slot', sort: b => b.slot, render: b => `<div class="num">${date(b.slot)}</div><div class="cell-sub">${time(b.slot)}</div>` },
      { key: 'partner', label: 'Partner', render: b => b.partnerId ? esc(partner(b.partnerId).name) : (b.status === 'cancelled' ? '<span class="muted">—</span>' : `<button class="btn btn-sm" data-assign="${b.id}">Assign</button>`) },
      { key: 'amount', label: 'Amount', align: 'right', sort: b => b.price.total, render: b => `<div class="num cell-main">${inr(b.price.total)}</div><div class="cell-sub">${b.payMode === 'online' ? 'Online' : 'Cash'}</div>` },
      { key: 'pay', label: 'Payment', render: b => badge('pay', b.payStatus) },
      { key: 'status', label: 'Status', render: b => badge('booking', b.status) },
      { key: 'created', label: 'Created', sort: b => b.createdAt, render: b => `<span class="cell-sub">${HH.rel(b.createdAt)}</span>` }
    ],
    onRow: b => (location.href = '/bookings/' + b.id)
  });

  document.getElementById('tbl').addEventListener('click', e => {
    const btn = e.target.closest('[data-assign]');
    if (btn) HH.assignDialog(HH.by(db.bookings, btn.dataset.assign), () => t.render());
  });
  document.getElementById('exportBtn').addEventListener('click', () => HH.downloadCSV('bookings.csv', t.visible, [
    ['Booking ID', b => b.id], ['Created', b => b.createdAt], ['Customer', b => customer(b.customerId).name], ['Phone', b => customer(b.customerId).phone], ['Zone', b => b.zone],
    ['Service', b => service(b.serviceId).name], ['Qty', b => b.qty], ['Slot', b => b.slot], ['Partner', b => partner(b.partnerId)?.name || ''], ['Status', b => b.status],
    ['Payment mode', b => b.payMode], ['Payment status', b => b.payStatus], ['Subtotal', b => b.price.subtotal], ['Discount', b => b.price.discount], ['GST', b => b.price.gst], ['Total', b => b.price.total], ['Coupon', b => b.coupon]
  ]));


  // ---------- New booking ----------
  function priceFor(svc, qty, couponCode, zoneName) {
    const zone = db.zones.find(z => z.name === zoneName);
    const subtotal = Math.round(svc.basePrice * qty * (1 + (zone?.surge || 0) / 100));
    let discount = 0, couponMsg = '';
    if (couponCode) {
      const c = db.coupons.find(x => x.code === couponCode.toUpperCase());
      const today = new Date().toISOString().slice(0, 10);
      if (!c) couponMsg = 'Coupon code not found.';
      else if (!c.active) couponMsg = 'This coupon is switched off.';
      else if (today < c.validFrom || today > c.validTo) couponMsg = 'This coupon is outside its valid dates.';
      else if (c.scope !== 'all' && c.scope !== svc.catId) couponMsg = `Valid only on ${category(c.scope).name}.`;
      else if (subtotal < c.minOrder) couponMsg = `Needs a minimum order of ${inr(c.minOrder)}.`;
      else if (c.usageLimit && c.used >= c.usageLimit) couponMsg = 'Usage limit reached.';
      else { discount = Math.min(c.type === 'flat' ? c.value : Math.round(subtotal * c.value / 100), c.maxDiscount || Infinity); couponMsg = `Applied: ${inr(discount)} off`; }
    }
    const platformFee = db.settings ? 29 : 0;
    const taxable = subtotal + svc.visitCharge - discount + platformFee;
    const gst = Math.round(taxable * (svc.gst / 100));
    return { price: { subtotal, visit: svc.visitCharge, discount, platformFee, gst, total: taxable + gst }, couponMsg, couponOk: discount > 0 };
  }

  function newBooking() {
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const m = HH.modal({
      title: 'New booking', wide: true,
      body: `<div class="form-grid">
        <div class="field full"><label for="nb-cust">Customer</label><select id="nb-cust" name="customerId">${opt(db.customers.map(c => [c.id, `${c.name} · ${c.phone}`]))}<option value="__new">+ New customer…</option></select></div>
        <div class="field hidden nc"><label for="nb-name">Name</label><input id="nb-name" name="name"></div>
        <div class="field hidden nc"><label for="nb-phone">Phone</label><input id="nb-phone" name="phone" placeholder="+91 98xxx xxxxx"></div>
        <div class="field"><label for="nb-svc">Service</label><select id="nb-svc" name="serviceId">${db.categories.filter(c => c.active).map(c => `<optgroup label="${esc(c.name)}">${opt(db.services.filter(s => s.catId === c.id && s.active).map(s => [s.id, `${s.name} · ${inr(s.basePrice)}`]))}</optgroup>`).join('')}</select></div>
        <div class="field"><label for="nb-qty">Quantity</label><input id="nb-qty" name="qty" type="number" min="1" max="20" value="1"></div>
        <div class="field"><label for="nb-zone">Zone</label><select id="nb-zone" name="zone">${opt(db.zones.filter(z => z.active).map(z => z.name))}</select></div>
        <div class="field"><label for="nb-addr">Address</label><input id="nb-addr" name="address"></div>
        <div class="field"><label for="nb-date">Date</label><input id="nb-date" name="date" type="date" value="${tomorrow}" min="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="field"><label for="nb-slot">Time slot</label><select id="nb-slot" name="slot">${opt([['09', '9–11 AM'], ['11', '11 AM–1 PM'], ['13', '1–3 PM'], ['15', '3–5 PM'], ['17', '5–7 PM'], ['19', '7–9 PM']])}</select></div>
        <div class="field"><label for="nb-pay">Payment</label><select id="nb-pay" name="payMode">${opt([['online', 'Online (Razorpay)'], ['cash', 'Cash after service']])}</select></div>
        <div class="field"><label for="nb-coupon">Coupon</label><input id="nb-coupon" name="coupon" placeholder="e.g. FIRST100" style="text-transform:uppercase"><span class="hint" id="nb-cmsg"></span></div>
        <div class="field full"><label for="nb-notes">Notes for partner</label><input id="nb-notes" name="notes" placeholder="Gate code, parking, language preference"></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-body" id="nb-price"></div></div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn" id="nb-save">Create booking</button><button class="btn btn-primary" id="nb-pay-now">Create & collect payment</button>`
    });
    const f = () => HH.formData(m.el.querySelector('.modal-body'));
    const syncCustomer = () => {
      const v = m.$('#nb-cust').value, isNew = v === '__new';
      m.$$('.nc').forEach(x => x.classList.toggle('hidden', !isNew));
      if (!isNew) { const c = customer(v); m.$('#nb-zone').value = c.zone; m.$('#nb-addr').value = c.address; }
      else m.$('#nb-addr').value = '';
      refresh();
    };
    const refresh = () => {
      const d = f(), svc = service(d.serviceId), r = priceFor(svc, Math.max(1, d.qty || 1), d.coupon, d.zone);
      const p = r.price;
      m.$('#nb-cmsg').textContent = d.coupon ? r.couponMsg : '';
      m.$('#nb-cmsg').style.color = r.couponOk ? 'var(--good)' : 'var(--bad)';
      m.$('#nb-price').innerHTML = `<dl class="dl"><dt>Service</dt><dd class="num">${inr(p.subtotal)}</dd><dt>Visiting charge</dt><dd class="num">${inr(p.visit)}</dd>${p.discount ? `<dt>Discount</dt><dd class="num" style="color:var(--good)">− ${inr(p.discount)}</dd>` : ''}<dt>Platform fee</dt><dd class="num">${inr(p.platformFee)}</dd><dt>GST ${svc.gst}%</dt><dd class="num">${inr(p.gst)}</dd><dt><b>Total</b></dt><dd class="num"><b style="font-size:18px">${inr(p.total)}</b></dd></dl>`;
      return r;
    };
    m.el.addEventListener('input', refresh);
    m.$('#nb-cust').addEventListener('change', syncCustomer);
    syncCustomer();
    const create = (collect) => {
      const d = f(), svc = service(d.serviceId), r = refresh();
      let custId = d.customerId;
      if (custId === '__new') {
        if (!d.name || !/^\+?[\d\s]{10,15}$/.test(d.phone)) return HH.toast('Enter the new customer’s name and a valid phone number.', 'bad');
        custId = 'C' + (2001 + db.customers.length);
        db.customers.unshift({ id: custId, name: d.name, phone: d.phone, email: '', zone: d.zone, address: d.address, joined: new Date().toISOString(), wallet: 0, status: 'active', referralCode: d.name.slice(0, 4).toUpperCase() + '10' });
      }
      if (!d.address) return HH.toast('Add the service address.', 'bad');
      const slot = new Date(`${d.date}T${d.slot}:00:00`);
      if (slot < new Date()) return HH.toast('Pick a slot in the future.', 'bad');
      const nextId = 'HH' + (Math.max(...db.bookings.map(b => +b.id.slice(2))) + 1);
      const b = {
        id: nextId, customerId: custId, serviceId: svc.id, catId: svc.catId, qty: Math.max(1, d.qty || 1), zone: d.zone, address: d.address, slot: slot.toISOString(),
        status: 'confirmed', partnerId: null, payMode: d.payMode, payStatus: 'pending', coupon: r.couponOk ? d.coupon.toUpperCase() : '', price: r.price,
        createdAt: new Date().toISOString(), notes: d.notes, source: 'Admin panel',
        timeline: [{ at: new Date().toISOString(), text: 'Booking created from admin panel', by: HH.session.name }, { at: new Date().toISOString(), text: 'Booking confirmed', by: HH.session.name }]
      };
      if (r.couponOk) { const c = db.coupons.find(x => x.code === b.coupon); c && c.used++; }
      db.bookings.unshift(b);
      HH.audit(`Created booking ${b.id} for ${customer(custId).name}`);
      HH.save(); m.close(); t.render();
      HH.toast(`Booking ${b.id} created.`, 'good');
      if (collect && b.payMode === 'online') HH.collectPayment(b, () => (location.href = '/bookings/' + b.id));
      else if (collect) location.href = '/bookings/' + b.id;
    };
    m.$('#nb-save').addEventListener('click', () => create(false));
    m.$('#nb-pay-now').addEventListener('click', () => create(true));
  }
  document.getElementById('newBtn').addEventListener('click', newBooking);
  if (HH.params.get('new')) newBooking();
})();
