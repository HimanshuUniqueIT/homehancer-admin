(function () {
  const { db, esc, badge, customer, datetime, rel, opt, icon } = HH;
  const view = HH.shell({ title: 'Support tickets', subtitle: 'Complaints and questions from customers and partners', actions: `<button class="btn btn-primary" id="newBtn">${icon('plus')}New ticket</button>` });
  const agents = db.admins.filter(a => a.status === 'active').map(a => a.name);
  let t;
  function render() {
    view.innerHTML = `<div class="grid grid-4">
      <div class="card kpi"><span class="kpi-label">Open</span><span class="kpi-value">${db.tickets.filter(x => x.status === 'open').length}</span></div>
      <div class="card kpi"><span class="kpi-label">In progress</span><span class="kpi-value">${db.tickets.filter(x => x.status === 'in_progress').length}</span></div>
      <div class="card kpi"><span class="kpi-label">Urgent, not resolved</span><span class="kpi-value" style="color:var(--bad)">${db.tickets.filter(x => x.priority === 'urgent' && x.status !== 'resolved').length}</span></div>
      <div class="card kpi"><span class="kpi-label">Unassigned</span><span class="kpi-value">${db.tickets.filter(x => !x.assignee && x.status !== 'resolved').length}</span></div>
    </div><section class="card" id="tbl"></section>`;
    t = HH.table(document.getElementById('tbl'), {
      rows: () => db.tickets,
      tabs: { items: [['active', 'Active'], ['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['all', 'All']], match: (x, k) => k === 'all' || (k === 'active' ? x.status !== 'resolved' : x.status === k) },
      search: { placeholder: 'Ticket, subject, customer', fields: x => [x.id, x.subject, customer(x.customerId).name, x.bookingId] },
      filters: [{ label: 'Priority', options: [['urgent', 'Urgent'], ['high', 'High'], ['normal', 'Normal'], ['low', 'Low']], value: x => x.priority }, { label: 'Team', options: ['Operations', 'Payments', 'Support'], value: x => x.team }],
      columns: [
        { key: 'id', label: 'Ticket', render: x => `<div class="cell-main">${x.id} · ${esc(x.subject)}</div><div class="cell-sub">${esc(customer(x.customerId).name)} · <a href="/bookings/${x.bookingId}">${x.bookingId}</a></div>` },
        { key: 'p', label: 'Priority', sort: x => ['low', 'normal', 'high', 'urgent'].indexOf(x.priority), render: x => badge('priority', x.priority) },
        { key: 'team', label: 'Team', render: x => esc(x.team) },
        { key: 'as', label: 'Assignee', render: x => x.assignee ? esc(x.assignee) : '<span class="muted">Unassigned</span>' },
        { key: 's', label: 'Status', render: x => badge('ticket', x.status) },
        { key: 'at', label: 'Updated', sort: x => x.messages.at(-1).at, render: x => `<span class="cell-sub">${rel(x.messages.at(-1).at)}</span>` }
      ],
      onRow: open
    });
  }
  function open(x) {
    const c = customer(x.customerId);
    const d = HH.drawer({
      title: `${x.id} · ${esc(x.subject)}`,
      body: `<div class="stack" style="gap:16px">
        <div class="form-grid">
          <div class="field"><label for="tk-s">Status</label><select id="tk-s">${opt([['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved']], x.status)}</select></div>
          <div class="field"><label for="tk-p">Priority</label><select id="tk-p">${opt([['urgent', 'Urgent'], ['high', 'High'], ['normal', 'Normal'], ['low', 'Low']], x.priority)}</select></div>
          <div class="field"><label for="tk-a">Assignee</label><select id="tk-a"><option value="">Unassigned</option>${opt(agents, x.assignee)}</select></div>
          <div class="field"><label for="tk-t">Team</label><select id="tk-t">${opt(['Operations', 'Payments', 'Support'], x.team)}</select></div>
        </div>
        <div class="small muted">${esc(c.name)} · ${esc(c.phone)} · booking <a href="/bookings/${x.bookingId}">${x.bookingId}</a></div>
        <div class="stack" style="gap:10px">${x.messages.map(m => `<div class="card" style="padding:10px 12px;${m.from === 'agent' ? 'background:var(--accent-soft);margin-left:40px' : 'margin-right:40px'}"><div class="small" style="white-space:pre-wrap">${esc(m.text)}</div><div class="cell-sub">${m.from === 'agent' ? 'HomeHancer support' : esc(c.name)}${m.internal ? ' · internal note' : ''} · ${datetime(m.at)}</div></div>`).join('')}</div>
        <div class="field"><label for="tk-msg">Reply</label><textarea id="tk-msg" placeholder="Type a reply to the customer"></textarea></div>
        <div class="row"><span class="small muted">Quick replies:</span>${['Refund initiated, 5–7 working days.', 'A senior technician will revisit free of charge.', 'Sorry for the trouble. We have credited ₹100 to your wallet.'].map(q => `<button class="chip" data-q="${esc(q)}">${esc(q.slice(0, 26))}…</button>`).join('')}</div>
        <label class="check"><input type="checkbox" id="tk-int"> Internal note (customer won't see it)</label>
      </div>`,
      foot: `<button class="btn" data-close>Close</button><span class="spacer"></span><button class="btn" id="tk-save">Save</button><button class="btn btn-primary" id="tk-send">${icon('send')}Send reply</button>`
    });
    d.$$('[data-q]').forEach(b => b.addEventListener('click', () => (d.$('#tk-msg').value = b.dataset.q)));
    const save = () => { Object.assign(x, { status: d.$('#tk-s').value, priority: d.$('#tk-p').value, assignee: d.$('#tk-a').value, team: d.$('#tk-t').value }); };
    d.$('#tk-save').addEventListener('click', () => { save(); HH.audit(`Updated ticket ${x.id}`); HH.save(); d.close(); render(); HH.toast('Ticket saved.', 'good'); });
    d.$('#tk-send').addEventListener('click', () => {
      const text = d.$('#tk-msg').value.trim(); if (!text) return HH.toast('Write a reply first.', 'bad');
      save(); x.messages.push({ from: 'agent', text, at: new Date().toISOString(), internal: d.$('#tk-int').checked });
      if (x.status === 'open') x.status = 'in_progress';
      if (!x.assignee) x.assignee = HH.session.name;
      HH.save(); d.close(); render(); open(x); HH.toast(d.$('#tk-int').checked ? 'Note added.' : 'Reply sent by email and app notification.', 'good');
    });
  }
  document.getElementById('newBtn').addEventListener('click', () => {
    const m = HH.modal({
      title: 'New ticket',
      body: `<form class="form-grid" id="nf"><div class="field full"><label for="n-c">Customer</label><select id="n-c" name="customerId">${opt(db.customers.map(c => [c.id, c.name + ' · ' + c.phone]))}</select></div><div class="field full"><label for="n-s">Subject</label><input id="n-s" name="subject"></div><div class="field"><label for="n-p">Priority</label><select id="n-p" name="priority">${opt([['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent'], ['low', 'Low']])}</select></div><div class="field"><label for="n-t">Team</label><select id="n-t" name="team">${opt(['Support', 'Operations', 'Payments'])}</select></div><div class="field full"><label for="n-m">Details</label><textarea id="n-m" name="message"></textarea></div></form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="n-ok">Create ticket</button>`
    });
    m.$('#n-ok').addEventListener('click', () => {
      const f = HH.formData(m.$('#nf')); if (!f.subject.trim()) return HH.toast('Subject is required.', 'bad');
      const b = db.bookings.find(x => x.customerId === f.customerId);
      const x = { id: 'T' + (6101 + db.tickets.length), subject: f.subject, priority: f.priority, status: 'open', team: f.team, customerId: f.customerId, bookingId: b?.id || '—', assignee: '', at: new Date().toISOString(), messages: [{ from: 'customer', text: f.message || f.subject, at: new Date().toISOString() }] };
      db.tickets.unshift(x); HH.save(); m.close(); render(); HH.toast(`Ticket ${x.id} created.`, 'good');
    });
  });
  render();
  const pre = HH.params.get('id'); if (pre && HH.by(db.tickets, pre)) open(HH.by(db.tickets, pre));
})();
