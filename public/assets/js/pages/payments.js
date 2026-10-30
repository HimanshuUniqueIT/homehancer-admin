(function () {
  const { db, esc, inr, badge, customer, datetime, date, icon } = HH;
  const view = HH.shell({ title: 'Payments', subtitle: 'Razorpay transactions, refunds and settlements', actions: `<button class="btn" id="exportBtn">${icon('download')}Export CSV</button><a class="btn" href="/razorpay">${icon('razorpay')}Gateway settings</a>` });

  function render() {
    const cap = db.transactions.filter(t => t.status !== 'failed');
    const gross = cap.reduce((s, t) => s + t.amount, 0);
    const refunds = db.transactions.flatMap(t => t.refunds).reduce((s, r) => s + r.amount, 0);
    const fees = cap.reduce((s, t) => s + t.fee + t.tax, 0);
    const failed = db.transactions.filter(t => t.status === 'failed').length;
    const successRate = db.transactions.length ? Math.round((cap.length / db.transactions.length) * 1000) / 10 : 0;

    // Settlements: Razorpay settles captured payments T+2 working days. Group by capture date.
    const byDay = {};
    cap.forEach(t => { const d = t.createdAt.slice(0, 10); (byDay[d] = byDay[d] || []).push(t); });
    const settlements = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10).map(([d, list]) => {
      const amt = list.reduce((s, t) => s + t.amount, 0), fee = list.reduce((s, t) => s + t.fee + t.tax, 0), rf = list.flatMap(t => t.refunds).reduce((s, r) => s + r.amount, 0);
      const due = new Date(d); due.setDate(due.getDate() + 2);
      return { d, count: list.length, amt, fee, rf, net: amt - fee - rf, due, settled: due < new Date(), utr: 'SETL' + d.replace(/-/g, '') + list.length };
    });

    view.innerHTML = `<div class="grid grid-4">
        <div class="card kpi"><span class="kpi-label">Gross collected</span><span class="kpi-value">${inr(gross)}</span><span class="kpi-delta muted" style="font-weight:400">${cap.length} successful payments</span></div>
        <div class="card kpi"><span class="kpi-label">Refunded</span><span class="kpi-value">${inr(refunds)}</span></div>
        <div class="card kpi"><span class="kpi-label">Razorpay fees + GST</span><span class="kpi-value">${inr(fees)}</span><span class="kpi-delta muted" style="font-weight:400">about 2% + 18% GST on fee</span></div>
        <div class="card kpi"><span class="kpi-label">Success rate</span><span class="kpi-value">${successRate}%</span><span class="kpi-delta ${failed ? 'down' : 'up'}">${failed} failed payments</span></div>
      </div>
      <section class="card" id="tbl"></section>
      <section class="card"><div class="card-head"><h2>Settlements</h2><span class="muted small">Razorpay pays out captured amounts T+2 days. Compare with your bank statement.</span></div>
        <div class="table-wrap"><table><thead><tr><th>Captured on</th><th class="right">Payments</th><th class="right">Gross</th><th class="right">Fees + GST</th><th class="right">Refunds</th><th class="right">Net settled</th><th>Expected</th><th>Status</th><th>UTR</th></tr></thead><tbody>
        ${settlements.map(s => `<tr><td>${date(s.d)}</td><td class="right num">${s.count}</td><td class="right num">${inr(s.amt)}</td><td class="right num">− ${inr(s.fee, 2)}</td><td class="right num">${s.rf ? '− ' + inr(s.rf) : '—'}</td><td class="right num cell-main">${inr(s.net, 2)}</td><td>${date(s.due)}</td><td>${s.settled ? '<span class="badge b-good">Settled</span>' : '<span class="badge b-warn">Scheduled</span>'}</td><td class="mono">${s.settled ? s.utr : '—'}</td></tr>`).join('')}
        </tbody></table></div></section>`;

    const t = HH.table(document.getElementById('tbl'), {
      rows: () => db.transactions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      tabs: { items: [['all', 'All'], ['captured', 'Captured'], ['failed', 'Failed'], ['refunds', 'Refunded']], match: (x, k) => k === 'all' || (k === 'refunds' ? x.refunds.length > 0 : x.status === k) },
      search: { placeholder: 'Payment ID, order ID, booking', fields: x => [x.id, x.orderId, x.bookingId, customer(x.customerId).name] },
      filters: [{ label: 'Method', options: [['upi', 'UPI'], ['card', 'Card'], ['netbanking', 'Netbanking'], ['wallet', 'Wallet'], ['razorpay', 'Razorpay checkout']], value: x => x.method }, { label: 'Source', options: [['razorpay', 'Real Razorpay'], ['demo', 'Demo']], value: x => x.source }],
      columns: [
        { key: 'id', label: 'Payment', render: x => `<div class="mono">${x.id}</div><div class="cell-sub mono">${x.orderId}</div>` },
        { key: 'booking', label: 'Booking', render: x => `<a href="/bookings/${x.bookingId}">${x.bookingId}</a><div class="cell-sub">${esc(customer(x.customerId).name)}</div>` },
        { key: 'method', label: 'Method', render: x => x.method.toUpperCase() },
        { key: 'amount', label: 'Amount', align: 'right', sort: x => x.amount, render: x => `<span class="num cell-main">${inr(x.amount)}</span>${x.refunds.length ? `<div class="cell-sub num">− ${inr(x.refunds.reduce((s, r) => s + r.amount, 0))} refunded</div>` : ''}` },
        { key: 'fee', label: 'Fee + GST', align: 'right', render: x => `<span class="num">${inr(x.fee + x.tax, 2)}</span>` },
        { key: 'status', label: 'Status', render: x => badge('tx', x.status) + (x.source === 'razorpay' ? ' <span class="badge b-accent plain">live API</span>' : '') },
        { key: 'when', label: 'When', sort: x => x.createdAt, render: x => `<span class="cell-sub">${datetime(x.createdAt)}</span>` }
      ],
      onRow: open
    });
    document.getElementById('exportBtn').onclick = () => HH.downloadCSV('payments.csv', t.visible, [['Payment ID', x => x.id], ['Order ID', x => x.orderId], ['Booking', x => x.bookingId], ['Customer', x => customer(x.customerId).name], ['Method', x => x.method], ['Amount', x => x.amount], ['Fee', x => x.fee], ['GST on fee', x => x.tax], ['Refunded', x => x.refunds.reduce((s, r) => s + r.amount, 0)], ['Status', x => x.status], ['Created', x => x.createdAt]]);
  }

  function open(x) {
    const left = x.amount - x.refunds.reduce((s, r) => s + r.amount, 0);
    const d = HH.drawer({
      title: 'Payment ' + x.id,
      body: `<div class="stack" style="gap:18px">
        <div class="row"><span class="kpi-value">${inr(x.amount)}</span>${badge('tx', x.status)}</div>
        <dl class="dl"><dt>Payment ID</dt><dd class="mono">${x.id}</dd><dt>Order ID</dt><dd class="mono">${x.orderId}</dd><dt>Booking</dt><dd><a href="/bookings/${x.bookingId}">${x.bookingId}</a></dd><dt>Customer</dt><dd>${esc(customer(x.customerId).name)} · ${esc(customer(x.customerId).phone)}</dd><dt>Method</dt><dd>${x.method.toUpperCase()}</dd><dt>Created</dt><dd>${datetime(x.createdAt)}</dd><dt>Razorpay fee</dt><dd class="num">${inr(x.fee, 2)} + GST ${inr(x.tax, 2)}</dd><dt>Net to you</dt><dd class="num">${inr(x.amount - x.fee - x.tax, 2)}</dd><dt>Source</dt><dd>${x.source === 'razorpay' ? 'Real Razorpay payment' : 'Demo data'}</dd></dl>
        <div><div class="section-title">Refunds</div>${x.refunds.length ? `<div class="card list">${x.refunds.map(r => `<div class="list-item"><div><div class="mono">${r.id}</div><div class="cell-sub">${datetime(r.at)} · ${r.speed === 'optimum' ? 'Instant' : 'Normal'}${r.reason ? ' · ' + esc(r.reason) : ''}</div></div><span class="spacer"></span><span class="num">− ${inr(r.amount, 2)}</span>${badge('generic', r.status)}</div>`).join('')}</div>` : '<p class="muted" style="margin:0">No refunds.</p>'}</div>
        ${x.source === 'razorpay' ? `<a href="https://dashboard.razorpay.com/app/payments/${x.id}" target="_blank" rel="noopener">Open in Razorpay Dashboard ↗</a>` : ''}
      </div>`,
      foot: `${['captured', 'partially_refunded'].includes(x.status) && left > 0 ? `<button class="btn btn-danger" id="rfBtn">Refund…</button>` : ''}<span class="spacer"></span><button class="btn" data-close>Close</button>`
    });
    d.$('#rfBtn')?.addEventListener('click', () => { d.close(); HH.refundDialog(x, render); });
  }
  render();
  const pre = HH.params.get('id'); if (pre && HH.by(db.transactions, pre)) open(HH.by(db.transactions, pre));
})();
