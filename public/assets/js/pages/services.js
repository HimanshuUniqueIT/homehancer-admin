(function () {
  const { db, esc, inr, badge, category, opt, icon, sw } = HH;
  const view = HH.shell({ title: 'Services', subtitle: 'Categories, prices, visiting charges and GST shown in the app', actions: `<button class="btn" id="addCat">${icon('plus')}Add category</button><button class="btn btn-primary" id="addSvc">${icon('plus')}Add service</button>` });
  let selected = 'all';

  function render() {
    const count = (cid) => db.bookings.filter(b => b.catId === cid).length;
    view.innerHTML = `
      <section class="card"><div class="card-head"><h2>Categories</h2><span class="muted small">Commission is the platform's cut of service + visiting charge</span></div>
        <div class="table-wrap"><table><thead><tr><th>Category</th><th class="right">Services</th><th class="right">Bookings (60d)</th><th class="right">Commission</th><th>Shown in app</th><th></th></tr></thead><tbody>
        ${db.categories.map(c => `<tr><td class="cell-main">${esc(c.name)}</td><td class="right num">${db.services.filter(s => s.catId === c.id).length}</td><td class="right num">${count(c.id)}</td><td class="right num">${c.commission}%</td><td>${sw('cat_' + c.id, c.active)}</td><td class="right"><button class="btn btn-sm" data-editcat="${c.id}">${icon('edit')}Edit</button></td></tr>`).join('')}
        </tbody></table></div></section>
      <section class="card" id="svcTbl"></section>`;
    view.querySelectorAll('[name^=cat_]').forEach(el => el.addEventListener('change', () => {
      const c = category(el.name.slice(4)); c.active = el.checked; HH.audit(`${c.active ? 'Showed' : 'Hid'} category ${c.name}`); HH.save(); HH.toast(`${c.name} ${c.active ? 'is visible' : 'is hidden'} in the app.`, 'good');
    }));
    view.querySelectorAll('[data-editcat]').forEach(b => b.addEventListener('click', () => catDialog(category(b.dataset.editcat))));
    HH.table(document.getElementById('svcTbl'), {
      rows: () => db.services,
      tabs: { items: [['all', 'All services'], ...db.categories.map(c => [c.id, c.name])], match: (s, k) => k === 'all' || s.catId === k },
      search: { placeholder: 'Service name', fields: s => [s.name, s.id] },
      columns: [
        { key: 'name', label: 'Service', sort: s => s.name, render: s => `<div class="cell-main">${esc(s.name)}</div><div class="cell-sub">${s.id} · ${esc(category(s.catId).name)}</div>` },
        { key: 'price', label: 'Base price', align: 'right', sort: s => s.basePrice, render: s => `<span class="num">${inr(s.basePrice)}</span>` },
        { key: 'visit', label: 'Visiting', align: 'right', render: s => `<span class="num">${s.visitCharge ? inr(s.visitCharge) : 'Free'}</span>` },
        { key: 'dur', label: 'Duration', align: 'right', render: s => `<span class="num">${s.duration} min</span>` },
        { key: 'gst', label: 'GST', align: 'right', render: s => `<span class="num">${s.gst}%</span>` },
        { key: 'customer', label: 'Customer pays', align: 'right', sort: s => s.basePrice, render: s => `<span class="num cell-main">${inr(Math.round((s.basePrice + s.visitCharge + 29) * (1 + s.gst / 100)))}</span>` },
        { key: 'bk', label: 'Booked', align: 'right', sort: s => db.bookings.filter(b => b.serviceId === s.id).length, render: s => `<span class="num">${db.bookings.filter(b => b.serviceId === s.id).length}</span>` },
        { key: 'active', label: 'Status', render: s => badge('generic', s.active ? 'active' : 'inactive') }
      ],
      onRow: svcDialog
    });
  }

  function catDialog(c) {
    const isNew = !c;
    c = c || { id: '', name: '', commission: 18, active: true };
    const m = HH.modal({
      title: isNew ? 'Add category' : 'Edit ' + esc(c.name),
      body: `<form class="form-grid" id="cf"><div class="field full"><label for="cf-name">Name</label><input id="cf-name" name="name" value="${esc(c.name)}"></div><div class="field"><label for="cf-comm">Commission %</label><input id="cf-comm" name="commission" type="number" min="0" max="60" value="${c.commission}"></div><div class="field" style="justify-content:end">${sw('active', c.active, 'Show in app')}</div><div class="field full"><label for="cf-banner">Banner image</label><input id="cf-banner" type="file" accept="image/*" style="padding-top:6px"><span class="hint">Recommended 1200 × 600, under 300 KB</span></div></form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="cf-ok">Save</button>`
    });
    m.$('#cf-ok').addEventListener('click', () => {
      const f = HH.formData(m.$('#cf'));
      if (!f.name.trim()) return HH.toast('Name is required.', 'bad');
      Object.assign(c, { name: f.name.trim(), commission: f.commission || 0, active: f.active });
      if (isNew) { c.id = f.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'); if (category(c.id).id) return HH.toast('A category with that name exists.', 'bad'); db.categories.push(c); }
      HH.audit(`${isNew ? 'Added' : 'Edited'} category ${c.name}`); HH.save(); m.close(); render(); HH.toast('Category saved.', 'good');
    });
  }

  function svcDialog(s) {
    const isNew = !s;
    s = s || { id: '', catId: db.categories[0].id, name: '', basePrice: 299, visitCharge: 49, duration: 60, gst: 18, active: true, description: '' };
    const m = HH.modal({
      title: isNew ? 'Add service' : 'Edit service', wide: true,
      body: `<form class="form-grid" id="sf">
        <div class="field"><label for="sf-name">Service name</label><input id="sf-name" name="name" value="${esc(s.name)}"></div>
        <div class="field"><label for="sf-cat">Category</label><select id="sf-cat" name="catId">${opt(db.categories.map(c => [c.id, c.name]), s.catId)}</select></div>
        <div class="field"><label for="sf-price">Base price (₹)</label><input id="sf-price" name="basePrice" type="number" min="0" value="${s.basePrice}"></div>
        <div class="field"><label for="sf-visit">Visiting charge (₹)</label><input id="sf-visit" name="visitCharge" type="number" min="0" value="${s.visitCharge}"><span class="hint">Waived when the job is booked</span></div>
        <div class="field"><label for="sf-dur">Duration (minutes)</label><input id="sf-dur" name="duration" type="number" min="10" step="5" value="${s.duration}"></div>
        <div class="field"><label for="sf-gst">GST %</label><select id="sf-gst" name="gst">${opt([0, 5, 12, 18, 28], s.gst)}</select></div>
        <div class="field full"><label for="sf-desc">Description shown to customers</label><textarea id="sf-desc" name="description">${esc(s.description)}</textarea></div>
        <div class="field full">${sw('active', s.active, 'Bookable in app and website')}</div>
      </form><div class="callout info" style="margin-top:14px">${icon('info')}<div id="sf-preview"></div></div>`,
      foot: `${!isNew ? '<button class="btn btn-danger" id="sf-del">Delete</button><span class="spacer"></span>' : ''}<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="sf-ok">Save service</button>`
    });
    const preview = () => { const f = HH.formData(m.$('#sf')); const tot = Math.round(((+f.basePrice || 0) + (+f.visitCharge || 0) + 29) * (1 + (+f.gst || 0) / 100)); m.$('#sf-preview').innerHTML = `Customer pays <b>${inr(tot)}</b> (incl. ₹29 platform fee and GST). Partner earns about <b>${inr(((+f.basePrice || 0) + (+f.visitCharge || 0)) * (1 - category(f.catId).commission / 100))}</b>.`; };
    m.el.addEventListener('input', preview); preview();
    m.$('#sf-ok').addEventListener('click', () => {
      const f = HH.formData(m.$('#sf'));
      if (!f.name.trim() || !(f.basePrice >= 0)) return HH.toast('Name and price are required.', 'bad');
      Object.assign(s, { ...f, name: f.name.trim(), gst: +f.gst });
      if (isNew) { s.id = 'SVC' + (101 + db.services.length); db.services.push(s); }
      HH.audit(`${isNew ? 'Added' : 'Edited'} service ${s.name}`); HH.save(); m.close(); render(); HH.toast('Service saved.', 'good');
    });
    m.$('#sf-del')?.addEventListener('click', async () => {
      const used = db.bookings.some(b => b.serviceId === s.id);
      if (!(await HH.confirmDialog({ title: `Delete ${s.name}?`, text: used ? 'It has past bookings, so it will be switched off instead of deleted.' : 'This removes it from the catalogue.', ok: used ? 'Switch off' : 'Delete', danger: true }))) return;
      if (used) s.active = false; else db.services.splice(db.services.indexOf(s), 1);
      HH.audit(`${used ? 'Switched off' : 'Deleted'} service ${s.name}`); HH.save(); m.close(); render();
    });
  }
  document.getElementById('addCat').addEventListener('click', () => catDialog(null));
  document.getElementById('addSvc').addEventListener('click', () => svcDialog(null));
  render();
})();
