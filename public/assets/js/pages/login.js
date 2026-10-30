(function () {
  const { esc, icon, db } = HH;
  document.getElementById('app').innerHTML = `
    <div class="login">
      <section class="login-art">
        <div class="brand"><span class="brand-mark"><img src="/assets/brand/logo-192.png" alt="" width="26" height="26"></span><span><div class="brand-name">HomeHancer</div><div class="brand-sub">Admin console</div></span></div>
        <div class="stack" style="gap:16px">
          <h2>Run every booking, partner and payment in Ahmedabad from one place.</h2>
          <p style="margin:0;max-width:44ch">Today: ${db.bookings.filter(b => HH.sameDay(b.slot, new Date())).length} jobs scheduled, ${db.partners.filter(p => p.online).length} partners online, ${db.zones.filter(z => z.active).length} zones live.</p>
        </div>
        <div class="small" style="color:#f7c6dd">Payments secured by Razorpay · Demo build</div>
      </section>
      <section class="login-form">
        <form id="loginForm" novalidate>
          <div><h1>Sign in</h1><p class="muted" style="margin:4px 0 0">Use your HomeHancer admin account.</p></div>
          <div class="callout info">${icon('info')}<div>Demo login: <b>admin@homehancer.co.in</b> / <b>admin123</b><br><span class="small muted">Other roles: neha@ (Operations), priya@ (Finance), same password.</span></div></div>
          <div class="field"><label for="email">Email</label><input id="email" type="email" value="admin@homehancer.co.in" autocomplete="username" required></div>
          <div class="field"><label for="password">Password</label><input id="password" type="password" value="admin123" autocomplete="current-password" required></div>
          <div class="field hidden" id="otpField"><label for="otp">6-digit code from your authenticator app</label><input id="otp" inputmode="numeric" maxlength="6" placeholder="Any 6 digits in the demo"></div>
          <label class="check"><input type="checkbox" id="remember" checked> Keep me signed in on this device</label>
          <div id="loginError" class="callout bad hidden"></div>
          <button class="btn btn-primary" type="submit" style="height:42px">Sign in</button>
          <a class="small" href="#" id="forgot">Forgot password?</a>
        </form>
      </section>
    </div>`;
  const $ = (id) => document.getElementById(id);
  let step = 1;
  $('forgot').addEventListener('click', e => { e.preventDefault(); $('loginError').classList.remove('hidden'); $('loginError').className = 'callout info'; $('loginError').textContent = 'In the live system a reset link is emailed. In this demo the password is admin123.'; });
  $('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const email = $('email').value.trim().toLowerCase(), pass = $('password').value;
    const admin = db.admins.find(a => a.email === email && a.status === 'active');
    const err = (m) => { $('loginError').className = 'callout bad'; $('loginError').textContent = m; };
    if (!admin || pass !== 'admin123') return err('Email or password is wrong. Check both and try again.');
    if (admin.twoFA && step === 1) { step = 2; $('otpField').classList.remove('hidden'); $('otp').focus(); $('loginError').className = 'callout info'; $('loginError').textContent = 'Two-factor login is on for this account. Enter the code to continue.'; return; }
    if (admin.twoFA && !/^\d{6}$/.test($('otp').value)) return err('Enter the 6-digit code.');
    const s = JSON.stringify({ id: admin.id, name: admin.name, email: admin.email, role: admin.role });
    try { ($('remember').checked ? localStorage : sessionStorage).setItem(HH.SESSION_KEY, s); } catch {}
    admin.lastLogin = new Date().toISOString(); HH.save();
    const next = HH.params.get('next');
    location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  });
})();
