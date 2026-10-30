(function () {
  const { db, esc, inr, num, badge, category, date, opt, icon, sw } = HH;
  const view = HH.shell({ title: 'Coupons & offers', subtitle: 'Discount codes, referral rewards and app banners', actions: `<button class="btn btn-primary" id="addBtn">${icon('plus')}New coupon</button>` });
  const today = () => new Date().toISOString().slice(0, 10);
  const state = (c) => !c.active ? 'inactive' : today() > c.validTo ? 'expired' : today() < c.validFrom ? 'scheduled' : 'active';
  const discountGiven = (code) => db.bookings.filter(b => b.coupon === code).reduce((s, b) => s + b.price.discount, 0);

  function render() {
    view.innerHTML = `<section class="card" id="tbl"></section>
      <div class="grid grid-2">
        <section class="card"><div class="card-head"><h2>Referral programme</h2></div><div class="card-body form-grid" id="refForm">
          <div class="field">${sw('ref.enabled', db.settings.referral?.enabled ?? true, 'Referral programme on')}</div><div></div>
          <div class="field"><label for="r-ref">Referrer gets (₹ wallet)</label><input id="r-ref" type="number" name="ref.referrer" value="${db.settings.referral?.referrer ?? 100}"></div>
          <div class="field"><label for="r-new">New customer gets (₹ off first booking)</label><input id="r-new" type="number" name="ref.referee" value="${db.settings.referral?.referee ?? 100}"></div>
          <div class="field full"><button class="btn" id="saveRef">Save referral rules</button></div>
        </div></section>
        <section class="card"><div class="card-head"><h2>Banners</h2><button class="btn btn-sm" id="addBanner">${icon('plus')}Add banner</button></div><div class="list">
          ${db.banners.map(b => `<div class="list-item"><div class="photo" style="width:72px;aspect-ratio:2/1;font-size:10px">1200×600</div><div><div class="cell-main">${esc(b.title)}</div><div class="cell-sub">${esc(b.placement)} · ${date(b.from)} – ${date(b.to)}</div></div><span class="spacer"></span>${sw('bn_' + b.id, b.active)}</div>`).join('')}
        </div></section>
      </div>`;
    HH.table(document.getElementById('tbl'), {
      rows: () => db.coupons,
      tabs: { items: [['all', 'All'], ['active', 'Running'], ['scheduled', 'Scheduled'], ['expired', 'Expired'], ['inactive', 'Off']], match: (c, k) => k === 'all' || state(c) === k },
      search: { placeholder: 'Code or description', fields: c => [c.code, c.desc] },
      columns: [
        { key: 'code', label: 'Code', sort: c => c.code, render: c => `<div class="cell-main mono">${esc(c.code)}</div><div class="cell-sub">${esc(c.desc)}</div>` },
        { key: 'value', label: 'Discount', render: c => c.type === 'flat' ? inr(c.value) + ' off' : `${c.value}% off<div class="cell-sub">max ${inr(c.maxDiscount)}</div>` },
        { key: 'scope', label: 'Applies to', render: c => c.scope === 'all' ? 'All services' : esc(category(c.scope).name) },
        { key: 'min', label: 'Min order', align: 'right', render: c => `<span class="num">${c.minOrder ? inr(c.minOrder) : '—'}</span>` },
        { key: 'used', label: 'Used', align: 'right', sort: c => c.used, render: c => `<span class="num">${num(c.used)}${c.usageLimit ? ' / ' + num(c.usageLimit) : ''}</span>${c.usageLimit ? `<div class="progress" style="margin-top:4px"><span style="width:${Math.min(100, c.used / c.usageLimit * 100)}%"></span></div>` : ''}` },
        { key: 'given', label: 'Discount given (60d)', align: 'right', render: c => `<span class="num">${inr(discountGiven(c.code))}</span>` },
        { key: 'valid', label: 'Valid', sort: c => c.validTo, render: c => `<span class="small">${date(c.validFrom)} – ${date(c.validTo)}</span>` },
        { key: 'state', label: 'Status', render: c => badge('generic', state(c)) }
      ],
      onRow: dialog
    });
    view.querySelectorAll('[name^=bn_]').forEach(el => el.addEventListener('change', () => { const b = HH.by(db.banners, el.name.slice(3)); b.active = el.checked; HH.save(); HH.toast(`Banner ${b.active ? 'shown' : 'hidden'}.`, 'good'); }));
    document.getElementById('saveRef').addEventListener('click', () => { const f = HH.formData(document.getElementById('refForm')).ref; db.settings.referral = { enabled: f.enabled, referrer: f.referrer, referee: f.referee }; HH.audit('Updated referral rules'); HH.save(); HH.toast('Referral rules saved.', 'good'); });
    document.getElementById('addBanner').addEventListener('click', bannerDialog);
  }

  function dialog(c) {
    const isNew = !c;
    c = c || { code: '', desc: '', type: 'flat', value: 100, minOrder: 299, maxDiscount: 100, usageLimit: 1000, perUser: 1, used: 0, validFrom: today(), validTo: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), scope: 'all', active: true };
    const m = HH.modal({
      title: isNew ? 'New coupon' : 'Edit ' + esc(c.code), wide: true,
      body: `<form class="form-grid" id="cf">
        <div class="field"><label for="c-code">Code</label><input id="c-code" name="code" value="${esc(c.code)}" ${isNew ? '' : 'readonly'} class="mono" style="text-transform:uppercase" placeholder="DIWALI250"></div>
        <div class="field"><label for="c-desc">Description shown in app</label><input id="c-desc" name="desc" value="${esc(c.desc)}"></div>
        <div class="field"><label for="c-type">Type</label><select id="c-type" name="type">${opt([['flat', 'Flat ₹ off'], ['percent', '% off']], c.type)}</select></div>
        <div class="field"><label for="c-val">Value</label><input id="c-val" name="value" type="number" min="1" value="${c.value}"></div>
        <div class="field"><label for="c-min">Minimum order (₹)</label><input id="c-min" name="minOrder" type="number" min="0" value="${c.minOrder}"></div>
        <div class="field"><label for="c-max">Maximum discount (₹)</label><input id="c-max" name="maxDiscount" type="number" min="0" value="${c.maxDiscount}"></div>
        <div class="field"><label for="c-lim">Total uses (0 = unlimited)</label><input id="c-lim" name="usageLimit" type="number" min="0" value="${c.usageLimit}"></div>
        <div class="field"><label for="c-per">Uses per customer</label><input id="c-per" name="perUser" type="number" min="1" value="${c.perUser}"></div>
        <div class="field"><label for="c-from">Valid from</label><input id="c-from" name="validFrom" type="date" value="${c.validFrom}"></div>
        <div class="field"><label for="c-to">Valid until</label><input id="c-to" name="validTo" type="date" value="${c.validTo}"></div>
        <div class="field"><label for="c-scope">Applies to</label><select id="c-scope" name="scope">${opt([['all', 'All services'], ...db.categories.map(x => [x.id, x.name])], c.scope)}</select></div>
        <div class="field" style="justify-content:end">${sw('active', c.active, 'Coupon is on')}</div>
      </form>`,
      foot: `${!isNew ? '<button class="btn btn-danger" id="c-del">Delete</button><span class="spacer"></span>' : ''}<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="c-ok">Save coupon</button>`
    });
    m.$('#c-ok').addEventListener('click', () => {
      const f = HH.formData(m.$('#cf')); f.code = f.code.trim().toUpperCase();
      if (!/^[A-Z0-9]{4,15}$/.test(f.code)) return HH.toast('Code must be 4–15 letters or digits.', 'bad');
      if (isNew && db.coupons.some(x => x.code === f.code)) return HH.toast('That code already exists.', 'bad');
      if (f.type === 'percent' && f.value > 90) return HH.toast('Percentage can’t be more than 90%.', 'bad');
      if (f.validTo < f.validFrom) return HH.toast('End date is before start date.', 'bad');
      Object.assign(c, f); if (isNew) db.coupons.unshift(c);
      HH.audit(`${isNew ? 'Created' : 'Edited'} coupon ${c.code}`); HH.save(); m.close(); render(); HH.toast(`Coupon ${c.code} saved.`, 'good');
    });
    m.$('#c-del')?.addEventListener('click', async () => {
      if (!(await HH.confirmDialog({ title: `Delete ${c.code}?`, text: 'Customers will no longer be able to apply it. Past bookings keep their discount.', ok: 'Delete', danger: true }))) return;
      db.coupons.splice(db.coupons.indexOf(c), 1); HH.audit(`Deleted coupon ${c.code}`); HH.save(); m.close(); render();
    });
  }
  function bannerDialog() {
    const m = HH.modal({
      title: 'Add banner',
      body: `<form class="form-grid" id="bf"><div class="field full"><label for="b-title">Title</label><input id="b-title" name="title"></div><div class="field"><label for="b-place">Placement</label><select id="b-place" name="placement">${opt(['Home hero', 'Home carousel', 'Category page', 'Partner app'])}</select></div><div class="field"><label for="b-link">Link</label><input id="b-link" name="link" placeholder="/services/ac"></div><div class="field"><label for="b-from">From</label><input id="b-from" type="date" name="from" value="${today()}"></div><div class="field"><label for="b-to">To</label><input id="b-to" type="date" name="to" value="${today()}"></div><div class="field full"><label for="b-img">Image</label><input id="b-img" type="file" accept="image/*" style="padding-top:6px"></div></form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="b-ok">Add banner</button>`
    });
    m.$('#b-ok').addEventListener('click', () => { const f = HH.formData(m.$('#bf')); if (!f.title.trim()) return HH.toast('Title is required.', 'bad'); db.banners.unshift({ id: 'BN' + Date.now(), ...f, active: true }); HH.save(); m.close(); render(); HH.toast('Banner added.', 'good'); });
  }
  document.getElementById('addBtn').addEventListener('click', () => dialog(null));
  render();
})();
