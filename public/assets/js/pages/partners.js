(function () {
  const { db, esc, inr, badge, category, date, opt, icon, sw } = HH;
  const view = HH.shell({ title: 'Partners', subtitle: 'Technicians, their KYC, skills, zones and earnings', actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')}Add partner</button>` });
  const active = db.partners.filter(p => p.status === 'active');
  view.innerHTML = `<div class="grid grid-4">
      <div class="card kpi"><span class="kpi-label">Active partners</span><span class="kpi-value">${active.length}</span></div>
      <div class="card kpi"><span class="kpi-label">Online right now</span><span class="kpi-value">${active.filter(p => p.online).length}</span></div>
      <div class="card kpi"><span class="kpi-label">Waiting for KYC review</span><span class="kpi-value">${db.partners.filter(p => p.status === 'pending').length}</span></div>
      <div class="card kpi"><span class="kpi-label">Average rating</span><span class="kpi-value">${(active.reduce((s, p) => s + p.rating, 0) / active.length).toFixed(2)} ★</span></div>
    </div><section class="card" id="tbl"></section>`;
  const t = HH.table(document.getElementById('tbl'), {
    rows: () => db.partners,
    tabs: { items: [['all', 'All'], ['active', 'Active'], ['pending', 'KYC pending'], ['suspended', 'Suspended']], match: (p, k) => k === 'all' || p.status === k || (k === 'suspended' && p.status === 'rejected') },
    search: { placeholder: 'Name, phone', fields: p => [p.name, p.phone, p.id] },
    filters: [{ label: 'Skill', options: db.categories.map(c => [c.id, c.name]), value: p => p.skills[0] }, { label: 'Zone', options: db.zones.map(z => z.name), value: p => p.zones[0] }],
    defaultSort: 'jobs',
    columns: [
      { key: 'name', label: 'Partner', sort: p => p.name, render: p => `<div class="row" style="flex-wrap:nowrap"><span class="avatar">${HH.initials(p.name)}</span><div><div class="cell-main">${esc(p.name)}</div><div class="cell-sub">${p.id} · ${esc(p.phone)}</div></div></div>` },
      { key: 'skills', label: 'Skills', render: p => p.skills.map(s => `<span class="badge plain">${esc(category(s).name)}</span>`).join(' ') },
      { key: 'zones', label: 'Zones', render: p => `<span class="small">${p.zones.map(esc).join(', ')}</span>` },
      { key: 'rating', label: 'Rating', align: 'right', sort: p => p.rating, render: p => p.rating ? `<span class="num">${p.rating} ★</span>` : '<span class="muted">—</span>' },
      { key: 'jobs', label: 'Jobs', align: 'right', sort: p => p.jobs, render: p => `<span class="num">${p.jobs}</span>` },
      { key: 'kyc', label: 'KYC', render: p => { const v = Object.values(p.kyc).filter(x => x === 'verified').length; return `<span class="num small">${v}/4</span> <span class="progress" style="display:inline-block;width:60px;vertical-align:middle"><span style="width:${v * 25}%"></span></span>`; } },
      { key: 'online', label: 'Now', render: p => p.status === 'active' ? (p.online ? '<span class="badge b-good">Online</span>' : '<span class="badge">Offline</span>') : '' },
      { key: 'status', label: 'Status', render: p => badge('partner', p.status) }
    ],
    onRow: open
  });

  const docLabel = { aadhaar: 'Aadhaar card', pan: 'PAN card', bank: 'Bank account / cancelled cheque', police: 'Police verification' };
  function open(p) {
    const jobs = db.bookings.filter(b => b.partnerId === p.id);
    const earned = jobs.filter(b => b.status === 'completed').reduce((s, b) => s + (b.price.subtotal + b.price.visit) * (1 - (p.commission ?? category(b.catId).commission) / 100), 0);
    const reviews = db.reviews.filter(r => r.partnerId === p.id);
    const d = HH.drawer({
      title: esc(p.name),
      body: `<div class="stack" style="gap:18px">
        <div class="row"><span class="avatar" style="width:48px;height:48px;font-size:16px">${HH.initials(p.name)}</span><div><div class="cell-main">${esc(p.name)} ${badge('partner', p.status)}</div><div class="cell-sub">${p.id} · ${p.experience} yrs experience · joined ${date(p.joined)}</div></div></div>
        ${p.status === 'pending' ? `<div class="callout warn">${icon('alert')}<div>${esc(p.applicationNote)}. Verify each document, then approve.</div></div>` : ''}
        <div class="grid grid-3" style="grid-template-columns:repeat(3,1fr);gap:10px">
          <div class="card kpi" style="padding:12px"><span class="kpi-label">Rating</span><span class="kpi-value" style="font-size:20px">${p.rating || '—'}</span></div>
          <div class="card kpi" style="padding:12px"><span class="kpi-label">Jobs</span><span class="kpi-value" style="font-size:20px">${p.jobs}</span></div>
          <div class="card kpi" style="padding:12px"><span class="kpi-label">Earned (60d)</span><span class="kpi-value" style="font-size:20px">${inr(earned)}</span></div>
        </div>
        <div><div class="section-title">KYC documents</div><div class="card list">${Object.entries(p.kyc).map(([k, v]) => `<div class="list-item"><div><div class="cell-main">${docLabel[k]}</div><div class="cell-sub">${v === 'missing' ? 'Not uploaded' : k === 'bank' ? `${esc(p.bank.account)} · ${esc(p.bank.ifsc)}` : 'Uploaded ' + date(p.joined)}</div></div><span class="spacer"></span>${badge('kyc', v)}${v === 'submitted' ? `<button class="btn btn-sm" data-kyc="${k}" data-v="verified">Verify</button><button class="btn btn-sm btn-danger" data-kyc="${k}" data-v="rejected">Reject</button>` : ''}</div>`).join('')}</div></div>
        <form id="pForm" class="form-grid">
          <div class="field"><label for="p-phone">Phone</label><input id="p-phone" name="phone" value="${esc(p.phone)}"></div>
          <div class="field"><label for="p-comm">Commission % (blank = category default)</label><input id="p-comm" name="commission" type="number" min="0" max="50" value="${p.commission ?? ''}"></div>
          <div class="field full"><span class="label">Skills</span><div class="row">${db.categories.map(c => `<label class="chip ${p.skills.includes(c.id) ? 'on' : ''}"><input type="checkbox" name="skill_${c.id}" ${p.skills.includes(c.id) ? 'checked' : ''} style="display:none">${esc(c.name)}</label>`).join('')}</div></div>
          <div class="field full"><span class="label">Service zones</span><div class="row">${db.zones.map(z => `<label class="chip ${p.zones.includes(z.name) ? 'on' : ''}"><input type="checkbox" name="zone_${z.id}" ${p.zones.includes(z.name) ? 'checked' : ''} style="display:none">${esc(z.name)}</label>`).join('')}</div></div>
          <div class="field"><label for="p-upi">Payout UPI</label><input id="p-upi" name="upi" value="${esc(p.bank.upi)}"></div>
          <div class="field"><label for="p-acc">Razorpay linked account</label><input id="p-acc" name="linkedAccount" value="${esc(p.linkedAccount)}" placeholder="acc_XXXXXXXXXXXXXX"><span class="hint">Needed for Razorpay Route split payments</span></div>
        </form>
        <div><div class="section-title">Recent jobs</div><div class="card list">${jobs.slice(0, 6).map(b => `<a class="list-item" href="/bookings/${b.id}" style="color:inherit;text-decoration:none"><div><div class="cell-main">${b.id}</div><div class="cell-sub">${date(b.slot)} · ${esc(b.zone)}</div></div><span class="spacer"></span>${badge('booking', b.status)}</a>`).join('') || '<div class="empty">No jobs yet.</div>'}</div></div>
        ${reviews.length ? `<div><div class="section-title">Latest reviews</div><div class="stack">${reviews.slice(0, 3).map(r => `<div class="small"><span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span> ${esc(r.text)}</div>`).join('')}</div></div>` : ''}
      </div>`,
      foot: `${p.status === 'active' ? '<button class="btn btn-danger" id="suspendBtn">Suspend</button>' : p.status === 'suspended' ? '<button class="btn" id="reactivateBtn">Reactivate</button>' : '<button class="btn btn-danger" id="rejectBtn">Reject application</button>'}<span class="spacer"></span>${p.status === 'pending' ? '<button class="btn btn-primary" id="approveBtn">Approve partner</button>' : ''}<button class="btn ${p.status === 'pending' ? '' : 'btn-primary'}" id="saveBtn">Save</button>`
    });
    d.el.addEventListener('change', e => { const chip = e.target.closest('.chip'); if (chip) chip.classList.toggle('on', e.target.checked); });
    d.$$('[data-kyc]').forEach(b => b.addEventListener('click', () => { p.kyc[b.dataset.kyc] = b.dataset.v; HH.audit(`${b.dataset.v === 'verified' ? 'Verified' : 'Rejected'} ${docLabel[b.dataset.kyc]} for ${p.name}`); HH.save(); d.close(); open(p); t.render(); }));
    const saveForm = () => {
      const f = HH.formData(d.$('#pForm'));
      const skills = db.categories.filter(c => f['skill_' + c.id]).map(c => c.id), zones = db.zones.filter(z => f['zone_' + z.id]).map(z => z.name);
      if (!skills.length || !zones.length) { HH.toast('Pick at least one skill and one zone.', 'bad'); return false; }
      Object.assign(p, { phone: f.phone, commission: f.commission === '' ? null : f.commission, skills, zones, linkedAccount: f.linkedAccount });
      p.bank.upi = f.upi; return true;
    };
    d.$('#saveBtn').addEventListener('click', () => { if (!saveForm()) return; HH.audit(`Updated partner ${p.id}`); HH.save(); d.close(); t.render(); HH.toast('Partner saved.', 'good'); });
    d.$('#approveBtn')?.addEventListener('click', () => {
      if (!saveForm()) return;
      const missing = Object.entries(p.kyc).filter(([, v]) => v !== 'verified').map(([k]) => docLabel[k]);
      if (missing.length) return HH.toast('Verify these first: ' + missing.join(', '), 'bad');
      p.status = 'active'; p.rating = 0; HH.audit(`Approved partner ${p.name}`); HH.save(); d.close(); t.render(); HH.toast(`${p.name} is now active and can receive jobs.`, 'good');
    });
    const setStatus = async (status, verb, warn) => {
      const reason = await HH.confirmDialog({ title: `${verb} ${p.name}?`, text: warn, ok: verb, danger: status !== 'active', input: { label: 'Reason (saved in audit log)', value: '' } });
      if (reason === false) return;
      p.status = status; p.online = false; HH.audit(`${verb} partner ${p.name}${reason ? ' · ' + reason : ''}`); HH.save(); d.close(); t.render(); HH.toast(`${p.name}: ${verb.toLowerCase()}d.`, 'good');
    };
    d.$('#suspendBtn')?.addEventListener('click', () => setStatus('suspended', 'Suspend', 'They stop receiving new jobs. Their upcoming assigned jobs stay assigned until you reassign them.'));
    d.$('#reactivateBtn')?.addEventListener('click', () => setStatus('active', 'Reactivate', 'They will start receiving jobs again.'));
    d.$('#rejectBtn')?.addEventListener('click', () => setStatus('rejected', 'Reject', 'The applicant gets an SMS that their application was not approved.'));
  }

  document.getElementById('addBtn').addEventListener('click', () => {
    const m = HH.modal({
      title: 'Add partner',
      body: `<form class="form-grid" id="apForm">
        <div class="field"><label for="ap-name">Full name</label><input id="ap-name" name="name" required></div>
        <div class="field"><label for="ap-phone">Phone</label><input id="ap-phone" name="phone" placeholder="+91 98xxx xxxxx"></div>
        <div class="field"><label for="ap-skill">Main skill</label><select id="ap-skill" name="skill">${opt(db.categories.map(c => [c.id, c.name]))}</select></div>
        <div class="field"><label for="ap-zone">Main zone</label><select id="ap-zone" name="zone">${opt(db.zones.map(z => z.name))}</select></div>
        <div class="field"><label for="ap-exp">Experience (years)</label><input id="ap-exp" name="experience" type="number" min="0" value="3"></div>
        <div class="field full"><p class="hint" style="margin:0">The partner gets an SMS link to upload Aadhaar, PAN, bank details and police verification in the partner app.</p></div>
      </form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="ap-ok">Send invite</button>`
    });
    m.$('#ap-ok').addEventListener('click', () => {
      const f = HH.formData(m.$('#apForm'));
      if (!f.name.trim() || !/^\+?[\d\s]{10,15}$/.test(f.phone)) return HH.toast('Enter a name and a valid phone number.', 'bad');
      const p = { id: 'P' + (301 + db.partners.length), name: f.name.trim(), phone: f.phone, email: '', skills: [f.skill], zones: [f.zone], experience: f.experience || 0, rating: 0, jobs: 0, status: 'pending', online: false, commission: null, joined: new Date().toISOString(), kyc: { aadhaar: 'missing', pan: 'missing', bank: 'missing', police: 'missing' }, bank: { holder: f.name, account: '', ifsc: '', upi: '' }, linkedAccount: '', applicationNote: 'Invited by ' + HH.session.name };
      db.partners.unshift(p); HH.audit(`Invited partner ${p.name}`); HH.save(); m.close(); t.render(); HH.toast(`Invite sent to ${p.phone}.`, 'good');
    });
  });
  const pre = HH.params.get('id'); if (pre && HH.by(db.partners, pre)) open(HH.by(db.partners, pre));
})();
