#!/usr/bin/env node
// bee — coordinate work between Patch Dolls over the x402 flow.
//
//   bee hire  --as <slug> --cap <capability> --input "..."         one doll hires another
//   bee quilt --as <slug> --job "title" --steps "cap: input || cap: @prev || ..."
//
// `quilt` runs steps in order; `@prev` in a step's input is replaced by the previous
// step's result. Each step is a paid x402 hire; the composite is signed as a
// quilt receipt whose patches reference every sub-receipt hash.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOLLS_DIR,
  loadDoll,
  loadPrivateKey,
  signRecord,
  verifyWithRawKey,
  recordHash,
  appendCare,
  short,
} from '../lib/core.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
};
const HUB = flag('hub', 'http://127.0.0.1:4020');

async function hubState() {
  return fetch(`${HUB}/api/state`).then((r) => r.json());
}

function pickSeller(state, capability, myId) {
  const sellers = state.dolls.filter((d) => d.online && d.id !== myId && capability in (d.selling || {}));
  if (!sellers.length) throw new Error(`no doll at the bee sells "${capability}"`);
  sellers.sort((a, b) => a.selling[capability] - b.selling[capability]);
  return sellers[0];
}

async function hire(asSlug, capability, input, { quiet = false } = {}) {
  const { genesis } = loadDoll(asSlug);
  const me = genesis.record;
  const privateKeyPem = loadPrivateKey(asSlug);
  const state = await hubState();
  const seller = pickSeller(state, capability, me.identity.id);

  // 1. knock without payment -> 402 with terms
  const knock = await fetch(`${seller.url}/x402/${capability}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (knock.status !== 402) throw new Error(`expected 402 from ${seller.name}, got ${knock.status}`);
  const terms = await knock.json();

  // 2. sign a voucher over the exact terms
  const voucherBody = {
    spec: 'patchdoll/voucher/v0',
    from: me.identity.id,
    to: terms.payTo,
    capability,
    amount: terms.price.amount,
    unit: terms.price.unit,
    nonce: terms.nonce,
    at: new Date().toISOString(),
  };
  const voucher = { body: voucherBody, sig: signRecord(voucherBody, privateKeyPem) };

  // 3. retry with X-Payment
  const paid = await fetch(`${seller.url}/x402/${capability}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-payment': Buffer.from(JSON.stringify(voucher)).toString('base64'),
    },
    body: JSON.stringify({ input }),
  });
  const out = await paid.json();
  if (paid.status !== 200) throw new Error(`payment rejected: ${out.error}`);

  // 4. verify the worker actually signed the receipt
  const registry = await fetch(`${HUB}/api/registry`).then((r) => r.json());
  const workerKey = registry.dolls.find((d) => d.id === seller.id)?.publicKey;
  if (!workerKey || !verifyWithRawKey(out.receipt.body, out.receipt.sig, workerKey)) {
    throw new Error(`receipt from ${seller.name} failed signature verification`);
  }

  appendCare(asSlug, 'commission', `Hired ${seller.name} for ${capability}; paid ${terms.price.amount} threads. Receipt ${short(recordHash(out.receipt.body))}.`);

  if (!quiet) {
    console.log(`\n${me.name} hired ${seller.name} — ${capability} for ${terms.price.amount} threads`);
    console.log(`  voucher  ${short(recordHash(voucherBody))}  receipt ${short(recordHash(out.receipt.body))}  (both signatures verified)`);
    console.log(`\n${out.result}`);
  }
  return { seller, terms, result: out.result, receipt: out.receipt };
}

async function quilt(asSlug, job, stepsSpec) {
  const { genesis } = loadDoll(asSlug);
  const me = genesis.record;
  const privateKeyPem = loadPrivateKey(asSlug);

  const steps = stepsSpec.split('||').map((s) => {
    const i = s.indexOf(':');
    if (i < 0) throw new Error(`bad step "${s}" — want "capability: input"`);
    return { capability: s.slice(0, i).trim(), input: s.slice(i + 1).trim() };
  });

  console.log(`${me.name} is stitching a quilt: "${job}" (${steps.length} patches)\n`);
  const patches = [];
  let prev = '';
  for (const [i, step] of steps.entries()) {
    const input = step.input.replace(/@prev/g, prev);
    const { seller, terms, result, receipt } = await hire(asSlug, step.capability, input, { quiet: true });
    console.log(`  patch ${i + 1}/${steps.length}  ${step.capability}  <- ${seller.name}  (${terms.price.amount}t, receipt ${short(recordHash(receipt.body))})`);
    console.log(`    ${result.split('\n').join('\n    ')}\n`);
    patches.push({ capability: step.capability, worker: seller.id, paid: terms.price.amount, receiptHash: recordHash(receipt.body) });
    prev = result;
  }

  const quiltBody = {
    spec: 'patchdoll/quilt-receipt/v0',
    job,
    stitchedBy: me.identity.id,
    patches,
    at: new Date().toISOString(),
  };
  const quiltReceipt = { body: quiltBody, sig: signRecord(quiltBody, privateKeyPem) };

  const dir = join(DOLLS_DIR, asSlug, 'receipts');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `quilt-${quiltBody.at.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(quiltReceipt, null, 2) + '\n');

  const spent = patches.reduce((s, p) => s + p.paid, 0);
  appendCare(asSlug, 'commission', `Stitched quilt "${job}": ${patches.length} patches from ${new Set(patches.map((p) => p.worker)).size} dolls, ${spent} threads. Quilt receipt ${short(recordHash(quiltBody))}.`);
  await fetch(`${HUB}/api/receipt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'quilt', receipt: quiltReceipt }),
  }).catch(() => {});

  console.log(`Quilt stitched: ${patches.length} patches, ${spent} threads spent.`);
  console.log(`  quilt receipt ${short(recordHash(quiltBody))} -> ${file.replace(process.cwd() + '/', '')}`);
}

try {
  if (cmd === 'hire') {
    const [asSlug, cap, input] = [flag('as'), flag('cap'), flag('input', '')];
    if (!asSlug || !cap) throw new Error('Usage: bee hire --as <slug> --cap <capability> --input "..."');
    await hire(asSlug, cap, input);
  } else if (cmd === 'quilt') {
    const [asSlug, job, steps] = [flag('as'), flag('job', 'untitled'), flag('steps')];
    if (!asSlug || !steps) throw new Error('Usage: bee quilt --as <slug> --job "title" --steps "cap: input || cap: @prev"');
    await quilt(asSlug, job, steps);
  } else {
    console.log(`bee — coordinate work between Patch Dolls (x402 flow, fictional threads)

Usage:
  bee hire  --as <slug> --cap <capability> --input "..." [--hub url]
  bee quilt --as <slug> --job "title" --steps "cap: input || cap: @prev || ..." [--hub url]`);
  }
} catch (e) {
  console.error(`bee: ${e.message}`);
  process.exit(1);
}
