(function () {
  const { db, esc, inr, badge, partner, date, icon, opt } = HH;
  const MANUAL = { bank: 'Bank transfer', upi: 'UPI', cheque: 'Cheque', cash: 'Cash' };
  const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
      <div class="callout info">${icon('info')}<div>Payouts go through <b>RazorpayX</b> (IMPS/UPI to the partner's bank) when it is turned on in <a href="/razorpay#route">Razorpay settings</a>. Paid outside RazorpayX? Use <b>Pay manually</b> to record it. Cash collected by partners is deducted from the next payout.</div></div>
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
        { key: 'status', label: 'Status', render: p => badge('payout', p.status) + (p.manual ? `<div class="cell-sub">Manual · ${MANUAL[p.manual.method]}${p.at ? ' · ' + date(p.at) : ''}</div>` : '') + (p.utr ? `<div class="cell-sub mono">${esc(p.utr)}</div>` : '') },
        { key: 'act', label: '', align: 'right', render: p => ['pending', 'failed'].includes(p.status) ? `<div class="row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn btn-sm" data-manual="${p.id}">Pay manually</button><button class="btn btn-sm" data-pay="${p.id}">${p.status === 'failed' ? 'Retry' : 'Pay now'}</button></div>` : p.manual ? `<button class="btn btn-sm" data-undo="${p.id}">Undo</button>` : '' }
      ]
    });
    document.getElementById('tbl').addEventListener('click', e => { const b = e.target.closest('[data-pay]'); if (b) pay([HH.by(db.payouts, b.dataset.pay)]); const m = e.target.closest('[data-manual]'); if (m) manualDialog(HH.by(db.payouts, m.dataset.manual)); const u = e.target.closest('[data-undo]'); if (u) undoManual(HH.by(db.payouts, u.dataset.undo)); });
  }
  function manualDialog(p) {
    const pr = partner(p.partnerId);
    const m = HH.modal({
      title: 'Record manual payment',
      body: `<div class="stack" style="gap:14px"><dl class="dl"><dt>Partner</dt><dd>${esc(pr.name)}</dd><dt>Payout</dt><dd>${p.id} · ${esc(p.period)}</dd><dt>Amount</dt><dd class="num"><b>${inr(p.net)}</b></dd><dt>Bank account</dt><dd class="mono">${esc(pr.bank.account)} · ${esc(pr.bank.ifsc)}</dd><dt>UPI</dt><dd class="mono">${esc(pr.bank.upi)}</dd></dl>
        <div class="callout info">${icon('info')}<div>Send the money first. This only records the payment; it does not move any money.</div></div>
        <div class="form-grid"><div class="field"><label for="mp-method">Paid by</label><select id="mp-method">${opt(Object.entries(MANUAL))}</select></div>
        <div class="field"><label for="mp-date">Payment date</label><input id="mp-date" type="date" value="${localDay()}" max="${localDay()}"></div>
        <div class="field full"><label for="mp-ref" id="mp-ref-label">UTR / reference number</label><input id="mp-ref" class="mono" autocomplete="off"></div>
        <div class="field full"><label for="mp-note">Note (optional)</label><input id="mp-note" placeholder="Paid from HDFC current account"></div></div>
        <div id="mp-err" class="callout bad hidden"></div></div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="mp-ok">Mark ${inr(p.net)} as paid</button>`
    });
    const method = m.$('#mp-method'), ref = m.$('#mp-ref');
    const refName = { bank: 'UTR / reference number', upi: 'UPI transaction ID', cheque: 'Cheque number', cash: 'Receipt number (optional)' };
    method.addEventListener('change', () => { m.$('#mp-ref-label').textContent = refName[method.value]; });
    m.$('#mp-ok').addEventListener('click', () => {
      const err = (text) => { m.$('#mp-err').textContent = text; m.$('#mp-err').classList.remove('hidden'); };
      const reference = ref.value.trim(), day = m.$('#mp-date').value;
      if (method.value !== 'cash' && !reference) return err(`Enter the ${refName[method.value]}.`);
      if (!day || day > localDay()) return err('Pick a payment date that is not in the future.');
      if (reference && db.payouts.some(o => o.utr && o.utr.toLowerCase() === reference.toLowerCase())) return err('This reference is already used on another payout. Check it was not paid twice.');
      Object.assign(p, { status: 'paid', utr: reference, at: new Date(day + 'T12:00').toISOString(), manual: { method: method.value, note: m.$('#mp-note').value.trim(), by: HH.session.name } });
      HH.audit(`Recorded manual payout ${p.id}: ${inr(p.net)} to ${pr.name} by ${MANUAL[method.value]}${reference ? ' (' + reference + ')' : ''}`);
      HH.save(); m.close(); render(); HH.toast(`Manual payment of ${inr(p.net)} recorded.`, 'good');
    });
  }
  async function undoManual(p) {
    if (!(await HH.confirmDialog({ title: `Undo manual payment ${p.id}?`, text: `This puts ${inr(p.net)} back to pending. It does not recover any money already sent.`, ok: 'Undo payment' }))) return;
    HH.audit(`Undid manual payout ${p.id}: ${inr(p.net)} to ${partner(p.partnerId).name} (${p.utr || 'no reference'})`);
    Object.assign(p, { status: 'pending', utr: '' }); delete p.at; delete p.manual;
    HH.save(); render(); HH.toast('Manual payment undone.');
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
  document.getElementById('exportBtn').addEventListener('click', () => HH.downloadCSV('partner-payouts.csv', t.visible, [['Payout', p => p.id], ['Period', p => p.period], ['Partner', p => partner(p.partnerId).name], ['Account', p => partner(p.partnerId).bank.account], ['IFSC', p => partner(p.partnerId).bank.ifsc], ['UPI', p => partner(p.partnerId).bank.upi], ['Jobs', p => p.jobs], ['Gross', p => p.gross], ['Commission', p => p.commission], ['TDS', p => p.tds], ['Net', p => p.net], ['Status', p => p.status], ['Paid by', p => p.manual ? MANUAL[p.manual.method] : p.status === 'paid' ? 'RazorpayX' : ''], ['Note', p => p.manual?.note || ''], ['UTR', p => p.utr]]));
  render();
})();
