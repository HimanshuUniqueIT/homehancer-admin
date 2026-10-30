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

const VERSION = (process.env.GITHUB_SHA || String(Date.now())).slice(0, 8);
// Pages caches files for 10 minutes, so each deploy gets new script and style addresses.
const stamp = (s) => s.replace(/(\/assets\/(?:css|js)\/[\w/.-]+\.(?:css|js))(?=["'])/g, `$1?v=${VERSION}`);
const prefix = (s) => s.replace(ROOTED, `$1${BASE}/$2`);
const walk = (dir) => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const file of walk(OUT).filter(f => /\.(html|js|css)$/.test(f))) writeFileSync(file, file.endsWith('.html') ? stamp(prefix(readFileSync(file, 'utf8'))) : prefix(readFileSync(file, 'utf8')));

// Pages has no rewrites: /bookings/<id> and /payments/<id> reach 404.html, which boots the right detail screen.
const head = readFileSync(join(OUT, 'booking/index.html'), 'utf8').match(/<head>[\s\S]*<\/head>/)[0];
const notFound = readFileSync(join(OUT, '404.html'), 'utf8').match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(join(OUT, '404.html'), `<!DOCTYPE html>
<html lang="en">
${head.replace('<head>', '<head>\n  <meta name="robots" content="noindex">')}
<body>${notFound}
<script>
const match = location.pathname.match(/\\/(bookings|payments)\\/[^/]+\\/?$/);
if (match) {
  const page = match[1] === 'bookings' ? 'booking' : 'payment';
  document.body.dataset.page = page;
  document.body.innerHTML = '<div id="app"></div>';
  ['data.js', 'app.js', 'pages/' + page + '.js'].map(f => '${BASE}/assets/js/' + f + '?v=${VERSION}').forEach(src => { const s = document.createElement('script'); s.src = src; s.async = false; document.body.appendChild(s); });
} else document.title = 'Page not found · HomeHancer Admin';
</script>
</body>
</html>
`);

// Demo site with a sample login: keep it out of search results.
for (const file of walk(OUT).filter(f => f.endsWith('index.html'))) writeFileSync(file, readFileSync(file, 'utf8').replace('<head>', '<head>\n  <meta name="robots" content="noindex">'));
writeFileSync(join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`Built ${OUT}/ for base path "${BASE}"`);
