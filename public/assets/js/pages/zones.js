(function () {
  const { db, esc, num, icon, sw } = HH;
  const view = HH.shell({ title: 'Zones', subtitle: 'Areas of Ahmedabad where bookings are accepted', actions: `<button class="btn btn-primary" id="addZone">${icon('plus')}Add zone</button>` });

  function render() {
    const stat = (z) => ({ partners: db.partners.filter(p => p.status === 'active' && p.zones.includes(z.name)).length, bookings: db.bookings.filter(b => b.zone === z.name).length });
    // Simple schematic map: zones placed by their lat/lng inside the city bounding box
    const lats = db.zones.map(z => z.lat), lngs = db.zones.map(z => z.lng);
    const [la0, la1, lo0, lo1] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const maxB = Math.max(...db.zones.map(z => stat(z).bookings), 1);
    view.innerHTML = `<div class="grid grid-main">
      <section class="card"><div class="table-wrap"><table><thead><tr><th>Zone</th><th>Pincodes</th><th class="right">Partners</th><th class="right">Bookings (60d)</th><th class="right">Surge</th><th>Accepting bookings</th><th></th></tr></thead><tbody>
        ${db.zones.map(z => { const s = stat(z); return `<tr><td class="cell-main">${esc(z.name)}<div class="cell-sub">${esc(z.city)}</div></td><td class="mono">${esc(z.pincodes)}</td><td class="right num">${s.partners}${s.partners < 2 && z.active ? ' <span class="badge b-warn plain">low</span>' : ''}</td><td class="right num">${num(s.bookings)}</td><td class="right num">${z.surge ? '+' + z.surge + '%' : '—'}</td><td>${sw('z_' + z.id, z.active)}</td><td class="right"><button class="btn btn-sm" data-edit="${z.id}">${icon('edit')}Edit</button></td></tr>`; }).join('')}
      </tbody></table></div></section>
      <section class="card"><div class="card-head"><h2>Coverage map</h2><span class="muted small">Circle size = bookings</span></div><div class="card-body">
        <svg viewBox="0 0 320 320" style="width:100%;height:auto;background:var(--surface-2);border-radius:8px" role="img" aria-label="Zone map">
          ${[80, 160, 240].map(v => `<line x1="${v}" x2="${v}" y1="0" y2="320" stroke="var(--line)"/><line y1="${v}" y2="${v}" x1="0" x2="320" stroke="var(--line)"/>`).join('')}
          <path d="M150 0 C 160 80, 140 160, 165 320" stroke="color-mix(in srgb, var(--accent) 35%, transparent)" stroke-width="8" fill="none"/>
          <text x="172" y="300" class="axis-text" style="fill:var(--muted);font-size:10px">Sabarmati</text>
          ${db.zones.map(z => { const x = 24 + (z.lng - lo0) / (lo1 - lo0 || 1) * 272, y = 24 + (1 - (z.lat - la0) / (la1 - la0 || 1)) * 272, r = 5 + stat(z).bookings / maxB * 14; return `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${z.active ? 'var(--accent)' : 'var(--muted)'}" fill-opacity="${z.active ? .75 : .3}" stroke="var(--surface)" stroke-width="2"><title>${esc(z.name)}: ${stat(z).bookings} bookings</title></circle><text x="${x}" y="${y - r - 4}" text-anchor="middle" style="fill:var(--ink-2);font-size:10px">${esc(z.name)}</text></g>`; }).join('')}
        </svg>
        <p class="small muted" style="margin:10px 0 0">Schematic layout. The live system draws zone polygons on Google Maps with the key from Settings.</p>
      </div></section></div>`;
    view.querySelectorAll('[name^=z_]').forEach(el => el.addEventListener('change', () => { const z = HH.by(db.zones, el.name.slice(2)); z.active = el.checked; HH.audit(`${z.active ? 'Opened' : 'Closed'} zone ${z.name}`); HH.save(); HH.toast(`${z.name} ${z.active ? 'is accepting bookings' : 'is closed for new bookings'}.`, 'good'); render(); }));
    view.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => dialog(HH.by(db.zones, b.dataset.edit))));
  }
  function dialog(z) {
    const isNew = !z;
    z = z || { id: 'Z' + (db.zones.length + 1), name: '', pincodes: '', active: true, surge: 0, city: 'Ahmedabad', lat: 23.02 + Math.random() * .08 - .04, lng: 72.57 + Math.random() * .08 - .04 };
    const m = HH.modal({
      title: isNew ? 'Add zone' : 'Edit ' + esc(z.name),
      body: `<form class="form-grid" id="zf"><div class="field"><label for="zf-name">Zone name</label><input id="zf-name" name="name" value="${esc(z.name)}"></div><div class="field"><label for="zf-city">City</label><input id="zf-city" name="city" value="${esc(z.city)}"></div><div class="field full"><label for="zf-pin">Pincodes (comma separated)</label><input id="zf-pin" name="pincodes" value="${esc(z.pincodes)}"></div><div class="field"><label for="zf-surge">Surge pricing %</label><input id="zf-surge" name="surge" type="number" min="0" max="50" value="${z.surge}"><span class="hint">Added to service price for this zone</span></div><div class="field" style="justify-content:end">${sw('active', z.active, 'Accepting bookings')}</div></form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="zf-ok">Save zone</button>`
    });
    m.$('#zf-ok').addEventListener('click', () => {
      const f = HH.formData(m.$('#zf'));
      if (!f.name.trim()) return HH.toast('Zone name is required.', 'bad');
      if (f.pincodes.split(',').some(p => !/^\d{6}$/.test(p.trim()))) return HH.toast('Each pincode must be 6 digits.', 'bad');
      Object.assign(z, f, { name: f.name.trim() }); if (isNew) db.zones.push(z);
      HH.audit(`${isNew ? 'Added' : 'Edited'} zone ${z.name}`); HH.save(); m.close(); render(); HH.toast('Zone saved.', 'good');
    });
  }
  document.getElementById('addZone').addEventListener('click', () => dialog(null));
  render();
})();
