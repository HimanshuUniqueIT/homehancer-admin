(function () {
  const { db, inr, num, esc, badge, customer, service, partner, category, date, time, rel, compactINR } = HH;
  const DAY = 864e5, now = Date.now();
  const view = HH.shell({ title: 'Dashboard', subtitle: `${new Date(now).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · Ahmedabad`, actions: `<select id="range" aria-label="Date range"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="60">Last 60 days</option></select><a class="btn btn-primary" href="/bookings?new=1">${HH.icon('plus')}New booking</a>` });

  function render(days) {
    const since = now - days * DAY, prevSince = now - 2 * days * DAY;
    const inRange = (b, a, z) => { const t = new Date(b.createdAt).getTime(); return t >= a && t < z; };
    const cur = db.bookings.filter(b => inRange(b, since, now + DAY)), prev = db.bookings.filter(b => inRange(b, prevSince, since));
    const rev = (list) => list.filter(b => b.payStatus === 'paid').reduce((s, b) => s + b.price.total, 0);
    const delta = (a, b) => b ? Math.round(((a - b) / b) * 100) : 0;
    const today = db.bookings.filter(b => HH.sameDay(b.slot, now));
    const completed = cur.filter(b => b.status === 'completed'), cancelled = cur.filter(b => b.status === 'cancelled');
    const pub = db.reviews.filter(r => r.status === 'published');
    const avgRating = pub.length ? (pub.reduce((s, r) => s + r.rating, 0) / pub.length).toFixed(2) : '—';
    const pendingPayout = db.payouts.filter(p => p.status === 'pending' || p.status === 'failed').reduce((s, p) => s + p.net, 0);
    const kpi = (label, value, d, sub) => `<div class="card kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span>${d !== null ? `<span class="kpi-delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}% <span class="muted" style="font-weight:400">vs previous ${days} days</span></span>` : `<span class="kpi-delta muted" style="font-weight:400">${sub}</span>`}</div>`;

    const alerts = [
      [db.bookings.filter(b => b.status === 'pending' || (b.status === 'confirmed' && !b.partnerId)).length, 'bookings waiting for a partner', '/bookings', 'warn'],
      [db.transactions.filter(t => t.status === 'failed' && now - new Date(t.createdAt) < 7 * DAY).length, 'failed payments this week', '/payments', 'bad'],
      [db.partners.filter(p => p.status === 'pending').length, 'partner applications to verify', '/partners', 'warn'],
      [db.tickets.filter(t => t.status !== 'resolved' && ['urgent', 'high'].includes(t.priority)).length, 'urgent or high-priority tickets', '/support', 'bad'],
      [db.reviews.filter(r => r.status === 'pending').length, 'reviews waiting for moderation', '/reviews', 'info']
    ].filter(a => a[0]);

    view.innerHTML = `
      <div class="grid grid-4">
        ${kpi('Revenue collected', inr(rev(cur)), delta(rev(cur), rev(prev)))}
        ${kpi('Bookings', num(cur.length), delta(cur.length, prev.length))}
        ${kpi('Jobs today', num(today.length), null, `${today.filter(b => b.status === 'completed').length} done · ${today.filter(b => b.status === 'in_progress').length} in progress`)}
        ${kpi('Average rating', avgRating + ' ★', null, `${pub.length} published reviews`)}
      </div>
      <div class="grid grid-main">
        <section class="card"><div class="card-head"><h2>Revenue collected per day</h2><span class="muted small">Paid bookings, incl. GST</span></div><div class="card-body"><div id="revChart"></div></div></section>
        <section class="card"><div class="card-head"><h2>Needs attention</h2></div>
          <div class="list">${alerts.length ? alerts.map(([n, t, href, k]) => `<a class="list-item" href="${href}" style="color:inherit;text-decoration:none"><span class="badge b-${k} plain" style="min-width:36px;justify-content:center">${n}</span><span>${t}</span><span class="spacer"></span><span class="muted">›</span></a>`).join('') : '<div class="empty">All clear.</div>'}
            <div class="list-item"><span class="badge b-accent plain" style="min-width:36px;justify-content:center">₹</span><span>${inr(pendingPayout)} in partner payouts due</span><span class="spacer"></span><a href="/payouts">Review</a></div>
          </div></section>
      </div>
      <div class="grid grid-3">
        <section class="card"><div class="card-head"><h2>Revenue by category</h2></div><div class="card-body" id="catBars"></div></section>
        <section class="card"><div class="card-head"><h2>Booking status</h2><span class="muted small">${cur.length} bookings</span></div><div class="card-body" id="statusMix"></div></section>
        <section class="card"><div class="card-head"><h2>Top zones</h2></div><div class="card-body" id="zoneBars"></div></section>
      </div>
      <div class="grid grid-main">
        <section class="card"><div class="card-head"><h2>Today's schedule</h2><a href="/bookings">All bookings</a></div><div class="table-wrap"><table><thead><tr><th>Slot</th><th>Booking</th><th>Service</th><th>Partner</th><th>Status</th></tr></thead><tbody>
          ${today.sort((a, b) => a.slot.localeCompare(b.slot)).map(b => `<tr class="clickable" onclick="location.href='/bookings/${b.id}'"><td class="num">${time(b.slot)}</td><td><div class="cell-main">${b.id}</div><div class="cell-sub">${esc(customer(b.customerId).name)} · ${esc(b.zone)}</div></td><td>${esc(service(b.serviceId).name)}</td><td>${b.partnerId ? esc(partner(b.partnerId).name) : '<span class="badge b-warn">Unassigned</span>'}</td><td>${badge('booking', b.status)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">No jobs scheduled today.</div></td></tr>'}
        </tbody></table></div></section>
        <section class="card"><div class="card-head"><h2>Recent payments</h2><a href="/payments">All payments</a></div><div class="list">
          ${db.transactions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7).map(t => `<div class="list-item"><div><div class="cell-main num">${inr(t.amount)}</div><div class="cell-sub">${t.bookingId} · ${t.method.toUpperCase()} · ${rel(t.createdAt)}</div></div><span class="spacer"></span>${badge('tx', t.status)}</div>`).join('')}
        </div></section>
      </div>`;

    // Revenue per day
    const pts = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      const list = db.bookings.filter(b => b.payStatus === 'paid' && HH.sameDay(b.createdAt, d));
      pts.push({ label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: list.reduce((s, b) => s + b.price.total, 0), sub: `${list.length} bookings` });
    }
    HH.lineChart(document.getElementById('revChart'), pts, { format: compactINR });

    const byCat = db.categories.map(c => ({ label: c.name, value: rev(cur.filter(b => b.catId === c.id)) })).filter(r => r.value).sort((a, b) => b.value - a.value);
    HH.hbars(document.getElementById('catBars'), byCat);
    const byZone = [...new Set(cur.map(b => b.zone))].map(z => ({ label: z, value: cur.filter(b => b.zone === z).length })).sort((a, b) => b.value - a.value).slice(0, 6);
    HH.hbars(document.getElementById('zoneBars'), byZone, v => num(v) + ' jobs');

    // Status mix as a segmented bar using status colours (each labelled)
    const order = [['completed', 'var(--good)'], ['in_progress', 'var(--accent)'], ['assigned', 'color-mix(in srgb, var(--accent) 55%, var(--surface))'], ['confirmed', 'var(--info)'], ['pending', 'var(--warn)'], ['cancelled', 'var(--bad)']];
    const counts = order.map(([s, c]) => [s, c, cur.filter(b => b.status === s).length]).filter(x => x[2]);
    const total = Math.max(cur.length, 1);
    document.getElementById('statusMix').innerHTML = `<div class="seg-bar">${counts.map(([s, c, n]) => `<span style="width:${(n / total) * 100}%;background:${c}" title="${s}: ${n}"></span>`).join('')}</div>
      <div class="stack" style="gap:6px;margin-top:14px">${counts.map(([s, c, n]) => `<div class="row small"><i style="width:10px;height:10px;border-radius:3px;background:${c};display:inline-block"></i>${badge('booking', s)}<span class="spacer"></span><b class="num">${n}</b><span class="muted num" style="width:44px;text-align:right">${Math.round((n / total) * 100)}%</span></div>`).join('')}</div>
      <p class="small muted" style="margin:12px 0 0">Cancellation rate ${Math.round((cancelled.length / total) * 100)}% · completion ${Math.round((completed.length / total) * 100)}%</p>`;
  }
  const range = document.getElementById('range');
  range.addEventListener('change', () => render(+range.value));
  render(30);
})();
