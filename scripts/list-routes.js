// Prints every API route with its auth middleware, without connecting to the DB.
// Run from the repo root:   CLIENT_ID=x CLIENT_SECRET=x node scripts/list-routes.js
// Diff the output before/after a routing change to make sure nothing moved or lost its auth.
const path = require('path');
const dir = path.resolve(__dirname, '..');
process.chdir(dir);
require('dotenv').config({ path: path.join(dir, '.env'), quiet: true });
const fs = require('fs');
const src = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
// map var -> require path, and mount -> var
const reqs = {}; for (const m of src.matchAll(/const\s+(\w+)\s*=\s*require\(['"](\.\/routes\/[^'"]+)['"]\)/g)) reqs[m[1]] = m[2];
const out = [];
const authMods = {};
for (const f of ['authentication/is-auth.js','authentication/is-admin.js','middleware/auth.js']) { try { const m = require(path.join(dir, f)); if (typeof m === 'function') authMods['isAuth']=m; for (const k of Object.keys(m)) authMods[k]=m[k]; } catch(e){} }
const label = (fn) => { for (const [k,v] of Object.entries(authMods)) if (v===fn) return 'AUTH:'+k.replace(/.*\//,''); if (fn.name==='isSelfOrAdminMiddleware') return 'AUTH:isSelfOrAdmin'; return fn.name==='middleware' ? 'v' : 'fn'; };
const mounts = [];
for (const m of src.matchAll(/app\.use\(`\$\{API_ROOT\}([^`]+)`,\s*(\w+)\)/g)) if (reqs[m[2]]) mounts.push([null, m[1], reqs[m[2]]]);
for (const m of src.matchAll(/app\.use\(`\$\{API_ROOT\}([^`]+)`,\s*require\(['"]([^'"]+)['"]\)\)/g)) mounts.push([null, m[1], m[2]]);
for (const m of mounts) {
  const router = require(path.join(dir, m[2]));
  for (const layer of router.stack) {
    if (!layer.route) continue;
    const methods = Object.keys(layer.route.methods).map(x => x.toUpperCase()).join(',');
    const mws = layer.route.stack.map(s => label(s.handle));
    out.push(`${methods} /api/${m[1]}${layer.route.path}  [${mws.join(' ')}]`);
  }
}
console.log(out.join('\n'));
process.exit(0);
