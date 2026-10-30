(function () {
  const { db, esc, badge, customer, partner, service, date } = HH;
  const view = HH.shell({ title: 'Reviews', subtitle: 'Customer ratings for completed jobs' });
  const stars = (n) => `<span class="stars" aria-label="${n} out of 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
  function render() {
    const pub = db.reviews.filter(r => r.status === 'published');
    const avg = pub.length ? pub.reduce((s, r) => s + r.rating, 0) / pub.length : 0;
    view.innerHTML = `<div class="grid grid-main">
      <section class="card" id="tbl"></section>
      <section class="card"><div class="card-head"><h2>Rating breakdown</h2></div><div class="card-body stack">
        <div class="row"><span class="kpi-value">${avg.toFixed(2)}</span>${stars(Math.round(avg))}<span class="muted small">${pub.length} published</span></div>
        <div id="dist"></div>
        <div class="section-title">Lowest rated partners</div>
        ${[...new Set(db.reviews.map(r => r.partnerId))].filter(Boolean).map(pid => ({ p: partner(pid), avg: db.reviews.filter(r => r.partnerId === pid).reduce((s, r, _, a) => s + r.rating / a.length, 0) })).sort((a, b) => a.avg - b.avg).slice(0, 4).map(x => `<a class="row small" href="/partners?id=${x.p.id}" style="color:inherit"><span>${esc(x.p.name)}</span><span class="spacer"></span><b class="num">${x.avg.toFixed(1)} ★</b></a>`).join('')}
      </div></section></div>`;
    HH.hbars(document.getElementById('dist'), [5, 4, 3, 2, 1].map(n => ({ label: n + ' star', value: pub.filter(r => r.rating === n).length })), v => v + ' reviews');
    HH.table(document.getElementById('tbl'), {
      rows: () => db.reviews,
      tabs: { items: [['pending', 'Waiting for moderation'], ['published', 'Published'], ['hidden', 'Hidden'], ['all', 'All']], match: (r, k) => k === 'all' || r.status === k },
      search: { placeholder: 'Text, customer, partner', fields: r => [r.text, customer(r.customerId).name, partner(r.partnerId)?.name, r.bookingId] },
      filters: [{ label: 'Rating', options: [5, 4, 3, 2, 1].map(n => [n, n + ' star']), value: r => r.rating }],
      pageSize: 8,
      columns: [
        { key: 'r', label: 'Review', render: r => `<div>${stars(r.rating)}</div><div style="max-width:52ch">${esc(r.text)}</div>${r.reply ? `<div class="cell-sub" style="margin-top:4px">↳ Reply: ${esc(r.reply)}</div>` : ''}` },
        { key: 'who', label: 'Customer · Partner', render: r => `<div>${esc(customer(r.customerId).name)}</div><div class="cell-sub">for ${esc(partner(r.partnerId)?.name || '—')}</div>` },
        { key: 'svc', label: 'Job', render: r => `<a href="/bookings/${r.bookingId}">${r.bookingId}</a><div class="cell-sub">${esc(service(r.serviceId).name)} · ${date(r.at)}</div>` },
        { key: 's', label: 'Status', render: r => badge('review', r.status) },
        { key: 'a', label: '', align: 'right', render: r => `<div class="row" style="justify-content:flex-end;flex-wrap:nowrap">${r.status !== 'published' ? `<button class="btn btn-sm" data-act="publish" data-id="${r.id}">Publish</button>` : ''}${r.status !== 'hidden' ? `<button class="btn btn-sm" data-act="hide" data-id="${r.id}">Hide</button>` : ''}<button class="btn btn-sm" data-act="reply" data-id="${r.id}">Reply</button></div>` }
      ]
    });
    document.getElementById('tbl').addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const r = HH.by(db.reviews, b.dataset.id);
      if (b.dataset.act === 'reply') {
        const text = await HH.confirmDialog({ title: 'Reply to review', text: `“${r.text}”`, ok: 'Post reply', input: { label: 'Your reply (shown publicly under the review)', value: r.reply, type: 'textarea' } });
        if (text === false) return; r.reply = text.trim();
      } else r.status = b.dataset.act === 'publish' ? 'published' : 'hidden';
      HH.audit(`Review ${r.id}: ${b.dataset.act}`); HH.save(); render(); HH.toast('Review updated.', 'good');
    });
  }
  render();
})();
