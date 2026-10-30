(function () {
  const { db, esc, inr, badge, partner, date, icon } = HH;
  const view = HH.shell({ title: 'Partner payouts', subtitle: 'Weekly partner earnings after commission and 1% TDS', actions: `<button class="btn" id="exportBtn">${icon('download')}Export CSV</button><button class="btn btn-primary" id="payAll">Pay all pending</button>` });
  let t;
  function render() {
    const sum = (st) => db.payouts.filter(p => st.includes(p.status)).reduce((s, p) => s + p.net, 0);
    view.innerHTML = `<div class="grid grid-4">
        <div class="card kpi"><span class="kpi-label">Due now</span><span class="kpi-value">${inr(sum(['pending']))}</span><span class="kpi-delta muted" style="font-weight:400">${db.payouts.filter(p => p.status === 'pending').length} partners</span></div>
        <div class="card kpi"><span class="kpi-label">Failed, needs retry</span><span class="kpi-value">${inr(sum(['failed']))}</span></div>
        <div class="card kpi"><span class="kpi-label">Processing</span><span class="kpi-value">${inr(sum(['processing']))}</span></div>
        <div class="card kpi"><span class="kpi-label">Paid (last 4 weeks)</span><span class="kpi-value">${inr(sum(['paid']))}</span></div>
      </div>
      <div class="callout info">${icon('info')}<div>Payouts go through <b>RazorpayX</b> (IMPS/UPI to the partner's bank) when it is turned on in <a href="/razorpay#route">Razorpay settings</a>. Cash collected by partners is deducted from the next payout.</div></div>
      <section class="card" id="tbl"></section>`;
    t = HH.table(document.getElementById('tbl'), {
      rows: () => db.payouts,
      tabs: { items: [['all', 'All'], ['pending', 'Pending'], ['failed', 'Failed'], ['processing', 'Processing'], ['paid', 'Paid']], match: (p, k) => k === 'all' || p.status === k },
      search: { placeholder: 'Partner, payout ID, UTR', fields: p => [p.id, partner(p.partnerId).name, p.utr] },
      filters: [{ label: 'Period', options: [...new Set(db.payouts.map(p => p.period))], value: p => p.period }],
      columns: [
        { key: 'id', label: 'Payout', render: p => `<div class="cell-main">${p.id}</div><div class="cell-sub">${p.period} · ends ${date(p.periodEnd)}</div>` },
        { key: 'partner', label: 'Partner', sort: p => partner(p.partnerId).name, render: p => `<a href="/partners?id=${p.partnerId}">${esc(partner(p.partnerId).name)}</a><div class="cell-sub">${esc(partner(p.partnerId).bank.upi)}</div>` },
        { key: 'jobs', label: 'Jobs', align: 'right', render: p => `<span class="num">${p.jobs}</span>` },
        { key: 'gross', label: 'Gross', align: 'right', render: p => `<span class="num">${inr(p.gross)}</span>` },
        { key: 'comm', label: 'Commission', align: 'right', render: p => `<span class="num">− ${inr(p.commission)}</span>` },
        { key: 'tds', label: 'TDS 1%', align: 'right', render: p => `<span class="num">− ${inr(p.tds)}</span>` },
        { key: 'net', label: 'Net payout', align: 'right', sort: p => p.net, render: p => `<span class="num cell-main">${inr(p.net)}</span>` },
        { key: 'status', label: 'Status', render: p => badge('payout', p.status) + (p.utr ? `<div class="cell-sub mono">${p.utr}</div>` : '') },
        { key: 'act', label: '', align: 'right', render: p => ['pending', 'failed'].includes(p.status) ? `<button class="btn btn-sm" data-pay="${p.id}">${p.status === 'failed' ? 'Retry' : 'Pay now'}</button>` : '' }
      ]
    });
    document.getElementById('tbl').addEventListener('click', e => { const b = e.target.closest('[data-pay]'); if (b) pay([HH.by(db.payouts, b.dataset.pay)]); });
  }
  async function pay(list) {
    list = list.filter(p => ['pending', 'failed'].includes(p.status));
    if (!list.length) return HH.toast('Nothing pending to pay.');
    const total = list.reduce((s, p) => s + p.net, 0);
    if (!(await HH.confirmDialog({ title: `Pay ${list.length} partner${list.length > 1 ? 's' : ''}?`, text: `${inr(total)} will be sent by IMPS/UPI from your RazorpayX account. This can't be undone.`, ok: `Pay ${inr(total)}` }))) return;
    list.forEach(p => { p.status = 'processing'; });
    HH.save(); render(); HH.toast('Payouts queued with RazorpayX.', 'good');
    // Simulate RazorpayX webhook payout.processed after a moment
    setTimeout(() => {
      list.forEach(p => { p.status = 'paid'; p.utr = 'UTR' + Math.floor(1e8 + Math.random() * 9e8); p.at = new Date().toISOString(); });
      HH.audit(`Paid ${list.length} partner payouts totalling ${inr(total)}`); HH.save(); render(); HH.toast(`${list.length} payout${list.length > 1 ? 's' : ''} completed.`, 'good');
    }, 1800);
  }
  document.getElementById('payAll').addEventListener('click', () => pay(db.payouts));
  document.getElementById('exportBtn').addEventListener('click', () => HH.downloadCSV('partner-payouts.csv', t.visible, [['Payout', p => p.id], ['Period', p => p.period], ['Partner', p => partner(p.partnerId).name], ['Account', p => partner(p.partnerId).bank.account], ['IFSC', p => partner(p.partnerId).bank.ifsc], ['UPI', p => partner(p.partnerId).bank.upi], ['Jobs', p => p.jobs], ['Gross', p => p.gross], ['Commission', p => p.commission], ['TDS', p => p.tds], ['Net', p => p.net], ['Status', p => p.status], ['UTR', p => p.utr]]));
  render();
})();
