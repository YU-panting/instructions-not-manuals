// audit-plugin-package.cjs -- "static audit" to run before installing any third-party DSH plugin. Read-only: it changes nothing.
//
// Why this exists: installing straight from the community marketplace once left DSH broken, and no log said what had changed.
// Real cause (dsh-auto-review CHANGELOG 0.13.8 / issue #74): the plugin declared 14 @deepseek-ai/dsh-* host implementation
// packages as runtime dependencies; pnpm put them at the profile root and displaced the host's own 0.2.1-rc.2 providers,
// so credentials/fs/subprocess/sandbox/sessionPersistence/connection could not activate -> the app would not start.
// This class of problem is visible 30 seconds before the install, provided somebody looks at package.json.
//
// Usage:
//   node audit-plugin-package.cjs <package dir | .tgz>
// Exit codes: 0 = safe to install   1 = conditional (read the WARN lines)   2 = refuse (BLOCKER)
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

// The profile directory comes from an environment variable; no machine-specific path is hardcoded.
// It still runs without it, but two sections are skipped: the host-version comparison in 2 and the profile-patch collision check in 4.
const HOST_PROFILE = process.env.DSH_PROFILE_DIR || '';
const HOST_PKGS = ['dsh-agent', 'cordis', 'schemastery']; // stand-ins for the host implementation line

const blockers = [];
const warns = [];
const infos = [];
const B = (m) => blockers.push(m);
const W = (m) => warns.push(m);
const I = (m) => infos.push(m);
if (!HOST_PROFILE) {
  W('DSH_PROFILE_DIR is not set -> skipping the host-version comparison and the profile-patch collision check'
    + ' (a DeepSeek Harness profile directory looks like <DSH_HOME>\\profiles\\<profile>; set it and rerun to check both)');
}

// ---------- minimal semver helpers (good enough, not a full implementation) ----------
function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(v.trim());
  if (!m) return null;
  return { nums: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split('.') : [] };
}
function cmpPre(a, b) {
  if (!a.length && !b.length) return 0;
  if (!a.length) return 1;   // with prerelease < without prerelease
  if (!b.length) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) { if (+x !== +y) return +x < +y ? -1 : 1; }
    else if (xn) return -1;            // numeric < alphanumeric
    else if (yn) return 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a.nums[i] !== b.nums[i]) return a.nums[i] < b.nums[i] ? -1 : 1;
  return cmpPre(a.pre, b.pre);
}
function satisfiesUnion(version, range) {
  const v = parse(version);
  if (!v) return { ok: false, why: 'version string could not be parsed' };
  const clauses = String(range).split('||').map((s) => s.trim()).filter(Boolean);
  for (const clause of clauses) {
    // expand ^ / ~ into real bounds (they are not equality)
    const bounds = [];
    for (const raw of clause.split(/\s+/).filter(Boolean)) {
      const m = /^([\^~><=]*)(.+)$/.exec(raw);
      const op = m[1];
      const base = parse(m[2]);
      if (!base) { bounds.push({ op: '=', bad: true }); continue; }
      if (op === '^') {
        bounds.push({ op: '>=', v: base });
        const upper = base.nums[0] > 0
          ? [base.nums[0] + 1, 0, 0]
          : base.nums[1] > 0
            ? [0, base.nums[1] + 1, 0]
            : [0, 0, base.nums[2] + 1];
        bounds.push({ op: '<', v: { nums: upper, pre: [] } });
      } else if (op === '~') {
        bounds.push({ op: '>=', v: base });
        bounds.push({ op: '<', v: { nums: [base.nums[0], base.nums[1] + 1, 0], pre: [] } });
      } else {
        bounds.push({ op: op || '=', v: base });
      }
    }
    let ok = true;
    for (const b of bounds) {
      if (b.bad || !b.v) { ok = false; break; }
      const c = cmp(v, b.v);
      if (b.op === '>=' && !(c >= 0)) ok = false;
      else if (b.op === '>' && !(c > 0)) ok = false;
      else if (b.op === '<=' && !(c <= 0)) ok = false;
      else if (b.op === '<' && !(c < 0)) ok = false;
      else if (b.op === '=' && !(c === 0)) ok = false;
      if (!ok) break;
    }
    if (ok) return { ok: true, why: clause };
  }
  return { ok: false, why: 'not inside any declared range' };
}

// ---------- resolve the package directory (a .tgz is unpacked to a temp dir first) ----------
let root = process.argv[2];
if (!root) { console.error('usage: node audit-plugin-package.cjs <package dir | .tgz>'); process.exit(2); }
if (!fs.existsSync(root)) { console.error('path does not exist: ' + root); process.exit(2); }
if (fs.statSync(root).isFile()) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-audit-'));
  execFileSync('tar.exe', ['-xzf', path.resolve(root), '-C', tmp], { stdio: 'inherit' });
  const inner = fs.readdirSync(tmp);
  root = inner.length === 1 && fs.statSync(path.join(tmp, inner[0])).isDirectory()
    ? path.join(tmp, inner[0]) : tmp;
  I('unpacked from tgz into a temp directory: ' + root);
}

const pkgPath = path.join(root, 'package.json');
if (!fs.existsSync(pkgPath)) { console.log('[BLOCKER] no package.json - this is not an npm package'); process.exit(2); }
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

console.log('=== audit target ===');
console.log('  name    : ' + pkg.name);
console.log('  version : ' + pkg.version);
console.log('  dir     : ' + root);
console.log('  license : ' + (pkg.license || '(not declared)'));
const files = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p); else files.push({ p, size: st.size });
  }
})(root);
const total = files.reduce((a, f) => a + f.size, 0);
I(`${files.length} files, ${(total / 1048576).toFixed(2)} MiB total`);

// ---------- 1. host package pollution (the #74 landmine) ----------
// Effect: this script is a command-line artifact - no UI, no screenshots; its effect is the verdict printed in the terminal.
console.log('\n=== 1. could it displace the host @deepseek-ai packages (the real cause of that breakage) ===');
const deps = pkg.dependencies || {};
const hostDeps = Object.keys(deps).filter((k) => k.startsWith('@deepseek-ai/'));
if (hostDeps.length) {
  B(`dependencies contain ${hostDeps.length} @deepseek-ai/* packages: ${hostDeps.join(', ')}`);
  B('   -> installing into a flat profile displaces the host implementation: credentials/fs/subprocess/sandbox will not come up and the app cannot start');
} else {
  console.log('  OK: zero @deepseek-ai/* in dependencies (this is the key safety condition)');
}
console.log('  full dependency list: ' + (Object.keys(deps).join(', ') || '(none)'));

// ---------- 2. version compatibility ----------
console.log('\n=== 2. version compatibility (ranges declared by the plugin vs this machine) ===');
const hostVer = {};
if (HOST_PROFILE) {
  for (const name of HOST_PKGS) {
    const p = path.join(HOST_PROFILE, 'node_modules', '@deepseek-ai', name, 'package.json');
    if (fs.existsSync(p)) hostVer[name] = JSON.parse(fs.readFileSync(p, 'utf8')).version;
  }
}
const hostDsh = hostVer['dsh-agent'];
console.log('  this machine: dsh-agent=' + (hostDsh || '?') + '  cordis=' + (hostVer.cordis || '?') + '  schemastery=' + (hostVer.schemastery || '?'));
if (pkg.engines && pkg.engines.dsh && hostDsh) {
  const r = satisfiesUnion(hostDsh, pkg.engines.dsh);
  if (r.ok) console.log(`  OK engines.dsh "${pkg.engines.dsh}" covers ${hostDsh} (matched ${r.why})`);
  else B(`engines.dsh "${pkg.engines.dsh}" does not cover this machine's ${hostDsh} (${r.why})`);
} else if (!pkg.engines || !pkg.engines.dsh) {
  W('no engines.dsh declared - compatibility with the local 0.2.1 line is not guaranteed');
}
const peers = pkg.peerDependencies || {};
let peerBad = 0;
for (const [name, range] of Object.entries(peers)) {
  if (!name.startsWith('@deepseek-ai/')) continue;
  const short = name.replace('@deepseek-ai/', '');
  const local = hostVer[short];
  if (!local) { I(`peer ${name} is not installed here (fine if it is an optional peer)`); continue; }
  const r = satisfiesUnion(local, range);
  if (!r.ok) { W(`peer ${name} requires "${range}", this machine's ${local} does not satisfy it`); peerBad++; }
}
if (!peerBad) console.log('  OK: every known peer requirement is satisfied');

// ---------- 3. install-time side effects ----------
console.log('\n=== 3. install-time side effects (native builds / install scripts) ===');
const scripts = pkg.scripts || {};
// only these three actually run when a consumer installs from a tarball
const installLifecycle = ['preinstall', 'install', 'postinstall'].filter((k) => scripts[k]);
if (installLifecycle.length) W(`install-time scripts present: ${installLifecycle.map((k) => k + ': ' + scripts[k]).join(' | ')} - these will execute on your machine`);
else console.log('  OK: nothing executes during install');
// prepare / prepack belong to packing or source installs; a tarball install does not run them
for (const k of ['prepare', 'prepack', 'prepublishOnly']) {
  if (scripts[k]) I(`${k} exists (${scripts[k]}) - runs only for git / source installs, not for tarball installs`);
}
const nativeBins = files.filter((f) => f.p.endsWith('.node'));
if (nativeBins.length) W(`ships ${nativeBins.length} .node native binary file(s)`); else console.log('  OK: no .node native binaries');

// ---------- 4. bundle declaration (missing it means the install does nothing) ----------
console.log('\n=== 4. bundle declaration (decides whether DSH can load it) ===');
const hasBundle = !!(pkg.dsh && pkg.dsh.bundle && pkg.dsh.bundle.patch);
if (hasBundle) console.log('  OK dsh.bundle.patch = ' + pkg.dsh.bundle.patch + ' (so: not not-bundle)');
else B('no dsh.bundle.patch declaration -> the loader reports not-bundle and the code never runs');
const patchFile = hasBundle ? path.join(root, pkg.dsh.bundle.patch) : null;
let insertedIds = [];
if (patchFile && fs.existsSync(patchFile)) {
  const txt = fs.readFileSync(patchFile, 'utf8');
  insertedIds = [...txt.matchAll(/^\s*-\s*id[\x3a]\s*([A-Za-z0-9._-]+)/gm)].map((m) => m[1]);
  console.log('  ids appearing in the bundle patch: ' + (insertedIds.join(', ') || '(no match)'));
  if (/invariant/i.test(txt)) I('the patch mentions invariant: if the host has no invariants service it will hang and may drag startup down with it - do not enable that line');
  // do the ids collide with the profile's existing patch
  const profPatch = HOST_PROFILE ? path.join(HOST_PROFILE, 'cordis.patch.yml') : null;
  if (profPatch && fs.existsSync(profPatch)) {
    const ptxt = fs.readFileSync(profPatch, 'utf8');
    const overlap = insertedIds.filter((id) => new RegExp('^- id[\\x3a]\\s*' + id + '\\s*$', 'm').test(ptxt));
    if (overlap.length) W('your profile patch already overrides these ids (so your configuration wins): ' + overlap.join(', '));
  }
} else if (hasBundle) {
  B('a bundle patch is declared but the file does not exist');
}

// ---------- 5. obvious danger points (informational) ----------
console.log('\n=== 5. code sample scan (information only, nothing is blocked here) ===');
const jsFiles = files.filter((f) => f.p.endsWith('.js') || f.p.endsWith('.mjs'));
let hits = { child_process: 0, evalNew: 0, network: 0, writeFs: 0 };
for (const f of jsFiles) {
  let t = '';
  try { t = fs.readFileSync(f.p, 'utf8'); } catch { continue; }
  if (/child_process/.test(t)) hits.child_process++;
  if (/\beval\(|new Function\(/.test(t)) hits.evalNew++;
  if (/fetch\(|https?:\/\//.test(t)) hits.network++;
  if (/writeFileSync|appendFileSync/.test(t)) hits.writeFs++;
}
console.log(`  ${jsFiles.length} js file(s): child_process ${hits.child_process} / eval ${hits.evalNew} / network ${hits.network} / file writes ${hits.writeFs}`);
I('these are counts, not verdicts: a third-party plugin using the network or writing files is normal - what matters is knowing where');

// ---------- 6. the locale trap ----------
const zh = path.join(root, 'locale', 'zh.json');
if (fs.existsSync(zh)) {
  try {
    const o = JSON.parse(fs.readFileSync(zh, 'utf8'));
    if (!o.meta) B('locale/zh.json has no meta wrapper -> the plugin silently disappears from the list (see skill section 5.1)');
    else console.log('  OK locale/zh.json has meta.title: ' + o.meta.title);
  } catch { W('locale/zh.json failed to parse'); }
} else {
  console.log('  no locale/ directory (the locale meta trap does not apply)');
}

// ---------- verdict ----------
console.log('\n=== verdict ===');
if (warns.length) { console.log('WARN:'); warns.forEach((m) => console.log('  WARN  ' + m)); }
if (blockers.length) {
  console.log('BLOCKER:'); blockers.forEach((m) => console.log('  BLOCK ' + m));
  console.log('\ndecision: do NOT install.');
  process.exit(2);
}
console.log(warns.length ? '\ndecision: conditional install (read the WARN lines above; take a backup and keep it rollback-able first)' : '\ndecision: safe to install (static audit passed)');
process.exit(warns.length ? 1 : 0);
