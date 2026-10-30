(function () {
  const { db, esc, inr, badge, service, date, rel, icon } = HH;
  const view = HH.shell({ title: 'Customers', subtitle: `${db.customers.length} registered customers`, actions: `<button class="btn" id="exportBtn">${icon('download')}Export CSV</button>` });
  const stats = (c) => {
    const list = db.bookings.filter(b => b.customerId === c.id);
    return { list, count: list.length, spent: list.filter(b => b.payStatus === 'paid').reduce((s, b) => s + b.price.total, 0), last: list.map(b => b.createdAt).sort().at(-1) };
  };
  const since30 = Date.now() - 30 * 864e5;
  const repeat = db.customers.filter(c => stats(c).count > 1).length;
  view.innerHTML = `<div class="grid grid-4">
      <div class="card kpi"><span class="kpi-label">Total customers</span><span class="kpi-value">${db.customers.length}</span></div>
      <div class="card kpi"><span class="kpi-label">New in last 30 days</span><span class="kpi-value">${db.customers.filter(c => new Date(c.joined) > since30).length}</span></div>
      <div class="card kpi"><span class="kpi-label">Repeat customers</span><span class="kpi-value">${Math.round(repeat / db.customers.length * 100)}%</span><span class="kpi-delta muted" style="font-weight:400">${repeat} booked more than once</span></div>
      <div class="card kpi"><span class="kpi-label">Wallet balance owed</span><span class="kpi-value">${inr(db.customers.reduce((s, c) => s + c.wallet, 0))}</span></div>
    </div><section class="card" id="tbl"></section>`;
  const t = HH.table(document.getElementById('tbl'), {
    rows: () => db.customers,
    search: { placeholder: 'Name, phone, email', fields: c => [c.name, c.phone, c.email, c.id] },
    filters: [{ label: 'Zone', options: db.zones.map(z => z.name), value: c => c.zone }, { label: 'Status', options: [['active', 'Active'], ['blocked', 'Blocked']], value: c => c.status }],
    defaultSort: 'joined',
    columns: [
      { key: 'name', label: 'Customer', sort: c => c.name, render: c => `<div class="row" style="flex-wrap:nowrap"><span class="avatar">${HH.initials(c.name)}</span><div><div class="cell-main">${esc(c.name)}</div><div class="cell-sub">${c.id} · ${esc(c.email)}</div></div></div>` },
      { key: 'phone', label: 'Phone', render: c => `<span class="num">${esc(c.phone)}</span>` },
      { key: 'zone', label: 'Zone', render: c => esc(c.zone) },
      { key: 'bookings', label: 'Bookings', align: 'right', sort: c => stats(c).count, render: c => `<span class="num">${stats(c).count}</span>` },
      { key: 'spent', label: 'Spent', align: 'right', sort: c => stats(c).spent, render: c => `<span class="num">${inr(stats(c).spent)}</span>` },
      { key: 'wallet', label: 'Wallet', align: 'right', sort: c => c.wallet, render: c => `<span class="num">${inr(c.wallet)}</span>` },
      { key: 'joined', label: 'Joined', sort: c => c.joined, render: c => `<span class="cell-sub">${date(c.joined)}</span>` },
      { key: 'status', label: 'Status', render: c => badge('generic', c.status) }
    ],
    onRow: open
  });
  document.getElementById('exportBtn').addEventListener('click', () => HH.downloadCSV('customers.csv', t.visible, [['ID', c => c.id], ['Name', c => c.name], ['Phone', c => c.phone], ['Email', c => c.email], ['Zone', c => c.zone], ['Bookings', c => stats(c).count], ['Spent', c => stats(c).spent], ['Wallet', c => c.wallet], ['Joined', c => c.joined], ['Status', c => c.status]]));

  function open(c) {
    const s = stats(c);
    const tickets = db.tickets.filter(x => x.customerId === c.id);
    const d = HH.drawer({
      title: esc(c.name),
      body: `<div class="stack" style="gap:18px">
        <div class="row"><span class="avatar" style="width:48px;height:48px;font-size:16px">${HH.initials(c.name)}</span><div><div class="cell-main">${esc(c.name)} ${badge('generic', c.status)}</div><div class="cell-sub">${c.id} · joined ${date(c.joined)} · referral ${esc(c.referralCode)}</div></div></div>
        <div class="grid grid-3" style="grid-template-columns:repeat(3,1fr);gap:10px">
          <div class="card kpi" style="padding:12px"><span class="kpi-label">Bookings</span><span class="kpi-value" style="font-size:20px">${s.count}</span></div>
          <div class="card kpi" style="padding:12px"><span class="kpi-label">Spent</span><span class="kpi-value" style="font-size:20px">${inr(s.spent)}</span></div>
          <div class="card kpi" style="padding:12px"><span class="kpi-label">Wallet</span><span class="kpi-value" style="font-size:20px">${inr(c.wallet)}</span></div>
        </div>
        <form id="custForm" class="form-grid">
          <div class="field"><label for="cu-name">Name</label><input id="cu-name" name="name" value="${esc(c.name)}"></div>
          <div class="field"><label for="cu-phone">Phone</label><input id="cu-phone" name="phone" value="${esc(c.phone)}"></div>
          <div class="field full"><label for="cu-email">Email</label><input id="cu-email" name="email" type="email" value="${esc(c.email)}"></div>
          <div class="field full"><label for="cu-addr">Saved address</label><textarea id="cu-addr" name="address" rows="2">${esc(c.address)}</textarea></div>
        </form>
        <div><div class="section-title">Wallet</div><div class="row"><input id="walletAmt" type="number" placeholder="Amount ₹" style="width:130px" aria-label="Wallet amount"><input id="walletNote" placeholder="Reason (goodwill, refund…)" style="flex:1" aria-label="Wallet reason"><button class="btn" id="walletAdd">Credit</button><button class="btn" id="walletSub">Debit</button></div></div>
        <div><div class="section-title">Bookings</div><div class="card list">${s.list.slice(0, 8).map(b => `<a class="list-item" href="/bookings/${b.id}" style="color:inherit;text-decoration:none"><div><div class="cell-main">${b.id} · ${esc(service(b.serviceId).name)}</div><div class="cell-sub">${date(b.slot)} · ${inr(b.price.total)}</div></div><span class="spacer"></span>${badge('booking', b.status)}</a>`).join('') || '<div class="empty">No bookings yet.</div>'}</div></div>
        <div><div class="section-title">Payments</div>${db.transactions.some(t => t.customerId === c.id) ? `<div class="card list">${db.transactions.filter(t => t.customerId === c.id).sort((p, q) => q.createdAt.localeCompare(p.createdAt)).map(t => `<a class="list-item" href="/payments/${t.id}" style="color:inherit;text-decoration:none"><div><div class="cell-main">${inr(t.amount)} · ${t.bookingId}</div><div class="cell-sub">${HH.datetime(t.createdAt)}${t.error ? ' · ' + esc(t.error.description) : ''}</div></div><span class="spacer"></span>${HH.badge('tx', t.status)}</a>`).join('')}</div>` : '<p class="muted" style="margin:0">No online payments.</p>'}</div>
        ${tickets.length ? `<div><div class="section-title">Support tickets</div><div class="card list">${tickets.map(x => `<a class="list-item" href="/support?id=${x.id}" style="color:inherit;text-decoration:none"><div class="cell-main">${x.id} · ${esc(x.subject)}</div><span class="spacer"></span>${badge('ticket', x.status)}</a>`).join('')}</div></div>` : ''}
      </div>`,
      foot: `<button class="btn ${c.status === 'blocked' ? '' : 'btn-danger'}" id="blockBtn">${c.status === 'blocked' ? 'Unblock customer' : 'Block customer'}</button><span class="spacer"></span><a class="btn" href="/bookings?new=1">New booking</a><button class="btn btn-primary" id="saveCust">Save changes</button>`
    });
    d.$('#saveCust').addEventListener('click', () => {
      const f = HH.formData(d.$('#custForm'));
      if (!f.name.trim()) return HH.toast('Name can’t be empty.', 'bad');
      Object.assign(c, f); HH.audit(`Updated customer ${c.id}`); HH.save(); d.close(); t.render(); HH.toast('Customer saved.', 'good');
    });
    const wallet = (sign) => {
      const amt = Number(d.$('#walletAmt').value);
      if (!(amt > 0)) return HH.toast('Enter an amount above ₹0.', 'bad');
      if (sign < 0 && amt > c.wallet) return HH.toast(`Wallet only has ${inr(c.wallet)}.`, 'bad');
      c.wallet += sign * amt; HH.audit(`${sign > 0 ? 'Credited' : 'Debited'} ${inr(amt)} ${sign > 0 ? 'to' : 'from'} ${c.name}'s wallet${d.$('#walletNote').value ? ' · ' + d.$('#walletNote').value : ''}`); HH.save(); d.close(); t.render(); open(c);
      HH.toast(`Wallet is now ${inr(c.wallet)}.`, 'good');
    };
    d.$('#walletAdd').addEventListener('click', () => wallet(1));
    d.$('#walletSub').addEventListener('click', () => wallet(-1));
    d.$('#blockBtn').addEventListener('click', async () => {
      const blocking = c.status !== 'blocked';
      if (blocking && !(await HH.confirmDialog({ title: `Block ${c.name}?`, text: 'They will not be able to sign in or book until you unblock them.', ok: 'Block', danger: true }))) return;
      c.status = blocking ? 'blocked' : 'active'; HH.audit(`${blocking ? 'Blocked' : 'Unblocked'} customer ${c.id}`); HH.save(); d.close(); t.render(); HH.toast(`${c.name} ${blocking ? 'blocked' : 'unblocked'}.`, 'good');
    });
  }
  const pre = HH.params.get('id'); if (pre && HH.by(db.customers, pre)) open(HH.by(db.customers, pre));
})();
