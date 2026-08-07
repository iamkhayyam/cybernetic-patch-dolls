#!/usr/bin/env node
// Adversarial test suite for the Quilting Bee.
// Requires a running hub + the three demo dolls. See PLATFORM.md "Running the floor".
//
//   node tests/attacks.mjs [--hub http://127.0.0.1:4020]

import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOLLS_DIR,
  loadDoll,
  loadPrivateKey,
  signRecord,
} from '../lib/core.mjs';

const argv = process.argv.slice(2);
const HUB = argv.includes('--hub') ? argv[argv.indexOf('--hub') + 1] : 'http://127.0.0.1:4020';

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  ok ? passed++ : failed++;
}

const idOf = (slug) => loadDoll(slug).genesis.record.identity.id;

async function terms(port, cap, input = 'x') {
  const r = await fetch(`http://127.0.0.1:${port}/x402/${cap}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  return { status: r.status, body: await r.json() };
}

function voucher(fromSlug, to, cap, amount, nonce) {
  const body = {
    spec: 'patchdoll/voucher/v0',
    from: idOf(fromSlug),
    to,
    capability: cap,
    amount,
    unit: 'thread',
    nonce,
    at: new Date().toISOString(),
  };
  return { body, sig: signRecord(body, loadPrivateKey(fromSlug)) };
}

const payHeader = (v) => Buffer.from(JSON.stringify(v)).toString('base64');

async function buy(port, cap, v, input = 'test input') {
  const r = await fetch(`http://127.0.0.1:${port}/x402/${cap}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-payment': payHeader(v) },
    body: JSON.stringify({ input }),
  });
  return { status: r.status, body: await r.json() };
}

async function settle(v) {
  const r = await fetch(`${HUB}/api/settle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ voucher: v }),
  });
  return { status: r.status, body: await r.json() };
}

// ---------- preflight ----------

try {
  const state = await fetch(`${HUB}/api/state`).then((r) => r.json());
  const online = state.dolls.filter((d) => d.online).length;
  if (online < 3) throw new Error(`only ${online}/3 dolls online`);
} catch (e) {
  console.error(`Cannot run: ${e.message}. Start the floor first — see PLATFORM.md.`);
  process.exit(1);
}

console.log('Adversarial suite — the Quilting Bee\n');

// ---------- 1. unpaid request is refused with terms ----------

console.log('unpaid access');
{
  const t = await terms(4022, 'haiku');
  check('unpaid request returns 402', t.status === 402);
  check('402 body carries price, payTo and nonce', !!(t.body.price?.amount && t.body.payTo && t.body.nonce));
}

// ---------- 2. forged voucher ----------

console.log('\nvoucher forgery');
{
  const t = await terms(4022, 'haiku');
  // Fennel signs a voucher that CLAIMS to come from Rowan.
  const body = {
    spec: 'patchdoll/voucher/v0',
    from: idOf('rowan-whipstitch'),
    to: t.body.payTo,
    capability: 'haiku',
    amount: t.body.price.amount,
    unit: 'thread',
    nonce: t.body.nonce,
    at: new Date().toISOString(),
  };
  const forged = { body, sig: signRecord(body, loadPrivateKey('fennel-gusset')) };
  const r = await buy(4022, 'haiku', forged);
  check('impersonating another doll is rejected', r.status === 402 && /signature invalid/.test(r.body.error), r.body.error);
}

// ---------- 3. tampered amount ----------

console.log('\nterms tampering');
{
  const t = await terms(4022, 'summarize');
  const v = voucher('rowan-whipstitch', t.body.payTo, 'summarize', 1, t.body.nonce); // underpay
  const r = await buy(4022, 'summarize', v);
  check('underpaying the quoted price is rejected', r.status === 402, r.body.error);
}

// ---------- 4. replay ----------

console.log('\nreplay');
{
  const t = await terms(4023, 'wordcount');
  const v = voucher('rowan-whipstitch', t.body.payTo, 'wordcount', t.body.price.amount, t.body.nonce);
  const first = await buy(4023, 'wordcount', v, 'one two three');
  check('honest purchase succeeds', first.status === 200 && !!first.body.result, first.body.result);
  const second = await buy(4023, 'wordcount', v, 'one two three');
  check('reusing the same voucher is rejected', second.status === 402, second.body.error);

  // Straight at the hub, bypassing the worker's nonce cache.
  const direct = voucher('rowan-whipstitch', idOf('fennel-gusset'), 'wordcount', 1, `test-${Date.now()}`);
  const s1 = await settle(direct);
  const s2 = await settle(direct);
  check('hub settles a fresh voucher', s1.status === 200 && s1.body.ok);
  check('hub refuses to settle it twice', s2.status === 422 && /already settled/.test(s2.body.error), s2.body.error);
}

// ---------- 5. overspend ----------

console.log('\noverspend');
{
  const v = voucher('rowan-whipstitch', idOf('fennel-gusset'), 'wordcount', 10 ** 6, `over-${Date.now()}`);
  const r = await settle(v);
  check('spending more threads than held is rejected', r.status === 422 && /insufficient/.test(r.body.error), r.body.error);
}

// ---------- 6. undeclared capability ----------

console.log('\ncapability boundaries');
{
  const r = await fetch('http://127.0.0.1:4023/x402/haiku', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: 'x' }),
  });
  check('a doll refuses to sell what its certificate omits', r.status === 404);

  // Try to enroll a capability the genesis record does not declare.
  const body = {
    spec: 'patchdoll/enroll/v0',
    id: idOf('fennel-gusset'),
    slug: 'fennel-gusset',
    url: 'http://127.0.0.1:4023',
    capabilities: { 'launch-missiles': 1 },
    at: new Date().toISOString(),
  };
  const enroll = await fetch(`${HUB}/api/enroll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body, sig: signRecord(body, loadPrivateKey('fennel-gusset')) }),
  }).then((r) => r.json());
  check('hub refuses to list undeclared capabilities', /not declared in genesis/.test(enroll.error || ''), enroll.error);
}

// ---------- 7. care-record tampering ----------

console.log('\nhistory tampering');
{
  const path = join(DOLLS_DIR, 'thistle-applique', 'care-record.json');
  const original = readFileSync(path, 'utf8');
  try {
    const care = JSON.parse(original);
    const target = care.entries[1] ?? care.entries[0];
    target.body.note = 'rewritten history';
    writeFileSync(path, JSON.stringify(care, null, 2));

    const { genesis, publicKeyPem, care: reloaded } = loadDoll('thistle-applique');
    const { verifyRecord, recordHash } = await import('../lib/core.mjs');
    let broke = false;
    let prev = recordHash(genesis.record);
    for (const e of reloaded.entries) {
      if (e.body.prev !== prev || !verifyRecord(e.body, e.sig, publicKeyPem)) { broke = true; break; }
      prev = recordHash(e.body);
    }
    check('editing a care entry breaks verification', broke);
  } finally {
    writeFileSync(path, original);
  }
  const { genesis, publicKeyPem, care } = loadDoll('thistle-applique');
  const { verifyRecord, recordHash } = await import('../lib/core.mjs');
  let ok = true;
  let prev = recordHash(genesis.record);
  for (const e of care.entries) {
    if (e.body.prev !== prev || !verifyRecord(e.body, e.sig, publicKeyPem)) { ok = false; break; }
    prev = recordHash(e.body);
  }
  check('restored record verifies clean again', ok);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
