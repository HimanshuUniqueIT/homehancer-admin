(function () {
  const { db, inr, num, esc, category, service, partner, compactINR, icon } = HH;
  const DAY = 864e5;
  const view = HH.shell({ title: 'Reports', subtitle: 'Revenue, tax, partner and service performance', actions: `<select id="range" aria-label="Period">${HH.opt([['7', 'Last 7 days'], ['30', 'Last 30 days'], ['60', 'Last 60 days']], '30')}</select>` });

  function render(days) {
    const since = Date.now() - days * DAY;
    const list = db.bookings.filter(b => new Date(b.createdAt) >= since);
    const paid = list.filter(b => b.payStatus === 'paid');
    const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
    const gross = sum(paid, b => b.price.total), gst = sum(paid, b => b.price.gst), disc = sum(list, b => b.price.discount);
    const commission = sum(paid, b => (b.price.subtotal + b.price.visit) * category(b.catId).commission / 100) + sum(paid, b => b.price.platformFee);
    const custIds = list.map(b => b.customerId), repeat = new Set(custIds.filter((c, i) => custIds.indexOf(c) !== i)).size;
    const svcRows = db.services.map(s => { const l = list.filter(b => b.serviceId === s.id); return { s, n: l.length, rev: sum(l.filter(b => b.payStatus === 'paid'), b => b.price.total), cx: l.filter(b => b.status === 'cancelled').length }; }).filter(r => r.n).sort((a, b) => b.rev - a.rev);
    const pRows = db.partners.filter(p => p.status === 'active').map(p => { const l = list.filter(b => b.partnerId === p.id); const rv = db.reviews.filter(r => r.partnerId === p.id); return { p, n: l.filter(b => b.status === 'completed').length, cx: l.filter(b => b.status === 'cancelled').length, rating: rv.length ? sum(rv, r => r.rating) / rv.length : p.rating }; }).sort((a, b) => b.n - a.n);

    view.innerHTML = `<div class="grid grid-4">
        <div class="card kpi"><span class="kpi-label">Gross revenue</span><span class="kpi-value">${inr(gross)}</span></div>
        <div class="card kpi"><span class="kpi-label">HomeHancer earnings</span><span class="kpi-value">${inr(commission)}</span><span class="kpi-delta muted" style="font-weight:400">commission + platform fees</span></div>
        <div class="card kpi"><span class="kpi-label">GST collected</span><span class="kpi-value">${inr(gst)}</span><span class="kpi-delta muted" style="font-weight:400">CGST ${inr(gst / 2)} · SGST ${inr(gst / 2)}</span></div>
        <div class="card kpi"><span class="kpi-label">Discounts given</span><span class="kpi-value">${inr(disc)}</span></div>
      </div>
      <div class="grid grid-2">
        <section class="card"><div class="card-head"><h2>Bookings per day</h2></div><div class="card-body" id="bpd"></div></section>
        <section class="card"><div class="card-head"><h2>Customers</h2></div><div class="card-body stack">
          <dl class="dl"><dt>Unique customers</dt><dd class="num">${new Set(custIds).size}</dd><dt>Repeat customers</dt><dd class="num">${repeat} (${Math.round(repeat / Math.max(new Set(custIds).size, 1) * 100)}%)</dd><dt>Average order</dt><dd class="num">${inr(gross / Math.max(paid.length, 1))}</dd><dt>Cancellation rate</dt><dd class="num">${Math.round(list.filter(b => b.status === 'cancelled').length / Math.max(list.length, 1) * 100)}%</dd><dt>Online vs cash</dt><dd class="num">${Math.round(list.filter(b => b.payMode === 'online').length / Math.max(list.length, 1) * 100)}% online</dd></dl>
          <div class="section-title">Bookings by source</div><div id="src"></div>
        </div></section>
      </div>
      <section class="card"><div class="card-head"><h2>Service performance</h2><button class="btn btn-sm" id="exSvc">${icon('download')}CSV</button></div><div class="table-wrap"><table><thead><tr><th>Service</th><th>Category</th><th class="right">Bookings</th><th class="right">Revenue</th><th class="right">Cancelled</th></tr></thead><tbody>
        ${svcRows.map(r => `<tr><td class="cell-main">${esc(r.s.name)}</td><td>${esc(category(r.s.catId).name)}</td><td class="right num">${r.n}</td><td class="right num">${inr(r.rev)}</td><td class="right num">${r.cx ? `${r.cx} (${Math.round(r.cx / r.n * 100)}%)` : '—'}</td></tr>`).join('')}
      </tbody></table></div></section>
      <section class="card"><div class="card-head"><h2>Partner leaderboard</h2><button class="btn btn-sm" id="exP">${icon('download')}CSV</button></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Partner</th><th class="right">Jobs completed</th><th class="right">Cancelled</th><th class="right">Rating</th></tr></thead><tbody>
        ${pRows.map((r, i) => `<tr><td class="num">${i + 1}</td><td><a href="/partners?id=${r.p.id}">${esc(r.p.name)}</a></td><td class="right num">${r.n}</td><td class="right num">${r.cx}</td><td class="right num">${r.rating ? r.rating.toFixed(1) + ' ★' : '—'}</td></tr>`).join('')}
      </tbody></table></div></section>
      <section class="card"><div class="card-head"><h2>GST summary for filing</h2><button class="btn btn-sm" id="exGst">${icon('download')}GSTR-1 CSV</button></div><div class="card-body"><dl class="dl"><dt>Taxable value</dt><dd class="num">${inr(gross - gst)}</dd><dt>CGST 9%</dt><dd class="num">${inr(gst / 2, 2)}</dd><dt>SGST 9%</dt><dd class="num">${inr(gst / 2, 2)}</dd><dt>Invoices</dt><dd class="num">${paid.length}</dd><dt>SAC</dt><dd>${db.settings.tax.sac}</dd></dl></div></section>`;
    const pts = [];
    for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * DAY); pts.push({ label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: list.filter(b => HH.sameDay(b.createdAt, d)).length }); }
    HH.barChart(document.getElementById('bpd'), pts);
    HH.hbars(document.getElementById('src'), ['Android app', 'iOS app', 'Website', 'Admin panel'].map(s => ({ label: s, value: list.filter(b => b.source === s).length })).filter(r => r.value), v => num(v));
    document.getElementById('exSvc').onclick = () => HH.downloadCSV('service-performance.csv', svcRows, [['Service', r => r.s.name], ['Category', r => category(r.s.catId).name], ['Bookings', r => r.n], ['Revenue', r => r.rev], ['Cancelled', r => r.cx]]);
    document.getElementById('exP').onclick = () => HH.downloadCSV('partner-leaderboard.csv', pRows, [['Partner', r => r.p.name], ['Jobs', r => r.n], ['Cancelled', r => r.cx], ['Rating', r => r.rating.toFixed(2)]]);
    document.getElementById('exGst').onclick = () => HH.downloadCSV('gstr1-b2c.csv', paid, [['Invoice', b => db.settings.tax.invoicePrefix + b.id.slice(2)], ['Date', b => b.createdAt.slice(0, 10)], ['Place of supply', () => '24-Gujarat'], ['SAC', () => db.settings.tax.sac], ['Taxable value', b => b.price.total - b.price.gst], ['Rate', () => 18], ['CGST', b => b.price.gst / 2], ['SGST', b => b.price.gst / 2], ['Total', b => b.price.total]]);
  }
  const r = document.getElementById('range'); r.addEventListener('change', () => render(+r.value)); render(30);
})();
