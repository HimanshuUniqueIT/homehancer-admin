(function () {
  const { db, esc, opt, icon, sw } = HH;
  const view = HH.shell({ title: 'Notifications', subtitle: 'SMS, WhatsApp, email and push messages sent automatically', actions: `<button class="btn" id="campBtn">${icon('send')}Send campaign</button><button class="btn btn-primary" id="addBtn">${icon('plus')}New template</button>` });
  const CH = { sms: 'SMS', whatsapp: 'WhatsApp', email: 'Email', push: 'Push' };
  const VARS = ['{customer_name}', '{booking_id}', '{service_name}', '{slot}', '{partner_name}', '{amount}', '{otp}', '{zone}', '{invoice_no}', '{payment_link}', '{review_link}'];
  const sample = { customer_name: 'Diya Patel', booking_id: 'HH10421', service_name: 'AC service (split)', slot: '26 Apr, 11 AM', partner_name: 'Imran Shaikh', amount: '736', otp: '4821', zone: 'Satellite', invoice_no: 'HH/2026-27/10421', payment_link: 'rzp.io/l/hh10421', review_link: 'hh.co/r/10421' };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (m, k) => sample[k] ?? m);

  function render() {
    const events = [...new Set(db.templates.map(t => t.event))];
    view.innerHTML = `<section class="card"><div class="table-wrap"><table><thead><tr><th>Trigger</th><th>Channel</th><th>Message</th><th>On</th><th></th></tr></thead><tbody>
      ${events.map(ev => db.templates.filter(t => t.event === ev).map((t, i) => `<tr>${i === 0 ? `<td rowspan="${db.templates.filter(x => x.event === ev).length}" class="cell-main mono" style="vertical-align:top">${esc(ev)}</td>` : ''}<td><span class="badge plain">${CH[t.channel]}</span></td><td><div class="cell-main">${esc(t.subject)}</div><div class="cell-sub" style="max-width:60ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.body)}</div></td><td>${sw('nt_' + t.id, t.active)}</td><td class="right"><button class="btn btn-sm" data-edit="${t.id}">${icon('edit')}Edit</button></td></tr>`).join('')).join('')}
    </tbody></table></div></section>
    <section class="card"><div class="card-head"><h2>Providers</h2><a href="/settings#integrations">Change in Settings</a></div><div class="card-body grid grid-4">
      ${Object.entries({ SMS: db.settings.integrations.sms, Email: db.settings.integrations.email, WhatsApp: db.settings.integrations.whatsapp, Push: db.settings.integrations.push }).map(([k, v]) => `<div><div class="label">${k}</div><div class="cell-main">${esc(v)}</div><span class="badge b-good">Connected</span></div>`).join('')}
    </div></section>`;
    view.querySelectorAll('[name^=nt_]').forEach(el => el.addEventListener('change', () => { HH.by(db.templates, el.name.slice(3)).active = el.checked; HH.save(); HH.toast('Template ' + (el.checked ? 'on' : 'off') + '.', 'good'); }));
    view.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => edit(HH.by(db.templates, b.dataset.edit))));
  }
  function edit(t) {
    const isNew = !t;
    t = t || { id: 'NT' + Date.now(), event: 'booking_confirmed', channel: 'sms', subject: '', body: '', active: true };
    const m = HH.modal({
      title: isNew ? 'New template' : 'Edit template', wide: true,
      body: `<div class="grid grid-2"><form class="stack" id="tf">
          <div class="field"><label for="t-ev">Trigger event</label><input id="t-ev" name="event" value="${esc(t.event)}" class="mono" list="evlist"><datalist id="evlist">${[...new Set(db.templates.map(x => x.event))].map(e => `<option value="${e}">`).join('')}</datalist></div>
          <div class="field"><label for="t-ch">Channel</label><select id="t-ch" name="channel">${opt(Object.entries(CH), t.channel)}</select></div>
          <div class="field"><label for="t-sub">Subject / title</label><input id="t-sub" name="subject" value="${esc(t.subject)}"></div>
          <div class="field"><label for="t-body">Message</label><textarea id="t-body" name="body" rows="6">${esc(t.body)}</textarea><span class="hint" id="t-len"></span></div>
          <div class="row">${VARS.map(v => `<button type="button" class="chip mono" data-var="${v}" style="font-size:11.5px">${v}</button>`).join('')}</div>
        </form>
        <div class="stack"><span class="label">Preview with sample booking</span><div class="card card-body" style="background:var(--surface-2)"><div class="cell-main" id="pv-sub"></div><div class="small" id="pv-body" style="white-space:pre-wrap;margin-top:6px"></div></div><p class="small muted" style="margin:0">SMS templates must also be registered on DLT with the same wording before your SMS provider will deliver them in India.</p></div></div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn" id="t-test">Send test to me</button><button class="btn btn-primary" id="t-ok">Save template</button>`
    });
    const pv = () => { const f = HH.formData(m.$('#tf')); m.$('#pv-sub').textContent = fill(f.subject); m.$('#pv-body').textContent = fill(f.body); const n = fill(f.body).length; m.$('#t-len').textContent = f.channel === 'sms' ? `${n} characters · ${Math.ceil(n / 160) || 1} SMS` : `${n} characters`; };
    m.el.addEventListener('input', pv); pv();
    m.$$('[data-var]').forEach(b => b.addEventListener('click', () => { const ta = m.$('#t-body'), p = ta.selectionStart; ta.value = ta.value.slice(0, p) + b.dataset.var + ta.value.slice(ta.selectionEnd); ta.focus(); pv(); }));
    m.$('#t-test').addEventListener('click', () => HH.toast(`Test ${CH[m.$('#t-ch').value]} queued to ${HH.session.email}.`, 'good'));
    m.$('#t-ok').addEventListener('click', () => {
      const f = HH.formData(m.$('#tf')); if (!f.body.trim()) return HH.toast('Message can’t be empty.', 'bad');
      const unknown = (f.body.match(/\{\w+\}/g) || []).filter(v => !VARS.includes(v));
      if (unknown.length) return HH.toast('Unknown variable: ' + unknown[0], 'bad');
      Object.assign(t, f); if (isNew) db.templates.push(t); HH.audit(`Saved ${f.channel} template for ${f.event}`); HH.save(); m.close(); render(); HH.toast('Template saved.', 'good');
    });
  }
  document.getElementById('addBtn').addEventListener('click', () => edit(null));
  document.getElementById('campBtn').addEventListener('click', () => {
    const m = HH.modal({
      title: 'Send campaign',
      body: `<form class="form-grid" id="cf"><div class="field"><label for="c-aud">Audience</label><select id="c-aud" name="aud">${opt([['all', 'All customers'], ['inactive', 'No booking in 60 days'], ['zone', 'One zone'], ['partners', 'All active partners']])}</select></div><div class="field"><label for="c-zone">Zone</label><select id="c-zone" name="zone">${opt(db.zones.map(z => z.name))}</select></div><div class="field"><label for="c-ch">Channel</label><select id="c-ch" name="channel">${opt(Object.entries(CH), 'push')}</select></div><div class="field"><label for="c-when">Send</label><input id="c-when" type="datetime-local" name="when"></div><div class="field full"><label for="c-msg">Message</label><textarea id="c-msg" name="msg">Diwali offer: ₹250 off on painting and renovation with code DIWALI250. Book now!</textarea></div></form><p class="small" id="c-count" style="margin:12px 0 0"></p>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="c-ok">Send</button>`
    });
    const count = () => { const f = HH.formData(m.$('#cf')); const ids = new Set(db.bookings.filter(b => Date.now() - new Date(b.createdAt) < 60 * 864e5).map(b => b.customerId)); const n = f.aud === 'all' ? db.customers.length : f.aud === 'inactive' ? db.customers.filter(c => !ids.has(c.id)).length : f.aud === 'zone' ? db.customers.filter(c => c.zone === f.zone).length : db.partners.filter(p => p.status === 'active').length; m.$('#c-count').innerHTML = `<b>${n}</b> recipients`; return n; };
    m.el.addEventListener('input', count); count();
    m.$('#c-ok').addEventListener('click', () => { const n = count(); HH.audit(`Sent campaign to ${n} recipients`); m.close(); HH.toast(`Campaign ${m.$('#c-when').value ? 'scheduled' : 'sent'} to ${n} recipients.`, 'good'); });
  });
  render();
})();
