(function () {
  const { db, esc, opt, icon, sw } = HH;
  const view = HH.shell({ title: 'Settings', subtitle: 'Business details, booking rules, tax and app controls', actions: `<button class="btn btn-primary" id="saveBtn">Save changes</button>` });
  const s = db.settings;
  const SECTIONS = [['business', 'Business'], ['booking', 'Booking rules'], ['cancellation', 'Cancellation'], ['tax', 'Tax & commission'], ['app', 'App versions'], ['integrations', 'Integrations'], ['payments-link', 'Payments']];
  const f = (name, label, value, attrs = '', hint = '') => `<div class="field ${attrs.includes('full') ? 'full' : ''}"><label for="s-${name}">${label}</label><input id="s-${name}" name="${name}" value="${esc(value)}" ${attrs.replace('full', '')}>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  view.innerHTML = `<div class="settings-layout">
    <nav class="card settings-nav" aria-label="Settings sections">${SECTIONS.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav>
    <form id="sf" class="stack" style="gap:20px">
      <section class="card" id="business"><div class="card-head"><h2>Business</h2><span class="muted small">Shown on invoices, emails and the website footer</span></div><div class="card-body form-grid">
        ${f('business.name', 'Brand name', s.business.name)}${f('business.legalName', 'Legal name', s.business.legalName)}
        ${f('business.gstin', 'GSTIN', s.business.gstin, 'class="mono" maxlength="15"')}${f('business.pan', 'PAN', s.business.pan, 'class="mono" maxlength="10"')}
        ${f('business.phone', 'Support phone', s.business.phone)}${f('business.whatsapp', 'WhatsApp number', s.business.whatsapp)}
        ${f('business.email', 'Support email', s.business.email, 'type="email"')}${f('business.website', 'Website', s.business.website)}
        ${f('business.address', 'Registered address', s.business.address, 'full')}${f('business.hours', 'Working hours', s.business.hours)}
        <div class="field"><label for="s-logo">Logo</label><input id="s-logo" type="file" accept="image/*" style="padding-top:6px"></div>
      </div></section>
      <section class="card" id="booking"><div class="card-head"><h2>Booking rules</h2></div><div class="card-body form-grid">
        <div class="field"><label for="s-sl">Slot length</label><select id="s-sl" name="booking.slotLength">${opt([[60, '1 hour'], [120, '2 hours'], [180, '3 hours']], s.booking.slotLength)}</select></div>
        ${f('booking.leadTimeHours', 'Earliest booking (hours from now)', s.booking.leadTimeHours, 'type="number" min="0"')}
        ${f('booking.firstSlot', 'First slot', s.booking.firstSlot, 'type="time"')}${f('booking.lastSlot', 'Last slot', s.booking.lastSlot, 'type="time"')}
        ${f('booking.assignRadiusKm', 'Auto-assign radius (km)', s.booking.assignRadiusKm, 'type="number" min="1"')}${f('booking.partnerAcceptMinutes', 'Partner must accept within (minutes)', s.booking.partnerAcceptMinutes, 'type="number" min="1"', 'Then it goes to the next nearest partner')}
        <div class="field">${sw('booking.autoAssign', s.booking.autoAssign, 'Auto-assign nearest available partner')}</div>
        <div class="field">${sw('booking.otpOnStart', s.booking.otpOnStart, 'Partner enters customer OTP to start job')}</div>
        <div class="field">${sw('booking.photosOnComplete', s.booking.photosOnComplete, 'Before/after photos required to complete')}</div>
      </div></section>
      <section class="card" id="cancellation"><div class="card-head"><h2>Cancellation policy</h2></div><div class="card-body form-grid">
        ${f('cancellation.freeBeforeHours', 'Free cancellation up to (hours before slot)', s.cancellation.freeBeforeHours, 'type="number" min="0"')}
        ${f('cancellation.lateFee', 'Late cancellation fee (₹)', s.cancellation.lateFee, 'type="number" min="0"')}
        ${f('cancellation.partnerNoShowCredit', 'Wallet credit if partner doesn’t show (₹)', s.cancellation.partnerNoShowCredit, 'type="number" min="0"')}
        <div class="field"><label for="s-rt">Refund to</label><select id="s-rt" name="cancellation.refundTo">${opt([['source', 'Original payment method'], ['wallet', 'HomeHancer wallet (instant)'], ['ask', 'Let customer choose']], s.cancellation.refundTo)}</select></div>
      </div></section>
      <section class="card" id="tax"><div class="card-head"><h2>Tax & commission</h2></div><div class="card-body form-grid">
        ${f('tax.gstPercent', 'GST on services %', s.tax.gstPercent, 'type="number" min="0"')}${f('tax.sac', 'SAC code', s.tax.sac, 'class="mono"')}
        ${f('tax.invoicePrefix', 'Invoice prefix', s.tax.invoicePrefix, 'class="mono"')}${f('tax.placeOfSupply', 'Place of supply', s.tax.placeOfSupply)}
        ${f('commission.default', 'Default partner commission %', s.commission.default, 'type="number" min="0" max="60"', 'Categories and partners can override this')}${f('commission.tdsPercent', 'TDS on partner payouts %', s.commission.tdsPercent, 'type="number" min="0" step="0.1"', 'Section 194-O')}
      </div></section>
      <section class="card" id="app"><div class="card-head"><h2>App versions</h2></div><div class="card-body form-grid">
        ${f('app.latest', 'Latest app version', s.app.latest)}${f('app.minAndroid', 'Minimum Android version', s.app.minAndroid)}${f('app.minIOS', 'Minimum iOS version', s.app.minIOS)}
        <div class="field">${sw('app.forceUpdate', s.app.forceUpdate, 'Force older apps to update')}</div>
        <div class="field full">${sw('app.maintenance', s.app.maintenance, '<b>Maintenance mode</b>: app and website show "We’ll be back shortly" and block new bookings')}</div>
      </div></section>
      <section class="card" id="integrations"><div class="card-head"><h2>Integrations</h2></div><div class="card-body form-grid">
        ${f('integrations.mapsKey', 'Google Maps API key', s.integrations.mapsKey, 'class="mono"', 'Restrict it to your domains in Google Cloud Console')}
        <div class="field"><label for="s-sms">SMS provider</label><select id="s-sms" name="integrations.sms">${opt(['MSG91', 'Twilio', 'Gupshup', 'Kaleyra'], s.integrations.sms)}</select></div>
        <div class="field"><label for="s-mail">Email provider</label><select id="s-mail" name="integrations.email">${opt(['Amazon SES', 'SendGrid', 'Mailgun', 'Zoho ZeptoMail'], s.integrations.email)}</select></div>
        <div class="field"><label for="s-wa">WhatsApp provider</label><select id="s-wa" name="integrations.whatsapp">${opt(['Gupshup', 'Interakt', 'WATI', 'Meta Cloud API'], s.integrations.whatsapp)}</select></div>
        <div class="field"><label for="s-push">Push notifications</label><select id="s-push" name="integrations.push">${opt(['Firebase', 'OneSignal'], s.integrations.push)}</select></div>
      </div></section>
      <section class="card" id="payments-link"><div class="card-head"><h2>Payments</h2></div><div class="card-body row"><span>Razorpay keys, checkout, webhooks, refunds and payouts have their own page.</span><span class="spacer"></span><a class="btn" href="/razorpay">${icon('razorpay')}Open Razorpay settings</a></div></section>
    </form></div>`;
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const data = HH.formData(document.getElementById('sf'));
    if (data.business.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(data.business.gstin)) return HH.toast('GSTIN format is not valid (15 characters, e.g. 24AABCH1234F1Z5).', 'bad');
    if (data.app.maintenance && !s.app.maintenance && !(await HH.confirmDialog({ title: 'Turn on maintenance mode?', text: 'Customers will not be able to book until you turn it off.', ok: 'Turn on', danger: true }))) return;
    for (const k of Object.keys(data)) s[k] = { ...s[k], ...data[k] };
    HH.audit('Updated settings'); HH.save(); HH.toast('Settings saved.', 'good');
  });
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
})();
