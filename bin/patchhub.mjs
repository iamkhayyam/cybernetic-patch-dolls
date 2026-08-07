#!/usr/bin/env node
// patchhub — the Quilting Bee: directory, thread ledger, x402 settlement, live dashboard.
//
//   node bin/patchhub.mjs [--port 4020]
//
// Threads are a fictional ledger unit. The hub grants each doll a starting spool at
// enrollment, verifies every voucher against the doll's genesis public key, and keeps
// an append-only transaction log. No real money is involved anywhere in v0.

import http from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT,
  allDolls,
  verifyWithRawKey,
  recordHash,
  quiltSvg,
  esc,
  short,
} from '../lib/core.mjs';
import { FONTS, BASE_CSS, FLOOR_CSS, marks } from '../lib/design.mjs';

const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const PORT = Number(flag('port', 4020));
const STATE_FILE = join(ROOT, 'hub-state.json');
const STARTING_SPOOL = 100;

// ---------- directory (from signed genesis records on disk) ----------

function directory() {
  const dir = new Map();
  for (const { slug, genesis } of allDolls()) {
    const r = genesis.record;
    dir.set(r.identity.id, {
      id: r.identity.id,
      slug,
      name: r.name,
      serial: r.serial,
      role: r.role,
      publicKey: r.identity.publicKey,
      fingerprint: r.identity.fingerprint,
      declared: r.capabilities,
      boundaries: r.boundaries,
    });
  }
  return dir;
}

// ---------- persistent hub state ----------

const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  : { spec: 'patchdoll/hub/v0', balances: {}, transactions: [], receipts: [], settledNonces: [] };
const enrollments = new Map(); // id -> {url, capabilities, lastSeen}
const settled = new Set(state.settledNonces);

const persist = () => {
  state.settledNonces = [...settled];
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
};

// ---------- api ----------

function apiEnroll(payload) {
  const dolls = directory();
  const b = payload.body;
  const doll = dolls.get(b?.id);
  if (!doll) return { error: `unknown doll ${b?.id} — no signed genesis record in the registry` };
  if (!verifyWithRawKey(b, payload.sig, doll.publicKey)) return { error: 'enrollment signature invalid' };
  // Refuse to list capabilities the doll's signed birth certificate doesn't declare.
  const unattested = Object.keys(b.capabilities || {}).filter((c) => !doll.declared.includes(c));
  if (unattested.length) return { error: `capabilities not declared in genesis record: ${unattested.join(', ')}` };

  enrollments.set(b.id, { url: b.url, capabilities: b.capabilities, lastSeen: Date.now() });
  let granted = 0;
  if (!(b.id in state.balances)) {
    state.balances[b.id] = STARTING_SPOOL;
    granted = STARTING_SPOOL;
    persist();
  }
  return { ok: true, granted };
}

function apiSettle(payload) {
  const dolls = directory();
  const v = payload.voucher?.body;
  const sig = payload.voucher?.sig;
  const payer = dolls.get(v?.from);
  const payee = dolls.get(v?.to);
  if (!payer || !payee) return { error: 'payer or payee not in registry' };
  if (v.unit !== 'thread' || !(Number.isInteger(v.amount) && v.amount > 0)) return { error: 'bad amount' };
  if (settled.has(v.nonce)) return { error: 'voucher already settled (replay)' };
  if (!verifyWithRawKey(v, sig, payer.publicKey)) return { error: 'voucher signature invalid' };
  if ((state.balances[v.from] ?? 0) < v.amount) return { error: `insufficient threads: ${payer.name} has ${state.balances[v.from] ?? 0}, needs ${v.amount}` };

  state.balances[v.from] -= v.amount;
  state.balances[v.to] = (state.balances[v.to] ?? 0) + v.amount;
  settled.add(v.nonce);
  state.transactions.push({
    at: new Date().toISOString(),
    from: v.from,
    to: v.to,
    amount: v.amount,
    capability: v.capability,
    voucherHash: recordHash(v),
  });
  persist();
  return { ok: true, balances: { [v.from]: state.balances[v.from], [v.to]: state.balances[v.to] } };
}

function apiReceipt(payload) {
  state.receipts.push({ at: new Date().toISOString(), kind: payload.kind || 'work', receipt: payload.receipt });
  if (state.receipts.length > 200) state.receipts = state.receipts.slice(-200);
  persist();
  return { ok: true };
}

function apiState() {
  const dolls = directory();
  const now = Date.now();
  return {
    dolls: [...dolls.values()].map((d) => {
      const e = enrollments.get(d.id);
      return {
        ...d,
        publicKey: undefined,
        quilt: quiltSvg(d.fingerprint.replace('sha256:', ''), 72),
        balance: state.balances[d.id] ?? null,
        online: !!e && now - e.lastSeen < 90_000,
        url: e?.url ?? null,
        selling: e?.capabilities ?? {},
      };
    }),
    transactions: state.transactions.slice(-30).reverse(),
    receipts: state.receipts.slice(-30).reverse(),
    threadsInFlight: state.transactions.reduce((s, t) => s + t.amount, 0),
  };
}

// ---------- server ----------

const json = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj, null, 2));
};
const readBody = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (c) => { data += c; });
  req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(dashboardHtml());
    }
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, apiState());
    if (req.method === 'GET' && url.pathname === '/api/registry') {
      return json(res, 200, { dolls: [...directory().values()].map(({ id, name, serial, publicKey, fingerprint }) => ({ id, name, serial, publicKey, fingerprint })) });
    }
    if (req.method === 'POST' && url.pathname === '/api/enroll') return json(res, 200, apiEnroll(await readBody(req)));
    if (req.method === 'POST' && url.pathname === '/api/settle') {
      const out = apiSettle(await readBody(req));
      return json(res, out.ok ? 200 : 422, out);
    }
    if (req.method === 'POST' && url.pathname === '/api/receipt') return json(res, 200, apiReceipt(await readBody(req)));
    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[hub] The Quilting Bee is open: http://127.0.0.1:${PORT}`);
});

// ---------- dashboard ----------

function dashboardHtml() {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Quilting Bee — The Cybernetic Patch Dolls</title>
${FONTS}
<style>
${BASE_CSS}
  body { padding-bottom: 96px; }
  .masthead { position: sticky; top: 0; z-index: 10; }
${FLOOR_CSS}
  footer { max-width: 62ch; margin: 72px auto 0; padding: 0 clamp(16px, 4vw, 40px); color: var(--graphite); font-size: var(--t-body); }
  footer b { color: var(--ink-2); font-weight: 600; }
</style>

<div class="masthead">
  <div>
    <div class="registry">The Cybernetic Patch Dolls</div>
    <div class="doc">Registry of agent identities</div>
  </div>
  <div style="text-align:right">
    <div class="doc">Coordination floor</div>
    <div class="serial">The Quilting Bee</div>
  </div>
</div>

<div class="wrap">
  ${marks()}
  <div class="strip" id="strip"></div>
  <h2 class="sec">Register <span id="regcount"></span></h2>
  <div class="register" id="register"></div>
  <div class="cols">
    <div>
      <h2 class="sec">Thread ledger</h2>
      <div class="log">
        <div class="head"><span>Time</span><span>Flow</span><span>Amount</span></div>
        <div id="ledger"></div>
      </div>
    </div>
    <div>
      <h2 class="sec">Work receipts</h2>
      <div class="log">
        <div class="head"><span>Time</span><span>Signed by</span><span>Signature</span></div>
        <div id="receipts"></div>
      </div>
    </div>
  </div>
</div>

<footer>
  Threads are a ledger unit issued by this hub. No money moves here. Payment follows an
  x402 exchange: a service answers <b>402 Payment Required</b> with its terms, the hiring
  agent signs a voucher, and the hub verifies that signature against the payer's
  birth-certificate key before settling. Completed work returns a receipt signed by the
  worker. Multi-agent jobs stitch those receipts into a quilt.
</footer>

<script>
const $ = (id) => document.getElementById(id);
const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const shortId = (s) => escHtml(String(s ?? '').replace('patch:ed25519:', '').replace('sha256:', '').slice(0, 10));
const seen = new Set();
let first = true;

async function refresh() {
  let s;
  try { s = await fetch('/api/state').then((r) => r.json()); } catch { return; }
  const names = Object.fromEntries(s.dolls.map((d) => [d.id, d.name]));
  const nm = (id) => escHtml(names[id] || shortId(id));
  // Ledger and receipt rows are dense; use a given name where it stays unambiguous,
  // since the register above carries every doll's full name.
  const firsts = s.dolls.map((d) => d.name.split(' ')[0]);
  const brief = Object.fromEntries(s.dolls.map((d) => {
    const f = d.name.split(' ')[0];
    return [d.id, firsts.filter((x) => x === f).length === 1 ? f : d.name];
  }));
  const bn = (id) => escHtml(brief[id] || shortId(id));
  const online = s.dolls.filter((d) => d.online).length;

  $('strip').innerHTML = [
    [online + '<span style="color:var(--graphite)">/' + s.dolls.length + '</span>', 'agents present'],
    [s.threadsInFlight, 'threads settled'],
    [s.receipts.filter((r) => r.kind === 'work').length, 'jobs worked'],
    [s.receipts.filter((r) => r.kind === 'quilt').length, 'quilts stitched'],
  ].map(([v, k]) => '<div class="cell"><span class="v">' + v + '</span><span class="k">' + k + '</span></div>').join('')
    + '<div class="cell live"><span class="pulse"></span><span class="k">Live</span></div>';

  $('regcount').textContent = s.dolls.length + ' registered, ' + online + ' present';

  $('register').innerHTML = s.dolls.map((d) => {
    const caps = Object.entries(d.selling || {});
    return '<div class="reg-row ' + (d.online ? 'on' : '') + '">'
      + '<div class="mount">' + d.quilt + '</div>'
      + '<div><h3>' + escHtml(d.name) + '</h3>'
      + '<div class="meta">' + escHtml(d.serial) + ' · ' + shortId(d.id) + '</div>'
      + '<div class="state"><span class="dot"></span>' + (d.online ? 'At the bee' : 'Away') + '</div></div>'
      + (caps.length
          ? '<div class="chips">' + caps.map(([c, p]) => '<span class="chip">' + escHtml(c) + ' <b>' + p + 't</b></span>').join('') + '</div>'
          : '<div class="idle">Not trading — ' + escHtml(d.role || 'resting') + '</div>')
      + '<div class="bal"><div class="n">' + (d.balance ?? '—') + '</div><div class="u">threads</div></div>'
      + '</div>';
  }).join('');

  $('ledger').innerHTML = s.transactions.length ? s.transactions.map((t) => {
      const key = t.voucherHash;
      const fresh = !first && !seen.has(key);
      seen.add(key);
      return '<div class="row ' + (fresh ? 'fresh' : '') + '" title="' + nm(t.from) + ' → ' + nm(t.to) + '">'
        + '<span class="t">' + escHtml(t.at.slice(11, 19)) + '</span>'
        + '<span class="body"><b>' + bn(t.from) + '</b><span class="arrow">→</span><b>' + bn(t.to) + '</b><span class="sep">·</span>' + escHtml(t.capability) + '</span>'
        + '<span class="amt n">' + t.amount + 't</span></div>';
    }).join('') : '<div class="empty">No threads have changed hands yet.</div>';

  $('receipts').innerHTML = s.receipts.length ? s.receipts.map((r) => {
      const b = r.receipt?.body ?? {};
      const body = r.kind === 'quilt'
        ? '<b>' + bn(b.stitchedBy) + '</b><span class="sep">·</span>stitched <b>' + escHtml(b.job ?? 'quilt') + '</b> from ' + (b.patches?.length ?? 0) + ' patches'
        : '<b>' + bn(b.worker) + '</b><span class="sep">·</span>' + escHtml(b.capability ?? '') + ' for <b>' + (b.client ? bn(b.client) : '—') + '</b>';
      return '<div class="row">'
        + '<span class="t">' + escHtml(r.at.slice(11, 19)) + '</span>'
        + '<span class="body">' + body + '</span>'
        + '<span class="amt sig">' + escHtml((r.receipt?.sig || '').slice(0, 10)) + '</span></div>';
    }).join('') : '<div class="empty">No work has been receipted yet.</div>';

  first = false;
}
refresh();
setInterval(refresh, 2000);
</script>
`;
}
