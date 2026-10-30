// Builds the static GitHub Pages copy of public/ into dist/, under a sub-path such as /homehancer-admin.
// Usage: BASE_PATH=/homehancer-admin node scripts/build-pages.mjs
import { cpSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const OUT = 'dist';
const ROUTES = 'assets|favicon\\.ico|login|dashboard|bookings|booking|customers|partners|services|zones|payments|payouts|razorpay|coupons|reviews|support|content|notifications|reports|admins|settings';
const ROOTED = new RegExp(`(["'\`]|url=)/(${ROUTES})(?=[/?#"'\`]|$)`, 'gm');

rmSync(OUT, { recursive: true, force: true });
cpSync('public', OUT, { recursive: true });

const prefix = (s) => s.replace(ROOTED, `$1${BASE}/$2`);
const walk = (dir) => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const file of walk(OUT).filter(f => /\.(html|js|css)$/.test(f))) writeFileSync(file, prefix(readFileSync(file, 'utf8')));

// Pages has no rewrites: /bookings/<id> reaches 404.html, which boots the booking screen for those addresses.
const head = readFileSync(join(OUT, 'booking/index.html'), 'utf8').match(/<head>[\s\S]*<\/head>/)[0];
const notFound = readFileSync(join(OUT, '404.html'), 'utf8').match(/<body>([\s\S]*)<\/body>/)[1];
const scripts = ['data.js', 'app.js', 'pages/booking.js'].map(f => `${BASE}/assets/js/${f}`);
writeFileSync(join(OUT, '404.html'), `<!DOCTYPE html>
<html lang="en">
${head.replace('<head>', '<head>\n  <meta name="robots" content="noindex">')}
<body>${notFound}
<script>
if (/\\/bookings\\/[^/]+\\/?$/.test(location.pathname)) {
  document.body.dataset.page = 'booking';
  document.body.innerHTML = '<div id="app"></div>';
  ${JSON.stringify(scripts)}.forEach(src => { const s = document.createElement('script'); s.src = src; s.async = false; document.body.appendChild(s); });
} else document.title = 'Page not found · HomeHancer Admin';
</script>
</body>
</html>
`);

// Demo site with a sample login: keep it out of search results.
for (const file of walk(OUT).filter(f => f.endsWith('index.html'))) writeFileSync(file, readFileSync(file, 'utf8').replace('<head>', '<head>\n  <meta name="robots" content="noindex">'));
writeFileSync(join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`Built ${OUT}/ for base path "${BASE}"`);
