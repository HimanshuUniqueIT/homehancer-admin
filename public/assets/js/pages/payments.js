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
      <section class="card"><div class="card-head"><h2>Why payments fail</h2><span class="muted small">${failed} failed attempts by reason. Click any payment below for its full journey.</span></div><div class="card-body" id="whyFail"></div></section>
      <section class="card" id="tbl"></section>
      <section class="card"><div class="card-head"><h2>Settlements</h2><span class="muted small">Razorpay pays out captured amounts T+2 days. Compare with your bank statement.</span></div>
        <div class="table-wrap"><table><thead><tr><th>Captured on</th><th class="right">Payments</th><th class="right">Gross</th><th class="right">Fees + GST</th><th class="right">Refunds</th><th class="right">Net settled</th><th>Expected</th><th>Status</th><th>UTR</th></tr></thead><tbody>
        ${settlements.map(s => `<tr><td>${date(s.d)}</td><td class="right num">${s.count}</td><td class="right num">${inr(s.amt)}</td><td class="right num">− ${inr(s.fee, 2)}</td><td class="right num">${s.rf ? '− ' + inr(s.rf) : '—'}</td><td class="right num cell-main">${inr(s.net, 2)}</td><td>${date(s.due)}</td><td>${s.settled ? '<span class="badge b-good">Settled</span>' : '<span class="badge b-warn">Scheduled</span>'}</td><td class="mono">${s.settled ? s.utr : '—'}</td></tr>`).join('')}
        </tbody></table></div></section>`;

    const t = HH.table(document.getElementById('tbl'), {
      rows: () => db.transactions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      tabs: { items: [['all', 'All'], ['captured', 'Captured'], ['failed', 'Failed'], ['refunds', 'Refunded']], match: (x, k) => k === 'all' || (k === 'refunds' ? x.refunds.length > 0 : x.status === k) },
      search: { placeholder: 'Payment ID, order ID, booking', fields: x => [x.id, x.orderId, x.bookingId, customer(x.customerId).name] },
      filters: [{ label: 'Method', options: [['upi', 'UPI'], ['card', 'Card'], ['netbanking', 'Netbanking'], ['wallet', 'Wallet'], ['razorpay', 'Razorpay checkout']], value: x => x.method }, { label: 'Failure reason', options: window.HH_FAILURES.map(f => [f.reason, f.description]), value: x => x.error?.reason }, { label: 'Source', options: [['razorpay', 'Real Razorpay'], ['test', 'Test']], value: x => x.source }],
      columns: [
        { key: 'id', label: 'Payment', render: x => `<div class="mono">${x.id}</div><div class="cell-sub mono">${x.orderId}</div>` },
        { key: 'booking', label: 'Booking', render: x => `<a href="/bookings/${x.bookingId}">${x.bookingId}</a><div class="cell-sub">${esc(customer(x.customerId).name)}</div>` },
        { key: 'method', label: 'Method', render: x => x.method.toUpperCase() },
        { key: 'amount', label: 'Amount', align: 'right', sort: x => x.amount, render: x => `<span class="num cell-main">${inr(x.amount)}</span>${x.refunds.length ? `<div class="cell-sub num">− ${inr(x.refunds.reduce((s, r) => s + r.amount, 0))} refunded</div>` : ''}` },
        { key: 'fee', label: 'Fee + GST', align: 'right', render: x => `<span class="num">${inr(x.fee + x.tax, 2)}</span>` },
        { key: 'status', label: 'Status', render: x => badge('tx', x.status) + (x.source === 'razorpay' ? ' <span class="badge b-accent plain">live API</span>' : '') + (x.error ? `<div class="cell-sub">${esc(x.error.description || 'Reason not returned')}</div>` : '') },
        { key: 'when', label: 'When', sort: x => x.createdAt, render: x => `<span class="cell-sub">${datetime(x.createdAt)}</span>` }
      ],
      onRow: x => { location.href = '/payments/' + x.id; }
    });
    HH.hbars(document.getElementById('whyFail'), window.HH_FAILURES.map(f => ({ label: f.description, value: db.transactions.filter(x => x.error?.reason === f.reason).length })).filter(r => r.value).sort((p, q) => q.value - p.value), v => v + (v === 1 ? ' attempt' : ' attempts'));
    document.getElementById('exportBtn').onclick = () => HH.downloadCSV('payments.csv', t.visible, [['Payment ID', x => x.id], ['Order ID', x => x.orderId], ['Booking', x => x.bookingId], ['Customer', x => customer(x.customerId).name], ['Method', x => x.method], ['Amount', x => x.amount], ['Fee', x => x.fee], ['GST on fee', x => x.tax], ['Refunded', x => x.refunds.reduce((s, r) => s + r.amount, 0)], ['Status', x => x.status], ['Failure reason', x => x.error?.description || ''], ['Created', x => x.createdAt]]);
  }

  render();
  const pre = HH.params.get('id'); if (pre) location.replace('/payments/' + pre);
})();
