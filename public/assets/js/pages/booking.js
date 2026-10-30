(function () {
  const { db, esc, inr, badge, customer, service, partner, category, date, time, datetime, opt, icon } = HH;
  const id = HH.params.get('id') || location.pathname.split('/').filter(Boolean).pop();
  const b = HH.by(db.bookings, id);
  if (!b) {
    HH.shell({ title: 'Booking not found', crumbs: '<a href="/bookings">Bookings</a>' }).innerHTML = `<div class="card empty">No booking has the ID “${esc(id)}”. <a href="/bookings">Back to bookings</a></div>`;
    return;
  }
  const FLOW = ['pending', 'confirmed', 'assigned', 'in_progress', 'completed'];
  const LABEL = { pending: 'Pending', confirmed: 'Confirmed', assigned: 'Assigned', in_progress: 'In progress', completed: 'Completed' };

  function render() {
    const c = customer(b.customerId), p = partner(b.partnerId), s = service(b.serviceId);
    const txs = db.transactions.filter(t => t.bookingId === b.id);
    const idx = FLOW.indexOf(b.status);
    const next = b.status !== 'cancelled' && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
    const closed = ['completed', 'cancelled'].includes(b.status);
    const canPay = b.payStatus !== 'paid' && !String(b.payStatus).includes('refund') && b.status !== 'cancelled';
    const view = HH.shell({
      title: `Booking ${b.id}`, crumbs: '<a href="/bookings">Bookings</a> › ' + b.id,
      subtitle: `${esc(s.name)} · ${date(b.slot)}, ${time(b.slot)} · ${badge('booking', b.status)} ${badge('pay', b.payStatus)}`,
      actions: `<button class="btn" id="invoiceBtn">Invoice</button>${!closed ? `<button class="btn" id="reschedBtn">Reschedule</button><button class="btn btn-danger" id="cancelBtn">Cancel booking</button>` : ''}${next && (next !== 'in_progress' || b.partnerId) && (next !== 'assigned' || b.partnerId) ? `<button class="btn btn-primary" id="advanceBtn">Mark as ${LABEL[next]}</button>` : ''}`
    });
    view.innerHTML = `
      <section class="card card-body"><div class="stepper">${FLOW.map((st, i) => `<div class="step ${b.status === 'cancelled' ? (i === 0 ? 'done' : '') : i <= idx ? 'done' : ''}">${LABEL[st]}</div>`).join('')}${b.status === 'cancelled' ? '<div class="step cancel done" style="color:var(--bad)">Cancelled</div>' : ''}</div></section>
      <div class="grid grid-main">
        <div class="stack" style="gap:20px">
          <section class="card"><div class="card-head"><h2>Job details</h2><span class="muted small">Booked ${datetime(b.createdAt)} via ${esc(b.source)}</span></div>
            <div class="card-body"><dl class="dl">
              <dt>Service</dt><dd>${esc(s.name)}${b.qty > 1 ? ` × ${b.qty}` : ''} <span class="muted">· ${esc(category(b.catId).name)} · about ${s.duration} min</span></dd>
              <dt>Slot</dt><dd>${new Date(b.slot).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</dd>
              <dt>Address</dt><dd>${esc(b.address)}</dd>
              <dt>Zone</dt><dd>${esc(b.zone)}</dd>
              <dt>Notes</dt><dd>${b.notes ? esc(b.notes) : '<span class="muted">None</span>'}</dd>
              <dt>Start OTP</dt><dd class="mono">${String(parseInt(b.id.slice(2)) * 7919 % 9000 + 1000)}</dd>
            </dl></div></section>
          <section class="card"><div class="card-head"><h2>Price breakdown</h2>${b.coupon ? `<span class="badge b-good plain">Coupon ${esc(b.coupon)}</span>` : ''}</div>
            <div class="card-body"><dl class="dl">
              <dt>Service</dt><dd class="num">${inr(b.price.subtotal)}</dd><dt>Visiting charge</dt><dd class="num">${inr(b.price.visit)}</dd>
              ${b.price.discount ? `<dt>Discount</dt><dd class="num" style="color:var(--good)">− ${inr(b.price.discount)}</dd>` : ''}
              <dt>Platform fee</dt><dd class="num">${inr(b.price.platformFee)}</dd><dt>GST 18%</dt><dd class="num">${inr(b.price.gst)}</dd>
              <dt><b>Total</b></dt><dd class="num"><b style="font-size:18px">${inr(b.price.total)}</b></dd>
              <dt>Partner earning</dt><dd class="num muted">${inr(Math.round((b.price.subtotal + b.price.visit) * (1 - (category(b.catId).commission || 18) / 100)))} after ${category(b.catId).commission}% commission</dd>
            </dl></div></section>
          <section class="card"><div class="card-head"><h2>Payments</h2><span class="muted small">${b.payMode === 'online' ? 'Online via Razorpay' : 'Cash after service'}</span></div>
            ${txs.length ? `<div class="table-wrap"><table><thead><tr><th>Payment ID</th><th>Method</th><th class="right">Amount</th><th>Status</th><th>When</th><th></th></tr></thead><tbody>${txs.map(t => `<tr><td class="mono"><a href="/payments/${t.id}">${t.id}</a><div class="cell-sub">${t.orderId}</div></td><td>${t.method.toUpperCase()}</td><td class="right num">${inr(t.amount)}</td><td>${badge('tx', t.status)}${t.source === 'test' ? ' <span class="badge plain">test</span>' : ''}</td><td class="cell-sub">${datetime(t.createdAt)}</td><td>${['captured', 'partially_refunded'].includes(t.status) ? `<button class="btn btn-sm" data-refund="${t.id}">Refund</button>` : ''}</td></tr>${t.refunds.map(r => `<tr><td class="mono" style="padding-left:28px">↳ ${r.id}</td><td>Refund · ${r.speed === 'optimum' ? 'Instant' : 'Normal'}</td><td class="right num">− ${inr(r.amount)}</td><td>${badge('generic', r.status)}</td><td class="cell-sub">${datetime(r.at)}</td><td></td></tr>`).join('')}`).join('')}</tbody></table></div>` : '<div class="empty">No payment attempts yet.</div>'}
            ${canPay ? `<div class="card-foot"><button class="btn" id="linkBtn">Copy payment link</button>${b.payMode === 'cash' ? '<button class="btn" id="cashBtn">Mark cash received</button>' : ''}<button class="btn btn-primary" id="payBtn">${icon('payments')}Collect ${inr(b.price.total)} with Razorpay</button></div>` : ''}
          </section>
          <section class="card"><div class="card-head"><h2>Job photos</h2><span class="muted small">Uploaded by partner from the app</span></div><div class="card-body grid grid-2" style="grid-template-columns:repeat(2,1fr)">
            <div class="stack" style="gap:6px"><span class="label">Before</span><div class="photo">${b.status === 'completed' || b.status === 'in_progress' ? '2 photos · tap to view in live system' : 'Not uploaded yet'}</div></div>
            <div class="stack" style="gap:6px"><span class="label">After</span><div class="photo">${b.status === 'completed' ? '3 photos · tap to view in live system' : 'Not uploaded yet'}</div></div>
          </div></section>
        </div>
        <div class="stack" style="gap:20px">
          <section class="card"><div class="card-head"><h2>Customer</h2><a href="/customers?id=${c.id}">Profile</a></div><div class="card-body stack">
            <div class="row"><span class="avatar">${HH.initials(c.name)}</span><div><div class="cell-main">${esc(c.name)}</div><div class="cell-sub">${esc(c.phone)}</div></div></div>
            <div class="small muted">${esc(c.email || 'No email')} · ${db.bookings.filter(x => x.customerId === c.id).length} bookings</div>
          </div></section>
          <section class="card"><div class="card-head"><h2>Partner</h2>${!closed ? `<button class="btn btn-sm" id="assignBtn">${p ? 'Reassign' : 'Assign'}</button>` : ''}</div><div class="card-body stack">
            ${p ? `<div class="row"><span class="avatar">${HH.initials(p.name)}</span><div><div class="cell-main">${esc(p.name)}</div><div class="cell-sub">${p.rating} ★ · ${p.jobs} jobs · ${esc(p.phone)}</div></div></div><div class="small">${p.online ? '<span class="badge b-good">Online</span>' : '<span class="badge">Offline</span>'} <a href="/partners?id=${p.id}">View partner</a></div>` : '<div class="callout warn">' + icon('alert') + '<div>No partner assigned yet.</div></div>'}
          </div></section>
          <section class="card"><div class="card-head"><h2>Activity</h2></div><div class="card-body">
            <ul class="timeline">${b.timeline.slice().reverse().map(e => `<li><div>${esc(e.text)}</div><div class="cell-sub">${datetime(e.at)} · ${esc(e.by)}</div></li>`).join('')}</ul>
            <div class="input-group" style="margin-top:8px"><input id="noteInput" placeholder="Add an internal note" aria-label="Internal note"><button class="btn" id="noteBtn">Add</button></div>
          </div></section>
        </div>
      </div>`;
    wire(next, txs);
  }

  function wire(next, txs) {
    const $ = (id) => document.getElementById(id);
    const log = (text) => { b.timeline.push({ at: new Date().toISOString(), text, by: HH.session.name }); HH.save(); };
    $('advanceBtn')?.addEventListener('click', () => {
      if (next === 'completed' && b.payMode === 'online' && b.payStatus !== 'paid') return HH.toast('Collect the online payment before completing this job.', 'bad');
      b.status = next; log(`Status changed to ${LABEL[next]}`); HH.audit(`${b.id} marked ${LABEL[next]}`);
      HH.toast(`${b.id} is now ${LABEL[next]}.`, 'good'); render();
    });
    $('assignBtn')?.addEventListener('click', () => HH.assignDialog(b, render));
    $('payBtn')?.addEventListener('click', () => HH.collectPayment(b, render));
    $('cashBtn')?.addEventListener('click', async () => {
      if (!(await HH.confirmDialog({ title: 'Mark cash received?', text: `Confirm the partner collected ${inr(b.price.total)} in cash. It will be deducted from their next payout.`, ok: 'Mark received' }))) return;
      b.payStatus = 'paid'; log(`Cash ${inr(b.price.total)} collected by partner`); HH.audit(`Marked cash received on ${b.id}`); render();
    });
    $('linkBtn')?.addEventListener('click', async () => {
      const link = `https://rzp.io/l/hh${b.id.slice(2)}`;
      try { await navigator.clipboard.writeText(link); HH.toast('Payment link copied: ' + link, 'good'); } catch { HH.toast('Payment link: ' + link); }
      log('Payment link shared with customer');
    });
    $('noteBtn').addEventListener('click', () => { const v = $('noteInput').value.trim(); if (!v) return; log('Note: ' + v); render(); });
    document.querySelectorAll('[data-refund]').forEach(btn => btn.addEventListener('click', () => HH.refundDialog(HH.by(db.transactions, btn.dataset.refund), render)));
    $('reschedBtn')?.addEventListener('click', () => {
      const m = HH.modal({
        title: 'Reschedule ' + b.id,
        body: `<div class="form-grid"><div class="field"><label for="rs-date">New date</label><input id="rs-date" type="date" value="${b.slot.slice(0, 10)}" min="${new Date().toISOString().slice(0, 10)}"></div><div class="field"><label for="rs-slot">Slot</label><select id="rs-slot">${opt([['09', '9–11 AM'], ['11', '11 AM–1 PM'], ['13', '1–3 PM'], ['15', '3–5 PM'], ['17', '5–7 PM'], ['19', '7–9 PM']], String(new Date(b.slot).getHours()).padStart(2, '0'))}</select></div><div class="field full"><label for="rs-reason">Reason</label><input id="rs-reason" placeholder="Customer requested"></div></div>`,
        foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="rs-ok">Reschedule</button>`
      });
      m.$('#rs-ok').addEventListener('click', () => {
        const d = new Date(`${m.$('#rs-date').value}T${m.$('#rs-slot').value}:00:00`);
        if (isNaN(d) || d < new Date()) return HH.toast('Pick a future date and slot.', 'bad');
        b.slot = d.toISOString(); log(`Rescheduled to ${datetime(b.slot)}${m.$('#rs-reason').value ? ' · ' + m.$('#rs-reason').value : ''}`); HH.audit(`Rescheduled ${b.id}`);
        m.close(); HH.toast('Booking rescheduled. Customer and partner notified.', 'good'); render();
      });
    });
    $('cancelBtn')?.addEventListener('click', () => {
      const paid = db.transactions.find(t => t.bookingId === b.id && ['captured', 'partially_refunded'].includes(t.status));
      const hoursLeft = (new Date(b.slot) - new Date()) / 36e5;
      const free = hoursLeft >= db.settings.cancellation.freeBeforeHours;
      const fee = free ? 0 : db.settings.cancellation.lateFee;
      const refundable = paid ? paid.amount - paid.refunds.reduce((s, r) => s + r.amount, 0) : 0;
      const m = HH.modal({
        title: 'Cancel ' + b.id,
        body: `<div class="stack"><div class="field"><label for="cx-reason">Reason</label><select id="cx-reason">${opt(['Customer requested', 'Customer not available', 'No partner available', 'Duplicate booking', 'Suspected fraud'])}</select></div>
          ${paid ? `<div class="callout info">${icon('info')}<div>${free ? `Free cancellation (more than ${db.settings.cancellation.freeBeforeHours} h before slot).` : `Late cancellation fee ${inr(fee)} applies.`}<br>Refund ${inr(Math.max(refundable - fee, 0))} to the original payment method.</div></div>
          <label class="check"><input type="checkbox" id="cx-refund" checked> Refund now through Razorpay</label>` : '<p class="muted" style="margin:0">No online payment to refund.</p>'}</div>`,
        foot: `<button class="btn" data-close>Keep booking</button><button class="btn btn-danger" id="cx-ok">Cancel booking</button>`
      });
      m.$('#cx-ok').addEventListener('click', async () => {
        try {
          if (paid && m.$('#cx-refund').checked && refundable - fee > 0) await HH.refund(paid, refundable - fee, { speed: 'normal', reason: 'Booking cancelled' });
          b.status = 'cancelled'; log('Cancelled: ' + m.$('#cx-reason').value); HH.audit(`Cancelled ${b.id}`);
          m.close(); HH.toast(`${b.id} cancelled.`, 'good'); render();
        } catch (e) { HH.toast(e.message, 'bad'); }
      });
    });
    $('invoiceBtn').addEventListener('click', () => {
      const c = customer(b.customerId), s = service(b.serviceId), biz = db.settings.business;
      const no = db.settings.tax.invoicePrefix + b.id.slice(2);
      const text = `TAX INVOICE ${no}\n${biz.legalName} · GSTIN ${biz.gstin}\n${biz.address}\n\nBill to: ${c.name}, ${b.address}\nDate: ${date(b.createdAt)} · Booking ${b.id}\n\n${s.name} x${b.qty}  SAC ${db.settings.tax.sac}  ${inr(b.price.subtotal)}\nVisiting charge  ${inr(b.price.visit)}\nDiscount  -${inr(b.price.discount)}\nPlatform fee  ${inr(b.price.platformFee)}\nCGST 9%  ${inr(b.price.gst / 2, 2)}\nSGST 9%  ${inr(b.price.gst / 2, 2)}\nTOTAL  ${inr(b.price.total)}`;
      const m = HH.modal({
        title: 'Tax invoice ' + esc(no), wide: true,
        body: `<div class="stack"><div class="row"><div><b>${esc(biz.legalName)}</b><div class="small muted">${esc(biz.address)}<br>GSTIN ${biz.gstin} · Place of supply ${esc(db.settings.tax.placeOfSupply)}</div></div><span class="spacer"></span><div style="text-align:right"><b>Invoice ${esc(no)}</b><div class="small muted">${date(b.createdAt)}</div></div></div>
          <div class="small"><b>Bill to:</b> ${esc(c.name)} · ${esc(c.phone)}<br>${esc(b.address)}</div>
          <table><thead><tr><th>Item</th><th>SAC</th><th class="right">Amount</th></tr></thead><tbody>
          <tr><td>${esc(s.name)} × ${b.qty}</td><td>${db.settings.tax.sac}</td><td class="right">${inr(b.price.subtotal)}</td></tr><tr><td>Visiting charge</td><td>${db.settings.tax.sac}</td><td class="right">${inr(b.price.visit)}</td></tr>
          ${b.price.discount ? `<tr><td>Discount (${esc(b.coupon)})</td><td></td><td class="right">− ${inr(b.price.discount)}</td></tr>` : ''}<tr><td>Platform fee</td><td>${db.settings.tax.sac}</td><td class="right">${inr(b.price.platformFee)}</td></tr>
          <tr><td>CGST 9%</td><td></td><td class="right">${inr(b.price.gst / 2, 2)}</td></tr><tr><td>SGST 9%</td><td></td><td class="right">${inr(b.price.gst / 2, 2)}</td></tr>
          <tr><td colspan="2"><b>Total</b></td><td class="right"><b>${inr(b.price.total)}</b></td></tr></tbody></table>
          <p class="small muted" style="margin:0">Payment: ${badge('pay', b.payStatus)} · ${b.payMode === 'online' ? 'Razorpay' : 'Cash'}</p></div>`,
        foot: `<button class="btn" id="invCopy">${icon('copy')}Copy as text</button><button class="btn" id="invMail">Email to customer</button><button class="btn btn-primary" id="invPrint">Print</button>`
      });
      m.$('#invCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(text); HH.toast('Invoice copied.', 'good'); } catch { HH.toast('Copy is blocked in this browser.', 'bad'); } });
      m.$('#invMail').addEventListener('click', () => { log(`Invoice ${no} emailed to ${c.email || c.phone}`); HH.toast(`Invoice queued to ${c.email || c.phone}.`, 'good'); });
      m.$('#invPrint').addEventListener('click', () => window.print());
    });
  }

  render();
})();
