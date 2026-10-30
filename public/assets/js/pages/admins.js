(function () {
  const { db, esc, badge, datetime, rel, opt, icon, sw } = HH;
  const view = HH.shell({ title: 'Admin users', subtitle: 'Who can sign in, what each role can do, and what they changed', actions: `<button class="btn btn-primary" id="inviteBtn">${icon('plus')}Invite admin</button>` });
  let role = 'Operations';
  function render() {
    view.innerHTML = `<section class="card"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Two-factor</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead><tbody>
        ${db.admins.map(a => `<tr><td><div class="row" style="flex-wrap:nowrap"><span class="avatar">${HH.initials(a.name)}</span><div><div class="cell-main">${esc(a.name)}${a.id === HH.session.id ? ' <span class="badge plain">You</span>' : ''}</div><div class="cell-sub">${esc(a.email)}</div></div></div></td><td><select data-role="${a.id}" aria-label="Role for ${esc(a.name)}" ${a.id === HH.session.id ? 'disabled' : ''}>${opt(Object.keys(db.roles), a.role)}</select></td><td>${a.twoFA ? '<span class="badge b-good">On</span>' : '<span class="badge b-warn">Off</span>'}</td><td class="cell-sub">${a.lastLogin ? rel(a.lastLogin) : 'Never'}</td><td>${badge('generic', a.status)}</td><td class="right">${a.id !== HH.session.id ? `<button class="btn btn-sm" data-toggle="${a.id}">${a.status === 'active' ? 'Disable' : a.status === 'invited' ? 'Resend invite' : 'Enable'}</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></section>
      <section class="card"><div class="card-head"><h2>Role permissions</h2><div class="row">${Object.keys(db.roles).map(r => `<button class="chip ${r === role ? 'on' : ''}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div></div>
        <div class="table-wrap"><table id="permTbl"><thead><tr><th>Module</th><th>Can view</th><th>Can edit</th></tr></thead><tbody>
        ${db.modules.map(m => `<tr><td>${m}</td><td><input type="checkbox" data-perm="view" data-m="${m}" ${db.roles[role][m].view ? 'checked' : ''} ${role === 'Super Admin' ? 'disabled' : ''} aria-label="${m} view"></td><td><input type="checkbox" data-perm="edit" data-m="${m}" ${db.roles[role][m].edit ? 'checked' : ''} ${role === 'Super Admin' ? 'disabled' : ''} aria-label="${m} edit"></td></tr>`).join('')}
        </tbody></table></div>${role === 'Super Admin' ? '<div class="card-foot"><span class="small muted">Super Admin always has full access.</span></div>' : ''}</section>
      <section class="card" id="auditTbl"></section>`;
    view.querySelectorAll('[data-role]').forEach(s => s.addEventListener('change', () => { const a = HH.by(db.admins, s.dataset.role); a.role = s.value; HH.audit(`Changed ${a.name}'s role to ${a.role}`); HH.save(); HH.toast(`${a.name} is now ${a.role}.`, 'good'); }));
    view.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => { const a = HH.by(db.admins, b.dataset.toggle); if (a.status === 'invited') return HH.toast('Invite email sent again to ' + a.email, 'good'); a.status = a.status === 'active' ? 'inactive' : 'active'; HH.audit(`${a.status === 'active' ? 'Enabled' : 'Disabled'} admin ${a.name}`); HH.save(); render(); }));
    view.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => { role = b.dataset.r; render(); }));
    view.querySelectorAll('[data-perm]').forEach(c => c.addEventListener('change', () => {
      const p = db.roles[role][c.dataset.m]; p[c.dataset.perm] = c.checked;
      if (c.dataset.perm === 'edit' && c.checked) p.view = true;
      if (c.dataset.perm === 'view' && !c.checked) p.edit = false;
      HH.audit(`Changed ${role} permission on ${c.dataset.m}`); HH.save(); render();
    }));
    HH.table(document.getElementById('auditTbl'), {
      rows: () => db.audit, pageSize: 10,
      search: { placeholder: 'Search activity', fields: a => [a.admin, a.action] },
      filters: [{ label: 'Admin', options: [...new Set(db.audit.map(a => a.admin))], value: a => a.admin }],
      columns: [{ key: 'at', label: 'When', render: a => `<span class="cell-sub">${datetime(a.at)}</span>` }, { key: 'admin', label: 'Admin', render: a => esc(a.admin) }, { key: 'action', label: 'Action', render: a => esc(a.action) }, { key: 'ip', label: 'IP', render: a => `<span class="mono">${esc(a.ip)}</span>` }],
      tools: '<b>Activity log</b>'
    });
  }
  document.getElementById('inviteBtn').addEventListener('click', () => {
    const m = HH.modal({
      title: 'Invite admin',
      body: `<form class="form-grid" id="inv"><div class="field"><label for="i-name">Name</label><input id="i-name" name="name"></div><div class="field"><label for="i-email">Work email</label><input id="i-email" name="email" type="email"></div><div class="field"><label for="i-role">Role</label><select id="i-role" name="role">${opt(Object.keys(db.roles), 'Support')}</select></div><div class="field" style="justify-content:end">${sw('twoFA', true, 'Require two-factor login')}</div></form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="i-ok">Send invite</button>`
    });
    m.$('#i-ok').addEventListener('click', () => {
      const f = HH.formData(m.$('#inv'));
      if (!f.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return HH.toast('Enter a name and a valid email.', 'bad');
      if (db.admins.some(a => a.email === f.email)) return HH.toast('That email already has access.', 'bad');
      db.admins.push({ id: 'A' + (db.admins.length + 1), ...f, status: 'invited', lastLogin: null }); HH.audit(`Invited ${f.email} as ${f.role}`); HH.save(); m.close(); render(); HH.toast('Invite sent to ' + f.email, 'good');
    });
  });
  render();
})();
