(async function () {
  const { esc, inr, icon, opt, sw, datetime, rel, badge } = HH;
  const view = HH.shell({ title: 'Razorpay', subtitle: 'Payment gateway configuration for app and website checkout', crumbs: 'Finance', actions: `<a class="btn" href="https://dashboard.razorpay.com" target="_blank" rel="noopener">Razorpay Dashboard ↗</a><button class="btn btn-primary" id="saveBtn">Save changes</button>` });
  const hasServer = await HH.server();
  let cfg = await HH.rzpConfig(true);
  const offline = !cfg;

  const SECTIONS = [['status', 'Status'], ['credentials', 'API keys'], ['checkout', 'Checkout'], ['rules', 'Payment rules'], ['webhooks', 'Webhooks'], ['refunds', 'Refunds'], ['route', 'Route & payouts'], ['invoice', 'Invoice & GST'], ['alerts', 'Alerts'], ['tools', 'Test tools']];
  const EVENTS = [
    ['payment.authorized', 'Payment authorized', 'Customer paid, capture pending (manual capture only)'],
    ['payment.captured', 'Payment captured', 'Mark booking as paid'],
    ['payment.failed', 'Payment failed', 'Notify customer with retry link'],
    ['order.paid', 'Order paid', 'Confirms the full order amount was received'],
    ['refund.created', 'Refund created', 'Refund started'],
    ['refund.processed', 'Refund processed', 'Money sent back to customer'],
    ['refund.failed', 'Refund failed', 'Finance must retry manually'],
    ['payment_link.paid', 'Payment link paid', 'Extra work paid through a link'],
    ['transfer.processed', 'Transfer processed', 'Route: partner share moved to linked account'],
    ['payout.processed', 'Payout processed', 'RazorpayX: partner payout reached bank'],
    ['payout.failed', 'Payout failed', 'RazorpayX: payout bounced']
  ];

  if (offline) cfg = defaultConfig();

  function render() {
    const keys = cfg.mode === 'live' ? cfg.live : cfg.test;
    const ready = !!(keys.keyId && keys.hasSecret);
    const webhookUrl = location.origin + '/api/razorpay/webhook';
    const isLocal = /localhost|127\.0\.0\.1/.test(location.hostname);
    const checklist = [
      [!!(cfg.test.keyId && cfg.test.hasSecret), 'Test Key ID and Key Secret saved'],
      [!!cfg.hasWebhookSecret, 'Webhook secret saved'],
      [Object.values(cfg.webhookEvents).some(Boolean), 'At least one webhook event subscribed'],
      [!isLocal && location.protocol === 'https:', 'Admin and API served over HTTPS on your domain'],
      [!!(cfg.live.keyId && cfg.live.hasSecret), 'Live keys saved (after Razorpay KYC is activated)'],
      [cfg.mode === 'live', 'Mode switched to Live']
    ];
    view.innerHTML = `
      ${offline ? `<div class="callout warn">${icon('alert')}<div><b>The API server isn't running, so nothing on this page can be saved.</b> Start it with <code class="mono">npm start</code> in the project folder, then reload. Checkout and refunds use the simulator until then.</div></div>` : ''}
      <div class="settings-layout">
        <nav class="card settings-nav" aria-label="Razorpay sections">${SECTIONS.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav>
        <form id="rzpForm" class="stack" style="gap:20px" autocomplete="off">

          <section class="card" id="status"><div class="card-head"><h2>Status</h2><div class="row">${badge('generic', cfg.enabled ? 'active' : 'inactive')}<span class="badge plain ${cfg.mode === 'live' ? 'b-good' : 'b-warn'}">${cfg.mode === 'live' ? 'Live mode' : 'Test mode'}</span></div></div>
            <div class="card-body grid grid-2">
              <div class="stack">
                ${sw('enabled', cfg.enabled, '<b>Accept online payments</b> through Razorpay')}
                <div class="field"><span class="label">Mode</span><div class="row">
                  <label class="chip ${cfg.mode === 'test' ? 'on' : ''}"><input type="radio" name="mode" value="test" ${cfg.mode === 'test' ? 'checked' : ''} style="display:none">Test</label>
                  <label class="chip ${cfg.mode === 'live' ? 'on' : ''}"><input type="radio" name="mode" value="live" ${cfg.mode === 'live' ? 'checked' : ''} style="display:none">Live</label></div>
                  <span class="hint">Test mode uses rzp_test_ keys and no real money moves.</span></div>
                <div class="row"><button type="button" class="btn" id="testConn" ${offline ? 'disabled' : ''}>${icon('refresh')}Test connection</button><span id="connResult" class="small"></span></div>
              </div>
              <div><div class="label" style="margin-bottom:8px">Go-live checklist</div><div class="stack" style="gap:6px">${checklist.map(([ok, l]) => `<div class="row small" style="flex-wrap:nowrap"><span class="badge ${ok ? 'b-good' : ''} plain" style="width:22px;justify-content:center;padding:2px 0">${ok ? '✓' : ''}</span><span class="${ok ? '' : 'muted'}">${l}</span></div>`).join('')}</div></div>
            </div></section>

          <section class="card" id="credentials"><div class="card-head"><h2>API keys</h2><span class="muted small">Razorpay Dashboard → Account & Settings → API Keys</span></div>
            <div class="card-body stack">
              <div class="callout info">${icon('info')}<div>Key Secrets and the webhook secret are saved on the server only and shown masked. The Key ID is public: the checkout in your app needs it. Leave a secret field empty to keep the saved value.</div></div>
              <div class="section-title">Test keys</div>
              <div class="form-grid">
                <div class="field"><label for="f-test-keyId">Test Key ID</label><input id="f-test-keyId" name="test.keyId" value="${esc(cfg.test.keyId)}" placeholder="rzp_test_XXXXXXXXXXXXXX" spellcheck="false" class="mono"></div>
                <div class="field"><label for="f-test-keySecret">Test Key Secret</label><input id="f-test-keySecret" name="test.keySecret" type="password" placeholder="${cfg.test.hasSecret ? esc(cfg.test.keySecret) + ' (saved)' : 'Paste Key Secret'}" class="mono"></div>
              </div>
              <div class="section-title">Live keys</div>
              <div class="form-grid">
                <div class="field"><label for="f-live-keyId">Live Key ID</label><input id="f-live-keyId" name="live.keyId" value="${esc(cfg.live.keyId)}" placeholder="rzp_live_XXXXXXXXXXXXXX" spellcheck="false" class="mono"></div>
                <div class="field"><label for="f-live-keySecret">Live Key Secret</label><input id="f-live-keySecret" name="live.keySecret" type="password" placeholder="${cfg.live.hasSecret ? esc(cfg.live.keySecret) + ' (saved)' : 'Paste Key Secret'}" class="mono"></div>
                <div class="field"><label for="f-merchantId">Merchant ID</label><input id="f-merchantId" name="merchantId" value="${esc(cfg.merchantId)}" placeholder="Shown at top right of Razorpay Dashboard" class="mono"></div>
              </div>
            </div></section>

          <section class="card" id="checkout"><div class="card-head"><h2>Checkout</h2><span class="muted small">What customers see when they pay</span></div>
            <div class="card-body form-grid">
              <div class="field"><label for="f-bn">Business name on checkout</label><input id="f-bn" name="checkout.businessName" value="${esc(cfg.checkout.businessName)}"></div>
              <div class="field"><label for="f-logo">Logo URL (HTTPS, square)</label><input id="f-logo" name="checkout.logoUrl" value="${esc(cfg.checkout.logoUrl)}"></div>
              <div class="field"><label for="f-color">Theme colour</label><div class="row"><input type="color" id="f-color" name="checkout.themeColor" value="${esc(cfg.checkout.themeColor)}"><span class="mono small">${esc(cfg.checkout.themeColor)}</span></div></div>
              <div class="field"><label for="f-cur">Currency</label><select id="f-cur" name="checkout.currency">${opt([['INR', 'INR: Indian Rupee']], cfg.checkout.currency)}</select></div>
              <div class="field full"><span class="label">Payment methods shown</span><div class="row">${[['upi', 'UPI'], ['card', 'Cards'], ['netbanking', 'Netbanking'], ['wallet', 'Wallets'], ['emi', 'EMI'], ['paylater', 'Pay Later']].map(([k, l]) => `<label class="chip ${cfg.checkout.methods[k] ? 'on' : ''}"><input type="checkbox" name="checkout.methods.${k}" ${cfg.checkout.methods[k] ? 'checked' : ''} style="display:none">${l}</label>`).join('')}</div><span class="hint">Methods must also be enabled on your Razorpay account.</span></div>
              <div class="field">${sw('checkout.autoCapture', cfg.checkout.autoCapture, 'Auto-capture payments')}<span class="hint">Off = authorize at booking, capture after the job (within 5 days).</span></div>
              <div class="field">${sw('checkout.prefill', cfg.checkout.prefill, 'Prefill customer name, email and phone')}</div>
              <div class="field"><label for="f-timeout">Checkout timeout (minutes)</label><input id="f-timeout" type="number" min="1" max="60" name="checkout.timeoutMinutes" value="${cfg.checkout.timeoutMinutes}"></div>
              <div class="field" style="justify-content:end">${sw('checkout.retry', cfg.checkout.retry, 'Let customer retry after a failure')}</div>
            </div></section>

          <section class="card" id="rules"><div class="card-head"><h2>Payment rules</h2><span class="muted small">How bookings are charged</span></div>
            <div class="card-body form-grid">
              <div class="field"><label for="f-mode">Default payment mode</label><select id="f-mode" name="rules.defaultPaymentMode">${opt([['prepaid', 'Prepaid: pay full amount at booking'], ['advance', 'Advance: pay part now, rest after job'], ['postpaid', 'Pay after service']], cfg.rules.defaultPaymentMode)}</select></div>
              <div class="field"><label for="f-adv">Advance amount</label><div class="row" style="flex-wrap:nowrap"><select id="f-advt" name="rules.advanceType" aria-label="Advance type" style="width:120px">${opt([['percent', '% of total'], ['flat', 'Flat ₹']], cfg.rules.advanceType)}</select><input id="f-adv" type="number" min="0" name="rules.advanceValue" value="${cfg.rules.advanceValue}"></div></div>
              <div class="field">${sw('rules.platformFeeEnabled', cfg.rules.platformFeeEnabled, 'Charge a platform / convenience fee')}</div>
              <div class="field"><label for="f-pf">Platform fee</label><div class="row" style="flex-wrap:nowrap"><select name="rules.platformFeeType" aria-label="Fee type" style="width:120px">${opt([['flat', 'Flat ₹'], ['percent', '% of total']], cfg.rules.platformFeeType)}</select><input id="f-pf" type="number" min="0" name="rules.platformFeeValue" value="${cfg.rules.platformFeeValue}"></div></div>
              <div class="field"><label for="f-gfee">Razorpay fee (≈2% + GST) paid by</label><select id="f-gfee" name="rules.gatewayFeeBorneBy">${opt([['platform', 'HomeHancer absorbs it'], ['customer', 'Customer (shown as convenience fee)']], cfg.rules.gatewayFeeBorneBy)}</select></div>
              <div class="field" style="justify-content:end">${sw('rules.cashOnService', cfg.rules.cashOnService, 'Allow cash after service')}</div>
              <div class="field"><label for="f-min">Minimum online amount (₹)</label><input id="f-min" type="number" min="1" name="rules.minOnlineAmount" value="${cfg.rules.minOnlineAmount}"></div>
              <div class="field"><label for="f-max">Maximum online amount (₹)</label><input id="f-max" type="number" min="1" name="rules.maxOnlineAmount" value="${cfg.rules.maxOnlineAmount}"></div>
            </div></section>

          <section class="card" id="webhooks"><div class="card-head"><h2>Webhooks</h2><span class="muted small">Razorpay Dashboard → Account & Settings → Webhooks</span></div>
            <div class="card-body stack">
              <div class="form-grid">
                <div class="field full"><label for="f-whurl">Webhook URL (copy into Razorpay)</label><div class="input-group"><input id="f-whurl" value="${esc(webhookUrl)}" readonly class="mono"><button type="button" class="btn" id="copyUrl">${icon('copy')}Copy</button></div>
                  ${isLocal ? `<span class="hint">Razorpay can't reach localhost. For testing, expose port ${location.port || 80} with a tunnel (for example <span class="mono">cloudflared tunnel --url http://localhost:${location.port || 80}</span>) and use that HTTPS address.</span>` : ''}</div>
                <div class="field full"><label for="f-whs">Webhook secret</label><div class="input-group"><input id="f-whs" name="webhookSecret" type="password" placeholder="${cfg.hasWebhookSecret ? esc(cfg.webhookSecret) + ' (saved)' : 'Same secret you type in the Razorpay webhook form'}" class="mono"><button type="button" class="btn" id="genSecret">Generate</button></div><span class="hint">Every webhook is checked with HMAC-SHA256 of the raw body against the X-Razorpay-Signature header. Unsigned or wrongly signed calls are rejected.</span></div>
              </div>
              <div><div class="label" style="margin-bottom:6px">Events to handle</div><div class="card list">${EVENTS.map(([k, l, d]) => `<label class="list-item" style="cursor:pointer"><input type="checkbox" name="webhookEvents.${k}" ${cfg.webhookEvents[k] ? 'checked' : ''}><div><div class="cell-main">${l} <span class="mono muted" style="font-weight:400">${k}</span></div><div class="cell-sub">${d}</div></div></label>`).join('')}</div></div>
            </div></section>

          <section class="card" id="refunds"><div class="card-head"><h2>Refunds</h2></div>
            <div class="card-body form-grid">
              <div class="field"><label for="f-rs">Default refund speed</label><select id="f-rs" name="refunds.speed">${opt([['normal', 'Normal: 5–7 working days, free'], ['optimum', 'Instant where possible (extra fee)']], cfg.refunds.speed)}</select></div>
              <div class="field" style="justify-content:end">${sw('refunds.autoRefundOnCancel', cfg.refunds.autoRefundOnCancel, 'Auto-refund when cancelled within policy')}</div>
              <div class="field">${sw('refunds.partialAllowed', cfg.refunds.partialAllowed, 'Allow partial refunds')}</div>
              <div class="field">${sw('refunds.requireFinanceApproval', cfg.refunds.requireFinanceApproval, 'Refunds above ₹2,000 need Finance approval')}</div>
            </div></section>

          <section class="card" id="route"><div class="card-head"><h2>Route & payouts</h2><span class="muted small">Optional. Both need activation by Razorpay.</span></div>
            <div class="card-body stack">
              <div class="section-title">Razorpay Route: split each payment</div>
              <div class="form-grid">
                <div class="field">${sw('route.enabled', cfg.route.enabled, 'Send partner share to their linked account automatically')}</div>
                <div class="field"><label for="f-rc">Default platform commission %</label><input id="f-rc" type="number" min="0" max="60" name="route.defaultCommission" value="${cfg.route.defaultCommission}"></div>
                <div class="field full">${sw('route.holdUntilCompleted', cfg.route.holdUntilCompleted, 'Hold transfer until the job is marked completed')}<span class="hint">Linked account IDs are set per partner on the Partners page.</span></div>
              </div>
              <div class="section-title">RazorpayX: weekly partner payouts</div>
              <div class="form-grid">
                <div class="field">${sw('payouts.enabled', cfg.payouts.enabled, 'Pay partners through RazorpayX')}</div>
                <div class="field"><label for="f-xacc">RazorpayX account number</label><input id="f-xacc" name="payouts.accountNumber" value="${esc(cfg.payouts.accountNumber)}" placeholder="2323230000000000" class="mono"></div>
                <div class="field"><label for="f-xmode">Payout mode</label><select id="f-xmode" name="payouts.mode">${opt(['IMPS', 'NEFT', 'UPI'], cfg.payouts.mode)}</select></div>
                <div class="field"><label for="f-xsch">Schedule</label><select id="f-xsch" name="payouts.schedule">${opt([['daily', 'Daily'], ['weekly', 'Weekly (Monday)'], ['manual', 'Manual from Payouts page']], cfg.payouts.schedule)}</select></div>
              </div>
            </div></section>

          <section class="card" id="invoice"><div class="card-head"><h2>Invoice & GST</h2></div>
            <div class="card-body form-grid">
              <div class="field"><label for="f-gstin">GSTIN</label><input id="f-gstin" name="invoice.gstin" value="${esc(cfg.invoice.gstin)}" class="mono" maxlength="15"></div>
              <div class="field"><label for="f-sac">SAC code</label><input id="f-sac" name="invoice.sac" value="${esc(cfg.invoice.sac)}" class="mono"><span class="hint">9987: maintenance, repair and installation services</span></div>
              <div class="field"><label for="f-prefix">Invoice prefix</label><input id="f-prefix" name="invoice.prefix" value="${esc(cfg.invoice.prefix)}" class="mono"></div>
              <div class="field"><label for="f-next">Next invoice number</label><input id="f-next" type="number" min="1" name="invoice.nextNumber" value="${cfg.invoice.nextNumber}"></div>
              <div class="field"><label for="f-gsvc">GST on services %</label><input id="f-gsvc" type="number" name="invoice.gstOnService" value="${cfg.invoice.gstOnService}"></div>
              <div class="field"><label for="f-gfee2">GST on platform fee %</label><input id="f-gfee2" type="number" name="invoice.gstOnFee" value="${cfg.invoice.gstOnFee}"></div>
            </div></section>

          <section class="card" id="alerts"><div class="card-head"><h2>Alerts</h2></div>
            <div class="card-body form-grid">
              <div class="field full"><label for="f-aemail">Send alerts to</label><input id="f-aemail" type="email" name="alerts.email" value="${esc(cfg.alerts.email)}"></div>
              <div class="field">${sw('alerts.onPaymentFailed', cfg.alerts.onPaymentFailed, 'Payment failed')}</div>
              <div class="field">${sw('alerts.onWebhookFailed', cfg.alerts.onWebhookFailed, 'Webhook rejected or failed')}</div>
            </div></section>
        </form>
      </div>

      <section class="card" id="tools"><div class="card-head"><h2>Webhook log</h2><div class="row"><button class="btn btn-sm" id="refreshLog">${icon('refresh')}Refresh</button><button class="btn btn-sm" id="clearLog">Clear</button></div></div>
        <div class="table-tools"><span class="label">Simulate a signed webhook:</span><select id="simEvent" aria-label="Event">${opt(EVENTS.map(e => e[0]))}</select><input id="simAmount" type="number" value="799" style="width:110px" aria-label="Amount in rupees"><label class="check small"><input type="checkbox" id="simTamper"> Use wrong signature</label><label class="check small"><input type="checkbox" id="simDup"> Resend last event ID</label><button class="btn btn-sm btn-primary" id="simBtn" ${offline ? 'disabled' : ''}>Send test webhook</button></div>
        <div class="table-wrap"><table><thead><tr><th>Received</th><th>Event</th><th>Entity</th><th class="right">Amount</th><th>Booking</th><th>Signature</th><th>Result</th><th>Source</th></tr></thead><tbody id="logBody"><tr><td colspan="8"><div class="empty">Loading…</div></td></tr></tbody></table></div>
      </section>

      <div class="grid grid-2">
        <section class="card"><div class="card-head"><h2>Verify a payment signature</h2></div><div class="card-body stack">
          <p class="small muted" style="margin:0">After checkout, Razorpay returns <span class="mono">razorpay_signature</span>. Your server must check it equals HMAC-SHA256(<span class="mono">order_id|payment_id</span>, Key Secret) before marking a booking paid. Try it here; nothing is sent anywhere.</p>
          <div class="field"><label for="v-order">razorpay_order_id</label><input id="v-order" class="mono" placeholder="order_XXXXXXXXXXXXXX"></div>
          <div class="field"><label for="v-pay">razorpay_payment_id</label><input id="v-pay" class="mono" placeholder="pay_XXXXXXXXXXXXXX"></div>
          <div class="field"><label for="v-sig">razorpay_signature</label><input id="v-sig" class="mono"></div>
          <div class="field"><label for="v-secret">Key Secret (used in this browser only)</label><input id="v-secret" type="password" class="mono"></div>
          <div class="row"><button class="btn" id="vSample">Fill sample</button><button class="btn btn-primary" id="vCheck">Check signature</button><span id="vResult" class="small"></span></div>
        </div></section>
        <section class="card"><div class="card-head"><h2>Try a test payment</h2></div><div class="card-body stack">
          <p class="small muted" style="margin:0">${ready ? 'Opens the real Razorpay Checkout in <b>' + cfg.mode + ' mode</b>. In test mode use UPI ID <span class="mono">success@razorpay</span> or card <span class="mono">4111 1111 1111 1111</span>, any future expiry and any CVV.' : 'Save Test Key ID and Key Secret above to open the real Razorpay Checkout. Until then the test checkout opens.'}</p>
          <div class="field"><label for="tp-amt">Amount (₹)</label><input id="tp-amt" type="number" min="1" value="1"></div>
          <button class="btn btn-primary" id="tpBtn">${icon('payments')}Open checkout</button>
          <div class="section-title">Server endpoints in this prototype</div>
          <div class="code">POST /api/razorpay/orders      create order (server, uses Key Secret)
POST /api/razorpay/verify      check checkout signature
POST /api/razorpay/refund      refund a payment
POST /api/razorpay/webhook     Razorpay → your server
GET  /api/razorpay/webhooks    webhook log</div>
        </div></section>
      </div>`;
    wire();
    loadLog();
  }

  function wire() {
    const $ = (id) => document.getElementById(id);
    const form = $('rzpForm');
    form.addEventListener('change', e => {
      const chip = e.target.closest('.chip');
      if (chip && e.target.type === 'checkbox') chip.classList.toggle('on', e.target.checked);
      if (chip && e.target.type === 'radio') form.querySelectorAll(`input[name="${e.target.name}"]`).forEach(r => r.closest('.chip').classList.toggle('on', r.checked));
    });
    $('copyUrl').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('f-whurl').value); HH.toast('Webhook URL copied.', 'good'); } catch { $('f-whurl').select(); } });
    $('genSecret').addEventListener('click', () => {
      const s = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
      $('f-whs').type = 'text'; $('f-whs').value = s; HH.toast('Secret generated. Save, then paste the same value in Razorpay’s webhook form.');
    });
    $('saveBtn').onclick = async () => {
      if (offline) return HH.toast('Start the server (npm start) to save Razorpay settings.', 'bad');
      const f = HH.formData(form);
      const errs = [];
      if (f.test.keyId && !/^rzp_test_[A-Za-z0-9]{14}$/.test(f.test.keyId)) errs.push('Test Key ID should look like rzp_test_ followed by 14 characters.');
      if (f.live.keyId && !/^rzp_live_[A-Za-z0-9]{14}$/.test(f.live.keyId)) errs.push('Live Key ID should look like rzp_live_ followed by 14 characters.');
      if (f.invoice.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(f.invoice.gstin)) errs.push('GSTIN format is not valid.');
      if (!Object.values(f.checkout.methods).some(Boolean)) errs.push('Turn on at least one payment method.');
      if (f.mode === 'live' && !(await HH.confirmDialog({ title: 'Switch to Live mode?', text: 'Customers will be charged real money from now on. Make sure your Razorpay account KYC is activated and webhooks point to your live domain.', ok: 'Go live' }))) return;
      if (errs.length) return HH.toast(errs[0], 'bad');
      try {
        cfg = await HH.api('/api/razorpay/config', { method: 'POST', body: f });
        HH.audit('Updated Razorpay settings'); HH.toast('Razorpay settings saved.', 'good'); render();
        HH.rzpConfig(true);
      } catch (e) { HH.toast(e.message, 'bad'); }
    };
    $('testConn').addEventListener('click', async () => {
      $('connResult').innerHTML = '<span class="muted">Checking…</span>';
      try { const r = await HH.api('/api/razorpay/test-connection', { method: 'POST', body: {} }); $('connResult').innerHTML = `<span class="badge b-good">Connected</span> ${esc(r.keyId)} (${r.mode})`; }
      catch (e) { $('connResult').innerHTML = `<span class="badge b-bad">Failed</span> ${esc(e.message)}`; }
    });
    // Signature tool
    $('vSample').addEventListener('click', async () => {
      $('v-order').value = 'order_' + HH.uid('x', 14).slice(2); $('v-pay').value = 'pay_' + HH.uid('x', 14).slice(2); $('v-secret').value = 'sample_key_secret';
      $('v-sig').value = await hmac('sample_key_secret', `${$('v-order').value}|${$('v-pay').value}`); $('vResult').textContent = '';
    });
    $('vCheck').addEventListener('click', async () => {
      const [o, p, s, k] = ['v-order', 'v-pay', 'v-sig', 'v-secret'].map(i => $(i).value.trim());
      if (!o || !p || !s || !k) return ($('vResult').innerHTML = '<span class="badge b-warn">Fill all four fields</span>');
      const ok = (await hmac(k, `${o}|${p}`)) === s;
      $('vResult').innerHTML = ok ? '<span class="badge b-good">Valid: safe to mark paid</span>' : '<span class="badge b-bad">Invalid: do not mark paid</span>';
    });
    // Test payment
    $('tpBtn').addEventListener('click', () => {
      const amt = Math.max(1, Number($('tp-amt').value) || 1);
      const fake = { id: 'TEST-' + Date.now().toString().slice(-5), customerId: HH.db.customers[0].id, serviceId: HH.db.services[0].id, catId: HH.db.services[0].catId, price: { total: amt }, payMode: 'online', payStatus: 'pending', timeline: [] };
      HH.collectPayment(fake, () => HH.toast('Test payment finished. Real payments show up under Payments when made from a booking.'));
    });
    // Webhook tools
    $('refreshLog').addEventListener('click', loadLog);
    $('clearLog').addEventListener('click', async () => { if (offline) return; await HH.api('/api/razorpay/webhooks/clear', { method: 'POST', body: {} }); loadLog(); });
    $('simBtn').addEventListener('click', async () => {
      try {
        const body = { event: $('simEvent').value, amount: Math.round(Number($('simAmount').value) * 100), tamper: $('simTamper').checked, bookingId: HH.db.bookings[0].id };
        if ($('simDup').checked && lastEventId) body.eventId = lastEventId;
        const r = await HH.api('/api/razorpay/webhooks/simulate', { method: 'POST', body });
        lastEventId = r.eventId;
        HH.toast(`Webhook ${r.event}: ${r.status}`, r.status === 'processed' ? 'good' : 'bad'); loadLog();
      } catch (e) { HH.toast(e.message, 'bad'); }
    });
  }
  let lastEventId = null;

  async function loadLog() {
    const body = document.getElementById('logBody');
    if (offline) { body.innerHTML = '<tr><td colspan="8"><div class="empty">Start the server to receive and log webhooks.</div></td></tr>'; return; }
    try {
      const log = await HH.api('/api/razorpay/webhooks');
      body.innerHTML = log.length ? log.slice(0, 25).map(e => `<tr><td class="cell-sub">${datetime(e.receivedAt)}<div>${rel(e.receivedAt)}</div></td><td class="mono">${esc(e.event)}${e.subscribed ? '' : ' <span class="badge plain">not subscribed</span>'}</td><td class="mono">${esc(e.entityId || '—')}</td><td class="right num">${e.amount ? inr(e.amount / 100) : '—'}</td><td>${e.bookingId ? `<a href="/bookings/${esc(e.bookingId)}">${esc(e.bookingId)}</a>` : '—'}</td><td>${e.signatureValid ? '<span class="badge b-good">Valid</span>' : '<span class="badge b-bad">Invalid</span>'}</td><td>${badge('generic', e.status)}</td><td class="cell-sub">${esc(e.source)}</td></tr>`).join('') : '<tr><td colspan="8"><div class="empty">No webhooks yet. Send a test webhook above, or make a payment once Razorpay points at your webhook URL.</div></td></tr>';
    } catch (e) { body.innerHTML = `<tr><td colspan="8"><div class="empty">${esc(e.message)}</div></td></tr>`; }
  }

  async function hmac(secret, text) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
    return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
  }

  function defaultConfig() {
    return {
      enabled: true, mode: 'test', test: { keyId: '', keySecret: '', hasSecret: false }, live: { keyId: '', keySecret: '', hasSecret: false }, webhookSecret: '', hasWebhookSecret: false, merchantId: '',
      checkout: { businessName: 'HomeHancer', logoUrl: 'https://homehancer.co.in/icons/Icon-192.png', themeColor: '#C8287C', currency: 'INR', methods: { upi: true, card: true, netbanking: true, wallet: true, emi: false, paylater: false }, autoCapture: true, timeoutMinutes: 15, retry: true, prefill: true },
      rules: { defaultPaymentMode: 'prepaid', advanceType: 'percent', advanceValue: 20, platformFeeEnabled: true, platformFeeType: 'flat', platformFeeValue: 29, gatewayFeeBorneBy: 'platform', minOnlineAmount: 99, maxOnlineAmount: 200000, cashOnService: true },
      webhookEvents: Object.fromEntries(EVENTS.map(([k], i) => [k, i < 7])), refunds: { speed: 'normal', autoRefundOnCancel: true, partialAllowed: true, requireFinanceApproval: true },
      route: { enabled: false, defaultCommission: 18, holdUntilCompleted: true }, payouts: { enabled: false, accountNumber: '', mode: 'IMPS', schedule: 'weekly' },
      invoice: { gstin: '24AABCH1234F1Z5', prefix: 'HH/2026-27/', nextNumber: 1043, gstOnFee: 18, gstOnService: 18, sac: '9987' }, alerts: { email: 'finance@homehancer.co.in', onPaymentFailed: true, onWebhookFailed: true }
    };
  }

  render();
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
})();
