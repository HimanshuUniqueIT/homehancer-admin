(function () {
  const { db, esc, inr, badge, customer, service, datetime, date, icon } = HH;
  const id = location.pathname.split('/').filter(Boolean).pop();
  const x = HH.by(db.transactions, id);
  if (!x) {
    HH.shell({ title: 'Payment not found', crumbs: `<a href="/payments">Payments</a>` }).innerHTML = `<section class="card card-body"><p style="margin:0">No payment with ID <span class="mono">${esc(id)}</span>. <a href="/payments">Back to payments</a></p></section>`;
    return;
  }
  const c = customer(x.customerId), b = HH.by(db.bookings, x.bookingId);
  const view = HH.shell({ title: 'Payment ' + x.id, subtitle: `${inr(x.amount)} · ${esc(c.name)} · ${x.bookingId}`, crumbs: `<a href="/payments">Payments</a>` });
  const METHOD = { upi: 'UPI', card: 'Card', netbanking: 'Netbanking', wallet: 'Wallet', razorpay: 'Razorpay checkout' };
  const label = (t) => METHOD[t.method] || t.method;

  function stages() {
    const failed = x.status === 'failed';
    const steps = ['Triggered', 'Order created', 'Checkout', 'Authorised', 'Captured', 'Settled'];
    const reached = failed ? 2 : HH.isSettled(x) ? 5 : 4;
    return `<div class="stepper">${steps.slice(0, failed ? 3 : 6).map((s, i) => `<div class="step ${i <= reached ? 'done' : ''}">${s}</div>`).join('')}${failed ? '<div class="step cancel done" style="color:var(--bad)">Failed</div>' : ''}${x.refunds.length ? '<div class="step done">Refunded</div>' : ''}</div>`;
  }

  function txRows(list) {
    return list.map(t => `<tr${t.id === x.id ? ' class="row-current"' : ''}><td class="mono"><a href="/payments/${t.id}">${t.id}</a><div class="cell-sub">${t.bookingId}</div></td><td>${esc(label(t))}<div class="cell-sub">${esc(t.instrument || '')}</div></td><td class="right num">${inr(t.amount)}</td><td>${badge('tx', t.status)}${t.error ? `<div class="cell-sub">${esc(t.error.description)}</div>` : ''}</td><td class="cell-sub">${datetime(t.createdAt)}</td></tr>`).join('');
  }
  const txTable = (list) => `<div class="table-wrap"><table><thead><tr><th>Payment ID</th><th>Method</th><th class="right">Amount</th><th>Status</th><th>When</th></tr></thead><tbody>${txRows(list)}</tbody></table></div>`;

  function render() {
    const left = x.amount - x.refunds.reduce((s, r) => s + r.amount, 0);
    const attempts = db.transactions.filter(t => t.orderId === x.orderId).sort((p, q) => p.createdAt.localeCompare(q.createdAt));
    const history = db.transactions.filter(t => t.customerId === x.customerId).sort((p, q) => q.createdAt.localeCompare(p.createdAt));
    const okCount = history.filter(t => t.status !== 'failed').length;
    const e = x.error;
    view.innerHTML = `
      <section class="card card-body">${stages()}</section>
      ${x.status === 'failed' ? `<div class="callout bad">${icon('info')}<div><b>Why it failed: ${esc(e?.description || 'Razorpay did not return a reason')}</b>${e?.advice ? `<br>${esc(e.advice)}` : ''}</div></div>` : ''}
      <div class="grid grid-main">
        <div class="stack">
          <section class="card"><div class="card-head"><h2>Payment journey</h2><span class="muted small">From the customer's tap to the money reaching your bank</span></div>
            <ol class="journey">${HH.paymentJourney(x).map(s => `<li class="${s.tone || ''}"><div class="journey-when">${date(s.at)}<br>${new Date(s.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div><div><div class="cell-main">${esc(s.title)}</div>${s.detail ? `<div class="cell-sub">${esc(s.detail)}</div>` : ''}<span class="journey-actor">${esc(s.actor)}</span></div></li>`).join('')}</ol>
          </section>
          <section class="card"><div class="card-head"><h2>Attempts on this order</h2><span class="muted small">${attempts.length} ${attempts.length === 1 ? 'attempt' : 'attempts'} · <span class="mono">${x.orderId}</span></span></div>${txTable(attempts)}</section>
          <section class="card"><div class="card-head"><h2>All payments by ${esc(c.name)}</h2><span class="muted small">${okCount} successful · ${history.length - okCount} failed</span></div>${txTable(history)}</section>
        </div>
        <div class="stack">
          <section class="card"><div class="card-head"><h2>Payment details</h2></div><div class="card-body"><dl class="dl">
            <dt>Status</dt><dd>${badge('tx', x.status)}</dd><dt>Amount</dt><dd class="num">${inr(x.amount)}</dd><dt>Method</dt><dd>${esc(label(x))}</dd>${x.instrument ? `<dt>Paid using</dt><dd>${esc(x.instrument)}</dd>` : ''}
            <dt>Payment ID</dt><dd class="mono">${x.id}</dd><dt>Order ID</dt><dd class="mono">${x.orderId}</dd>${x.status === 'failed' ? '' : `<dt>Razorpay fee</dt><dd class="num">${inr(x.fee, 2)} + GST ${inr(x.tax, 2)}</dd><dt>Net to you</dt><dd class="num">${inr(x.amount - x.fee - x.tax, 2)}</dd>`}<dt>Source</dt><dd>${x.source === 'razorpay' ? 'Real Razorpay payment' : 'Test payment'}</dd>
          </dl></div></section>
          ${e ? `<section class="card"><div class="card-head"><h2>Failure details</h2></div><div class="card-body"><dl class="dl"><dt>Reason</dt><dd class="mono">${esc(e.reason || '—')}</dd><dt>Error code</dt><dd class="mono">${esc(e.code || '—')}</dd><dt>Failed at</dt><dd class="mono">${esc(e.step || '—')}</dd><dt>Caused by</dt><dd>${esc(e.source || '—')}</dd></dl></div></section>` : ''}
          <section class="card"><div class="card-head"><h2>Customer</h2></div><div class="card-body"><dl class="dl"><dt>Name</dt><dd><a href="/customers?id=${c.id}">${esc(c.name)}</a></dd><dt>Phone</dt><dd>${esc(c.phone)}</dd><dt>Paid from</dt><dd>${esc(x.device || b?.source || '—')}</dd>${x.ip ? `<dt>IP address</dt><dd class="mono">${esc(x.ip)}</dd>` : ''}<dt>Booking</dt><dd><a href="/bookings/${x.bookingId}">${x.bookingId}</a>${b ? `<div class="cell-sub">${esc(service(b.serviceId).name)} · ${date(b.slot)}</div>` : ''}</dd></dl></div></section>
          <section class="card"><div class="card-head"><h2>Actions</h2></div><div class="card-body stack" style="gap:8px">
            ${['captured', 'partially_refunded'].includes(x.status) && left > 0 ? `<button class="btn btn-danger" id="rfBtn">Refund ${inr(left)}…</button>` : ''}
            ${x.status === 'failed' && b && b.payStatus !== 'paid' ? `<a class="btn btn-primary" href="/bookings/${x.bookingId}">Collect again from booking</a>` : ''}
            ${x.source === 'razorpay' ? `<a class="btn" href="https://dashboard.razorpay.com/app/payments/${x.id}" target="_blank" rel="noopener">Open in Razorpay Dashboard ↗</a>` : ''}
            <a class="btn" href="/payments">Back to all payments</a>
          </div></section>
        </div>
      </div>`;
    document.getElementById('rfBtn')?.addEventListener('click', () => HH.refundDialog(x, render));
  }
  render();
})();
